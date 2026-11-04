import { makeImage, makeShape, makeText } from "../lib/factory";
import type { El, Frame, InAnim, LoopAnim } from "../types";
import { T, type Template } from "./templateKit";

/**
 * Photo templates. Every one is built from normal layers — a photo that covers the frame (swap, crop or
 * filter it like any photo), optional shapes, and text — so nothing is flattened, and because the layers
 * are placed relative to the frame (or to the photo), they rebuild for any size and survive "Resize".
 */

const SRC = (n: number) => `${import.meta.env.BASE_URL}templates/photo-${n}.jpg`;

interface Ctx {
  f: Frame;
  d: number;
  /** a point on the photo (0–1 across, 0–1 down) → frame pixels, following how the photo is cropped to fit */
  at: (fx: number, fy: number) => { x: number; y: number };
  /** frame pixels in one photo width */
  pw: number;
  ph: number;
  /** photo aspect ratio — layers carry it so they stay stuck to the photo when the size changes */
  ratio: number;
}

type Anim = { anim?: InAnim; start?: number; loop?: LoopAnim };
const animate = (el: El, o: Anim, dflt: InAnim = "fade"): El => {
  el.anim = { ...el.anim, inType: o.anim ?? dflt, start: o.start ?? 0, loop: o.loop ?? "none" };
  return el;
};

/** Text placed on the photo; `size` and `fw` are fractions of the photo width. */
function A(c: Ctx, text: string, o: { fx: number; fy: number; fw: number; size: number; font: string; weight?: number; color: string; align?: "left" | "center" | "right"; lines?: number; italic?: boolean; spacing?: number; lh?: number; name?: string } & Anim): El {
  const fontSize = o.size * c.pw;
  const lh = o.lh ?? 1.2;
  const w = o.fw * c.pw;
  const h = fontSize * lh * (o.lines ?? 1);
  const p = c.at(o.fx, o.fy);
  const el = makeText(c.f, c.d, {
    text,
    name: o.name ?? text.slice(0, 18),
    fontFamily: o.font,
    fontSize,
    fontWeight: o.weight ?? 700,
    color: o.color,
    align: o.align ?? "center",
    italic: o.italic ?? false,
    letterSpacing: (o.spacing ?? 0) * fontSize,
    lineHeight: lh,
    w,
    h,
    x: p.x - w / 2,
    y: p.y - h / 2,
  });
  el.pin = c.ratio;
  return animate(el, o);
}

/** A flat panel placed on the photo — used to give a screen new, editable content. */
function P(c: Ctx, name: string, x0: number, y0: number, x1: number, y1: number, fill: string, radius = 0.01, o: Anim = {}): El {
  const a = c.at(x0, y0);
  const b = c.at(x1, y1);
  const el = makeShape(c.f, c.d, "rect", { name, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, fill, radius: radius * c.pw });
  el.pin = c.ratio;
  return animate(el, o, "none");
}

/** A full-width dark band at the top or bottom, so text stays readable over a busy photo. */
function band(f: Frame, d: number, edge: "top" | "bottom", size: number, opacity = 0.55): El {
  const h = f.h * size;
  const el = makeShape(f, d, "rect", { name: "Shade", x: 0, y: edge === "top" ? 0 : f.h - h, w: f.w, h, fill: "#000000", opacity });
  return animate(el, {}, "none");
}

/** Text positioned by frame fractions, shifted sideways if needed. */
function TX(f: Frame, d: number, text: string, cx: number, o: Parameters<typeof T>[3]): El {
  const el = T(f, d, text, o);
  el.x = f.w * cx - el.w / 2;
  return el;
}

interface Spec {
  n: number;
  id: string;
  name: string;
  w: number;
  h: number;
  bg: string;
  layers: (c: Ctx, f: Frame, d: number) => El[];
}

