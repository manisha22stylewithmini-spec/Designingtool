import { useState } from "react";
import { TEMPLATES } from "../../data/templates";
import { cn } from "../../lib/cn";
import { todayISO } from "../../lib/library";
import { useLibrary } from "../../libraryStore";
import type { Frame, PostKind } from "../../types";
import { projectFromTemplate, TemplatePreview } from "./TemplatePreview";

const FORMATS: { id: string; label: string; frame: Frame; kind: PostKind }[] = [
  { id: "post", label: "Instagram Post", frame: { platformId: "instagram", variantId: "square", w: 1080, h: 1080 }, kind: "static" },
  { id: "portrait", label: "Portrait 4:5", frame: { platformId: "instagram", variantId: "portrait", w: 1080, h: 1350 }, kind: "static" },
  { id: "story", label: "Story / Reel", frame: { platformId: "instagram", variantId: "story", w: 1080, h: 1920 }, kind: "animated" },
  { id: "linkedin", label: "LinkedIn Post", frame: { platformId: "linkedin", variantId: "post", w: 1200, h: 627 }, kind: "static" },
  { id: "thumb", label: "YouTube Thumbnail", frame: { platformId: "youtube", variantId: "thumb", w: 1280, h: 720 }, kind: "static" },
];

/** Every template, shown live in the format you pick — click to start a design from it. */
export function TemplatesScreen() {
  const lib = useLibrary();
  const [fmt, setFmt] = useState(FORMATS[0]);
  const use = async (templateId: string, name: string) => {
    const latest = [...lib.creatives].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    let bid = latest?.brandId ?? lib.brands[0]?.id;
    if (!bid) bid = (await lib.addBrand("My brand")).id;
    const id = await lib.createCreative({ brandId: bid, date: todayISO(), name: `${name} · ${fmt.label}`, project: projectFromTemplate(templateId, fmt.frame, fmt.kind) });
    lib.go({ edit: id });
  };
  const tall = fmt.frame.h > fmt.frame.w;
  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900">Templates</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a format, then a template — it opens ready to edit, already animated.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFmt(f)}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition", fmt.id === f.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className={cn("mt-6 grid gap-5", tall ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
        {TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => use(t.id, t.name)} className="group text-left">
            <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-3 shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-xl" style={{ aspectRatio: tall ? "9/14" : "4/3" }}>
              <TemplatePreview templateId={t.id} frame={fmt.frame} className="h-full w-full" />
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-800">{t.name}</p>
            <p className="text-[11px] text-zinc-500">{fmt.label} · click to use</p>
          </button>
        ))}
      </div>
    </div>
  );
}
