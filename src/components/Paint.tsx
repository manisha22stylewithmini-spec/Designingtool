import type { ReactNode } from "react";
import { gradientLine, patternTile, sortedStops } from "../lib/paint";
import type { El, Gradient } from "../types";

/** SVG gradient definition (user-space, so it follows the element's box). */
function gradientDef(g: Gradient, id: string, w: number, h: number): ReactNode {
  const stops = sortedStops(g).map((s, i) => <stop key={i} offset={s.pos} stopColor={s.color} />);
  if (g.type === "radial") {
    return (
      <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={w / 2} cy={h / 2} r={Math.max(w, h) / 2}>
        {stops}
      </radialGradient>
    );
  }
  const [x1, y1, x2, y2] = gradientLine(g.angle, w, h);
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops}
    </linearGradient>
  );
}

/** SVG <defs> + stroke value: a gradient border, or the plain stroke colour. */
export function svgStroke(el: El, id: string): { defs: ReactNode; stroke: string } {
  if (el.strokeGradient) return { defs: gradientDef(el.strokeGradient, id, el.w, el.h), stroke: `url(#${id})` };
  return { defs: null, stroke: el.stroke ?? "#000000" };
}

/** SVG <defs> + fill value for an element's gradient / pattern / flat colour. */
export function svgPaint(el: El, id: string, fallback = "#000000"): { defs: ReactNode; fill: string } {
  if (el.fillPattern) {
    const p = el.fillPattern;
    const t = patternTile(p);
    return {
      fill: `url(#${id})`,
      defs: (
        <pattern id={id} patternUnits="userSpaceOnUse" width={t.w} height={t.h}>
          <rect width={t.w} height={t.h} fill={p.bg} />
          {t.prims.map((q, i) => (q.t === "rect" ? <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={p.color} /> : <circle key={i} cx={q.x} cy={q.y} r={q.r} fill={p.color} />))}
        </pattern>
      ),
    };
  }
  if (el.fillGradient) {
    const g = el.fillGradient;
    const stops = sortedStops(g).map((s, i) => <stop key={i} offset={s.pos} stopColor={s.color} />);
    if (g.type === "radial") {
      return {
        fill: `url(#${id})`,
        defs: (
          <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={el.w / 2} cy={el.h / 2} r={Math.max(el.w, el.h) / 2}>
            {stops}
          </radialGradient>
        ),
      };
    }
    const [x1, y1, x2, y2] = gradientLine(g.angle, el.w, el.h);
    return {
      fill: `url(#${id})`,
      defs: (
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops}
        </linearGradient>
      ),
    };
  }
  return { defs: null, fill: el.fill && el.fill !== "transparent" ? el.fill : fallback === "none" ? "none" : el.fill === "transparent" ? "none" : fallback };
}
