import { useState } from "react";
import { FiEye, FiEyeOff, FiFilm, FiImage, FiLock, FiType, FiUnlock } from "react-icons/fi";
import { IoShapesOutline } from "react-icons/io5";
import { cn } from "../lib/cn";
import { useEditor } from "../store";
import type { El } from "../types";

function LayerIcon({ el }: { el: El }) {
  if (el.type === "image")
    return el.src ? <img src={el.src} className="h-7 w-7 rounded object-cover" /> : <FiImage />;
  if (el.type === "video") return <FiFilm />;
  if (el.type === "text") return <FiType />;
  return <IoShapesOutline style={{ color: el.fill === "transparent" ? el.stroke : el.fill }} />;
}

export function LayersPanel() {
  const { doc, selected, setSelected, update, updateEls } = useEditor();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const list = [...doc.elements].reverse(); // top layer first

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    update((d) => {
      const els = d.elements.filter((e) => e.id !== dragId);
      const moving = d.elements.find((e) => e.id === dragId)!;
      const idx = els.findIndex((e) => e.id === targetId);
      // list is reversed: dropping onto an item places it just above that item
      els.splice(idx + 1, 0, moving);
      return { ...d, elements: els };
    });
  };

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-zinc-900">Layers</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Everything on your page, top to bottom. Drag to reorder — items higher in the list sit in front.
        </p>
      </div>
      {list.length === 0 && (
        <p className="mx-4 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
          Your page is empty. Add text, shapes or photos from the left menu.
        </p>
      )}
      <ul className="space-y-1 px-3 pb-4">
        {list.map((el, i) => (
          <li
            key={el.id}
            draggable={renaming !== el.id}
            onDragStart={() => setDragId(el.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(el.id);
            }}
            onDrop={() => drop(el.id)}
            onClick={(e) =>
              setSelected(e.shiftKey ? (selected.includes(el.id) ? selected.filter((s) => s !== el.id) : [...selected, el.id]) : [el.id])
            }
            className={cn(
              "group flex cursor-pointer items-center gap-2.5 rounded-lg border px-2 py-1.5 text-xs transition",
              selected.includes(el.id) ? "border-violet-300 bg-violet-50" : "border-transparent hover:bg-zinc-50",
              overId === el.id && dragId && dragId !== el.id && "border-t-2 border-t-violet-500",
              el.hidden && "opacity-50",
            )}
          >
            <span className="w-4 text-right text-[10px] text-zinc-400 tabular-nums">{list.length - i}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-600">
              <LayerIcon el={el} />
            </span>
            {renaming === el.id ? (
              <input
                autoFocus
                defaultValue={el.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  updateEls([el.id], { name: e.target.value || el.name });
                  setRenaming(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="min-w-0 flex-1 rounded border border-violet-400 px-1 py-0.5 outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setRenaming(el.id)} title="Double-click to rename">
                {el.type === "text" ? el.text?.split("\n")[0] || el.name : el.name}
              </span>
            )}
            <button
              title={el.locked ? "Unlock" : "Lock"}
              onClick={(e) => {
                e.stopPropagation();
                updateEls([el.id], { locked: !el.locked });
              }}
              className={cn("rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800", !el.locked && "opacity-0 group-hover:opacity-100")}
            >
              {el.locked ? <FiLock /> : <FiUnlock />}
            </button>
            <button
              title={el.hidden ? "Show" : "Hide"}
              onClick={(e) => {
                e.stopPropagation();
                updateEls([el.id], { hidden: !el.hidden });
              }}
              className={cn("rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800", !el.hidden && "opacity-0 group-hover:opacity-100")}
            >
              {el.hidden ? <FiEyeOff /> : <FiEye />}
            </button>
          </li>
        ))}
        {list.length > 0 && (
          <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400">
            <span className="w-4" />
            <span className="h-7 w-7 rounded border border-zinc-200" style={{ background: doc.background.kind === "solid" ? doc.background.color : "#ddd" }} />
            Background
          </li>
        )}
      </ul>
    </div>
  );
}
