import { useState } from "react";
import { FiChevronLeft, FiChevronRight, FiCopy, FiPlus, FiTrash2 } from "react-icons/fi";
import { STATIC } from "../lib/animation";
import { bgCss } from "../lib/background";
import { cn } from "../lib/cn";
import { docOf, useEditor } from "../store";
import { ElementView } from "./ElementView";

const THUMB_H = 64;

function Thumb({ index }: { index: number }) {
  const { project } = useEditor();
  const d = docOf(project, index);
  const { w, h } = d.frame;
  const s = THUMB_H / h;
  const span = d.context?.span;
  return (
    <div className="relative overflow-hidden rounded-md" style={{ width: w * s, height: THUMB_H }}>
      <div className="pointer-events-none absolute top-0 left-0" style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "0 0", ...(span ? {} : bgCss(d.background)) }}>
        {span && <div className="absolute top-0" style={{ left: -span.offset, width: span.width, height: h, ...bgCss(d.background) }} />}
        {d.context?.neighbours.map((el) => (
          <ElementView key={"n" + el.id} el={el} st={STATIC} editing={false} clock={el.type === "video" ? null : undefined} />
        ))}
        {d.elements.map((el) => (
          <ElementView key={el.id} el={el} st={STATIC} editing={false} clock={el.type === "video" ? null : undefined} />
        ))}
      </div>
    </div>
  );
}

/** Carousel slides: people swipe through these in order. */
export function PageStrip() {
  const { project, page, goToPage, addPage, deletePage, movePage, notify, kind, setPref } = useEditor();
  const carousel = kind === "carousel";
  const noun = carousel ? "slide" : "design";
  const [drag, setDrag] = useState<number | null>(null);
  const n = project.pages.length;
  const limit = carousel ? (project.frame.platformId === "instagram" ? 20 : 10) : 50;

  return (
    <div className="flex h-[112px] shrink-0 items-center gap-3 border-t border-zinc-200 bg-white px-4">
      <div className="w-36 shrink-0">
        <p className="text-xs font-semibold text-zinc-800">{carousel ? `Carousel · ${n} slide${n > 1 ? "s" : ""}` : `${n} design${n > 1 ? "s" : ""}`}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
          {carousel ? "Connected slides — items can cross from one into the next." : "Independent designs, each can have its own size."}
        </p>
        <button onClick={() => setPref("free", true)} className="mt-1 text-[11px] font-medium text-violet-600 hover:underline">
          Open free canvas →
        </button>
      </div>

      <div className="thin-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-2">
        {project.pages.map((pg, i) => (
          <div
            key={pg.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null && drag !== i) {
                movePage(drag, i);
                notify(`Moved to position ${i + 1}`);
              }
            }}
            onClick={() => goToPage(i)}
            className={cn(
              "group relative shrink-0 cursor-pointer rounded-lg p-1 transition",
              i === page ? "bg-violet-100 ring-2 ring-violet-500" : "ring-1 ring-zinc-200 hover:ring-violet-300",
              drag === i && "opacity-40",
            )}
            title={`${carousel ? "Slide" : "Design"} ${i + 1}`}
          >
            <Thumb index={i} />
            <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
            {i === page && n > 1 && (
              <div className="absolute -top-2 right-0 hidden gap-0.5 group-hover:flex">
                <button
                  className="rounded bg-white p-0.5 text-zinc-600 shadow ring-1 ring-zinc-200 hover:text-zinc-900 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    movePage(i, i - 1);
                  }}
                  title="Move left"
                >
                  <FiChevronLeft />
                </button>
                <button
                  className="rounded bg-white p-0.5 text-zinc-600 shadow ring-1 ring-zinc-200 hover:text-zinc-900 disabled:opacity-30"
                  disabled={i === n - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    movePage(i, i + 1);
                  }}
                  title="Move right"
                >
                  <FiChevronRight />
                </button>
                <button
                  className="rounded bg-white p-0.5 text-zinc-600 shadow ring-1 ring-zinc-200 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(i);
                    notify(`${carousel ? "Slide" : "Design"} ${i + 1} deleted — ⌘Z to undo`);
                  }}
                  title="Delete slide"
                >
                  <FiTrash2 />
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="flex shrink-0 flex-col gap-1.5 pl-1">
          <button
            onClick={() => {
              if (n >= limit) return notify(`This platform allows up to ${limit} slides in a carousel`);
              addPage(false);
              notify(carousel ? `Slide ${page + 2} added — it connects to the slide before it` : `Design ${page + 2} added — a blank, independent design`);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
          >
            <FiPlus /> Add {noun}
          </button>
          <button
            onClick={() => {
              if (n >= limit) return notify(`This platform allows up to ${limit} slides in a carousel`);
              addPage(true);
              notify(`${carousel ? "Slide" : "Design"} duplicated — edit the copy`);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            <FiCopy /> Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}
