import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiArrowDown,
  FiArrowUp,
  FiChevronsDown,
  FiChevronsUp,
  FiCopy,
  FiLock,
  FiTrash2,
  FiUnlock,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import {
  MdAlignHorizontalCenter,
  MdAlignHorizontalLeft,
  MdAlignHorizontalRight,
  MdAlignVerticalBottom,
  MdAlignVerticalCenter,
  MdAlignVerticalTop,
  MdFlip,
  MdOutlineFormatPaint,
} from "react-icons/md";
import { findPlatform, findVariant } from "../data/platforms";
import { fontDef } from "../data/fonts";
import { FontPicker } from "./FontPicker";
import { cn } from "../lib/cn";
import { coverFrame, filterCss, fitFrame, uid } from "../lib/factory";
import { mediaRatio } from "../lib/images";
import { resolveSrc } from "../lib/media";
import { bounds, shapePath } from "../lib/geometry";
import { TEXT_EFFECTS, textEffectCss } from "../lib/textEffects";
import type { ShapeKind } from "../types";
import { useActions } from "./useActions";
import { useEditor } from "../store";
import type { El } from "../types";
import { bgCss } from "../lib/background";
import { ColorPicker, IconBtn, NumberField, Row, Section, Segmented, Select, Slider, Toggle } from "./ui";

const WEIGHT_NAMES: Record<number, string> = { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };

const MASKS: (ShapeKind | "none")[] = ["none", "ellipse", "heart", "star", "hexagon", "diamond", "triangle", "bubble", "arrow"];

const FILTER_PRESETS: { name: string; v: Partial<El> }[] = [
  { name: "Original", v: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, blur: 0 } },
  { name: "B & W", v: { brightness: 100, contrast: 115, saturation: 100, grayscale: 100, blur: 0 } },
  { name: "Vivid", v: { brightness: 105, contrast: 112, saturation: 160, grayscale: 0, blur: 0 } },
  { name: "Soft", v: { brightness: 112, contrast: 85, saturation: 80, grayscale: 0, blur: 0 } },
  { name: "Drama", v: { brightness: 90, contrast: 145, saturation: 90, grayscale: 0, blur: 0 } },
  { name: "Dreamy", v: { brightness: 110, contrast: 95, saturation: 120, grayscale: 0, blur: 1.5 } },
];

