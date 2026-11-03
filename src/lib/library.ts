import type { PostKind, Project } from "../types";
import { uid } from "./factory";
import { loadHistory, saveHistory, clearSavedHistory } from "./history";

/**
 * The library: brands → creatives (each creative is one saved design with a date, platform and type).
 * Everything lives in this browser's IndexedDB.
 */

export interface BrandLogo {
  id: string;
  src: string; // data URL
  name: string;
}

export interface Brand {
  id: string;
  name: string;
  color: string; // card colour
  logos: BrandLogo[];
  colors: string[];
  fonts: string[];
  createdAt: number;
}

export interface CreativeMeta {
  id: string;
  brandId: string;
  name: string;
  date: string; // YYYY-MM-DD — the day the post is for
  platformId: string;
  variantId: string;
  kind: PostKind;
  w: number;
  h: number;
  pages: number;
  thumb?: string; // small JPEG data URL
  createdAt: number;
  updatedAt: number;
}

const LEGACY_DB = "postcraft-library";
let migrating: Promise<void> | null = null;
/** Each account has its own library in this browser. */
let DB = LEGACY_DB;
type StoreName = "brands" | "creatives" | "projects";

let dbp: Promise<IDBDatabase> | null = null;
function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("brands", { keyPath: "id" });
      db.createObjectStore("creatives", { keyPath: "id" });
      db.createObjectStore("projects");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function open(): Promise<IDBDatabase> {
  dbp ??= openDb(DB);
  return dbp;
}

const CLAIM_KEY = "postcraft-library-claimed-by";

/**
 * Switch to the library of the signed-in account. The first account to sign in on this browser
 * takes over the designs that were made before accounts existed.
 */
export async function switchAccountLibrary(uid: string): Promise<void> {
  const name = uid === "local" ? LEGACY_DB : `${LEGACY_DB}-${uid}`;
  if (name === DB && dbp) return;
  DB = name;
  dbp = null;
  migrating = null;
  if (uid === "local") return;
  let claimed: string | null = null;
  try {
    claimed = localStorage.getItem(CLAIM_KEY);
  } catch {
    /* ignore */
  }
  if (claimed) return;
  try {
    localStorage.setItem(CLAIM_KEY, uid);
  } catch {
    /* ignore */
  }
  // copy everything from the old shared library into this account's library
  const legacy = await openDb(LEGACY_DB);
  const read = <T>(store: StoreName) =>
    new Promise<{ key: IDBValidKey; value: T }[]>((resolve) => {
      const out: { key: IDBValidKey; value: T }[] = [];
      const req = legacy.transaction(store).objectStore(store).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        out.push({ key: c.key, value: c.value as T });
        c.continue();
      };
      req.onerror = () => resolve(out);
    });
  const [brands, creatives, projects] = await Promise.all([read<Brand>("brands"), read<CreativeMeta>("creatives"), read<Project>("projects")]);
  legacy.close();
  for (const b of brands) await putItem("brands", b.value);
  for (const c of creatives) await putItem("creatives", c.value);
  for (const p of projects) await putProject(String(p.key), p.value);
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
        t.onerror = () => reject(t.error);
      }),
  );
}

export const getAll = <T>(store: "brands" | "creatives") => tx<T[]>(store, "readonly", (s) => s.getAll());
export const putItem = (store: "brands" | "creatives", v: Brand | CreativeMeta) => tx(store, "readwrite", (s) => void s.put(v));
export const deleteItem = (store: StoreName, id: string) => tx(store, "readwrite", (s) => void s.delete(id));
export const getProject = (id: string) => tx<Project | undefined>("projects", "readonly", (s) => s.get(id));
export const putProject = (id: string, p: Project) => tx("projects", "readwrite", (s) => void s.put(p, id));

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const BRAND_COLORS = ["#7c3aed", "#db2777", "#ea580c", "#0891b2", "#16a34a", "#2563eb", "#0f172a", "#ca8a04"];

export function newBrand(name: string, i = 0): Brand {
  return { id: uid(), name, color: BRAND_COLORS[i % BRAND_COLORS.length], logos: [], colors: [], fonts: [], createdAt: Date.now() };
}

export function metaFromProject(base: Omit<CreativeMeta, "platformId" | "variantId" | "kind" | "w" | "h" | "pages">, p: Project): CreativeMeta {
  return {
    ...base,
    platformId: p.frame.platformId,
    variantId: p.frame.variantId,
    w: p.frame.w,
    h: p.frame.h,
    kind: p.kind ?? (p.pages.length > 1 ? "carousel" : "static"),
    pages: p.pages.length,
  };
}

/** First run after the library was added: move the single saved design into a starter brand. */
export function migrateOldDesign(): Promise<void> {
  // only ever once per page load (React may start effects twice)
  migrating ??= runMigration();
  return migrating;
}

async function runMigration(): Promise<void> {
  const brands = await getAll<Brand>("brands");
  if (brands.length) return;
  const brand = newBrand("My brand");
  await putItem("brands", brand);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("postcraft-project-v2");
  } catch {
    /* ignore */
  }
  if (!raw) return;
  const project = JSON.parse(raw) as Project;
  const id = uid();
  const now = Date.now();
  await putProject(id, project);
  await putItem("creatives", metaFromProject({ id, brandId: brand.id, name: "My first design", date: todayISO(), createdAt: now, updatedAt: now }, project));
  // keep its undo history too
  const h = await loadHistory("current");
  if (h) {
    await saveHistory(id, h.past, h.future, h.currentAt);
    await clearSavedHistory("current");
  }
  try {
    localStorage.setItem("postcraft-project-v2-backup", raw);
    localStorage.removeItem("postcraft-project-v2");
  } catch {
    /* ignore */
  }
}

// ---------- dates ----------

export const parseISO = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

export function formatDay(d: string, style: "long" | "short" = "long") {
  return parseISO(d).toLocaleDateString(undefined, style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" });
}

export function relativeDay(d: string) {
  const diff = Math.round((parseISO(d).getTime() - parseISO(todayISO()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}
