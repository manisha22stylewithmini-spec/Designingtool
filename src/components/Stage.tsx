import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiCopy, FiLock, FiMaximize, FiMinimize, FiMinus, FiPlus, FiTrash2, FiUnlock } from "react-icons/fi";
import { MdOutlineFitScreen, MdOutlinePanTool } from "react-icons/md";
import { findPlatform, findVariant, ratioLabel } from "../data/platforms";
import { animState, STATIC } from "../lib/animation";
import { bgCss } from "../lib/background";
import { cn } from "../lib/cn";
import { bounds } from "../lib/geometry";
import { preloadDoc, renderDoc } from "../lib/render";
import { docOf, frameOf, useEditor } from "../store";
import type { Doc, El, RulerGuide } from "../types";
import { ElementView } from "./ElementView";
import { ContextMenu, CropGhost, handleCursor, Outline, QuickBtn, Ruler, RULER_SIZE, TextEditor, ViewMenu } from "./StageParts";
import { useActions } from "./useActions";

type SnapLine = { axis: "x" | "y"; pos: number };

const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function Stage() {
  const ed = useEditor();
  const { doc, project, page: cur, kind, prefs, setPref, selected, setSelected, updateEls, checkpoint, mode, time, setHint, update, cropId, setCropId } = ed;
  const { frame } = doc;
  const carousel = kind === "carousel";
  const free = prefs.free;
  const multiPage = kind === "static" || kind === "carousel";

  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 800, h: 600 });
  const [scroll, setScroll] = useState({ l: 0, t: 0 });
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // dragging / resizing / rotating
  const [hand, setHand] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [draftGuide, setDraftGuide] = useState<RulerGuide | null>(null);

  // ---------- board layout ----------
  const pageCount = project.pages.length;
  const frames = project.pages.map((_, i) => frameOf(project, i));
  const maxSide = Math.max(...frames.map((f) => Math.max(f.w, f.h)));
  const gap = free && !carousel ? Math.round((maxSide * prefs.boardGap) / 100) : 0;
  const positions: { x: number; y: number }[] = [];
  {
    let x = 0;
    for (const f of frames) {
      positions.push({ x, y: 0 });
      x += f.w + gap;
    }
  }
  const visible = free ? project.pages.map((_, i) => i) : [cur];
  const pos = (i: number) => (free ? positions[i] : { x: 0, y: 0 });
  const addTile = free && multiPage;
  const last = frames[frames.length - 1];
  const boardW = free ? positions[pageCount - 1].x + last.w + (addTile ? (carousel ? 40 : gap) + Math.min(last.w, last.h) * 0.4 : 0) : frame.w;
  const boardH = free ? Math.max(...frames.map((f) => f.h)) : frame.h;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [prefs.rulers]);

  const fitZoom = Math.max(0.03, Math.min((avail.w - 80) / boardW, (avail.h - (free ? 120 : 80)) / boardH));
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const pad = free ? Math.max(240, Math.max(avail.w, avail.h) * 0.6) : 40;
  const contentW = Math.max(avail.w, boardW * zoom + pad * 2);
  const contentH = Math.max(avail.h, boardH * zoom + pad * 2);
  const offX = (contentW - boardW * zoom) / 2;
  const offY = (contentH - boardH * zoom) / 2;
  const screenOf = (i: number) => ({ left: offX + pos(i).x * zoom, top: offY + pos(i).y * zoom });

  // ---------- zoom (anchored to the cursor) & centring ----------
  const pending = useRef<{ wx: number; wy: number; sx: number; sy: number } | null>(null);
  const zoomAt = useCallback(
    (z: number, clientX?: number, clientY?: number) => {
      const w = wrapRef.current;
      if (!w) return;
      const r = w.getBoundingClientRect();
      const sx = clientX !== undefined ? clientX - r.left : w.clientWidth / 2;
      const sy = clientY !== undefined ? clientY - r.top : w.clientHeight / 2;
      pending.current = { wx: (w.scrollLeft + sx - offX) / zoom, wy: (w.scrollTop + sy - offY) / zoom, sx, sy };
      setZoomMode(Math.max(0.03, Math.min(6, z)));
    },
    [offX, offY, zoom],
  );
  useLayoutEffect(() => {
    const w = wrapRef.current;
    const p = pending.current;
    if (!w || !p) return;
    pending.current = null;
    w.scrollLeft = offX + p.wx * zoom - p.sx;
    w.scrollTop = offY + p.wy * zoom - p.sy;
  }, [zoom, offX, offY]);

  const [centerReq, setCenterReq] = useState(0);
  const recenter = () => setCenterReq((n) => n + 1);
  useEffect(recenter, [free, kind]);
  useLayoutEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    // fit: centre the whole board; zoomed in: centre the active design
    const target = zoomMode === "fit" || !free ? { x: boardW / 2, y: boardH / 2 } : { x: pos(cur).x + frame.w / 2, y: pos(cur).y + frame.h / 2 };
    if (!free) {
      target.x = frame.w / 2;
      target.y = frame.h / 2;
    }
    w.scrollLeft = offX + target.x * zoom - w.clientWidth / 2;
    w.scrollTop = offY + target.y * zoom - w.clientHeight / 2;
  }, [centerReq, avail.w, avail.h, free ? 0 : cur]);

  // ⌘/Ctrl + wheel (or pinch) zooms around the cursor
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, zoomAt]);

  // ---------- hand tool / space to pan ----------
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest("input, textarea, select, [contenteditable=true]");
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === "Space" && mode === "design") {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey) setHand((h) => !h);
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomAt(zoom * 1.25);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomAt(zoom * 0.8);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setZoomMode("fit");
        recenter();
      }
      if (e.shiftKey && e.key === "!") {
        setZoomMode("fit");
        recenter();
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode, zoom, zoomAt]);
  const panning = hand || spaceDown;

  const startPanView = (e: React.PointerEvent) => {
    if (!(panning || e.button === 1)) return;
    e.preventDefault();
    e.stopPropagation();
    const w = wrapRef.current!;
    const s = { x: e.clientX, y: e.clientY, l: w.scrollLeft, t: w.scrollTop };
    w.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => {
      w.scrollLeft = s.l - (ev.clientX - s.x);
      w.scrollTop = s.t - (ev.clientY - s.y);
    };
    const up = () => {
      w.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  useEffect(() => {
    if (editingId && !doc.elements.some((e) => e.id === editingId)) setEditingId(null);
  }, [doc.elements, editingId]);

  const toFrame = useCallback(
    (cx: number, cy: number) => {
      const r = frameRef.current!.getBoundingClientRect();
      return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
    },
    [zoom],
  );

  const guides = project.guides ?? [];

  // ---------- drag to move ----------
  const onElementDown = (e: React.PointerEvent, el: El) => {
    if (e.button !== 0 || panning) return;
    e.stopPropagation();
    if (editingId === el.id) return;
    setEditingId(null);
    if (cropId === el.id) return startPan(e, el);
    let ids: string[];
    if (e.shiftKey) {
      ids = selected.includes(el.id) ? selected.filter((i) => i !== el.id) : [...selected, el.id];
      setSelected(ids);
      return;
    }
    ids = selected.includes(el.id) ? selected : [el.id];
    setSelected(ids);
    const movable = doc.elements.filter((x) => ids.includes(x.id) && !x.locked);
    if (!movable.length) {
      if (el.locked) setHint("This element is locked 🔒 — unlock it in the right panel to move it.");
      return;
    }
    const orig = new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }]));
    const box = movable.map(bounds).reduce((a, b) => ({
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right),
      bottom: Math.max(a.bottom, b.bottom),
      cx: 0,
      cy: 0,
    }));
    const others = doc.elements.filter((x) => !ids.includes(x.id) && !x.hidden).map(bounds);
    const smart = prefs.smartGuides;
    const xs = [
      ...(smart ? [0, frame.w / 2, frame.w, ...others.flatMap((o) => [o.left, o.cx, o.right])] : []),
      ...(prefs.margins ? [margin, frame.w - margin] : []),
      ...guides.filter((g) => g.axis === "x").map((g) => g.pos),
    ];
    const ys = [
      ...(smart ? [0, frame.h / 2, frame.h, ...others.flatMap((o) => [o.top, o.cy, o.bottom])] : []),
      ...(prefs.margins ? [margin, frame.h - margin] : []),
      ...guides.filter((g) => g.axis === "y").map((g) => g.pos),
    ];
    const thr = 6 / zoom;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    let last = { dx: 0, dy: 0 };

    const snap = (vals: number[], targets: number[]) => {
      let best: { d: number; pos: number } | null = null;
      for (const v of vals)
        for (const t of targets) {
          const d = t - v;
          if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, pos: t };
        }
      return best;
    };

    const move = (ev: PointerEvent) => {
      let dx = (ev.clientX - start.x) / zoom;
      let dy = (ev.clientY - start.y) / zoom;
      if (!moved) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
        moved = true;
        checkpoint();
        setBusy(true);
        setHint(
          free
            ? "Moving… drop it on another design to move it there · it can sit outside the frame too · hold Alt to stop snapping"
            : "Moving… purple lines appear when it lines up with the centre, edges or other items.",
        );
      }
      const g: SnapLine[] = [];
      if (!ev.altKey) {
        const bw = box.right - box.left;
        const bh = box.bottom - box.top;
        const sx = snap([box.left + dx, box.left + dx + bw / 2, box.left + dx + bw], xs);
        if (sx) {
          dx += sx.d;
          g.push({ axis: "x", pos: sx.pos });
        } else if (prefs.snapGrid) dx = Math.round((box.left + dx) / prefs.gridSize) * prefs.gridSize - box.left;
        const sy = snap([box.top + dy, box.top + dy + bh / 2, box.top + dy + bh], ys);
        if (sy) {
          dy += sy.d;
          g.push({ axis: "y", pos: sy.pos });
        } else if (prefs.snapGrid) dy = Math.round((box.top + dy) / prefs.gridSize) * prefs.gridSize - box.top;
      }
      last = { dx, dy };
      setSnapLines(g);
      updateEls([...orig.keys()], (m) => ({ x: orig.get(m.id)!.x + dx, y: orig.get(m.id)!.y + dy }), false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setSnapLines([]);
      setBusy(false);
      if (!moved) return;
      setHint(null);
      // Free board: dropping a single item onto another design moves it there.
      if (free && movable.length === 1 && pageCount > 1) {
        const m = movable[0];
        const o = orig.get(m.id)!;
        const nx = o.x + last.dx;
        const ny = o.y + last.dy;
        const cx = pos(cur).x + nx + m.w / 2;
        const cy = pos(cur).y + ny + m.h / 2;
        const target = positions.findIndex((p, j) => cx >= p.x && cx <= p.x + frames[j].w && cy >= p.y && cy <= p.y + frames[j].h);
        if (target >= 0 && target !== cur) {
          ed.moveToPage(m.id, target, nx + pos(cur).x - positions[target].x, ny + pos(cur).y - positions[target].y);
          ed.notify(`Moved to ${carousel ? "slide" : "design"} ${target + 1}`);
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---------- resize ----------
  const onHandleDown = (e: React.PointerEvent, el: El, hx: number, hy: number) => {
    e.stopPropagation();
    e.preventDefault();
    checkpoint();
    setBusy(true);
    const p0 = toFrame(e.clientX, e.clientY);
    const r = (el.rotation * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const c0 = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    const corner = hx !== 0 && hy !== 0;
    const keepRatio = corner && (el.type === "image" || el.type === "video" || el.type === "text");
    setHint(
      el.type === "text"
        ? corner
          ? "Resizing text — corners make the letters bigger or smaller."
          : "Changing text box width — the text re-wraps."
        : keepRatio
          ? "Resizing — corners keep the shape's proportions. Use side handles to crop/stretch."
          : "Resizing — hold Shift on a corner to keep proportions.",
    );

    const move = (ev: PointerEvent) => {
      const p = toFrame(ev.clientX, ev.clientY);
      const dx = p.x - p0.x;
      const dy = p.y - p0.y;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      let w = el.w + hx * lx;
      let h = el.h + hy * ly;
      let s = 1;
      if (keepRatio || (corner && ev.shiftKey)) {
        s = Math.max(0.05, 1 + (hx * lx / el.w + hy * ly / el.h) / 2);
        w = el.w * s;
        h = el.h * s;
      }
      w = Math.max(8, w);
      h = Math.max(el.shape === "line" ? 2 : 8, h);
      if (el.type === "text" && !corner) h = el.h;
      const sx = (hx * (w - el.w)) / 2;
      const sy = (hy * (h - el.h)) / 2;
      const ncx = c0.x + sx * cos - sy * sin;
      const ncy = c0.y + sx * sin + sy * cos;
      const patch: Partial<El> = { w, x: ncx - w / 2, y: ncy - h / 2, h };
      if (el.type === "text" && corner) {
        patch.fontSize = Math.max(4, (el.fontSize ?? 32) * s);
        patch.letterSpacing = (el.letterSpacing ?? 0) * s;
      }
      if (el.type === "text" && !corner) patch.y = el.y;
      updateEls([el.id], patch, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBusy(false);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---------- rotate ----------
  const onRotateDown = (e: React.PointerEvent, el: El) => {
    e.stopPropagation();
    e.preventDefault();
    checkpoint();
    setBusy(true);
    const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    const move = (ev: PointerEvent) => {
      const p = toFrame(ev.clientX, ev.clientY);
      let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      else {
        const near = Math.round(a / 45) * 45;
        if (Math.abs(near - a) < 4) a = near;
      }
      if (a > 180) a -= 360;
      setHint(`Rotating: ${Math.round(a)}° — snaps at 0°, 45°, 90°. Hold Shift for 15° steps.`);
      updateEls([el.id], { rotation: a }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBusy(false);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---------- crop (pan & zoom a photo inside its box) ----------
  const natRatio = (id: string) => {
    const m = document.querySelector<HTMLImageElement | HTMLVideoElement>(`[data-el="${id}"] img, [data-el="${id}"] video`);
    if (!m) return 1;
    const w = m instanceof HTMLVideoElement ? m.videoWidth : m.naturalWidth;
    const h = m instanceof HTMLVideoElement ? m.videoHeight : m.naturalHeight;
    return w && h ? w / h : 1;
  };
  const coverSize = (el: El) => {
    const r = natRatio(el.id);
    const s = Math.max(el.w / r, el.h) * (el.cropZoom ?? 1);
    return { dw: s * r, dh: s };
  };

  function startPan(e: React.PointerEvent, el: El) {
    checkpoint();
    const { dw, dh } = coverSize(el);
    const rad = (el.rotation * Math.PI) / 180;
    const start = { x: e.clientX, y: e.clientY, cx: el.cropX ?? 0.5, cy: el.cropY ?? 0.5 };
    setHint("Cropping — drag to choose which part shows · scroll to zoom · press Done when finished");
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      const lx = dx * Math.cos(rad) + dy * Math.sin(rad);
      const ly = -dx * Math.sin(rad) + dy * Math.cos(rad);
      const ex = dw - el.w;
      const ey = dh - el.h;
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      updateEls([el.id], { cropX: ex > 0.5 ? clamp(start.cx - lx / ex) : 0.5, cropY: ey > 0.5 ? clamp(start.cy - ly / ey) : 0.5 }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const startCrop = (el: El) => {
    if (el.locked) return;
    setSelected([el.id]);
    setCropId(el.id);
  };

  useEffect(() => {
    const w = wrapRef.current;
    if (!w || !cropId) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const el = doc.elements.find((x) => x.id === cropId);
      if (!el) return;
      const z = Math.max(1, Math.min(5, (el.cropZoom ?? 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
      updateEls([cropId], { cropZoom: z }, false);
    };
    w.addEventListener("wheel", onWheel, { passive: false });
    return () => w.removeEventListener("wheel", onWheel);
  }, [cropId, doc.elements, updateEls]);

  // ---------- text editing ----------
  const startEditing = (el: El) => {
    if (el.type !== "text" || el.locked) return;
    checkpoint();
    setSelected([el.id]);
    setEditingId(el.id);
  };
  const finishEditing = () => {
    const el = doc.elements.find((e) => e.id === editingId);
    setEditingId(null);
    if (el && !(el.text ?? "").trim()) {
      update((d) => ({ ...d, elements: d.elements.filter((x) => x.id !== el.id) }), false);
      setSelected([]);
    }
  };
  const onDoubleClick = (el: El) => {
    if (el.type === "text") startEditing(el);
    else if (el.type === "image" || el.type === "video") startCrop(el);
  };

  // ---------- right-click menu ----------
  const [menu, setMenu] = useState<{ x: number; y: number; onEl: boolean } | null>(null);
  const actions = useActions();
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const id = (e.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const own = id && doc.elements.some((x) => x.id === id);
    if (own && !selected.includes(id)) setSelected([id]);
    if (!own) setSelected([]);
    setMenu({ x: e.clientX, y: e.clientY, onEl: !!own });
  };

  // ---------- ruler guides ----------
  const startGuide = (axis: "x" | "y") => (e: React.PointerEvent) => {
    e.preventDefault();
    const toPos = (ev: { clientX: number; clientY: number }) => {
      const p = toFrame(ev.clientX, ev.clientY);
      return Math.round(axis === "x" ? p.x : p.y);
    };
    setDraftGuide({ axis, pos: toPos(e) });
    const move = (ev: PointerEvent) => setDraftGuide({ axis, pos: toPos(ev) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraftGuide(null);
      const w = wrapRef.current!.getBoundingClientRect();
      const inside = ev.clientX > w.left && ev.clientY > w.top;
      if (inside) ed.setGuides([...guides, { axis, pos: toPos(ev) }]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const dragGuide = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const g = guides[i];
    checkpoint();
    const move = (ev: PointerEvent) => {
      const p = toFrame(ev.clientX, ev.clientY);
      ed.setGuides(guides.map((x, j) => (j === i ? { ...x, pos: Math.round(g.axis === "x" ? p.x : p.y) } : x)), false);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // dragged back onto a ruler = delete
      const w = wrapRef.current!.getBoundingClientRect();
      if ((g.axis === "x" && ev.clientX < w.left) || (g.axis === "y" && ev.clientY < w.top)) {
        ed.setGuides(guides.filter((_, j) => j !== i), false);
        ed.notify("Guide removed");
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---------- derived ----------
  const variant = findVariant(frame.platformId, frame.variantId);
  const platform = findPlatform(frame.platformId);
  const PIcon = platform.icon;
  const single = selected.length === 1 ? doc.elements.find((e) => e.id === selected[0]) : undefined;
  const editingEl = editingId ? doc.elements.find((e) => e.id === editingId) : undefined;
  const cropEl = cropId ? doc.elements.find((e) => e.id === cropId) : undefined;
  const animated = mode === "animate";
  const margin = (Math.min(frame.w, frame.h) * prefs.marginPct) / 100;
  const docs = visible.map((i) => (i === cur ? doc : docOf(project, i)));
  const act = screenOf(cur);

  const selBox = (() => {
    const els = doc.elements.filter((e) => selected.includes(e.id));
    if (!els.length || editingId) return null;
    const b = els.map(bounds);
    return {
      left: Math.min(...b.map((x) => x.left)),
      top: Math.min(...b.map((x) => x.top)),
      right: Math.max(...b.map((x) => x.right)),
      bottom: Math.max(...b.map((x) => x.bottom)),
      locked: els.every((e) => e.locked),
    };
  })();

  /** Pointer handler for an item on page i: the active page edits it, other pages become active first. */
  const handlerFor = (i: number) =>
    i === cur
      ? onElementDown
      : (e: React.PointerEvent, el: El) => {
          if (e.button !== 0 || panning) return;
          e.stopPropagation();
          ed.goToPage(i);
          setSelected([el.id]);
        };

  const pageLabel = (i: number) => project.pages[i].name || `${carousel ? "Slide" : "Design"} ${i + 1}`;
  const designCount = carousel ? "Slide" : "Design";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Info + workspace bar */}
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-zinc-200 bg-white px-3 text-xs whitespace-nowrap">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-zinc-800">
          <PIcon style={{ color: platform.color }} className="shrink-0 text-base" title={`${platform.name} · ${variant?.name ?? "Custom"}`} />
          <span className="hidden truncate 2xl:inline">
            {platform.name} · {variant?.name ?? "Custom"}
          </span>
        </span>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-zinc-600">
          {frame.w}×{frame.h}
        </span>
        <span className="hidden rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600 xl:inline">{ratioLabel(frame.w, frame.h)}</span>
        {pageCount > 1 && (
          <span className="flex items-center gap-1 rounded-md bg-violet-100 py-0.5 pr-1 pl-2 font-medium text-violet-800">
            {designCount} {cur + 1}/{pageCount}
            <button className="rounded px-1 hover:bg-violet-200 disabled:opacity-30" disabled={cur === 0} onClick={() => ed.goToPage(cur - 1)} title="Previous">
              ‹
            </button>
            <button className="rounded px-1 hover:bg-violet-200 disabled:opacity-30" disabled={cur === pageCount - 1} onClick={() => ed.goToPage(cur + 1)} title="Next">
              ›
            </button>
          </span>
        )}

        {/* Fixed / Free workspace */}
        <div className="mx-auto flex rounded-full border border-zinc-900/10 bg-zinc-50 p-0.5" role="radiogroup" aria-label="Workspace">
          {(
            [
              [false, "Fixed", "One design at a time, kept inside its frame"],
              [true, "Free", "Open board: see every design, pan around, things can go outside the frame and move between designs"],
            ] as const
          ).map(([val, label, tip]) => (
            <button
              key={label}
              role="radio"
              aria-checked={free === val}
              title={tip}
              onClick={() => {
                setPref("free", val);
                setZoomMode("fit");
                ed.notify(val ? "Free canvas — pan with Space/H or the scroll wheel, drag items between designs" : "Fixed — focused on one design");
              }}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition",
                free === val ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              {val ? "🧭 " : "🔒 "}
              {label}
            </button>
          ))}
        </div>

        {free && !carousel && pageCount > 1 && <GapControl value={prefs.boardGap} px={gap} onChange={(v) => setPref("boardGap", v)} />}
        <ViewMenu prefs={prefs} setPref={setPref} hasSafe={!!variant?.safe} />
        <button
          title="Hand tool (H) — or hold Space and drag to pan"
          onClick={() => setHand((h) => !h)}
          className={cn("rounded-lg border p-1.5", hand ? "border-violet-400 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50")}
        >
          <MdOutlinePanTool />
        </button>
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5">
          <button className="rounded-md p-1 hover:bg-zinc-100" onClick={() => zoomAt(zoom * 0.8)} title="Zoom out (⌘−)">
            <FiMinus />
          </button>
          <button className="w-11 text-center tabular-nums" onClick={() => zoomAt(1)} title="Actual size (100%)">
            {Math.round(zoom * 100)}%
          </button>
          <button className="rounded-md p-1 hover:bg-zinc-100" onClick={() => zoomAt(zoom * 1.25)} title="Zoom in (⌘+)">
            <FiPlus />
          </button>
          <button
            className={cn("rounded-md p-1 hover:bg-zinc-100", zoomMode === "fit" && "text-violet-600")}
            onClick={() => {
              setZoomMode("fit");
              recenter();
            }}
            title={free ? "Fit everything (⌘0)" : "Fit to screen (⌘0)"}
          >
            <MdOutlineFitScreen />
          </button>
        </div>
        <button
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50"
        >
          {fullscreen ? <FiMinimize /> : <FiMaximize />}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {prefs.rulers && (
          <>
            <div className="absolute top-0 left-0 z-20 border-r border-b border-zinc-200 bg-zinc-50" style={{ width: RULER_SIZE, height: RULER_SIZE }} />
            <div className="absolute top-0 z-10" style={{ left: RULER_SIZE }}>
              <Ruler axis="x" origin={act.left - scroll.l} zoom={zoom} length={avail.w} onStartGuide={startGuide("y")} />
            </div>
            <div className="absolute left-0 z-10" style={{ top: RULER_SIZE }}>
              <Ruler axis="y" origin={act.top - scroll.t} zoom={zoom} length={avail.h} onStartGuide={startGuide("x")} />
            </div>
          </>
        )}

        {/* Canvas viewport */}
        <div
          ref={wrapRef}
          className={cn("stage-bg absolute overflow-auto select-none", panning && "cursor-grab")}
          style={{ inset: prefs.rulers ? `${RULER_SIZE}px 0 0 ${RULER_SIZE}px` : 0 }}
          onScroll={(e) => setScroll({ l: e.currentTarget.scrollLeft, t: e.currentTarget.scrollTop })}
          onContextMenu={onContextMenu}
          onPointerDownCapture={startPanView}
          onPointerDown={() => {
            setSelected([]);
            if (editingId) finishEditing();
          }}
        >
          <div className="relative" style={{ width: contentW, height: contentH }}>
            {/* Free board: things outside a frame stay visible (faded) — nothing is boxed in */}
            {free &&
              visible.map((i, k) => (
                <div
                  key={"ghost" + i}
                  className="absolute top-0 left-0"
                  style={{ ...screenOf(i), width: frames[i].w, height: frames[i].h, transform: `scale(${zoom})`, transformOrigin: "0 0", opacity: 0.32 }}
                >
                  {docs[k].elements
                    .filter((el) => el.type !== "video")
                    .map((el) => (
                      <ElementView
                        key={el.id}
                        el={el}
                        st={animated && i === cur ? animState(el, time, frames[i]) : STATIC}
                        editing={i === cur && el.id === editingId}
                        onPointerDown={handlerFor(i)}
                        onDoubleClick={i === cur ? onDoubleClick : undefined}
                      />
                    ))}
                </div>
              ))}

            {visible.map((i, k) => (
              <Artboard
                key={project.pages[i].id}
                d={docs[k]}
                left={screenOf(i).left}
                top={screenOf(i).top}
                zoom={zoom}
                active={i === cur}
                showRing={free && pageCount > 1}
                label={free ? `${pageLabel(i)} · ${frames[i].w}×${frames[i].h}` : undefined}
                onLabel={() => ed.goToPage(i)}
                onBackground={(e) => {
                  e.stopPropagation();
                  if (panning) return;
                  if (editingId) finishEditing();
                  if (i !== cur) ed.goToPage(i);
                  setSelected([]);
                }}
              >
                {docs[k].elements.map((el) => (
                  <ElementView
                    key={el.id}
                    el={el}
                    st={animated && i === cur ? animState(el, time, frames[i]) : STATIC}
                    editing={i === cur && el.id === editingId}
                    onPointerDown={handlerFor(i)}
                    onDoubleClick={i === cur ? onDoubleClick : undefined}
                    onHover={i === cur ? setHoverId : undefined}
                    clock={el.type === "video" ? (animated && i === cur ? { t: time, playing: ed.playing } : null) : undefined}
                  />
                ))}
                {i === cur && editingEl && (
                  <TextEditor el={editingEl} onChange={(text) => updateEls([editingEl.id], { text }, false)} onDone={finishEditing} />
                )}
              </Artboard>
            ))}

            {addTile && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  ed.addPage(false);
                  ed.notify(carousel ? "Slide added — it connects to the one before it" : "New design added — it's independent from the others");
                }}
                className="absolute flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-white/60 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                style={{
                  left: offX + (positions[pageCount - 1].x + last.w + (carousel ? 40 : gap)) * zoom,
                  top: offY,
                  width: Math.min(last.w, last.h) * 0.4 * zoom,
                  height: last.h * zoom,
                }}
              >
                <FiPlus className="text-xl" />
                {carousel ? "Add slide" : "New design"}
              </button>
            )}

            {/* Active design overlay (screen pixels) */}
            <div
              ref={frameRef}
              className="pointer-events-none absolute"
              style={{ left: act.left, top: act.top, width: frame.w * zoom, height: frame.h * zoom }}
            >
              {prefs.pixel && <PixelPreview d={doc} t={animated ? time : null} zoom={zoom} />}
              {prefs.grid && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "linear-gradient(rgba(124,58,237,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,.18) 1px, transparent 1px)",
                    backgroundSize: `${prefs.gridSize * zoom}px ${prefs.gridSize * zoom}px`,
                  }}
                />
              )}
              {prefs.margins && (
                <div className="absolute border border-dashed border-sky-500/80" style={{ inset: margin * zoom }}>
                  <span className="absolute -top-4 left-0 text-[9px] font-semibold text-sky-600">margin</span>
                </div>
              )}
              {variant?.safe && prefs.safe && (
                <>
                  <div className="safe-zone absolute top-0 right-0 left-0 flex items-end justify-center" style={{ height: `${variant.safe.top * 100}%` }}>
                    <span className="safe-label">Profile & top bar cover this</span>
                  </div>
                  <div className="safe-zone absolute right-0 bottom-0 left-0 flex items-start justify-center" style={{ height: `${variant.safe.bottom * 100}%` }}>
                    <span className="safe-label">Caption & reply box cover this</span>
                  </div>
                  {variant.safe.right && (
                    <div
                      className="safe-zone absolute right-0 flex items-center justify-center"
                      style={{ top: `${variant.safe.top * 100}%`, bottom: `${variant.safe.bottom * 100}%`, width: `${variant.safe.right * 100}%` }}
                    >
                      <span className="safe-label [writing-mode:vertical-rl]">Like / share buttons</span>
                    </div>
                  )}
                </>
              )}
              {/* ruler guides */}
              {prefs.rulers &&
                [...guides, ...(draftGuide ? [draftGuide] : [])].map((g, i) => (
                  <div
                    key={i}
                    onPointerDown={i < guides.length ? dragGuide(i) : undefined}
                    onDoubleClick={() => ed.setGuides(guides.filter((_, j) => j !== i))}
                    title="Drag to move · drag onto the ruler or double-click to remove"
                    className={cn("pointer-events-auto absolute", g.axis === "x" ? "cursor-col-resize" : "cursor-row-resize")}
                    style={
                      g.axis === "x"
                        ? { left: g.pos * zoom - 3, top: -20000, width: 7, height: 40000 }
                        : { top: g.pos * zoom - 3, left: -20000, height: 7, width: 40000 }
                    }
                  >
                    <div className={cn("absolute bg-cyan-500", g.axis === "x" ? "top-0 bottom-0 left-[3px] w-px" : "right-0 left-0 top-[3px] h-px")} />
                  </div>
                ))}
              {snapLines.map((g, i) =>
                g.axis === "x" ? (
                  <div key={i} className="absolute w-px bg-fuchsia-500" style={{ left: g.pos * zoom, top: -4000, height: 8000 }} />
                ) : (
                  <div key={i} className="absolute h-px bg-fuchsia-500" style={{ top: g.pos * zoom, left: -4000, width: 8000 }} />
                ),
              )}
              {hoverId && !selected.includes(hoverId) && !busy && (
                <Outline el={doc.elements.find((e) => e.id === hoverId)} zoom={zoom} className="border-violet-400/70" />
              )}
              {doc.elements
                .filter((e) => selected.includes(e.id))
                .map((el) => (
                  <Outline key={el.id} el={el} zoom={zoom} className={el.locked ? "border-dashed border-zinc-500" : "border-violet-600"}>
                    {single && single.id === el.id && !el.locked && editingId !== el.id && cropId !== el.id && !panning && (
                      <>
                        {HANDLES.filter(([hx, hy]) => {
                          if (el.type === "text") return hy === 0 || hx !== 0;
                          if (el.shape === "line") return hy === 0;
                          return true;
                        }).map(([hx, hy]) => (
                          <div
                            key={`${hx}${hy}`}
                            onPointerDown={(e) => onHandleDown(e, el, hx, hy)}
                            className={cn(
                              "pointer-events-auto absolute border border-violet-600 bg-white shadow",
                              hx !== 0 && hy !== 0 ? "h-3 w-3 rounded-full" : hx === 0 ? "h-1.5 w-5 rounded-full" : "h-5 w-1.5 rounded-full",
                            )}
                            style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%`, transform: "translate(-50%,-50%)", cursor: handleCursor(hx, hy, el.rotation) }}
                            title={hx && hy ? "Drag to resize" : "Drag to stretch"}
                          />
                        ))}
                        <div
                          onPointerDown={(e) => onRotateDown(e, el)}
                          className="pointer-events-auto absolute left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-zinc-200 bg-white text-[13px] text-zinc-700 shadow"
                          style={{ bottom: -34 }}
                          title="Drag to rotate"
                        >
                          ⟳
                        </div>
                      </>
                    )}
                  </Outline>
                ))}

              {cropEl && <CropGhost el={cropEl} zoom={zoom} size={coverSize(cropEl)} />}
              {cropEl && selBox && (
                <div
                  className="pointer-events-auto absolute z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-zinc-200 bg-white py-1 pr-1 pl-3 text-xs whitespace-nowrap shadow-lg"
                  style={{ left: ((selBox.left + selBox.right) / 2) * zoom, top: Math.max(-44, selBox.top * zoom - 52) }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span className="font-medium text-zinc-700">✂️ Drag to reposition</span>
                  <span className="text-zinc-400">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.01}
                    value={cropEl.cropZoom ?? 1}
                    onPointerDown={checkpoint}
                    onChange={(e) => updateEls([cropEl.id], { cropZoom: parseFloat(e.target.value) }, false)}
                    className="range w-24"
                  />
                  <button className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100" onClick={() => updateEls([cropEl.id], { cropX: 0.5, cropY: 0.5, cropZoom: 1 })}>
                    Reset
                  </button>
                  <button className="rounded-lg bg-violet-600 px-3 py-1 font-semibold text-white hover:bg-violet-700" onClick={() => setCropId(null)}>
                    Done
                  </button>
                </div>
              )}

              {selBox && !busy && !cropEl && !panning && (
                <div
                  className="pointer-events-auto absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg"
                  style={{ left: ((selBox.left + selBox.right) / 2) * zoom, top: Math.max(-44, selBox.top * zoom - 52) }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <QuickBtn title="Duplicate (⌘D)" onClick={actions.duplicate}>
                    <FiCopy />
                  </QuickBtn>
                  <QuickBtn title={selBox.locked ? "Unlock" : "Lock position"} onClick={() => updateEls(selected, { locked: !selBox.locked })}>
                    {selBox.locked ? <FiUnlock /> : <FiLock />}
                  </QuickBtn>
                  <QuickBtn title="Delete (Del)" onClick={actions.remove} danger>
                    <FiTrash2 />
                  </QuickBtn>
                  {single?.type === "text" && !single.locked && (
                    <button className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50" onClick={() => startEditing(single)}>
                      Edit text
                    </button>
                  )}
                  {(single?.type === "image" || single?.type === "video") && !single.locked && (
                    <button className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50" onClick={() => startCrop(single)}>
                      ✂️ Crop
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={
            menu.onEl
              ? [
                  ...(single?.type === "text" ? [{ label: "Edit text", key: "Double-click", run: () => startEditing(single) }] : []),
                  ...(single && (single.type === "image" || single.type === "video") ? [{ label: "Crop & zoom", key: "Double-click", run: () => startCrop(single) }] : []),
                  ...(single?.type === "video" && animated ? [{ label: "Split clip at playhead", key: "S", run: actions.splitClip, disabled: !actions.canSplit() }] : []),
                  { label: "Copy", key: "⌘C", run: actions.copy },
                  { label: "Paste", key: "⌘V", run: actions.paste, disabled: !actions.hasClipboard() },
                  { label: "Duplicate", key: "⌘D", run: actions.duplicate },
                  "-",
                  { label: "Copy style", key: "⌘⌥C", run: actions.copyStyle },
                  { label: "Paste style", key: "⌘⌥V", run: actions.pasteStyle, disabled: !actions.hasStyle() },
                  "-",
                  { label: "Bring to front", run: () => actions.order("front") },
                  { label: "Send to back", run: () => actions.order("back") },
                  { label: selBox?.locked ? "Unlock" : "Lock", run: actions.toggleLock },
                  "-",
                  { label: "Delete", key: "Del", run: actions.remove, danger: true },
                ]
              : [
                  { label: "Paste", key: "⌘V", run: actions.paste, disabled: !actions.hasClipboard() },
                  { label: "Select all", key: "⌘A", run: actions.selectAll },
                  ...(multiPage ? ["-" as const, { label: carousel ? "Add slide" : "New design", run: () => ed.addPage(false) }] : []),
                  "-",
                  { label: free ? "Switch to Fixed view" : "Switch to Free canvas", run: () => setPref("free", !free) },
                ]
          }
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/** One design / slide, clipped to its frame. */
function Artboard({
  d,
  left,
  top,
  zoom,
  active,
  showRing,
  label,
  onLabel,
  onBackground,
  children,
}: {
  d: Doc;
  left: number;
  top: number;
  zoom: number;
  active: boolean;
  showRing: boolean;
  label?: string;
  onLabel: () => void;
  onBackground: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  const { w, h } = d.frame;
  const span = d.context?.span;
  return (
    <>
      {label && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLabel}
          className={cn("absolute truncate text-left text-[11px] font-medium", active ? "text-violet-700" : "text-zinc-500 hover:text-zinc-800")}
          style={{ left, top: top - 20, maxWidth: Math.max(80, w * zoom) }}
        >
          {label}
        </button>
      )}
      <div
        className={cn("absolute overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.18)]", showRing && active && "ring-2 ring-violet-500 ring-offset-2")}
        style={{ left, top, width: w * zoom, height: h * zoom }}
      >
        <div
          className="absolute top-0 left-0"
          style={{ width: w, height: h, transform: `scale(${zoom})`, transformOrigin: "0 0", ...(span ? {} : bgCss(d.background)) }}
          onPointerDown={onBackground}
        >
          {span && <div className="absolute top-0" style={{ left: -span.offset, width: span.width, height: h, ...bgCss(d.background) }} />}
          {/* neighbouring slides' items that spill onto this one */}
          {d.context?.neighbours.map((el) => (
            <div key={"n" + el.id} className="pointer-events-none">
              <ElementView el={el} st={STATIC} editing={false} clock={el.type === "video" ? null : undefined} />
            </div>
          ))}
          {children}
        </div>
      </div>
    </>
  );
}

/** Shows the real exported pixels over the design (crisp squares when zoomed in). */
function PixelPreview({ d, t, zoom }: { d: Doc; t: number | null; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const c = ref.current;
    if (!c) return;
    const id = requestAnimationFrame(async () => {
      await preloadDoc(d);
      if (cancelled) return;
      c.width = d.frame.w;
      c.height = d.frame.h;
      const g = c.getContext("2d")!;
      renderDoc(g, d, t);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [d, t]);
  return (
    <canvas
      ref={ref}
      className="absolute top-0 left-0"
      style={{ width: d.frame.w * zoom, height: d.frame.h * zoom, imageRendering: zoom > 1 ? "pixelated" : "auto" }}
    />
  );
}

/** Free board, static designs: how far apart the frames sit (0 = edge to edge). */
function GapControl({ value, px, onChange }: { value: number; px: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Space between designs on the board"
        className={cn(
          "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
          open ? "border-violet-400 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
        )}
      >
        ↔ Gap {value === 0 ? "none" : `${px}px`}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-60 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
          <p className="text-xs font-semibold text-zinc-800">Space between designs</p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">Set to none to line frames up edge to edge — handy for planning a carousel.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <input type="range" min={0} max={40} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range flex-1" />
            <span className="w-12 text-right text-[11px] text-zinc-500 tabular-nums">{px}px</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {(
              [
                ["None", 0],
                ["Small", 4],
                ["Medium", 12],
                ["Large", 25],
              ] as const
            ).map(([label, v]) => (
              <button
                key={label}
                onClick={() => onChange(v)}
                className={cn("rounded-md py-1 text-[10px] font-medium", value === v ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
