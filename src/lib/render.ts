import type { Background, Doc, El } from "../types";
import { animState, STATIC, type AnimState } from "./animation";
import { filterCss } from "./factory";
import { fontString, layoutText, lineWidth, shapePath } from "./geometry";
import { resolveSrc } from "./media";
import { effectParams } from "./textEffects";
import { ensureFont } from "../data/fonts";

const imgCache = new Map<string, HTMLImageElement>();
/** Hidden <video> players used while exporting, keyed by element id. */
export const videoPlayers = new Map<string, HTMLVideoElement>();

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return resolve();
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = t;
    setTimeout(done, 3000);
  });
}

async function videoPlayer(el: El): Promise<HTMLVideoElement | undefined> {
  const src = resolveSrc(el.src);
  if (!src) return undefined;
  let v = videoPlayers.get(el.id);
  if (!v || v.dataset.src !== src) {
    v = document.createElement("video");
    v.dataset.src = src;
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    videoPlayers.set(el.id, v);
    await new Promise<void>((resolve) => {
      if (v!.readyState >= 1) return resolve();
      v!.onloadedmetadata = () => resolve();
      v!.onerror = () => resolve();
    });
  }
  await seek(v, el.trimStart ?? 0);
  return v;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src);
  if (cached?.complete && cached.naturalWidth) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      imgCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export async function preloadDoc(doc: Doc): Promise<void> {
  const all = [...doc.elements, ...(doc.context?.neighbours ?? [])];
  const srcs = all.filter((e) => e.type === "image" && e.src).map((e) => e.src!);
  if (doc.background.kind === "image") srcs.push(doc.background.src);
  const texts = all.filter((e) => e.type === "text");
  await Promise.all(texts.map((e) => ensureFont(e.fontFamily)));
  const fonts = texts.map((e) => fontString(e));
  await Promise.all([
    ...all.filter((e) => e.type === "video").map((e) => videoPlayer(e).catch(() => undefined)),
    ...srcs.map((s) => loadImage(s).catch(() => undefined)),
    ...fonts.map((f) => document.fonts.load(f).catch(() => undefined)),
  ]);
}

/** CSS linear-gradient angle → canvas gradient line across a w×h box. */
function gradientLine(angle: number, w: number, h: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = (Math.cos(rad) * len) / 2;
  const dy = (Math.sin(rad) * len) / 2;
  return [w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy] as const;
}

function drawCover(c: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement, w: number, h: number, zoom = 1, fx = 0.5, fy = 0.5) {
  const nw = img instanceof HTMLVideoElement ? img.videoWidth : img.naturalWidth;
  const nh = img instanceof HTMLVideoElement ? img.videoHeight : img.naturalHeight;
  const s = Math.max(w / nw, h / nh) * zoom;
  const dw = nw * s;
  const dh = nh * s;
  // same maths as CSS object-position + scale around that point
  c.drawImage(img, (w - dw) * fx, (h - dh) * fy, dw, dh);
}

function drawBackground(c: CanvasRenderingContext2D, bg: Background, w: number, h: number) {
  if (bg.kind === "none") return; // transparent
  if (bg.kind === "solid") {
    c.fillStyle = bg.color;
    c.fillRect(0, 0, w, h);
  } else if (bg.kind === "gradient") {
    const g = c.createLinearGradient(...gradientLine(bg.angle, w, h));
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    const img = imgCache.get(bg.src);
    if (img) drawCover(c, img, w, h);
    if (bg.dim > 0) {
      c.fillStyle = `rgba(0,0,0,${bg.dim / 100})`;
      c.fillRect(0, 0, w, h);
    }
  }
}

function applyShadow(c: CanvasRenderingContext2D, el: El) {
  if (!el.shadow.on) return;
  c.shadowColor = el.shadow.color;
  c.shadowBlur = el.shadow.blur;
  c.shadowOffsetX = el.shadow.x;
  c.shadowOffsetY = el.shadow.y;
}

