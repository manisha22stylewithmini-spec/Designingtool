import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { resizeElements, uid } from "./lib/factory";
import { textHeight } from "./lib/geometry";
import type { Doc, El, Frame, Mode, Page, PostKind, Project, RulerGuide } from "./types";

const STORAGE_KEY = "postcraft-project-v2";
const OLD_KEY = "postcraft-doc-v1";
const HISTORY_LIMIT = 80;

type Snapshot = { project: Project; cur: number };

function normalizeEls(els: El[]): El[] {
  let changed = false;
  const out = els.map((el) => {
    if (el.type !== "text") return el;
    const h = textHeight(el);
    if (Math.abs(h - el.h) < 0.01) return el;
    changed = true;
    return { ...el, h };
  });
  return changed ? out : els;
}

function normalize(doc: Doc): Doc {
  const elements = normalizeEls(doc.elements);
  return elements === doc.elements ? doc : { ...doc, elements };
}

const isCarousel = (p: Project) => (p.kind ?? (p.pages.length > 1 ? "carousel" : "static")) === "carousel";

/** Size of one page: carousels share one size, static designs can each have their own. */
export const frameOf = (p: Project, i: number): Frame => (isCarousel(p) ? p.frame : (p.pages[i]?.frame ?? p.frame));

/** Everything needed to edit / draw page i, including what spills over from neighbouring slides. */
export function docOf(p: Project, cur: number): Doc {
  const i = Math.min(cur, p.pages.length - 1);
  const page = p.pages[i];
  const frame = frameOf(p, i);
  const doc: Doc = { frame, background: page.background, elements: page.elements, duration: page.duration, audio: page.audio };
  if (isCarousel(p) && p.pages.length > 1) {
    const w = p.frame.w;
    const neighbours = p.pages.flatMap((pg, j) =>
      j === i ? [] : pg.elements.filter((e) => !e.hidden).map((e) => ({ ...e, x: e.x + (j - i) * w })),
    );
    doc.context = {
      neighbours: neighbours.filter((e) => e.x < w && e.x + e.w > 0),
      span: p.spanBackground ? { offset: i * w, width: p.pages.length * w } : undefined,
    };
  }
  return doc;
}

export const pageFromDoc = (d: Doc, id = uid(), base?: Page): Page => ({
  ...base,
  id,
  background: d.background,
  elements: d.elements,
  duration: d.duration,
  audio: d.audio,
});

// ---------- workspace view preferences (per browser, not part of the design) ----------
export interface ViewPrefs {
  free: boolean; // unfixed: Figma-style board with every design visible
  grid: boolean;
  gridSize: number;
  snapGrid: boolean;
  smartGuides: boolean;
  rulers: boolean;
  margins: boolean;
  marginPct: number;
  safe: boolean;
  pixel: boolean;
  boardGap: number; // Free board: space between static designs, % of the largest frame side
}
const PREFS_KEY = "postcraft-view-v1";
const DEFAULT_PREFS: ViewPrefs = {
  free: false,
  grid: false,
  gridSize: 40,
  snapGrid: false,
  smartGuides: true,
  rulers: false,
  margins: false,
  marginPct: 6,
  safe: true,
  pixel: false,
  boardGap: 12,
};
function loadPrefs(): ViewPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

const WHITE = { kind: "solid", color: "#ffffff" } as const;

/** An empty page whose background was never chosen shows white (it may have been copied from another page). */
function whitenEmptyPages(p: Project): Project {
  if (p.spanBackground && isCarousel(p)) return p;
  return { ...p, pages: p.pages.map((pg) => (pg.elements.length || pg.customBg ? pg : { ...pg, background: { ...WHITE } })) };
}

export function loadSavedProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return whitenEmptyPages(JSON.parse(raw) as Project);
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const d = JSON.parse(old) as Doc;
      return { frame: d.frame, pages: [pageFromDoc(d)] };
    }
  } catch {
    /* ignore broken save */
  }
  return null;
}

