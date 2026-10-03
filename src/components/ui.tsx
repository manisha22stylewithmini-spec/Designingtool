import { useEffect, useRef, useState, type ReactNode } from "react";
import { SWATCHES } from "../data/presets";
import { cn } from "../lib/cn";
import { useEditor } from "../store";
import type { Project } from "../types";
import { MdColorize } from "react-icons/md";

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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);
  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n) && Math.round(n) !== Math.round(value)) onChange(n);
    else setDraft(String(Math.round(value)));
  };
  return (
    <label className="flex min-w-0 flex-1 items-center rounded-lg border border-zinc-200 bg-white px-2 focus-within:border-violet-500">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-xs tabular-nums outline-none"
      />
      {suffix && <span className="text-[11px] text-zinc-400">{suffix}</span>}
    </label>
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
  const { checkpoint, project } = useEditor();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const hex = value.startsWith("#") && value.length === 7 ? value : "#000000";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white py-1 pr-2.5 pl-1 text-xs hover:border-zinc-300"
        title={label ?? "Change colour"}
      >
        <span className="checker h-6 w-6 rounded-md border border-black/10" style={{ background: value }} />
        <span className="font-mono text-zinc-600 uppercase">{value.startsWith("#") ? value : "custom"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-60 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
          {open && <DesignColours project={project} value={value} onPick={(c) => onChange(c, true)} />}
          <p className="mb-2 text-[11px] font-semibold text-zinc-500 uppercase">Colours</p>
          <div className="grid grid-cols-10 gap-1">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c, true)}
                className={cn("h-5 w-5 rounded-md border border-black/10 transition hover:scale-110", c === value && "ring-2 ring-violet-500 ring-offset-1")}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs text-zinc-600 hover:bg-zinc-50">
            <input
              type="color"
              value={hex}
              onPointerDown={checkpoint}
              onFocus={checkpoint}
              onChange={(e) => onChange(e.target.value, false)}
              className="h-6 w-8 cursor-pointer"
            />
            Pick any colour…
          </label>
          {"EyeDropper" in window && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const Dropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                  const { sRGBHex } = await new Dropper().open();
                  onChange(sRGBHex, true);
                } catch {
                  /* cancelled */
                }
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-zinc-200 p-2 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              <MdColorize className="text-base" /> Pick a colour from your photo / screen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Colours already used in the design, so it's easy to stay consistent. */
function DesignColours({ project, value, onPick }: { project: Project; value: string; onPick: (c: string) => void }) {
  const set = new Set<string>();
  const add = (c?: string) => c && /^#[0-9a-f]{6}$/i.test(c) && set.add(c.toLowerCase());
  for (const p of project.pages) {
    if (p.background.kind === "solid") add(p.background.color);
    if (p.background.kind === "gradient") {
      add(p.background.from);
      add(p.background.to);
    }
    for (const e of p.elements) {
      add(e.color);
      add(e.fill);
      if ((e.strokeWidth ?? 0) > 0) add(e.stroke);
      if (e.effect && e.effect !== "none") add(e.effectColor);
    }
  }
  const colours = [...set].slice(0, 20);
  if (!colours.length) return null;
  return (
    <>
      <p className="mb-2 text-[11px] font-semibold text-zinc-500 uppercase">In your design</p>
      <div className="mb-3 grid grid-cols-10 gap-1">
        {colours.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            className={cn("h-5 w-5 rounded-md border border-black/10 transition hover:scale-110", c === value.toLowerCase() && "ring-2 ring-violet-500 ring-offset-1")}
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>
    </>
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
