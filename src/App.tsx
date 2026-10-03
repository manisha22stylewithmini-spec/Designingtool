import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronsLeft, FiChevronsRight } from "react-icons/fi";
import { AnimationPanel } from "./components/AnimationPanel";
import { ExportModal } from "./components/ExportModal";
import { LeftPanel, type LeftTab } from "./components/LeftPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Stage } from "./components/Stage";
import { StartScreen } from "./components/StartScreen";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import { findPlatform, findVariant } from "./data/platforms";
import { isMotion } from "./data/postKinds";
import { makeText } from "./lib/factory";
import { useActions } from "./components/useActions";
import { ensureFont } from "./data/fonts";
import { EditorContext, loadSavedProject, useEditor, useEditorState, type Editor } from "./store";
import { PageStrip } from "./components/PageStrip";
import { restoreMedia } from "./lib/media";
import type { Doc, PostKind } from "./types";

function starterDoc(platformId: string, variantId: string): Doc {
  const v = findVariant(platformId, variantId)!;
  const frame = { platformId, variantId, w: v.w, h: v.h };
  const U = Math.min(v.w, v.h);
  const duration = 5;
  const title = makeText(frame, duration, {
    text: "Your big idea",
    fontSize: U * 0.11,
    fontWeight: 800,
    fontFamily: "Poppins",
    color: "#1b1f3b",
    y: v.h * 0.4,
    name: "Headline",
  });
  title.anim = { ...title.anim, inType: "slideUp" };
  const sub = makeText(frame, duration, {
    text: "Double-click any text to change it",
    fontSize: U * 0.045,
    fontWeight: 500,
    fontFamily: "Inter",
    color: "#3f3f46",
    y: v.h * 0.4 + U * 0.16,
    name: "Subtitle",
  });
  sub.anim = { ...sub.anim, inType: "fade", start: 0.5 };
  return {
    frame,
    background: { kind: "gradient", from: "#a18cd1", to: "#fbc2eb", angle: 135 },
    elements: [title, sub],
    duration,
  };
}


const saved = loadSavedProject();

export default function App() {
  const ed = useEditorState(saved);
  const [showStart, setShowStart] = useState(!ed.doc);
  // Uploaded videos live in IndexedDB — load them before showing a saved design.
  const [mediaReady, setMediaReady] = useState(false);
  useEffect(() => {
    const refs = saved?.pages.flatMap((p) => p.elements.map((e) => e.src ?? "")) ?? [];
    restoreMedia(refs).finally(() => setMediaReady(true));
  }, []);

  if (!ed.doc) {
    return (
      <StartScreen
        onPick={(p, v, k) => {
          ed.newProject(starterDoc(p, v), k);
          setShowStart(false);
        }}
      />
    );
  }
  if (!mediaReady) return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading your design…</div>;

  return (
    <EditorContext.Provider value={ed as Editor}>
      <Workspace showStart={showStart} setShowStart={setShowStart} />
    </EditorContext.Provider>
  );
}

function Workspace({ showStart, setShowStart }: { showStart: boolean; setShowStart: (v: boolean) => void }) {
  const ed = useEditor();
  const { doc, mode, setMode, playing, setPlaying, time, setTime, selected, setSelected, selectedEls, update, updateEls, undo, redo, notify, toast, hint } = ed;
  const { kind, setKind, project, setFrame } = ed;
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
      if (mod && key === "c") return act.copy();
      if (mod && key === "v") {
        e.preventDefault();
        return act.paste();
      }
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
      notify("Animated post — pick how each item moves, then export an MP4");
    }
    if (k === "reel") {
      const { frame } = project;
      if (frame.h <= frame.w) {
        const own = findPlatform(frame.platformId).variants.find((v) => v.video && v.h > v.w);
        const pid = own ? frame.platformId : "instagram";
        const v = own ?? findVariant("instagram", "reel")!;
        setFrame({ platformId: pid, variantId: v.id, w: v.w, h: v.h });
        notify(`Reel — frame switched to ${findPlatform(pid).name} ${v.name} (9:16). Upload clips from the Uploads tab.`);
      } else notify("Reel — upload your clips from the Uploads tab, then trim them on the timeline");
      openTab("photos");
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
    if (one.type === "video") return "Video clip selected — double-click to crop · trim and volume on the right · in Timeline press S to split at the playhead.";
    if (one.type === "image") return "Photo selected — double-click to crop & zoom · right-click for more · filters, shapes and corners are on the right.";
    return "Shape selected — drag to move · dots resize (Shift keeps proportions) · change colour and border on the right.";
  })();

  return (
    <div className="flex h-full flex-col">
      <TopBar
        onKind={chooseKind}
        onExport={() => setShowExport(true)}
        onNew={() => setShowStart(true)}
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
      {showStart && (
        <StartScreen
          onClose={() => setShowStart(false)}
          onPick={(p, v, k) => {
            ed.newProject(starterDoc(p, v), k);
            setShowStart(false);
            setMode(k === "animated" ? "animate" : "design");
            if (k === "reel") openTab("photos");
            notify("New design started — the old one can be restored with ⌘Z");
          }}
        />
      )}
    </div>
  );
}
