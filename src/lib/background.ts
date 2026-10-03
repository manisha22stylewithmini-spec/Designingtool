import type { Background } from "../types";

const CHECKER =
  "repeating-conic-gradient(#e4e4e7 0% 25%, #ffffff 0% 50%) 0 0 / 24px 24px";

export function bgCss(bg: Background): React.CSSProperties {
  if (bg.kind === "none") return { background: CHECKER };
  if (bg.kind === "solid") return { background: bg.color };
  if (bg.kind === "gradient") return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
  return {
    backgroundColor: "#fff",
    backgroundImage: `linear-gradient(rgba(0,0,0,${bg.dim / 100}), rgba(0,0,0,${bg.dim / 100})), url("${bg.src}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

// ---------- generated backgrounds (SVG, so they're crisp, offline and export cleanly) ----------

const svg = (body: string, w = 1200, h = 1200) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function patternBg(kind: string, a: string, b: string): string {
  const R = rand(kind.length * 7919 + a.charCodeAt(1) * 31);
  switch (kind) {
    case "dots":
      return svg(
        `<rect width="1200" height="1200" fill="${a}"/><defs><pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="7" fill="${b}"/></pattern></defs><rect width="1200" height="1200" fill="url(#p)"/>`,
      );
    case "grid":
      return svg(
        `<rect width="1200" height="1200" fill="${a}"/><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="${b}" stroke-width="2"/></pattern></defs><rect width="1200" height="1200" fill="url(#p)"/>`,
      );
    case "stripes":
      return svg(
        `<rect width="1200" height="1200" fill="${a}"/><defs><pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="30" height="60" fill="${b}"/></pattern></defs><rect width="1200" height="1200" fill="url(#p)"/>`,
      );
    case "checks":
      return svg(
        `<rect width="1200" height="1200" fill="${a}"/><defs><pattern id="p" width="150" height="150" patternUnits="userSpaceOnUse"><rect width="75" height="75" fill="${b}"/><rect x="75" y="75" width="75" height="75" fill="${b}"/></pattern></defs><rect width="1200" height="1200" fill="url(#p)"/>`,
      );
    case "waves": {
      let paths = "";
      for (let y = -60; y < 1300; y += 70)
        paths += `<path d="M0 ${y} Q150 ${y - 40} 300 ${y} T600 ${y} T900 ${y} T1200 ${y}" fill="none" stroke="${b}" stroke-width="10" stroke-linecap="round"/>`;
      return svg(`<rect width="1200" height="1200" fill="${a}"/>${paths}`);
    }
    case "confetti": {
      let bits = "";
      const cols = [b, "#ffcc00", "#ff2d55", "#34c759", "#007aff"];
      for (let i = 0; i < 140; i++) {
        const x = R() * 1200,
          y = R() * 1200,
          r = R() * 360,
          c = cols[i % cols.length];
        bits += i % 3 ? `<rect x="${x}" y="${y}" width="22" height="9" rx="4" fill="${c}" transform="rotate(${r} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;
      }
      return svg(`<rect width="1200" height="1200" fill="${a}"/>${bits}`);
    }
    case "memphis": {
      let bits = "";
      for (let i = 0; i < 40; i++) {
        const x = R() * 1200,
          y = R() * 1200,
          r = R() * 360;
        const t = i % 4;
        bits +=
          t === 0
            ? `<circle cx="${x}" cy="${y}" r="26" fill="none" stroke="${b}" stroke-width="8"/>`
            : t === 1
              ? `<path d="M${x} ${y}l30 50h-60z" fill="${b}" transform="rotate(${r} ${x} ${y})"/>`
              : t === 2
                ? `<path d="M${x - 40} ${y} q20 -25 40 0 t40 0" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round" transform="rotate(${r} ${x} ${y})"/>`
                : `<rect x="${x}" y="${y}" width="16" height="16" fill="${b}" transform="rotate(${r} ${x} ${y})"/>`;
      }
      return svg(`<rect width="1200" height="1200" fill="${a}"/>${bits}`);
    }
    case "blobs":
    case "mesh": {
      const cols = kind === "mesh" ? [b, "#ff9a9e", "#a18cd1", "#84fab0", "#fda085"] : [b];
      let blobs = "";
      for (let i = 0; i < (kind === "mesh" ? 6 : 4); i++)
        blobs += `<circle cx="${R() * 1200}" cy="${R() * 1200}" r="${250 + R() * 250}" fill="${cols[i % cols.length]}" opacity="${kind === "mesh" ? 0.85 : 0.55}"/>`;
      return svg(`<defs><filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${kind === "mesh" ? 140 : 90}"/></filter></defs><rect width="1200" height="1200" fill="${a}"/><g filter="url(#f)">${blobs}</g>`);
    }
    case "grain":
      return svg(
        `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"/></filter><rect width="1200" height="1200" fill="${a}"/><rect width="1200" height="1200" filter="url(#n)"/>`,
      );
    case "paper":
      return svg(
        `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5"/><feDiffuseLighting lighting-color="${a}" surfaceScale="1.6"><feDistantLight azimuth="45" elevation="60"/></feDiffuseLighting></filter><rect width="1200" height="1200" filter="url(#n)"/>`,
      );
    case "sunburst": {
      let rays = "";
      for (let i = 0; i < 24; i++) {
        const a1 = (i / 24) * Math.PI * 2,
          a2 = ((i + 0.5) / 24) * Math.PI * 2;
        rays += `<path d="M600 600 L${600 + Math.cos(a1) * 1200} ${600 + Math.sin(a1) * 1200} L${600 + Math.cos(a2) * 1200} ${600 + Math.sin(a2) * 1200}Z" fill="${b}"/>`;
      }
      return svg(`<rect width="1200" height="1200" fill="${a}"/>${rays}`);
    }
    default:
      return svg(`<rect width="1200" height="1200" fill="${a}"/>`);
  }
}

