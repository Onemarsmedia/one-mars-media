import type {Vec2} from '../../scene/types';

// Inner animation of the 12 tiles: what moves in each illustration once the tile has landed.
// Indices point into the tile's drawing (art.json, painter's order; print a table with
// `npx tsx tools/art-table.ts <tile>`); the live and active looks share them. Times in seconds from the
// moment the tile lands (its panel wipes on over 0.4 s); every loop runs until the tiles leave the page.
// `delay` (s after landing) holds a loop at rest before it starts.
export type TileAnim =
  /** on/off, stepped */
  | {kind: 'blink'; items: number[]; period: number; delay?: number}
  /** slow linear glide of dx/dy px over the remaining time */
  | {kind: 'drift'; items: number[]; dx: number; dy?: number}
  /** soft swell to `scale` % and back, once per period */
  | {kind: 'pulse'; items: number[]; scale: number; period: number; delay?: number; pivot?: Vec2}
  /** stroke-only items reveal along their path once (Trim Paths) */
  | {kind: 'draw'; items: number[]; delay: number; dur: number; stagger?: number}
  /** items rise dy px and fade in once, one after another */
  | {kind: 'pop'; items: number[]; delay: number; stagger: number; dy?: number}
  /** smooth vertical float of amp px */
  | {kind: 'bob'; items: number[]; amp: number; period: number; phase?: number; delay?: number}
  /** smooth rotation swing of +/- deg */
  | {kind: 'tilt'; items: number[]; deg: number; period: number; pivot?: Vec2; delay?: number}
  /** each item scales vertically between min % and 100 %, phase-shifted by `spread` (0-1 of a period) */
  | {kind: 'pump'; items: number[]; min: number; period: number; spread?: number; anchor?: 'bottom' | 'center'; delay?: number}
  /** items travel along the path of item `path`, ping-pong between `from` and `to` (0-1 along it) */
  | {kind: 'follow'; items: number[]; path: number; period: number; axis?: 'xy' | 'x' | 'y'; from: number; to: number; delay?: number}
  /** stepped jumps through offsets: a quick move, then hold */
  | {kind: 'hop'; items: number[]; offsets: Vec2[]; hold: number; delay?: number}
  /** a text types on */
  | {kind: 'type'; text: number; delay: number; cps: number}
  /** a timecode text counts frames */
  | {kind: 'timecode'; text: number; rate: number};

export const TILE_ANIMS: Record<string, TileAnim[]> = {
  filming: [
    {kind: 'blink', items: [20], period: 1},
    {kind: 'timecode', text: 4, rate: 25},
  ],
  editing: [{kind: 'drift', items: [132, 133], dx: 52}],
  podcast: [{kind: 'drift', items: [83, 84], dx: 48}],
  ai: [{kind: 'blink', items: [5], period: 0.8}],
};
