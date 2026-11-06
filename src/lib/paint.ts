import type { El, Gradient, Pattern, PatternKind } from "../types";
import { shapePath } from "./geometry";
import { nodesToPath } from "./vector";

/** Shared by the editor (SVG) and export (canvas): path data, gradients and patterns. */

export const DEFAULT_GRADIENT: Gradient = {
  type: "linear",
  angle: 90,
  stops: [
    { pos: 0, color: "#7c3aed" },
    { pos: 1, color: "#ec4899" },
  ],
};

export const DEFAULT_PATTERN: Pattern = { kind: "dots", color: "#7c3aed", bg: "#ede9fe", size: 24 };

export const PATTERNS: { id: PatternKind; label: string }[] = [
  { id: "dots", label: "Dots" },
  { id: "stripes", label: "Stripes" },
  { id: "lines", label: "Lines" },
  { id: "grid", label: "Grid" },
  { id: "checker", label: "Checker" },
  { id: "noise", label: "Noise" },
];

/** A shape's or path's outline as SVG path data in its own box (compound paths include their extra rings). */
export function elementPath(el: El, inset = 0): string {
  if (el.type === "path") {
    let d = nodesToPath(el.nodes ?? [], !!el.closed, el.w, el.h);
    for (const ring of el.subpaths ?? []) d += " " + nodesToPath(ring, true, el.w, el.h);
    return d;
  }
  return shapePath(el.shape!, el.w, el.h, el.radius, inset);
}

export const sortedStops = (g: Gradient) => [...g.stops].sort((a, b) => a.pos - b.pos);

/** CSS-angle gradient line across a w×h box: [x1, y1, x2, y2]. */
export function gradientLine(angle: number, w: number, h: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = (Math.cos(rad) * len) / 2;
  const dy = (Math.sin(rad) * len) / 2;
  return [w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy] as const;
}

/** CSS preview of a gradient (for swatches). */
export function gradientCss(g: Gradient): string {
  const stops = sortedStops(g)
    .map((s) => `${s.color} ${Math.round(s.pos * 100)}%`)
    .join(", ");
  return g.type === "radial" ? `radial-gradient(circle, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`;
}

// ---------- patterns ----------

export type Prim = { t: "rect"; x: number; y: number; w: number; h: number } | { t: "circle"; x: number; y: number; r: number };

/** The repeating tile of a pattern: its size and the foreground shapes drawn on the background. */
export function patternTile(p: Pattern): { w: number; h: number; prims: Prim[] } {
  const s = Math.max(4, p.size);
  switch (p.kind) {
    case "dots":
      return { w: s, h: s, prims: [{ t: "circle", x: s / 2, y: s / 2, r: s * 0.18 }] };
    case "stripes":
      return { w: s, h: s, prims: [{ t: "rect", x: 0, y: 0, w: s / 2, h: s }] };
    case "lines":
      return { w: s, h: s, prims: [{ t: "rect", x: 0, y: 0, w: s, h: s / 2 }] };
    case "grid": {
      const t = Math.max(1, s * 0.08);
      return {
        w: s,
        h: s,
        prims: [
          { t: "rect", x: 0, y: 0, w: s, h: t },
          { t: "rect", x: 0, y: 0, w: t, h: s },
        ],
      };
    }
    case "checker":
      return {
        w: s * 2,
        h: s * 2,
        prims: [
          { t: "rect", x: 0, y: 0, w: s, h: s },
          { t: "rect", x: s, y: s, w: s, h: s },
        ],
      };
    case "noise": {
      // seeded, so the grain looks the same in the editor and in the export
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const w = s * 4;
      return { w, h: w, prims: Array.from({ length: 70 }, () => ({ t: "circle" as const, x: rnd() * w, y: rnd() * w, r: 0.6 + rnd() * Math.max(1, s * 0.05) })) };
    }
  }
}

/** Does this element use any fill besides a flat colour? */
export const hasPaint = (el: El) => !!(el.fillSrc || el.fillGradient || el.fillPattern);
