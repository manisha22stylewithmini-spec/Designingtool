import { useEffect, useRef, useState, type ReactNode } from "react";
import { SWATCHES } from "../data/presets";
import { cn } from "../lib/cn";
import { useEditor } from "../store";
import { useCurrentBrand } from "../libraryStore";
import type { Project } from "../types";
import { MdColorize } from "react-icons/md";
import { hsvToRgb, parseColor, rgbToHsv, toHex, type HSVA } from "../lib/color";

export function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-zinc-100 px-4 py-4", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-zinc-600">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/** Slider that records a single undo step per drag. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number, history: boolean) => void;
}) {
  const { checkpoint } = useEditor();
  const display = step < 1 ? value.toFixed(1) : Math.round(value);
  return (
    <Row label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={checkpoint}
        onKeyDown={checkpoint}
        onChange={(e) => onChange(parseFloat(e.target.value), false)}
        className="range flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
        {display}
        {unit}
      </span>
    </Row>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  mixed,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  /** several items with different values — shows "Mixed" until you type a number */
  mixed?: boolean;
}) {
  const shown = mixed ? "Mixed" : String(Math.round(value));
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n) && (mixed || Math.round(n) !== Math.round(value))) onChange(n);
    else setDraft(shown);
  };
  return (
    <label className="flex min-w-0 flex-1 items-center rounded-lg border border-zinc-200 bg-white px-2 focus-within:border-violet-500">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      <input
        value={draft}
        onFocus={(e) => mixed && e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-xs tabular-nums outline-none"
      />
      {suffix && <span className="text-[11px] text-zinc-400">{suffix}</span>}
    </label>
  );
}

