import { useEffect, useRef, useState } from "react";
import { FiMusic, FiPause, FiPlay, FiSearch, FiTrash2, FiType, FiUploadCloud } from "react-icons/fi";
import { ensureFont } from "../data/fonts";
import { FONT_PAIRS, PHOTO_GROUPS, photoThumb, photoUrl, STICKER_GROUPS, TYPE_STYLES, type TypeStyle } from "../data/library";
import { isMotion } from "../data/postKinds";
import { GRADIENTS } from "../data/presets";
import { bgCss, PATTERN_PRESETS, patternBg } from "../lib/background";
import { cn } from "../lib/cn";
import { makeText } from "../lib/factory";
import { putMedia, resolveSrc } from "../lib/media";
import { LIBRARY, renderTrack, type Track } from "../lib/music";
import { useEditor } from "../store";
import type { El } from "../types";
import { ColorPicker, Section, Slider, Toggle } from "./ui";

export function useAdd() {
  const { update, setSelected, notify } = useEditor();
  return (els: El[], msg: string) => {
    update((d) => ({ ...d, elements: [...d.elements, ...els] }));
    setSelected(els.map((e) => e.id));
    notify(msg);
  };
}

export function PanelHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{sub}</p>
    </div>
  );
}

// ---------------- Text & typography ----------------
function styleProps(s: TypeStyle, U: number): Partial<El> {
  const fontSize = U * s.size;
  return {
    fontFamily: s.font,
    fontWeight: s.weight,
    fontSize,
    lineHeight: s.lineHeight ?? 1.2,
    letterSpacing: (s.spacing ?? 0) * fontSize,
    textCase: s.textCase ?? "none",
    uppercase: false,
    italic: !!s.italic,
  };
}

