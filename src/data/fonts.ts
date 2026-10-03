export type FontCat = "Sans" | "Serif" | "Display" | "Script" | "Mono" | "Fun";

export interface FontDef {
  name: string;
  cat: FontCat;
  weights: number[];
}

const f = (name: string, cat: FontCat, weights: number[] = [400]): FontDef => ({ name, cat, weights });

export const FONT_LIBRARY: FontDef[] = [
  f("Inter", "Sans", [400, 500, 600, 700, 800, 900]),
  f("Poppins", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Montserrat", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Raleway", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("DM Sans", "Sans", [400, 500, 700]),
  f("Manrope", "Sans", [300, 400, 500, 600, 700, 800]),
  f("Outfit", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Plus Jakarta Sans", "Sans", [300, 400, 500, 600, 700, 800]),
  f("Work Sans", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Nunito", "Sans", [300, 400, 600, 700, 800, 900]),
  f("Rubik", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Sora", "Sans", [300, 400, 500, 600, 700, 800]),
  f("Urbanist", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Lexend", "Sans", [300, 400, 500, 600, 700, 800, 900]),
  f("Space Grotesk", "Sans", [300, 400, 500, 600, 700]),

  f("Playfair Display", "Serif", [400, 500, 600, 700, 800, 900]),
  f("Lora", "Serif", [400, 500, 600, 700]),
  f("Merriweather", "Serif", [300, 400, 700, 900]),
  f("DM Serif Display", "Serif"),
  f("Cormorant Garamond", "Serif", [300, 400, 500, 600, 700]),
  f("Libre Baskerville", "Serif", [400, 700]),
  f("Fraunces", "Serif", [300, 400, 500, 600, 700, 800, 900]),
  f("Roboto Slab", "Serif", [300, 400, 500, 600, 700, 800, 900]),
  f("Bodoni Moda", "Serif", [400, 500, 600, 700, 800, 900]),
  f("Abril Fatface", "Serif"),

  f("Bebas Neue", "Display"),
  f("Anton", "Display"),
  f("Oswald", "Display", [300, 400, 500, 600, 700]),
  f("Archivo Black", "Display"),
  f("Unbounded", "Display", [300, 400, 500, 600, 700, 800, 900]),
  f("Syne", "Display", [400, 500, 600, 700, 800]),
  f("Bricolage Grotesque", "Display", [300, 400, 500, 600, 700, 800]),
  f("Righteous", "Display"),
  f("Bungee", "Display"),
  f("Alfa Slab One", "Display"),
  f("Dela Gothic One", "Display"),
  f("Monoton", "Display"),

  f("Pacifico", "Script"),
  f("Lobster", "Script"),
  f("Dancing Script", "Script", [400, 500, 600, 700]),
  f("Caveat", "Script", [400, 500, 600, 700]),
  f("Permanent Marker", "Script"),
  f("Satisfy", "Script"),
  f("Great Vibes", "Script"),
  f("Sacramento", "Script"),
  f("Yellowtail", "Script"),
  f("Kalam", "Script", [300, 400, 700]),
  f("Shadows Into Light", "Script"),
  f("Amatic SC", "Script", [400, 700]),

  f("Space Mono", "Mono", [400, 700]),
  f("JetBrains Mono", "Mono", [300, 400, 500, 600, 700, 800]),
  f("IBM Plex Mono", "Mono", [300, 400, 500, 600, 700]),
  f("Courier Prime", "Mono", [400, 700]),

  f("Fredoka", "Fun", [300, 400, 500, 600, 700]),
  f("Baloo 2", "Fun", [400, 500, 600, 700, 800]),
  f("Chewy", "Fun"),
  f("Luckiest Guy", "Fun"),
  f("Bangers", "Fun"),
  f("Press Start 2P", "Fun"),
  f("Creepster", "Fun"),
];

export const FONT_CATS: FontCat[] = ["Sans", "Serif", "Display", "Script", "Mono", "Fun"];

export const fontDef = (name?: string) => FONT_LIBRARY.find((x) => x.name === name);

const loaded = new Map<string, Promise<void>>();

function addLink(href: string): Promise<void> {
  return new Promise((resolve) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = () => resolve();
    l.onerror = () => resolve();
    document.head.appendChild(l);
  });
}

/** Load a whole font family (all its weights) the first time it's used. */
export function ensureFont(name?: string): Promise<void> {
  if (!name) return Promise.resolve();
  const hit = loaded.get(name);
  if (hit) return hit;
  const def = fontDef(name);
  const fam = encodeURIComponent(name).replace(/%20/g, "+");
  const w = def && def.weights.length > 1 ? `:wght@${def.weights.join(";")}` : "";
  const p = addLink(`https://fonts.googleapis.com/css2?family=${fam}${w}&display=swap`).then(() =>
    Promise.all((def?.weights ?? [400]).map((wt) => document.fonts.load(`${wt} 20px "${name}"`).catch(() => undefined))).then(() => undefined),
  );
  loaded.set(name, p);
  return p;
}

const previewed = new Set<string>();
/** Regular weight only — enough to show the font in the picker list. */
export function previewFont(name: string) {
  if (previewed.has(name) || loaded.has(name)) return;
  previewed.add(name);
  const fam = encodeURIComponent(name).replace(/%20/g, "+");
  addLink(`https://fonts.googleapis.com/css2?family=${fam}&display=swap`);
}
