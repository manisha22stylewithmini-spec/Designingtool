import type { PathNode, ShapeKind } from "../types";
import { shapePath } from "./geometry";

/** Vector path helpers. Nodes are normalised to the element box (0..1). */

export type Pt = { x: number; y: number };

export const corner = (x: number, y: number): PathNode => ({ x, y, ix: 0, iy: 0, ox: 0, oy: 0, kind: "corner" });
export const smooth = (x: number, y: number, hx: number, hy: number): PathNode => ({ x, y, ix: -hx, iy: -hy, ox: hx, oy: hy, kind: "smooth" });

const f = (n: number) => Math.round(n * 100) / 100;

/** SVG path data for nodes drawn in a w×h box. */
export function nodesToPath(nodes: PathNode[], closed: boolean, w: number, h: number): string {
  if (!nodes.length) return "";
  const P = (n: PathNode) => `${f(n.x * w)} ${f(n.y * h)}`;
  let d = `M${P(nodes[0])}`;
  const seg = (a: PathNode, b: PathNode) => {
    const straight = !a.ox && !a.oy && !b.ix && !b.iy;
    if (straight) return ` L${P(b)}`;
    return ` C${f((a.x + a.ox) * w)} ${f((a.y + a.oy) * h)} ${f((b.x + b.ix) * w)} ${f((b.y + b.iy) * h)} ${P(b)}`;
  };
  for (let i = 1; i < nodes.length; i++) d += seg(nodes[i - 1], nodes[i]);
  if (closed && nodes.length > 2) d += seg(nodes[nodes.length - 1], nodes[0]) + " Z";
  return d;
}

const K = 0.5523; // circle → bezier handle length

/** Turn a basic shape into editable anchor points (normalised). */
export function shapeToNodes(kind: ShapeKind, w: number, h: number, radius = 0): { nodes: PathNode[]; closed: boolean } {
  const poly = (pts: [number, number][]) => ({ nodes: pts.map(([x, y]) => corner(x, y)), closed: true });
  switch (kind) {
    case "ellipse":
      return {
        closed: true,
        nodes: [smooth(0.5, 0, 0.5 * K, 0), smooth(1, 0.5, 0, 0.5 * K), smooth(0.5, 1, -0.5 * K, 0), smooth(0, 0.5, 0, -0.5 * K)],
      };
    case "rect": {
      const r = Math.min(radius, w / 2, h / 2);
      if (!r) return poly([[0, 0], [1, 0], [1, 1], [0, 1]]);
      const rx = r / w;
      const ry = r / h;
      const c = (x: number, y: number, ix: number, iy: number, ox: number, oy: number): PathNode => ({ x, y, ix, iy, ox, oy, kind: "corner" });
      return {
        closed: true,
        nodes: [
          c(rx, 0, -rx * K, 0, 0, 0),
          c(1 - rx, 0, 0, 0, rx * K, 0),
          c(1, ry, 0, -ry * K, 0, 0),
          c(1, 1 - ry, 0, 0, 0, ry * K),
          c(1 - rx, 1, rx * K, 0, 0, 0),
          c(rx, 1, 0, 0, -rx * K, 0),
          c(0, 1 - ry, 0, ry * K, 0, 0),
          c(0, ry, 0, 0, 0, -ry * K),
        ],
      };
    }
    case "line":
      return { nodes: [corner(0, 0.5), corner(1, 0.5)], closed: false };
    case "triangle":
      return poly([[0.5, 0], [1, 1], [0, 1]]);
    case "diamond":
      return poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
    case "hexagon":
      return poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]);
    case "arrow":
      return poly([[0, 0.3], [0.62, 0.3], [0.62, 0], [1, 0.5], [0.62, 1], [0.62, 0.7], [0, 0.7]]);
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.42;
        pts.push([0.5 + Math.cos(a) * 0.5 * r, 0.53 + (Math.sin(a) / 1.9) * r]);
      }
      return poly(pts);
    }
    default: {
      // heart / bubble etc: sample the outline into smooth points
      return sampleShape(shapePath(kind, w, h, radius), w, h);
    }
  }
}

/** Approximate any SVG path with a handful of smooth anchors (used for complex shapes). */
function sampleShape(d: string, w: number, h: number): { nodes: PathNode[]; closed: boolean } {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  const len = el.getTotalLength();
  const n = 12;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = el.getPointAtLength((i / n) * len);
    pts.push({ x: p.x / w, y: p.y / h });
  }
  return { nodes: smoothThrough(pts, true), closed: true };
}

/** Catmull-Rom → bezier: smooth anchors passing through every point. */
export function smoothThrough(pts: Pt[], closed: boolean, tension = 1 / 6): PathNode[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const hx = (next.x - prev.x) * tension;
    const hy = (next.y - prev.y) * tension;
    const end = !closed && (i === 0 || i === n - 1);
    return end ? { ...corner(p.x, p.y), ox: i === 0 ? hx : 0, oy: i === 0 ? hy : 0, ix: i === n - 1 ? -hx : 0, iy: i === n - 1 ? -hy : 0 } : smooth(p.x, p.y, hx, hy);
  });
}

