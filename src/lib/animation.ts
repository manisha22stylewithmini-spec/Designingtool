import type { Easing, El, Frame, KeyEase, KeyProp } from "../types";

export interface AnimState {
  visible: boolean;
  opacity: number;
  tx: number;
  ty: number;
  scale: number;
  rotate: number;
  /** 0..1 how much of the element is revealed left→right (wipe). */
  reveal: number;
  /** number of characters to show (typewriter), or -1 for all. */
  chars: number;
}

export const STATIC: AnimState = { visible: true, opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, reveal: 1, chars: -1 };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const outBack = (p: number, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
function outBounce(p: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

export function ease(kind: Easing, p: number): number {
  switch (kind) {
    case "linear":
      return p;
    case "snappy":
      return outExpo(p);
    case "bouncy":
      return outBack(p);
    default:
      return outCubic(p);
  }
}

export function animState(el: El, t: number, frame: Frame): AnimState {
  const a = el.anim;
  if (t < a.start - 1e-6 || t > a.end + 1e-6) return { ...STATIC, visible: false };

  const s: AnimState = { ...STATIC };
  const D = Math.min(frame.w, frame.h) * 0.15;

  // ---- entrance ----
  if (a.inType !== "none" && a.inDur > 0) {
    const p = clamp01((t - a.start) / a.inDur);
    const e = ease(a.easing, p);
    const fadeQuick = clamp01(p * 2);
    switch (a.inType) {
      case "fade":
        s.opacity *= e;
        break;
      case "slideUp":
        s.ty += (1 - e) * D;
        s.opacity *= fadeQuick;
        break;
      case "slideDown":
        s.ty -= (1 - e) * D;
        s.opacity *= fadeQuick;
        break;
      case "slideLeft":
        s.tx += (1 - e) * D;
        s.opacity *= fadeQuick;
        break;
      case "slideRight":
        s.tx -= (1 - e) * D;
        s.opacity *= fadeQuick;
        break;
      case "zoomIn":
        s.scale *= 0.3 + 0.7 * e;
        s.opacity *= clamp01(p * 1.5);
        break;
      case "pop":
        s.scale *= Math.max(0, outBack(p, 2.6));
        s.opacity *= clamp01(p * 4);
        break;
      case "spin":
        s.rotate += (1 - e) * -180;
        s.scale *= 0.4 + 0.6 * e;
        s.opacity *= clamp01(p * 2);
        break;
      case "drop":
        s.ty -= (1 - outBounce(p)) * D * 2;
        s.opacity *= clamp01(p * 5);
        break;
      case "wipe":
        s.reveal = e;
        break;
      case "typewriter":
        s.chars = el.type === "text" ? Math.floor(p * (el.text ?? "").length) : -1;
        if (el.type !== "text") s.opacity *= p;
        break;
    }
  }

  // ---- loop (runs while on screen) ----
  const lt = t - a.start;
  switch (a.loop) {
    case "pulse":
      s.scale *= 1 + 0.06 * Math.sin((lt * 2 * Math.PI) / 1.2);
      break;
    case "float":
      s.ty += Math.sin((lt * 2 * Math.PI) / 2) * D * 0.15;
      break;
    case "wiggle":
      s.rotate += Math.sin((lt * 2 * Math.PI) / 0.8) * 6;
      break;
    case "spin":
      s.rotate += lt * 90;
      break;
    case "blink":
      s.opacity *= 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(lt * 2 * Math.PI));
      break;
  }

  // ---- exit ----
  if (a.outType !== "none" && a.outDur > 0) {
    const q = clamp01((t - (a.end - a.outDur)) / a.outDur);
    if (q > 0) {
      const e = outCubic(q);
      switch (a.outType) {
        case "fade":
          s.opacity *= 1 - e;
          break;
        case "slideUp":
          s.ty -= e * D;
          s.opacity *= 1 - e;
          break;
        case "slideDown":
          s.ty += e * D;
          s.opacity *= 1 - e;
          break;
        case "zoomOut":
          s.scale *= 1 - e * 0.8;
          s.opacity *= 1 - e;
          break;
        case "spin":
          s.rotate += e * 180;
          s.scale *= 1 - e * 0.6;
          s.opacity *= 1 - e;
          break;
      }
    }
  }

  // keyframed scale (position / rotation / opacity are applied by atTime)
  const ks = keyValue(el, "scale", t);
  if (ks) s.scale *= ks[0] / 100;

  return s;
}

export function fmtTime(t: number): string {
  return t.toFixed(1) + "s";
}

/** Where inside a video clip we should be at timeline time t. */
export function clipTime(el: El, t: number) {
  const len = el.videoDuration ?? 0;
  return Math.min(Math.max(0, len - 0.05), (el.trimStart ?? 0) + Math.max(0, t - el.anim.start));
}

// ---------- keyframes (After Effects style) ----------

export const KEY_PROPS: { id: KeyProp; label: string; unit: string }[] = [
  { id: "position", label: "Position", unit: "px" },
  { id: "scale", label: "Scale", unit: "%" },
  { id: "rotation", label: "Rotation", unit: "°" },
  { id: "opacity", label: "Opacity", unit: "%" },
];

export const KEY_EASES: { id: KeyEase; label: string }[] = [
  { id: "ease", label: "Smooth (ease in & out)" },
  { id: "linear", label: "Linear" },
  { id: "easeIn", label: "Ease in (speed up)" },
  { id: "easeOut", label: "Ease out (slow down)" },
  { id: "hold", label: "Hold (jump)" },
];

function keyEase(kind: KeyEase, p: number) {
  switch (kind) {
    case "linear":
      return p;
    case "easeIn":
      return p * p * p;
    case "easeOut":
      return 1 - Math.pow(1 - p, 3);
    case "hold":
      return 0;
    default:
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
}

/** Interpolated value of a keyframed property at time t, or null when it has no keyframes. */
export function keyValue(el: El, prop: KeyProp, t: number): number[] | null {
  const ks = el.keys?.[prop];
  if (!ks?.length) return null;
  if (t <= ks[0].t) return ks[0].v;
  const last = ks[ks.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (t >= a.t && t < b.t) {
      const p = keyEase(a.ease, (t - a.t) / Math.max(1e-6, b.t - a.t));
      return a.v.map((v, j) => v + (b.v[j] - v) * p);
    }
  }
  return last.v;
}

/** The element as it is at time t: keyframed position / rotation / opacity applied. (Scale goes through animState.) */
export function atTime(el: El, t: number): El {
  if (!el.keys) return el;
  const pos = keyValue(el, "position", t);
  const rot = keyValue(el, "rotation", t);
  const op = keyValue(el, "opacity", t);
  if (!pos && !rot && !op) return el;
  return { ...el, ...(pos ? { x: pos[0], y: pos[1] } : {}), ...(rot ? { rotation: rot[0] } : {}), ...(op ? { opacity: op[0] } : {}) };
}

/** Current value of a property (keyframed or not), in the units used by keyframes. */
export function propValue(el: El, prop: KeyProp, t: number): number[] {
  const k = keyValue(el, prop, t);
  if (k) return k;
  if (prop === "position") return [el.x, el.y];
  if (prop === "rotation") return [el.rotation];
  if (prop === "opacity") return [el.opacity];
  return [100];
}

/** Add or replace the keyframe at time t (keeps keyframes sorted). */
export function setKey(el: El, prop: KeyProp, t: number, v: number[]): El {
  const ks = [...(el.keys?.[prop] ?? [])];
  const i = ks.findIndex((k) => Math.abs(k.t - t) < 0.02);
  if (i >= 0) ks[i] = { ...ks[i], v };
  else ks.push({ t: Math.round(t * 100) / 100, v, ease: "ease" });
  ks.sort((a, b) => a.t - b.t);
  return { ...el, keys: { ...el.keys, [prop]: ks } };
}
