import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronsLeft, FiChevronsRight } from "react-icons/fi";
import { AnimationPanel } from "./components/AnimationPanel";
import { ExportModal } from "./components/ExportModal";
import { LeftPanel, type LeftTab } from "./components/LeftPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Stage } from "./components/Stage";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import { isMotion } from "./data/postKinds";
import { useActions } from "./components/useActions";
import { useClipboard } from "./components/useClipboard";
import { ensureFont } from "./data/fonts";
import { EditorContext, prepareProject, useEditor, useEditorState, type Editor } from "./store";
import { LibraryContext, useLibrary, useLibraryState } from "./libraryStore";
import { LibraryScreen, NewCreativeDialog } from "./components/library/LibraryScreen";
import { EditorCrumbs } from "./components/library/EditorCrumbs";
import { getProject, switchAccountLibrary } from "./lib/library";
import { watchUser, type User } from "./lib/auth";
import { UserContext } from "./userContext";
import { CreatorLink } from "./components/CreatorLink";
import { AuthScreen } from "./components/home/AuthScreen";
import { AppShell } from "./components/home/AppShell";
import { HomeScreen } from "./components/home/HomeScreen";
import { TemplatesScreen } from "./components/home/TemplatesScreen";
import { PageStrip } from "./components/PageStrip";
import { restoreMedia } from "./lib/media";
import type { PostKind, Project } from "./types";



