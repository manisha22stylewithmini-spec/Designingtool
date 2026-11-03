import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { FaBehance, FaInstagram, FaLinkedin, FaTiktok, FaYoutube } from "react-icons/fa6";
import { FiArrowRight, FiChevronDown, FiCopy, FiMoreHorizontal, FiPlus, FiTrash2 } from "react-icons/fi";
import { MdOutlineViewCarousel, MdPalette } from "react-icons/md";
import { findPlatform } from "../../data/platforms";
import { kindLabel, normKind, POST_KINDS } from "../../data/postKinds";
import { cn } from "../../lib/cn";
import { formatDay, todayISO, type CreativeMeta } from "../../lib/library";
import { starterProject } from "../../lib/starter";
import { useLibrary } from "../../libraryStore";
import type { Frame, PostKind } from "../../types";
import { useUser } from "../../userContext";
import { BrandKitModal } from "../library/BrandKit";
import { NewCreativeDialog } from "../library/LibraryScreen";
import { IDEAS, projectFromTemplate, TemplatePreview, type Idea } from "./TemplatePreview";

const QUICK: { label: string; icon: IconType; color: string; frame: Frame; kind: PostKind }[] = [
  { label: "Instagram Post", icon: FaInstagram, color: "#E1306C", frame: { platformId: "instagram", variantId: "square", w: 1080, h: 1080 }, kind: "static" },
  { label: "Instagram Reel", icon: FaInstagram, color: "#C13584", frame: { platformId: "instagram", variantId: "reel", w: 1080, h: 1920 }, kind: "animated" },
  { label: "Carousel", icon: MdOutlineViewCarousel, color: "#7c3aed", frame: { platformId: "instagram", variantId: "portrait", w: 1080, h: 1350 }, kind: "carousel" },
  { label: "LinkedIn Post", icon: FaLinkedin, color: "#0A66C2", frame: { platformId: "linkedin", variantId: "post", w: 1200, h: 627 }, kind: "static" },
  { label: "TikTok Video", icon: FaTiktok, color: "#111111", frame: { platformId: "tiktok", variantId: "video", w: 1080, h: 1920 }, kind: "animated" },
  { label: "YouTube Thumbnail", icon: FaYoutube, color: "#FF0000", frame: { platformId: "youtube", variantId: "thumb", w: 1280, h: 720 }, kind: "static" },
  { label: "Behance Cover", icon: FaBehance, color: "#1769FF", frame: { platformId: "behance", variantId: "cover", w: 808, h: 632 }, kind: "static" },
];

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}${name ? `, ${name.split(" ")[0]}` : ""}`;
}

export function HomeScreen() {
  const lib = useLibrary();
  const user = useUser();
  const [newOpen, setNewOpen] = useState(false);
  const [kit, setKit] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [filter, setFilter] = useState<"all" | PostKind | "week">("all");

  // the brand you create into: the one you used most recently
  const recentBrand = useMemo(() => {
    const latest = [...lib.creatives].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return latest?.brandId ?? lib.brands[0]?.id;
  }, [lib.creatives, lib.brands]);
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const activeBrand = lib.brands.find((b) => b.id === (brandId ?? recentBrand)) ?? lib.brands[0];

  const create = async (name: string, frame: Frame, kind: PostKind, project = starterProject(frame, kind)) => {
    let bid = activeBrand?.id;
    if (!bid) bid = (await lib.addBrand("My brand")).id;
    const id = await lib.createCreative({ brandId: bid, date: todayISO(), name, project });
    lib.go({ edit: id });
  };
  const startFromIdea = (i: Idea) => create(i.title, i.frame, i.kind, projectFromTemplate(i.template, i.frame, i.kind, i.slides));

  const recent = [...lib.creatives]
    .filter((c) => {
      if (filter === "all") return true;
      if (filter === "week") return Date.now() - c.updatedAt < 7 * 86400000;
      return normKind(c.kind) === filter;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      {/* ---------- Hero ---------- */}
      <section className="relative mt-2 overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-100 p-10 shadow-[0_20px_60px_-30px_rgba(124,58,237,0.5)]">
        <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-32 h-80 w-80 rounded-full bg-pink-300/40 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-violet-700 uppercase">{greeting(user?.name)} 👋</p>
            <h1 className="mt-3 text-5xl leading-[1.02] font-black tracking-tight text-zinc-900">
              What will you
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent">create today?</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-600">Posts, carousels, reels and covers — for every platform, organised by brand and date.</p>
            {lib.brands.length > 0 && (
              <label className="mt-5 inline-flex items-center gap-2 rounded-full border border-white bg-white/70 py-1 pr-2 pl-1 text-xs text-zinc-600 shadow-sm backdrop-blur">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: activeBrand?.color }}>
                  {activeBrand?.name[0]}
                </span>
                Creating for
                <span className="relative font-semibold text-zinc-900">
                  {activeBrand?.name}
                  <select value={activeBrand?.id} onChange={(e) => setBrandId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    {lib.brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </span>
                <FiChevronDown />
              </label>
            )}
          </div>

          {/* big create button with floating sample posts */}
          <div className="relative flex h-72 items-center justify-center">
            <div className="animate-float-slow absolute top-2 left-4 h-44 w-32 -rotate-12 rounded-2xl bg-white/50 p-1.5 shadow-xl backdrop-blur">
              <TemplatePreview templateId="event" frame={{ platformId: "instagram", variantId: "story", w: 1080, h: 1920 }} className="h-full w-full" rounded={12} />
            </div>
            <div className="animate-float absolute right-2 bottom-0 h-40 w-40 rotate-6 rounded-2xl bg-white/50 p-1.5 shadow-xl backdrop-blur">
              <TemplatePreview templateId="sale" frame={{ platformId: "instagram", variantId: "square", w: 1080, h: 1080 }} className="h-full w-full" rounded={12} />
            </div>
            <button
              onClick={() => setNewOpen(true)}
              className="group relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-[0_25px_60px_-15px_rgba(168,85,247,0.8)] transition hover:scale-105"
              title="Create a new design"
            >
              <span className="animate-ping-slow absolute inset-0 rounded-full bg-fuchsia-400/40" />
              <span className="absolute inset-2 rounded-full border border-white/30" />
              <FiPlus className="relative text-6xl transition group-hover:rotate-90" />
              <span className="relative mt-1 text-sm font-semibold">Create new</span>
            </button>
          </div>
        </div>
      </section>

      {/* ---------- One-click create ---------- */}
      <section className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              onClick={() => create(q.label, q.frame, q.kind)}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 px-2 py-4 text-center backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
              title={`New ${q.label} (${q.frame.w}×${q.frame.h}) for ${activeBrand?.name ?? "your brand"}, dated today`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-white shadow-md transition group-hover:scale-110" style={{ background: q.color }}>
                <Icon />
              </span>
              <span className="text-[11px] leading-tight font-medium text-zinc-700">{q.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => (activeBrand ? setKit(activeBrand.id) : setAddingBrand(true))}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 px-2 py-4 text-center backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl text-white shadow-md transition group-hover:scale-110">
            <MdPalette />
          </span>
          <span className="text-[11px] leading-tight font-medium text-zinc-700">Brand Kit</span>
        </button>
        <button
          onClick={() => setNewOpen(true)}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white/50 px-2 py-4 text-center transition hover:-translate-y-1 hover:border-violet-400"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-xl text-zinc-500 transition group-hover:scale-110">
            <FiMoreHorizontal />
          </span>
          <span className="text-[11px] leading-tight font-medium text-zinc-700">All sizes</span>
        </button>
      </section>

      {/* ---------- Trending ---------- */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900">
              <span className="text-2xl">⚡</span> Trending right now
            </h2>
            <p className="text-sm text-zinc-500">Formats that are performing — one click and it's yours to edit.</p>
          </div>
          <button onClick={() => lib.go({ view: "templates" })} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-violet-700">
            View all <FiArrowRight />
          </button>
        </div>
        <div className="thin-scroll -mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-3">
          {IDEAS.map((i) => (
            <button
              key={i.id}
              onClick={() => startFromIdea(i)}
              className={cn(
                "group relative flex h-64 w-[340px] shrink-0 snap-start overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-2xl",
                i.accent,
              )}
            >
              <div className="relative z-10 flex w-[52%] flex-col">
                <span className="w-fit rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-800">{i.badge}</span>
                <h3 className={cn("mt-3 text-2xl leading-tight font-extrabold", i.id === "drop" ? "text-zinc-900" : "text-white")}>{i.title}</h3>
                <p className={cn("mt-2 text-xs leading-snug", i.id === "drop" ? "text-zinc-700" : "text-white/75")}>{i.blurb}</p>
                <span className="mt-auto flex items-center gap-2 text-[11px] font-semibold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-900 transition group-hover:translate-x-1">
                    <FiArrowRight />
                  </span>
                  <span className={i.id === "drop" ? "text-zinc-800" : "text-white/80"}>
                    {findPlatform(i.frame.platformId).name} · {kindLabel(i.kind)}
                  </span>
                </span>
              </div>
              <div className="absolute top-5 -right-3 bottom-5 w-[46%] rotate-3 transition group-hover:rotate-0">
                <TemplatePreview templateId={i.template} frame={i.frame} className="h-full w-full" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- Brands ---------- */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900">Your brands</h2>
          <button onClick={() => lib.go({})} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-violet-700">
            Manage brands <FiArrowRight />
          </button>
        </div>
        <div className="thin-scroll flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={() => setAddingBrand(true)}
            className="flex h-28 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 text-sm font-medium text-zinc-600 transition hover:border-violet-400 hover:text-violet-700"
          >
            <FiPlus className="text-2xl" /> Add brand
          </button>
          {lib.brands.map((b) => {
            const n = lib.creatives.filter((c) => c.brandId === b.id).length;
            return (
              <button
                key={b.id}
                onClick={() => lib.go({ brandId: b.id })}
                className="relative flex h-28 w-36 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                style={{ background: `linear-gradient(140deg, ${b.color}, ${b.color}cc)` }}
              >
                <span className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-white/20" />
                {b.logos[0] ? (
                  <img src={b.logos[0].src} className="h-10 max-w-[70%] object-contain" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25 text-xl font-black">{b.name[0]}</span>
                )}
                <span className="max-w-[90%] truncate text-sm font-semibold">{b.name}</span>
                <span className="text-[10px] text-white/75">
                  {n} design{n === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Recent ---------- */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-900">Recent designs</h2>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["week", "This week"],
                ...POST_KINDS.map((k) => [k.id, k.label]),
              ] as [typeof filter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  filter === id ? "border-violet-200 bg-violet-100 text-violet-800" : "border-zinc-200 bg-white/70 text-zinc-600 hover:bg-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => lib.go({})} className="ml-auto flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-violet-700">
            See all <FiArrowRight />
          </button>
        </div>
        {!recent.length ? (
          <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-white/50 py-14 text-center">
            <p className="text-sm font-semibold text-zinc-700">{lib.creatives.length ? "Nothing matches this filter" : "Your designs will show up here"}</p>
            <button onClick={() => setNewOpen(true)} className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              Create your first design
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {recent.map((c) => (
              <RecentCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {newOpen && <NewCreativeDialog ctx={{ brandId: activeBrand?.id }} onClose={() => setNewOpen(false)} />}
      {kit && <BrandKitModal brandId={kit} onClose={() => setKit(null)} />}
      {addingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-6 backdrop-blur-sm" onPointerDown={() => setAddingBrand(false)}>
          <form
            onPointerDown={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!brandName.trim()) return;
              const b = await lib.addBrand(brandName.trim());
              setAddingBrand(false);
              setBrandName("");
              setBrandId(b.id);
              setKit(b.id);
            }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-zinc-900">New brand</h3>
            <p className="mt-1 text-xs text-zinc-500">Next you can add its logo, colours and fonts.</p>
            <input autoFocus value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. SquareZix" className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <button className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Create brand</button>
          </form>
        </div>
      )}
    </div>
  );
}

function RecentCard({ c }: { c: CreativeMeta }) {
  const lib = useLibrary();
  const [menu, setMenu] = useState(false);
  const brand = lib.brands.find((b) => b.id === c.brandId);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <button onClick={() => lib.go({ edit: c.id })} className="block w-full">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-zinc-100">
          {c.thumb ? <img src={c.thumb} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="text-xs text-zinc-400">No preview</span>}
        </div>
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{c.name}</p>
          <p className="truncate text-[11px] text-zinc-500">
            {brand?.name} · {formatDay(c.date, "short")}
          </p>
        </div>
        <button onClick={() => setMenu((m) => !m)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800">
          <FiMoreHorizontal />
        </button>
      </div>
      <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        {c.platformId === "custom" ? "Custom" : findPlatform(c.platformId).name} · {kindLabel(c.kind)}
      </span>
      {menu && (
        <div className="absolute right-2 bottom-12 z-20 w-36 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
          <button onMouseDown={() => lib.duplicateCreative(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100">
            <FiCopy /> Duplicate
          </button>
          <button
            onMouseDown={() => confirm(`Delete “${c.name}”? This can't be undone.`) && lib.deleteCreative(c.id)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            <FiTrash2 /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