export function PropertiesPanel({ onOpenTab }: { onOpenTab: (t: "frames" | "background" | "text" | "templates") => void }) {
  const ed = useEditor();
  const actions = useActions();
  const { doc, selectedEls: sel, selected, updateEls, update, setSelected, notify } = ed;

  if (!sel.length) {
    const p = findPlatform(doc.frame.platformId);
    const v = findVariant(doc.frame.platformId, doc.frame.variantId);
    return (
      <div>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">Page</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Nothing is selected. <b>Click any item</b> on your design to change its colour, size, font and more.
          </p>
        </div>
        <Section title="Frame">
          <button onClick={() => onOpenTab("frames")} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 p-3 text-left hover:border-violet-300">
            <span>
              <span className="block text-xs font-semibold">
                {p.name} · {v?.name}
              </span>
              <span className="block text-[11px] text-zinc-500">
                {doc.frame.w} × {doc.frame.h} px
              </span>
            </span>
            <span className="text-xs font-medium text-violet-600">Change</span>
          </button>
        </Section>
        <Section title="Background">
          <button onClick={() => onOpenTab("background")} className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 p-2 text-left hover:border-violet-300">
            <span className="h-10 w-10 rounded-lg border border-black/10" style={bgCss(doc.background)} />
            <span className="flex-1 text-xs text-zinc-600">Colour, gradient or photo</span>
            <span className="pr-1 text-xs font-medium text-violet-600">Edit</span>
          </button>
        </Section>
        <Section title="Quick start">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onOpenTab("text")} className="rounded-xl bg-zinc-100 p-3 text-xs font-medium hover:bg-zinc-200">
              ✍️ Add text
            </button>
            <button onClick={() => onOpenTab("templates")} className="rounded-xl bg-zinc-100 p-3 text-xs font-medium hover:bg-zinc-200">
              🎨 Use a template
            </button>
          </div>
        </Section>
        <Section title="Shortcuts">
          <ul className="space-y-1.5 text-[11px] text-zinc-500">
            {[
              ["Double-click text", "type"],
              ["Shift + click", "select many"],
              ["Arrow keys", "nudge (Shift = 10px)"],
              ["⌘/Ctrl + D", "duplicate"],
              ["⌘/Ctrl + Z", "undo"],
              ["Delete", "remove"],
              ["Alt while dragging", "turn off snapping"],
            ].map(([k, d]) => (
              <li key={k} className="flex justify-between">
                <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-sans text-zinc-700">{k}</kbd>
                {d}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    );
  }

  const el = sel[0];
  const single = sel.length === 1;
  const ids = selected;
  const set = (patch: Partial<El>, history = true) => updateEls(ids, patch, history);
  const allText = sel.every((e) => e.type === "text");
  const allShape = sel.every((e) => e.type === "shape");
  const locked = sel.every((e) => e.locked);

  const align = (how: "left" | "hc" | "right" | "top" | "vc" | "bottom") =>
    updateEls(ids, (e) => {
      const b = bounds(e);
      const W = doc.frame.w;
      const H = doc.frame.h;
      switch (how) {
        case "left":
          return { x: e.x - b.left };
        case "hc":
          return { x: W / 2 - e.w / 2 };
        case "right":
          return { x: e.x + (W - b.right) };
        case "top":
          return { y: e.y - b.top };
        case "vc":
          return { y: H / 2 - e.h / 2 };
        case "bottom":
          return { y: e.y + (H - b.bottom) };
      }
    });

  const reorder = (dir: "up" | "down" | "top" | "bottom") =>
    update((d) => {
      const els = [...d.elements];
      const moving = els.filter((e) => ids.includes(e.id));
      if (dir === "top") return { ...d, elements: [...els.filter((e) => !ids.includes(e.id)), ...moving] };
      if (dir === "bottom") return { ...d, elements: [...moving, ...els.filter((e) => !ids.includes(e.id))] };
      const order = dir === "up" ? [...els.keys()].reverse() : [...els.keys()];
      for (const i of order) {
        if (!ids.includes(els[i].id)) continue;
        const j = dir === "up" ? i + 1 : i - 1;
        if (j < 0 || j >= els.length || ids.includes(els[j].id)) continue;
        [els[i], els[j]] = [els[j], els[i]];
      }
      return { ...d, elements: els };
    });

  const typeLabel = single ? (el.type === "text" ? "Text" : el.type === "image" ? "Photo" : el.type === "video" ? "Video clip" : el.name) : `${sel.length} items`;

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-violet-600 uppercase">Editing</p>
          <h2 className="truncate text-sm font-semibold text-zinc-900">{typeLabel}</h2>
        </div>
        <button onClick={() => setSelected([])} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100">
          Done
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-100 px-3 pb-3">
        <IconBtn
          title="Duplicate"
          onClick={() => {
            const copies = sel.map((e) => ({ ...e, id: uid(), x: e.x + 24, y: e.y + 24 }));
            update((d) => ({ ...d, elements: [...d.elements, ...copies] }));
            setSelected(copies.map((c) => c.id));
            notify("Duplicated");
          }}
        >
          <FiCopy />
        </IconBtn>
        <IconBtn title={locked ? "Unlock" : "Lock (stops accidental moves)"} onClick={() => set({ locked: !locked })} active={locked}>
          {locked ? <FiLock /> : <FiUnlock />}
        </IconBtn>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <IconBtn title="Bring to front" onClick={() => reorder("top")}>
          <FiChevronsUp />
        </IconBtn>
        <IconBtn title="Bring forward" onClick={() => reorder("up")}>
          <FiArrowUp />
        </IconBtn>
        <IconBtn title="Send backward" onClick={() => reorder("down")}>
          <FiArrowDown />
        </IconBtn>
        <IconBtn title="Send to back" onClick={() => reorder("bottom")}>
          <FiChevronsDown />
        </IconBtn>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <IconBtn title="Copy style (⌘⌥C)" onClick={actions.copyStyle}>
          <MdOutlineFormatPaint />
        </IconBtn>
        <IconBtn title="Paste style (⌘⌥V)" onClick={actions.pasteStyle} disabled={!actions.hasStyle()}>
          <MdOutlineFormatPaint className="rotate-180" />
        </IconBtn>
        <span className="flex-1" />
        <IconBtn
          title="Delete"
          danger
          onClick={() => {
            update((d) => ({ ...d, elements: d.elements.filter((e) => !ids.includes(e.id)) }));
            setSelected([]);
            notify("Deleted — ⌘Z to undo");
          }}
        >
          <FiTrash2 />
        </IconBtn>
      </div>

      {/* ---------- Text ---------- */}
      {allText && (
        <Section title="Text">
          {single && (
            <textarea
              value={el.text}
              onFocus={ed.checkpoint}
              onChange={(e) => set({ text: e.target.value }, false)}
              rows={2}
              className="w-full resize-y rounded-lg border border-zinc-200 p-2 text-xs outline-none focus:border-violet-500"
            />
          )}
          <FontPicker
            value={el.fontFamily ?? "Inter"}
            onChange={(v) => {
              // keep the weight if the new font has it, otherwise use its closest weight
              const ws = fontDef(v)?.weights ?? [400];
              const w = el.fontWeight ?? 400;
              set({ fontFamily: v, fontWeight: ws.includes(w) ? w : ws.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)) });
            }}
          />
          <div className="flex gap-2">
            <NumberField label="Size" value={el.fontSize ?? 32} onChange={(n) => set({ fontSize: Math.max(4, n) })} />
            <Select
              value={String(el.fontWeight ?? 400)}
              onChange={(v) => set({ fontWeight: Number(v) })}
              options={(fontDef(el.fontFamily)?.weights ?? [400, 700]).map((w) => ({ id: String(w), label: WEIGHT_NAMES[w] ?? String(w) }))}
              className="flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[0.5, 0.75, 1.25, 1.5, 2].map((k) => (
              <button
                key={k}
                onClick={() => set({ fontSize: Math.round((el.fontSize ?? 32) * k) })}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-200"
                title={`Make text ${k < 1 ? "smaller" : "bigger"}`}
              >
                {k < 1 ? "−" : "+"}
                {Math.round(Math.abs(k - 1) * 100)}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <IconBtn title="Italic" active={el.italic} onClick={() => set({ italic: !el.italic })}>
              <span className="font-serif italic">I</span>
            </IconBtn>
            <IconBtn title="Underline" active={el.underline} onClick={() => set({ underline: !el.underline })}>
              <span className="underline">U</span>
            </IconBtn>
            <Select
              value={el.textCase ?? (el.uppercase ? "upper" : "none")}
              onChange={(v) => set({ textCase: v, uppercase: false })}
              options={[
                { id: "none", label: "Aa — as typed" },
                { id: "upper", label: "AA — UPPERCASE" },
                { id: "lower", label: "aa — lowercase" },
                { id: "title", label: "Aa — Title Case" },
              ]}
              className="w-16 px-1"
            />
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <Segmented
              className="flex-1"
              value={el.align ?? "center"}
              onChange={(a) => set({ align: a })}
              options={[
                { id: "left", label: <FiAlignLeft />, title: "Align left" },
                { id: "center", label: <FiAlignCenter />, title: "Align centre" },
                { id: "right", label: <FiAlignRight />, title: "Align right" },
              ]}
            />
          </div>
          <Row label="Colour">
            <ColorPicker value={el.color ?? "#000000"} onChange={(c, h) => set({ color: c }, h)} />
          </Row>
          <Slider
            label="Spacing"
            value={(el.letterSpacing ?? 0) / ((el.fontSize ?? 32) / 100)}
            min={-10}
            max={60}
            onChange={(v, h) => set({ letterSpacing: (v * (el.fontSize ?? 32)) / 100 }, h)}
          />
          <Slider label="Line height" value={el.lineHeight ?? 1.2} min={0.7} max={2.5} step={0.05} onChange={(v, h) => set({ lineHeight: v }, h)} />
        </Section>
      )}

      {allText && (
        <Section title="Text effects">
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_EFFECTS.map((fx) => {
              const active = (el.effect ?? "none") === fx.id;
              const sample = { ...el, fontSize: 22, letterSpacing: 0, effect: fx.id, effectColor: active ? el.effectColor : fx.color, effectSize: 60 } as El;
              return (
                <button
                  key={fx.id}
                  title={fx.hint}
                  onClick={() =>
                    set({ effect: fx.id, effectColor: active ? el.effectColor : el.effectColor && el.effect !== "none" ? el.effectColor : fx.color, effectSize: el.effectSize ?? 50 })
                  }
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border pt-2 pb-1.5 transition",
                    active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-zinc-200 hover:border-violet-300",
                  )}
                >
                  <span
                    className="flex h-7 items-center text-[22px] leading-none font-black"
                    style={{ fontFamily: `"${el.fontFamily}"`, color: fx.id === "neon" ? "#fff" : "#27272a", ...textEffectCss({ ...sample, color: fx.id === "neon" ? "#fff" : "#27272a" }) }}
                  >
                    {fx.id === "highlight" ? <span style={{ background: sample.effectColor, padding: "0 4px", borderRadius: 4 }}>Ag</span> : "Ag"}
                  </span>
                  <span className="text-[10px] text-zinc-600">{fx.label}</span>
                </button>
              );
            })}
          </div>
          {el.effect && el.effect !== "none" && (
            <>
              <Slider
                label={el.effect === "highlight" ? "Roundness" : "Strength"}
                value={el.effectSize ?? 50}
                min={0}
                max={100}
                onChange={(v, h) => set({ effectSize: v }, h)}
              />
              {el.effect !== "hollow" && el.effect !== "lift" && (
                <Row label="Effect colour">
                  <ColorPicker value={el.effectColor ?? "#000000"} onChange={(c, h) => set({ effectColor: c }, h)} />
                </Row>
              )}
            </>
          )}
        </Section>
      )}

      {/* ---------- Shape ---------- */}
      {allShape && (
        <Section title="Shape style">
          <Row label="Fill">
            {el.fill === "transparent" ? (
              <button onClick={() => set({ fill: "#7c3aed" })} className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50">
                No fill · add
              </button>
            ) : (
              <>
                <ColorPicker value={el.fill ?? "#000"} onChange={(c, h) => set({ fill: c }, h)} />
                {el.shape !== "line" && (
                  <button onClick={() => set({ fill: "transparent", strokeWidth: el.strokeWidth || 6 })} className="text-[11px] text-zinc-400 hover:text-zinc-700">
                    remove
                  </button>
                )}
              </>
            )}
          </Row>
          {el.shape !== "line" && (
            <>
              <Slider label="Border" value={el.strokeWidth ?? 0} min={0} max={Math.round(Math.min(el.w, el.h) / 4)} onChange={(v, h) => set({ strokeWidth: v }, h)} />
              {(el.strokeWidth ?? 0) > 0 && (
                <Row label="Border colour">
                  <ColorPicker value={el.stroke ?? "#000"} onChange={(c, h) => set({ stroke: c }, h)} />
                </Row>
              )}
            </>
          )}
          {(el.shape === "rect" || el.shape === "line") && (
            <Slider label="Corners" value={el.radius ?? 0} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v, h) => set({ radius: v }, h)} />
          )}
        </Section>
      )}

      {/* ---------- Video ---------- */}
      {single && el.type === "video" && (
        <Section title="Video clip" hint="Plays in Animate mode and in the exported video">
          <div className="flex items-center gap-2">
            <button
              onClick={() => set({ muted: !el.muted })}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium", el.muted ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}
            >
              {el.muted ? <FiVolumeX /> : <FiVolume2 />} {el.muted ? "Sound off" : "Sound on"}
            </button>
            <span className="text-[11px] text-zinc-400">Clip length {(el.videoDuration ?? 0).toFixed(1)}s</span>
          </div>
          {!el.muted && <Slider label="Volume" value={Math.round((el.volume ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v, h) => set({ volume: v / 100 }, h)} />}
          <Slider
            label="Start from"
            value={el.trimStart ?? 0}
            min={0}
            max={Math.max(0, (el.videoDuration ?? 1) - 0.5)}
            step={0.1}
            unit="s"
            onChange={(v, h) => set({ trimStart: v }, h)}
          />
          <Slider
            label="Play for"
            value={el.anim.end - el.anim.start}
            min={0.5}
            max={Math.max(0.5, Math.min(doc.duration - el.anim.start, (el.videoDuration ?? 1) - (el.trimStart ?? 0)))}
            step={0.1}
            unit="s"
            onChange={(v, h) => set({ anim: { ...el.anim, end: el.anim.start + v } }, h)}
          />
          <p className="rounded-lg bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-500">
            Trims the clip: it plays from <b>{(el.trimStart ?? 0).toFixed(1)}s</b> to{" "}
            <b>{((el.trimStart ?? 0) + el.anim.end - el.anim.start).toFixed(1)}s</b> of your video. Drag its bar in the Animate timeline to
            change when it starts.
          </p>
        </Section>
      )}

      {/* ---------- Photo / video look ---------- */}
      {single && (el.type === "image" || el.type === "video") && (
        <>
          <Section title="Fit to frame" hint={el.type === "video" ? "Reels & stories usually fill the whole screen" : "Make your photo the whole post"}>
            <div className="flex gap-2">
              {(
                [
                  ["fill", "⬛ Fill frame", "Covers the whole post — edges may be cropped"],
                  ["fit", "▣ Fit inside", "Shows everything — may leave space around it"],
                ] as const
              ).map(([how, label, tip]) => (
                <button
                  key={how}
                  title={tip}
                  onClick={async () => {
                    try {
                      const r = await mediaRatio(resolveSrc(el.src)!, el.type === "video");
                      set({ ...(how === "fill" ? coverFrame(doc.frame, r) : fitFrame(doc.frame, r)), radius: 0 });
                      notify(how === "fill" ? "Now fills the whole frame" : "Now fits inside the frame");
                    } catch {
                      notify("Couldn't read the file size");
                    }
                  }}
                  className="flex-1 rounded-lg bg-zinc-100 py-2 text-xs font-medium hover:bg-zinc-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Crop & shape" hint="Double-click the photo on the canvas to crop by dragging">
            <div className="flex gap-2">
              <button
                onClick={() => ed.setCropId(el.id)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold",
                  ed.cropId === el.id ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100",
                )}
              >
                ✂️ {ed.cropId === el.id ? "Cropping…" : "Crop & reposition"}
              </button>
              {((el.cropZoom ?? 1) !== 1 || (el.cropX ?? 0.5) !== 0.5 || (el.cropY ?? 0.5) !== 0.5) && (
                <button onClick={() => set({ cropX: 0.5, cropY: 0.5, cropZoom: 1 })} className="rounded-lg bg-zinc-100 px-3 text-xs hover:bg-zinc-200">
                  Reset
                </button>
              )}
            </div>
            <Slider label="Zoom" value={el.cropZoom ?? 1} min={1} max={5} step={0.05} unit="×" onChange={(v, h) => set({ cropZoom: v }, h)} />
            <div>
              <p className="mb-1.5 text-xs text-zinc-600">Cut into a shape</p>
              <div className="grid grid-cols-5 gap-1.5">
                {MASKS.map((m) => {
                  const active = (el.mask ?? "none") === m;
                  return (
                    <button
                      key={m}
                      title={m === "none" ? "No shape" : m}
                      onClick={() => set({ mask: m === "none" ? undefined : m })}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg border",
                        active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-zinc-200 hover:border-violet-300",
                      )}
                    >
                      {m === "none" ? (
                        <span className="text-zinc-400">⊘</span>
                      ) : (
                        <svg width="22" height="22">
                          <path d={shapePath(m, 22, 22)} fill={active ? "#7c3aed" : "#a1a1aa"} />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
          <Section title={el.type === "video" ? "Video filters" : "Photo filters"}>
            <div className="grid grid-cols-3 gap-2">
              {FILTER_PRESETS.map((f) => {
                const preview = { ...el, ...f.v } as El;
                return (
                  <button key={f.name} onClick={() => set(f.v)} className="group text-center">
                    {el.type === "video" ? (
                      <video
                        src={resolveSrc(el.src) + `#t=${(el.trimStart ?? 0) + 0.1}`}
                        muted
                        preload="metadata"
                        className="aspect-square w-full rounded-lg object-cover ring-violet-500 group-hover:ring-2"
                        style={{ filter: filterCss({ ...preview, blur: (preview.blur ?? 0) / 2 }) }}
                      />
                    ) : (
                      <img
                        src={el.src}
                        crossOrigin={el.src?.startsWith("data:") ? undefined : "anonymous"}
                        className="aspect-square w-full rounded-lg object-cover ring-violet-500 group-hover:ring-2"
                        style={{ filter: filterCss({ ...preview, blur: (preview.blur ?? 0) / 2 }) }}
                      />
                    )}
                    <span className="mt-1 block text-[10px] text-zinc-600">{f.name}</span>
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="Adjust">
            <Slider label="Brightness" value={el.brightness ?? 100} min={30} max={180} unit="%" onChange={(v, h) => set({ brightness: v }, h)} />
            <Slider label="Contrast" value={el.contrast ?? 100} min={30} max={200} unit="%" onChange={(v, h) => set({ contrast: v }, h)} />
            <Slider label="Saturation" value={el.saturation ?? 100} min={0} max={250} unit="%" onChange={(v, h) => set({ saturation: v }, h)} />
            <Slider label="Black & white" value={el.grayscale ?? 0} min={0} max={100} unit="%" onChange={(v, h) => set({ grayscale: v }, h)} />
            <Slider label="Blur" value={el.blur ?? 0} min={0} max={20} step={0.5} unit="px" onChange={(v, h) => set({ blur: v }, h)} />
          </Section>
          <Section title="Corners & border">
            {!el.mask && (
              <Slider label="Corners" value={el.radius ?? 0} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v, h) => set({ radius: v }, h)} />
            )}
            <div className="flex gap-2">
              <button onClick={() => set({ mask: undefined, radius: Math.min(el.w, el.h) / 2, w: Math.min(el.w, el.h), h: Math.min(el.w, el.h) })} className="flex-1 rounded-lg bg-zinc-100 py-1.5 text-xs hover:bg-zinc-200">
                ◯ Make circle
              </button>
              <button onClick={() => set({ flipX: !el.flipX })} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-100 py-1.5 text-xs hover:bg-zinc-200">
                <MdFlip /> Flip
              </button>
              <button onClick={() => set({ flipY: !el.flipY })} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-100 py-1.5 text-xs hover:bg-zinc-200">
                <MdFlip className="rotate-90" /> Flip ↕
              </button>
            </div>
            <Slider label="Border" value={el.strokeWidth ?? 0} min={0} max={60} onChange={(v, h) => set({ strokeWidth: v }, h)} />
            {(el.strokeWidth ?? 0) > 0 && (
              <Row label="Border colour">
                <ColorPicker value={el.stroke ?? "#ffffff"} onChange={(c, h) => set({ stroke: c }, h)} />
              </Row>
            )}
            {el.type === "image" && (
            <button
              onClick={() => {
                update((d) => ({ ...d, background: { kind: "image", src: el.src!, dim: 0 }, elements: d.elements.filter((e) => e.id !== el.id) }));
                setSelected([]);
                notify("Photo is now the background");
              }}
              className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs hover:bg-zinc-50"
            >
              Use as page background
            </button>
            )}
          </Section>
        </>
      )}

      {/* ---------- Common ---------- */}
      <Section title="Position">
        <div className="grid grid-cols-6 gap-1">
          {(
            [
              ["left", MdAlignHorizontalLeft, "Align to left edge"],
              ["hc", MdAlignHorizontalCenter, "Centre horizontally"],
              ["right", MdAlignHorizontalRight, "Align to right edge"],
              ["top", MdAlignVerticalTop, "Align to top"],
              ["vc", MdAlignVerticalCenter, "Centre vertically"],
              ["bottom", MdAlignVerticalBottom, "Align to bottom"],
            ] as const
          ).map(([k, Icon, t]) => (
            <IconBtn key={k} title={t} onClick={() => align(k)} className="h-8 border border-zinc-200">
              <Icon />
            </IconBtn>
          ))}
        </div>
        {single && (
          <>
            <div className="flex gap-2">
              <NumberField label="X" value={el.x} onChange={(n) => set({ x: n })} />
              <NumberField label="Y" value={el.y} onChange={(n) => set({ y: n })} />
            </div>
            <div className="flex gap-2">
              <NumberField label="W" value={el.w} onChange={(n) => set({ w: Math.max(4, n) })} />
              {el.type !== "text" ? (
                <NumberField label="H" value={el.h} onChange={(n) => set({ h: Math.max(2, n) })} />
              ) : (
                <div className="flex flex-1 items-center px-2 text-[11px] text-zinc-400">Height: auto</div>
              )}
            </div>
            <Slider label="Rotate" value={el.rotation} min={-180} max={180} unit="°" onChange={(v, h) => set({ rotation: v }, h)} />
          </>
        )}
        <Slider label="Opacity" value={Math.round(el.opacity * 100)} min={0} max={100} unit="%" onChange={(v, h) => set({ opacity: v / 100 }, h)} />
      </Section>

      <Section title="Shadow">
        <Toggle checked={el.shadow.on} onChange={(on) => set({ shadow: { ...el.shadow, on } })} label="Drop shadow" />
        {el.shadow.on && (
          <div className={cn("space-y-3")}>
            <Slider label="Blur" value={el.shadow.blur} min={0} max={120} onChange={(v, h) => updateEls(ids, (e) => ({ shadow: { ...e.shadow, blur: v } }), h)} />
            <Slider label="Offset X" value={el.shadow.x} min={-80} max={80} onChange={(v, h) => updateEls(ids, (e) => ({ shadow: { ...e.shadow, x: v } }), h)} />
            <Slider label="Offset Y" value={el.shadow.y} min={-80} max={80} onChange={(v, h) => updateEls(ids, (e) => ({ shadow: { ...e.shadow, y: v } }), h)} />
            <Row label="Colour">
              <ColorPicker value={el.shadow.color} onChange={(c, h) => updateEls(ids, (e) => ({ shadow: { ...e.shadow, color: c.length === 7 ? c + "66" : c } }), h)} />
            </Row>
          </div>
        )}
      </Section>
    </div>
  );
}
