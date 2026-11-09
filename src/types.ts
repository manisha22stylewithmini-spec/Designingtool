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

export type ElType = "text" | "shape" | "image" | "video" | "path";

/**
 * One anchor of a vector path. Coordinates are normalised to the element box (0..1),
 * so resizing the element reshapes the path. Handles are offsets from the anchor.
 */
export interface PathNode {
  x: number;
  y: number;
  ix: number; // incoming handle
  iy: number;
  ox: number; // outgoing handle
  oy: number;
  kind: "corner" | "smooth";
}

/** Properties that can be keyframed on the timeline (After Effects style). */
export type KeyProp = "position" | "scale" | "rotation" | "opacity";
export type KeyEase = "linear" | "ease" | "easeIn" | "easeOut" | "hold";
export interface Keyframe {
  t: number; // seconds
  v: number[]; // position: [x, y]; scale: [%]; rotation: [deg]; opacity: [0..1]
  ease: KeyEase; // how it moves towards the next keyframe
}

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

export interface GradientStop {
  pos: number; // 0..1
  color: string;
}

/** A shape can be filled with a gradient instead of a flat colour. */
export interface Gradient {
  type: "linear" | "radial";
  angle: number; // degrees, CSS style (90 = left → right); linear only
  stops: GradientStop[];
}

export type PatternKind = "dots" | "stripes" | "lines" | "grid" | "checker" | "noise";

/** …or with a repeating pattern. */
export interface Pattern {
  kind: PatternKind;
  color: string;
  bg: string;
  size: number; // tile size in px
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

  // vector path (pen / pencil)
  nodes?: PathNode[];
  closed?: boolean;
  /** extra closed rings (holes / separate pieces) of a compound path made with Union, Subtract…; normalised to the box */
  subpaths?: PathNode[][];

  /** Keyframed properties — when a property has keyframes they decide its value over time. */
  keys?: Partial<Record<KeyProp, Keyframe[]>>;

  // shape
  shape?: ShapeKind;
  fill?: string;
  /** a shape can be filled with a picture, GIF or looping video instead of a colour */
  fillSrc?: string;
  fillKind?: "image" | "video";
  fillGradient?: Gradient;
  fillPattern?: Pattern;
  /** the border / stroke can be a gradient too */
  strokeGradient?: Gradient;
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
  pin?: number; // aspect ratio of the photo this layer is stuck to — it keeps its spot on the photo when the size changes
  cropX?: number; // 0..1 which part of the photo shows when it's cropped (0.5 = centre)
  cropY?: number;
  cropZoom?: number; // >= 1
  mask?: ShapeKind; // cut the photo into a shape
  maskNodes?: PathNode[]; // or a custom vector mask (pen / "Use as mask"), normalised to the box

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
  /** True once the user picks this page's background themselves (empty pages otherwise show white). */
  customBg?: boolean;
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
