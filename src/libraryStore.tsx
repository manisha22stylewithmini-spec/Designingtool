import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { uid } from "./lib/factory";
import { clearSavedHistory, loadHistory, saveHistory } from "./lib/history";
import {
  deleteItem,
  getAll,
  getProject,
  metaFromProject,
  migrateOldDesign,
  newBrand,
  putItem,
  putProject,
  type Brand,
  type CreativeMeta,
} from "./lib/library";
import { preloadDoc, renderDoc } from "./lib/render";
import { docOf } from "./store";
import type { Project } from "./types";

// ---------- route (kept in the address bar so the browser's Back button works) ----------

export interface Route {
  /** top-level page: home dashboard, templates gallery, or (default) the library */
  view?: "home" | "templates";
  brandId?: string;
  date?: string;
  platform?: string;
  kind?: string;
  edit?: string; // creative id open in the editor
}

export function parseHash(h = location.hash): Route {
  const parts = h.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { view: "home" };
  if (parts[0] === "templates") return { view: "templates" };
  if (parts[0] === "library") parts.shift();
  const r: Route = {};
  for (let i = 0; i < parts.length; i += 2) {
    const v = parts[i + 1];
    if (!v) break;
    if (parts[i] === "b") r.brandId = v;
    else if (parts[i] === "d") r.date = v;
    else if (parts[i] === "p") r.platform = v;
    else if (parts[i] === "k") r.kind = v;
    else if (parts[i] === "edit") r.edit = v;
  }
  return r;
}

export function toHash(r: Route): string {
  if (r.edit) return `#/edit/${encodeURIComponent(r.edit)}`;
  if (r.view === "home") return "#/";
  if (r.view === "templates") return "#/templates";
  let h = "#/library/";
  if (r.brandId) h += `b/${encodeURIComponent(r.brandId)}/`;
  if (r.brandId && r.date) h += `d/${r.date}/`;
  if (r.brandId && r.date && r.platform) h += `p/${encodeURIComponent(r.platform)}/`;
  if (r.brandId && r.date && r.platform && r.kind) h += `k/${r.kind}/`;
  return h;
}

// ---------- thumbnails ----------

async function makeThumb(p: Project): Promise<string | undefined> {
  try {
    const d = docOf(p, 0);
    await preloadDoc(d);
    const s = 360 / Math.max(d.frame.w, d.frame.h);
    const c = document.createElement("canvas");
    c.width = Math.round(d.frame.w * s);
    c.height = Math.round(d.frame.h * s);
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.scale(s, s);
    renderDoc(g, d, null);
    return c.toDataURL("image/jpeg", 0.78);
  } catch {
    return undefined; // e.g. a photo that blocks canvas export
  }
}

// ---------- state ----------

export interface NewCreative {
  brandId: string;
  date: string;
  name: string;
  project: Project;
}

