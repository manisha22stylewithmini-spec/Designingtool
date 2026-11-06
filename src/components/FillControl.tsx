import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiFilm, FiImage, FiLink, FiSlash, FiUpload } from "react-icons/fi";
import { MdBlurOn, MdGradient, MdGridOn, MdOutlineSquare } from "react-icons/md";
import { cn } from "../lib/cn";
import { parseColor, toHex } from "../lib/color";
import { fileToDataUrl, videoInfo } from "../lib/images";
import { putMedia, resolveSrc } from "../lib/media";
import { DEFAULT_GRADIENT, DEFAULT_PATTERN, gradientCss, PATTERNS, patternTile, sortedStops } from "../lib/paint";
import { loadImage } from "../lib/render";
import { useEditor } from "../store";
import type { El, Gradient, Pattern } from "../types";
import { ColorPanel, ColorPicker, Row, Segmented, Slider } from "./ui";

type Tab = "solid" | "gradient" | "pattern" | "image" | "video" | "none";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "solid", label: "Solid colour", icon: <MdOutlineSquare /> },
  { id: "gradient", label: "Gradient", icon: <MdGradient /> },
  { id: "pattern", label: "Pattern", icon: <MdGridOn /> },
  { id: "image", label: "Image or GIF", icon: <FiImage /> },
  { id: "video", label: "Video", icon: <FiFilm /> },
  { id: "none", label: "No fill", icon: <FiSlash /> },
];

const NO_PAINT = { fillSrc: undefined, fillKind: undefined, fillGradient: undefined, fillPattern: undefined } as const;

function currentTab(el: El): Tab {
  if (el.fillSrc) return el.fillKind === "video" ? "video" : "image";
  if (el.fillPattern) return "pattern";
  if (el.fillGradient) return "gradient";
  if (el.fill === "transparent" || (el.type === "path" && !el.fill)) return "none";
  return "solid";
}

/** Colour a new gradient / pattern starts from — whatever the shape is filled with now. */
const baseColour = (el: El) => (el.fill && el.fill !== "transparent" && parseColor(el.fill) ? el.fill : "#7c3aed");

/**
 * The "Fill" of a shape or drawn path, like Figma's fill picker: Solid colour (full colour picker),
 * Gradient, Pattern, Image / GIF, Video and No fill.
 */
