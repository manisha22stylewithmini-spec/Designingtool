import { FiArrowUpRight } from "react-icons/fi";
import { BRAND } from "../data/brand";
import { cn } from "../lib/cn";

/** Manisha's link-in-bio page. Floating bottom-right, or inline (in the editor's status bar). */
export function CreatorLink({ inline }: { inline?: boolean }) {
  if (!BRAND.linkTree) return null;
  if (inline)
    return (
      <a href={BRAND.linkTree} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-medium text-violet-700 hover:bg-violet-50" title={`${BRAND.author}'s links`}>
        <img src={BRAND.mark} alt="" className="h-4 w-4 rounded-full" />
        Manisha's links
        <FiArrowUpRight />
      </a>
    );
  return (
    <a
      href={BRAND.linkTree}
      target="_blank"
      rel="noopener noreferrer"
      title={`Visit ${BRAND.author}'s links`}
      className={cn(
        "group fixed right-5 bottom-5 z-40 flex items-center gap-2.5 rounded-full border border-white/70 bg-[#1a1530] py-1.5 pr-4 pl-1.5 text-white shadow-[0_12px_40px_-10px_rgba(26,21,48,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-12px_rgba(124,58,237,0.7)]",
      )}
    >
      <img src={BRAND.mark} alt="" className="h-9 w-9 rounded-full ring-2 ring-white/20 transition group-hover:rotate-12" />
      <span className="leading-tight">
        <span className="block text-[10px] font-medium text-white/60">Made by</span>
        <span className="block text-sm font-semibold">Manisha's links</span>
      </span>
      <FiArrowUpRight className="text-white/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}
