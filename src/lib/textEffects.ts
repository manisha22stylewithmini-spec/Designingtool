import type { CSSProperties } from "react";
import type { El, TextEffect } from "../types";

export const TEXT_EFFECTS: { id: TextEffect; label: string; color: string; hint: string }[] = [
  { id: "none", label: "None", color: "#000000", hint: "Plain text" },
  { id: "lift", label: "Lift", color: "#000000", hint: "Soft shadow underneath" },
  { id: "outline", label: "Outline", color: "#000000", hint: "Thick border around letters" },
  { id: "hollow", label: "Hollow", color: "#000000", hint: "Only the letter outlines" },
  { id: "neon", label: "Neon", color: "#ff2d55", hint: "Glowing sign" },
  { id: "highlight", label: "Highlight", color: "#ffcc00", hint: "Coloured box behind each line" },
  { id: "echo", label: "Echo", color: "#ff2d55", hint: "Repeated offset copies" },
];

/** Numbers shared by the editor (CSS) and export (canvas) so both look the same. */
export function effectParams(el: El) {
  const fs = el.fontSize ?? 32;
  const k = (el.effectSize ?? 50) / 100;
  return {
    fs,
    k,
    color: el.effectColor ?? "#000000",
    outline: fs * 0.12 * k * 2, // stroke width (half is visible outside the letter)
    hollow: Math.max(1, fs * 0.04 * k * 2),
    glow: [0.08, 0.2, 0.4].map((b) => fs * b * k),
    liftBlur: fs * 0.25 * k,
    liftY: fs * 0.06,
    liftAlpha: 0.2 + 0.4 * k,
    echo: fs * 0.06 * Math.max(0.2, k),
    pad: fs * 0.22,
    radius: fs * 0.3 * k,
  };
}

function alpha(color: string, a: number) {
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
}

export function textEffectCss(el: El): CSSProperties {
  const p = effectParams(el);
  const shadows: string[] = [];
  const css: CSSProperties = {};
  switch (el.effect) {
    case "lift":
      shadows.push(`0 ${p.liftY}px ${p.liftBlur}px rgba(0,0,0,${p.liftAlpha})`);
      break;
    case "outline":
      css.WebkitTextStroke = `${p.outline}px ${p.color}`;
      css.paintOrder = "stroke fill";
      break;
    case "hollow":
      css.WebkitTextStroke = `${p.hollow}px ${el.color}`;
      css.color = "transparent";
      break;
    case "neon":
      p.glow.forEach((b) => shadows.push(`0 0 ${b}px ${p.color}`));
      break;
    case "echo":
      shadows.push(`${p.echo}px ${p.echo}px 0 ${alpha(p.color, 0.55)}`, `${p.echo * 2}px ${p.echo * 2}px 0 ${alpha(p.color, 0.28)}`);
      break;
  }
  if (el.shadow.on) shadows.push(`${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${el.shadow.color}`);
  if (shadows.length) css.textShadow = shadows.join(", ");
  return css;
}