/** Colours already used in the design (solid colours, gradient stops, text, borders). */
function designColours(project: Project): string[] {
  const set = new Set<string>();
  const add = (c?: string) => {
    const rgba = parseColor(c);
    if (c && rgba && rgba.a > 0) set.add(toHex({ ...rgba, a: 1 }).toLowerCase());
  };
  for (const p of project.pages) {
    if (p.background.kind === "solid") add(p.background.color);
    if (p.background.kind === "gradient") {
      add(p.background.from);
      add(p.background.to);
    }
    for (const e of p.elements) {
      add(e.color);
      add(e.fill);
      e.fillGradient?.stops.forEach((st) => add(st.color));
      if (e.fillPattern) {
        add(e.fillPattern.color);
        add(e.fillPattern.bg);
      }
      if ((e.strokeWidth ?? 0) > 0) add(e.stroke);
      if (e.effect && e.effect !== "none") add(e.effectColor);
    }
  }
  return [...set].slice(0, 30);
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * The colour picker itself: saturation / brightness square, hue and opacity sliders,
 * eyedropper, hex + opacity fields and swatches (this page, brand, basics) — like Figma's.
 */
export function ColorPanel({ value, onChange }: { value: string; onChange: (v: string, history: boolean) => void }) {
  const { checkpoint, project } = useEditor();
  const brand = useCurrentBrand();
  const rgba = parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 };
  // keep our own HSV so the hue / saturation don't jump around when the colour is grey or black
  const [hsv, setHsv] = useState<HSVA>(() => rgbToHsv(rgba));
  const emitted = useRef(toHex(rgba));
  useEffect(() => {
    const cur = toHex(rgba);
    if (cur !== emitted.current) {
      emitted.current = cur;
      setHsv(rgbToHsv(rgba));
    }
  });
  const [hexText, setHexText] = useState<string | null>(null);
  const [source, setSource] = useState<"page" | "brand" | "basics">("page");

  const push = (next: HSVA, history: boolean) => {
    setHsv(next);
    const hex = toHex(hsvToRgb(next));
    emitted.current = hex;
    onChange(hex, history);
  };
  const pick = (c: string) => {
    const p = parseColor(c);
    if (!p) return;
    // swatches keep the opacity you already chose
    push(rgbToHsv({ ...p, a: p.a < 1 ? p.a : hsv.a }), true);
  };

  const drag = (el: HTMLElement, e: React.PointerEvent, apply: (x: number, y: number) => void) => {
    e.preventDefault();
    checkpoint();
    const r = el.getBoundingClientRect();
    const go = (ev: { clientX: number; clientY: number }) => apply(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    go(e);
    const move = (ev: PointerEvent) => go(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const sources = [
    { id: "page" as const, label: "On this page", colours: designColours(project) },
    ...(brand && brand.colors.length ? [{ id: "brand" as const, label: `${brand.name} colours`, colours: brand.colors }] : []),
    { id: "basics" as const, label: "Basics", colours: SWATCHES },
  ];
  const active = sources.find((x) => x.id === source) ?? sources[0];
  const hex6 = toHex({ ...hsvToRgb(hsv), a: 1 }).slice(1).toUpperCase();
  const solid = `hsl(${hsv.h} 100% 50%)`;
  const rgb6 = toHex({ ...hsvToRgb(hsv), a: 1 });

  const commitHex = () => {
    if (hexText === null) return;
    const p = parseColor(hexText.trim().startsWith("#") ? hexText : "#" + hexText);
    setHexText(null);
    if (p) push(rgbToHsv({ ...p, a: /^#?[0-9a-f]{8}$/i.test(hexText.trim()) ? p.a : hsv.a }), true);
  };

  return (
    <div className="space-y-3">
      <div
        className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-lg"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${solid})` }}
        onPointerDown={(e) => drag(e.currentTarget, e, (x, y) => push({ ...hsv, s: x, v: 1 - y }, false))}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: rgb6 }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        {"EyeDropper" in window ? (
          <button
            type="button"
            title="Pick a colour from anywhere on your screen"
            onClick={async () => {
              try {
                const { sRGBHex } = await new (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper().open();
                pick(sRGBHex);
              } catch {
                /* cancelled */
              }
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <MdColorize />
          </button>
        ) : (
          <span className="checker h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ background: toHex(hsvToRgb(hsv)) }} />
        )}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div
            className="relative h-3 w-full cursor-pointer touch-none rounded-full"
            style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
            onPointerDown={(e) => drag(e.currentTarget, e, (x) => push({ ...hsv, h: Math.min(359.9, x * 360) }, false))}
          >
            <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]" style={{ left: `${(hsv.h / 360) * 100}%`, background: solid }} />
          </div>
          <div className="checker relative h-3 w-full cursor-pointer touch-none rounded-full" onPointerDown={(e) => drag(e.currentTarget, e, (x) => push({ ...hsv, a: Math.round(x * 100) / 100 }, false))}>
            <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${rgb6})` }} />
            <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]" style={{ left: `${hsv.a * 100}%`, background: rgb6 }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center rounded-lg border border-zinc-200 bg-white px-2 focus-within:border-violet-500">
          <span className="mr-1.5 text-[11px] text-zinc-400">Hex</span>
          <input
            value={hexText ?? hex6}
            onChange={(e) => setHexText(e.target.value.replace(/[^0-9a-fA-F#]/g, "").slice(0, 9))}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), undefined)}
            spellCheck={false}
            className="w-full min-w-0 bg-transparent py-1.5 font-mono text-xs uppercase outline-none"
          />
        </label>
        <label className="flex w-20 items-center rounded-lg border border-zinc-200 bg-white px-2 focus-within:border-violet-500">
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(hsv.a * 100)}
            onChange={(e) => push({ ...hsv, a: Math.min(1, Math.max(0, Number(e.target.value) / 100)) }, true)}
            className="w-full min-w-0 bg-transparent py-1.5 text-xs outline-none"
          />
          <span className="text-[11px] text-zinc-400">%</span>
        </label>
      </div>

      <div>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-violet-500">
          {sources.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        {active.colours.length ? (
          <div className="grid grid-cols-9 gap-1.5">
            {active.colours.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                className={cn("h-6 w-full rounded-md border border-black/10 transition hover:scale-110", c.toLowerCase() === "#" + hex6.toLowerCase() && "ring-2 ring-violet-500 ring-offset-1")}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-400">No colours here yet.</p>
        )}
      </div>
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string, history: boolean) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const p = parseColor(value);
  const shown = p ? toHex(p).toUpperCase() : "custom";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white py-1 pr-2.5 pl-1 text-xs hover:border-zinc-300"
        title={label ?? "Change colour"}
      >
        <span className="checker h-6 w-6 rounded-md border border-black/10" style={{ background: value }} />
        <span className="font-mono text-zinc-600 uppercase">{shown}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
          <ColorPanel value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-lg bg-zinc-100 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          title={o.title}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 transition",
            value === o.id ? "bg-white text-zinc-900 shadow-sm" : "hover:text-zinc-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconBtn({
  onClick,
  title,
  children,
  active,
  disabled,
  danger,
  className,
}: {
  onClick?: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-35",
        active && "bg-violet-100 text-violet-700 hover:bg-violet-100 hover:text-violet-700",
        danger && "hover:bg-red-50 hover:text-red-600",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-zinc-600">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-violet-600" : "bg-zinc-300")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  style,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={style}
      className={cn("w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-violet-500", className)}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
