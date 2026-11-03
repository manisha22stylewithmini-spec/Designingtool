import { useRef, useState } from "react";
import { FiPlus, FiTrash2, FiUploadCloud, FiX } from "react-icons/fi";
import { ensureFont } from "../../data/fonts";
import { cn } from "../../lib/cn";
import { makeImage, makeText, uid } from "../../lib/factory";
import { fileToDataUrl } from "../../lib/images";
import { BRAND_COLORS, type Brand } from "../../lib/library";
import { useLibrary } from "../../libraryStore";
import { useEditor } from "../../store";
import { FontPicker } from "../FontPicker";

/** Brand assets: logos, colours and fonts — saved once, used in every creative of the brand. */
export function BrandKitEditor({ brand }: { brand: Brand }) {
  const { saveBrand } = useLibrary();
  const file = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState("#7c3aed");
  const [font, setFont] = useState("Poppins");
  const save = (patch: Partial<Brand>) => saveBrand({ ...brand, ...patch });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Name & card colour</h3>
        <div className="mt-2 flex items-center gap-2">
          <input value={brand.name} onChange={(e) => save({ name: e.target.value })} className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          {BRAND_COLORS.map((c) => (
            <button key={c} onClick={() => save({ color: c })} className={cn("h-7 w-7 rounded-full border-2", brand.color === c ? "border-zinc-900" : "border-white")} style={{ background: c }} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Logos & brand images</h3>
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const added = [];
            for (const f of Array.from(e.target.files ?? [])) {
              try {
                const { src } = await fileToDataUrl(f, 1200);
                added.push({ id: uid(), src, name: f.name.replace(/\.[^.]+$/, "") });
              } catch {
                /* skip */
              }
            }
            save({ logos: [...brand.logos, ...added] });
            e.target.value = "";
          }}
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {brand.logos.map((l) => (
            <div key={l.id} className="group relative flex aspect-square items-center justify-center rounded-xl border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-2">
              <img src={l.src} className="max-h-full max-w-full object-contain" title={l.name} />
              <button
                onClick={() => save({ logos: brand.logos.filter((x) => x.id !== l.id) })}
                className="absolute top-1 right-1 hidden rounded-md bg-white p-1 text-zinc-500 shadow group-hover:block hover:text-red-600"
                title="Remove"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
          <button onClick={() => file.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 text-xs font-medium text-violet-700 hover:bg-violet-50">
            <FiUploadCloud className="text-xl" />
            Upload
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400">PNG with a transparent background works best.</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Brand colours</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {brand.colors.map((c) => (
            <div key={c} className="group relative">
              <div className="h-11 w-11 rounded-xl border border-black/10" style={{ background: c }} title={c} />
              <button onClick={() => save({ colors: brand.colors.filter((x) => x !== c) })} className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-white p-0.5 text-zinc-500 shadow group-hover:block hover:text-red-600">
                <FiX />
              </button>
              <span className="mt-0.5 block text-center font-mono text-[9px] text-zinc-500 uppercase">{c}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 p-1.5">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer" />
            <button onClick={() => !brand.colors.includes(color) && save({ colors: [...brand.colors, color] })} className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white">
              <FiPlus /> Add
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Brand fonts</h3>
        <div className="mt-2 space-y-1.5">
          {brand.fonts.map((f, i) => (
            <div key={f} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
              <span className="text-lg" style={{ fontFamily: `"${f}"` }}>
                {f}
              </span>
              <span className="flex items-center gap-2 text-[10px] text-zinc-400">
                {i === 0 ? "Headings" : i === 1 ? "Body" : "Extra"}
                <button onClick={() => save({ fonts: brand.fonts.filter((x) => x !== f) })} className="rounded p-1 hover:bg-red-50 hover:text-red-600">
                  <FiTrash2 />
                </button>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FontPicker value={font} onChange={setFont} />
            </div>
            <button
              onClick={() => {
                if (brand.fonts.includes(font)) return;
                ensureFont(font);
                save({ fonts: [...brand.fonts, font] });
              }}
              className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white"
            >
              <FiPlus /> Add font
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">The first font is used for headings, the second for body text.</p>
        </div>
      </section>
    </div>
  );
}

export function BrandKitModal({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const { brands } = useLibrary();
  const brand = brands.find((b) => b.id === brandId);
  if (!brand) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-6 backdrop-blur-sm" onPointerDown={onClose}>
      <div className="thin-scroll max-h-full w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Brand kit · {brand.name}</h2>
            <p className="text-xs text-zinc-500">Saved automatically. Use these in any creative from the Brand tab in the editor.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <FiX />
          </button>
        </div>
        <BrandKitEditor brand={brand} />
      </div>
    </div>
  );
}

/** Editor side panel: drop the brand's logos, colours and fonts into the design. */
export function BrandPanel({ brandId, onEditKit }: { brandId?: string; onEditKit: () => void }) {
  const { brands } = useLibrary();
  const { doc, selectedEls, updateEls, update, setSelected, notify } = useEditor();
  const brand = brands.find((b) => b.id === brandId);
  if (!brand) return <p className="p-4 text-xs text-zinc-500">This creative isn't in a brand.</p>;
  const U = Math.min(doc.frame.w, doc.frame.h);

  const applyColor = (c: string) => {
    if (!selectedEls.length) {
      update((d) => ({ ...d, background: { kind: "solid", color: c } }));
      notify("Brand colour used as the background");
      return;
    }
    updateEls(
      selectedEls.map((e) => e.id),
      (e) => (e.type === "text" ? { color: c } : e.type === "path" ? (e.fill && e.fill !== "transparent" ? { fill: c } : { stroke: c }) : e.type === "shape" ? { fill: c } : { stroke: c, strokeWidth: e.strokeWidth || 8 }),
    );
  };

  const applyFont = (f: string, i: number) => {
    ensureFont(f);
    const texts = selectedEls.filter((e) => e.type === "text");
    if (texts.length) {
      updateEls(
        texts.map((e) => e.id),
        { fontFamily: f },
      );
      return;
    }
    const el = makeText(doc.frame, doc.duration, {
      text: i === 0 ? "Brand headline" : "Brand body text",
      fontFamily: f,
      fontSize: U * (i === 0 ? 0.09 : 0.04),
      fontWeight: i === 0 ? 700 : 400,
      color: brand.colors[0] ?? "#111111",
    });
    update((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelected([el.id]);
  };

  return (
    <div>
      <div className="px-4 pt-4 pb-1">
        <h2 className="text-sm font-semibold text-zinc-900">{brand.name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Your brand assets. Click to use them — colours and fonts apply to what you've selected.</p>
      </div>
      <div className="space-y-5 p-4">
        <section>
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Logos</p>
          {brand.logos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {brand.logos.map((l) => (
                <button
                  key={l.id}
                  title={`Add ${l.name}`}
                  onClick={() => {
                    const img = new Image();
                    img.onload = () => {
                      const el = { ...makeImage(doc.frame, doc.duration, l.src, img.naturalWidth, img.naturalHeight), name: l.name };
                      const s = (U * 0.25) / Math.max(el.w, el.h);
                      const sized = { ...el, w: el.w * s, h: el.h * s, x: doc.frame.w - el.w * s - U * 0.06, y: U * 0.06 };
                      update((d) => ({ ...d, elements: [...d.elements, sized] }));
                      setSelected([sized.id]);
                      notify("Logo added in the corner — drag it anywhere");
                    };
                    img.src = l.src;
                  }}
                  className="flex aspect-square items-center justify-center rounded-xl border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] p-2 hover:ring-2 hover:ring-violet-400"
                >
                  <img src={l.src} className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">No logos yet.</p>
          )}
        </section>
        <section>
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Colours</p>
          {brand.colors.length ? (
            <div className="flex flex-wrap gap-2">
              {brand.colors.map((c) => (
                <button key={c} onClick={() => applyColor(c)} className="h-10 w-10 rounded-xl border border-black/10 transition hover:scale-110" style={{ background: c }} title={`${c} — apply to selection (or background)`} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">No colours yet.</p>
          )}
        </section>
        <section>
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Fonts</p>
          {brand.fonts.length ? (
            <div className="space-y-1.5">
              {brand.fonts.map((f, i) => (
                <button key={f} onClick={() => applyFont(f, i)} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-left hover:border-violet-300">
                  <span className="text-lg" style={{ fontFamily: `"${f}"` }}>
                    {f}
                  </span>
                  <span className="text-[10px] text-zinc-400">{i === 0 ? "Heading" : i === 1 ? "Body" : ""}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">No fonts yet.</p>
          )}
        </section>
        <button onClick={onEditKit} className="w-full rounded-xl border border-zinc-200 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
          ✏️ Edit brand kit
        </button>
      </div>
    </div>
  );
}
