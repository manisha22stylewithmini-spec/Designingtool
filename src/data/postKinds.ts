import type { IconType } from "react-icons";
import { FiCopy, FiFilm, FiImage } from "react-icons/fi";
import { MdOutlineAnimation } from "react-icons/md";
import type { PostKind } from "../types";

export const POST_KINDS: { id: PostKind; label: string; icon: IconType; desc: string; exports: string }[] = [
  { id: "static", label: "Static", icon: FiImage, desc: "One still image — a classic post", exports: "PNG / JPG" },
  { id: "carousel", label: "Carousel", icon: FiCopy, desc: "Several slides people swipe through", exports: "ZIP of slides" },
  { id: "animated", label: "Animated", icon: MdOutlineAnimation, desc: "A design with moving text & shapes", exports: "MP4 video" },
  { id: "reel", label: "Reel / Video", icon: FiFilm, desc: "Vertical video from your clips", exports: "MP4 video" },
];

export const isMotion = (k: PostKind) => k === "animated" || k === "reel";
