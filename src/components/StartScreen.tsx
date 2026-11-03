import { useState, type ReactNode } from "react";
import { FiArrowRight } from "react-icons/fi";
import { PLATFORMS, ratioLabel } from "../data/platforms";
import { normKind, POST_KINDS, VIDEO_SIZES } from "../data/postKinds";
import { cn } from "../lib/cn";
import type { Frame, PostKind } from "../types";
import { AspectThumb } from "./FramesPanel";
import { Logo } from "./TopBar";

/** Choose type of post → platform → size. Also used as the "New creative" dialog in the library. */
export function StartScreen({
  onPick,
  onClose,
  title = "What are you creating today?",
  initialKind = "static",
  initialPlatform = "instagram",
  header,
}: {
  onPick: (frame: Frame, kind: PostKind) => void;
  onClose?: () => void;
  title?: string;
  initialKind?: PostKind;
  initialPlatform?: string;
  /** extra fields shown above the choices (brand, date, name…) */
  header?: ReactNode;
}) {
  const [pid, setPid] = useState(PLATFORMS.some((p) => p.id === initialPlatform) ? initialPlatform : "instagram");
  const [kind, setKind] = useState<PostKind>(normKind(initialKind));
  const platform = PLATFORMS.find((p) => p.id === pid)!;
  const video = kind === "animated";

  const pickSize = (w: number, h: number) => {
    // use the platform's own preset when it has one of this size
    const v = platform.variants.find((x) => x.w === w && x.h === h);
    onPick({ platformId: platform.id, variantId: v ? v.id : "custom", w, h }, kind);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-100 px-8 pt-7 pb-5">
          <div className="min-w-0 flex-1">
            <Logo />
            <h1 className="mt-4 text-2xl font-bold text-zinc-900">{title}</h1>
            <p className="mt-1 text-sm text-zinc-500">Choose a type of post, a platform and a size. You can change all of these later.</p>
            {header}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {POST_KINDS.map((k) => {
                const Icon = k.icon;
                return (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition",
                      kind === k.id ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-zinc-900/10 hover:border-zinc-900/25",
                    )}
                  >
                    <Icon className={cn("shrink-0 text-lg", kind === k.id ? "text-violet-600" : "text-zinc-400")} />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{k.label}</span>
                      <span className="block text-[11px] leading-snug text-zinc-500">{k.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="ml-4 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100">
              Cancel
            </button>
          )}
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="thin-scroll w-56 shrink-0 space-y-1 overflow-y-auto border-r border-zinc-100 p-3">
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Platform</p>
            {PLATFORMS.filter((p) => p.id !== "custom").map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setPid(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    pid === p.id ? "bg-violet-100 font-semibold text-violet-800" : "text-zinc-700 hover:bg-zinc-100",
                  )}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: p.color }}>
                    <Icon />
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto p-6">
            {video && (
              <>
                <p className="pb-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Video size — pick what your post needs</p>
                <div className="mb-6 grid grid-cols-4 gap-2">
                  {VIDEO_SIZES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => pickSize(v.w, v.h)}
                      className="group flex flex-col items-center rounded-2xl border border-violet-200 bg-violet-50/40 p-3 text-center transition hover:border-violet-400 hover:shadow-md"
                    >
                      <div className="flex h-16 items-center justify-center">
                        <AspectThumb w={v.w} h={v.h} color="#7c3aed" size={56} />
                      </div>
                      <span className="mt-1 text-xs font-semibold text-zinc-900">
                        {v.label} · {v.ratio}
                      </span>
                      <span className="text-[10px] leading-snug text-zinc-500">{v.use}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="pb-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              {video ? `Or a ${platform.name} size` : `Choose a size for ${platform.name}`}
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {platform.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onPick({ platformId: platform.id, variantId: v.id, w: v.w, h: v.h }, kind)}
                  className="group flex flex-col items-center rounded-2xl border border-zinc-200 p-4 text-center transition hover:border-violet-400 hover:shadow-lg"
                >
                  <div className="flex h-28 items-center justify-center">
                    <AspectThumb w={v.w} h={v.h} color={platform.color} size={96} />
                  </div>
                  <span className="mt-2 text-sm font-semibold text-zinc-900">
                    {v.name} {v.video && "🎬"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {v.w} × {v.h} px · {ratioLabel(v.w, v.h)}
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-400">{v.use}</span>
                  <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-violet-600 opacity-0 transition group-hover:opacity-100">
                    Start designing <FiArrowRight />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
