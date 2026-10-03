import { useEffect, useRef } from "react";
import { FiMusic, FiScissors, FiFilm, FiImage, FiPause, FiPlay, FiRepeat, FiSkipBack, FiType } from "react-icons/fi";
import { IoShapesOutline } from "react-icons/io5";
import { IN_ANIMS } from "../data/presets";
import { cn } from "../lib/cn";
import { useEditor } from "../store";
import type { El } from "../types";
import { useActions } from "./useActions";
import { resolveSrc } from "../lib/media";
import { trackGain } from "../lib/music";

const LABEL_W = 170;

export function Timeline({ loop, setLoop }: { loop: boolean; setLoop: (v: boolean) => void }) {
  const actions = useActions();
  const { doc, time, setTime, playing, setPlaying, selected, setSelected, updateEls, checkpoint, setHint } = useEditor();
  const trackRef = useRef<HTMLDivElement>(null);
  const D = doc.duration;
  const rows = [...doc.elements].reverse();

  const timeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(D, ((clientX - r.left) / r.width) * D));
  };

  const scrub = (e: React.PointerEvent) => {
    setPlaying(false);
    setTime(timeAt(e.clientX));
    const move = (ev: PointerEvent) => setTime(timeAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragBar = (e: React.PointerEvent, el: El, part: "move" | "start" | "end") => {
    e.stopPropagation();
    setSelected([el.id]);
    setPlaying(false);
    const t0 = timeAt(e.clientX);
    const { start, end } = el.anim;
    let started = false;
    const snap = (v: number) => {
      const r = Math.round(v * 10) / 10;
      return Math.abs(v - time) < 0.08 ? time : r;
    };
    const move = (ev: PointerEvent) => {
      if (!started) {
        checkpoint();
        started = true;
      }
      const dt = timeAt(ev.clientX) - t0;
      let s = start;
      let en = end;
      if (part === "move") {
        const len = end - start;
        s = Math.max(0, Math.min(D - len, snap(start + dt)));
        en = s + len;
      } else if (part === "start") s = Math.max(0, Math.min(end - 0.2, snap(start + dt)));
      else en = Math.min(D, Math.max(start + 0.2, snap(end + dt)));
      setHint(`“${el.name}” is on screen from ${s.toFixed(1)}s to ${en.toFixed(1)}s`);
      updateEls([el.id], { anim: { ...el.anim, start: s, end: en } }, false);
      setTime(part === "end" ? en : s);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ticks: number[] = [];
  const step = D > 15 ? 2 : D > 6 ? 1 : 0.5;
  for (let t = 0; t <= D + 1e-6; t += step) ticks.push(Math.round(t * 10) / 10);

  return (
    <div className="flex h-[230px] shrink-0 flex-col border-t border-zinc-200 bg-white">
      {/* Controls */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-100 px-3">
        <button
          onClick={() => {
            if (!playing && time >= D - 0.01) setTime(0);
            setPlaying(!playing);
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700"
          title="Play / pause (Space)"
        >
          {playing ? <FiPause /> : <FiPlay />} {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => {
            setTime(0);
          }}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          title="Back to start"
        >
          <FiSkipBack />
        </button>
        <button
          onClick={() => setLoop(!loop)}
          className={cn("rounded-lg p-2 hover:bg-zinc-100", loop ? "text-violet-600" : "text-zinc-400")}
          title={loop ? "Repeat is on" : "Repeat is off"}
        >
          <FiRepeat />
        </button>
        {selected.length === 1 && doc.elements.find((e) => e.id === selected[0])?.type === "video" && (
          <button
            onClick={actions.splitClip}
            disabled={!actions.canSplit()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            title="Cut the selected clip at the red playhead (S)"
          >
            <FiScissors /> Split
          </button>
        )}
        <span className="ml-1 font-mono text-xs whitespace-nowrap text-zinc-700 tabular-nums">
          {time.toFixed(1)}s <span className="text-zinc-400">/ {D.toFixed(1)}s</span>
        </span>
        <p className="ml-auto hidden text-[11px] text-zinc-400 lg:block">
          Drag a bar to change <b>when</b> it appears · drag its ends to change <b>how long</b> it stays · click the ruler to jump
        </p>
      </div>

      <div className="thin-scroll flex min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex-1">
          {/* Ruler */}
          <div className="sticky top-0 z-10 flex h-6 bg-white">
            <div style={{ width: LABEL_W }} className="shrink-0 border-r border-zinc-100 px-3 text-[10px] leading-6 text-zinc-400">
              LAYERS
            </div>
            <div ref={trackRef} className="relative mr-4 flex-1 cursor-pointer border-b border-zinc-100" onPointerDown={scrub}>
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-zinc-200 pl-1 text-[10px] text-zinc-400" style={{ left: `${(t / D) * 100}%` }}>
                  {t}s
                </span>
              ))}
            </div>
          </div>

          {rows.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">Add something to your design to animate it.</p>}

          {rows.map((el) => {
            const a = el.anim;
            const left = (a.start / D) * 100;
            const width = ((a.end - a.start) / D) * 100;
            const inW = a.inType !== "none" ? Math.min(1, a.inDur / Math.max(0.01, a.end - a.start)) * 100 : 0;
            const outW = a.outType !== "none" ? Math.min(1, a.outDur / Math.max(0.01, a.end - a.start)) * 100 : 0;
            const sel = selected.includes(el.id);
            const Icon = el.type === "text" ? FiType : el.type === "image" ? FiImage : el.type === "video" ? FiFilm : IoShapesOutline;
            return (
              <div key={el.id} className={cn("flex h-9 items-center", sel && "bg-violet-50/70")}>
                <button
                  style={{ width: LABEL_W }}
                  onClick={() => setSelected([el.id])}
                  className="flex h-full shrink-0 items-center gap-2 truncate border-r border-zinc-100 px-3 text-left text-xs text-zinc-700"
                >
                  <Icon className="shrink-0 text-zinc-400" />
                  <span className="truncate">{el.type === "text" ? el.text?.split("\n")[0] : el.name}</span>
                </button>
                <div className="relative mr-4 h-full flex-1">
                  <div
                    onPointerDown={(e) => dragBar(e, el, "move")}
                    className={cn(
                      "group absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border text-[10px] font-medium active:cursor-grabbing",
                      sel ? "border-violet-600 bg-violet-200 text-violet-900" : "border-violet-300 bg-violet-100 text-violet-800",
                      el.hidden && "opacity-40",
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${a.start.toFixed(1)}s → ${a.end.toFixed(1)}s`}
                  >
                    {inW > 0 && <div className="absolute inset-y-0 left-0 bg-violet-400/50" style={{ width: `${inW}%` }} />}
                    {outW > 0 && <div className="absolute inset-y-0 right-0 bg-fuchsia-400/40" style={{ width: `${outW}%` }} />}
                    <span className="relative truncate px-2">
                      {IN_ANIMS.find((x) => x.id === a.inType)?.label}
                      {a.loop !== "none" && " · ∞ " + a.loop}
                    </span>
                    <div onPointerDown={(e) => dragBar(e, el, "start")} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-violet-600/0 hover:bg-violet-600/60" />
                    <div onPointerDown={(e) => dragBar(e, el, "end")} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-violet-600/0 hover:bg-violet-600/60" />
                  </div>
                </div>
              </div>
            );
          })}

          {doc.audio && <AudioRow D={D} timeAt={timeAt} />}

          {/* Playhead */}
          <div className="pointer-events-none absolute top-0 bottom-0 flex" style={{ left: LABEL_W, right: 16 }}>
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${(time / D) * 100}%` }}>
              <div className="absolute -top-0.5 -left-[5px] h-3 w-3 rotate-45 rounded-sm bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Music row: drag the bar to change when the song starts. Also plays the song in sync with the playhead. */
function AudioRow({ D, timeAt }: { D: number; timeAt: (x: number) => number }) {
  const { doc, update, checkpoint, time, playing, setHint } = useEditor();
  const a = doc.audio!;
  const end = Math.min(D, a.start + a.length - a.trimStart);
  const ref = useRef<HTMLAudioElement>(null);

  // keep the <audio> element in step with the timeline
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = time >= a.start && time < end;
    el.volume = on ? Math.max(0, Math.min(1, trackGain(a, end, time))) : 0;
    const target = a.trimStart + (time - a.start);
    if (playing && on) {
      if (el.paused) {
        el.currentTime = target;
        el.play().catch(() => undefined);
      } else if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target;
    } else if (!el.paused) el.pause();
  });

  const drag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const t0 = timeAt(e.clientX);
    const s0 = a.start;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) {
        checkpoint();
        started = true;
      }
      const s = Math.max(0, Math.min(D - 0.5, Math.round((s0 + timeAt(ev.clientX) - t0) * 10) / 10));
      setHint(`Music starts at ${s.toFixed(1)}s`);
      update((d) => (d.audio ? { ...d, audio: { ...d.audio, start: s } } : d), false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex h-9 items-center border-t border-zinc-100 bg-emerald-50/40">
      <audio ref={ref} src={resolveSrc(a.src)} preload="auto" />
      <div style={{ width: 170 }} className="flex h-full shrink-0 items-center gap-2 truncate border-r border-zinc-100 px-3 text-xs text-zinc-700">
        <FiMusic className="shrink-0 text-emerald-600" />
        <span className="truncate">{a.name}</span>
      </div>
      <div className="relative mr-4 h-full flex-1">
        <div
          onPointerDown={drag}
          className="absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border border-emerald-400 bg-emerald-100 text-[10px] font-medium text-emerald-900 active:cursor-grabbing"
          style={{ left: `${(a.start / D) * 100}%`, width: `${(Math.max(0.1, end - a.start) / D) * 100}%` }}
          title="Drag to change when the music starts"
        >
          {/* simple waveform look */}
          <svg className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 10">
            {[...Array(60)].map((_, i) => {
              const h = 2 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 7;
              return <rect key={i} x={i * 1.66} y={5 - h / 2} width={0.9} height={h} fill="#047857" />;
            })}
          </svg>
          <span className="relative truncate px-2">♪ {a.name}</span>
        </div>
      </div>
    </div>
  );
}