function drawElement(c: CanvasRenderingContext2D, el: El, st: AnimState) {
  if (el.hidden || !st.visible || st.opacity <= 0.001) return;
  c.save();
  c.globalAlpha = el.opacity * st.opacity;
  c.translate(el.x + el.w / 2 + st.tx, el.y + el.h / 2 + st.ty);
  c.rotate(((el.rotation + st.rotate) * Math.PI) / 180);
  c.scale(st.scale, st.scale);
  c.translate(-el.w / 2, -el.h / 2);

  if (st.reveal < 1) {
    c.beginPath();
    c.rect(-el.w, -el.h, el.w * (1 + st.reveal), el.h * 3);
    c.clip();
  }

  if (el.type === "shape") {
    const sw = el.strokeWidth ?? 0;
    const p = new Path2D(shapePath(el.shape!, el.w, el.h, el.radius, sw / 2));
    applyShadow(c, el);
    c.fillStyle = el.fill ?? "#000";
    c.fill(p);
    if (sw > 0) {
      c.shadowColor = "transparent";
      c.lineWidth = sw;
      c.strokeStyle = el.stroke ?? "#000";
      c.lineJoin = "round";
      c.stroke(p);
    }
  } else if (el.type === "image" || el.type === "video") {
    const v = el.type === "video" ? videoPlayers.get(el.id) : undefined;
    const img: CanvasImageSource | undefined =
      el.type === "video" ? (v && v.readyState >= 2 ? v : undefined) : el.src ? imgCache.get(el.src) : undefined;
    const clip = new Path2D(el.mask ? shapePath(el.mask, el.w, el.h) : shapePath("rect", el.w, el.h, el.radius));
    if (el.shadow.on) {
      c.save();
      applyShadow(c, el);
      c.fillStyle = "#fff";
      c.fill(clip);
      c.restore();
    }
    c.save();
    c.clip(clip);
    if (img) {
      c.save();
      c.filter = filterCss(el);
      c.translate(el.flipX ? el.w : 0, el.flipY ? el.h : 0);
      c.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      drawCover(c, img as HTMLImageElement | HTMLVideoElement, el.w, el.h, el.cropZoom ?? 1, el.cropX ?? 0.5, el.cropY ?? 0.5);
      c.restore();
    }
    c.restore();
    const sw = el.strokeWidth ?? 0;
    if (sw > 0) {
      c.lineWidth = sw;
      c.strokeStyle = el.stroke ?? "#fff";
      c.lineJoin = "round";
      c.stroke(new Path2D(el.mask ? shapePath(el.mask, el.w, el.h, 0, sw / 2) : shapePath("rect", el.w, el.h, el.radius, sw / 2)));
    }
  } else if (el.type === "text") {
    const fx = effectParams(el);
    applyShadow(c, el);
    if (el.effect === "lift") {
      c.shadowColor = `rgba(0,0,0,${fx.liftAlpha})`;
      c.shadowBlur = fx.liftBlur;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = fx.liftY;
    }
    c.font = fontString(el);
    c.fillStyle = el.color ?? "#000";
    c.textBaseline = "middle";
    const ls = el.letterSpacing ?? 0;
    if ("letterSpacing" in c) (c as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
    const lh = (el.fontSize ?? 32) * (el.lineHeight ?? 1.2);
    let remaining = st.chars;
    layoutText(el).forEach((line, i) => {
      let shown = line;
      if (remaining >= 0) {
        shown = line.slice(0, Math.max(0, remaining));
        remaining -= line.length + 1;
      }
      const full = lineWidth(line, el) - ls;
      const x = el.align === "center" ? (el.w - full) / 2 : el.align === "right" ? el.w - full : 0;
      const y = i * lh + lh / 2;
      drawTextLine(c, el, fx, shown, x, y, i * lh, lh);
      if (el.underline && shown) {
        const uw = lineWidth(shown, el) - ls;
        c.fillRect(x, y + (el.fontSize ?? 32) * 0.42, uw, Math.max(1, (el.fontSize ?? 32) * 0.06));
      }
    });
  }
  c.restore();
}

function drawTextLine(
  c: CanvasRenderingContext2D,
  el: El,
  fx: ReturnType<typeof effectParams>,
  text: string,
  x: number,
  y: number,
  top: number,
  lh: number,
) {
  if (!text) return;
  const color = el.color ?? "#000";
  switch (el.effect) {
    case "highlight": {
      const w = lineWidth(text, el) - (el.letterSpacing ?? 0);
      c.save();
      c.shadowColor = "transparent";
      c.fillStyle = fx.color;
      c.beginPath();
      c.roundRect(x - fx.pad, top, w + fx.pad * 2, lh, fx.radius);
      c.fill();
      c.restore();
      c.fillText(text, x, y);
      return;
    }
    case "outline":
      c.save();
      c.lineWidth = fx.outline;
      c.lineJoin = "round";
      c.strokeStyle = fx.color;
      c.strokeText(text, x, y);
      c.restore();
      c.save();
      c.shadowColor = "transparent";
      c.fillText(text, x, y);
      c.restore();
      return;
    case "hollow":
      c.lineWidth = fx.hollow;
      c.lineJoin = "round";
      c.strokeStyle = color;
      c.strokeText(text, x, y);
      return;
    case "neon":
      c.save();
      c.shadowColor = fx.color;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      for (const b of fx.glow) {
        c.shadowBlur = b;
        c.fillText(text, x, y);
      }
      c.restore();
      return;
    case "echo":
      c.save();
      c.shadowColor = "transparent";
      c.fillStyle = fx.color;
      c.globalAlpha *= 0.28;
      c.fillText(text, x + fx.echo * 2, y + fx.echo * 2);
      c.globalAlpha = (c.globalAlpha / 0.28) * 0.55;
      c.fillText(text, x + fx.echo, y + fx.echo);
      c.restore();
      c.fillText(text, x, y);
      return;
    default:
      c.fillText(text, x, y);
  }
}

/** Draw the whole design at time t (or the static design when t is null). */
export function renderDoc(c: CanvasRenderingContext2D, doc: Doc, t: number | null) {
  const { w, h } = doc.frame;
  c.save();
  c.clearRect(0, 0, w, h);
  const span = doc.context?.span;
  if (span) {
    // one background stretched over every carousel slide
    c.save();
    c.translate(-span.offset, 0);
    drawBackground(c, doc.background, span.width, h);
    c.restore();
  } else drawBackground(c, doc.background, w, h);
  // items spilling over from the neighbouring slides sit underneath this slide's own items
  for (const el of doc.context?.neighbours ?? []) drawElement(c, el, t === null ? STATIC : animState(el, t, doc.frame));
  for (const el of doc.elements) {
    drawElement(c, el, t === null ? STATIC : animState(el, t, doc.frame));
  }
  c.restore();
}
