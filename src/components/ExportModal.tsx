import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiFilm, FiImage, FiX } from "react-icons/fi";
import { findPlatform, findVariant } from "../data/platforms";
import { isMotion } from "../data/postKinds";
import { cn } from "../lib/cn";
import { exportCarousel, exportImage, exportVideo, videoMime } from "../lib/export";
import { preloadDoc, renderDoc } from "../lib/render";
import { docOf, useEditor } from "../store";

type Kind = "png" | "jpeg" | "video";

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { doc, project, page, kind: postKind, notify } = useEditor();
  // Carousels and static design sets can export every page; motion posts export the page you're on.
  const slides = postKind === "carousel" || postKind === "static" ? project.pages.length : 1;
  const noun = postKind === "carousel" ? "slides" : "designs";
  const [scope, setScope] = useState<"all" | "current">(slides > 1 ? "all" : "current");
  const p = findPlatform(doc.frame.platformId);
  const v = findVariant(doc.frame.platformId, doc.frame.variantId);
  const hasVideo = doc.elements.some((e) => e.type === "video");
  const hasAnim = hasVideo || doc.elements.some((e) => e.anim.inType !== "none" || e.anim.loop !== "none" || e.anim.outType !== "none");
  const [kind, setKind] = useState<Kind>(isMotion(postKind) ? "video" : "png");
  const [scale, setScale] = useState(1);
  const [name, setName] = useState(`${p.name}-${v?.name ?? "post"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const vfmt = videoMime();

  useEffect(() => {
    const c = preview.current;
    if (!c) return;
    const s = 260 / Math.max(doc.frame.w, doc.frame.h);
    c.width = doc.frame.w * s;
    c.height = doc.frame.h * s;
    const ctx = c.getContext("2d")!;
    preloadDoc(doc).then(() => {
      ctx.setTransform(s, 0, 0, s, 0, 0);
      renderDoc(ctx, doc, null);
    });
  }, [doc]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "video") await exportVideo(doc, name || "post", setProgress);
      else if (scope === "all" && slides > 1)
        await exportCarousel(
          project.pages.map((_, i) => docOf(project, i)),
          kind,
          scale,
          name || "post",
          setProgress,
        );
      else await exportImage(doc, kind, scale, name || "post");
      notify("Downloaded! Check your Downloads folder 🎉");
      onClose();
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "SecurityError"
          ? "A sample photo blocked the export. Upload your own photo instead."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const options: { id: Kind; title: string; desc: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: "png", title: "PNG image", desc: "Best quality · sharp text", icon: <FiImage /> },
    { id: "jpeg", title: "JPG image", desc: "Smaller file · photos", icon: <FiImage /> },
    {
      id: "video",
      title: `${vfmt?.ext.toUpperCase() ?? "Video"} video`,
      desc: vfmt ? `Animated · ${doc.duration}s long` : "Not supported in this browser",
      icon: <FiFilm />,
      disabled: !vfmt,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-6 backdrop-blur-sm" onPointerDown={() => !busy && onClose()}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Export your post</h2>
            <p className="text-xs text-zinc-500">Download it, then upload it to {p.name}.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <FiX />
          </button>
        </div>
        <div className="flex gap-6 p-6">
          <div className="flex w-[280px] shrink-0 flex-col items-center justify-center rounded-2xl bg-zinc-100 p-3">
            <canvas ref={preview} className="max-h-[260px] max-w-[260px] rounded shadow-md" />
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <FiCheckCircle /> Perfect size for {p.name} {v?.name}
              {slides > 1 && ` · slide ${page + 1}/${slides}`}
            </p>
            <p className="text-[11px] text-zinc-500">
              {Math.round(doc.frame.w * (kind === "video" ? 1 : scale))} × {Math.round(doc.frame.h * (kind === "video" ? 1 : scale))} px
            </p>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">File type</p>
              <div className="space-y-1.5">
                {options.map((o) => (
                  <button
                    key={o.id}
                    disabled={o.disabled || busy}
                    onClick={() => setKind(o.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-40",
                      kind === o.id ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-zinc-200 hover:border-zinc-300",
                    )}
                  >
                    <span className={cn("text-lg", kind === o.id ? "text-violet-600" : "text-zinc-400")}>{o.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{o.title}</span>
                      <span className="block text-[11px] text-zinc-500">{o.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              {kind === "video" && !hasAnim && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                  Nothing is animated yet — switch to <b>Animate</b> mode at the top to add motion.
                </p>
              )}
            </div>
            {kind !== "video" && slides > 1 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{postKind === "carousel" ? "Carousel" : "Designs"}</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["all", `All ${slides} ${noun} (.zip)`],
                      ["current", `Only ${noun.slice(0, -1)} ${page + 1}`],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setScope(id)}
                      className={cn("flex-1 rounded-lg border py-2 text-xs font-medium", scope === id ? "border-violet-500 bg-violet-50 text-violet-700" : "border-zinc-200")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {scope === "all" && <p className="mt-1.5 text-[11px] text-zinc-400">Files are numbered 01, 02… — upload them in that order.</p>}
              </div>
            )}
            {kind === "video" && slides > 1 && (
              <p className="rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-500">Video exports the slide you're on (slide {page + 1}).</p>
            )}
            {kind !== "video" && (
              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Quality</p>
                <div className="flex gap-2">
                  {[1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScale(s)}
                      className={cn("flex-1 rounded-lg border py-2 text-xs font-medium", scale === s ? "border-violet-500 bg-violet-50 text-violet-700" : "border-zinc-200")}
                    >
                      {s === 1 ? "Standard (1×)" : "Extra sharp (2×)"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">File name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
            <button
              onClick={run}
              disabled={busy}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-semibold text-white shadow disabled:opacity-90"
            >
              {busy && (kind === "video" || (scope === "all" && slides > 1)) && <span className="absolute inset-y-0 left-0 bg-white/25 transition-all" style={{ width: `${progress * 100}%` }} />}
              <span className="relative">
                {busy
                  ? kind === "video"
                    ? `Recording video… ${Math.round(progress * 100)}%`
                    : scope === "all" && slides > 1
                      ? `Creating slides… ${Math.round(progress * 100)}%`
                      : "Preparing…"
                  : kind !== "video" && scope === "all" && slides > 1
                    ? `Download ${slides} ${noun}`
                    : "Download"}
              </span>
            </button>
            {kind === "video" && <p className="text-center text-[11px] text-zinc-400">Video records in real time — it takes about {Math.ceil(doc.duration)} seconds.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
