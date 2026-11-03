import { useEffect, useMemo, useRef, useState } from "react";
import { ensureFont } from "../../data/fonts";
import { TEMPLATES } from "../../data/templates";
import { STATIC } from "../../lib/animation";
import { bgCss } from "../../lib/background";
import { uid } from "../../lib/factory";
import type { Frame, PostKind, Project } from "../../types";
import { ElementView } from "../ElementView";

/** Ready-made ideas shown on Home: a template + where it's meant to go. */
export interface Idea {
  id: string;
  title: string;
  blurb: string;
  badge: string;
  template: string;
  frame: Frame;
  kind: PostKind;
  slides?: number;
  accent: string;
}

export const IDEAS: Idea[] = [
  { id: "countdown", title: "Launch countdown", blurb: "Typewriter reveal that builds hype for a drop", badge: "🔥 Trending", template: "soon", frame: { platformId: "instagram", variantId: "reel", w: 1080, h: 1920 }, kind: "animated", accent: "from-zinc-900 to-zinc-700" },
  { id: "sale-carousel", title: "Flash-sale carousel", blurb: "Swipeable deal slides that stop the scroll", badge: "⚡ Popular", template: "sale", frame: { platformId: "instagram", variantId: "portrait", w: 1080, h: 1350 }, kind: "carousel", slides: 3, accent: "from-orange-500 to-pink-600" },
  { id: "quote", title: "Thought-leader quote", blurb: "Clean quote card that performs on LinkedIn", badge: "✨ New", template: "quote", frame: { platformId: "linkedin", variantId: "square", w: 1200, h: 1200 }, kind: "static", accent: "from-indigo-950 to-slate-800" },
  { id: "invite", title: "Event invite story", blurb: "Bold story with playful animated stars", badge: "💜 Loved", template: "event", frame: { platformId: "instagram", variantId: "story", w: 1080, h: 1920 }, kind: "animated", accent: "from-indigo-500 to-purple-600" },
  { id: "drop", title: "New drop teaser", blurb: "Soft card reveal for TikTok & Reels", badge: "📈 Rising", template: "newpost", frame: { platformId: "tiktok", variantId: "video", w: 1080, h: 1920 }, kind: "animated", accent: "from-pink-200 to-rose-300" },
  { id: "thumb", title: "Click-worthy thumbnail", blurb: "High-contrast YouTube thumbnail", badge: "▶ Creators", template: "sale", frame: { platformId: "youtube", variantId: "thumb", w: 1280, h: 720 }, kind: "static", accent: "from-red-500 to-orange-500" },
];

/** A whole project built from a template, ready to save as a creative. */
export function projectFromTemplate(templateId: string, frame: Frame, kind: PostKind, slides = 1): Project {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  const built = t.build(frame, 5);
  const page = { id: uid(), background: built.background, elements: built.elements, duration: 5 };
  const pages = [page];
  for (let i = 1; i < slides; i++) pages.push({ ...page, id: uid(), elements: built.elements.map((e) => ({ ...e, id: uid() })) });
  return { frame, kind, pages };
}

/** Live, scaled preview of a template at a given size. */
export function TemplatePreview({ templateId, frame, className, rounded = 14 }: { templateId: string; frame: Frame; className?: string; rounded?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const doc = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
    return t.build(frame, 5);
  }, [templateId, frame]);
  useEffect(() => {
    doc.elements.forEach((e) => e.fontFamily && ensureFont(e.fontFamily));
  }, [doc]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box.w ? Math.min(box.w / frame.w, box.h / frame.h) : 0;
  return (
    <div ref={ref} className={className}>
      {s > 0 && (
        <div className="relative mx-auto overflow-hidden shadow-xl" style={{ width: frame.w * s, height: frame.h * s, borderRadius: rounded, top: (box.h - frame.h * s) / 2 }}>
          <div className="pointer-events-none absolute top-0 left-0" style={{ width: frame.w, height: frame.h, transform: `scale(${s})`, transformOrigin: "0 0", ...bgCss(doc.background) }}>
            {doc.elements.map((el) => (
              <ElementView key={el.id} el={el} st={STATIC} editing={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
