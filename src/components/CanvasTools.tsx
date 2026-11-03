import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { PiArrowsOutSimple, PiCircle, PiCursor, PiHand, PiLineSegment, PiPencilSimple, PiPenNib, PiSquare, PiTextT } from "react-icons/pi";
import { cn } from "../lib/cn";
import { makeShape, makeText, uid, DEFAULT_SHADOW, defaultAnim } from "../lib/factory";
import { corner, fitNodes, nearestOnPath, nodesToPath, simplify, smoothThrough, splitSegment, toggleNode, type Pt } from "../lib/vector";
import type { Tool, ViewPrefs } from "../store";
import type { El, Frame, PathNode } from "../types";
import { ColorPicker } from "./ui";

// ---------------- Toolbar ----------------

export const TOOLS: { id: Tool; label: string; key: string; icon: IconType; hint: string }[] = [
  { id: "select", label: "Move", key: "V", icon: PiCursor, hint: "Select, move and resize" },
  { id: "hand", label: "Hand", key: "H", icon: PiHand, hint: "Drag to pan around (or hold Space)" },
  { id: "pen", label: "Pen", key: "P", icon: PiPenNib, hint: "Click for corners, drag for curves. Click the first point to close" },
  { id: "pencil", label: "Pencil", key: "⇧P", icon: PiPencilSimple, hint: "Draw freehand" },
  { id: "rect", label: "Rectangle", key: "R", icon: PiSquare, hint: "Drag to draw a rectangle (Shift = square)" },
  { id: "ellipse", label: "Ellipse", key: "O", icon: PiCircle, hint: "Drag to draw an ellipse (Shift = circle)" },
  { id: "line", label: "Line", key: "L", icon: PiLineSegment, hint: "Drag to draw a line (Shift = straight angles)" },
  { id: "text", label: "Text", key: "T", icon: PiTextT, hint: "Click to place text" },
  { id: "scale", label: "Scale", key: "K", icon: PiArrowsOutSimple, hint: "Resize everything in proportion — text, borders and corners too" },
];

export function toolFromKey(e: KeyboardEvent): Tool | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (k === "p") return e.shiftKey ? "pencil" : "pen";
  const map: Record<string, Tool> = { v: "select", h: "hand", r: "rect", o: "ellipse", l: "line", t: "text", k: "scale" };
  return e.shiftKey ? null : (map[k] ?? null);
}

