import { FiArrowLeft, FiChevronRight } from "react-icons/fi";
import { findPlatform } from "../../data/platforms";
import { kindLabel, normKind } from "../../data/postKinds";
import { formatDay, type CreativeMeta } from "../../lib/library";
import { useLibrary } from "../../libraryStore";

/** Where this creative lives: Library › Brand › Date › Platform › Type › name. Each part goes back there. */
export function EditorCrumbs({ meta }: { meta: CreativeMeta }) {
  const lib = useLibrary();
  const brand = lib.brands.find((b) => b.id === meta.brandId);
  const plat = meta.platformId === "custom" ? "Custom size" : findPlatform(meta.platformId).name;
  const kind = normKind(meta.kind);
  const Seg = ({ label, onClick, title }: { label: string; onClick: () => void; title: string }) => (
    <button onClick={onClick} title={title} className="max-w-28 shrink-0 truncate rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      {label}
    </button>
  );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
      <button
        onClick={() => lib.go({ brandId: meta.brandId, date: meta.date, platform: meta.platformId, kind })}
        className="mr-1 flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        title="Back to the library (your design is saved)"
      >
        <FiArrowLeft /> Library
      </button>
      <Seg label={brand?.name ?? "Brand"} onClick={() => lib.go({ brandId: meta.brandId })} title="All dates for this brand" />
      <FiChevronRight className="shrink-0 text-zinc-300" />
      <label className="relative shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" title="Change the date of this post">
        📅 {formatDay(meta.date, "short")}
        <input
          type="date"
          value={meta.date}
          onChange={(e) => e.target.value && lib.updateCreative(meta.id, { date: e.target.value })}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <FiChevronRight className="shrink-0 text-zinc-300" />
      <Seg label={plat} onClick={() => lib.go({ brandId: meta.brandId, date: meta.date, platform: meta.platformId })} title="Everything for this platform on this day" />
      <FiChevronRight className="shrink-0 text-zinc-300" />
      <Seg label={kindLabel(kind)} onClick={() => lib.go({ brandId: meta.brandId, date: meta.date, platform: meta.platformId, kind })} title="All of this type on this day" />
      <FiChevronRight className="shrink-0 text-zinc-300" />
      <input
        value={meta.name}
        onChange={(e) => lib.updateCreative(meta.id, { name: e.target.value })}
        className="w-36 min-w-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-zinc-900 outline-none hover:bg-zinc-100 focus:bg-white focus:ring-1 focus:ring-violet-400"
        title="Rename this creative"
      />
    </div>
  );
}
