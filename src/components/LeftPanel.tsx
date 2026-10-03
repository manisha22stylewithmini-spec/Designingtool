import { useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FiChevronsLeft, FiChevronsRight, FiImage, FiLayers, FiLayout, FiMaximize, FiMusic, FiSmile, FiType, FiUploadCloud } from "react-icons/fi";
import { IoShapesOutline } from "react-icons/io5";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { SAMPLE_PHOTOS, SHAPES } from "../data/presets";
import { TEMPLATES } from "../data/templates";
import { cn } from "../lib/cn";
import { makeImage, makeShape, makeVideo } from "../lib/factory";
import { shapePath } from "../lib/geometry";
import { fileToDataUrl, imageSize } from "../lib/images";
import { putMedia, resolveSrc } from "../lib/media";
import { useEditor } from "../store";
import { FramesPanel } from "./FramesPanel";
import { LayersPanel } from "./LayersPanel";
import { Section } from "./ui";
import { BackgroundPanel, MusicPanel, PanelHeader, StickersPanel, TextPanel, useAdd } from "./ContentPanels";

export type LeftTab = "templates" | "frames" | "text" | "elements" | "stickers" | "photos" | "background" | "music" | "layers";

const TABS: { id: LeftTab; label: string; icon: IconType }[] = [
  { id: "frames", label: "Size", icon: FiMaximize },
  { id: "templates", label: "Templates", icon: FiLayout },
  { id: "text", label: "Text", icon: FiType },
  { id: "elements", label: "Shapes", icon: IoShapesOutline },
  { id: "stickers", label: "Stickers", icon: FiSmile },
  { id: "photos", label: "Uploads", icon: FiImage },
  { id: "background", label: "Background", icon: MdOutlineFormatColorFill },
  { id: "music", label: "Music", icon: FiMusic },
  { id: "layers", label: "Layers", icon: FiLayers },
];

export function LeftPanel({
  tab,
  setTab,
  open,
  setOpen,
}: {
  tab: LeftTab;
  setTab: (t: LeftTab) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex h-full shrink-0">
      <nav className="flex w-[76px] flex-col items-center border-r border-zinc-200 bg-white py-2">
        <div className="thin-scroll flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = open && tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setOpen(true);
                }}
                title={open ? t.label : `Open ${t.label}`}
                className={cn(
                  "flex w-[64px] flex-col items-center gap-0.5 rounded-xl py-2 text-[10.5px] font-medium transition",
                  active ? "bg-violet-100 text-violet-700" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <Icon className="text-lg" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setOpen(!open)}
          title={open ? "Hide this panel to get more canvas space" : "Show the panel again"}
          className={cn(
            "mt-1 flex w-[64px] flex-col items-center gap-0.5 rounded-xl border py-1.5 text-[10px] font-medium transition",
            open ? "border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
          )}
        >
          {open ? <FiChevronsLeft className="text-base" /> : <FiChevronsRight className="text-base" />}
          {open ? "Hide panel" : "Show panel"}
        </button>
      </nav>
      {open && (
      <div className="thin-scroll relative w-[300px] overflow-y-auto border-r border-zinc-200 bg-white">
        <button
          onClick={() => setOpen(false)}
          title="Hide this panel — click any icon on the left to open it again"
          className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <FiChevronsLeft />
        </button>
        {tab === "frames" && <FramesPanel />}
        {tab === "templates" && <TemplatesPanel />}
        {tab === "text" && <TextPanel />}
        {tab === "elements" && <ShapesPanel />}
        {tab === "stickers" && <StickersPanel />}
        {tab === "photos" && <PhotosPanel />}
        {tab === "background" && <BackgroundPanel />}
        {tab === "music" && <MusicPanel />}
        {tab === "layers" && <LayersPanel />}
      </div>
      )}
    </div>
  );
}

