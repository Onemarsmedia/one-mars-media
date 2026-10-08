import {bezierProgress} from './ease';
import type {Animated, Bezier, Ease, Key, PathData, Transform, Vec2} from './types';

// Small authoring helpers. Everything they produce is plain keyframes, so a spring here turns into
// a handful of editable AE keys (no expressions) and renders identically in Remotion.

export const key = <T>(t: number, v: T, ease?: Ease): Key<T> => ({t, v, ease});
export const anim = <T>(...keys: Key<T>[]): Animated<T> => ({keys});

/** Anchor and position at the same point: scale/rotate around (x, y) without moving. */
export const pivot = (x: number, y: number): Pick<Transform, 'anchor' | 'position'> => ({anchor: [x, y], position: [x, y]});

/** Circle as an explicit path starting at 12 o'clock, clockwise (so Trim Paths start there in both engines). */
export function circlePath(cx: number, cy: number, r: number): PathData {
  const k = 0.5522847498 * r;
  return {
    v: [
      [cx, cy - r],
      [cx + r, cy],
      [cx, cy + r],
      [cx - r, cy],
    ],
    i: [
      [-k, 0],
      [0, -k],
      [k, 0],
      [0, k],
    ],
    o: [
      [k, 0],
      [0, k],
      [-k, 0],
      [0, -k],
    ],
    closed: true,
  };
}

export function linePath(a: Vec2, b: Vec2): PathData {
  return {v: [a, b], closed: false};
}

export function polyPath(points: Vec2[], closed = false): PathData {
  return {v: points, closed};
}

// ---------------------------------------------------------------- spring -> keyframes

/** Nelder-Mead over the 4 bezier params, minimising max error against a normalised curve. */
function fitBezier(curve: (s: number) => number): Bezier {
  const samples = Array.from({length: 41}, (_, i) => i / 40);
  const target = samples.map(curve);
  const clampB = (b: number[]): Bezier => [Math.min(0.99, Math.max(0.01, b[0])), b[1], Math.min(0.99, Math.max(0.01, b[2])), b[3]];
  const cost = (b: number[]) => {
    const bb = clampB(b);
    let m = 0;
    for (let i = 0; i < samples.length; i++) m = Math.max(m, Math.abs(bezierProgress(bb, samples[i]) - target[i]));
    return m;
  };
  let simplex: number[][] = [
    [0.37, 0, 0.63, 1],
    [0.5, 0, 0.63, 1],
    [0.37, 0.2, 0.63, 1],
    [0.37, 0, 0.5, 1],
    [0.37, 0, 0.63, 0.8],
  ];
  let costs = simplex.map(cost);
  for (let iter = 0; iter < 400; iter++) {
    const order = costs.map((c, i) => [c, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    simplex = order.map((i) => simplex[i]);
    costs = order.map((i) => costs[i]);
    const centroid = [0, 1, 2, 3].map((d) => simplex.slice(0, 4).reduce((s, p) => s + p[d], 0) / 4);
    const worst = simplex[4];
    const reflect = centroid.map((c, d) => c + (c - worst[d]));
    const cr = cost(reflect);
    if (cr < costs[0]) {
      const expand = centroid.map((c, d) => c + 2 * (c - worst[d]));
      const ce = cost(expand);
      simplex[4] = ce < cr ? expand : reflect;
      costs[4] = Math.min(ce, cr);
    } else if (cr < costs[3]) {
      simplex[4] = reflect;
      costs[4] = cr;
    } else {
      const contract = centroid.map((c, d) => c + 0.5 * (worst[d] - c));
      const cc = cost(contract);
      if (cc < costs[4]) {
        simplex[4] = contract;
        costs[4] = cc;
      } else {
        for (let i = 1; i < 5; i++) {
          simplex[i] = simplex[i].map((x, d) => simplex[0][d] + 0.5 * (x - simplex[0][d]));
          costs[i] = cost(simplex[i]);
        }
      }
    }
  }
  const best = costs.indexOf(Math.min(...costs));
  return clampB(simplex[best]).map((x) => Math.round(x * 1e4) / 1e4) as Bezier;
}

const halfWaveCache = new Map<number, Bezier>();

/** Ease between two consecutive extrema of an underdamped spring. Same shape for every half-wave. */
function springHalfWaveEase(zeta: number): Bezier {
  const z = Math.round(zeta * 1000) / 1000;
  const hit = halfWaveCache.get(z);
  if (hit) return hit;
  const c = z / Math.sqrt(1 - z * z);
  const k = z / Math.sqrt(1 - z * z); // zeta*omega*t expressed via omega_d*t = pi*s
  const h = (s: number) => Math.exp(-k * Math.PI * s) * (Math.cos(Math.PI * s) + c * Math.sin(Math.PI * s));
  const h0 = h(0);
  const h1 = h(1);
  const b = fitBezier((s) => (h(s) - h0) / (h1 - h0));
  halfWaveCache.set(z, b);
  return b;
}

export interface SpringOpts {
  /** Natural frequency in Hz (higher = snappier). */
  freq?: number;
  /** Damping ratio: < 1 overshoots, 1 = critically damped. */
  zeta?: number;
  fps: number;
  /** Stop once the remaining wobble is below this fraction of the move. */
  settle?: number;
}

/**
 * Keyframes for a damped spring from `from` to `to` starting at frame t0.
 * Keys sit on the spring's extrema (whole frames), joined by a fitted bezier, then snap to `to`.
 */
export function springKeys(from: number, to: number, t0: number, opts: SpringOpts): Key<number>[] {
  const {freq = 2.2, zeta = 0.55, fps, settle = 0.012} = opts;
  const w = 2 * Math.PI * freq;
  const A = from - to;
  if (zeta >= 1) {
    // Critically damped: one eased segment to the settle time.
    const residual = (t: number) => (1 + w * t) * Math.exp(-w * t);
    let T = 0;
    while (residual(T) > settle) T += 1 / fps;
    const ease = fitBezier((s) => 1 - residual(s * T));
    return [key(t0, from, ease), key(t0 + Math.max(1, Math.round(T * fps)), to)];
  }
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const ease = springHalfWaveEase(zeta);
  const keys: Key<number>[] = [key(t0, from, ease)];
  for (let n = 1; n < 12; n++) {
    const tau = (n * Math.PI) / wd;
    const amp = Math.exp(-zeta * w * tau);
    const f = t0 + Math.round(tau * fps);
    if (f <= keys[keys.length - 1].t) continue;
    if (amp < settle) {
      keys.push(key(f, to));
      break;
    }
    keys.push(key(f, to + A * (n % 2 === 0 ? amp : -amp), ease));
  }
  const last = keys[keys.length - 1];
  if (last.v !== to) last.v = to;
  delete last.ease;
  return keys;
}

/** Same spring on both components of a Vec2 (e.g. uniform scale). */
export function springVec(from: Vec2, to: Vec2, t0: number, opts: SpringOpts): Key<Vec2>[] {
  const ref = springKeys(0, 1, t0, opts);
  return ref.map((k) => ({
    t: k.t,
    ease: k.ease,
    v: [from[0] + (to[0] - from[0]) * k.v, from[1] + (to[1] - from[1]) * k.v] as Vec2,
  }));
}

/** Spring scale with uniform percentage, e.g. springScale(0, 100, 30, {fps}). */
export const springScale = (from: number, to: number, t0: number, opts: SpringOpts) => anim(...springVec([from, from], [to, to], t0, opts));