export const PATTERN_PRESETS: { group: string; items: { kind: string; a: string; b: string; name: string }[] }[] = [
  {
    group: "Patterns",
    items: [
      { kind: "dots", a: "#fff4c2", b: "#ff9500", name: "Polka" },
      { kind: "dots", a: "#1b1f3b", b: "#5856d6", name: "Night dots" },
      { kind: "grid", a: "#ffffff", b: "#e4e4e7", name: "Graph paper" },
      { kind: "grid", a: "#0f172a", b: "#1e293b", name: "Blueprint" },
      { kind: "stripes", a: "#ffd6e0", b: "#ffc2d1", name: "Candy" },
      { kind: "stripes", a: "#111111", b: "#ffcc00", name: "Caution" },
      { kind: "checks", a: "#ffffff", b: "#111111", name: "Checker" },
      { kind: "checks", a: "#d4f5e4", b: "#a7f3d0", name: "Gingham" },
      { kind: "waves", a: "#d6ecff", b: "#93c5fd", name: "Waves" },
      { kind: "sunburst", a: "#ffcc00", b: "#ffd84d", name: "Sunburst" },
    ],
  },
  {
    group: "Fun",
    items: [
      { kind: "confetti", a: "#ffffff", b: "#af52de", name: "Confetti" },
      { kind: "confetti", a: "#1b1f3b", b: "#ffffff", name: "Party" },
      { kind: "memphis", a: "#fff4c2", b: "#ff2d55", name: "Memphis" },
      { kind: "memphis", a: "#d6ecff", b: "#5856d6", name: "Retro" },
    ],
  },
  {
    group: "Soft blur",
    items: [
      { kind: "mesh", a: "#fdf2f8", b: "#f472b6", name: "Blush" },
      { kind: "mesh", a: "#eef2ff", b: "#818cf8", name: "Lavender" },
      { kind: "blobs", a: "#0f172a", b: "#7c3aed", name: "Aurora" },
      { kind: "blobs", a: "#ecfeff", b: "#22d3ee", name: "Lagoon" },
      { kind: "blobs", a: "#fff7ed", b: "#fb923c", name: "Sunset" },
      { kind: "mesh", a: "#111111", b: "#f43f5e", name: "Neon mesh" },
    ],
  },
  {
    group: "Textures",
    items: [
      { kind: "grain", a: "#f5f0e6", b: "", name: "Film grain" },
      { kind: "grain", a: "#1f2937", b: "", name: "Dark grain" },
      { kind: "paper", a: "#fbf7ef", b: "", name: "Paper" },
      { kind: "paper", a: "#e7e5e4", b: "", name: "Concrete" },
    ],
  },
];
