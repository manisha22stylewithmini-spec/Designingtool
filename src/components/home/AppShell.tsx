import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronsLeft, FiFolder, FiHome, FiLayout, FiLogOut, FiSearch } from "react-icons/fi";
import { findPlatform } from "../../data/platforms";
import { kindLabel } from "../../data/postKinds";
import { authConfigured, signOut } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { formatDay } from "../../lib/library";
import { useLibrary } from "../../libraryStore";
import { useUser } from "../../userContext";
import { Logo } from "../TopBar";
import { CreatorLink } from "../CreatorLink";
import { IDEAS } from "./TemplatePreview";

export function Avatar({ size = 36 }: { size?: number }) {
  const user = useUser();
  if (user?.photo) return <img src={user.photo} className="rounded-full object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  return (
    <span className="flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

function AccountMenu() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-full ring-2 ring-white transition hover:ring-violet-300" title="Your account">
        <Avatar />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl">
          <div className="flex items-center gap-3 p-2">
            <Avatar size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{user?.name}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
          </div>
          {user?.local && (
            <p className="mx-2 mb-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-snug text-amber-800">
              Local mode — your work is saved only in this browser{authConfigured ? "" : " (online accounts aren't connected yet)"}.
            </p>
          )}
          <button
            onClick={async () => {
              await signOut();
              location.hash = "#/";
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <FiLogOut /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** ⌘K search across creatives, brands and ideas. */
function Search() {
  const lib = useLibrary();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const s = q.trim().toLowerCase();
  const creatives = s ? lib.creatives.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 6) : [];
  const brands = s ? lib.brands.filter((b) => b.name.toLowerCase().includes(s)).slice(0, 4) : [];
  const ideas = s ? IDEAS.filter((i) => (i.title + i.blurb).toLowerCase().includes(s)).slice(0, 4) : [];
  const none = s && !creatives.length && !brands.length && !ideas.length;
  return (
    <div className="relative w-full max-w-xl">
      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100">
        <FiSearch className="text-zinc-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search your designs, brands or ideas…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
        <kbd className="shrink-0 rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-zinc-500">⌘ K</kbd>
      </label>
      {open && s && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl">
          {none && <p className="p-4 text-center text-xs text-zinc-500">Nothing found for “{q}”</p>}
          {creatives.length > 0 && <p className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Your designs</p>}
          {creatives.map((c) => (
            <button key={c.id} onMouseDown={() => lib.go({ edit: c.id })} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-100">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100">{c.thumb && <img src={c.thumb} className="h-full w-full object-cover" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900">{c.name}</span>
                <span className="block text-[11px] text-zinc-500">
                  {c.platformId === "custom" ? "Custom" : findPlatform(c.platformId).name} {kindLabel(c.kind)} · {formatDay(c.date, "short")}
                </span>
              </span>
            </button>
          ))}
          {brands.length > 0 && <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Brands</p>}
          {brands.map((b) => (
            <button key={b.id} onMouseDown={() => lib.go({ brandId: b.id })} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: b.color }}>
                {b.name[0]}
              </span>
              <span className="text-sm text-zinc-900">{b.name}</span>
            </button>
          ))}
          {ideas.length > 0 && <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Ideas</p>}
          {ideas.map((i) => (
            <button key={i.id} onMouseDown={() => lib.go({ view: "templates" })} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-100">
              <span className="text-lg">{i.badge.split(" ")[0]}</span>
              <span className="text-sm text-zinc-900">{i.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { id: "home", label: "Home", icon: FiHome },
  { id: "library", label: "Library", icon: FiFolder },
  { id: "templates", label: "Templates", icon: FiLayout },
] as const;

/** Sidebar + top bar around Home, Library and Templates. */
export function AppShell({ children, active }: { children: ReactNode; active: "home" | "library" | "templates" }) {
  const lib = useLibrary();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-full bg-[radial-gradient(1200px_600px_at_80%_-10%,#ede9fe_0%,transparent_60%),radial-gradient(900px_500px_at_-10%_110%,#fce7f3_0%,transparent_55%)] bg-zinc-50">
      <aside className={cn("flex shrink-0 flex-col border-r border-zinc-200/70 bg-white/70 backdrop-blur transition-all", collapsed ? "w-[72px]" : "w-60")}>
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? <Logo compact /> : <Logo />}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="Collapse sidebar">
              <FiChevronsLeft />
            </button>
          )}
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = active === n.id;
            return (
              <button
                key={n.id}
                onClick={() => lib.go(n.id === "library" ? {} : { view: n.id })}
                title={n.label}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  on ? "bg-violet-100 text-violet-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="shrink-0 text-lg" />
                {!collapsed && n.label}
              </button>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="mt-6 px-3">
            <p className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Your brands</p>
            <div className="space-y-0.5">
              {lib.brands.slice(0, 6).map((b) => (
                <button key={b.id} onClick={() => lib.go({ brandId: b.id })} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: b.color }}>
                    {b.name[0]}
                  </span>
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto p-3">
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="w-full rounded-xl p-2 text-zinc-400 hover:bg-zinc-100" title="Expand sidebar">
              <FiChevronsLeft className="mx-auto rotate-180" />
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-4 text-white shadow-lg">
              <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/20 blur-xl" />
              <p className="text-sm font-semibold">Plan a week of posts</p>
              <p className="mt-1 text-[11px] leading-snug text-white/80">Give each creative a date — your library sorts them into a calendar of cards.</p>
              <button onClick={() => lib.go({})} className="mt-3 w-full rounded-lg bg-white py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                Open library
              </button>
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 px-6">
          <Search />
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
      <CreatorLink />
    </div>
  );
}
