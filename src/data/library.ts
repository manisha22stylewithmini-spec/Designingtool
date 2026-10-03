/** Content libraries: stickers, background photos, typography styles and font pairings. */

export const STICKER_GROUPS: { name: string; items: string[] }[] = [
  { name: "Popular", items: ["🔥", "✨", "❤️", "⭐", "🎉", "💯", "😍", "🚀", "👀", "🙌", "💥", "🌈"] },
  { name: "Love", items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💘", "💌", "😘", "🥰", "💋", "🌹", "💐"] },
  { name: "Party", items: ["🎉", "🎊", "🥳", "🎈", "🎂", "🍾", "🥂", "🎁", "🪩", "🎆", "🎇", "🎤", "🎶", "🕺", "💃", "👑"] },
  { name: "Marketing", items: ["📣", "📢", "🛍️", "🛒", "💰", "💸", "🏷️", "📦", "📈", "💳", "🆕", "🆓", "🔖", "📌", "📍", "⏰"] },
  { name: "Arrows", items: ["👉", "👈", "👆", "👇", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "🔁", "🔄", "↪️", "⤴️", "⤵️", "🔜"] },
  { name: "Badges", items: ["✅", "☑️", "✔️", "❌", "⚠️", "🚫", "❗", "❓", "💡", "🔔", "🏆", "🥇", "🎖️", "🔝", "🆒", "🆙"] },
  { name: "Faces", items: ["😀", "😂", "🤣", "😊", "😎", "🤩", "😇", "🤔", "😴", "🤯", "😱", "🥺", "😤", "🤫", "🫶", "😜"] },
  { name: "Hands", items: ["👍", "👎", "👏", "🙏", "🤝", "✌️", "🤞", "👌", "🤙", "💪", "🫰", "🖐️", "✍️", "👋", "🤘", "☝️"] },
  { name: "Nature", items: ["🌸", "🌺", "🌻", "🌷", "🌿", "🍀", "🌴", "🌵", "🍁", "🍂", "🌊", "⛰️", "🌙", "☀️", "⚡", "❄️"] },
  { name: "Food", items: ["☕", "🍕", "🍔", "🍟", "🌮", "🍣", "🍩", "🍪", "🍰", "🧁", "🍓", "🍉", "🥑", "🍋", "🍹", "🧋"] },
  { name: "Travel", items: ["✈️", "🌍", "🗺️", "🧳", "🏖️", "🏝️", "🏔️", "🗼", "🗽", "🚗", "🚲", "⛵", "📸", "🎒", "🏕️", "🌅"] },
  { name: "Objects", items: ["📱", "💻", "🎧", "📷", "🎮", "📚", "✏️", "📝", "🗓️", "💼", "🔑", "🕶️", "👟", "👗", "💄", "💎"] },
];

const ph = (id: number) => `https://picsum.photos/id/${id}/1600/1600`;
export const PHOTO_GROUPS: { name: string; ids: number[] }[] = [
  { name: "Nature", ids: [10, 15, 17, 28, 29, 62, 70, 83, 95, 82, 19, 89] },
  { name: "Ocean & beach", ids: [12, 13, 16, 47, 74, 77, 92, 52] },
  { name: "City", ids: [43, 49, 57, 84, 88, 22, 78, 61] },
  { name: "Sky & minimal", ids: [53, 54, 38, 51, 87, 32, 44, 68] },
  { name: "Textures & abstract", ids: [56, 41, 72, 80, 24, 39, 35, 26] },
  { name: "Workspace & lifestyle", ids: [0, 2, 20, 36, 30, 63, 42, 7] },
];
export const photoUrl = ph;
export const photoThumb = (id: number) => `https://picsum.photos/id/${id}/240/240`;

/** A consistent type scale — click to add, or to restyle the selected text. */
export interface TypeStyle {
  id: string;
  label: string;
  sample: string;
  font: string;
  weight: number;
  size: number; // fraction of min(frame w, h)
  lineHeight?: number;
  spacing?: number; // fraction of font size
  textCase?: "none" | "upper" | "lower" | "title";
  italic?: boolean;
}

export const TYPE_STYLES: TypeStyle[] = [
  { id: "display", label: "Display", sample: "BIG IDEA", font: "Bebas Neue", weight: 400, size: 0.2, lineHeight: 0.95, textCase: "upper" },
  { id: "title", label: "Title", sample: "Your title here", font: "Poppins", weight: 800, size: 0.1, lineHeight: 1.05, spacing: -0.02 },
  { id: "heading", label: "Heading", sample: "Section heading", font: "Montserrat", weight: 700, size: 0.07, lineHeight: 1.15 },
  { id: "subheading", label: "Subheading", sample: "A short supporting line", font: "Inter", weight: 600, size: 0.05, lineHeight: 1.25 },
  { id: "body", label: "Body", sample: "Comfortable text for a few sentences that people will actually read.", font: "Inter", weight: 400, size: 0.034, lineHeight: 1.5 },
  { id: "caption", label: "Caption", sample: "Photo credit · small print", font: "Inter", weight: 500, size: 0.024, lineHeight: 1.4, spacing: 0.02 },
  { id: "kicker", label: "Label / kicker", sample: "New collection", font: "Space Grotesk", weight: 600, size: 0.03, spacing: 0.25, textCase: "upper" },
  { id: "quote", label: "Quote", sample: "“Make it simple, but significant.”", font: "Playfair Display", weight: 500, size: 0.06, lineHeight: 1.3, italic: true },
  { id: "hand", label: "Handwritten", sample: "with love, Sam", font: "Caveat", weight: 700, size: 0.07 },
  { id: "button", label: "Button", sample: "Shop now", font: "Poppins", weight: 700, size: 0.038, spacing: 0.08, textCase: "upper" },
  { id: "number", label: "Big number", sample: "50%", font: "Unbounded", weight: 800, size: 0.18, lineHeight: 1 },
  { id: "mono", label: "Code / tech", sample: "v2.0 is live", font: "JetBrains Mono", weight: 500, size: 0.04 },
];

export const FONT_PAIRS: { title: string; sub: string; font: string; subFont: string; weight: number; color: string; bg: string }[] = [
  { title: "BIG SALE", sub: "Up to 50% off everything", font: "Bebas Neue", subFont: "Inter", weight: 400, color: "#111111", bg: "#fafafa" },
  { title: "Hello Summer", sub: "make memories", font: "Pacifico", subFont: "Raleway", weight: 400, color: "#ff2d55", bg: "#fff4f6" },
  { title: "The Journal", sub: "ISSUE NO. 12", font: "Playfair Display", subFont: "Montserrat", weight: 700, color: "#1b1f3b", bg: "#f8f6f1" },
  { title: "Game Night", sub: "Friday · 8 PM", font: "Anton", subFont: "Space Grotesk", weight: 400, color: "#5856d6", bg: "#f2f2ff" },
  { title: "Slow Mornings", sub: "a coffee & book club", font: "Fraunces", subFont: "DM Sans", weight: 600, color: "#7a2e0e", bg: "#fbf3ea" },
  { title: "LAUNCH DAY", sub: "Something new is here", font: "Unbounded", subFont: "Manrope", weight: 800, color: "#0f172a", bg: "#eef2ff" },
  { title: "Wild & Free", sub: "Adventure starts now", font: "Permanent Marker", subFont: "Outfit", weight: 400, color: "#0f3d2e", bg: "#eefaf3" },
  { title: "Studio Notes", sub: "design · code · coffee", font: "Syne", subFont: "JetBrains Mono", weight: 800, color: "#111111", bg: "#f4f4f5" },
  { title: "Bloom", sub: "Spring collection 2026", font: "Cormorant Garamond", subFont: "Lexend", weight: 600, color: "#9d174d", bg: "#fdf2f8" },
  { title: "POWER UP", sub: "Level 99 unlocked", font: "Bungee", subFont: "Rubik", weight: 400, color: "#ea580c", bg: "#fff7ed" },
  { title: "Fresh Bakes", sub: "baked daily since 1998", font: "Lobster", subFont: "Nunito", weight: 400, color: "#b45309", bg: "#fffbeb" },
  { title: "Minimal.", sub: "less but better", font: "DM Serif Display", subFont: "Work Sans", weight: 400, color: "#18181b", bg: "#ffffff" },
];