export function useLibraryState() {
  const [ready, setReady] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [creatives, setCreativesState] = useState<CreativeMeta[]>([]);
  // live copy so saves never read stale state
  const cref = useRef<CreativeMeta[]>([]);
  const setCreatives = useCallback((next: CreativeMeta[] | ((all: CreativeMeta[]) => CreativeMeta[])) => {
    cref.current = typeof next === "function" ? next(cref.current) : next;
    setCreativesState(cref.current);
  }, []);
  const patchCreative = useCallback(
    (id: string, fn: (c: CreativeMeta) => CreativeMeta) => {
      const c = cref.current.find((x) => x.id === id);
      if (!c) return;
      const next = fn(c);
      setCreatives(cref.current.map((x) => (x.id === id ? next : x)));
      putItem("creatives", next);
    },
    [setCreatives],
  );
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    (async () => {
      await migrateOldDesign();
      const [b, c] = await Promise.all([getAll<Brand>("brands"), getAll<CreativeMeta>("creatives")]);
      setBrands(b.sort((x, y) => x.createdAt - y.createdAt));
      setCreatives(c);
      setReady(true);
      // fill in any missing thumbnails (e.g. a design moved over from before the library existed)
      for (const m of c.filter((x) => !x.thumb)) {
        const p = await getProject(m.id);
        const thumb = p && (await makeThumb(p));
        if (thumb) patchCreative(m.id, (x) => ({ ...x, thumb }));
      }
    })();
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = useCallback((r: Route) => {
    const h = toHash(r);
    if (location.hash !== h) location.hash = h;
    else setRoute(r);
  }, []);

  const saveBrand = useCallback(async (b: Brand) => {
    await putItem("brands", b);
    setBrands((all) => (all.some((x) => x.id === b.id) ? all.map((x) => (x.id === b.id ? b : x)) : [...all, b]));
  }, []);

  const addBrand = useCallback(
    async (name: string) => {
      const b = newBrand(name, brands.length);
      await saveBrand(b);
      return b;
    },
    [brands.length, saveBrand],
  );

  const deleteCreative = useCallback(
    async (id: string) => {
      await Promise.all([deleteItem("creatives", id), deleteItem("projects", id), clearSavedHistory(id)]);
      setCreatives((all) => all.filter((c) => c.id !== id));
    },
    [setCreatives],
  );

  const deleteBrand = useCallback(
    async (id: string) => {
      for (const c of creatives.filter((x) => x.brandId === id)) await deleteCreative(c.id);
      await deleteItem("brands", id);
      setBrands((all) => all.filter((b) => b.id !== id));
    },
    [creatives, deleteCreative],
  );

  const updateCreative = useCallback((id: string, patch: Partial<CreativeMeta>) => patchCreative(id, (c) => ({ ...c, ...patch })), [patchCreative]);

  const createCreative = useCallback(async (n: NewCreative) => {
    const id = uid();
    const now = Date.now();
    await putProject(id, n.project);
    const meta = metaFromProject({ id, brandId: n.brandId, name: n.name, date: n.date, createdAt: now, updatedAt: now }, n.project);
    meta.thumb = await makeThumb(n.project);
    await putItem("creatives", meta);
    setCreatives((all) => [...all, meta]);
    return id;
  }, [setCreatives]);

  const duplicateCreative = useCallback(
    async (id: string) => {
      const src = creatives.find((c) => c.id === id);
      const p = await getProject(id);
      if (!src || !p) return;
      const copy = await createCreative({ brandId: src.brandId, date: src.date, name: src.name + " copy", project: p });
      const h = await loadHistory(id);
      if (h) await saveHistory(copy, h.past, h.future, h.currentAt);
      return copy;
    },
    [creatives, createCreative],
  );

  // Saving from the editor: design + details right away, thumbnail a little later.
  const thumbTimer = useRef<Record<string, number>>({});
  const saveProject = useCallback((id: string, p: Project) => {
    putProject(id, p);
    patchCreative(id, (c) => ({ ...metaFromProject(c, p), updatedAt: Date.now() }));
    clearTimeout(thumbTimer.current[id]);
    thumbTimer.current[id] = window.setTimeout(async () => {
      const thumb = await makeThumb(p);
      if (thumb) patchCreative(id, (c) => ({ ...c, thumb }));
    }, 1500);
  }, [patchCreative]);

  return {
    ready,
    brands,
    creatives,
    route,
    go,
    saveBrand,
    addBrand,
    deleteBrand,
    createCreative,
    updateCreative,
    deleteCreative,
    duplicateCreative,
    saveProject,
  };
}

export type Library = ReturnType<typeof useLibraryState>;
export const LibraryContext = createContext<Library | null>(null);
export function useLibrary(): Library {
  const l = useContext(LibraryContext);
  if (!l) throw new Error("LibraryContext missing");
  return l;
}

/** The brand of the creative open in the editor (or of the brand page), if any — safe outside the library. */
export function useCurrentBrand() {
  const lib = useContext(LibraryContext);
  if (!lib) return undefined;
  const id = lib.route.edit ? lib.creatives.find((c) => c.id === lib.route.edit)?.brandId : lib.route.brandId;
  return lib.brands.find((b) => b.id === id);
}