export function useEditorState(initial: Project | null) {
  const [project, setProject] = useState<Project | null>(initial);
  const [cur, setCur] = useState(0);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, setHistVersion] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("design");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** Photo / video currently being cropped (pan & zoom inside its box). */
  const [cropId, setCropId] = useState<string | null>(null);

  const projRef = useRef(project);
  const curRef = useRef(cur);

  const commit = useCallback((p: Project, c: number) => {
    projRef.current = p;
    curRef.current = c;
    setProject(p);
    setCur(c);
  }, []);

  const notify = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);

  const pushHistory = useCallback(() => {
    if (!projRef.current) return;
    past.current = [...past.current.slice(-HISTORY_LIMIT), { project: projRef.current, cur: curRef.current }];
    future.current = [];
    setHistVersion((v) => v + 1);
  }, []);

  /** Save current state to history before a continuous change (dragging, sliders). */
  const checkpoint = pushHistory;

  /** Change the current slide. */
  const update = useCallback(
    (fn: (d: Doc) => Doc, history = true) => {
      const p = projRef.current;
      if (!p) return;
      const c = curRef.current;
      const before = docOf(p, c);
      const next = normalize(fn(before));
      if (next === before) return;
      if (history) pushHistory();
      const ownFrame = !isCarousel(p) && !!p.pages[c].frame;
      const bgChanged = next.background !== before.background;
      let pages = p.pages.map((pg, i) =>
        i === c
          ? { ...pageFromDoc(next, pg.id, pg), ...(ownFrame ? { frame: next.frame } : {}), ...(bgChanged ? { customBg: true } : {}) }
          : pg,
      );
      // a background stretched across the carousel is shared by every slide
      if (p.spanBackground && isCarousel(p) && bgChanged) pages = pages.map((pg) => ({ ...pg, background: next.background, customBg: true }));
      commit({ ...p, frame: ownFrame ? p.frame : next.frame, pages }, c);
    },
    [pushHistory, commit],
  );

  /** Replace the current slide (templates). */
  const setDoc = useCallback(
    (d: Doc) => {
      update(() => ({ ...d }));
      setSelected([]);
    },
    [update],
  );

  /** Start over with a fresh project. */
  const newProject = useCallback(
    (d: Doc, kind: PostKind = "static") => {
      pushHistory();
      commit({ frame: d.frame, pages: [pageFromDoc(normalize(d))], kind }, 0);
      setSelected([]);
      setTime(0);
    },
    [pushHistory, commit],
  );

  /**
   * Change the size. "page" resizes only the current static design (each design can differ);
   * "all" resizes every page — carousels always use "all" so slides stay connected.
   */
  const setFrame = useCallback(
    (frame: Frame, scope: "page" | "all" = "all") => {
      const p = projRef.current;
      if (!p) return;
      pushHistory();
      const c = curRef.current;
      if (scope === "page" && !isCarousel(p)) {
        const pages = p.pages.map((pg, i) => (i === c ? { ...resizeElements(pg, frameOf(p, i), frame), frame } : pg));
        commit({ ...p, pages }, c);
        return;
      }
      const pages = p.pages.map((pg, i) => {
        const { frame: _own, ...rest } = resizeElements(pg, frameOf(p, i), frame);
        void _own;
        return rest;
      });
      commit({ ...p, frame, pages }, c);
    },
    [pushHistory, commit],
  );

  /** Move an element onto another page (dragging between designs / slides on the board). */
  const moveToPage = useCallback(
    (id: string, to: number, x: number, y: number) => {
      const p = projRef.current;
      if (!p) return;
      const from = curRef.current;
      const el = p.pages[from].elements.find((e) => e.id === id);
      if (!el || to === from || !p.pages[to]) return;
      const pages = p.pages.map((pg, i) =>
        i === from
          ? { ...pg, elements: pg.elements.filter((e) => e.id !== id) }
          : i === to
            ? { ...pg, elements: [...pg.elements, { ...el, x, y }] }
            : pg,
      );
      commit({ ...p, pages }, to);
      setSelected([id]);
    },
    [commit],
  );

  const setSpanBackground = useCallback(
    (on: boolean) => {
      const p = projRef.current;
      if (!p) return;
      pushHistory();
      const bg = p.pages[curRef.current].background;
      commit({ ...p, spanBackground: on, pages: on ? p.pages.map((pg) => ({ ...pg, background: bg, customBg: true })) : p.pages }, curRef.current);
    },
    [pushHistory, commit],
  );

  const setGuides = useCallback(
    (guides: RulerGuide[], history = true) => {
      const p = projRef.current;
      if (!p) return;
      if (history) pushHistory();
      commit({ ...p, guides }, curRef.current);
    },
    [pushHistory, commit],
  );

  const renamePage = useCallback(
    (i: number, name: string) => {
      const p = projRef.current;
      if (!p) return;
      commit({ ...p, pages: p.pages.map((pg, j) => (j === i ? { ...pg, name } : pg)) }, curRef.current);
    },
    [commit],
  );

  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
  const setPref = useCallback(<K extends keyof ViewPrefs>(k: K, v: ViewPrefs[K]) => {
    setPrefs((cur) => {
      const next = { ...cur, [k]: v };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setKind = useCallback(
    (kind: PostKind) => {
      const p = projRef.current;
      if (p) commit({ ...p, kind }, curRef.current);
    },
    [commit],
  );

  // ---------- carousel slides ----------
  const goToPage = useCallback(
    (i: number) => {
      const p = projRef.current;
      if (!p || i === curRef.current) return;
      curRef.current = Math.max(0, Math.min(p.pages.length - 1, i));
      setCur(curRef.current);
      setSelected([]);
      setTime(0);
      setPlaying(false);
    },
    [],
  );

  const addPage = useCallback(
    (duplicate: boolean) => {
      const p = projRef.current;
      if (!p) return;
      pushHistory();
      const src = p.pages[curRef.current];
      const page: Page = duplicate
        ? { ...src, id: uid(), name: undefined, elements: src.elements.map((e) => ({ ...e, id: uid() })) }
        : {
            id: uid(),
            frame: src.frame,
            // a blank page starts white — unless one background is stretched across the whole carousel
            background: p.spanBackground && isCarousel(p) ? src.background : { ...WHITE },
            elements: [],
            duration: src.duration,
          };
      const pages = [...p.pages];
      pages.splice(curRef.current + 1, 0, page);
      commit({ ...p, pages }, curRef.current + 1);
      setSelected([]);
      setTime(0);
    },
    [pushHistory, commit],
  );

  const deletePage = useCallback(
    (i: number) => {
      const p = projRef.current;
      if (!p || p.pages.length < 2) return;
      pushHistory();
      const pages = p.pages.filter((_, j) => j !== i);
      commit({ ...p, pages }, Math.min(curRef.current >= i ? Math.max(0, curRef.current - 1) : curRef.current, pages.length - 1));
      setSelected([]);
    },
    [pushHistory, commit],
  );

  const movePage = useCallback(
    (from: number, to: number) => {
      const p = projRef.current;
      if (!p || from === to || to < 0 || to >= p.pages.length) return;
      pushHistory();
      const pages = [...p.pages];
      const [pg] = pages.splice(from, 1);
      pages.splice(to, 0, pg);
      commit({ ...p, pages }, to);
    },
    [pushHistory, commit],
  );

  const updateEls = useCallback(
    (ids: string[], patch: Partial<El> | ((el: El) => Partial<El>), history = true) => {
      update(
        (d) => ({
          ...d,
          elements: d.elements.map((el) =>
            ids.includes(el.id) ? { ...el, ...(typeof patch === "function" ? patch(el) : patch) } : el,
          ),
        }),
        history,
      );
    },
    [update],
  );

  const undo = useCallback(() => {
    if (!past.current.length || !projRef.current) return;
    const prev = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [{ project: projRef.current, cur: curRef.current }, ...future.current];
    commit(prev.project, Math.min(prev.cur, prev.project.pages.length - 1));
    setHistVersion((v) => v + 1);
  }, [commit]);

  const redo = useCallback(() => {
    if (!future.current.length || !projRef.current) return;
    const next = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current, { project: projRef.current, cur: curRef.current }];
    commit(next.project, Math.min(next.cur, next.project.pages.length - 1));
    setHistVersion((v) => v + 1);
  }, [commit]);

  // Re-measure text once web fonts finish loading so wrapping is accurate.
  useEffect(() => {
    const refresh = () => {
      const p = projRef.current;
      if (!p) return;
      commit({ ...p, pages: p.pages.map((pg) => ({ ...pg, elements: normalizeEls(pg.elements) })) }, curRef.current);
    };
    document.fonts.ready.then(refresh);
    document.fonts.addEventListener("loadingdone", refresh);
    return () => document.fonts.removeEventListener("loadingdone", refresh);
  }, [commit]);

  // Autosave
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        /* storage full (large photos) – ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [project]);

  const doc = useMemo(() => (project ? docOf(project, cur) : null), [project, cur]);
  const kind: PostKind = project?.kind ?? (project && project.pages.length > 1 ? "carousel" : "static");

  const selectedEls = useMemo(
    () => (doc ? doc.elements.filter((e) => selected.includes(e.id)) : []),
    [doc, selected],
  );

  return {
    project,
    doc,
    kind,
    setKind,
    moveToPage,
    setSpanBackground,
    setGuides,
    renamePage,
    prefs,
    setPref,
    page: cur,
    goToPage,
    addPage,
    deletePage,
    movePage,
    setDoc,
    newProject,
    setFrame,
    update,
    updateEls,
    checkpoint,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    selected,
    setSelected,
    selectedEls,
    mode,
    setMode,
    time,
    setTime,
    playing,
    setPlaying,
    toast,
    notify,
    hint,
    setHint,
    cropId: cropId && selected.includes(cropId) ? cropId : null,
    setCropId,
  };
}

export type Editor = ReturnType<typeof useEditorState> & { doc: Doc; project: Project };

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const e = useContext(EditorContext);
  if (!e) throw new Error("EditorContext missing");
  return e;
}
