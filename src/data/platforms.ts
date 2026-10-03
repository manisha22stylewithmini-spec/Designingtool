import type { IconType } from "react-icons";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaSnapchat,
  FaThreads,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { FiEdit3 } from "react-icons/fi";

/** Parts of the frame covered by the app's own UI (fractions of frame size). */
export interface SafeZone {
  top: number;
  bottom: number;
  right?: number;
}

export interface Variant {
  id: string;
  name: string;
  w: number;
  h: number;
  /** Short explanation shown under the variant so people know when to use it. */
  use: string;
  video?: boolean;
  safe?: SafeZone;
}

export interface Platform {
  id: string;
  name: string;
  icon: IconType;
  color: string;
  variants: Variant[];
}

const STORY_SAFE: SafeZone = { top: 0.13, bottom: 0.2 };
const SHORT_SAFE: SafeZone = { top: 0.1, bottom: 0.22, right: 0.16 };

export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    icon: FaInstagram,
    color: "#E1306C",
    variants: [
      { id: "square", name: "Square Post", w: 1080, h: 1080, use: "Classic feed post" },
      { id: "portrait", name: "Portrait Post", w: 1080, h: 1350, use: "Takes the most feed space (4:5)" },
      { id: "landscape", name: "Landscape Post", w: 1080, h: 566, use: "Wide photo in the feed" },
      { id: "story", name: "Story", w: 1080, h: 1920, use: "Full-screen, disappears after 24h", video: true, safe: STORY_SAFE },
      { id: "reel", name: "Reel Cover", w: 1080, h: 1920, use: "Short vertical video", video: true, safe: SHORT_SAFE },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: FaFacebook,
    color: "#1877F2",
    variants: [
      { id: "post", name: "Feed Post", w: 1200, h: 630, use: "Link / image post" },
      { id: "square", name: "Square Post", w: 1080, h: 1080, use: "Works everywhere in the feed" },
      { id: "story", name: "Story", w: 1080, h: 1920, use: "Full-screen vertical", video: true, safe: STORY_SAFE },
      { id: "cover", name: "Page Cover", w: 820, h: 312, use: "Top banner of your page" },
      { id: "event", name: "Event Cover", w: 1920, h: 1005, use: "Header image for events" },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: FaXTwitter,
    color: "#111111",
    variants: [
      { id: "post", name: "Post Image", w: 1600, h: 900, use: "Image shown in the timeline (16:9)" },
      { id: "square", name: "Square Image", w: 1080, h: 1080, use: "Square post image" },
      { id: "header", name: "Header", w: 1500, h: 500, use: "Profile banner" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: FaLinkedin,
    color: "#0A66C2",
    variants: [
      { id: "post", name: "Feed Post", w: 1200, h: 627, use: "Landscape post / link image" },
      { id: "square", name: "Square Post", w: 1200, h: 1200, use: "Square feed post" },
      { id: "portrait", name: "Portrait Post", w: 1080, h: 1350, use: "Taller post, more visible" },
      { id: "banner", name: "Profile Banner", w: 1584, h: 396, use: "Background on your profile" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: FaYoutube,
    color: "#FF0000",
    variants: [
      { id: "thumb", name: "Thumbnail", w: 1280, h: 720, use: "The picture people click on" },
      { id: "shorts", name: "Shorts", w: 1080, h: 1920, use: "Vertical short video", video: true, safe: SHORT_SAFE },
      { id: "banner", name: "Channel Banner", w: 2560, h: 1440, use: "Channel art (keep text in centre)" },
      { id: "community", name: "Community Post", w: 1080, h: 1080, use: "Image for community tab" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: FaTiktok,
    color: "#000000",
    variants: [
      { id: "video", name: "Video", w: 1080, h: 1920, use: "Full-screen vertical video", video: true, safe: SHORT_SAFE },
      { id: "photo", name: "Photo Post", w: 1080, h: 1350, use: "Photo carousel slide" },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: FaPinterest,
    color: "#E60023",
    variants: [
      { id: "standard", name: "Standard Pin", w: 1000, h: 1500, use: "Recommended 2:3 pin" },
      { id: "square", name: "Square Pin", w: 1000, h: 1000, use: "Square pin" },
      { id: "long", name: "Long Pin", w: 1000, h: 2100, use: "Infographics & step-by-step" },
      { id: "idea", name: "Idea / Video Pin", w: 1080, h: 1920, use: "Vertical video pin", video: true },
    ],
  },
  {
    id: "snapchat",
    name: "Snapchat",
    icon: FaSnapchat,
    color: "#F7C600",
    variants: [{ id: "story", name: "Story / Snap", w: 1080, h: 1920, use: "Full-screen snap", video: true, safe: STORY_SAFE }],
  },
  {
    id: "threads",
    name: "Threads",
    icon: FaThreads,
    color: "#000000",
    variants: [
      { id: "portrait", name: "Portrait Post", w: 1080, h: 1350, use: "Image in a thread" },
      { id: "square", name: "Square Post", w: 1080, h: 1080, use: "Square image" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: FaWhatsapp,
    color: "#25D366",
    variants: [{ id: "status", name: "Status", w: 1080, h: 1920, use: "Status update", video: true, safe: STORY_SAFE }],
  },
  {
    id: "custom",
    name: "Custom",
    icon: FiEdit3,
    color: "#7C3AED",
    variants: [{ id: "custom", name: "Custom Size", w: 1080, h: 1080, use: "Type your own width & height" }],
  },
];

export function findPlatform(id: string): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export function findVariant(platformId: string, variantId: string): Variant | undefined {
  return findPlatform(platformId).variants.find((v) => v.id === variantId);
}

export function ratioLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h);
  const rw = w / g;
  const rh = h / g;
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  return (w / h).toFixed(2) + ":1";
}