// ---------------- Templates ----------------
function TemplatesPanel() {
  const { doc, setDoc, notify } = useEditor();
  const ratio = doc.frame.w / doc.frame.h;
  return (
    <div>
      <PanelHeader title="Templates" sub="Start from a ready design. It's built for your current frame size and already animated." />
      <div className="grid grid-cols-2 gap-3 p-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              const built = t.build(doc.frame, doc.duration);
              setDoc({ ...doc, ...built });
              notify(`“${t.name}” template applied — click any item to change it. ⌘Z to go back.`);
            }}
            className="group text-left"
          >
            <div
              className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200 shadow-sm transition group-hover:shadow-md group-hover:ring-2 group-hover:ring-violet-400"
              style={{ aspectRatio: Math.max(0.6, Math.min(1.8, ratio)), background: t.preview }}
            >
              <span
                className="px-2 text-center text-lg leading-tight font-black"
                style={{ color: t.preview.includes("#ffd6e0") ? "#111" : "#fff" }}
              >
                {t.name}
              </span>
            </div>
            <span className="mt-1.5 block text-xs font-medium text-zinc-700">{t.name}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pb-4 text-[11px] text-zinc-400">Applying a template replaces the current page. You can always undo.</p>
    </div>
  );
}

// ---------------- Shapes & stickers ----------------

function ShapesPanel() {
  const { doc } = useEditor();
  const add = useAdd();
  const U = Math.min(doc.frame.w, doc.frame.h);
  return (
    <div>
      <PanelHeader title="Shapes & stickers" sub="Click to add. Change colours, borders and corners in the right panel." />
      <Section title="Shapes">
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s.kind}
              title={s.label}
              onClick={() => add([makeShape(doc.frame, doc.duration, s.kind)], `${s.label} added — drag the dots to resize`)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 hover:border-violet-300 hover:bg-violet-50/50"
            >
              <svg width="34" height={s.kind === "line" ? 10 : s.kind === "arrow" ? 22 : 34} className="overflow-visible">
                <path
                  d={shapePath(s.kind, 34, s.kind === "line" ? 4 : s.kind === "arrow" ? 22 : 34, s.kind === "line" ? 2 : 0)}
                  fill="#7c3aed"
                  transform={s.kind === "line" ? "translate(0,3)" : undefined}
                />
              </svg>
              <span className="text-[10px] text-zinc-500">{s.label}</span>
            </button>
          ))}
          <button
            title="Rounded square"
            onClick={() => add([makeShape(doc.frame, doc.duration, "rect", { radius: U * 0.05, name: "Rounded square" })], "Rounded square added")}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 hover:border-violet-300 hover:bg-violet-50/50"
          >
            <svg width="34" height="34">
              <path d={shapePath("rect", 34, 34, 9)} fill="#7c3aed" />
            </svg>
            <span className="text-[10px] text-zinc-500">Rounded</span>
          </button>
          <button
            title="Outline circle"
            onClick={() =>
              add(
                [makeShape(doc.frame, doc.duration, "ellipse", { fill: "transparent", stroke: "#7c3aed", strokeWidth: U * 0.012, name: "Ring" })],
                "Ring added",
              )
            }
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 hover:border-violet-300 hover:bg-violet-50/50"
          >
            <svg width="34" height="34">
              <path d={shapePath("ellipse", 34, 34, 0, 2)} fill="none" stroke="#7c3aed" strokeWidth="4" />
            </svg>
            <span className="text-[10px] text-zinc-500">Ring</span>
          </button>
        </div>
      </Section>
    </div>
  );
}

// ---------------- Photos & videos ----------------
const uploadsMemory: string[] = [];
const videoMemory: { src: string; name: string }[] = [];
const MAX_CLIP = 90;

function videoInfo(url: string): Promise<{ w: number; h: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return resolve({ w: v.videoWidth, h: v.videoHeight, duration: v.duration });
      // Some recorded WebM files don't know their length until you seek to the end.
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        resolve({ w: v.videoWidth, h: v.videoHeight, duration: Number.isFinite(v.duration) ? v.duration : 5 });
      };
      v.currentTime = 1e7;
    };
    v.onerror = reject;
    v.src = url;
  });
}

