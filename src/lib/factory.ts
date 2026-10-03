import type { Anim, El, Frame, ShapeKind } from "../types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_SHADOW = { on: false, x: 0, y: 8, blur: 24, color: "rgba(0,0,0,0.35)" };

export function defaultAnim(duration: number): Anim {
  return {
    start: 0,
    end: duration,
    inType: "fade",
    inDur: 0.6,
    outType: "none",
    outDur: 0.5,
    loop: "none",
    easing: "smooth",
  };
}

function base(frame: Frame, duration: number, partial: Partial<El>): Omit<El, "type" | "name"> {
  return {
    id: uid(),
    x: frame.w * 0.1,
    y: frame.h * 0.1,
    w: 200,
    h: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    shadow: { ...DEFAULT_SHADOW },
    anim: defaultAnim(duration),
    ...partial,
  };
}

export function makeText(frame: Frame, duration: number, partial: Partial<El> = {}): El {
  const unit = Math.min(frame.w, frame.h);
  const fontSize = partial.fontSize ?? Math.round(unit * 0.07);
  const w = partial.w ?? frame.w * 0.8;
  return {
    ...base(frame, duration, {}),
    type: "text",
    name: "Text",
    text: "Your text here",
    fontFamily: "Poppins",
    fontSize,
    fontWeight: 700,
    italic: false,
    underline: false,
    uppercase: false,
    align: "center",
    color: "#111111",
    letterSpacing: 0,
    lineHeight: 1.2,
    ...partial,
    w,
    x: partial.x ?? (frame.w - w) / 2,
    y: partial.y ?? frame.h / 2 - fontSize,
    h: partial.h ?? fontSize * 1.2,
  } as El;
}

export function makeShape(frame: Frame, duration: number, shape: ShapeKind, partial: Partial<El> = {}): El {
  const size = Math.min(frame.w, frame.h) * 0.3;
  const isLine = shape === "line";
  const w = partial.w ?? (shape === "arrow" || isLine ? size * 1.4 : size);
  const h = partial.h ?? (isLine ? Math.max(6, size * 0.04) : shape === "arrow" ? size * 0.6 : size);
  return {
    ...base(frame, duration, {}),
    type: "shape",
    name: shape === "rect" ? "Square" : shape[0].toUpperCase() + shape.slice(1),
    shape,
    fill: isLine ? "#111111" : "#7c3aed",
    stroke: "#111111",
    strokeWidth: 0,
    radius: 0,
    ...partial,
    w,
    h,
    x: partial.x ?? (frame.w - w) / 2,
    y: partial.y ?? (frame.h - h) / 2,
  } as El;
}

export function makeImage(frame: Frame, duration: number, src: string, natW: number, natH: number): El {
  const maxW = frame.w * 0.6;
  const maxH = frame.h * 0.6;
  const s = Math.min(maxW / natW, maxH / natH);
  const w = natW * s;
  const h = natH * s;
  return {
    ...base(frame, duration, {}),
    type: "image",
    name: "Photo",
    src,
    radius: 0,
    stroke: "#ffffff",
    strokeWidth: 0,
    flipX: false,
    flipY: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    w,
    h,
    x: (frame.w - w) / 2,
    y: (frame.h - h) / 2,
  };
}

export function makeVideo(frame: Frame, duration: number, src: string, natW: number, natH: number, length: number): El {
  // Videos fill the frame by default — that's how reels and stories are made.
  return {
    ...base(frame, duration, {}),
    type: "video",
    name: "Video clip",
    src,
    radius: 0,
    stroke: "#ffffff",
    strokeWidth: 0,
    flipX: false,
    flipY: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    trimStart: 0,
    videoDuration: length,
    muted: false,
    volume: 1,
    ...coverFrame(frame, natW / natH),
    anim: { ...defaultAnim(duration), inType: "none", end: Math.min(duration, length) },
  };
}

/** Position for an element of this aspect ratio to cover the whole frame. */
export function coverFrame(frame: Frame, ratio: number) {
  const fr = frame.w / frame.h;
  const w = ratio > fr ? frame.h * ratio : frame.w;
  const h = ratio > fr ? frame.h : frame.w / ratio;
  return { w, h, x: (frame.w - w) / 2, y: (frame.h - h) / 2, rotation: 0 };
}

/** Position for an element of this aspect ratio to fit entirely inside the frame. */
export function fitFrame(frame: Frame, ratio: number) {
  const fr = frame.w / frame.h;
  const w = ratio > fr ? frame.w : frame.h * ratio;
  const h = ratio > fr ? frame.w / ratio : frame.h;
  return { w, h, x: (frame.w - w) / 2, y: (frame.h - h) / 2, rotation: 0 };
}

/**
 * Re-flow a design into a new frame size ("magic resize"): positions keep their
 * relative place, sizes scale by the smaller ratio so nothing gets stretched.
 */
export function resizeElements<T extends { elements: El[] }>(page: T, from: Frame, frame: Frame): T {
  const sx = frame.w / from.w;
  const sy = frame.h / from.h;
  const s = Math.min(sx, sy);
  const elements = page.elements.map((el) => {
    const cx = (el.x + el.w / 2) * sx;
    const cy = (el.y + el.h / 2) * sy;
    const w = el.w * s;
    const h = el.h * s;
    const next: El = { ...el, w, h, x: cx - w / 2, y: cy - h / 2 };
    if (el.fontSize) next.fontSize = el.fontSize * s;
    if (el.strokeWidth) next.strokeWidth = el.strokeWidth * s;
    if (el.radius) next.radius = el.radius * s;
    if (el.letterSpacing) next.letterSpacing = el.letterSpacing * s;
    next.shadow = { ...el.shadow, x: el.shadow.x * s, y: el.shadow.y * s, blur: el.shadow.blur * s };
    return next;
  });
  return { ...page, elements };
}

export function filterCss(el: El): string {
  const parts: string[] = [];
  if ((el.brightness ?? 100) !== 100) parts.push(`brightness(${el.brightness}%)`);
  if ((el.contrast ?? 100) !== 100) parts.push(`contrast(${el.contrast}%)`);
  if ((el.saturation ?? 100) !== 100) parts.push(`saturate(${el.saturation}%)`);
  if ((el.grayscale ?? 0) !== 0) parts.push(`grayscale(${el.grayscale}%)`);
  if ((el.blur ?? 0) !== 0) parts.push(`blur(${el.blur}px)`);
  return parts.join(" ") || "none";
}
