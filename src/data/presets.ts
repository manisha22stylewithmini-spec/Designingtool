import type { Easing, InAnim, LoopAnim, OutAnim, ShapeKind } from "../types";

export const FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Bebas Neue",
  "Anton",
  "Oswald",
  "Raleway",
  "Space Grotesk",
  "Roboto Slab",
  "Pacifico",
  "Lobster",
  "Dancing Script",
  "Caveat",
  "Permanent Marker",
];

export const SWATCHES = [
  "#000000",
  "#ffffff",
  "#545454",
  "#a6a6a6",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#007aff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#ffd6e0",
  "#fff4c2",
  "#d4f5e4",
  "#d6ecff",
  "#1b1f3b",
  "#0f3d2e",
  "#7a2e0e",
];

export const GRADIENTS: { from: string; to: string; angle: number }[] = [
  { from: "#ff9a9e", to: "#fecfef", angle: 135 },
  { from: "#a18cd1", to: "#fbc2eb", angle: 135 },
  { from: "#f6d365", to: "#fda085", angle: 135 },
  { from: "#84fab0", to: "#8fd3f4", angle: 135 },
  { from: "#4facfe", to: "#00f2fe", angle: 135 },
  { from: "#43e97b", to: "#38f9d7", angle: 135 },
  { from: "#fa709a", to: "#fee140", angle: 135 },
  { from: "#30cfd0", to: "#330867", angle: 135 },
  { from: "#667eea", to: "#764ba2", angle: 135 },
  { from: "#ff512f", to: "#dd2476", angle: 135 },
  { from: "#0f2027", to: "#2c5364", angle: 160 },
  { from: "#141e30", to: "#243b55", angle: 180 },
];

export const TEXT_PRESETS = [
  { label: "Add a heading", size: 0.09, weight: 800, font: "Poppins", text: "Add a heading" },
  { label: "Add a subheading", size: 0.055, weight: 600, font: "Poppins", text: "Add a subheading" },
  { label: "Add body text", size: 0.035, weight: 400, font: "Inter", text: "Add a little bit of body text" },
];

export const FONT_COMBOS = [
  { title: "BIG SALE", sub: "Up to 50% off everything", font: "Bebas Neue", subFont: "Inter", weight: 400, color: "#111111" },
  { title: "Hello Summer", sub: "make memories", font: "Pacifico", subFont: "Raleway", weight: 400, color: "#ff2d55" },
  { title: "The Journal", sub: "ISSUE NO. 12", font: "Playfair Display", subFont: "Montserrat", weight: 700, color: "#1b1f3b" },
  { title: "Game Night", sub: "Friday · 8 PM", font: "Anton", subFont: "Space Grotesk", weight: 400, color: "#5856d6" },
];

export const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "Square" },
  { kind: "ellipse", label: "Circle" },
  { kind: "triangle", label: "Triangle" },
  { kind: "star", label: "Star" },
  { kind: "heart", label: "Heart" },
  { kind: "diamond", label: "Diamond" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "arrow", label: "Arrow" },
  { kind: "bubble", label: "Speech" },
  { kind: "line", label: "Line" },
];

export const IN_ANIMS: { id: InAnim; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "Just appears" },
  { id: "fade", label: "Fade", hint: "Softly fades in" },
  { id: "slideUp", label: "Rise", hint: "Slides up into place" },
  { id: "slideDown", label: "Drop in", hint: "Slides down into place" },
  { id: "slideLeft", label: "From right", hint: "Slides in from the right" },
  { id: "slideRight", label: "From left", hint: "Slides in from the left" },
  { id: "zoomIn", label: "Zoom", hint: "Grows from small" },
  { id: "pop", label: "Pop", hint: "Bounces in with overshoot" },
  { id: "spin", label: "Spin", hint: "Rotates in" },
  { id: "drop", label: "Bounce", hint: "Falls and bounces" },
  { id: "wipe", label: "Wipe", hint: "Revealed left → right" },
  { id: "typewriter", label: "Typewriter", hint: "Letters type out (text only)" },
];

export const OUT_ANIMS: { id: OutAnim; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade out" },
  { id: "slideUp", label: "Fly up" },
  { id: "slideDown", label: "Sink down" },
  { id: "zoomOut", label: "Shrink" },
  { id: "spin", label: "Spin out" },
];

export const LOOP_ANIMS: { id: LoopAnim; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "Stays still" },
  { id: "pulse", label: "Pulse", hint: "Gently grows & shrinks" },
  { id: "float", label: "Float", hint: "Bobs up and down" },
  { id: "wiggle", label: "Wiggle", hint: "Tilts side to side" },
  { id: "spin", label: "Rotate", hint: "Keeps turning" },
  { id: "blink", label: "Blink", hint: "Flashes on and off" },
];

export const EASINGS: { id: Easing; label: string }[] = [
  { id: "smooth", label: "Smooth" },
  { id: "snappy", label: "Snappy" },
  { id: "bouncy", label: "Bouncy" },
  { id: "linear", label: "Linear" },
];

export const SAMPLE_PHOTOS = [
  "https://picsum.photos/id/1015/900/700",
  "https://picsum.photos/id/1025/700/900",
  "https://picsum.photos/id/1043/900/700",
  "https://picsum.photos/id/1062/700/900",
  "https://picsum.photos/id/1069/900/700",
  "https://picsum.photos/id/1080/700/900",
  "https://picsum.photos/id/164/900/700",
  "https://picsum.photos/id/225/700/900",
  "https://picsum.photos/id/292/900/700",
  "https://picsum.photos/id/326/700/900",
];
