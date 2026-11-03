import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiArrowLeft, FiCalendar, FiChevronRight, FiCopy, FiEdit3, FiFolder, FiMoreHorizontal, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { findPlatform } from "../../data/platforms";
import { kindLabel, normKind, POST_KINDS } from "../../data/postKinds";
import { cn } from "../../lib/cn";
import { formatDay, parseISO, relativeDay, todayISO, type Brand, type CreativeMeta } from "../../lib/library";
import { starterProject } from "../../lib/starter";
import { useLibrary, type Route } from "../../libraryStore";
import type { PostKind } from "../../types";
import { StartScreen } from "../StartScreen";
import { BrandKitModal } from "./BrandKit";

const platformName = (id: string) => (id === "custom" ? "Custom size" : findPlatform(id).name);

function PlatformBadge({ id, size = 28 }: { id: string; size?: number }) {
  const p = findPlatform(id);
  const Icon = p.icon;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-white" style={{ background: id === "custom" ? "#7c3aed" : p.color, width: size, height: size, fontSize: size * 0.5 }}>
      <Icon />
    </span>
  );
}

/** Up to four thumbnails in one card. */
function Collage({ items, aspect = "4/3" }: { items: CreativeMeta[]; aspect?: string }) {
  const shown = items.slice(0, 4);
  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-xl bg-zinc-100 p-1", shown.length > 1 ? "grid-cols-2" : "grid-cols-1")} style={{ aspectRatio: aspect }}>
      {shown.map((c) => (
        <div key={c.id} className="flex items-center justify-center overflow-hidden rounded-lg bg-white">
          {c.thumb ? <img src={c.thumb} className="h-full w-full object-contain" /> : <FiFolder className="text-zinc-300" />}
        </div>
      ))}
      {!shown.length && <div className="flex items-center justify-center text-xs text-zinc-400">Empty</div>}
    </div>
  );
}

// ---------------- the hierarchy bar (breadcrumb + "what's next") ----------------

