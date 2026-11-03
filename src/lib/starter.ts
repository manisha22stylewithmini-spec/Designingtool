import { makeText } from "./factory";
import type { Doc, Frame, PostKind, Project } from "../types";
import { uid } from "./factory";

/** A friendly first design: a headline and a hint, ready to edit. */
export function starterDoc(frame: Frame): Doc {
  const v = frame;
  const U = Math.min(v.w, v.h);
  const duration = 5;
  const title = makeText(frame, duration, {
    text: "Your big idea",
    fontSize: U * 0.11,
    fontWeight: 800,
    fontFamily: "Poppins",
    color: "#1b1f3b",
    y: v.h * 0.4,
    name: "Headline",
  });
  title.anim = { ...title.anim, inType: "slideUp" };
  const sub = makeText(frame, duration, {
    text: "Double-click any text to change it",
    fontSize: U * 0.045,
    fontWeight: 500,
    fontFamily: "Inter",
    color: "#3f3f46",
    y: v.h * 0.4 + U * 0.16,
    name: "Subtitle",
  });
  sub.anim = { ...sub.anim, inType: "fade", start: 0.5 };
  return {
    frame,
    background: { kind: "gradient", from: "#a18cd1", to: "#fbc2eb", angle: 135 },
    elements: [title, sub],
    duration,
  };
}

export function starterProject(frame: Frame, kind: PostKind): Project {
  const d = starterDoc(frame);
  return { frame, kind, pages: [{ id: uid(), background: d.background, elements: d.elements, duration: d.duration }] };
}
