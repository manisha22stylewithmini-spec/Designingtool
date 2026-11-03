import type { IconType } from "react-icons";
import { FiCopy, FiFilm, FiImage } from "react-icons/fi";
import type { PostKind } from "../types";

export const POST_KINDS: { id: PostKind; label: string; icon: IconType; desc: string; exports: string }[] = [
  { id: "static", label: "Static", icon: FiImage, desc: "Still images — one or many separate designs", exports: "PNG / JPG" },
  { id: "carousel", label: "Carousel", icon: FiCopy, desc: "Connected slides people swipe through", exports: "ZIP of slides" },
  { id: "animated", label: "Video", icon: FiFilm, desc: "Reels, stories & animated posts — any size", exports: "MP4 video" },
];

/** Old designs may say "reel"; reels and animated posts are now the same "Video" type. */
export const normKind = (k: PostKind): PostKind => (k === "reel" ? "animated" : k);
export const kindLabel = (k: PostKind) => POST_KINDS.find((x) => x.id === normKind(k))!.label;

export const isMotion = (k: PostKind) => k === "animated" || k === "reel";

/** Popular video frames, offered when someone picks "Video". */
export const VIDEO_SIZES = [
  { id: "vertical", label: "Reel / Story", ratio: "9:16", w: 1080, h: 1920, use: "Instagram Reels, TikTok, Shorts, Stories" },
  { id: "portrait", label: "Portrait", ratio: "4:5", w: 1080, h: 1350, use: "Feed videos that fill the screen" },
  { id: "square", label: "Square", ratio: "1:1", w: 1080, h: 1080, use: "Feed posts everywhere" },
  { id: "landscape", label: "Landscape", ratio: "16:9", w: 1920, h: 1080, use: "YouTube, LinkedIn, X" },
];
