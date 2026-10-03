import { uid } from "../lib/factory";
import { useEditor } from "../store";
import type { El } from "../types";

let clipboard: El[] = [];
let styleClipboard: { type: El["type"]; style: Partial<El> } | null = null;

const STYLE_KEYS: Record<El["type"], (keyof El)[]> = {
  text: ["fontFamily", "fontSize", "fontWeight", "italic", "underline", "uppercase", "align", "color", "letterSpacing", "lineHeight", "effect", "effectColor", "effectSize"],
  shape: ["fill", "stroke", "strokeWidth", "radius"],
  image: ["brightness", "contrast", "saturation", "blur", "grayscale", "radius", "stroke", "strokeWidth", "mask"],
  video: ["brightness", "contrast", "saturation", "blur", "grayscale", "radius", "stroke", "strokeWidth", "mask"],
};
const COMMON_STYLE: (keyof El)[] = ["opacity", "shadow"];

/** Editing actions shared by keyboard shortcuts, the right-click menu and the panels. */
export function useActions() {
  const { doc, selected, selectedEls, setSelected, update, updateEls, notify, time } = useEditor();
  const ids = selected;

  const insert = (copies: El[], msg: string) => {
    update((d) => ({ ...d, elements: [...d.elements, ...copies] }));
    setSelected(copies.map((c) => c.id));
    notify(msg);
  };

  return {
    hasClipboard: () => clipboard.length > 0,
    hasStyle: () => !!styleClipboard,

    duplicate() {
      if (!selectedEls.length) return;
      insert(
        selectedEls.map((e) => ({ ...e, id: uid(), x: e.x + 24, y: e.y + 24 })),
        "Duplicated",
      );
    },
    remove() {
      if (!ids.length) return;
      update((d) => ({ ...d, elements: d.elements.filter((e) => !ids.includes(e.id)) }));
      setSelected([]);
      notify("Deleted — ⌘Z to undo");
    },
    copy() {
      if (!selectedEls.length) return;
      clipboard = selectedEls.map((e) => ({ ...e }));
      notify(`Copied ${clipboard.length} item${clipboard.length > 1 ? "s" : ""} — paste on any slide`);
    },
    paste() {
      if (!clipboard.length) return;
      const copies = clipboard.map((e) => ({ ...e, id: uid(), x: e.x + 24, y: e.y + 24 }));
      clipboard = copies;
      insert(copies, "Pasted");
    },
    copyStyle() {
      const el = selectedEls[0];
      if (!el) return;
      const style: Partial<El> = {};
      for (const k of [...STYLE_KEYS[el.type], ...COMMON_STYLE]) (style as Record<string, unknown>)[k] = el[k];
      styleClipboard = { type: el.type, style };
      notify("Style copied — select another item and choose Paste style (⌘⌥V)");
    },
    pasteStyle() {
      if (!styleClipboard || !ids.length) return;
      const src = styleClipboard;
      updateEls(ids, (e) => {
        const keys = e.type === src.type ? [...STYLE_KEYS[e.type], ...COMMON_STYLE] : COMMON_STYLE;
        // a shape's fill can colour text and vice versa
        const out: Partial<El> = {};
        for (const k of keys) if (k in src.style) (out as Record<string, unknown>)[k] = src.style[k];
        if (e.type === "text" && src.type === "shape" && src.style.fill) out.color = src.style.fill;
        if (e.type === "shape" && src.type === "text" && src.style.color) out.fill = src.style.color;
        return out;
      });
      notify("Style pasted");
    },
    order(where: "front" | "back") {
      update((d) => {
        const moving = d.elements.filter((e) => ids.includes(e.id));
        const rest = d.elements.filter((e) => !ids.includes(e.id));
        return { ...d, elements: where === "front" ? [...rest, ...moving] : [...moving, ...rest] };
      });
    },
    toggleLock() {
      const locked = selectedEls.every((e) => e.locked);
      updateEls(ids, { locked: !locked });
      notify(locked ? "Unlocked" : "Locked — it can't be moved by accident");
    },
    /** Cut a video clip in two at the playhead (reel editing). */
    splitClip() {
      const el = selectedEls[0];
      if (!el || el.type !== "video") return notify("Select a video clip to split it");
      const { start, end } = el.anim;
      if (time <= start + 0.1 || time >= end - 0.1) return notify("Move the red playhead onto the clip where you want to cut");
      const first: El = { ...el, anim: { ...el.anim, end: time, outType: "none" } };
      const second: El = {
        ...el,
        id: uid(),
        name: el.name.replace(/( \d+)?$/, "") + " 2",
        trimStart: (el.trimStart ?? 0) + (time - start),
        anim: { ...el.anim, start: time, inType: "none" },
      };
      update((d) => {
        const i = d.elements.findIndex((e) => e.id === el.id);
        const elements = [...d.elements];
        elements.splice(i, 1, first, second);
        return { ...d, elements };
      });
      setSelected([second.id]);
      notify(`Clip split at ${time.toFixed(1)}s — delete or move either part`);
    },
    canSplit: () => {
      const el = selectedEls[0];
      return !!el && el.type === "video" && time > el.anim.start + 0.1 && time < el.anim.end - 0.1;
    },
    selectAll() {
      setSelected(doc.elements.filter((x) => !x.hidden).map((x) => x.id));
    },
  };
}
