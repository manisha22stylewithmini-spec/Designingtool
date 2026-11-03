import { useEffect, useState } from "react";
import { FiClock, FiTrash2 } from "react-icons/fi";
import { cn } from "../lib/cn";
import { describeChange, timeAgo } from "../lib/history";
import { useEditor } from "../store";
import { PanelHeader } from "./ContentPanels";

/** Every change you made, saved in this browser — click a step to go back (or forward) to it. */
export function HistoryPanel() {
  const { historySteps, historyIndex, jumpTo, clearHistory, notify } = useEditor();
  const steps = historySteps();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000); // keep "2 min ago" fresh
    return () => clearInterval(t);
  }, []);

  const rows = steps.map((s, i) => ({
    i,
    at: s.at,
    ...(i === 0 ? { label: "Where you started", icon: "●" } : describeChange(steps[i - 1], s)),
  }));

  return (
    <div>
      <PanelHeader
        title="History"
        sub="Every change is saved in this browser, even after you close the tab. Click any step to jump back to it — later steps stay until you make a new change."
      />
      <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <FiClock /> {steps.length} step{steps.length === 1 ? "" : "s"} saved
        </span>
        {steps.length > 1 && (
          <button
            onClick={() => {
              clearHistory();
              notify("History cleared — your design is unchanged");
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-red-50 hover:text-red-600"
          >
            <FiTrash2 /> Clear
          </button>
        )}
      </div>
      <ol className="space-y-0.5 p-3">
        {[...rows].reverse().map((r) => {
          const current = r.i === historyIndex;
          const undone = r.i > historyIndex;
          return (
            <li key={r.i}>
              <button
                onClick={() => jumpTo(r.i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition",
                  current ? "bg-violet-600 text-white" : undone ? "text-zinc-400 hover:bg-zinc-50" : "text-zinc-700 hover:bg-zinc-100",
                )}
                title={current ? "You are here" : undone ? "Undone — click to redo up to here" : "Go back to this step"}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]",
                    current ? "bg-white/20" : undone ? "bg-zinc-100" : "bg-zinc-100 text-zinc-600",
                  )}
                >
                  {r.icon}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", undone && "line-through decoration-zinc-300")}>{r.label}</span>
                <span className={cn("shrink-0 text-[10px]", current ? "text-white/70" : "text-zinc-400")}>{current ? "now" : timeAgo(r.at)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="px-4 pb-4 text-[11px] leading-snug text-zinc-400">
        Shortcuts: <kbd className="rounded bg-zinc-100 px-1">⌘Z</kbd> undo · <kbd className="rounded bg-zinc-100 px-1">⌘⇧Z</kbd> redo. The last 80 steps are kept.
      </p>
    </div>
  );
}
