import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import { ensureFont, FONT_CATS, FONT_LIBRARY, previewFont, type FontCat } from "../data/fonts";
import { cn } from "../lib/cn";

function Row({ name, active, onPick }: { name: string; active: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && previewFont(name));
    io.observe(el);
    return () => io.disconnect();
  }, [name]);
  return (
    <button
      ref={ref}
      onClick={onPick}
      className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100", active && "bg-violet-50")}
    >
      <span className="truncate text-[17px] leading-tight" style={{ fontFamily: `"${name}"` }}>
        {name}
      </span>
      {active && <FiCheck className="shrink-0 text-violet-600" />}
    </button>
  );
}

export function FontPicker({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FontCat | "All">("All");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    previewFont(value);
  }, [value]);

  const list = FONT_LIBRARY.filter((f) => (cat === "All" || f.cat === cat) && f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left hover:border-zinc-300"
      >
        <span className="truncate text-[15px]" style={{ fontFamily: `"${value}"` }}>
          {value}
        </span>
        <FiChevronDown className="shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="border-b border-zinc-100 p-2">
            <label className="flex items-center gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5">
              <FiSearch className="text-zinc-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${FONT_LIBRARY.length} fonts`} className="w-full bg-transparent text-xs outline-none" />
            </label>
            <div className="mt-2 flex flex-wrap gap-1">
              {(["All", ...FONT_CATS] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat === c ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="thin-scroll max-h-72 overflow-y-auto p-1">
            {list.map((fnt) => (
              <Row
                key={fnt.name}
                name={fnt.name}
                active={fnt.name === value}
                onPick={() => {
                  ensureFont(fnt.name);
                  onChange(fnt.name);
                  setOpen(false);
                }}
              />
            ))}
            {!list.length && <p className="p-4 text-center text-xs text-zinc-400">No fonts match “{q}”</p>}
          </div>
        </div>
      )}
    </div>
  );
}
