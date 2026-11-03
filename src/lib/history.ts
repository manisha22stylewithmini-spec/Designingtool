import type { El, Project } from "../types";

/** One step of undo history. */
export interface Snapshot {
  project: Project;
  cur: number;
  at: number; // when this state was reached (ms)
}

// ---------- saving history in the browser (IndexedDB) ----------
// Every step is a full copy of the design, so big photos (data URLs) would be stored
// again and again. Long strings are kept once in a table and referenced from each step.

const DB = "postcraft-history";
const STORE = "history";
const KEY = "current";
const REF = "§ref:";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pack(value: unknown, table: string[], index: Map<string, number>): unknown {
  if (typeof value === "string") {
    if (value.length < 2000) return value;
    let i = index.get(value);
    if (i === undefined) {
      i = table.length;
      table.push(value);
      index.set(value, i);
    }
    return REF + i;
  }
  if (Array.isArray(value)) return value.map((v) => pack(v, table, index));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = pack(v, table, index);
    return out;
  }
  return value;
}

function unpack(value: unknown, table: string[]): unknown {
  if (typeof value === "string") return value.startsWith(REF) ? table[Number(value.slice(REF.length))] : value;
  if (Array.isArray(value)) return value.map((v) => unpack(v, table));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = unpack(v, table);
    return out;
  }
  return value;
}

export async function saveHistory(past: Snapshot[], future: Snapshot[], currentAt: number): Promise<void> {
  const table: string[] = [];
  const data = pack({ past, future, currentAt }, table, new Map());
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ data, table, savedAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode / quota — history just isn't kept */
  }
}

export async function loadHistory(): Promise<{ past: Snapshot[]; future: Snapshot[]; currentAt: number } | null> {
  try {
    const db = await open();
    const raw = await new Promise<{ data: unknown; table: string[] } | undefined>((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (!raw) return null;
    return unpack(raw.data, raw.table) as { past: Snapshot[]; future: Snapshot[]; currentAt: number };
  } catch {
    return null;
  }
}

export async function clearSavedHistory(): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
  } catch {
    /* ignore */
  }
}

// ---------- describing what changed between two steps ----------

const nameOf = (e: El) => (e.type === "text" ? `“${(e.text ?? "").split("\n")[0].slice(0, 22)}”` : e.name);

function changedKeys(a: El, b: El): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k as keyof El]) !== JSON.stringify(b[k as keyof El]));
}

export function describeChange(a: Snapshot, b: Snapshot): { label: string; icon: string } {
  const pa = a.project;
  const pb = b.project;
  if (pb.pages.length > pa.pages.length) return { label: `Added ${pb.kind === "carousel" ? "slide" : "design"}`, icon: "＋" };
  if (pb.pages.length < pa.pages.length) return { label: `Deleted ${pb.kind === "carousel" ? "slide" : "design"}`, icon: "🗑" };
  if (pa.pages.map((p) => p.id).join() !== pb.pages.map((p) => p.id).join()) return { label: "Reordered pages", icon: "⇄" };
  if (JSON.stringify(pa.frame) !== JSON.stringify(pb.frame)) return { label: `Resized to ${pb.frame.w}×${pb.frame.h}`, icon: "⤢" };
  if (JSON.stringify(pa.guides) !== JSON.stringify(pb.guides)) return { label: "Moved guides", icon: "┼" };
  if (pa.spanBackground !== pb.spanBackground) return { label: "Stretched background", icon: "▭" };

  // compare contents, not object identity (steps loaded from storage are fresh objects)
  const same = (x: unknown, y: unknown) => x === y || JSON.stringify(x) === JSON.stringify(y);
  const i = Math.max(0, pb.pages.findIndex((p, j) => !same(p, pa.pages[j])));
  const A = pa.pages[i];
  const B = pb.pages[i];
  if (!A || !B) return { label: "Edited", icon: "✎" };
  if (!same(A.frame, B.frame)) return { label: `Resized design ${i + 1}`, icon: "⤢" };
  if (!same(A.background, B.background)) return { label: "Changed background", icon: "🎨" };
  if (!same(A.audio, B.audio)) return { label: B.audio ? (A.audio ? "Adjusted music" : "Added music") : "Removed music", icon: "♪" };
  if (A.duration !== B.duration) return { label: `Video length ${B.duration}s`, icon: "⏱" };

  const ida = new Map(A.elements.map((e) => [e.id, e]));
  const idb = new Map(B.elements.map((e) => [e.id, e]));
  const added = B.elements.filter((e) => !ida.has(e.id));
  const removed = A.elements.filter((e) => !idb.has(e.id));
  // "Use as mask" removes the shape and gives the photo a mask
  const masked = B.elements.find((e) => e.maskNodes && !same(e.maskNodes, ida.get(e.id)?.maskNodes));
  if (masked && removed.length === 1) return { label: `Masked ${nameOf(masked)}`, icon: "◐" };
  if (added.length) return { label: added.length > 1 ? `Added ${added.length} items` : `Added ${nameOf(added[0])}`, icon: "＋" };
  if (removed.length) return { label: removed.length > 1 ? `Deleted ${removed.length} items` : `Deleted ${nameOf(removed[0])}`, icon: "🗑" };
  if (A.elements.map((e) => e.id).join() !== B.elements.map((e) => e.id).join()) return { label: "Changed layer order", icon: "☰" };

  const changed = B.elements.filter((e) => !same(ida.get(e.id), e));
  if (!changed.length) return { label: "Edited", icon: "✎" };
  const el = changed[0];
  const ks = changedKeys(ida.get(el.id)!, el);
  const who = changed.length > 1 ? `${changed.length} items` : nameOf(el);
  const has = (...k: string[]) => ks.some((x) => k.includes(x));
  if (has("keys")) return { label: `Keyframes · ${who}`, icon: "◆" };
  if (has("text")) return { label: `Typed ${nameOf(el)}`, icon: "T" };
  if (has("nodes")) return { label: `Edited path · ${who}`, icon: "✒" };
  if (has("maskNodes", "mask")) return { label: `Masked ${who}`, icon: "◐" };
  if (has("cropX", "cropY", "cropZoom")) return { label: `Cropped ${who}`, icon: "✂" };
  if (has("w", "h", "fontSize")) return { label: `Resized ${who}`, icon: "⤡" };
  if (has("x", "y") && ks.every((k) => k === "x" || k === "y")) return { label: `Moved ${who}`, icon: "✥" };
  if (has("rotation")) return { label: `Rotated ${who}`, icon: "⟳" };
  if (has("anim")) return { label: `Animation · ${who}`, icon: "✦" };
  if (has("fill", "color", "stroke", "effectColor")) return { label: `Recoloured ${who}`, icon: "🎨" };
  if (has("fontFamily", "fontWeight", "effect", "textCase", "italic", "letterSpacing", "lineHeight")) return { label: `Styled ${who}`, icon: "Aa" };
  if (has("brightness", "contrast", "saturation", "grayscale", "blur")) return { label: `Filter · ${who}`, icon: "◑" };
  if (has("locked")) return { label: `${el.locked ? "Locked" : "Unlocked"} ${who}`, icon: "🔒" };
  if (has("hidden")) return { label: `${el.hidden ? "Hid" : "Showed"} ${who}`, icon: "👁" };
  if (has("opacity")) return { label: `Opacity · ${who}`, icon: "◌" };
  return { label: `Edited ${who}`, icon: "✎" };
}

export function timeAgo(at: number): string {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(at).toLocaleDateString();
}
