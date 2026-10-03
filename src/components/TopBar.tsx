import { useLayoutEffect, useRef, useState } from "react";
import { FiCornerUpLeft, FiCornerUpRight, FiDownload, FiFilePlus } from "react-icons/fi";
import { MdOutlineAnimation, MdOutlineBrush } from "react-icons/md";
import { isMotion, POST_KINDS } from "../data/postKinds";
import { cn } from "../lib/cn";
import type { PostKind } from "../types";
import { useEditor } from "../store";
import { IconBtn } from "./ui";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-black text-white shadow">
        P
      </div>
      <span className="text-[15px] font-bold tracking-tight text-zinc-900">
        Post<span className="text-violet-600">Craft</span>
      </span>
    </div>
  );
}

export function TopBar({
  onKind,
  onExport,
  onNew,
}: {
  onKind: (k: PostKind) => void;
  onExport: () => void;
  onNew: () => void;
}) {
  const { undo, redo, canUndo, canRedo, mode, setMode, setPlaying, setTime, kind } = useEditor();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4">
      <Logo />
      <IconBtn title="New design" onClick={onNew}>
        <FiFilePlus />
        <span className="hidden text-xs xl:inline">New</span>
      </IconBtn>

      <KindToggle value={kind} onChange={onKind} />

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <IconBtn title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <FiCornerUpLeft />
        </IconBtn>
        <IconBtn title="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
          <FiCornerUpRight />
        </IconBtn>
      </div>

      {/* Design / Animate only matters for posts that move */}
      {isMotion(kind) && (
        <div className="flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Editor mode">
          {(
            [
              ["design", "Design", MdOutlineBrush],
              ["animate", kind === "reel" ? "Timeline" : "Animate", MdOutlineAnimation],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => {
                if (id === mode) return;
                setMode(id);
                setTime(0);
                // play once so it's obvious what animate mode does
                setPlaying(id === "animate");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                mode === id ? (id === "design" ? "bg-white text-zinc-900 shadow-sm" : "bg-violet-600 text-white shadow-sm") : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              <Icon className="text-base" /> {label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onExport}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
      >
        <FiDownload /> Export
      </button>
    </header>
  );
}

/** Post type picker: one frame, softly outlined options, sliding highlight. */
function KindToggle({ value, onChange }: { value: PostKind; onChange: (k: PostKind) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const idx = POST_KINDS.findIndex((k) => k.id === value);

  useLayoutEffect(() => {
    const measure = () => {
      const b = refs.current[idx];
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth });
    };
    measure();
    // re-measure whenever the buttons change size (fonts loading, window resizing)
    const ro = new ResizeObserver(measure);
    refs.current.forEach((b) => b && ro.observe(b));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [idx]);

  return (
    <div
      ref={wrap}
      role="radiogroup"
      aria-label="Type of post"
      className="relative mx-auto hidden items-center gap-1 rounded-full border border-zinc-900/10 bg-zinc-50 p-1 md:flex"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-zinc-900 shadow-sm transition-all duration-300 ease-out"
        style={{ left: pill.left, width: pill.width }}
      />
      {POST_KINDS.map((k, i) => {
        const active = k.id === value;
        const Icon = k.icon;
        return (
          <button
            key={k.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={active}
            title={`${k.desc} · exports ${k.exports}`}
            onClick={() => onChange(k.id)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200",
              active ? "border-transparent text-white" : "border-zinc-900/10 text-zinc-500 hover:border-zinc-900/25 hover:bg-white hover:text-zinc-900",
            )}
          >
            <Icon className="text-sm" />
            {k.label}
          </button>
        );
      })}
    </div>
  );
}