export function FillControl({ el, set, notify }: { el: El; set: (patch: Partial<El>, history?: boolean) => void; notify: (m: string) => void }) {
  const { checkpoint } = useEditor();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(currentTab(el));
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [stop, setStop] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setTab(currentTab(el)), [el.id]);

  const hasMedia = !!el.fillSrc;
  const framing = { cropX: 0.5, cropY: 0.5, cropZoom: 1 };

  const choose = (t: Tab) => {
    setTab(t);
    if (t === "solid") set({ ...NO_PAINT, fill: baseColour(el) });
    else if (t === "gradient") {
      if (!el.fillGradient) {
        const c = baseColour(el);
        set({ ...NO_PAINT, fill: el.fill, fillGradient: { ...DEFAULT_GRADIENT, stops: [{ pos: 0, color: c }, { pos: 1, color: "#ffffff" }] } });
        setStop(0);
      }
    } else if (t === "pattern") {
      if (!el.fillPattern) set({ ...NO_PAINT, fill: el.fill, fillPattern: { ...DEFAULT_PATTERN, color: baseColour(el) } });
    } else if (t === "none") set({ ...NO_PAINT, fill: "transparent", strokeWidth: el.strokeWidth || 6 });
    else if (!hasMedia || (t === "video") !== (el.fillKind === "video")) setTimeout(() => file.current?.click(), 0);
  };

  const useFile = async (f: File) => {
    setBusy(true);
    try {
      if (f.type.startsWith("video/")) {
        const src = await putMedia(f);
        const info = await videoInfo(resolveSrc(src)!);
        set({ ...NO_PAINT, fillSrc: src, fillKind: "video", videoDuration: info.duration, trimStart: 0, muted: true, ...framing });
        setTab("video");
        notify("Video added — it loops while you play or export the video");
      } else if (f.type.startsWith("image/")) {
        // GIFs are kept as the original file so they keep moving
        const src = f.type === "image/gif" ? await putMedia(f) : (await fileToDataUrl(f)).src;
        set({ ...NO_PAINT, fillSrc: src, fillKind: "image", ...framing });
        setTab("image");
        notify(f.type === "image/gif" ? "GIF added" : "Picture added");
      } else notify("Please choose a picture, GIF or video file.");
    } catch {
      notify("Couldn't read that file. Try a JPG, PNG, GIF, MP4 or MOV.");
    } finally {
      setBusy(false);
    }
  };

  const useLink = async () => {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) return notify("Paste a full web address that starts with https://");
    setBusy(true);
    try {
      await loadImage(url);
      set({ ...NO_PAINT, fillSrc: url, fillKind: "image", ...framing });
      setLink("");
      notify("Picture added");
    } catch {
      notify("That site doesn't let other sites use its pictures. Save the picture and upload it instead.");
    } finally {
      setBusy(false);
    }
  };

  const mediaUrl = resolveSrc(el.fillSrc);
  const label =
    tab === "solid"
      ? (() => {
          const p = parseColor(el.fill);
          return p ? toHex(p).toUpperCase() : "Colour";
        })()
      : tab === "gradient"
        ? `${el.fillGradient?.type === "radial" ? "Radial" : "Linear"} gradient`
        : tab === "pattern"
          ? `Pattern · ${PATTERNS.find((p) => p.id === el.fillPattern?.kind)?.label ?? ""}`
          : tab === "image"
            ? "Image or GIF"
            : tab === "video"
              ? "Video"
              : "No fill";
  const preview: React.CSSProperties =
    tab === "solid"
      ? { background: el.fill }
      : tab === "gradient" && el.fillGradient
        ? { background: gradientCss(el.fillGradient) }
        : tab === "pattern" && el.fillPattern
          ? { background: el.fillPattern.bg }
          : {};

  return (
    <>
      <Row label="Fill">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-white py-1 pr-2 pl-1 text-xs text-zinc-700 hover:border-zinc-300", open ? "border-violet-400" : "border-zinc-200")}
          title="Change what fills this shape"
        >
          <span className="checker relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 text-zinc-400" style={preview}>
            {(tab === "image" || tab === "video") && hasMedia && mediaUrl ? (
              tab === "video" ? <video src={`${mediaUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={mediaUrl} className="h-full w-full object-cover" />
            ) : tab === "pattern" ? (
              <MdBlurOn className="text-sm" style={{ color: el.fillPattern?.color }} />
            ) : tab === "none" ? (
              <FiSlash />
            ) : null}
          </span>
          <span className="flex-1 truncate text-left font-medium">{label}</span>
          <FiChevronDown className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </button>
      </Row>

      <input
        ref={file}
        type="file"
        hidden
        accept={tab === "video" ? "video/*" : "image/*"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void useFile(f);
        }}
      />

      {open && (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
          <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => choose(t.id)}
                className={cn("flex h-8 flex-1 items-center justify-center rounded-md text-base transition", tab === t.id ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {tab === "solid" && <ColorPanel value={el.fill && el.fill !== "transparent" ? el.fill : "#7c3aed"} onChange={(c, h) => set({ fill: c }, h)} />}

          {tab === "gradient" && el.fillGradient && (
            <GradientEditor
              g={el.fillGradient}
              stop={Math.min(stop, el.fillGradient.stops.length - 1)}
              setStop={setStop}
              onChange={(g, history) => set({ fillGradient: g }, history)}
              checkpoint={checkpoint}
            />
          )}

          {tab === "pattern" && el.fillPattern && <PatternEditor p={el.fillPattern} onChange={(p, h) => set({ fillPattern: p }, h)} />}

          {(tab === "image" || tab === "video") && (
            <div className="space-y-3">
              <button
                onClick={() => file.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <FiUpload /> {busy ? "Adding…" : hasMedia ? "Replace from device" : tab === "video" ? "Choose a video" : "Choose from device"}
              </button>
              {tab === "image" && (
                <div className="flex items-center gap-1.5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2">
                    <FiLink className="shrink-0 text-zinc-400" />
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void useLink()}
                      placeholder="Or paste an image link"
                      className="w-full min-w-0 bg-transparent py-1.5 text-xs outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <button onClick={() => void useLink()} disabled={!link.trim() || busy} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                    Use
                  </button>
                </div>
              )}
              {hasMedia ? (
                <>
                  <Slider label="Zoom" value={Math.round((el.cropZoom ?? 1) * 100)} min={100} max={300} unit="%" onChange={(v, h) => set({ cropZoom: v / 100 }, h)} />
                  <Slider label="Pan ↔" value={Math.round((el.cropX ?? 0.5) * 100)} min={0} max={100} unit="%" onChange={(v, h) => set({ cropX: v / 100 }, h)} />
                  <Slider label="Pan ↕" value={Math.round((el.cropY ?? 0.5) * 100)} min={0} max={100} unit="%" onChange={(v, h) => set({ cropY: v / 100 }, h)} />
                </>
              ) : (
                <p className="text-[11px] text-zinc-400">{tab === "video" ? "The video fills the shape and loops while you play or export." : "The picture fills the shape. GIFs keep moving on screen."}</p>
              )}
            </div>
          )}

          {tab === "none" && <p className="text-[11px] text-zinc-400">The shape is see-through. Use the border below to keep it visible.</p>}
        </div>
      )}
    </>
  );
}

/** Gradient bar with draggable colour stops, type, angle and the selected stop's colour. */
function GradientEditor({ g, stop, setStop, onChange, checkpoint }: { g: Gradient; stop: number; setStop: (i: number) => void; onChange: (g: Gradient, history: boolean) => void; checkpoint: () => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const sel = g.stops[stop] ?? g.stops[0];

  const dragStop = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setStop(i);
    checkpoint();
    const r = bar.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const pos = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      onChange({ ...g, stops: g.stops.map((s, k) => (k === i ? { ...s, pos: Math.round(pos * 100) / 100 } : s)) }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const addStop = (e: React.PointerEvent) => {
    const r = bar.current!.getBoundingClientRect();
    const pos = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100) / 100;
    const sorted = sortedStops(g);
    const near = sorted.reduce((a, b) => (Math.abs(b.pos - pos) < Math.abs(a.pos - pos) ? b : a));
    const stops = [...g.stops, { pos, color: near.color }];
    onChange({ ...g, stops }, true);
    setStop(stops.length - 1);
  };

  return (
    <div className="space-y-3">
      <Segmented
        value={g.type}
        onChange={(t) => onChange({ ...g, type: t }, true)}
        options={[
          { id: "linear", label: "Linear" },
          { id: "radial", label: "Radial" },
        ]}
      />
      <div ref={bar} onPointerDown={addStop} title="Click the bar to add a colour stop" className="checker relative mx-1.5 mt-1 h-5 cursor-copy rounded-md border border-black/10">
        <div className="absolute inset-0 rounded-md" style={{ background: gradientCss({ type: "linear", angle: 90, stops: g.stops }) }} />
        {g.stops.map((s, i) => (
          <button
            key={i}
            onPointerDown={(e) => dragStop(i, e)}
            title="Drag to move this colour"
            className={cn("absolute top-1/2 h-5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-[4px] border-2 shadow", i === stop ? "border-violet-600" : "border-white")}
            style={{ left: `${s.pos * 100}%`, background: s.color }}
          />
        ))}
      </div>
      {g.type === "linear" && <Slider label="Angle" value={g.angle} min={0} max={360} unit="°" onChange={(v, h) => onChange({ ...g, angle: v }, h)} />}
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Stop {stop + 1} of {g.stops.length} · {Math.round(sel.pos * 100)}%
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onChange({ ...g, stops: g.stops.map((s) => ({ ...s, pos: 1 - s.pos })) }, true)}
            className="rounded-md bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200"
            title="Flip the colours end to end"
          >
            Reverse
          </button>
          <button
            disabled={g.stops.length <= 2}
            onClick={() => {
              onChange({ ...g, stops: g.stops.filter((_, i) => i !== stop) }, true);
              setStop(0);
            }}
            className="rounded-md bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200 disabled:opacity-40"
          >
            Remove stop
          </button>
        </div>
      </div>
      <ColorPanel value={sel.color} onChange={(c, h) => onChange({ ...g, stops: g.stops.map((s, i) => (i === stop ? { ...s, color: c } : s)) }, h)} />
    </div>
  );
}

function PatternEditor({ p, onChange }: { p: Pattern; onChange: (p: Pattern, history: boolean) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {PATTERNS.map((k) => {
          const tile = patternTile({ ...p, kind: k.id, size: 14 });
          return (
            <button
              key={k.id}
              onClick={() => onChange({ ...p, kind: k.id }, true)}
              className={cn("overflow-hidden rounded-lg border text-center text-[10px] font-medium text-zinc-600 transition hover:border-violet-300", p.kind === k.id ? "border-violet-500 ring-2 ring-violet-200" : "border-zinc-200")}
            >
              <svg width="100%" height="34" className="block">
                <defs>
                  <pattern id={`pp-${k.id}`} patternUnits="userSpaceOnUse" width={tile.w} height={tile.h}>
                    <rect width={tile.w} height={tile.h} fill={p.bg} />
                    {tile.prims.map((q, i) => (q.t === "rect" ? <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={p.color} /> : <circle key={i} cx={q.x} cy={q.y} r={q.r} fill={p.color} />))}
                  </pattern>
                </defs>
                <rect width="100%" height="34" fill={`url(#pp-${k.id})`} />
              </svg>
              <span className="block bg-white py-1">{k.label}</span>
            </button>
          );
        })}
      </div>
      <Row label="Pattern">
        <ColorPicker value={p.color} onChange={(c, h) => onChange({ ...p, color: c }, h)} />
      </Row>
      <Row label="Background">
        <ColorPicker value={p.bg} onChange={(c, h) => onChange({ ...p, bg: c }, h)} />
      </Row>
      <Slider label="Size" value={p.size} min={6} max={120} unit="px" onChange={(v, h) => onChange({ ...p, size: v }, h)} />
    </div>
  );
}