/** Ramer–Douglas–Peucker: drop points that don't change the shape much (pencil strokes). */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const dist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = dx * dx + dy * dy;
    if (!l) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

/** Absolute-pixel nodes → element box + normalised nodes. */
export function fitNodes(abs: PathNode[], minSize = 4): { x: number; y: number; w: number; h: number; nodes: PathNode[] } {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const n of abs) {
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x);
    y1 = Math.max(y1, n.y);
  }
  let w = x1 - x0;
  let h = y1 - y0;
  // a straight horizontal / vertical line still needs a box to live in
  if (w < minSize) {
    x0 -= (minSize - w) / 2;
    w = minSize;
  }
  if (h < minSize) {
    y0 -= (minSize - h) / 2;
    h = minSize;
  }
  return {
    x: x0,
    y: y0,
    w,
    h,
    nodes: abs.map((n) => ({ ...n, x: (n.x - x0) / w, y: (n.y - y0) / h, ix: n.ix / w, iy: n.iy / h, ox: n.ox / w, oy: n.oy / h })),
  };
}

/** Normalised nodes → absolute pixels in the element box. */
export const toAbs = (nodes: PathNode[], w: number, h: number): PathNode[] =>
  nodes.map((n) => ({ ...n, x: n.x * w, y: n.y * h, ix: n.ix * w, iy: n.iy * h, ox: n.ox * w, oy: n.oy * h }));

/** Point on the bezier segment a→b at t (all absolute). */
function bez(a: PathNode, b: PathNode, t: number): Pt {
  const p0 = { x: a.x, y: a.y };
  const p1 = { x: a.x + a.ox, y: a.y + a.oy };
  const p2 = { x: b.x + b.ix, y: b.y + b.iy };
  const p3 = { x: b.x, y: b.y };
  const m = 1 - t;
  return {
    x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
    y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Find which segment (and where on it) is closest to p. Works in absolute pixels. */
export function nearestOnPath(abs: PathNode[], closed: boolean, p: Pt): { seg: number; t: number; d: number } {
  let best = { seg: 0, t: 0.5, d: Infinity };
  const count = closed ? abs.length : abs.length - 1;
  for (let i = 0; i < count; i++) {
    const a = abs[i];
    const b = abs[(i + 1) % abs.length];
    for (let k = 1; k < 40; k++) {
      const t = k / 40;
      const q = bez(a, b, t);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < best.d) best = { seg: i, t, d };
    }
  }
  return best;
}

/** Insert an anchor on segment i at t without changing the curve (de Casteljau). Absolute nodes. */
export function splitSegment(abs: PathNode[], i: number, t: number): PathNode[] {
  const a = abs[i];
  const j = (i + 1) % abs.length;
  const b = abs[j];
  const lerp = (p: Pt, q: Pt) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const p0 = { x: a.x, y: a.y };
  const p1 = { x: a.x + a.ox, y: a.y + a.oy };
  const p2 = { x: b.x + b.ix, y: b.y + b.iy };
  const p3 = { x: b.x, y: b.y };
  const q0 = lerp(p0, p1),
    q1 = lerp(p1, p2),
    q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1),
    r1 = lerp(q1, q2);
  const s = lerp(r0, r1);
  const curved = a.ox || a.oy || b.ix || b.iy;
  const mid: PathNode = curved
    ? { x: s.x, y: s.y, ix: r0.x - s.x, iy: r0.y - s.y, ox: r1.x - s.x, oy: r1.y - s.y, kind: "smooth" }
    : corner(s.x, s.y);
  const out = abs.map((n) => ({ ...n }));
  if (curved) {
    out[i] = { ...out[i], ox: q0.x - a.x, oy: q0.y - a.y };
    out[j] = { ...out[j], ix: q2.x - b.x, iy: q2.y - b.y };
  }
  out.splice(i + 1, 0, mid);
  return out;
}

/** Double-click on an anchor: sharp corner ↔ smooth curve. Absolute nodes. */
export function toggleNode(abs: PathNode[], i: number, closed: boolean): PathNode[] {
  const out = abs.map((n) => ({ ...n }));
  const n = out[i];
  if (n.kind === "smooth" || n.ix || n.iy || n.ox || n.oy) {
    out[i] = { ...n, ix: 0, iy: 0, ox: 0, oy: 0, kind: "corner" };
    return out;
  }
  const prev = out[closed ? (i - 1 + out.length) % out.length : Math.max(0, i - 1)];
  const next = out[closed ? (i + 1) % out.length : Math.min(out.length - 1, i + 1)];
  let dx = next.x - prev.x;
  let dy = next.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const lenIn = Math.hypot(n.x - prev.x, n.y - prev.y) / 3;
  const lenOut = Math.hypot(next.x - n.x, next.y - n.y) / 3;
  out[i] = { ...n, ix: -dx * lenIn, iy: -dy * lenIn, ox: dx * lenOut, oy: dy * lenOut, kind: "smooth" };
  return out;
}
