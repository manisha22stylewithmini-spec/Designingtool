import { makeShape, makeText } from "../lib/factory";
import type { Background, El, Frame, InAnim, LoopAnim, ShapeKind } from "../types";

export interface Template {
  id: string;
  name: string;
  preview: string; // CSS background for the thumbnail
  group?: "photo"; // photo-based templates (the photo is a normal, replaceable layer)
  build: (frame: Frame, duration: number) => { background: Background; elements: El[] };
}

export type TextOpts = {
  y: number; // fraction of frame height (top of text)
  cy?: number; // or: fraction of frame height for the centre of a single line
  size: number; // fraction of min(w,h)
  font: string;
  weight?: number;
  color: string;
  width?: number; // fraction of frame width
  italic?: boolean;
  uppercase?: boolean;
  spacing?: number; // fraction of font size
  anim?: InAnim;
  start?: number;
  loop?: LoopAnim;
};

export function T(frame: Frame, d: number, text: string, o: TextOpts): El {
  const U = Math.min(frame.w, frame.h);
  const fontSize = U * o.size;
  const w = frame.w * (o.width ?? 0.84);
  const el = makeText(frame, d, {
    text,
    fontFamily: o.font,
    fontSize,
    fontWeight: o.weight ?? 700,
    color: o.color,
    italic: o.italic ?? false,
    uppercase: o.uppercase ?? false,
    letterSpacing: (o.spacing ?? 0) * fontSize,
    w,
    x: (frame.w - w) / 2,
    y: o.cy !== undefined ? frame.h * o.cy - fontSize * 0.6 : frame.h * o.y,
    name: text.slice(0, 18),
  });
  el.anim = { ...el.anim, inType: o.anim ?? "slideUp", start: o.start ?? 0, loop: o.loop ?? "none" };
  return el;
}

export type ShapeOpts = {
  cx: number; // fraction of width
  cy: number; // fraction of height
  size: number; // fraction of min(w,h)
  aspect?: number; // w / h
  fill: string;
  radius?: number; // fraction of height
  opacity?: number;
  rotation?: number;
  anim?: InAnim;
  start?: number;
  loop?: LoopAnim;
};

export function S(frame: Frame, d: number, kind: ShapeKind, o: ShapeOpts): El {
  const U = Math.min(frame.w, frame.h);
  const h = U * o.size;
  const w = h * (o.aspect ?? 1);
  const el = makeShape(frame, d, kind, {
    w,
    h,
    x: frame.w * o.cx - w / 2,
    y: frame.h * o.cy - h / 2,
    fill: o.fill,
    radius: (o.radius ?? 0) * h,
    opacity: o.opacity ?? 1,
    rotation: o.rotation ?? 0,
  });
  el.anim = { ...el.anim, inType: o.anim ?? "zoomIn", start: o.start ?? 0, loop: o.loop ?? "none" };
  return el;
}
