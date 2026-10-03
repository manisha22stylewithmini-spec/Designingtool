import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import type { ViewPrefs } from "../store";
import type { El } from "../types";

function caseCss(el: El): React.CSSProperties["textTransform"] {
  const c = el.textCase ?? (el.uppercase ? "upper" : "none");
  return c === "upper" ? "uppercase" : c === "lower" ? "lowercase" : c === "title" ? "capitalize" : "none";
}

export type MenuItem = { label: string; key?: string; run: () => void; disabled?: boolean; danger?: boolean } | "-";

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);
  return (
    <div
      ref={ref}
      className="fixed z-[70] w-56 rounded-xl border border-zinc-200 bg-white p-1 text-xs shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === "-" ? (
          <div key={i} className="my-1 h-px bg-zinc-100" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              it.run();
              onClose();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35",
              it.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700",
            )}
          >
            {it.label}
            {it.key && <span className="text-[10px] text-zinc-400">{it.key}</span>}
          </button>
        ),
      )}
    </div>
  );
}

export function CropGhost({ el, zoom, size }: { el: El; zoom: number; size: { dw: number; dh: number } }) {
  const left = (el.w - size.dw) * (el.cropX ?? 0.5);
  const top = (el.h - size.dh) * (el.cropY ?? 0.5);
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.w * zoom,
        height: el.h * zoom,
        transform: `rotate(${el.rotation}deg)`,
      }}
    >
      <div
        className="absolute border border-dashed border-white/80 outline outline-1 outline-black/30"
        style={{ left: left * zoom, top: top * zoom, width: size.dw * zoom, height: size.dh * zoom }}
      >
        {el.type === "image" && (
          <img
            src={el.src}
            crossOrigin={el.src?.startsWith("data:") ? undefined : "anonymous"}
            className="h-full w-full opacity-30"
            style={{ transform: `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})` }}
          />
        )}
      </div>
      <div className="absolute inset-0 border-2 border-violet-600" />
    </div>
  );
}

export function QuickBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn("rounded-lg p-1.5 text-sm text-zinc-600 hover:bg-zinc-100", danger && "hover:bg-red-50 hover:text-red-600")}
    >
      {children}
    </button>
  );
}

export function handleCursor(hx: number, hy: number, rotation: number) {
  const cursors = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
  const base = (Math.atan2(hy, hx) * 180) / Math.PI + 90 + rotation;
  const idx = Math.round((((base % 180) + 180) % 180) / 45) % 4;
  return cursors[idx];
}

export function Outline({ el, zoom, className, children }: { el?: El; zoom: number; className?: string; children?: React.ReactNode }) {
  if (!el) return null;
  return (
    <div
      className={cn("absolute border-2", className)}
      style={{
        left: el.x * zoom - 1,
        top: el.y * zoom - 1,
        width: el.w * zoom + 2,
        height: el.h * zoom + 2,
        transform: `rotate(${el.rotation}deg)`,
      }}
    >
      {children}
    </div>
  );
}

export function TextEditor({ el, onChange, onDone }: { el: El; onChange: (t: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, []);
  return (
    <textarea
      ref={ref}
      value={el.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone();
      }}
      spellCheck={false}
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h + (el.fontSize ?? 32),
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: `${el.w / 2}px ${el.h / 2}px`,
        fontFamily: `"${el.fontFamily}"`,
        fontSize: el.fontSize,
        fontWeight: el.fontWeight,
        fontStyle: el.italic ? "italic" : "normal",
        textTransform: caseCss(el),
        letterSpacing: el.letterSpacing,
        lineHeight: `${(el.fontSize ?? 32) * (el.lineHeight ?? 1.2)}px`,
        textAlign: el.align,
        color: el.color,
        background: "rgba(124,58,237,0.06)",
        outline: `${2}px dashed rgba(124,58,237,0.7)`,
        border: "none",
        padding: 0,
        margin: 0,
        resize: "none",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        caretColor: "#7c3aed",
        userSelect: "text",
      }}
    />
  );
}

const RULER = 20;
export const RULER_SIZE = RULER;

