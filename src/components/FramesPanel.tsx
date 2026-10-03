import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { findPlatform, PLATFORMS, ratioLabel, type Platform, type Variant } from "../data/platforms";
import { cn } from "../lib/cn";
import { useEditor } from "../store";
import type { Frame } from "../types";
import { NumberField } from "./ui";

export function AspectThumb({ w, h, color, size = 34 }: { w: number; h: number; color: string; size?: number }) {
  const s = size / Math.max(w, h);
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <div className="rounded-[3px] border-2" style={{ width: w * s, height: h * s, borderColor: color, background: color + "1a" }} />
    </div>
  );
}

export function FramesPanel() {
  const { doc, project, setFrame, notify, kind, page } = useEditor();
  const [open, setOpen] = useState<string | null>(doc.frame.platformId);
  const [custom, setCustom] = useState({ w: doc.frame.w, h: doc.frame.h });
  useEffect(() => setCustom({ w: doc.frame.w, h: doc.frame.h }), [doc.frame.w, doc.frame.h]);
  const n = project.pages.length;
  // static designs are independent: each can have its own size
  const canScope = kind === "static" && n > 1;
  const [scope, setScope] = useState<"page" | "all">("page");
  const effScope = canScope ? scope : "all";

  const resize = (frame: Frame, label: string) => {
    setFrame(frame, effScope);
    notify(
      `${label} (${frame.w}×${frame.h}). ${
        effScope === "page" && canScope ? `Only design ${page + 1} changed` : n > 1 ? `All ${n} ${kind === "carousel" ? "slides" : "designs"} were resized` : "Your design was resized to fit"
      } — ⌘Z to undo.`,
    );
  };

  const apply = (p: Platform, v: Variant, w = v.w, h = v.h) => {
    if (doc.frame.platformId === p.id && doc.frame.variantId === v.id && doc.frame.w === w && doc.frame.h === h) return;
    resize({ platformId: p.id, variantId: v.id, w, h }, `Frame changed to ${p.name} · ${v.name}`);
  };
  const customSize = (w: number, h: number, label = "Custom size") => {
    w = Math.max(50, Math.min(5000, Math.round(w)));
    h = Math.max(50, Math.min(5000, Math.round(h)));
    resize({ platformId: "custom", variantId: "custom", w, h }, label);
  };
  const base = Math.max(doc.frame.w, doc.frame.h);

  const current = findPlatform(doc.frame.platformId);

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-zinc-900">Size & canvas</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Pick a platform preset or set any size. Your design is re-fitted, never stretched.
        </p>
      </div>

      {canScope && (
        <div className="mx-3 mb-3 rounded-xl bg-violet-50 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-violet-800">Apply size changes to</p>
          <div className="flex rounded-lg bg-white p-0.5">
            {(
              [
                ["page", `This design (${page + 1})`],
                ["all", `All ${n} designs`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setScope(id)}
                className={cn("flex-1 rounded-md py-1 text-[11px] font-medium", scope === id ? "bg-violet-600 text-white" : "text-zinc-600")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 mb-3 space-y-2.5 rounded-xl border border-zinc-200 p-3">
        <p className="text-xs font-semibold text-zinc-800">Custom size</p>
        <div className="flex gap-2">
          <NumberField label="W" value={custom.w} onChange={(v) => setCustom((c) => ({ ...c, w: v }))} suffix="px" />
          <NumberField label="H" value={custom.h} onChange={(v) => setCustom((c) => ({ ...c, h: v }))} suffix="px" />
        </div>
        <button
          onClick={() => customSize(custom.w, custom.h)}
          disabled={Math.round(custom.w) === doc.frame.w && Math.round(custom.h) === doc.frame.h}
          className="w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-30"
        >
          Resize to {Math.round(custom.w)} × {Math.round(custom.h)}
        </button>
        <div>
          <p className="mb-1 text-[11px] text-zinc-500">Aspect ratio</p>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                [1, 1],
                [4, 5],
                [2, 3],
                [9, 16],
                [16, 9],
                [3, 2],
                [1.91, 1],
                [21, 9],
              ] as const
            ).map(([a, b]) => {
              const w = a >= b ? base : (base * a) / b;
              const h = a >= b ? (base * b) / a : base;
              const on = Math.abs(doc.frame.w / doc.frame.h - a / b) < 0.01;
              return (
                <button
                  key={`${a}:${b}`}
                  onClick={() => customSize(w, h, `Ratio ${a}:${b}`)}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px]", on ? "border-violet-500 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50")}
                >
                  <AspectThumb w={a} h={b} color={on ? "#7c3aed" : "#a1a1aa"} size={18} />
                  {a}:{b}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-zinc-500">Orientation</p>
          <div className="flex gap-1">
            {(
              [
                ["Portrait", Math.min(doc.frame.w, doc.frame.h), Math.max(doc.frame.w, doc.frame.h)],
                ["Square", base, base],
                ["Landscape", Math.max(doc.frame.w, doc.frame.h), Math.min(doc.frame.w, doc.frame.h)],
              ] as const
            ).map(([label, w, h]) => {
              const on = doc.frame.w === w && doc.frame.h === h;
              return (
                <button
                  key={label}
                  onClick={() => !on && customSize(w, h, label)}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px]", on ? "border-violet-500 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50")}
                >
                  <AspectThumb w={w} h={h} color={on ? "#7c3aed" : "#a1a1aa"} size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="px-4 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Platform presets</p>
      <div className="space-y-1.5 px-3 pb-4">
        {PLATFORMS.filter((p) => p.id !== "custom").map((p) => {
          const Icon = p.icon;
          const isOpen = open === p.id;
          const isCurrent = current.id === p.id;
          return (
            <div key={p.id} className={cn("overflow-hidden rounded-xl border", isCurrent ? "border-violet-300 bg-violet-50/40" : "border-zinc-200")}>
              <button
                onClick={() => setOpen(isOpen ? null : p.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: p.color }}>
                  <Icon />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-zinc-900">{p.name}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {p.variants.length} size{p.variants.length > 1 ? "s" : ""}
                    {isCurrent && " · in use"}
                  </span>
                </span>
                <FiChevronDown className={cn("text-zinc-400 transition", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="space-y-1 border-t border-zinc-100 bg-white p-1.5">
                  {p.variants.map((v) => {
                    const active = doc.frame.platformId === p.id && doc.frame.variantId === v.id;
                    if (p.id === "custom")
                      return (
                        <div key={v.id} className="space-y-2 p-2">
                          <div className="flex gap-2">
                            <NumberField label="W" value={custom.w} onChange={(n) => setCustom((c) => ({ ...c, w: n }))} suffix="px" />
                            <NumberField label="H" value={custom.h} onChange={(n) => setCustom((c) => ({ ...c, h: n }))} suffix="px" />
                          </div>
                          <button
                            onClick={() =>
                              apply(p, v, Math.max(50, Math.min(5000, Math.round(custom.w))), Math.max(50, Math.min(5000, Math.round(custom.h))))
                            }
                            className="w-full rounded-lg bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-700"
                          >
                            Use {Math.round(custom.w)} × {Math.round(custom.h)} px
                          </button>
                        </div>
                      );
                    return (
                      <button
                        key={v.id}
                        onClick={() => apply(p, v)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                          active ? "bg-violet-100" : "hover:bg-zinc-50",
                        )}
                      >
                        <AspectThumb w={v.w} h={v.h} color={active ? "#7c3aed" : "#a1a1aa"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                            {v.name}
                            {v.video && <span title="Good for animated / video posts">🎬</span>}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            {v.w}×{v.h} · {ratioLabel(v.w, v.h)}
                          </span>
                          <span className="block truncate text-[11px] text-zinc-400">{v.use}</span>
                        </span>
                        {active && <FiCheck className="text-violet-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