function PhotosPanel() {
  const { doc, update, notify, setSelected } = useEditor();
  const add = useAdd();
  const [uploads, setUploads] = useState<string[]>(uploadsMemory);
  const [videos, setVideos] = useState(videoMemory);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const addPhoto = async (src: string) => {
    try {
      const { w, h } = await imageSize(src);
      add([makeImage(doc.frame, doc.duration, src, w, h)], "Photo added — use the right panel for filters, corners and flip");
    } catch {
      notify("Couldn't load that photo. Check your internet connection.");
    }
  };

  const setBg = (src: string) => {
    update((d) => ({ ...d, background: { kind: "image", src, dim: 0 } }));
    setSelected([]);
    notify("Photo set as background");
  };

  const addVideo = async (src: string) => {
    try {
      const info = await videoInfo(resolveSrc(src)!);
      const len = Math.min(MAX_CLIP, info.duration || 5);
      const el = makeVideo(doc.frame, doc.duration, src, info.w, info.h, info.duration || 5);
      // Make the page as long as the clip so the whole video plays.
      update((d) => {
        const duration = Math.max(d.duration, Math.round(len * 10) / 10);
        return {
          ...d,
          duration,
          elements: [
            el,
            ...d.elements.map((e) => (e.anim.end >= d.duration - 0.01 ? { ...e, anim: { ...e.anim, end: duration } } : e)),
          ],
        };
      });
      update((d) => ({ ...d, elements: d.elements.map((e) => (e.id === el.id ? { ...e, anim: { ...e.anim, end: Math.min(d.duration, len) } } : e)) }), false);
      setSelected([el.id]);
      const vertical = doc.frame.h > doc.frame.w;
      notify(
        vertical
          ? "Clip added behind your design — press Animate ▶ to play it. Trim and volume are on the right."
          : "Clip added — tip: choose a 9:16 Reel / Story size for vertical videos.",
      );
    } catch {
      notify("Couldn't read that video. Try an MP4 or MOV file.");
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("video/")) {
        const src = await putMedia(f);
        videoMemory.unshift({ src, name: f.name });
        setVideos([...videoMemory]);
        await addVideo(src);
        continue;
      }
      if (!f.type.startsWith("image/")) continue;
      try {
        const { src } = await fileToDataUrl(f);
        added.push(src);
      } catch {
        /* skip broken file */
      }
    }
    uploadsMemory.unshift(...added);
    setUploads([...uploadsMemory]);
    setLoading(false);
    if (added.length === 1) addPhoto(added[0]);
    else if (added.length) notify(`${added.length} photos uploaded — click one to add it`);
  };

  const Grid = ({ list }: { list: string[] }) => (
    <div className="columns-2 gap-2 [&>*]:mb-2">
      {list.map((src) => (
        <div key={src} className="group relative overflow-hidden rounded-lg bg-zinc-100">
          <img src={src} crossOrigin={src.startsWith("data:") ? undefined : "anonymous"} className="w-full cursor-pointer" onClick={() => addPhoto(src)} loading="lazy" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/60 p-1.5 opacity-0 transition group-hover:opacity-100">
            <button onClick={() => addPhoto(src)} className="pointer-events-auto flex-1 rounded bg-white/90 py-1 text-[10px] font-medium">
              Add
            </button>
            <button onClick={() => setBg(src)} className="pointer-events-auto flex-1 rounded bg-white/90 py-1 text-[10px] font-medium">
              Background
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PanelHeader
        title="Photos & videos"
        sub="Upload photos to edit, or video clips to make reels & stories. Hover a photo to use it as the background."
      />
      <div className="p-4">
        <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <button
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 py-5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          <FiUploadCloud className="text-2xl" />
          {loading ? "Uploading…" : "Upload photos or videos"}
          <span className="text-[11px] font-normal text-violet-500">or drop them here · MP4, MOV, JPG, PNG</span>
        </button>
      </div>
      {videos.length > 0 && (
        <Section title="Your video clips" hint="Click to add again">
          <div className="grid grid-cols-2 gap-2">
            {videos.map((v) => (
              <button key={v.src} onClick={() => addVideo(v.src)} className="group relative overflow-hidden rounded-lg bg-black text-left">
                <video src={resolveSrc(v.src) + "#t=0.5"} muted preload="metadata" className="aspect-[4/5] w-full object-cover opacity-90 group-hover:opacity-100" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 px-1.5 py-1 text-[10px] text-white">🎬 {v.name}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {uploads.length > 0 && (
        <Section title="Your photos">
          <Grid list={uploads} />
        </Section>
      )}
      <Section title="Sample photos">
        <Grid list={SAMPLE_PHOTOS} />
      </Section>
    </div>
  );
}

