export type Mode = "design" | "animate";

/** What the user is making — decides which tools the editor shows. */
export type PostKind = "static" | "carousel" | "animated" | "reel";

export type TextEffect = "none" | "lift" | "outline" | "hollow" | "neon" | "highlight" | "echo";

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "star"
  | "heart"
  | "diamond"
  | "hexagon"
  | "arrow"
  | "line"
  | "bubble";

export type ElType = "text" | "shape" | "image" | "video";

export type InAnim =
  | "none"
  | "fade"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "zoomIn"
  | "pop"
  | "spin"
  | "drop"
  | "wipe"
  | "typewriter";

export type OutAnim = "none" | "fade" | "slideUp" | "slideDown" | "zoomOut" | "spin";

export type LoopAnim = "none" | "pulse" | "float" | "wiggle" | "spin" | "blink";

export type Easing = "smooth" | "linear" | "bouncy" | "snappy";

export interface Anim {
  start: number; // seconds when the element appears
  end: number; // seconds when it disappears (>= start)
  inType: InAnim;
  inDur: number;
  outType: OutAnim;
  outDur: number;
  loop: LoopAnim;
  easing: Easing;
}

export interface Shadow {
  on: boolean;
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface El {
  id: string;
  type: ElType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  shadow: Shadow;
  anim: Anim;

  // shape
  shape?: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;

  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textCase?: "none" | "upper" | "lower" | "title";
  align?: "left" | "center" | "right";
  color?: string;
  letterSpacing?: number; // px
  lineHeight?: number; // multiplier
  effect?: TextEffect;
  effectColor?: string;
  effectSize?: number; // 0..100 intensity

  // image / video
  src?: string; // data URL, web URL, or "media:<id>" for files kept in IndexedDB
  flipX?: boolean;
  flipY?: boolean;
  brightness?: number; // %
  contrast?: number; // %
  saturation?: number; // %
  blur?: number; // px
  grayscale?: number; // %
  cropX?: number; // 0..1 which part of the photo shows when it's cropped (0.5 = centre)
  cropY?: number;
  cropZoom?: number; // >= 1
  mask?: ShapeKind; // cut the photo into a shape

  // video
  trimStart?: number; // seconds into the clip where playback starts
  videoDuration?: number; // natural length of the clip
  muted?: boolean;
  volume?: number; // 0..1
}

export type Background =
  | { kind: "none" } // transparent
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "image"; src: string; dim: number };

export interface Frame {
  platformId: string;
  variantId: string;
  w: number;
  h: number;
}

export interface Doc {
  frame: Frame;
  background: Background;
  elements: El[];
  duration: number; // seconds of the animation
  audio?: AudioTrack;
  context?: PageContext;
}

/** Background music / voice-over for a page. */
export interface AudioTrack {
  src: string; // "media:<id>"
  name: string;
  start: number; // where it begins on the timeline (s)
  trimStart: number; // where inside the file it begins (s)
  length: number; // natural length of the file (s)
  volume: number; // 0..1
  fadeIn: number; // s
  fadeOut: number; // s
}

/** One design (static) or slide (carousel). */
export interface Page {
  id: string;
  name?: string;
  /** Own size — static designs can each have a different size. Carousels share the project frame. */
  frame?: Frame;
  background: Background;
  elements: El[];
  duration: number;
  audio?: AudioTrack;
}

export interface RulerGuide {
  axis: "x" | "y";
  pos: number; // design pixels
}

export interface Project {
  frame: Frame;
  pages: Page[];
  kind?: PostKind;
  /** Carousel: stretch slide 1's background across all slides so they feel like one picture. */
  spanBackground?: boolean;
  guides?: RulerGuide[];
}

/** Rendering context for one page: what's around it on the board. */
export interface PageContext {
  /** Elements from the other carousel slides, already shifted into this slide's coordinates. */
  neighbours: El[];
  /** Background stretched over all slides: draw it at x = -offset with this width. */
  span?: { offset: number; width: number };
}
