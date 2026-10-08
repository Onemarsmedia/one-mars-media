// Scene description shared by both renderers.
//
// The film is described ONCE in this After-Effects-shaped model (comps, layers, shape groups,
// keyframes). Two backends consume it:
//   - src/render/SceneRenderer.tsx  -> Remotion (MP4)
//   - ae/emit-jsx.ts                -> ExtendScript that rebuilds it as a native, editable AE project
// Keep this model to what AE can represent natively; that is what guarantees the two match.
//
// Conventions
//   - Time is in frames of the comp that owns the layer.
//   - Layers are listed bottom -> top (painter's order).
//   - Every layer's transform defaults to identity (anchor [0,0], position [0,0], scale 100, rotation 0),
//     so shape coordinates are comp coordinates unless a transform says otherwise.
//   - Colours are '#RRGGBB'. Opacity/scale/trim are percentages, rotation is degrees.

export type Vec2 = [number, number];
export type Color = string;

/** CSS-style cubic-bezier [x1, y1, x2, y2] in normalised segment space. */
export type Bezier = [number, number, number, number];
/** How the segment that STARTS at a key interpolates towards the next key. */
export type Ease = 'linear' | 'hold' | Bezier;

export interface Key<T> {
  t: number;
  v: T;
  /** Applies to the segment from this key to the next one. Defaults to 'linear'. */
  ease?: Ease;
}

export interface Animated<T> {
  keys: Key<T>[];
}

export type Prop<T> = T | Animated<T>;

export interface Transform {
  anchor?: Vec2; // static only: AE anchor is a spatial property, keep it unanimated
  position?: Prop<Vec2>; // emitted with separated dimensions in AE when animated
  scale?: Prop<Vec2>;
  rotation?: Prop<number>;
  opacity?: Prop<number>;
}

/** Shape-group transform inside a shape layer. Position/anchor stay static (spatial props). */
export interface GroupTransform {
  anchor?: Vec2;
  position?: Vec2;
  scale?: Prop<Vec2>;
  rotation?: Prop<number>;
  opacity?: Prop<number>;
}

export interface PathData {
  /** Vertices. */
  v: Vec2[];
  /** In-tangents, relative to each vertex (AE convention). Omitted = straight. */
  i?: Vec2[];
  /** Out-tangents, relative to each vertex. Omitted = straight. */
  o?: Vec2[];
  closed: boolean;
}

export type Geometry =
  | {type: 'rect'; size: Prop<Vec2>; center?: Vec2; roundness?: Prop<number>}
  | {type: 'ellipse'; size: Prop<Vec2>; center?: Vec2}
  | {type: 'path'; path: PathData};

export interface Fill {
  color: Prop<Color>; // colour keys must use 'hold' (eased colour keys are avoided on purpose)
  opacity?: Prop<number>;
}

export interface Stroke {
  color: Prop<Color>;
  width: Prop<number>;
  opacity?: Prop<number>;
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  /** Dash/gap lengths in px, e.g. [8, 6]. */
  dash?: number[];
}

/** Trim Paths, applied to the geometry of its own group. */
export interface Trim {
  start?: Prop<number>;
  end?: Prop<number>;
  offset?: Prop<number>;
}

export interface ShapeItem {
  name?: string;
  geo: Geometry | Geometry[];
  fill?: Fill;
  stroke?: Stroke;
  trim?: Trim;
  transform?: GroupTransform;
}

export type Effect =
  | {type: 'dropShadow'; color: Color; opacity: number; direction: number; distance: number; softness: number}
  | {type: 'blur'; amount: Prop<number>};

export interface FontRef {
  /** CSS family name used by the Remotion renderer. */
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
  /** PostScript name After Effects uses to pick the font. */
  postscript: string;
  /** Font file name inside public/fonts (also shipped with the AE package). */
  file: string;
}

interface LayerBase {
  name: string;
  /** First visible frame (inclusive). Default 0. */
  in?: number;
  /** Last visible frame (exclusive). Default = comp duration. */
  out?: number;
  /** Name of a null or other layer in the same comp. Parenting never inherits opacity (AE rule). */
  parent?: string;
  transform?: Transform;
  /** Use another layer of the same comp as an alpha matte. That layer should be `matteSource: true`. */
  matte?: {layer: string; type: 'alpha' | 'alphaInverted'};
  /** Hidden from the picture, only used as a track matte source. */
  matteSource?: boolean;
  effects?: Effect[];
  /** AE label colour index (1-16), purely organisational. */
  label?: number;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  items: ShapeItem[];
}

/** Text that is either fixed, typed on, or a counter. Each maps to a Slider + expression in AE. */
export type TextSource =
  | {kind: 'static'; text: string}
  | {kind: 'typeOn'; text: string; chars: Prop<number>}
  | {kind: 'counter'; value: Prop<number>; pad: number; prefix?: string; suffix?: string};

export interface TextLayer extends LayerBase {
  kind: 'text';
  source: TextSource;
  font: FontRef;
  size: number;
  color: Color;
  /** AE tracking units (1/1000 em). */
  tracking?: number;
  /** Line height in px for multi-line text ("\n" separates lines). */
  leading?: number;
  justify?: 'left' | 'center' | 'right';
}

export interface NullLayer extends LayerBase {
  kind: 'null';
}

export interface SolidLayer extends LayerBase {
  kind: 'solid';
  color: Color;
}

export interface PrecompLayer extends LayerBase {
  kind: 'precomp';
  comp: string;
  /** Comp-time frame at which the precomp's own frame 0 plays. Default 0. */
  startTime?: number;
}

export type Layer = ShapeLayer | TextLayer | NullLayer | SolidLayer | PrecompLayer;

export interface Marker {
  t: number;
  label: string;
  /** Duration in frames (optional). */
  duration?: number;
}

export interface Comp {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  bg?: Color;
  layers: Layer[];
  markers?: Marker[];
}

export interface AudioClip {
  name: string;
  /** File name inside public/audio (also shipped with the AE package). */
  file: string;
  /** Frame in the main comp where the clip starts. */
  start: number;
  /** Gain in dB applied in AE (the Remotion mix is rendered separately). */
  gainDb?: number;
}

export interface Scene {
  main: string;
  comps: Record<string, Comp>;
  fonts: FontRef[];
  audio?: AudioClip[];
}
