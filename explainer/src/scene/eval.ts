import {bezierProgress} from './ease';
import type {Animated, Color, Comp, Key, Linked, LinkedVec2, Num, Prop, Vec2} from './types';

export function isAnimated<T>(p: Prop<T> | undefined): p is Animated<T> {
  return typeof p === 'object' && p !== null && !Array.isArray(p) && 'keys' in (p as object);
}

/** Locate the segment for frame t: returns [key index, normalised progress] or a clamp. */
function locate<T>(keys: Key<T>[], t: number): {i: number; p: number} {
  if (t <= keys[0].t) return {i: 0, p: 0};
  const last = keys.length - 1;
  if (t >= keys[last].t) return {i: last, p: 0};
  let i = 0;
  while (i < last && t >= keys[i + 1].t) i++;
  const k = keys[i];
  const n = keys[i + 1];
  const x = (t - k.t) / (n.t - k.t);
  const ease = k.ease ?? 'linear';
  if (ease === 'hold') return {i, p: 0};
  if (ease === 'linear') return {i, p: x};
  return {i, p: bezierProgress(ease, x)};
}

export function isLinked(p: unknown): p is Linked {
  return typeof p === 'object' && p !== null && 'link' in (p as object);
}

/** Reads a controller slider's value at frame t. */
export type LinkCtx = (layer: string, slider: string, t: number) => number;

/** Resolver for one comp: finds the controller layer's slider and evaluates it. */
export function compLinkCtx(comp: Comp): LinkCtx {
  return (layerName, sliderName, t) => {
    const layer = comp.layers.find((l) => l.name === layerName);
    const slider = layer?.sliders?.find((s) => s.name === sliderName);
    if (!slider) throw new Error(`Link target ${layerName} > ${sliderName} not found in comp ${comp.name}`);
    return evalNumber(slider.value, t, 0);
  };
}

export function applyLink(l: Linked['link'], sliderValue: number): number {
  const v = sliderValue * (l.mul ?? 1) + (l.add ?? 0);
  return Math.min(l.max ?? Infinity, Math.max(l.min ?? -Infinity, v));
}

export function evalNumber(p: Num | undefined, t: number, fallback: number, ctx?: LinkCtx): number {
  if (p === undefined) return fallback;
  if (isLinked(p)) {
    if (!ctx) throw new Error('Linked property evaluated without a comp context');
    return applyLink(p.link, ctx(p.link.layer, p.link.slider, t));
  }
  if (!isAnimated(p)) return p;
  const {i, p: q} = locate(p.keys, t);
  const a = p.keys[i].v;
  const b = p.keys[Math.min(i + 1, p.keys.length - 1)].v;
  return a + (b - a) * q;
}

export function isLinkedVec(p: unknown): p is LinkedVec2 {
  return typeof p === 'object' && p !== null && 'linkVec' in (p as object);
}

export function evalVec2(p: Prop<Vec2> | LinkedVec2 | undefined, t: number, fallback: Vec2, ctx?: LinkCtx): Vec2 {
  if (p === undefined) return fallback;
  if (isLinkedVec(p)) {
    if (!ctx) throw new Error('Linked property evaluated without a comp context');
    const s = ctx(p.linkVec.layer, p.linkVec.slider, t);
    return [applyLink({layer: '', slider: '', ...p.linkVec.x}, s), applyLink({layer: '', slider: '', ...p.linkVec.y}, s)];
  }
  if (!isAnimated(p)) return p;
  const {i, p: q} = locate(p.keys, t);
  const a = p.keys[i].v;
  const b = p.keys[Math.min(i + 1, p.keys.length - 1)].v;
  return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q];
}

/** Colours only ever change with hold keys, so this is a step lookup. */
export function evalColor(p: Prop<Color>, t: number): Color {
  if (!isAnimated(p)) return p;
  let v = p.keys[0].v;
  for (const k of p.keys) if (t >= k.t) v = k.v;
  return v;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16) / 255) as [number, number, number];
}
