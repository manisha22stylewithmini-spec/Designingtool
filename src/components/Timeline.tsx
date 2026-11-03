import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiChevronRight, FiFilm, FiImage, FiMusic, FiPause, FiPlay, FiRepeat, FiScissors, FiSkipBack, FiTrash2, FiType } from "react-icons/fi";
import { IoShapesOutline } from "react-icons/io5";
import { PiBezierCurve, PiCaretLeft, PiCaretRight, PiDiamond, PiDiamondFill, PiTimer } from "react-icons/pi";
import { IN_ANIMS } from "../data/presets";
import { KEY_EASES, KEY_PROPS, propValue, setKey } from "../lib/animation";
import { cn } from "../lib/cn";
import { resolveSrc } from "../lib/media";
import { trackGain } from "../lib/music";
import { useEditor } from "../store";
import type { El, KeyEase, Keyframe, KeyProp } from "../types";
import { useActions } from "./useActions";

const LABEL_W = 268;
const ROW = 36;
const PROP_ROW = 28;

type KeySel = { id: string; prop: KeyProp; i: number } | null;

function loadHeight() {
  try {
    return Number(localStorage.getItem("postcraft-timeline-h")) || 280;
  } catch {
    return 280;
  }
}

export function Timeline({ loop, setLoop }: { loop: boolean; setLoop: (v: boolean) => void }) {
  const actions = useActions();
  const { doc, time, setTime, playing, setPlaying, selected, setSelected, updateEls, checkpoint, setHint, notify } = useEditor();
  const trackRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const D = doc.duration;
  const rows = [...doc.elements].reverse();

  // ---- size & zoom ----
  const [height, setHeight] = useState(loadHeight);
  const [viewW, setViewW] = useState(800);
  const [zoomPct, setZoomPct] = useState(0); // 0 = fit the whole video
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitPps = Math.max(20, (viewW - LABEL_W - 28) / Math.max(0.5, D));
  const pps = fitPps * (1 + zoomPct / 12); // pixels per second
  const trackW = D * pps;

  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // selecting an item that already has keyframes opens its property rows
  useEffect(() => {
    const el = doc.elements.find((e) => selected.length === 1 && e.id === selected[0]);
    if (el?.keys && Object.values(el.keys).some((k) => k?.length)) setOpen((s) => (s.has(el.id) ? s : new Set(s).add(el.id)));
  }, [selected, doc.elements]);

  const [keySel, setKeySel] = useState<KeySel>(null);

  const timeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(D, ((clientX - r.left) / trackW) * D));
  };

  const scrub = (e: React.PointerEvent) => {
    setPlaying(false);
    setKeySel(null);
    setTime(timeAt(e.clientX));
    const move = (ev: PointerEvent) => setTime(timeAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resize = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = height;
    const move = (ev: PointerEvent) => setHeight(Math.max(160, Math.min(window.innerHeight * 0.75, h0 - (ev.clientY - y0))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHeight((h) => {
        try {
          localStorage.setItem("postcraft-timeline-h", String(Math.round(h)));
        } catch {
          /* ignore */
        }
        return h;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const snap = (v: number, except?: number) => {
    if (Math.abs(v - time) < 6 / pps && except !== time) return time;
    return Math.round(v * 20) / 20;
  };

  // ---- layer bars (in / out) ----
  const dragBar = (e: React.PointerEvent, el: El, part: "move" | "start" | "end") => {
    e.stopPropagation();
    setSelected([el.id]);
    setPlaying(false);
    const t0 = timeAt(e.clientX);
    const { start, end } = el.anim;
    let started = false;
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
      setHint(`“${el.name}” is on screen from ${s.toFixed(2)}s to ${en.toFixed(2)}s`);
      // keyframes travel with the layer when the whole bar moves
      const shift = part === "move" ? s - start : 0;
      const keys =
        shift && el.keys
          ? Object.fromEntries(Object.entries(el.keys).map(([p, ks]) => [p, ks?.map((k) => ({ ...k, t: Math.max(0, Math.min(D, k.t + shift)) }))]))
          : el.keys;
      updateEls([el.id], { anim: { ...el.anim, start: s, end: en }, keys }, false);
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

  // ---- keyframes ----
  const keysOf = (el: El, prop: KeyProp) => el.keys?.[prop] ?? [];
  const writeKeys = (el: El, prop: KeyProp, ks: Keyframe[], history = true) =>
    updateEls([el.id], { keys: { ...el.keys, [prop]: ks } }, history);

  const toggleStopwatch = (el: El, prop: KeyProp) => {
    const ks = keysOf(el, prop);
    if (ks.length) {
      // turning animation off keeps the value it has right now
      const v = propValue(el, prop, time);
      const base: Partial<El> = prop === "position" ? { x: v[0], y: v[1] } : prop === "rotation" ? { rotation: v[0] } : prop === "opacity" ? { opacity: v[0] } : {};
      const rest = { ...el.keys };
      delete rest[prop];
      updateEls([el.id], { ...base, keys: rest });
      setKeySel(null);
      notify(`${KEY_PROPS.find((p) => p.id === prop)!.label} keyframes removed`);
    } else {
      updateEls([el.id], { keys: setKey(el, prop, time, propValue(el, prop, time)).keys });
      notify(`Keyframe added at ${time.toFixed(2)}s — move the playhead and change the value to animate`);
    }
  };

  const setValue = (el: El, prop: KeyProp, v: number[]) => {
    const keyed = keysOf(el, prop).length > 0;
    if (keyed || prop === "scale") updateEls([el.id], { keys: setKey(el, prop, time, v).keys });
    else if (prop === "position") updateEls([el.id], { x: v[0], y: v[1] });
    else if (prop === "rotation") updateEls([el.id], { rotation: v[0] });
    else updateEls([el.id], { opacity: v[0] });
  };

  const jump = (el: El, prop: KeyProp, dir: -1 | 1) => {
    const ks = keysOf(el, prop);
    const k = dir < 0 ? [...ks].reverse().find((x) => x.t < time - 0.005) : ks.find((x) => x.t > time + 0.005);
    if (k) {
      setPlaying(false);
      setTime(k.t);
      setKeySel({ id: el.id, prop, i: ks.indexOf(k) });
    }
  };

  const toggleKeyHere = (el: El, prop: KeyProp) => {
    const ks = keysOf(el, prop);
    const i = ks.findIndex((k) => Math.abs(k.t - time) < 0.02);
    if (i >= 0) {
      writeKeys(el, prop, ks.filter((_, j) => j !== i));
      setKeySel(null);
    } else updateEls([el.id], { keys: setKey(el, prop, time, propValue(el, prop, time)).keys });
  };

  const dragKey = (e: React.PointerEvent, el: El, prop: KeyProp, i: number) => {
    e.stopPropagation();
    setPlaying(false);
    setSelected([el.id]);
    setKeySel({ id: el.id, prop, i });
    const ks = keysOf(el, prop);
    const t0 = ks[i].t;
    const x0 = e.clientX;
    setTime(t0);
    let started = false;
    const move = (ev: PointerEvent) => {
      const t = Math.max(0, Math.min(D, snap(t0 + (ev.clientX - x0) / pps, t0)));
      if (!started) {
        if (Math.abs(ev.clientX - x0) < 3) return;
        checkpoint();
        started = true;
      }
      const next = ks.map((k, j) => (j === i ? { ...k, t } : k));
      const moved = next[i];
      next.sort((a, b) => a.t - b.t);
      setKeySel({ id: el.id, prop, i: next.indexOf(moved) });
      setHint(`Keyframe at ${t.toFixed(2)}s`);
      writeKeys(el, prop, next, false);
      setTime(t);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHint(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const selKeyEl = keySel ? doc.elements.find((e) => e.id === keySel.id) : undefined;
  const selKey = selKeyEl && keySel ? keysOf(selKeyEl, keySel.prop)[keySel.i] : undefined;

  // Delete removes the selected keyframe (before the canvas deletes the item)
  useEffect(() => {
    if (!selKey || !selKeyEl || !keySel) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, select")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        writeKeys(selKeyEl, keySel.prop, keysOf(selKeyEl, keySel.prop).filter((_, j) => j !== keySel.i));
        setKeySel(null);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });

  const ticks: number[] = [];
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  const step = steps.find((s) => s * pps >= 60) ?? 10;
  for (let t = 0; t <= D + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);

  return (
    <div className="relative flex shrink-0 flex-col border-t border-zinc-200 bg-white" style={{ height }}>
      {/* drag to make the timeline taller / shorter */}
      <div onPointerDown={resize} className="absolute -top-1 right-0 left-0 z-30 h-2 cursor-row-resize hover:bg-violet-400/30" title="Drag to resize the timeline" />

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
        <button onClick={() => setTime(0)} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100" title="Back to start">
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
          {time.toFixed(2)}s <span className="text-zinc-400">/ {D.toFixed(1)}s</span>
        </span>

        {selKey && selKeyEl && keySel && (
          <div className="ml-2 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-0.5 pr-1 pl-2 text-[11px] text-violet-800">
            <PiDiamondFill />
            {KEY_PROPS.find((p) => p.id === keySel.prop)!.label} key at {selKey.t.toFixed(2)}s
            <select
              value={selKey.ease}
              onChange={(e) =>
                writeKeys(
                  selKeyEl,
                  keySel.prop,
                  keysOf(selKeyEl, keySel.prop).map((k, j) => (j === keySel.i ? { ...k, ease: e.target.value as KeyEase } : k)),
                )
              }
              className="rounded border border-violet-200 bg-white px-1 py-0.5 text-[11px] outline-none"
              title="How it moves from this keyframe to the next one"
            >
              {KEY_EASES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                writeKeys(selKeyEl, keySel.prop, keysOf(selKeyEl, keySel.prop).filter((_, j) => j !== keySel.i));
                setKeySel(null);
              }}
              className="rounded p-1 hover:bg-violet-100"
              title="Delete keyframe (Delete)"
            >
              <FiTrash2 />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
          <span>Zoom</span>
          <input type="range" min={0} max={100} value={zoomPct} onChange={(e) => setZoomPct(Number(e.target.value))} className="range w-28" title="Zoom the timeline in to place keyframes precisely" />
          <button onClick={() => setZoomPct(0)} className={cn("rounded px-1.5 py-0.5", zoomPct === 0 ? "bg-violet-100 text-violet-700" : "hover:bg-zinc-100")}>
            Fit
          </button>
        </div>
      </div>

      <div ref={viewRef} className="thin-scroll relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL_W + trackW + 28, minHeight: "100%" }}>
          {/* Ruler */}
          <div className="sticky top-0 z-20 flex h-6 bg-white">
            <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 border-r border-b border-zinc-100 bg-white px-3 text-[10px] leading-6 text-zinc-400">
              LAYERS · click ▸ to keyframe
            </div>
            <div ref={trackRef} className="relative cursor-pointer border-b border-zinc-100" style={{ width: trackW }} onPointerDown={scrub}>
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-zinc-200 pl-1 text-[10px] text-zinc-400" style={{ left: t * pps }}>
                  {t}s
                </span>
              ))}
            </div>
          </div>

          {rows.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">Add something to your design to animate it.</p>}

          {rows.map((el) => {
            const a = el.anim;
            const inW = a.inType !== "none" ? Math.min(1, a.inDur / Math.max(0.01, a.end - a.start)) * 100 : 0;
            const outW = a.outType !== "none" ? Math.min(1, a.outDur / Math.max(0.01, a.end - a.start)) * 100 : 0;
            const sel = selected.includes(el.id);
            const isOpen = open.has(el.id);
            const Icon = el.type === "text" ? FiType : el.type === "image" ? FiImage : el.type === "video" ? FiFilm : el.type === "path" ? PiBezierCurve : IoShapesOutline;
            const allKeys = KEY_PROPS.flatMap((p) => keysOf(el, p.id).map((k) => k.t));
            return (
              <div key={el.id}>
                <div className={cn("flex items-center", sel && "bg-violet-50/70")} style={{ height: ROW }}>
                  <div style={{ width: LABEL_W }} className={cn("sticky left-0 z-10 flex h-full shrink-0 items-center gap-1 border-r border-zinc-100 pr-2 pl-1", sel ? "bg-violet-50" : "bg-white")}>
                    <button
                      onClick={() => toggleOpen(el.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                      title={isOpen ? "Hide keyframe properties" : "Show keyframe properties (Position, Scale, Rotation, Opacity)"}
                    >
                      <FiChevronRight className={cn("transition", isOpen && "rotate-90")} />
                    </button>
                    <button onClick={() => setSelected([el.id])} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-zinc-700">
                      <Icon className="shrink-0 text-zinc-400" />
                      <span className="truncate">{el.type === "text" ? el.text?.split("\n")[0] : el.name}</span>
                      {allKeys.length > 0 && <PiDiamondFill className="shrink-0 text-[10px] text-amber-500" title="Has keyframes" />}
                    </button>
                  </div>
                  <div className="relative h-full" style={{ width: trackW }}>
                    <div
                      onPointerDown={(e) => dragBar(e, el, "move")}
                      className={cn(
                        "group absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border text-[10px] font-medium active:cursor-grabbing",
                        sel ? "border-violet-600 bg-violet-200 text-violet-900" : "border-violet-300 bg-violet-100 text-violet-800",
                        el.hidden && "opacity-40",
                      )}
                      style={{ left: a.start * pps, width: Math.max(4, (a.end - a.start) * pps) }}
                      title={`${a.start.toFixed(2)}s → ${a.end.toFixed(2)}s · drag to move (keyframes move too) · drag the ends to trim`}
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
                    {/* when collapsed, still show where keyframes are */}
                    {!isOpen &&
                      [...new Set(allKeys)].map((t) => (
                        <PiDiamondFill key={t} className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-amber-500" style={{ left: t * pps }} />
                      ))}
                  </div>
                </div>

                {isOpen &&
                  KEY_PROPS.map((p) => {
                    const ks = keysOf(el, p.id);
                    const keyed = ks.length > 0;
                    const v = propValue(el, p.id, time);
                    const onKey = ks.findIndex((k) => Math.abs(k.t - time) < 0.02);
                    const shown = p.id === "opacity" ? [Math.round(v[0] * 100)] : v.map((n) => Math.round(n * 10) / 10);
                    return (
                      <div key={p.id} className="flex items-center bg-zinc-50/60" style={{ height: PROP_ROW }}>
                        <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-1 border-r border-zinc-100 bg-zinc-50 pr-1 pl-7 text-[11px] text-zinc-600">
                          <button
                            onClick={() => toggleStopwatch(el, p.id)}
                            className={cn("rounded p-0.5 text-[14px]", keyed ? "text-amber-500" : "text-zinc-300 hover:text-zinc-600")}
                            title={keyed ? "Stop animating this (removes its keyframes)" : "Animate this — adds a keyframe at the playhead"}
                          >
                            <PiTimer />
                          </button>
                          <span className="w-[52px] shrink-0 truncate">{p.label}</span>
                          {shown.map((n, j) => (
                            <input
                              key={j}
                              type="number"
                              value={n}
                              onFocus={checkpoint}
                              onChange={(e) => {
                                const num = Number(e.target.value);
                                if (Number.isNaN(num)) return;
                                const next = [...v];
                                next[j] = p.id === "opacity" ? Math.max(0, Math.min(1, num / 100)) : num;
                                setValue(el, p.id, next);
                              }}
                              className={cn(
                                "w-[50px] shrink-0 rounded border bg-white px-1 py-0.5 text-[11px] tabular-nums outline-none focus:border-violet-500",
                                keyed ? "border-amber-300 text-amber-700" : "border-zinc-200",
                              )}
                              title={keyed ? "Changing this sets a keyframe at the playhead" : p.id === "scale" ? "Changing scale starts keyframing it" : "Value (no animation yet)"}
                            />
                          ))}
                          <span className="ml-auto flex items-center">
                            <button disabled={!keyed} onClick={() => jump(el, p.id, -1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30" title="Previous keyframe">
                              <PiCaretLeft />
                            </button>
                            <button onClick={() => toggleKeyHere(el, p.id)} className={cn("rounded p-0.5", onKey >= 0 ? "text-amber-500" : "text-zinc-400 hover:text-zinc-800")} title={onKey >= 0 ? "Remove keyframe here" : "Add keyframe at the playhead"}>
                              {onKey >= 0 ? <PiDiamondFill /> : <PiDiamond />}
                            </button>
                            <button disabled={!keyed} onClick={() => jump(el, p.id, 1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30" title="Next keyframe">
                              <PiCaretRight />
                            </button>
                          </span>
                        </div>
                        <div className="relative h-full" style={{ width: trackW }}>
                          {/* line between keyframes */}
                          {ks.length > 1 && (
                            <div className="absolute top-1/2 h-px bg-amber-300" style={{ left: ks[0].t * pps, width: (ks[ks.length - 1].t - ks[0].t) * pps }} />
                          )}
                          {ks.map((k, i) => {
                            const isSel = keySel?.id === el.id && keySel.prop === p.id && keySel.i === i;
                            return (
                              <button
                                key={i}
                                onPointerDown={(e) => dragKey(e, el, p.id, i)}
                                className={cn(
                                  "absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center text-[13px]",
                                  isSel ? "text-violet-600" : "text-amber-500 hover:text-amber-600",
                                )}
                                style={{ left: k.t * pps }}
                                title={`${k.t.toFixed(2)}s · ${KEY_EASES.find((x) => x.id === k.ease)?.label} — drag to move, Delete to remove`}
                              >
                                {k.ease === "hold" ? <span className="block h-2.5 w-2.5 bg-current" /> : <PiDiamondFill />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {doc.audio && <AudioRow D={D} pps={pps} trackW={trackW} timeAt={timeAt} />}

          {/* Playhead */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-red-500" style={{ left: LABEL_W + time * pps }}>
            <div className="absolute -top-0.5 -left-[5px] h-3 w-3 rotate-45 rounded-sm bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Music row: drag the bar to change when the song starts. Also plays the song in sync with the playhead. */
function AudioRow({ D, pps, trackW, timeAt }: { D: number; pps: number; trackW: number; timeAt: (x: number) => number }) {
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
      <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-2 truncate border-r border-zinc-100 bg-emerald-50 px-3 text-xs text-zinc-700">
        <FiMusic className="shrink-0 text-emerald-600" />
        <span className="truncate">{a.name}</span>
      </div>
      <div className="relative h-full" style={{ width: trackW }}>
        <div
          onPointerDown={drag}
          className="absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border border-emerald-400 bg-emerald-100 text-[10px] font-medium text-emerald-900 active:cursor-grabbing"
          style={{ left: a.start * pps, width: Math.max(0.1, end - a.start) * pps }}
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
