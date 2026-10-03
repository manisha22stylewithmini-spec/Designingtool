import type { El, ShapeKind } from "../types";

const f = (n: number) => Math.round(n * 100) / 100;

function poly(pts: [number, number][]): string {
  return "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
}

/** SVG path for a shape, drawn inside a w×h box. Used by both the editor (SVG) and export (Path2D). */
export function shapePath(kind: ShapeKind, w: number, h: number, radius = 0, inset = 0): string {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const W = x1 - x0;
  const H = y1 - y0;
  const cx = x0 + W / 2;
  const cy = y0 + H / 2;
  switch (kind) {
    case "rect":
    case "line": {
      const r = Math.max(0, Math.min(radius, W / 2, H / 2));
      if (!r) return poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      return `M${f(x0 + r)} ${f(y0)} H${f(x1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)} V${f(y1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)} H${f(x0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)} V${f(y0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)} Z`;
    }
    case "ellipse": {
      const rx = W / 2;
      const ry = H / 2;
      return `M${f(x0)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x1)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x0)} ${f(cy)} Z`;
    }
    case "triangle":
      return poly([[cx, y0], [x1, y1], [x0, y1]]);
    case "diamond":
      return poly([[cx, y0], [x1, cy], [cx, y1], [x0, cy]]);
    case "hexagon":
      return poly([
        [x0 + W * 0.25, y0],
        [x0 + W * 0.75, y0],
        [x1, cy],
        [x0 + W * 0.75, y1],
        [x0 + W * 0.25, y1],
        [x0, cy],
      ]);
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.42;
        pts.push([cx + Math.cos(a) * (W / 2) * r, y0 + H * 0.53 + Math.sin(a) * (H / 1.9) * r]);
      }
      return poly(pts);
    }
    case "arrow":
      return poly([
        [x0, y0 + H * 0.3],
        [x0 + W * 0.62, y0 + H * 0.3],
        [x0 + W * 0.62, y0],
        [x1, cy],
        [x0 + W * 0.62, y1],
        [x0 + W * 0.62, y0 + H * 0.7],
        [x0, y0 + H * 0.7],
      ]);
    case "heart":
      return `M${f(cx)} ${f(y0 + H * 0.28)} C${f(cx)} ${f(y0 + H * 0.05)} ${f(x0 + W * 0.02)} ${f(y0 - H * 0.02)} ${f(x0)} ${f(y0 + H * 0.3)} C${f(x0)} ${f(y0 + H * 0.55)} ${f(x0 + W * 0.25)} ${f(y0 + H * 0.72)} ${f(cx)} ${f(y1)} C${f(x1 - W * 0.25)} ${f(y0 + H * 0.72)} ${f(x1)} ${f(y0 + H * 0.55)} ${f(x1)} ${f(y0 + H * 0.3)} C${f(x1 - W * 0.02)} ${f(y0 - H * 0.02)} ${f(cx)} ${f(y0 + H * 0.05)} ${f(cx)} ${f(y0 + H * 0.28)} Z`;
    case "bubble": {
      const bh = H * 0.78;
      const r = Math.min(W, bh) * 0.18;
      const by1 = y0 + bh;
      return `M${f(x0 + r)} ${f(y0)} H${f(x1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)} V${f(by1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(by1)} H${f(x0 + W * 0.4)} L${f(x0 + W * 0.2)} ${f(y1)} L${f(x0 + W * 0.24)} ${f(by1)} H${f(x0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(by1 - r)} V${f(y0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)} Z`;
    }
  }
}

// ---------- Text layout (shared by editor and export so they match exactly) ----------

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  return measureCtx;
}

export function fontString(el: El): string {
  return `${el.italic ? "italic " : ""}${el.fontWeight ?? 400} ${el.fontSize ?? 32}px "${el.fontFamily ?? "Inter"}"`;
}

export function displayText(el: El): string {
  const t = el.text ?? "";
  const c = el.textCase ?? (el.uppercase ? "upper" : "none");
  if (c === "upper") return t.toUpperCase();
  if (c === "lower") return t.toLowerCase();
  if (c === "title") return t.replace(/(^|\s)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
  return t;
}

function measure(text: string, el: El): number {
  const c = ctx();
  c.font = fontString(el);
  return c.measureText(text).width + (el.letterSpacing ?? 0) * text.length;
}

export function layoutText(el: El): string[] {
  const maxW = Math.max(1, el.w);
  const lines: string[] = [];
  for (const para of displayText(el).split("\n")) {
    const words = para.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      const test = line + word;
      if (measure(test, el) <= maxW || line === "") {
        if (line === "" && measure(word, el) > maxW && word.trim()) {
          // break a very long word across lines
          let chunk = "";
          for (const ch of word) {
            if (measure(chunk + ch, el) > maxW && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = test;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function textHeight(el: El): number {
  return Math.max(1, layoutText(el).length) * (el.fontSize ?? 32) * (el.lineHeight ?? 1.2);
}

export function lineWidth(text: string, el: El): number {
  return measure(text, el);
}

/** Axis-aligned bounds of a (possibly rotated) element. */
export function bounds(el: El) {
  const rad = (el.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const bw = el.w * c + el.h * s;
  const bh = el.w * s + el.h * c;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return { left: cx - bw / 2, top: cy - bh / 2, right: cx + bw / 2, bottom: cy + bh / 2, cx, cy };
}
