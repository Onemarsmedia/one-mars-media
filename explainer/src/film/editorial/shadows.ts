import type {ShapeItem} from '../../scene/types';
import {C} from './tokens';

// Soft shadows without effects: nested rects whose stacked opacity falls off like a Gaussian blur (sigma)
// of an edge, darkest (peak) inside it. Plain shapes, so the MP4 and the AE project match pixel for pixel,
// and the softness scales with the camera like the page does (an AE blur on a shape layer would not).
const erfc = (x: number): number => {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
};
/** Steps outward from the edge (g, px) and the opacity (%) of each, outermost first. */
export function shadowSteps(sigma: number, peak: number, step: number): Array<{g: number; a: number}> {
  const gs: number[] = [];
  for (let g = -1.2 * sigma; g <= 3 * sigma + 1e-6; g += step) gs.push(g);
  const target = (d: number) => (peak / 2) * erfc(d / (sigma * Math.SQRT2));
  const out: Array<{g: number; a: number}> = [];
  let covered = 1; // 1 - stacked alpha of the steps further out
  for (let j = gs.length - 1; j >= 0; j--) {
    const left = 1 - target(j === 0 ? gs[0] - step / 2 : (gs[j - 1] + gs[j]) / 2);
    out.push({g: gs[j], a: Math.round((1 - left / covered) * 1e5) / 1e3});
    covered = left;
  }
  return out;
}
/** A soft shadow under a w x h card at [0, 0]. */
export const cardShadow = (w: number, h: number, sigma: number, peak: number, step: number): ShapeItem[] =>
  shadowSteps(sigma, peak, step).map(({g, a}) => ({
    geo: {type: 'rect', size: [w + 2 * g, h + 2 * g], center: [w / 2, h / 2], roundness: Math.max(0, g)},
    fill: {color: C.ink, opacity: a},
  }));
