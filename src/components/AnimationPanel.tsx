import { useEffect, useState } from "react";
import { FiPlay } from "react-icons/fi";
import { EASINGS, IN_ANIMS, LOOP_ANIMS, OUT_ANIMS } from "../data/presets";
import { animState } from "../lib/animation";
import { cn } from "../lib/cn";
import { defaultAnim } from "../lib/factory";
import { useEditor } from "../store";
import type { Anim, El, InAnim, LoopAnim, OutAnim } from "../types";
import { Section, Segmented, Slider } from "./ui";

const MINI_FRAME = { platformId: "", variantId: "", w: 60, h: 60 };

/** Tiny looping preview of an animation, shown on each option card. */
function MiniPreview({ anim, active, text }: { anim: Partial<Anim>; active: boolean; text?: boolean }) {
  const [t, setT] = useState(1.2);
  useEffect(() => {
    if (!active) {
      setT(anim.outType && anim.outType !== "none" ? 0.6 : 1.2);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      setT(((performance.now() - t0) / 1000) % 2.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, anim.outType]);
  const isOut = !!anim.outType && anim.outType !== "none";
  const el = {
    type: text ? "text" : "shape",
    text: "Abc",
    anim: {
      ...defaultAnim(2),
      inType: "none",
      start: 0,
      end: isOut ? 1.6 : 99,
      inDur: 0.7,
      ...anim,
    },
  } as El;
  const st = animState(el, isOut ? t : t, MINI_FRAME);
  const shown = st.chars >= 0 ? "Abc".slice(0, st.chars) : "Abc";
  return (
    <div className="flex h-10 w-full items-center justify-center overflow-hidden">
      {st.visible && (
        <div
          style={{
            opacity: st.opacity,
            transform: `translate(${st.tx * 0.6}px, ${st.ty * 0.6}px) rotate(${st.rotate}deg) scale(${st.scale})`,
            clipPath: st.reveal < 1 ? `inset(0 ${(1 - st.reveal) * 100}% 0 0)` : undefined,
          }}
          className={cn(
            text ? "text-sm font-bold text-violet-700" : "h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500",
          )}
        >
          {text ? shown || "​" : null}
        </div>
      )}
    </div>
  );
}

function OptionGrid<T extends string>({
  options,
  value,
  onPick,
  preview,
  mixed,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onPick: (v: T) => void;
  preview: (id: T) => Partial<Anim>;
  mixed?: boolean;
}) {
  const [hover, setHover] = useState<T | null>(null);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          title={o.hint}
          onClick={() => onPick(o.id)}
          onPointerEnter={() => setHover(o.id)}
          onPointerLeave={() => setHover(null)}
          className={cn(
            "rounded-xl border px-1 pt-1 pb-1.5 text-center transition",
            value === o.id && !mixed ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-zinc-200 hover:border-violet-300",
          )}
        >
          {o.id === "none" ? (
            <div className="flex h-10 items-center justify-center text-lg text-zinc-300">⊘</div>
          ) : (
            <MiniPreview anim={preview(o.id)} active={hover === o.id || (value === o.id && !mixed)} text={o.id === "typewriter"} />
          )}
          <span className="block text-[11px] font-medium text-zinc-700">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

const PRESETS: { id: string; label: string; desc: string; inType: InAnim; stagger: number; loop?: LoopAnim }[] = [
  { id: "fade", label: "Gentle fade", desc: "Everything fades in together", inType: "fade", stagger: 0 },
  { id: "rise", label: "Rise one by one", desc: "Items slide up in order", inType: "slideUp", stagger: 0.35 },
  { id: "pop", label: "Pop one by one", desc: "Playful bounce-in", inType: "pop", stagger: 0.3 },
  { id: "zoom", label: "Zoom in", desc: "Items grow into place", inType: "zoomIn", stagger: 0.2 },
  { id: "none", label: "No animation", desc: "Static — like a photo", inType: "none", stagger: 0 },
];

export function AnimationPanel() {
  const ed = useEditor();
  const { doc, selectedEls: sel, selected, update, updateEls, setTime, setPlaying, notify } = ed;

  if (!sel.length) {
    return (
      <div>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">Animation</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Your design becomes a short video. <b>Select an item</b> (on the canvas or the timeline below) to choose how it
            appears, moves and leaves — or animate everything at once:
          </p>
        </div>
        <Section title="Animate everything">
          <div className="space-y-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  update((d) => ({
                    ...d,
                    elements: d.elements.map((e, i) => ({
                      ...e,
                      anim: {
                        ...e.anim,
                        inType: p.inType,
                        start: Math.min(d.duration - 0.5, i * p.stagger),
                        end: d.duration,
                        easing: p.inType === "pop" ? "bouncy" : "smooth",
                      },
                    })),
                  }));
                  setTime(0);
                  setPlaying(true);
                  notify(`“${p.label}” applied to all ${doc.elements.length} items — playing preview`);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:border-violet-300 hover:bg-violet-50/40"
              >
                <span>
                  <span className="block text-xs font-semibold text-zinc-800">{p.label}</span>
                  <span className="block text-[11px] text-zinc-500">{p.desc}</span>
                </span>
                <FiPlay className="text-violet-500" />
              </button>
            ))}
          </div>
        </Section>
        <Section title="Video length" hint="How long the whole animation plays">
          <Slider
            label="Length"
            value={doc.duration}
            min={1}
            max={30}
            step={0.5}
            unit="s"
            onChange={(v, h) =>
              update(
                (d) => ({
                  ...d,
                  duration: v,
                  elements: d.elements.map((e) => {
                    const end = e.anim.end >= d.duration - 0.01 || e.anim.end > v ? v : e.anim.end;
                    return { ...e, anim: { ...e.anim, end, start: Math.min(e.anim.start, Math.max(0, end - 0.1)) } };
                  }),
                }),
                h,
              )
            }
          />
        </Section>
      </div>
    );
  }

  const el = sel[0];
  const a = el.anim;
  const setA = (patch: Partial<Anim>, history = true) =>
    updateEls(selected, (e) => ({ anim: { ...e.anim, ...patch } }), history);
  const mixed = (k: keyof Anim) => sel.some((e) => e.anim[k] !== a[k]);
  const preview = (from = a.start) => {
    setTime(Math.max(0, from - 0.1));
    setPlaying(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-violet-600 uppercase">Animating</p>
          <h2 className="truncate text-sm font-semibold text-zinc-900">
            {sel.length > 1 ? `${sel.length} items` : el.type === "text" ? el.text?.split("\n")[0] : el.name}
          </h2>
        </div>
        <button
          onClick={() => preview()}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
        >
          <FiPlay /> Preview
        </button>
      </div>

      <Section title="① Entrance" hint="How it appears">
        <OptionGrid<InAnim>
          options={IN_ANIMS.filter((o) => o.id !== "typewriter" || sel.every((e) => e.type === "text"))}
          value={a.inType}
          mixed={mixed("inType")}
          onPick={(v) => {
            setA({ inType: v, easing: v === "pop" ? "bouncy" : a.easing === "bouncy" ? "smooth" : a.easing, inDur: v === "typewriter" ? 1.5 : a.inDur });
            preview();
          }}
          preview={(id) => ({ inType: id, inDur: id === "typewriter" ? 1.2 : 0.7, easing: id === "pop" ? "bouncy" : "smooth" })}
        />
        {a.inType !== "none" && (
          <>
            <Slider label="Speed" value={a.inDur} min={0.1} max={3} step={0.1} unit="s" onChange={(v, h) => setA({ inDur: v }, h)} />
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-zinc-600">Motion feel</span>
              <Segmented className="flex-1" value={a.easing} onChange={(v) => setA({ easing: v })} options={EASINGS} />
            </div>
          </>
        )}
      </Section>

      <Section title="② While on screen" hint="A movement that repeats">
        <OptionGrid<LoopAnim> options={LOOP_ANIMS} value={a.loop} mixed={mixed("loop")} onPick={(v) => setA({ loop: v })} preview={(id) => ({ loop: id })} />
      </Section>

      <Section title="③ Exit" hint="How it leaves at the end">
        <OptionGrid<OutAnim>
          options={OUT_ANIMS}
          value={a.outType}
          mixed={mixed("outType")}
          onPick={(v) => {
            setA({ outType: v });
            if (v !== "none") preview(Math.max(0, a.end - a.outDur - 0.6));
          }}
          preview={(id) => ({ outType: id, outDur: 0.6 })}
        />
        {a.outType !== "none" && (
          <Slider label="Speed" value={a.outDur} min={0.1} max={3} step={0.1} unit="s" onChange={(v, h) => setA({ outDur: v }, h)} />
        )}
      </Section>

      <Section title="④ Timing" hint="Or drag the bar in the timeline below">
        <Slider
          label="Appears at"
          value={a.start}
          min={0}
          max={doc.duration}
          step={0.1}
          unit="s"
          onChange={(v, h) => setA({ start: Math.min(v, a.end - 0.1) }, h)}
        />
        <Slider
          label="Leaves at"
          value={a.end}
          min={0}
          max={doc.duration}
          step={0.1}
          unit="s"
          onChange={(v, h) => setA({ end: Math.max(v, a.start + 0.1) }, h)}
        />
        <p className="rounded-lg bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-500">
          On screen from <b>{a.start.toFixed(1)}s</b> to <b>{a.end.toFixed(1)}s</b>
          {a.end >= doc.duration - 0.01 ? " (until the end)" : ""}.
        </p>
      </Section>
    </div>
  );
}