/** Ruler along the top (x) or left (y) of the canvas, measured in design pixels of the active design. */
export function Ruler({
  axis,
  origin,
  zoom,
  length,
  onStartGuide,
}: {
  axis: "x" | "y";
  origin: number; // screen px from the ruler's start to design 0
  zoom: number;
  length: number;
  onStartGuide: (e: React.PointerEvent) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || length <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = axis === "x" ? length : RULER;
    const H = axis === "x" ? RULER : length;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.fillStyle = "#fafafa";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#a1a1aa";
    g.strokeStyle = "#d4d4d8";
    g.font = "9px Inter, sans-serif";
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const step = steps.find((s) => s * zoom >= 56) ?? 5000;
    const minor = step / 5;
    const first = Math.floor(-origin / zoom / minor) * minor;
    for (let v = first; origin + v * zoom < length; v += minor) {
      const p = Math.round(origin + v * zoom) + 0.5;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const len = major ? RULER : 5;
      g.beginPath();
      if (axis === "x") {
        g.moveTo(p, RULER);
        g.lineTo(p, RULER - len);
      } else {
        g.moveTo(RULER, p);
        g.lineTo(RULER - len, p);
      }
      g.stroke();
      if (major) {
        const label = String(Math.round(v));
        if (axis === "x") g.fillText(label, p + 3, 9);
        else {
          g.save();
          g.translate(9, p - 3);
          g.rotate(-Math.PI / 2);
          g.fillText(label, 0, 0);
          g.restore();
        }
      }
    }
    g.strokeStyle = "#e4e4e7";
    g.beginPath();
    if (axis === "x") {
      g.moveTo(0, RULER - 0.5);
      g.lineTo(W, RULER - 0.5);
    } else {
      g.moveTo(RULER - 0.5, 0);
      g.lineTo(RULER - 0.5, H);
    }
    g.stroke();
  }, [axis, origin, zoom, length]);
  return (
    <canvas
      ref={ref}
      onPointerDown={onStartGuide}
      title="Drag from the ruler to add a guide line"
      className={axis === "x" ? "block cursor-row-resize" : "block cursor-col-resize"}
      style={axis === "x" ? { width: length, height: RULER } : { width: RULER, height: length }}
    />
  );
}

/** Dropdown with the workspace helpers (grid, rulers, margins…). */
export function ViewMenu({ prefs, setPref, hasSafe }: { prefs: ViewPrefs; setPref: <K extends keyof ViewPrefs>(k: K, v: ViewPrefs[K]) => void; hasSafe: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const active = [prefs.grid, prefs.rulers, prefs.margins, prefs.snapGrid, prefs.pixel].filter(Boolean).length;
  const Item = ({ k, label, hint }: { k: "grid" | "snapGrid" | "smartGuides" | "rulers" | "margins" | "safe" | "pixel"; label: string; hint: string }) => (
    <button
      onClick={() => setPref(k, !prefs[k])}
      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100"
    >
      <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] text-white", prefs[k] ? "border-violet-600 bg-violet-600" : "border-zinc-300")}>
        {prefs[k] && "✓"}
      </span>
      <span>
        <span className="block text-xs font-medium text-zinc-800">{label}</span>
        <span className="block text-[10px] leading-snug text-zinc-500">{hint}</span>
      </span>
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium", open ? "border-violet-400 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50")}
      >
        View{active > 0 && <span className="rounded-full bg-violet-600 px-1.5 text-[10px] text-white">{active}</span>} ▾
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
          <Item k="smartGuides" label="Smart guides" hint="Snap to centres, edges and other items" />
          <Item k="grid" label="Grid" hint="Square grid over the design" />
          {prefs.grid && (
            <div className="flex items-center gap-2 px-2.5 pb-1.5 pl-9 text-[11px] text-zinc-500">
              Size
              {[20, 40, 60, 100].map((g) => (
                <button key={g} onClick={() => setPref("gridSize", g)} className={cn("rounded px-1.5 py-0.5", prefs.gridSize === g ? "bg-violet-100 text-violet-700" : "hover:bg-zinc-100")}>
                  {g}
                </button>
              ))}
            </div>
          )}
          <Item k="snapGrid" label="Snap to grid" hint="Moving items jump to grid lines" />
          <Item k="rulers" label="Rulers & guides" hint="Drag from a ruler to place a guide" />
          <Item k="margins" label="Margins" hint="Keep important things inside the dashed box" />
          {prefs.margins && (
            <div className="flex items-center gap-2 px-2.5 pb-1.5 pl-9 text-[11px] text-zinc-500">
              Inset
              {[4, 6, 8, 10].map((m) => (
                <button key={m} onClick={() => setPref("marginPct", m)} className={cn("rounded px-1.5 py-0.5", prefs.marginPct === m ? "bg-violet-100 text-violet-700" : "hover:bg-zinc-100")}>
                  {m}%
                </button>
              ))}
            </div>
          )}
          {hasSafe && <Item k="safe" label="Safe area" hint="Where the app's buttons cover stories & reels" />}
          <Item k="pixel" label="Pixel preview" hint="Show exactly what the exported image looks like" />
        </div>
      )}
    </div>
  );
}
