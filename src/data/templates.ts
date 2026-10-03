import { makeShape, makeText } from "../lib/factory";
import type { Background, El, Frame, InAnim, LoopAnim, ShapeKind } from "../types";

export interface Template {
  id: string;
  name: string;
  preview: string; // CSS background for the thumbnail
  build: (frame: Frame, duration: number) => { background: Background; elements: El[] };
}

type TextOpts = {
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

function T(frame: Frame, d: number, text: string, o: TextOpts): El {
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

type ShapeOpts = {
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

function S(frame: Frame, d: number, kind: ShapeKind, o: ShapeOpts): El {
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

export const TEMPLATES: Template[] = [
  {
    id: "sale",
    name: "Big Sale",
    preview: "linear-gradient(135deg,#ff512f,#dd2476)",
    build: (f, d) => ({
      background: { kind: "gradient", from: "#ff512f", to: "#dd2476", angle: 135 },
      elements: [
        S(f, d, "ellipse", { cx: 0.9, cy: 0.12, size: 0.5, fill: "#ffffff", opacity: 0.15, anim: "zoomIn", loop: "pulse" }),
        S(f, d, "ellipse", { cx: 0.08, cy: 0.9, size: 0.35, fill: "#ffcc00", opacity: 0.35, anim: "zoomIn", loop: "float" }),
        T(f, d, "Weekend only", { y: 0.24, size: 0.05, font: "Montserrat", weight: 600, color: "#ffffff", uppercase: true, spacing: 0.3, anim: "fade" }),
        T(f, d, "BIG SALE", { y: 0.32, size: 0.24, font: "Bebas Neue", weight: 400, color: "#ffffff", anim: "pop", start: 0.3 }),
        T(f, d, "Up to 50% off everything", { y: 0.58, size: 0.055, font: "Poppins", weight: 500, color: "#fff4c2", anim: "slideUp", start: 0.7 }),
        S(f, d, "rect", { cx: 0.5, cy: 0.77, size: 0.11, aspect: 3.4, fill: "#ffffff", radius: 0.5, anim: "pop", start: 1.1, loop: "pulse" }),
        T(f, d, "SHOP NOW", { y: 0, cy: 0.77, size: 0.045, font: "Poppins", weight: 800, color: "#dd2476", spacing: 0.1, anim: "pop", start: 1.1, loop: "pulse" }),
      ],
    }),
  },
  {
    id: "quote",
    name: "Quote",
    preview: "#1b1f3b",
    build: (f, d) => ({
      background: { kind: "solid", color: "#1b1f3b" },
      elements: [
        T(f, d, "“", { y: 0.12, size: 0.3, font: "Playfair Display", color: "#ffcc00", anim: "drop" }),
        T(f, d, "Creativity is intelligence having fun.", { y: 0.38, size: 0.08, font: "Playfair Display", italic: true, color: "#ffffff", width: 0.78, anim: "typewriter", start: 0.5 }),
        S(f, d, "line", { cx: 0.5, cy: 0.72, size: 0.012, aspect: 12, fill: "#ffcc00", anim: "wipe", start: 2.2 }),
        T(f, d, "— Albert Einstein", { y: 0.76, size: 0.04, font: "Montserrat", weight: 500, color: "#a6a6a6", uppercase: true, spacing: 0.15, anim: "fade", start: 2.4 }),
      ],
    }),
  },
  {
    id: "event",
    name: "Game Night",
    preview: "linear-gradient(135deg,#667eea,#764ba2)",
    build: (f, d) => ({
      background: { kind: "gradient", from: "#667eea", to: "#764ba2", angle: 135 },
      elements: [
        S(f, d, "star", { cx: 0.15, cy: 0.18, size: 0.14, fill: "#ffcc00", rotation: -12, anim: "spin", loop: "wiggle" }),
        S(f, d, "star", { cx: 0.85, cy: 0.82, size: 0.1, fill: "#ff2d55", rotation: 10, anim: "spin", start: 0.3, loop: "wiggle" }),
        T(f, d, "You're invited", { y: 0.26, size: 0.06, font: "Caveat", weight: 700, color: "#fff4c2", anim: "fade" }),
        T(f, d, "GAME NIGHT", { y: 0.36, size: 0.16, font: "Anton", weight: 400, color: "#ffffff", anim: "slideUp", start: 0.4 }),
        T(f, d, "Friday · 8 PM · Bring snacks", { y: 0.6, size: 0.045, font: "Space Grotesk", weight: 500, color: "#ffffff", anim: "slideUp", start: 0.8 }),
      ],
    }),
  },
  {
    id: "newpost",
    name: "New Post",
    preview: "#ffd6e0",
    build: (f, d) => ({
      background: { kind: "solid", color: "#ffd6e0" },
      elements: [
        S(f, d, "rect", { cx: 0.5, cy: 0.5, size: 0.66, aspect: 1.15, fill: "#ffffff", radius: 0.08, anim: "zoomIn" }),
        S(f, d, "heart", { cx: 0.5, cy: 0.33, size: 0.12, fill: "#ff2d55", anim: "pop", start: 0.4, loop: "pulse" }),
        T(f, d, "NEW POST", { y: 0.42, size: 0.11, font: "Poppins", weight: 800, color: "#111111", anim: "slideUp", start: 0.6 }),
        T(f, d, "Tap the link in bio 👆", { y: 0.58, size: 0.045, font: "Inter", weight: 500, color: "#545454", anim: "fade", start: 1 }),
      ],
    }),
  },
  {
    id: "soon",
    name: "Coming Soon",
    preview: "#000000",
    build: (f, d) => ({
      background: { kind: "solid", color: "#000000" },
      elements: [
        S(f, d, "line", { cx: 0.5, cy: 0.36, size: 0.008, aspect: 40, fill: "#ffffff", anim: "wipe" }),
        T(f, d, "COMING SOON", { y: 0.42, size: 0.11, font: "Montserrat", weight: 800, color: "#ffffff", spacing: 0.08, anim: "typewriter", start: 0.4 }),
        S(f, d, "line", { cx: 0.5, cy: 0.62, size: 0.008, aspect: 40, fill: "#ffffff", anim: "wipe", start: 0.2 }),
        T(f, d, "Something new is on the way", { y: 0.66, size: 0.04, font: "Inter", weight: 400, color: "#a6a6a6", anim: "fade", start: 1.6, loop: "blink" }),
      ],
    }),
  },
];
