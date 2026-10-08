import type {Bezier} from './types';

// Cubic-bezier easing, plus the exact conversion to After Effects keyframe ease.
//
// AE describes a 1D temporal bezier with (speed, influence) per side of a key:
//   handle 1 = (t0 + inflOut*dt, v0 + speedOut*inflOut*dt)
//   handle 2 = (t1 - inflIn*dt,  v1 - speedIn*inflIn*dt)
// With inflOut = x1, speedOut = (y1/x1)*dv/dt, inflIn = 1-x2, speedIn = ((1-y2)/(1-x2))*dv/dt
// those handles land exactly on the normalised control points (x1,y1) and (x2,y2), so a CSS-style
// cubic-bezier and the AE keyframe describe the same curve. tests/ease.test.ts checks this.

/** Influence limits AE accepts (percent). */
export const AE_MIN_INFLUENCE = 0.1;
export const AE_MAX_INFLUENCE = 100;

function sampleCurve(a1: number, a2: number, u: number): number {
  // Cubic bezier with P0=0, P3=1.
  const iu = 1 - u;
  return 3 * iu * iu * u * a1 + 3 * iu * u * u * a2 + u * u * u;
}

function sampleDerivative(a1: number, a2: number, u: number): number {
  const iu = 1 - u;
  return 3 * iu * iu * a1 + 6 * iu * u * (a2 - a1) + 3 * u * u * (1 - a2);
}

/** Solve x(u) = x for u on a cubic bezier with x control points x1, x2 (monotonic for x in [0,1]). */
function solveU(x1: number, x2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let u = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleCurve(x1, x2, u) - x;
    if (Math.abs(err) < 1e-7) return u;
    const d = sampleDerivative(x1, x2, u);
    if (Math.abs(d) < 1e-6) break;
    u -= err / d;
  }
  // Bisection fallback.
  let lo = 0;
  let hi = 1;
  u = x;
  for (let i = 0; i < 60; i++) {
    const xu = sampleCurve(x1, x2, u);
    if (Math.abs(xu - x) < 1e-7) return u;
    if (xu < x) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return u;
}

/** Normalised progress (0..1 in time) -> normalised value, for a CSS-style cubic-bezier. */
export function bezierProgress(b: Bezier, x: number): number {
  const [x1, y1, x2, y2] = b;
  return sampleCurve(y1, y2, solveU(x1, x2, x));
}

export interface AeEaseSide {
  speed: number;
  influence: number; // percent
}

/** Clamp x control points so AE accepts them (influence must be in [0.1, 100] percent). */
export function aeSafeBezier(b: Bezier): Bezier {
  const lo = AE_MIN_INFLUENCE / 100;
  const x1 = Math.min(1, Math.max(lo, b[0]));
  const x2 = Math.max(0, Math.min(1 - lo, b[2]));
  return [x1, b[1], x2, b[3]];
}

/**
 * AE ease for one dimension of one segment.
 * @param dv value change over the segment (for a spatial property: the distance travelled)
 * @param dtSec segment duration in seconds
 */
export function bezierToAe(b: Bezier, dv: number, dtSec: number): {out: AeEaseSide; in: AeEaseSide} {
  const [x1, y1, x2, y2] = aeSafeBezier(b);
  const slope = dv / dtSec;
  return {
    out: {influence: x1 * 100, speed: (y1 / x1) * slope},
    in: {influence: (1 - x2) * 100, speed: ((1 - y2) / (1 - x2)) * slope},
  };
}

/**
 * Evaluate a 1D AE bezier segment directly from (speed, influence), the way AE does.
 * Used by the round-trip test to prove the emitted keyframes reproduce the scene.
 */
export function evalAeSegment(
  t0: number,
  v0: number,
  t1: number,
  v1: number,
  out: AeEaseSide,
  inn: AeEaseSide,
  t: number,
): number {
  const dt = t1 - t0;
  const fo = out.influence / 100;
  const fi = inn.influence / 100;
  const cx1 = fo;
  const cy1 = v0 + out.speed * fo * dt;
  const cx2 = 1 - fi;
  const cy2 = v1 - inn.speed * fi * dt;
  const u = solveU(cx1, cx2, (t - t0) / dt);
  const iu = 1 - u;
  return iu * iu * iu * v0 + 3 * iu * iu * u * cy1 + 3 * iu * u * u * cy2 + u * u * u * v1;
}

// A small vocabulary of eases used across the film.
export const EASE = {
  linear: [0.25, 0.25, 0.75, 0.75] as Bezier,
  out: [0.16, 1, 0.3, 1] as Bezier, // expo-ish out: fast start, soft landing
  in: [0.7, 0, 0.84, 0] as Bezier,
  inOut: [0.65, 0, 0.35, 1] as Bezier,
  snap: [0.2, 0.9, 0.1, 1] as Bezier, // very quick settle
  back: [0.34, 1.45, 0.64, 1] as Bezier, // overshoot out
} as const;