export function TextPanel() {
  const { doc, selectedEls, updateEls, notify } = useEditor();
  const add = useAdd();
  const U = Math.min(doc.frame.w, doc.frame.h);
  const selText = selectedEls.filter((e) => e.type === "text");
  useEffect(() => {
    [...TYPE_STYLES.map((s) => s.font), ...FONT_PAIRS.flatMap((p) => [p.font, p.subFont])].forEach((f) => ensureFont(f));
  }, []);

  return (
    <div>
      <PanelHeader
        title="Text & typography"
        sub={selText.length ? "A text is selected — click a style below to restyle it." : "Click a style to add it. Double-click text on the canvas to type."}
      />
      <div className="px-4 pt-3">
        <button
          onClick={() => add([makeText(doc.frame, doc.duration, { text: "Add your text" })], "Text added — double-click it to type")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <FiType /> Add a text box
        </button>
      </div>
      <Section title="Typography styles" hint="A ready-made type scale so sizes stay consistent">
        <div className="space-y-1.5">
          {TYPE_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                if (selText.length) {
                  updateEls(
                    selText.map((e) => e.id),
                    styleProps(s, U),
                  );
                  notify(`“${s.label}” style applied`);
                } else
                  add(
                    [makeText(doc.frame, doc.duration, { text: s.sample, name: s.label, color: "#111111", ...styleProps(s, U) })],
                    `${s.label} added — double-click to edit`,
                  );
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-left hover:border-violet-300 hover:bg-violet-50/40"
            >
              <span
                className="min-w-0 truncate"
                style={{
                  fontFamily: `"${s.font}"`,
                  fontWeight: s.weight,
                  fontStyle: s.italic ? "italic" : undefined,
                  fontSize: Math.max(11, Math.min(26, s.size * 190)),
                  letterSpacing: `${s.spacing ?? 0}em`,
                  textTransform: s.textCase === "upper" ? "uppercase" : undefined,
                  lineHeight: 1.2,
                }}
              >
                {s.sample}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Font pairings" hint="Two fonts that look great together">
        <div className="grid grid-cols-2 gap-2">
          {FONT_PAIRS.map((c) => (
            <button
              key={c.title}
              onClick={() => {
                const title = makeText(doc.frame, doc.duration, {
                  text: c.title,
                  fontFamily: c.font,
                  fontWeight: c.weight,
                  fontSize: U * 0.13,
                  color: c.color,
                  y: doc.frame.h * 0.4,
                  name: c.title,
                });
                const sub = makeText(doc.frame, doc.duration, {
                  text: c.sub,
                  fontFamily: c.subFont,
                  fontWeight: 500,
                  fontSize: U * 0.045,
                  color: c.color,
                  y: doc.frame.h * 0.4 + U * 0.17,
                  name: c.sub,
                });
                sub.anim = { ...sub.anim, start: 0.4, inType: "slideUp" };
                add([title, sub], "Font pairing added — both items are selected so you can move them together");
              }}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border border-zinc-200 p-2 text-center hover:border-violet-300"
              style={{ color: c.color, background: c.bg }}
            >
              <span style={{ fontFamily: `"${c.font}"`, fontWeight: c.weight }} className="text-xl leading-none">
                {c.title}
              </span>
              <span style={{ fontFamily: `"${c.subFont}"` }} className="mt-1.5 text-[10px]">
                {c.sub}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ---------------- Stickers ----------------
export function StickersPanel() {
  const { doc } = useEditor();
  const add = useAdd();
  const [group, setGroup] = useState("All");
  const [q, setQ] = useState("");
  const U = Math.min(doc.frame.w, doc.frame.h);
  const groups = STICKER_GROUPS.filter((g) => group === "All" || g.name === group);
  const addSticker = (s: string) =>
    add([makeText(doc.frame, doc.duration, { text: s, fontSize: U * 0.16, w: U * 0.25, name: "Sticker " + s, fontFamily: "Inter" })], "Sticker added — resize with the corner dots");
  return (
    <div>
      <PanelHeader title="Stickers" sub="Click to add. They behave like text, so you can resize, rotate and animate them." />
      <div className="space-y-2 px-4 pt-3">
        <label className="flex items-center gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5">
          <FiSearch className="text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a category (love, food…)" className="w-full bg-transparent text-xs outline-none" />
        </label>
        <div className="flex flex-wrap gap-1">
          {["All", ...STICKER_GROUPS.map((g) => g.name)].map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", group === g ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {groups
        .filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()))
        .map((g) => (
          <Section key={g.name} title={g.name}>
            <div className="grid grid-cols-6 gap-1">
              {g.items.map((s) => (
                <button key={g.name + s} onClick={() => addSticker(s)} className="flex aspect-square items-center justify-center rounded-lg text-2xl transition hover:scale-110 hover:bg-zinc-100">
                  {s}
                </button>
              ))}
            </div>
          </Section>
        ))}
    </div>
  );
}

// ---------------- Background ----------------
const BG_TABS = ["Colour", "Gradient", "Pattern", "Photo"] as const;

export function BackgroundPanel() {
  const { doc, update, setSelected, kind, project, setSpanBackground } = useEditor();
  const bg = doc.background;
  const [tab, setTab] = useState<(typeof BG_TABS)[number]>(bg.kind === "gradient" ? "Gradient" : bg.kind === "image" ? (bg.src.startsWith("data:") ? "Pattern" : "Photo") : "Colour");
  const set = (b: typeof bg, history = true) => update((d) => ({ ...d, background: b }), history);
  const [photoGroup, setPhotoGroup] = useState(PHOTO_GROUPS[0].name);
  return (
    <div onPointerDown={() => setSelected([])}>
      <PanelHeader title="Background" sub="The colour, pattern or picture behind everything on this page." />
      <div className="px-4 pt-3">
        <div className="h-20 rounded-xl border border-zinc-200" style={bgCss(bg)} />
        {kind === "carousel" && project.pages.length > 1 && (
          <div className="mt-3 rounded-xl bg-violet-50 p-3">
            <Toggle checked={!!project.spanBackground} onChange={setSpanBackground} label="Stretch across all slides" />
            <p className="mt-1 text-[11px] leading-snug text-violet-700/80">One continuous picture that flows from slide to slide when people swipe.</p>
          </div>
        )}
        <div className="mt-3 flex rounded-lg bg-zinc-100 p-0.5">
          {BG_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 rounded-md py-1.5 text-xs font-medium", tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Colour" && (
        <Section title="Solid colour">
          <ColorPicker value={bg.kind === "solid" ? bg.color : "#ffffff"} onChange={(c, h) => set({ kind: "solid", color: c }, h)} />
          <div className="grid grid-cols-8 gap-1.5">
            <button
              title="Transparent — export a PNG with no background"
              onClick={() => set({ kind: "none" })}
              className={cn("aspect-square rounded-lg border border-black/10", bg.kind === "none" && "ring-2 ring-violet-500 ring-offset-1")}
              style={bgCss({ kind: "none" })}
            />
            {["#ffffff", "#000000", "#f4f4f5", "#fff4c2", "#ffd6e0", "#d4f5e4", "#d6ecff", "#ede9fe", "#fbf3ea", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6", "#af52de", "#ff2d55", "#1b1f3b", "#0f3d2e", "#7a2e0e", "#3f3f46", "#0f172a", "#831843"].map((c) => (
              <button
                key={c}
                onClick={() => set({ kind: "solid", color: c })}
                className={cn("aspect-square rounded-lg border border-black/10 transition hover:scale-110", bg.kind === "solid" && bg.color === c && "ring-2 ring-violet-500 ring-offset-1")}
                style={{ background: c }}
              />
            ))}
          </div>
          {bg.kind === "none" && <p className="text-[11px] text-zinc-500">Transparent: PNG exports have no background. JPG gets white, video gets black.</p>}
        </Section>
      )}

      {tab === "Gradient" && (
        <Section title="Gradients">
          <div className="grid grid-cols-4 gap-2">
            {[
              ...GRADIENTS,
              { from: "#fdfcfb", to: "#e2d1c3", angle: 135 },
              { from: "#c471f5", to: "#fa71cd", angle: 135 },
              { from: "#48c6ef", to: "#6f86d6", angle: 135 },
              { from: "#0ba360", to: "#3cba92", angle: 135 },
            ].map((g, i) => (
              <button
                key={i}
                onClick={() => set({ kind: "gradient", ...g })}
                className="aspect-square rounded-lg border border-black/10 transition hover:scale-105"
                style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
              />
            ))}
          </div>
          {bg.kind === "gradient" && (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">From</span>
                <ColorPicker value={bg.from} onChange={(c, h) => set({ ...bg, from: c }, h)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">To</span>
                <ColorPicker value={bg.to} onChange={(c, h) => set({ ...bg, to: c }, h)} />
              </div>
              <Slider label="Direction" value={bg.angle} min={0} max={360} unit="°" onChange={(v, h) => set({ ...bg, angle: v }, h)} />
            </div>
          )}
        </Section>
      )}

      {tab === "Pattern" &&
        PATTERN_PRESETS.map((g) => (
          <Section key={g.group} title={g.group}>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((it) => {
                const src = patternBg(it.kind, it.a, it.b);
                return (
                  <button key={it.name} onClick={() => set({ kind: "image", src, dim: 0 })} className="group text-center">
                    <div className="aspect-square rounded-lg border border-black/10 bg-cover bg-center transition group-hover:ring-2 group-hover:ring-violet-400" style={{ backgroundImage: `url("${src}")` }} />
                    <span className="mt-1 block text-[10px] text-zinc-500">{it.name}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        ))}

      {tab === "Photo" && (
        <Section title="Photo backgrounds">
          <div className="flex flex-wrap gap-1">
            {PHOTO_GROUPS.map((g) => (
              <button
                key={g.name}
                onClick={() => setPhotoGroup(g.name)}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", photoGroup === g.name ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PHOTO_GROUPS.find((g) => g.name === photoGroup)!.ids.map((id) => (
              <button key={id} onClick={() => set({ kind: "image", src: photoUrl(id), dim: 0 })} className="overflow-hidden rounded-lg bg-zinc-100 hover:ring-2 hover:ring-violet-400">
                <img src={photoThumb(id)} crossOrigin="anonymous" loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">Free photos from picsum.photos. Use the Uploads tab for your own.</p>
        </Section>
      )}

      {bg.kind === "image" && (
        <Section title="Adjust background">
          <Slider label="Darken" value={bg.dim} min={0} max={80} unit="%" onChange={(v, h) => set({ ...bg, dim: v }, h)} />
          <p className="text-[11px] text-zinc-400">Darkening makes white text easier to read on busy pictures.</p>
        </Section>
      )}
    </div>
  );
}

// ---------------- Music ----------------
function audioLength(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 30);
    a.onerror = () => resolve(30);
    a.src = url;
  });
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function MusicPanel() {
  const { doc, update, notify, kind, setMode, setTime, setPlaying } = useEditor();
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const a = doc.audio;

  useEffect(() => () => player.current?.pause(), []);

  const stopPreview = () => {
    player.current?.pause();
    setPreviewing(null);
  };

  const preview = async (t: Track) => {
    if (previewing === t.id) return stopPreview();
    setBusy(t.id);
    const blob = await renderTrack(t);
    setBusy(null);
    player.current?.pause();
    player.current = new Audio(URL.createObjectURL(blob));
    player.current.onended = () => setPreviewing(null);
    player.current.play();
    setPreviewing(t.id);
  };

  const useTrack = (src: string, name: string, length: number) => {
    stopPreview();
    update((d) => ({ ...d, audio: { src, name, start: 0, trimStart: 0, length, volume: 0.8, fadeIn: 0.5, fadeOut: 1.5 } }));
    notify(isMotion(kind) ? `“${name}” added — press Play in the timeline to hear it with your design` : `“${name}” added — music plays in Animated and Reel videos`);
  };

  const fromLibrary = async (t: Track) => {
    setBusy(t.id);
    const blob = await renderTrack(t);
    const src = await putMedia(blob);
    setBusy(null);
    useTrack(src, t.name, t.seconds);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy("upload");
    const src = await putMedia(file);
    const len = await audioLength(resolveSrc(src)!);
    setBusy(null);
    useTrack(src, file.name.replace(/\.[^.]+$/, ""), len);
  };

  const setA = (patch: Partial<NonNullable<typeof a>>, history = true) => update((d) => (d.audio ? { ...d, audio: { ...d.audio, ...patch } } : d), history);
  const plays = a ? Math.max(0, Math.min(doc.duration, a.start + a.length - a.trimStart) - a.start) : 0;

  return (
    <div>
      <PanelHeader title="Music" sub="Add a soundtrack to animated posts and reels. Import your own or pick from the built-in library." />
      {!isMotion(kind) && (
        <p className="mx-4 mt-3 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-800">
          Music is part of videos. Switch the post type to <b>Animated</b> or <b>Reel</b> to export it with sound.
        </p>
      )}

      {a && (
        <Section title="On this page">
          <div className="flex items-center gap-3 rounded-xl bg-violet-50 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
              <FiMusic />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-zinc-900">{a.name}</span>
              <span className="block text-[11px] text-zinc-500">
                plays {plays.toFixed(1)}s of {fmt(a.length)}
              </span>
            </span>
            <button
              onClick={() => {
                setMode("animate");
                setTime(Math.max(0, a.start - 0.1));
                setPlaying(true);
              }}
              title="Play with your design"
              className="rounded-lg p-2 text-violet-700 hover:bg-violet-100"
            >
              <FiPlay />
            </button>
            <button onClick={() => update((d) => ({ ...d, audio: undefined }))} title="Remove music" className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
              <FiTrash2 />
            </button>
          </div>
          <Slider label="Volume" value={Math.round(a.volume * 100)} min={0} max={100} unit="%" onChange={(v, h) => setA({ volume: v / 100 }, h)} />
          <Slider label="Song from" value={a.trimStart} min={0} max={Math.max(0, a.length - 1)} step={0.1} unit="s" onChange={(v, h) => setA({ trimStart: v }, h)} />
          <Slider label="Starts at" value={a.start} min={0} max={Math.max(0, doc.duration - 0.5)} step={0.1} unit="s" onChange={(v, h) => setA({ start: v }, h)} />
          <Slider label="Fade in" value={a.fadeIn} min={0} max={4} step={0.1} unit="s" onChange={(v, h) => setA({ fadeIn: v }, h)} />
          <Slider label="Fade out" value={a.fadeOut} min={0} max={4} step={0.1} unit="s" onChange={(v, h) => setA({ fadeOut: v }, h)} />
          {a.length - a.trimStart + a.start > doc.duration + 0.5 && (
            <button
              onClick={() => update((d) => ({ ...d, duration: Math.min(60, Math.round((a.start + a.length - a.trimStart) * 10) / 10) }))}
              className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs hover:bg-zinc-50"
            >
              Make the video as long as the song ({Math.min(60, a.start + a.length - a.trimStart).toFixed(0)}s)
            </button>
          )}
        </Section>
      )}

      <div className="px-4 pt-4">
        <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 py-4 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          <FiUploadCloud className="text-2xl" />
          {busy === "upload" ? "Importing…" : "Import music from your computer"}
          <span className="text-[11px] font-normal text-violet-500">MP3, WAV, M4A, OGG</span>
        </button>
      </div>

      <Section title="Music library" hint="Original tracks made in your browser — free to use anywhere">
        <div className="space-y-1.5">
          {LIBRARY.map((t) => (
            <div key={t.id} className={cn("flex items-center gap-2.5 rounded-xl border px-2 py-2", a?.name === t.name ? "border-violet-400 bg-violet-50/50" : "border-zinc-200")}>
              <button
                onClick={() => preview(t)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700"
                title={previewing === t.id ? "Stop" : "Listen"}
              >
                {busy === t.id ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : previewing === t.id ? <FiPause /> : <FiPlay className="ml-0.5" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-zinc-900">{t.name}</span>
                <span className="block text-[10px] text-zinc-500">
                  {t.mood} · {t.bpm} BPM · {fmt(t.seconds)}
                </span>
              </span>
              <button onClick={() => fromLibrary(t)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700">
                Use
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
