import type { Doc, El, Frame } from "../types";
import { bounds } from "./geometry";
import { preloadDoc, renderDoc } from "./render";

/**
 * Copy & paste through the real system clipboard.
 * Copied items travel as HTML (with the design data tucked into a data attribute), as plain text
 * (their words) and as a PNG picture — so they paste back into any design, any tab, or into other apps.
 */

const ATTR = "data-delulu";

export interface ClipPayload {
  v: 1;
  els: El[];
  frame: { w: number; h: number };
}

// last copy kept in memory too — a fallback for browsers that strip the HTML
let memory: { payload: ClipPayload; text: string } | null = null;
export const lastCopy = () => memory;

function toBase64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b: string) {
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

/** Words of the copied items — what you get when pasting into Notes, Slack… */
export function plainText(els: El[]): string {
  const texts = els.filter((e) => e.type === "text" && e.text).map((e) => e.text!);
  return texts.length ? texts.join("\n") : els.map((e) => e.name).join(", ");
}

export function encode(els: El[], frame: Frame): { html: string; text: string } {
  const payload: ClipPayload = { v: 1, els, frame: { w: frame.w, h: frame.h } };
  const text = plainText(els);
  memory = { payload, text };
  return { html: `<meta charset="utf-8"><span ${ATTR}="${toBase64(JSON.stringify(payload))}">${escapeHtml(text)}</span>`, text };
}

export function decode(html: string | undefined | null): ClipPayload | null {
  if (!html) return null;
  const m = html.match(new RegExp(`${ATTR}="([^"]+)"`));
  if (!m) return null;
  try {
    const p = JSON.parse(fromBase64(m[1])) as ClipPayload;
    return p?.v === 1 && Array.isArray(p.els) ? p : null;
  } catch {
    return null;
  }
}

/** The selection drawn as a transparent PNG (for pasting into other apps). */
export async function selectionPng(els: El[]): Promise<Blob> {
  const b = els.map(bounds);
  const left = Math.min(...b.map((x) => x.left));
  const top = Math.min(...b.map((x) => x.top));
  const w = Math.max(1, Math.max(...b.map((x) => x.right)) - left);
  const h = Math.max(1, Math.max(...b.map((x) => x.bottom)) - top);
  const doc: Doc = {
    frame: { platformId: "custom", variantId: "custom", w, h },
    background: { kind: "none" },
    elements: els.map((e) => ({ ...e, x: e.x - left, y: e.y - top })),
    duration: 5,
  };
  await preloadDoc(doc);
  const s = Math.min(2, 2400 / Math.max(w, h)); // crisp, but not huge
  const c = document.createElement("canvas");
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  const g = c.getContext("2d")!;
  g.scale(s, s);
  renderDoc(g, doc, null);
  return new Promise((resolve, reject) => c.toBlob((bl) => (bl ? resolve(bl) : reject(new Error("png"))), "image/png"));
}

export const IMAGE_URL = /^(https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?|data:image\/[a-z+]+;base64,\S+)$/i;

/** First <img src> in pasted HTML (copying an image on a website). */
export function imageFromHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}
