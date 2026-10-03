import { memo, useEffect, useRef, type CSSProperties } from "react";
import { clipTime, type AnimState } from "../lib/animation";
import { filterCss } from "../lib/factory";
import { layoutText, shapePath } from "../lib/geometry";
import { resolveSrc } from "../lib/media";
import { textEffectCss, effectParams } from "../lib/textEffects";
import type { El } from "../types";

interface Props {
  el: El;
  st: AnimState;
  editing: boolean;
  onPointerDown?: (e: React.PointerEvent, el: El) => void;
  onDoubleClick?: (el: El) => void;
  onHover?: (id: string | null) => void;
  /** Timeline position for video clips (null = show the first frame, paused). */
  clock?: { t: number; playing: boolean } | null;
}

/** CSS that crops / zooms a photo or video inside its box (matches drawCover in render.ts). */
export function mediaCss(el: El): CSSProperties {
  const px = (el.cropX ?? 0.5) * 100;
  const py = (el.cropY ?? 0.5) * 100;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${px}% ${py}%`,
    transform: (el.cropZoom ?? 1) !== 1 ? `scale(${el.cropZoom})` : undefined,
    transformOrigin: `${px}% ${py}%`,
    filter: filterCss(el),
    display: "block",
  };
}

function VideoContent({ el, clock, visible }: { el: El; clock?: { t: number; playing: boolean } | null; visible: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const t = clock?.t ?? el.anim.start;
  const playing = !!clock?.playing && visible;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !!el.muted || !clock;
    v.volume = el.volume ?? 1;
    const target = clipTime(el, t);
    if (playing) {
      if (v.paused) {
        v.currentTime = target;
        v.play().catch(() => undefined);
      } else if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
    }
  });
  useEffect(() => () => ref.current?.pause(), []);
  return (
    <video
      ref={ref}
      src={resolveSrc(el.src)}
      playsInline
      preload="auto"
      muted
      style={mediaCss(el)}
    />
  );
}

function TextContent({ el, chars }: { el: El; chars: number }) {
  const lines = layoutText(el);
  const lh = (el.fontSize ?? 32) * (el.lineHeight ?? 1.2);
  let remaining = chars;
  const hl = effectParams(el);
  return (
    <div
      style={{
        fontFamily: `"${el.fontFamily}"`,
        fontSize: el.fontSize,
        fontWeight: el.fontWeight,
        fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none",
        color: el.color,
        letterSpacing: el.letterSpacing,
        lineHeight: `${lh}px`,
        textAlign: el.align,
        whiteSpace: "pre",
        ...textEffectCss(el),
      }}
    >
      {lines.map((line, i) => {
        let shown = line;
        if (remaining >= 0) {
          shown = line.slice(0, Math.max(0, remaining));
          remaining -= line.length + 1;
        }
        return (
          // trailing letter-spacing is trimmed in export; mirror that with a negative margin
          <div key={i} style={{ height: lh, marginRight: -(el.letterSpacing ?? 0) }}>
            {el.effect === "highlight" && shown ? (
              <span
                style={{
                  display: "inline-block",
                  height: lh,
                  padding: `0 ${hl.pad}px`,
                  margin: `0 -${hl.pad}px`,
                  borderRadius: hl.radius,
                  background: hl.color,
                }}
              >
                {shown}
              </span>
            ) : (
              shown || "​"
            )}
          </div>
        );
      })}
    </div>
  );
}

function ElementViewInner({ el, st, editing, onPointerDown, onDoubleClick, onHover, clock }: Props) {
  if (el.hidden) return null;
  // video clips stay mounted while off-screen so they don't reload
  if (!st.visible && el.type !== "video") return null;
  const style: CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    opacity: el.opacity * st.opacity,
    transform: `translate(${st.tx}px, ${st.ty}px) rotate(${el.rotation + st.rotate}deg) scale(${st.scale})`,
    clipPath: st.reveal < 1 ? `inset(-50% ${(1 - st.reveal) * 100}% -50% -50%)` : undefined,
    cursor: el.locked ? "default" : "move",
    visibility: editing || !st.visible ? "hidden" : undefined,
  };

  let content: React.ReactNode = null;
  if (el.type === "shape") {
    const sw = el.strokeWidth ?? 0;
    content = (
      <svg
        width={el.w}
        height={el.h}
        style={{
          overflow: "visible",
          display: "block",
          filter: el.shadow.on ? `drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur / 2}px ${el.shadow.color})` : undefined,
        }}
      >
        <path
          d={shapePath(el.shape!, el.w, el.h, el.radius, sw / 2)}
          fill={el.fill}
          stroke={sw > 0 ? el.stroke : "none"}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </svg>
    );
  } else if (el.type === "image" || el.type === "video") {
    const sw = el.strokeWidth ?? 0;
    const maskPath = el.mask ? shapePath(el.mask, el.w, el.h) : null;
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          // masks clip box-shadow, so use a drop-shadow filter on the wrapper instead
          filter: el.shadow.on && maskPath ? `drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur / 2}px ${el.shadow.color})` : undefined,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: maskPath ? undefined : el.radius,
            clipPath: maskPath ? `path("${maskPath}")` : undefined,
            boxShadow: el.shadow.on && !maskPath ? `${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${el.shadow.color}` : undefined,
          }}
        >
          <div style={{ width: "100%", height: "100%", transform: `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})` }}>
            {el.type === "video" ? (
              <VideoContent el={el} clock={clock} visible={st.visible} />
            ) : (
              <img src={el.src} draggable={false} crossOrigin={el.src?.startsWith("data:") ? undefined : "anonymous"} style={mediaCss(el)} />
            )}
          </div>
        </div>
        {sw > 0 &&
          (maskPath ? (
            <svg width={el.w} height={el.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <path d={shapePath(el.mask!, el.w, el.h, 0, sw / 2)} fill="none" stroke={el.stroke} strokeWidth={sw} strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ position: "absolute", inset: 0, border: `${sw}px solid ${el.stroke}`, borderRadius: el.radius }} />
          ))}
      </div>
    );
  } else {
    content = <TextContent el={el} chars={st.chars} />;
  }

  return (
    <div
      style={style}
      data-el={el.id}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, el) : undefined}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(el) : undefined}
      onPointerEnter={onHover ? () => onHover(el.id) : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
    >
      {content}
    </div>
  );
}

export const ElementView = memo(ElementViewInner);