function Hierarchy({ route, brand }: { route: Route; brand?: Brand }) {
  const { go } = useLibrary();
  const level = !route.brandId ? 0 : !route.date ? 1 : !route.platform ? 2 : !route.kind ? 3 : 4;
  const crumbs: { label: string; value?: string; to: Route }[] = [
    { label: "Brand", value: brand?.name, to: {} },
    { label: "Date", value: route.date ? formatDay(route.date, "short") : undefined, to: { brandId: route.brandId } },
    { label: "Platform", value: route.platform ? platformName(route.platform) : undefined, to: { brandId: route.brandId, date: route.date } },
    { label: "Type", value: route.kind ? kindLabel(route.kind as PostKind) : undefined, to: { brandId: route.brandId, date: route.date, platform: route.platform } },
    { label: "Creatives", to: route },
  ];
  const up: Route = level === 0 ? { view: "home" } : crumbs[level - 1].to;
  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
      <button
        onClick={() => go(up)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-30"
        title={level === 0 ? "Back to Home" : "Back one level"}
      >
        <FiArrowLeft /> Back
      </button>
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {crumbs.map((c, i) => {
          const done = i < level;
          const here = i === level;
          return (
            <li key={c.label} className="flex shrink-0 items-center gap-1">
              {i > 0 && <FiChevronRight className="text-zinc-300" />}
              <button
                disabled={!done}
                onClick={() => go(c.to)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
                  here ? "border-zinc-900 bg-zinc-900 text-white" : done ? "border-zinc-900/10 text-zinc-700 hover:bg-zinc-100" : "border-dashed border-zinc-300 text-zinc-400",
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", here ? "bg-white text-zinc-900" : done ? "bg-violet-100 text-violet-700" : "bg-zinc-100")}>
                  {i + 1}
                </span>
                <span className="font-medium">{done && c.value ? c.value : c.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------- shared bits ----------------

function LevelHeader({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{sub}</p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

function NewButton({ onClick, label = "New creative" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90">
      <FiPlus /> {label}
    </button>
  );
}

function Menu({ items }: { items: { label: string; icon: ReactNode; run: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" title="More">
        <FiMoreHorizontal />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs", it.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700 hover:bg-zinc-100")}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
      <FiFolder className="text-3xl text-zinc-300" />
      <p className="mt-3 text-sm font-semibold text-zinc-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-zinc-500">{sub}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------- the screen ----------------

export function LibraryScreen() {
  const lib = useLibrary();
  const { route, brands, creatives } = lib;
  const brand = brands.find((b) => b.id === route.brandId);
  const [newFor, setNewFor] = useState<{ brandId?: string; date?: string; platform?: string; kind?: string } | null>(null);
  const [kitFor, setKitFor] = useState<string | null>(null);

  // unknown brand in the address bar → back to the start
  useEffect(() => {
    if (route.brandId && !brand) lib.go({});
  }, [route.brandId, brand, lib]);

  const inBrand = creatives.filter((c) => c.brandId === route.brandId);
  const onDate = inBrand.filter((c) => c.date === route.date);
  const onPlatform = onDate.filter((c) => c.platformId === route.platform);
  const ofKind = onPlatform.filter((c) => normKind(c.kind) === route.kind);

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-6">
        <span className="text-sm font-semibold text-zinc-900">Library</span>
        <div className="ml-auto">
          <NewButton onClick={() => setNewFor({ brandId: route.brandId ?? brands[0]?.id, date: route.date, platform: route.platform, kind: route.kind })} />
        </div>
      </header>
      <Hierarchy route={route} brand={brand} />

      <main className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {!route.brandId && <BrandsLevel onKit={setKitFor} onNew={(brandId) => setNewFor({ brandId })} />}
          {brand && !route.date && <DatesLevel brand={brand} items={inBrand} onKit={() => setKitFor(brand.id)} onNew={() => setNewFor({ brandId: brand.id })} />}
          {brand && route.date && !route.platform && (
            <GroupLevel
              title={formatDay(route.date)}
              sub={`${relativeDay(route.date)} · ${onDate.length} creative${onDate.length === 1 ? "" : "s"} for ${brand.name}. Pick a platform.`}
              groups={groupBy(onDate, (c) => c.platformId)}
              renderKey={(id, list) => ({
                title: platformName(id),
                icon: <PlatformBadge id={id} />,
                chips: [...new Set(list.map((c) => kindLabel(c.kind)))],
              })}
              onOpen={(id) => lib.go({ ...route, platform: id })}
              onNew={() => setNewFor({ brandId: brand.id, date: route.date })}
              empty="Nothing on this day yet"
            />
          )}
          {brand && route.date && route.platform && !route.kind && (
            <GroupLevel
              title={`${platformName(route.platform)} · ${formatDay(route.date, "short")}`}
              sub="Pick a type of post to see those creatives."
              groups={groupBy(onPlatform, (c) => normKind(c.kind))}
              renderKey={(k, list) => {
                const K = POST_KINDS.find((x) => x.id === k)!;
                const Icon = K.icon;
                return {
                  title: K.label,
                  icon: (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
                      <Icon />
                    </span>
                  ),
                  chips: [K.desc, `${list.reduce((n, c) => n + c.pages, 0)} page${list.length === 1 && list[0].pages === 1 ? "" : "s"}`],
                };
              }}
              onOpen={(k) => lib.go({ ...route, kind: k })}
              onNew={() => setNewFor({ brandId: brand.id, date: route.date, platform: route.platform })}
              empty="No posts for this platform on this day"
            />
          )}
          {brand && route.date && route.platform && route.kind && (
            <CreativesLevel
              items={ofKind}
              title={`${platformName(route.platform)} ${kindLabel(route.kind as PostKind)}`}
              sub={`${formatDay(route.date)} · click one to open it in the editor`}
              onNew={() => setNewFor({ brandId: brand.id, date: route.date, platform: route.platform, kind: route.kind })}
            />
          )}
        </div>
      </main>

      {newFor && <NewCreativeDialog ctx={newFor} onClose={() => setNewFor(null)} />}
      {kitFor && <BrandKitModal brandId={kitFor} onClose={() => setKitFor(null)} />}
    </div>
  );
}

function groupBy<K extends string>(items: CreativeMeta[], key: (c: CreativeMeta) => K): [K, CreativeMeta[]][] {
  const m = new Map<K, CreativeMeta[]>();
  for (const c of items) m.set(key(c), [...(m.get(key(c)) ?? []), c]);
  return [...m.entries()];
}

// ---------------- level 1: brands ----------------

function BrandsLevel({ onKit, onNew }: { onKit: (id: string) => void; onNew: (brandId: string) => void }) {
  const lib = useLibrary();
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  return (
    <>
      <LevelHeader
        title="Your brands"
        sub="Each brand keeps its creatives organised by date, platform and type — plus its logos, colours and fonts."
        actions={
          <button onClick={() => setNaming("new")} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
            <FiPlus /> New brand
          </button>
        }
      />
      {naming && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (naming === "new") await lib.addBrand(name.trim());
            else {
              const b = lib.brands.find((x) => x.id === naming);
              if (b) await lib.saveBrand({ ...b, name: name.trim() });
            }
            setNaming(null);
            setName("");
          }}
          className="mb-5 flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name, e.g. Product Designing" className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">{naming === "new" ? "Create" : "Rename"}</button>
          <button type="button" onClick={() => setNaming(null)} className="rounded-lg p-2 text-zinc-500 hover:bg-white">
            <FiX />
          </button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {lib.brands.map((b) => {
          const items = lib.creatives.filter((c) => c.brandId === b.id);
          const dates = [...new Set(items.map((c) => c.date))].sort().reverse();
          return (
            <div key={b.id} onClick={() => lib.go({ brandId: b.id })} className="group cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative flex h-28 items-center justify-center" style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}aa)` }}>
                {b.logos[0] ? <img src={b.logos[0].src} className="max-h-16 max-w-[60%] object-contain drop-shadow" /> : <span className="text-4xl font-black text-white/90">{b.name.slice(0, 1).toUpperCase()}</span>}
                <div className="absolute top-2 right-2 flex gap-1">
                  {b.colors.slice(0, 5).map((c) => (
                    <span key={c} className="h-3.5 w-3.5 rounded-full border border-white/70" style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{b.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {items.length} creative{items.length === 1 ? "" : "s"} · {dates.length} day{dates.length === 1 ? "" : "s"}
                    {dates[0] && ` · last ${formatDay(dates[0], "short")}`}
                  </p>
                </div>
                <Menu
                  items={[
                    { label: "New creative", icon: <FiPlus />, run: () => onNew(b.id) },
                    { label: "Brand kit", icon: <FiEdit3 />, run: () => onKit(b.id) },
                    {
                      label: "Rename",
                      icon: <FiEdit3 />,
                      run: () => {
                        setName(b.name);
                        setNaming(b.id);
                      },
                    },
                    {
                      label: "Delete brand",
                      icon: <FiTrash2 />,
                      danger: true,
                      run: () => confirm(`Delete “${b.name}” and its ${items.length} creatives? This can't be undone.`) && lib.deleteBrand(b.id),
                    },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------- level 2: dates (with filters) ----------------

const RANGES = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "30", label: "Last 30 days" },
  { id: "upcoming", label: "Upcoming" },
] as const;

function rangeBounds(id: string): [string | null, string | null] {
  const t = parseISO(todayISO());
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (id === "today") return [iso(t), iso(t)];
  if (id === "week") {
    const s = new Date(t);
    s.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return [iso(s), iso(e)];
  }
  if (id === "month") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
  if (id === "30") {
    const s = new Date(t);
    s.setDate(t.getDate() - 29);
    return [iso(s), iso(t)];
  }
  if (id === "upcoming") {
    const s = new Date(t);
    s.setDate(t.getDate() + 1);
    return [iso(s), null];
  }
  return [null, null];
}

function DatesLevel({ brand, items, onKit, onNew }: { brand: Brand; items: CreativeMeta[]; onKit: () => void; onNew: () => void }) {
  const lib = useLibrary();
  const [range, setRange] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const [rf, rt] = range === "custom" ? [from || null, to || null] : rangeBounds(range);
  const filtered = items.filter(
    (c) =>
      (!rf || c.date >= rf) &&
      (!rt || c.date <= rt) &&
      (platform === "all" || c.platformId === platform) &&
      (kind === "all" || normKind(c.kind) === kind) &&
      (!q || c.name.toLowerCase().includes(q.toLowerCase())),
  );
  const byDate = groupBy(filtered, (c) => c.date).sort((a, b) => (newestFirst ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])));
  const months = useMemo(() => {
    const m = new Map<string, [string, CreativeMeta[]][]>();
    for (const g of byDate) {
      const key = parseISO(g[0]).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      m.set(key, [...(m.get(key) ?? []), g]);
    }
    return [...m.entries()];
  }, [byDate]);
  const usedPlatforms = [...new Set(items.map((c) => c.platformId))];
  const filtering = range !== "all" || platform !== "all" || kind !== "all" || !!q;

  // with a platform / type filter on, clicking a day jumps straight to it
  const open = (date: string) => lib.go({ brandId: brand.id, date, ...(platform !== "all" ? { platform, ...(kind !== "all" ? { kind } : {}) } : {}) });

  return (
    <>
      <LevelHeader
        title={brand.name}
        sub="Your posts, one card per day. Open a day to see its platforms."
        actions={
          <>
            <button onClick={onKit} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
              🎨 Brand kit
            </button>
            <NewButton onClick={onNew} />
          </>
        }
      />

      {/* Filters */}
      <div className="mb-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <FiCalendar className="mr-1 text-zinc-400" />
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", range === r.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-900/10 text-zinc-600 hover:bg-zinc-100")}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setRange("custom")}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", range === "custom" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-900/10 text-zinc-600 hover:bg-zinc-100")}
          >
            Pick dates…
          </button>
          {range === "custom" && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />
              to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5">
            <FiSearch className="text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creatives by name" className="w-full bg-transparent text-xs outline-none" />
          </label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs">
            <option value="all">All platforms</option>
            {usedPlatforms.map((p) => (
              <option key={p} value={p}>
                {platformName(p)}
              </option>
            ))}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs">
            <option value="all">All types</option>
            {POST_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <button onClick={() => setNewestFirst((n) => !n)} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
            {newestFirst ? "Newest first ↓" : "Oldest first ↑"}
          </button>
          {filtering && (
            <button
              onClick={() => {
                setRange("all");
                setPlatform("all");
                setKind("all");
                setQ("");
              }}
              className="text-xs font-medium text-violet-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {!items.length ? (
        <Empty title="No creatives yet" sub="Make your first post for this brand — it will show up here under its date." action={<NewButton onClick={onNew} />} />
      ) : !filtered.length ? (
        <Empty title="Nothing matches these filters" sub="Try a wider date range or clear the filters." />
      ) : (
        months.map(([month, days]) => (
          <section key={month} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{month}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {days.map(([date, list]) => {
                const d = parseISO(date);
                const plats = [...new Set(list.map((c) => c.platformId))];
                return (
                  <button key={date} onClick={() => open(date)} className="group rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="mb-2.5 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-900 text-white">
                        <span className="text-[9px] font-semibold uppercase">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                        <span className="text-lg leading-none font-bold">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">{d.toLocaleDateString(undefined, { weekday: "long" })}</p>
                        <p className="text-[11px] text-zinc-500">
                          {relativeDay(date)} · {list.length} creative{list.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <Collage items={list} />
                    <div className="mt-2.5 flex items-center gap-1">
                      {plats.map((p) => (
                        <PlatformBadge key={p} id={p} size={20} />
                      ))}
                      <span className="ml-auto text-[11px] font-medium text-violet-600 opacity-0 transition group-hover:opacity-100">Open →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </>
  );
}

// ---------------- levels 3 & 4: platforms / types on a day ----------------

function GroupLevel<K extends string>({
  title,
  sub,
  groups,
  renderKey,
  onOpen,
  onNew,
  empty,
}: {
  title: string;
  sub: string;
  groups: [K, CreativeMeta[]][];
  renderKey: (k: K, list: CreativeMeta[]) => { title: string; icon: ReactNode; chips: string[] };
  onOpen: (k: K) => void;
  onNew: () => void;
  empty: string;
}) {
  return (
    <>
      <LevelHeader title={title} sub={sub} actions={<NewButton onClick={onNew} label="New creative here" />} />
      {!groups.length ? (
        <Empty title={empty} sub="Create one and it will appear here." action={<NewButton onClick={onNew} />} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {groups.map(([k, list]) => {
            const r = renderKey(k, list);
            return (
              <button key={k} onClick={() => onOpen(k)} className="group rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-2.5 flex items-center gap-2.5">
                  {r.icon}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{r.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {list.length} creative{list.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <FiChevronRight className="ml-auto text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                </div>
                <Collage items={list} />
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {r.chips.map((c) => (
                    <span key={c} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                      {c}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------- level 5: the creatives ----------------

function CreativesLevel({ items, title, sub, onNew }: { items: CreativeMeta[]; title: string; sub: string; onNew: () => void }) {
  const lib = useLibrary();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [redating, setRedating] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <LevelHeader title={title} sub={sub} actions={<NewButton onClick={onNew} label="New one like this" />} />
      {!sorted.length ? (
        <Empty title="Nothing here" sub="Create one and it will appear here." action={<NewButton onClick={onNew} />} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sorted.map((c) => (
            <div key={c.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <button onClick={() => lib.go({ edit: c.id })} className="block w-full bg-zinc-100 p-3" title="Open in the editor">
                <div className="mx-auto flex items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm" style={{ aspectRatio: `${c.w}/${c.h}`, maxHeight: 220 }}>
                  {c.thumb ? <img src={c.thumb} className="h-full w-full object-contain" /> : <FiFolder className="text-2xl text-zinc-300" />}
                </div>
              </button>
              <div className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  {renaming === c.id ? (
                    <input
                      autoFocus
                      defaultValue={c.name}
                      onBlur={(e) => {
                        lib.updateCreative(c.id, { name: e.target.value.trim() || c.name });
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-full rounded border border-violet-400 px-1 text-sm outline-none"
                    />
                  ) : (
                    <p className="truncate text-sm font-semibold text-zinc-900" onDoubleClick={() => setRenaming(c.id)}>
                      {c.name}
                    </p>
                  )}
                  {redating === c.id ? (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={c.date}
                      onChange={(e) => e.target.value && lib.updateCreative(c.id, { date: e.target.value })}
                      onBlur={() => setRedating(null)}
                      className="mt-0.5 rounded border border-violet-400 px-1 text-[11px]"
                    />
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      {c.w}×{c.h}
                      {c.pages > 1 ? ` · ${c.pages} ${normKind(c.kind) === "carousel" ? "slides" : "designs"}` : ""} · edited {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Menu
                  items={[
                    { label: "Open", icon: <FiEdit3 />, run: () => lib.go({ edit: c.id }) },
                    { label: "Rename", icon: <FiEdit3 />, run: () => setRenaming(c.id) },
                    { label: "Move to another date", icon: <FiCalendar />, run: () => setRedating(c.id) },
                    { label: "Duplicate", icon: <FiCopy />, run: () => lib.duplicateCreative(c.id) },
                    { label: "Delete", icon: <FiTrash2 />, danger: true, run: () => confirm(`Delete “${c.name}”? This can't be undone.`) && lib.deleteCreative(c.id) },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- new creative ----------------

export function NewCreativeDialog({ ctx, onClose }: { ctx: { brandId?: string; date?: string; platform?: string; kind?: string }; onClose: () => void }) {
  const lib = useLibrary();
  const [brandId, setBrandId] = useState(ctx.brandId ?? lib.brands[0]?.id ?? "");
  const [date, setDate] = useState(ctx.date ?? todayISO());
  const [name, setName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  return (
    <StartScreen
      title="New creative"
      initialKind={(ctx.kind as PostKind) ?? "static"}
      initialPlatform={ctx.platform}
      onClose={onClose}
      header={
        <div className="mt-4 grid grid-cols-3 gap-2">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Brand
            {lib.brands.length ? (
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm font-normal text-zinc-900 normal-case">
                {lib.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Brand name" className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm font-normal normal-case" />
            )}
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Date of the post
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm font-normal text-zinc-900" />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Launch teaser" className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm font-normal normal-case" />
          </label>
        </div>
      }
      onPick={async (frame, kind) => {
        let bid = brandId;
        if (!bid) bid = (await lib.addBrand(newBrand.trim() || "My brand")).id;
        const auto = `${frame.platformId === "custom" ? "Custom" : findPlatform(frame.platformId).name} ${kindLabel(kind)}`;
        const id = await lib.createCreative({ brandId: bid, date, name: name.trim() || auto, project: starterProject(frame, kind) });
        onClose();
        lib.go({ edit: id });
      }}
    />
  );
}