const SPECS: Spec[] = [
  {
    n: 1, id: "p-teacher", name: "Teacher's Day", w: 1179, h: 1500, bg: "#2f5a46",
    layers: (_c, f, d) => [
      band(f, d, "bottom", 0.26, 0.6),
      T(f, d, "TEACHER'S DAY", { y: 0.76, size: 0.1, font: "Anton", weight: 400, color: "#ffffff", spacing: 0.04, anim: "slideUp" }),
      T(f, d, "Free entry · bring a friend", { y: 0.89, size: 0.04, font: "Inter", weight: 500, color: "#f1e9c8", anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 2, id: "p-chalk", name: "Back to Class", w: 843, h: 1500, bg: "#1f5a45",
    layers: (c) => [
      A(c, "Back to", { fx: 0.52, fy: 0.27, fw: 0.8, size: 0.13, font: "Caveat", color: "#f3f1e6", anim: "fade" }),
      A(c, "CLASS", { fx: 0.52, fy: 0.37, fw: 0.84, size: 0.2, font: "Permanent Marker", weight: 400, color: "#f3f1e6", anim: "pop", start: 0.4 }),
      A(c, "Monday · 9 AM · Room 4", { fx: 0.52, fy: 0.49, fw: 0.8, size: 0.06, font: "Caveat", color: "#cfe8d8", anim: "fade", start: 0.9 }),
    ],
  },
  {
    n: 3, id: "p-fridge", name: "Fridge Memories", w: 1167, h: 1500, bg: "#1d4a36",
    layers: (_c, f, d) => [
      band(f, d, "bottom", 0.2, 0.5),
      T(f, d, "Memories we keep", { y: 0.8, size: 0.085, font: "Playfair Display", weight: 700, italic: true, color: "#ffffff", anim: "slideUp" }),
      T(f, d, "Notes · photos · little things", { y: 0.9, size: 0.035, font: "Inter", weight: 500, color: "#e6f2ea", spacing: 0.1, anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 4, id: "p-pinboard", name: "Reading Pinboard", w: 1201, h: 1500, bg: "#eeeeef",
    layers: (_c, f, d) => [
      { ...makeShape(f, d, "rect", { name: "Label", w: f.w * 0.5, h: Math.min(f.w, f.h) * 0.13, x: f.w * 0.46, y: f.h * 0.86, fill: "#ffffff", radius: Math.min(f.w, f.h) * 0.03, opacity: 0.94 }) },
      TX(f, d, "This month's reads", 0.71, { y: 0.885, size: 0.062, font: "Caveat", weight: 700, color: "#2b2540", width: 0.48, anim: "pop" }),
    ],
  },
  {
    n: 5, id: "p-travel", name: "Travel Desk", w: 1500, h: 843, bg: "#2c6b57",
    layers: (_c, f, d) => [
      band(f, d, "bottom", 0.3, 0.55),
      T(f, d, "Our trip, pinned", { y: 0.74, size: 0.1, font: "Playfair Display", weight: 700, italic: true, color: "#ffffff", anim: "slideUp" }),
      T(f, d, "Every place, every story", { y: 0.89, size: 0.04, font: "Inter", weight: 500, color: "#f4ecd2", spacing: 0.12, anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 6, id: "p-cork", name: "Case File", w: 997, h: 1500, bg: "#7a4a24",
    layers: (_c, f, d) => [
      band(f, d, "top", 0.2, 0.55),
      T(f, d, "CASE FILE 01", { y: 0.04, size: 0.12, font: "Anton", weight: 400, color: "#ffffff", spacing: 0.05, anim: "drop" }),
      T(f, d, "Something is watching", { y: 0.135, size: 0.04, font: "Space Mono", weight: 400, color: "#ffd8c2", anim: "typewriter", start: 0.6 }),
    ],
  },
  {
    n: 7, id: "p-attic", name: "The Attic", w: 843, h: 1500, bg: "#1d2236",
    layers: (_c, f, d) => [
      band(f, d, "bottom", 0.28, 0.55),
      T(f, d, "THE ATTIC", { y: 0.74, size: 0.16, font: "Anton", weight: 400, color: "#ffd9a0", spacing: 0.04, anim: "slideUp" }),
      T(f, d, "Open the drawers. Read the notes.", { y: 0.88, size: 0.05, font: "Caveat", weight: 600, color: "#ffffff", anim: "fade", start: 0.6 }),
    ],
  },
  {
    n: 8, id: "p-notice", name: "Notice Board", w: 1248, h: 1500, bg: "#1d2236",
    layers: (c) => [
      A(c, "NOTICE BOARD", { fx: 0.655, fy: 0.34, fw: 0.5, size: 0.065, font: "Anton", weight: 400, color: "#3b2410", spacing: 0.04, anim: "drop" }),
      A(c, "Pin your announcement here", { fx: 0.655, fy: 0.43, fw: 0.5, size: 0.028, font: "Space Mono", weight: 400, color: "#5a3a1c", anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 9, id: "p-lesson", name: "Today's Lesson", w: 1500, h: 999, bg: "#2d3b34",
    layers: (c) => [
      P(c, "Board", 0.19, 0.2, 0.755, 0.55, "#28382f", 0.004),
      A(c, "Today's lesson", { fx: 0.47, fy: 0.34, fw: 0.5, size: 0.06, font: "Caveat", color: "#f3f1e6", anim: "typewriter", start: 0.2 }),
      A(c, "Chapter 04 · Creative thinking", { fx: 0.47, fy: 0.45, fw: 0.5, size: 0.026, font: "Caveat", weight: 600, color: "#bfd6c8", anim: "fade", start: 1.2 }),
    ],
  },
  {
    n: 10, id: "p-display", name: "Studio Display", w: 1500, h: 1500, bg: "#0b1022",
    layers: (c) => [
      A(c, "Your headline here", { fx: 0.54, fy: 0.37, fw: 0.5, size: 0.075, font: "Space Grotesk", color: "#2a1206", anim: "slideUp" }),
      P(c, "Caption strip", 0.23, 0.565, 0.855, 0.635, "#16100d", 0.004),
      A(c, "YOUR TAGLINE  ·  YOUR DETAILS  ·  CALL TO ACTION", { fx: 0.54, fy: 0.6, fw: 0.58, size: 0.014, font: "Space Mono", weight: 400, color: "#f2e6dc", anim: "fade", start: 0.6 }),
    ],
  },
  {
    n: 11, id: "p-retromac", name: "Retro Desktop", w: 1500, h: 1123, bg: "#101010",
    layers: (c) => [
      P(c, "Screen", 0.295, 0.245, 0.715, 0.598, "#ebebec", 0.01),
      A(c, "Fresh ideas for your project?", { fx: 0.505, fy: 0.37, fw: 0.34, size: 0.052, font: "Playfair Display", color: "#111111", lines: 2, lh: 1.05, anim: "slideUp" }),
      A(c, "Add a short paragraph here — what you do, who it's for and why it matters.", { fx: 0.505, fy: 0.5, fw: 0.34, size: 0.0125, font: "Inter", weight: 400, color: "#3a3a3a", lines: 2, lh: 1.35, anim: "fade", start: 0.7 }),
    ],
  },
  {
    n: 12, id: "p-hello", name: "Hello Mac", w: 1000, h: 1500, bg: "#f0f0f0",
    layers: (c) => [
      P(c, "Screen", 0.325, 0.272, 0.725, 0.4, "#f4f4f4", 0.006),
      A(c, "hello.", { fx: 0.525, fy: 0.336, fw: 0.4, size: 0.12, font: "Caveat", weight: 700, color: "#141414", anim: "typewriter" }),
    ],
  },
  {
    n: 13, id: "p-terminal", name: "Retro Terminal", w: 1500, h: 1001, bg: "#070708",
    layers: (c) => [
      P(c, "Screen", 0.37, 0.185, 0.665, 0.52, "#1c1411", 0.008),
      A(c, "YOUR TITLE", { fx: 0.518, fy: 0.33, fw: 0.27, size: 0.04, font: "Space Mono", weight: 700, color: "#ffffff", anim: "typewriter" }),
      A(c, "> press any key to start", { fx: 0.518, fy: 0.42, fw: 0.27, size: 0.013, font: "Space Mono", weight: 400, color: "#ffb347", anim: "fade", start: 1, loop: "blink" }),
    ],
  },
  {
    n: 14, id: "p-astro", name: "Out of this World", w: 1000, h: 1500, bg: "#2d4a1f",
    layers: (_c, f, d) => [
      band(f, d, "bottom", 0.2, 0.5),
      T(f, d, "Out of this world", { y: 0.8, size: 0.09, font: "Playfair Display", weight: 700, italic: true, color: "#ffffff", anim: "slideUp" }),
      T(f, d, "A tiny escape, every day", { y: 0.9, size: 0.035, font: "Inter", weight: 500, color: "#f3ead0", spacing: 0.12, anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 15, id: "p-bunny", name: "Dreamy Days", w: 1130, h: 1500, bg: "#d9a7d6",
    layers: (_c, f, d) => [
      T(f, d, "Dream a little", { y: 0.06, size: 0.11, font: "Playfair Display", weight: 700, italic: true, color: "#ffffff", anim: "slideUp" }),
      T(f, d, "soft days · slow screens", { y: 0.17, size: 0.04, font: "Poppins", weight: 500, color: "#fff1fb", spacing: 0.18, uppercase: true, anim: "fade", start: 0.5 }),
    ],
  },
  {
    n: 16, id: "p-flip", name: "Flip Phone Text", w: 1200, h: 1500, bg: "#2d4a9c",
    layers: (c) => [
      P(c, "Screen", 0.262, 0.345, 0.738, 0.658, "#ffffff", 0.004),
      A(c, "Hey, are u still there?", { fx: 0.5, fy: 0.5, fw: 0.44, size: 0.055, font: "Space Mono", weight: 400, color: "#111111", align: "left", lines: 3, lh: 1.55, anim: "typewriter" }),
    ],
  },
  {
    n: 17, id: "p-greenroom", name: "Green Screen Room", w: 1500, h: 1500, bg: "#1f6d3e",
    layers: (c) => [
      P(c, "Screen", 0.235, 0.265, 0.745, 0.622, "#1fc455", 0.004),
      A(c, "YOUR VIDEO HERE", { fx: 0.49, fy: 0.443, fw: 0.45, size: 0.034, font: "Space Mono", weight: 700, color: "#0b3d1d", anim: "fade" }),
    ],
  },
  {
    n: 18, id: "p-neon", name: "Neon Desk", w: 1500, h: 1500, bg: "#6e2a63",
    layers: (c) => [
      P(c, "Screen", 0.29, 0.282, 0.713, 0.585, "#5fd45e", 0.004),
      A(c, "YOUR VIDEO HERE", { fx: 0.5, fy: 0.433, fw: 0.4, size: 0.032, font: "Space Mono", weight: 700, color: "#0e4a14", anim: "fade" }),
    ],
  },
  {
    n: 19, id: "p-revival", name: "Retro Revival TV", w: 848, h: 1500, bg: "#7a5a2a",
    layers: (c) => [
      P(c, "Screen", 0.305, 0.335, 0.69, 0.5, "#12301f", 0.02),
      A(c, "NOW SHOWING", { fx: 0.4975, fy: 0.395, fw: 0.36, size: 0.07, font: "Space Mono", weight: 700, color: "#8dffb0", anim: "typewriter" }),
      A(c, "Your story, tonight at 8", { fx: 0.4975, fy: 0.45, fw: 0.36, size: 0.035, font: "Space Mono", weight: 400, color: "#b9ffd0", anim: "fade", start: 1 }),
    ],
  },
  {
    n: 20, id: "p-playtv", name: "Press Play", w: 842, h: 1500, bg: "#0d0b1c",
    layers: (c) => [
      P(c, "Screen", 0.337, 0.267, 0.623, 0.379, "#34e84a", 0.006),
      A(c, "PRESS PLAY", { fx: 0.48, fy: 0.323, fw: 0.28, size: 0.045, font: "Space Mono", weight: 700, color: "#0a3d10", anim: "pop", loop: "pulse" }),
    ],
  },
];

function photoTemplate(s: Spec): Template {
  return {
    id: s.id,
    name: s.name,
    group: "photo",
    preview: `${s.bg} url(${SRC(s.n)}) center/cover`,
    build: (f, d) => {
      // the photo covers the frame the same way the preview crops it
      const k = Math.max(f.w / s.w, f.h / s.h);
      const ox = (f.w - s.w * k) / 2;
      const oy = (f.h - s.h * k) / 2;
      const c: Ctx = { f, d, ratio: s.w / s.h, pw: s.w * k, ph: s.h * k, at: (fx, fy) => ({ x: ox + fx * s.w * k, y: oy + fy * s.h * k }) };
      const photo: El = { ...makeImage(f, d, SRC(s.n), s.w, s.h), name: "Photo", x: 0, y: 0, w: f.w, h: f.h };
      photo.anim = { ...photo.anim, inType: "none" };
      return { background: { kind: "solid", color: s.bg }, elements: [photo, ...s.layers(c, f, d)] };
    },
  };
}

export const PHOTO_TEMPLATES: Template[] = SPECS.map(photoTemplate);