const Splash = ({ text }: { text: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-50 text-sm text-zinc-500">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
    {text}
  </div>
);

export default function App() {
  // undefined = still checking who is signed in
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [libFor, setLibFor] = useState<string | null>(null);
  useEffect(() => watchUser(setUser), []);
  useEffect(() => {
    if (!user) return setLibFor(null);
    switchAccountLibrary(user.uid).then(() => setLibFor(user.uid));
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined) return <Splash text="Starting Delulu Craft…" />;
  if (!user) return <AuthScreen />;
  if (libFor !== user.uid) return <Splash text="Opening your library…" />;
  return (
    <UserContext.Provider value={user}>
      <Signedin key={user.uid} />
    </UserContext.Provider>
  );
}

function Signedin() {
  const lib = useLibraryState();
  if (!lib.ready) return <Splash text="Opening your library…" />;
  const r = lib.route;
  return (
    <LibraryContext.Provider value={lib}>
      {r.edit ? (
        <EditorHost key={r.edit} id={r.edit} />
      ) : (
        <AppShell active={r.view ?? "library"}>{r.view === "home" ? <HomeScreen /> : r.view === "templates" ? <TemplatesScreen /> : <LibraryScreen />}</AppShell>
      )}
    </LibraryContext.Provider>
  );
}

/** Loads one creative from the library, then opens the editor on it. */
function EditorHost({ id }: { id: string }) {
  const lib = useLibrary();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  useEffect(() => {
    getProject(id).then(async (p) => {
      if (!p) return setProject(null);
      // uploaded videos / music live in IndexedDB — load them first
      await restoreMedia([...p.pages.flatMap((pg) => [...pg.elements.map((e) => e.src ?? ""), pg.audio?.src ?? ""])]);
      setProject(prepareProject(p));
    });
  }, [id]);
  if (project === undefined) return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading your design…</div>;
  if (project === null)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        This creative couldn't be found.
        <button onClick={() => lib.go({})} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white">
          Back to the library
        </button>
      </div>
    );
  return <EditorApp id={id} initial={project} />;
}

function EditorApp({ id, initial }: { id: string; initial: Project }) {
  const lib = useLibrary();
  const ed = useEditorState(initial, { id, onSave: (p) => lib.saveProject(id, p) });
  return (
    <EditorContext.Provider value={ed as Editor}>
      <Workspace creativeId={id} />
    </EditorContext.Provider>
  );
}

function Workspace({ creativeId }: { creativeId: string }) {
  const ed = useEditor();
  const lib = useLibrary();
  const meta = lib.creatives.find((c) => c.id === creativeId);
  const [newCreative, setNewCreative] = useState(false);
  const { doc, mode, setMode, playing, setPlaying, time, setTime, selected, setSelected, selectedEls, update, updateEls, undo, redo, notify, toast, hint } = ed;
  const { kind, setKind, project } = ed;
  const [tab, setTab] = useState<LeftTab>("templates");
  // Side panels: the left one can be hidden; the right one only shows when something is selected
  // (or when the user opens page settings), so the canvas gets the space.
  const [leftOpen, setLeftOpen] = useState(() => {
    try {
      return localStorage.getItem("postcraft-left-open") !== "0";
    } catch {
      return true;
    }
  });
  const toggleLeft = (open: boolean) => {
    setLeftOpen(open);
    try {
      localStorage.setItem("postcraft-left-open", open ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const openTab = (t: LeftTab) => {
    setTab(t);
    toggleLeft(true);
  };
  const [pageSettings, setPageSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [loop, setLoop] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // ---- playback ----
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      let t = timeRef.current + (now - last) / 1000;
      last = now;
      if (t >= doc.duration) {
        if (loop) t = 0;
        else {
          setTime(doc.duration);
          setPlaying(false);
          return;
        }
      }
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, doc.duration, setTime, setPlaying]);

  useEffect(() => {
    if (time > doc.duration) setTime(doc.duration);
  }, [doc.duration, time, setTime]);

  // ---- load any font the design uses (fonts are fetched on demand) ----
  const usedFonts = [...new Set(ed.project.pages.flatMap((p) => p.elements.map((e) => e.fontFamily).filter(Boolean)))].join("|");
  useEffect(() => {
    usedFonts.split("|").forEach((f) => ensureFont(f));
  }, [usedFonts]);

  // ---- toast ----
  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- keyboard shortcuts ----
  useClipboard();
  const actions = useActions();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        setSelected(doc.elements.filter((x) => !x.hidden).map((x) => x.id));
        return;
      }
      const act = actionsRef.current;
      // ⌥ variants copy / paste the look of an item rather than the item itself
      if (mod && e.altKey && (e.code === "KeyC" || e.code === "KeyV")) {
        e.preventDefault();
        if (e.code === "KeyC") act.copyStyle();
        else act.pasteStyle();
        return;
      }
      // ⌘C / ⌘X / ⌘V are handled by the real copy / cut / paste events (useClipboard)
      if (mod && key === "d") {
        e.preventDefault();
        return act.duplicate();
      }
      if (key === "s" && !mod && mode === "animate") return act.splitClip();
      if (e.key === " " && mode === "animate" && isMotion(kind)) {
        e.preventDefault();
        if (!playing && time >= doc.duration - 0.01) setTime(0);
        setPlaying(!playing);
        return;
      }
      if (e.key === "Escape") {
        setSelected([]);
        return;
      }
      if (!selected.length) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return act.remove();
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key]) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = arrows[e.key];
        updateEls(selected.filter((id) => !doc.elements.find((x) => x.id === id)?.locked), (x) => ({ x: x.x + dx * step, y: x.y + dy * step }), !e.repeat);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc.elements, doc.duration, selected, selectedEls, mode, kind, playing, time, undo, redo, update, updateEls, setSelected, setPlaying, setTime, notify]);

  const chooseKind = (k: PostKind) => {
    if (k === kind) return;
    setKind(k);
    const n = project.pages.length;
    if (!isMotion(k)) {
      setMode("design");
      setPlaying(false);
    }
    if (k === "static")
      notify(n > 1 ? `Static — ${n} independent designs, each exported as its own image` : "Static — add more independent designs any time; each exports as its own image");
    if (k === "carousel") notify(n > 1 ? `Carousel — ${n} slides` : "Carousel — add slides in the strip under your design");
    if (k === "animated") {
      setMode("animate");
      setTime(0);
      setPlaying(true);
      openTab("frames");
      notify("Video — pick the size you need on the left (9:16 Reel, 4:5, 1:1 or 16:9), then animate or add clips");
    }
  };

  const status = (() => {
    if (hint) return hint;
    const one = selectedEls.length === 1 ? selectedEls[0] : null;
    if (mode === "animate") {
      if (!selectedEls.length) return "🎬 Animate mode — press Play (or Space) to watch. Select an item to choose how it appears.";
      return `🎬 Animating ${one ? "“" + one.name + "”" : selectedEls.length + " items"} — pick an entrance on the right, drag its bar in the timeline to change timing.`;
    }
    if (!selectedEls.length) return "🎨 Design mode — click an item to edit it, or add text, shapes and photos from the left.";
    if (!one) return `${selectedEls.length} items selected — drag to move them together, or line them up from the right panel.`;
    if (one.locked) return "🔒 This item is locked — unlock it from the toolbar to move or resize.";
    if (one.type === "text") return "Text selected — double-click to type · corner dots change size · try Text effects on the right · right-click to copy its style.";
    if (one.type === "path") return "Path selected — double-click to edit its points · Stroke, fill and width are on the right · select it with a photo and right-click → Use as mask.";
    if (one.type === "video") return "Video clip selected — double-click to crop · trim and volume on the right · in Timeline press S to split at the playhead.";
    if (one.type === "image") return "Photo selected — double-click to crop & zoom · right-click for more · filters, shapes and corners are on the right.";
    return "Shape selected — drag to move · dots resize (Shift keeps proportions) · change colour and border on the right.";
  })();

  return (
    <div className="flex h-full flex-col">
      <TopBar
        onKind={chooseKind}
        onExport={() => setShowExport(true)}
        onNew={() => setNewCreative(true)}
        crumbs={meta && <EditorCrumbs meta={meta} />}
      />
      <div className="flex min-h-0 flex-1">
        <LeftPanel tab={tab} setTab={setTab} open={leftOpen} setOpen={toggleLeft} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Stage />
          {mode === "animate" ? (
            <Timeline loop={loop} setLoop={setLoop} />
          ) : (kind === "carousel" || kind === "static") && !ed.prefs.free ? (
            <PageStrip />
          ) : null}
        </main>
        {selectedEls.length > 0 || pageSettings ? (
          <aside className="thin-scroll relative w-[300px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
            {!selectedEls.length && (
              <button
                onClick={() => setPageSettings(false)}
                title="Close — the panel opens again when you select something"
                className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Close <FiChevronsRight />
              </button>
            )}
            {mode === "design" ? <PropertiesPanel onOpenTab={openTab} /> : <AnimationPanel />}
          </aside>
        ) : (
          <button
            onClick={() => setPageSettings(true)}
            title={mode === "design" ? "Open page settings" : "Open animation settings"}
            className="group flex w-9 shrink-0 flex-col items-center gap-2 border-l border-zinc-200 bg-white pt-4 text-zinc-500 hover:bg-violet-50 hover:text-violet-700"
          >
            <FiChevronsLeft className="text-sm" />
            <span className="text-[11px] font-medium [writing-mode:vertical-rl]">
              {mode === "design" ? "Page settings" : "Animation settings"}
            </span>
          </button>
        )}
      </div>
      <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-zinc-200 bg-white px-4 text-[11px] text-zinc-500">
        <span className={mode === "animate" ? "h-2 w-2 rounded-full bg-violet-500" : "h-2 w-2 rounded-full bg-emerald-500"} />
        <span className="min-w-0 flex-1 truncate">{status}</span>
        <CreatorLink inline />
        <span>{doc.elements.length} items</span>
        <span className="flex items-center gap-1 text-emerald-600">
          <FiCheck /> Saved in this browser
        </span>
      </footer>

      {toast && (
        <div
          key={toast.id}
          className={`pointer-events-none fixed bottom-12 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl transition-all duration-300 ${
            toastVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {toast.msg}
        </div>
      )}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {newCreative && meta && (
        <NewCreativeDialog ctx={{ brandId: meta.brandId, date: meta.date, platform: meta.platformId, kind: meta.kind }} onClose={() => setNewCreative(false)} />
      )}
    </div>
  );
}