export function Toolbar({
  tool,
  setTool,
  prefs,
  setPref,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  prefs: ViewPrefs;
  setPref: <K extends keyof ViewPrefs>(k: K, v: ViewPrefs[K]) => void;
}) {
  const showStroke = tool === "pen" || tool === "pencil" || tool === "line";
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      {showStroke && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-zinc-900 px-3 py-2 text-white shadow-xl" onPointerDown={(e) => e.stopPropagation()}>
          <ColorPicker value={prefs.penColor} onChange={(c) => setPref("penColor", c)} label="Stroke colour" />
          <span className="text-[11px] text-zinc-400">Width</span>
          <input
            type="range"
            min={1}
            max={60}
            value={prefs.penWidth}
            onChange={(e) => setPref("penWidth", Number(e.target.value))}
            className="range w-28"
          />
          <span className="w-6 text-right text-xs tabular-nums">{prefs.penWidth}</span>
          <button onClick={() => setTool("select")} className="rounded-lg px-1.5 text-zinc-400 hover:text-white" title="Done (Esc)">
            ✕
          </button>
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl bg-zinc-900 p-1.5 shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        {TOOLS.map((t, i) => {
          const Icon = t.icon;
          const on = tool === t.id;
          return (
            <span key={t.id} className="flex items-center">
              {(i === 2 || i === 4 || i === 8) && <span className="mx-1 h-6 w-px bg-white/15" />}
              <button
                onClick={() => setTool(t.id)}
                title={`${t.label} (${t.key}) — ${t.hint}`}
                className={cn(
                  "group relative flex h-10 w-10 items-center justify-center rounded-xl text-[20px] transition",
                  on ? "bg-violet-600 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon />
                <span className="pointer-events-none absolute -top-9 hidden rounded-md bg-zinc-800 px-2 py-1 text-[10px] whitespace-nowrap text-white group-hover:block">
                  {t.label} <span className="text-zinc-400">{t.key}</span>
                </span>
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Drawing on the canvas ----------------

const basePath = (duration: number): Omit<El, "x" | "y" | "w" | "h" | "nodes" | "closed"> => ({
  id: uid(),
  type: "path",
  name: "Path",
  rotation: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  shadow: { ...DEFAULT_SHADOW },
  anim: { ...defaultAnim(duration), inType: "none" },
  fill: "transparent",
  stroke: "#111111",
  strokeWidth: 4,
});

/**
 * Transparent layer over the canvas that turns pointer input into new items for the active drawing tool.
 * Coordinates come from `toFrame` (design pixels of the active design).
 */
export function DrawLayer({
  tool,
  zoom,
  frame,
  duration,
  prefs,
  toFrame,
  onCreate,
  onDone,
}: {
  tool: Tool;
  zoom: number;
  frame: Frame;
  duration: number;
  prefs: ViewPrefs;
  toFrame: (x: number, y: number) => Pt;
  onCreate: (el: El, opts?: { edit?: boolean; keepTool?: boolean }) => void;
  onDone: () => void;
}) {
  const [pen, setPen] = useState<PathNode[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const [stroke, setStroke] = useState<Pt[]>([]);
  const [box, setBox] = useState<{ a: Pt; b: Pt } | null>(null);
  const dragIdx = useRef<number | null>(null);
  const penRef = useRef(pen);
  penRef.current = pen;

  const style = { stroke: prefs.penColor, strokeWidth: prefs.penWidth };

  const finishPen = (closed: boolean) => {
    const nodes = penRef.current;
    penRef.current = [];
    setPen([]);
    if (nodes.length < 2) return;
    const fit = fitNodes(nodes);
    onCreate({ ...basePath(duration), ...style, name: closed ? "Shape" : "Path", ...fit, closed } as El);
  };

  // keyboard for the pen: Enter / Esc finish, Backspace removes the last point
  useEffect(() => {
    if (tool !== "pen") return;
    const key = (e: KeyboardEvent) => {
      if (!penRef.current.length) return;
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        finishPen(false);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopImmediatePropagation();
        penRef.current = penRef.current.slice(0, -1);
        setPen(penRef.current);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  // switching tools finishes an open pen path
  useEffect(() => () => {
    if (penRef.current.length >= 2) finishPen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toFrame(e.clientX, e.clientY);
    if (tool === "pen") {
      const cur = penRef.current;
      const first = cur[0];
      if (cur.length >= 2 && first && Math.hypot(p.x - first.x, p.y - first.y) * zoom < 10) {
        finishPen(true);
        return;
      }
      dragIdx.current = cur.length;
      penRef.current = [...cur, corner(p.x, p.y)];
      setPen(penRef.current);
    } else if (tool === "pencil") setStroke([p]);
    else if (tool === "rect" || tool === "ellipse" || tool === "line") setBox({ a: p, b: p });
    else if (tool === "text") {
      const el = makeText(frame, duration, { text: "Type something", x: p.x, y: p.y - 30, w: Math.max(200, frame.w * 0.4), align: "left" });
      onCreate(el, { edit: true });
    }
  };

  const move = (e: React.PointerEvent) => {
    let p = toFrame(e.clientX, e.clientY);
    setHover(p);
    if (tool === "pen" && dragIdx.current !== null && e.buttons === 1) {
      const i = dragIdx.current;
      penRef.current = penRef.current.map((node, j) => {
        if (j !== i) return node;
        const hx = p.x - node.x;
        const hy = p.y - node.y;
        if (Math.hypot(hx, hy) * zoom < 3) return node;
        return { ...node, ox: hx, oy: hy, ix: -hx, iy: -hy, kind: "smooth" };
      });
      setPen(penRef.current);
    } else if (tool === "pencil" && e.buttons === 1) {
      setStroke((s) => {
        if (!s.length) return s;
        const last = s[s.length - 1];
        return Math.hypot(p.x - last.x, p.y - last.y) * zoom > 2 ? [...s, p] : s;
      });
    } else if (box && e.buttons === 1) {
      if (e.shiftKey) {
        const dx = p.x - box.a.x;
        const dy = p.y - box.a.y;
        if (tool === "line") {
          // snap the line to 45° steps
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          p = { x: box.a.x + Math.cos(ang) * len, y: box.a.y + Math.sin(ang) * len };
        } else {
          const s = Math.max(Math.abs(dx), Math.abs(dy));
          p = { x: box.a.x + Math.sign(dx || 1) * s, y: box.a.y + Math.sign(dy || 1) * s };
        }
      }
      setBox({ a: box.a, b: p });
    }
  };

  const up = () => {
    dragIdx.current = null;
    if (tool === "pencil" && stroke.length) {
      const pts = simplify(stroke, Math.max(0.8, 1.5 / zoom));
      setStroke([]);
      if (pts.length < 2) return;
      const nodes = smoothThrough(pts, false);
      const fit = fitNodes(nodes);
      onCreate({ ...basePath(duration), ...style, name: "Drawing", ...fit, closed: false } as El, { keepTool: true });
    }
    if (box) {
      const { a, b } = box;
      setBox(null);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      let w = Math.abs(b.x - a.x);
      let h = Math.abs(b.y - a.y);
      if (tool === "line") {
        if (Math.hypot(w, h) * zoom < 4) return onDone();
        const fit = fitNodes([corner(a.x, a.y), corner(b.x, b.y)]);
        onCreate({ ...basePath(duration), ...style, name: "Line", ...fit, closed: false } as El);
        return;
      }
      const U = Math.min(frame.w, frame.h) * 0.25;
      const clicked = w * zoom < 4 && h * zoom < 4;
      if (clicked) w = h = U; // just clicked: make a default-sized shape
      onCreate(makeShape(frame, duration, tool === "ellipse" ? "ellipse" : "rect", { x: clicked ? x - U / 2 : x, y: clicked ? y - U / 2 : y, w, h, fill: "#d4d4d8" }));
    }
  };

  // live previews
  const previewPen = pen.length ? nodesToPath(pen, false, 1, 1) : "";
  const last = pen[pen.length - 1];
  return (
    <div
      className="pointer-events-auto absolute"
      style={{ left: -20000, top: -20000, width: 40000, height: 40000, cursor: tool === "text" ? "text" : "crosshair", touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (tool === "pen" && penRef.current.length >= 2) {
          // the double-click added an extra point — drop it, then finish
          penRef.current = penRef.current.slice(0, -1);
          finishPen(false);
        }
      }}
    >
      <svg className="pointer-events-none absolute overflow-visible" style={{ left: 20000, top: 20000 }} width="1" height="1">
        <g transform={`scale(${zoom})`}>
          {pen.length > 0 && (
            <>
              <path d={previewPen} fill="none" stroke={prefs.penColor} strokeWidth={prefs.penWidth} strokeLinecap="round" strokeLinejoin="round" />
              {hover && last && dragIdx.current === null && (
                <line x1={last.x} y1={last.y} x2={hover.x} y2={hover.y} stroke="#7c3aed" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />
              )}
              {pen.map((n, i) => (
                <g key={i}>
                  {(n.ox || n.oy) && (
                    <>
                      <line x1={n.x + n.ix} y1={n.y + n.iy} x2={n.x + n.ox} y2={n.y + n.oy} stroke="#7c3aed" strokeWidth={1 / zoom} />
                      <circle cx={n.x + n.ox} cy={n.y + n.oy} r={3.5 / zoom} fill="#7c3aed" />
                      <circle cx={n.x + n.ix} cy={n.y + n.iy} r={3.5 / zoom} fill="#7c3aed" />
                    </>
                  )}
                  <rect
                    x={n.x - 4 / zoom}
                    y={n.y - 4 / zoom}
                    width={8 / zoom}
                    height={8 / zoom}
                    fill={i === 0 && pen.length > 1 ? "#7c3aed" : "#fff"}
                    stroke="#7c3aed"
                    strokeWidth={1.5 / zoom}
                  />
                </g>
              ))}
            </>
          )}
          {stroke.length > 1 && (
            <polyline points={stroke.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={prefs.penColor} strokeWidth={prefs.penWidth} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {box &&
            (tool === "line" ? (
              <line x1={box.a.x} y1={box.a.y} x2={box.b.x} y2={box.b.y} stroke={prefs.penColor} strokeWidth={prefs.penWidth} strokeLinecap="round" />
            ) : tool === "ellipse" ? (
              <ellipse
                cx={(box.a.x + box.b.x) / 2}
                cy={(box.a.y + box.b.y) / 2}
                rx={Math.abs(box.b.x - box.a.x) / 2}
                ry={Math.abs(box.b.y - box.a.y) / 2}
                fill="#d4d4d8"
                stroke="#7c3aed"
                strokeWidth={1.5 / zoom}
              />
            ) : (
              <rect
                x={Math.min(box.a.x, box.b.x)}
                y={Math.min(box.a.y, box.b.y)}
                width={Math.abs(box.b.x - box.a.x)}
                height={Math.abs(box.b.y - box.a.y)}
                fill="#d4d4d8"
                stroke="#7c3aed"
                strokeWidth={1.5 / zoom}
              />
            ))}
          {box && tool !== "line" && (
            <text x={Math.max(box.a.x, box.b.x) + 8 / zoom} y={Math.max(box.a.y, box.b.y) + 16 / zoom} fontSize={11 / zoom} fill="#7c3aed" fontFamily="Inter">
              {Math.round(Math.abs(box.b.x - box.a.x))} × {Math.round(Math.abs(box.b.y - box.a.y))}
            </text>
          )}
        </g>
      </svg>
      {tool === "pen" && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-900/85 px-3 py-1.5 text-[11px] text-white">
          {pen.length === 0
            ? "Click to place a corner · click and drag to make a curve"
            : "Click the first point to close · Enter or double-click to finish · Backspace removes the last point"}
        </div>
      )}
    </div>
  );
}

// ---------------- Editing anchor points (Figma style) ----------------

/**
 * Anchor editor for a path (or a photo's mask). Works in absolute pixels of the element box;
 * `onChange` receives normalised nodes.
 */
export function VectorEditor({
  el,
  nodes: normNodes,
  closed,
  zoom,
  onChange,
  onCheckpoint,
  onDone,
  label,
}: {
  el: El;
  nodes: PathNode[];
  closed: boolean;
  zoom: number;
  onChange: (nodes: PathNode[]) => void;
  onCheckpoint: () => void;
  onDone: () => void;
  label: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = el.w * zoom;
  const H = el.h * zoom;
  // screen-pixel nodes (box scaled by zoom)
  const abs = normNodes.map((n) => ({ ...n, x: n.x * W, y: n.y * H, ix: n.ix * W, iy: n.iy * H, ox: n.ox * W, oy: n.oy * H }));
  const norm = (a: PathNode[]) => a.map((n) => ({ ...n, x: n.x / W, y: n.y / H, ix: n.ix / W, iy: n.iy / H, ox: n.ox / W, oy: n.oy / H }));
  const rad = (el.rotation * Math.PI) / 180;
  const toLocal = (dx: number, dy: number) => ({ x: dx * Math.cos(rad) + dy * Math.sin(rad), y: -dx * Math.sin(rad) + dy * Math.cos(rad) });
  const absRef = useRef(abs);
  absRef.current = abs;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea")) return;
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onDone();
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel !== null) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (absRef.current.length <= (closed ? 3 : 2)) return;
        onCheckpoint();
        onChange(norm(absRef.current.filter((_, i) => i !== sel)));
        setSel(null);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });

  const drag = (e: React.PointerEvent, i: number, part: "anchor" | "in" | "out") => {
    e.stopPropagation();
    e.preventDefault();
    setSel(i);
    onCheckpoint();
    const start = { x: e.clientX, y: e.clientY };
    const n0 = abs[i];
    const move = (ev: PointerEvent) => {
      const d = toLocal(ev.clientX - start.x, ev.clientY - start.y);
      const next = absRef.current.map((n) => ({ ...n }));
      const n = next[i];
      if (part === "anchor") {
        n.x = n0.x + d.x;
        n.y = n0.y + d.y;
      } else {
        const hx = (part === "out" ? n0.ox : n0.ix) + d.x;
        const hy = (part === "out" ? n0.oy : n0.iy) + d.y;
        if (part === "out") {
          n.ox = hx;
          n.oy = hy;
        } else {
          n.ix = hx;
          n.iy = hy;
        }
        // smooth points keep both handles in a straight line (hold Alt to break them apart)
        if (n0.kind === "smooth" && !ev.altKey) {
          const len = part === "out" ? Math.hypot(n0.ix, n0.iy) : Math.hypot(n0.ox, n0.oy);
          const l = Math.hypot(hx, hy) || 1;
          if (part === "out") {
            n.ix = (-hx / l) * len;
            n.iy = (-hy / l) * len;
          } else {
            n.ox = (-hx / l) * len;
            n.oy = (-hy / l) * len;
          }
        } else if (ev.altKey) n.kind = "corner";
      }
      onChange(norm(next));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const d = nodesToPath(abs, closed, 1, 1);
  const s = sel !== null ? abs[sel] : null;
  const showHandles = (i: number) => sel !== null && (i === sel || Math.abs(i - sel) === 1 || (closed && Math.abs(i - sel) === abs.length - 1));

  return (
    <div
      className="pointer-events-auto absolute"
      style={{ left: el.x * zoom, top: el.y * zoom, width: W, height: H, transform: `rotate(${el.rotation}deg)` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setSel(null);
      }}
    >
      <svg className="absolute inset-0 overflow-visible" width={W} height={H}>
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="#7c3aed" strokeOpacity={0.25} strokeDasharray="3 3" />
        {/* wide invisible stroke so a double-click on the line adds a point */}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: "copy" }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            // pointer in box-local screen px (undo the rotation around the box centre)
            const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const l = toLocal(e.clientX - c.x, e.clientY - c.y);
            const p = { x: l.x + W / 2, y: l.y + H / 2 };
            const hit = nearestOnPath(abs, closed, p);
            if (hit.d > 14) return;
            onCheckpoint();
            onChange(norm(splitSegment(abs, hit.seg, hit.t)));
            setSel(hit.seg + 1);
          }}
        />
        <path d={d} fill="none" stroke="#7c3aed" strokeWidth={1.5} pointerEvents="none" />
        {abs.map((n, i) =>
          showHandles(i) && (n.ix || n.iy || n.ox || n.oy) ? (
            <g key={"h" + i}>
              {(n.ix || n.iy) && (
                <>
                  <line x1={n.x} y1={n.y} x2={n.x + n.ix} y2={n.y + n.iy} stroke="#7c3aed" strokeWidth={1} />
                  <circle cx={n.x + n.ix} cy={n.y + n.iy} r={4.5} fill="#fff" stroke="#7c3aed" strokeWidth={1.5} style={{ cursor: "grab" }} onPointerDown={(e) => drag(e, i, "in")} />
                </>
              )}
              {(n.ox || n.oy) && (
                <>
                  <line x1={n.x} y1={n.y} x2={n.x + n.ox} y2={n.y + n.oy} stroke="#7c3aed" strokeWidth={1} />
                  <circle cx={n.x + n.ox} cy={n.y + n.oy} r={4.5} fill="#fff" stroke="#7c3aed" strokeWidth={1.5} style={{ cursor: "grab" }} onPointerDown={(e) => drag(e, i, "out")} />
                </>
              )}
            </g>
          ) : null,
        )}
        {abs.map((n, i) => (
          <rect
            key={i}
            x={n.x - 5}
            y={n.y - 5}
            width={10}
            height={10}
            rx={n.kind === "smooth" ? 5 : 1.5}
            fill={sel === i ? "#7c3aed" : "#fff"}
            stroke="#7c3aed"
            strokeWidth={1.5}
            style={{ cursor: "move" }}
            onPointerDown={(e) => drag(e, i, "anchor")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onCheckpoint();
              onChange(norm(toggleNode(abs, i, closed)));
              setSel(i);
            }}
          >
            <title>Drag to move · double-click to switch between a sharp corner and a smooth curve</title>
          </rect>
        ))}
      </svg>
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-zinc-900 py-1 pr-1 pl-3 text-[11px] whitespace-nowrap text-white shadow-lg"
        style={{ top: -48, transform: `translateX(-50%) rotate(${-el.rotation}deg)` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span>
          ✒ {label}
          {s ? ` · ${s.kind === "smooth" ? "smooth point" : "corner"}` : ""}
        </span>
        <button onClick={onDone} className="rounded-lg bg-violet-600 px-2.5 py-1 font-semibold hover:bg-violet-500">
          Done
        </button>
      </div>
    </div>
  );
}
