import type { El, PathNode } from "../types";
import { fitNodes, shapeToNodes, toAbs } from "./vector";

type P = { x: number; y: number };
const rot = (p: P, deg: number): P => {
  const r = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};

/** Editable anchor points (absolute px in the element box) for a shape or path. */
export function editableNodes(el: El): { nodes: PathNode[]; closed: boolean } | null {
  if (el.type === "path" && el.nodes) return { nodes: toAbs(el.nodes, el.w, el.h), closed: !!el.closed };
  if (el.type === "shape" && el.shape) {
    const s = shapeToNodes(el.shape, el.w, el.h, el.radius);
    return { nodes: toAbs(s.nodes, el.w, el.h), closed: s.closed };
  }
  return null;
}

/** Turn a basic shape into a vector path so its anchors can be edited (keeps colours). */
export function shapeToPath(el: El): El {
  if (el.type !== "shape" || !el.shape) return el;
  const s = shapeToNodes(el.shape, el.w, el.h, el.radius);
  const isLine = el.shape === "line";
  return {
    ...el,
    type: "path",
    nodes: s.nodes,
    closed: s.closed,
    name: el.name + " path",
    fill: isLine ? "transparent" : el.fill,
    stroke: isLine ? el.fill : el.stroke,
    strokeWidth: isLine ? Math.max(2, el.h) : el.strokeWidth,
    shape: undefined,
    radius: undefined,
  };
}

/**
 * After editing points, shrink / grow the box to fit them again without the path moving on screen
 * (works for rotated paths too).
 */
export function refitPath(el: El): El {
  if (el.type !== "path" || !el.nodes) return el;
  const fit = fitNodes(toAbs(el.nodes, el.w, el.h));
  // fit.x/y are offsets inside the old (unrotated) box; move the centre accordingly in world space
  const oldC = { x: el.w / 2, y: el.h / 2 };
  const newC = { x: fit.x + fit.w / 2, y: fit.y + fit.h / 2 };
  const d = rot({ x: newC.x - oldC.x, y: newC.y - oldC.y }, el.rotation);
  const cx = el.x + el.w / 2 + d.x;
  const cy = el.y + el.h / 2 + d.y;
  return { ...el, nodes: fit.nodes, w: fit.w, h: fit.h, x: cx - fit.w / 2, y: cy - fit.h / 2 };
}

/** Points of `src` (shape / path) expressed in `dst`'s box — used for "Use as mask". */
export function nodesInBox(src: El, dst: El): PathNode[] | null {
  const e = editableNodes(src);
  if (!e) return null;
  const sc = { x: src.x + src.w / 2, y: src.y + src.h / 2 };
  const dc = { x: dst.x + dst.w / 2, y: dst.y + dst.h / 2 };
  const toDst = (p: P) => {
    const world = rot({ x: p.x - src.w / 2, y: p.y - src.h / 2 }, src.rotation);
    const local = rot({ x: world.x + sc.x - dc.x, y: world.y + sc.y - dc.y }, -dst.rotation);
    return { x: local.x + dst.w / 2, y: local.y + dst.h / 2 };
  };
  const vec = (v: P) => rot(rot(v, src.rotation), -dst.rotation);
  return e.nodes.map((n) => {
    const p = toDst(n);
    const i = vec({ x: n.ix, y: n.iy });
    const o = vec({ x: n.ox, y: n.oy });
    return { ...n, x: p.x / dst.w, y: p.y / dst.h, ix: i.x / dst.w, iy: i.y / dst.h, ox: o.x / dst.w, oy: o.y / dst.h };
  });
}

export const canMask = (e: El) => e.type === "shape" || (e.type === "path" && !!e.closed);
export const maskable = (e: El) => e.type === "image" || e.type === "video";
