import polygonClipping from "polygon-clipping";
import type { El, PathNode } from "../types";
import { uid } from "./factory";
import { elementPath } from "./paint";
import { shapeToPath } from "./pathOps";
import { corner, simplify } from "./vector";

/** Union / Subtract / Intersect / Exclude / Flatten for shapes and drawn paths (Figma-style). */

export type BoolOp = "union" | "subtract" | "intersect" | "exclude" | "flatten";

type Pt = [number, number];
type Ring = Pt[];
type Geom = polygonClipping.MultiPolygon;

/** Shapes (except lines) and pen / pencil paths can be combined. */
export const combinable = (e: El) => (e.type === "shape" && e.shape !== "line") || e.type === "path";

/** Outline of an element as polylines in frame coordinates (curves are sampled finely). */
function rings(el: El): Ring[] {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  document.body.appendChild(svg);
  const out: Ring[] = [];
  try {
    const rad = (el.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const fx = el.flipX ? -1 : 1;
    const fy = el.flipY ? -1 : 1;
    for (const sub of elementPath(el).split(/(?=M)/).map((x) => x.trim()).filter(Boolean)) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", sub);
      svg.appendChild(path);
      const len = path.getTotalLength();
      if (!(len > 0)) continue;
      const n = Math.min(700, Math.max(12, Math.ceil(len / 2)));
      const ring: Ring = [];
      for (let i = 0; i < n; i++) {
        const p = path.getPointAtLength((len * i) / n);
        const lx = (p.x - el.w / 2) * fx;
        const ly = (p.y - el.h / 2) * fy;
        ring.push([el.x + el.w / 2 + lx * cos - ly * sin, el.y + el.h / 2 + lx * sin + ly * cos]);
      }
      if (ring.length >= 3) out.push(ring);
    }
  } finally {
    svg.remove();
  }
  return out;
}

/** An element as clipping geometry (several rings = even-odd, so holes stay holes). */
function geom(el: El): Geom {
  const rs = rings(el);
  if (!rs.length) return [];
  if (rs.length === 1) return [[rs[0]]];
  const [first, ...rest] = rs.map((r) => [[r]] as Geom);
  return polygonClipping.xor(first, ...rest);
}

/** Closed rings → a path element (first ring is the outline, the others become `subpaths`). */
function ringsToPath(all: Ring[], base: El, name: string): El | null {
  const pts = all.map((r) => {
    const open = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
    const s = simplify(open.map(([x, y]) => ({ x, y })), 0.25);
    return s.length >= 3 ? s : open.map(([x, y]) => ({ x, y }));
  });
  const flat = pts.flat();
  if (!flat.length) return null;
  const minX = Math.min(...flat.map((p) => p.x));
  const minY = Math.min(...flat.map((p) => p.y));
  const w = Math.max(1, Math.max(...flat.map((p) => p.x)) - minX);
  const h = Math.max(1, Math.max(...flat.map((p) => p.y)) - minY);
  const toNodes = (ring: { x: number; y: number }[]): PathNode[] => ring.map((p) => corner((p.x - minX) / w, (p.y - minY) / h));
  const [outline, ...extra] = pts.map(toNodes);
  return {
    ...base,
    id: uid(),
    type: "path",
    name,
    x: minX,
    y: minY,
    w,
    h,
    rotation: 0,
    flipX: false,
    flipY: false,
    nodes: outline,
    closed: true,
    subpaths: extra.length ? extra : undefined,
    shape: undefined,
    radius: undefined,
    mask: undefined,
    maskNodes: undefined,
  };
}

const NAMES: Record<BoolOp, string> = { union: "Union", subtract: "Subtract", intersect: "Intersect", exclude: "Exclude", flatten: "Vector" };

/**
 * Combine the selected elements. `els` must be in stacking order (back → front).
 * The result takes the look (fill, border, shadow…) of the back-most element, like Figma.
 */
export function combine(els: El[], op: BoolOp): { el: El | null; message?: string } {
  if (!els.length || !els.every(combinable)) return { el: null, message: "Boolean tools work on shapes and drawn paths. Text and photos can't be combined." };
  const base = els[0];

  if (op === "flatten") {
    if (els.length === 1) {
      if (base.type === "path") return { el: null, message: "This is already a path — use Edit points to reshape it." };
      return { el: { ...shapeToPath(base), name: "Vector" } };
    }
    const all = els.flatMap(rings);
    const el = ringsToPath(all, base, NAMES.flatten);
    return el ? { el } : { el: null, message: "Nothing to flatten." };
  }

  if (els.length < 2) return { el: null, message: "Select two or more shapes first (hold Shift and click)." };
  const gs = els.map(geom);
  const [first, ...rest] = gs;
  let result: Geom;
  try {
    result =
      op === "union" ? polygonClipping.union(first, ...rest) : op === "subtract" ? polygonClipping.difference(first, ...rest) : op === "intersect" ? polygonClipping.intersection(first, ...rest) : polygonClipping.xor(first, ...rest);
  } catch {
    return { el: null, message: "Couldn't combine those shapes. Try simpler shapes." };
  }
  if (!result.length) return { el: null, message: op === "intersect" ? "The shapes don't overlap, so there is nothing to keep." : "Nothing is left after combining." };
  const el = ringsToPath(result.flat() as Ring[], base, NAMES[op]);
  return el ? { el } : { el: null, message: "Nothing is left after combining." };
}
