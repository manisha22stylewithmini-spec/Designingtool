import { useEffect, useRef } from "react";
import { decode, encode, IMAGE_URL, imageFromHtml, lastCopy, selectionPng } from "../lib/clipboard";
import { makeImage, makeText, makeVideo, uid } from "../lib/factory";
import { bounds } from "../lib/geometry";
import { fileToDataUrl, imageSize, videoInfo } from "../lib/images";
import { putMedia, resolveSrc } from "../lib/media";
import { useEditor } from "../store";
import type { El } from "../types";

/** Typing somewhere (text box, field) or selecting page text → leave copy/paste to the browser. */
function nativeTarget(): boolean {
  const a = document.activeElement;
  if (a instanceof HTMLElement && a.closest("input, textarea, select, [contenteditable=true]")) return true;
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
}

interface Incoming {
  html?: string;
  text?: string;
  files: File[];
}

/**
 * Real copy / cut / paste for the editor:
 * - copy writes the items (for pasting back in any design or tab), their text, and a PNG picture
 * - paste accepts copied items, images, videos, image links and plain text
 */
export function useClipboard() {
  const ed = useEditor();
  const edRef = useRef(ed);
  edRef.current = ed;

  useEffect(() => {
    const insert = (els: El[], msg: string) => {
      const { update, setSelected, notify } = edRef.current;
      update((d) => ({ ...d, elements: [...d.elements, ...els] }));
      setSelected(els.map((e) => e.id));
      notify(msg);
    };

    // ---------- copy ----------
    const copy = (e: ClipboardEvent | null, cut: boolean) => {
      const { selectedEls, doc } = edRef.current;
      if (!selectedEls.length) return false;
      const { html, text } = encode(selectedEls, doc.frame);
      if (e?.clipboardData) {
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
        e.clipboardData.setData("text/html", html);
      }
      // also put a picture on the clipboard where the browser allows it (pastes into Figma, Slack, WhatsApp…)
      const C = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (C && navigator.clipboard?.write) {
        const els = selectedEls;
        navigator.clipboard
          .write([
            new C({
              "text/plain": new Blob([text], { type: "text/plain" }),
              "text/html": new Blob([html], { type: "text/html" }),
              "image/png": selectionPng(els),
            }),
          ])
          .catch(() => undefined); // the text + HTML set above still work
      }
      if (cut) {
        const ids = selectedEls.map((x) => x.id);
        edRef.current.update((d) => ({ ...d, elements: d.elements.filter((x) => !ids.includes(x.id)) }));
        edRef.current.setSelected([]);
      }
      edRef.current.notify(`${cut ? "Cut" : "Copied"} ${selectedEls.length > 1 ? `${selectedEls.length} items` : "1 item"} — paste in any design (⌘V), or into other apps as a picture`);
      return true;
    };

    // ---------- paste ----------
    const pasteItems = (els: El[], fromFrame: { w: number; h: number }) => {
      const { doc } = edRef.current;
      const here = new Set(doc.elements.map((x) => x.id));
      // pasting where the originals still are → nudge so the copy is visible; elsewhere keep the exact spot
      const shift = els.some((x) => here.has(x.id)) ? 24 : 0;
      let out = els.map((x) => ({ ...x, id: uid(), x: x.x + shift, y: x.y + shift }));
      // copied from a different size → keep the same relative spot
      if (fromFrame.w !== doc.frame.w || fromFrame.h !== doc.frame.h) {
        const b = out.map(bounds);
        const cx = (Math.min(...b.map((q) => q.left)) + Math.max(...b.map((q) => q.right))) / 2;
        const cy = (Math.min(...b.map((q) => q.top)) + Math.max(...b.map((q) => q.bottom))) / 2;
        const dx = (cx / fromFrame.w) * doc.frame.w - cx;
        const dy = (cy / fromFrame.h) * doc.frame.h - cy;
        out = out.map((x) => ({ ...x, x: x.x + dx, y: x.y + dy }));
      }
      // nothing visible inside the frame → bring it to the middle
      const b = out.map(bounds);
      const L = Math.min(...b.map((q) => q.left)),
        R = Math.max(...b.map((q) => q.right)),
        T = Math.min(...b.map((q) => q.top)),
        B = Math.max(...b.map((q) => q.bottom));
      if (R < 0 || L > doc.frame.w || B < 0 || T > doc.frame.h) {
        const dx = doc.frame.w / 2 - (L + R) / 2;
        const dy = doc.frame.h / 2 - (T + B) / 2;
        out = out.map((x) => ({ ...x, x: x.x + dx, y: x.y + dy }));
      }
      insert(out, `Pasted ${out.length > 1 ? `${out.length} items` : "1 item"}`);
    };

    const pasteImage = async (src: string, i = 0) => {
      const { doc, notify } = edRef.current;
      try {
        const { w, h } = await imageSize(src);
        const el = makeImage(doc.frame, doc.duration, src, w, h);
        insert([{ ...el, x: el.x + i * 30, y: el.y + i * 30, name: "Pasted image" }], "Image pasted — use the right panel for filters, crop and masks");
      } catch {
        notify("Couldn't load that image. Try saving it and uploading it instead.");
      }
    };

    const pasteFiles = async (files: File[]) => {
      let i = 0;
      for (const f of files) {
        if (f.type.startsWith("image/")) {
          const { src } = await fileToDataUrl(f);
          await pasteImage(src, i++);
        } else if (f.type.startsWith("video/")) {
          const { doc, update, setSelected, notify } = edRef.current;
          const src = await putMedia(f);
          try {
            const info = await videoInfo(resolveSrc(src)!);
            const el = makeVideo(doc.frame, doc.duration, src, info.w, info.h, info.duration || 5);
            update((d) => ({ ...d, elements: [...d.elements, el] }));
            setSelected([el.id]);
            notify("Video pasted — play it in Animate / Timeline");
          } catch {
            notify("Couldn't read that video. Try an MP4 or MOV.");
          }
        }
      }
      return i > 0 || files.some((f) => f.type.startsWith("video/"));
    };

    const pasteText = (raw: string) => {
      const { doc, selectedEls } = edRef.current;
      const text = raw.replace(/\r\n/g, "\n").trim();
      if (!text) return;
      const U = Math.min(doc.frame.w, doc.frame.h);
      const long = text.length > 60;
      // pasting while a text is selected → use its look (font, colour, size)
      const like = selectedEls.find((x) => x.type === "text");
      const el = makeText(doc.frame, doc.duration, {
        text,
        name: text.split("\n")[0].slice(0, 24),
        fontSize: like?.fontSize ?? U * (long ? 0.035 : 0.07),
        fontFamily: like?.fontFamily ?? (long ? "Inter" : "Poppins"),
        fontWeight: like?.fontWeight ?? (long ? 400 : 700),
        color: like?.color ?? "#111111",
        align: like?.align ?? (long ? "left" : "center"),
        lineHeight: like?.lineHeight ?? (long ? 1.45 : 1.2),
        w: doc.frame.w * 0.8,
      });
      insert([el], "Text pasted — double-click it to edit");
    };

    const handle = async (d: Incoming) => {
      // 1) items copied in Delulu Craft (any design, any tab)
      const payload = decode(d.html);
      if (payload) return pasteItems(payload.els, payload.frame);
      const mem = lastCopy();
      if (mem && d.text !== undefined && d.text === mem.text && !d.files.length) return pasteItems(mem.payload.els, mem.payload.frame);
      // 2) images / videos (screenshots, files from Finder, "Copy image")
      if (d.files.length && (await pasteFiles(d.files))) return;
      // 3) an image on a web page, or an image link
      const img = imageFromHtml(d.html);
      if (img && /^(https?:|data:image)/.test(img)) return pasteImage(img);
      const t = d.text?.trim() ?? "";
      if (IMAGE_URL.test(t)) return pasteImage(t);
      // 4) words
      if (t) pasteText(d.text!);
    };

    // ---------- events ----------
    const onCopy = (e: ClipboardEvent) => {
      if (!nativeTarget()) copy(e, false);
    };
    const onCut = (e: ClipboardEvent) => {
      if (!nativeTarget()) copy(e, true);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (nativeTarget() || !e.clipboardData) return;
      e.preventDefault();
      const dt = e.clipboardData;
      const files = [...dt.files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      handle({ html: dt.getData("text/html"), text: dt.getData("text/plain"), files });
    };
    // "Paste" from the right-click menu: read the clipboard directly
    const onPasteRequest = async () => {
      try {
        const items = await navigator.clipboard.read();
        const d: Incoming = { files: [] };
        for (const it of items) {
          for (const type of it.types) {
            const blob = await it.getType(type);
            if (type === "text/html") d.html = await blob.text();
            else if (type === "text/plain") d.text = await blob.text();
            else if (type.startsWith("image/")) d.files.push(new File([blob], "pasted", { type }));
          }
        }
        // our own copies carry a PNG too — prefer the editable items over the picture
        if (decode(d.html)) d.files = [];
        await handle(d);
      } catch {
        const mem = lastCopy();
        if (mem) pasteItems(mem.payload.els, mem.payload.frame);
        else edRef.current.notify("Press ⌘V (Ctrl+V) to paste — the browser needs the keyboard shortcut for this.");
      }
    };
    const onCopyRequest = (e: Event) => {
      const cut = (e as CustomEvent<{ cut: boolean }>).detail?.cut ?? false;
      // run a real copy so the system clipboard gets it
      const ok = document.execCommand("copy");
      if (!ok) copy(null, cut);
      else if (cut) {
        const ids = edRef.current.selectedEls.map((x) => x.id);
        edRef.current.update((d) => ({ ...d, elements: d.elements.filter((x) => !ids.includes(x.id)) }));
        edRef.current.setSelected([]);
      }
    };

    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    window.addEventListener("delulu:paste", onPasteRequest);
    window.addEventListener("delulu:copy", onCopyRequest);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("delulu:paste", onPasteRequest);
      window.removeEventListener("delulu:copy", onCopyRequest);
    };
  }, []);
}
