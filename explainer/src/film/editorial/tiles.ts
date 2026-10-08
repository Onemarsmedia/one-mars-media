import type {Bezier, Comp, Geometry, Key, Layer, Num, PathData, ShapeItem, TextLayer, Vec2} from '../../scene/types';
import art from './art.json';
import {TILE_ANIMS, type TileAnim} from './tileAnims';
import {C, fontFor} from './tokens';

// The 12 tile precomps, built from the extracted Editorial drawings (tools/extract-art.mjs).
// Each tile has three looks (empty / live / active); the film switches between them with layer
// in/out points, a top-rule wipe and a top-to-bottom panel wipe, as in the Editorial motion notes.
// The live and active art panels are precomps of their own ("TILE 03 FILMING | live"), where the
// illustration keeps moving: a slow push-in on the whole panel plus the tile's animations (tileAnims.ts).

type Paint = {geo: PathData[]; color: string; opacity: number};
type StrokePaint = Paint & {width: number; cap: string; join: string; dash: number[] | null};
type ArtItem = {tag: string; fill: Paint | null; stroke: StrokePaint | null};
type ArtText = {
  text: string;
  x: number;
  y: number;
  rotation: number;
  family: string;
  weight: number;
  size: number;
  letterSpacing: number;
  anchor: string;
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  strokeWidth: number;
  strokeOpacity: number;
};
type Look = {items: ArtItem[]; texts: ArtText[]};
type TileArt = {num: string; name: string; live: Look; active: Look; empty: Look};

export const TILE = art.tile as {w: number; h: number; head: number; panelH: number; labelX: number};
export const TILE_KEYS = Object.keys(art.tiles) as string[];
const TILES = art.tiles as unknown as Record<string, TileArt>;

export function tileInfo(i: number) {
  const key = TILE_KEYS[i];
  return {key, num: TILES[key].num, name: TILES[key].name};
}

const cap = (c: string): 'butt' | 'round' | 'square' => (c === 'round' ? 'round' : c === 'square' ? 'square' : 'butt');
const join = (j: string): 'miter' | 'round' | 'bevel' => (j === 'round' ? 'round' : j === 'bevel' ? 'bevel' : 'miter');

/** Shape items in painter's order; consecutive identical paints share one group (fewer AE groups). */
export function lookItems(items: ArtItem[], filter: (it: ArtItem) => boolean = () => true): ShapeItem[] {
  const out: ShapeItem[] = [];
  let lastKey = '';
  const push = (key: string, mergeable: boolean, make: () => ShapeItem, geo: Geometry[]) => {
    const prev = out[out.length - 1];
    if (mergeable && prev && key === lastKey) {
      (prev.geo as Geometry[]).push(...geo);
      return;
    }
    out.push(make());
    lastKey = mergeable ? key : '';
  };
  for (const it of items.filter(filter)) {
    if (it.fill) {
      const f = it.fill;
      const geo: Geometry[] = f.geo.map((path) => ({type: 'path', path}));
      push(`f|${f.color}|${f.opacity}`, f.opacity >= 1, () => ({geo: [...geo], fill: {color: f.color, opacity: f.opacity * 100}}), geo);
    }
    if (it.stroke) {
      const s = it.stroke;
      const geo: Geometry[] = s.geo.map((path) => ({type: 'path', path}));
      push(
        `s|${s.color}|${s.opacity}|${s.width}|${s.cap}|${s.join}|${s.dash?.join(',') ?? ''}`,
        true,
        () => ({geo: [...geo], stroke: {color: s.color, width: s.width, opacity: s.opacity * 100, cap: cap(s.cap), join: join(s.join), dash: s.dash ?? undefined}}),
        geo,
      );
    }
  }
  return out;
}

export function textLayer(t: ArtText, name: string, extra: Partial<TextLayer> = {}): TextLayer {
  const font = fontFor(t.family, t.weight);
  const noFill = !t.fill;
  return {
    kind: 'text',
    name,
    source: {kind: 'static', text: t.text},
    font,
    size: t.size,
    color: t.fill ?? t.stroke ?? C.ink,
    tracking: t.size ? (t.letterSpacing / t.size) * 1000 : 0,
    justify: t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left',
    noFill,
    stroke: t.stroke && t.strokeWidth > 0 ? {color: t.stroke, width: t.strokeWidth} : undefined,
    transform: {
      position: [t.x, t.y],
      rotation: t.rotation || undefined,
      opacity: (noFill ? t.strokeOpacity : t.fillOpacity) < 1 ? (noFill ? t.strokeOpacity : t.fillOpacity) * 100 : undefined,
    },
    ...extra,
  };
}

const isHeader = (it: ArtItem) => {
  const ys = [...(it.fill?.geo ?? []), ...(it.stroke?.geo ?? [])].flatMap((p) => p.v.map((v) => v[1]));
  return Math.max(...ys) <= TILE.head + 0.5;
};

/** "00:00:09:14" + n frames at `rate` fps. */
function addFrames(tc: string, n: number, rate: number): string {
  const [h, m, sec, fr] = tc.split(':').map(Number);
  const total = ((h * 60 + m) * 60 + sec) * rate + fr + n;
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(Math.floor(total / (rate * 3600)))}:${p(Math.floor(total / (rate * 60)) % 60)}:${p(Math.floor(total / rate) % 60)}:${p(total % rate)}`;
}

export interface TileTiming {
  /** Frame the tile comes alive (local tile-comp time = film time). */
  on: number;
  /** Frame its active (red) look ends. */
  activeOff: number;
  /** Frame after which nothing needs to move (the tile has left the page). */
  loopEnd: number;
}

const SOFT: Bezier = [0.45, 0, 0.55, 1];
const OUT: Bezier = [0.2, 0.7, 0.2, 1];
const PANEL_PUSH = 103; // % the whole art panel grows from landing to the end (a slow push-in)

function bbox(items: ArtItem[]): [number, number, number, number] {
  const vs = items.flatMap((it) => [...(it.fill?.geo ?? []), ...(it.stroke?.geo ?? [])].flatMap((p) => p.v));
  const xs = vs.map((v) => v[0]);
  const ys = vs.map((v) => v[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const centre = (b: [number, number, number, number]): Vec2 => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

/** Point at u (0-1, by arc length) along the first sub-path of a path (AE vertex/tangent convention). */
function pathSampler(p: PathData): (u: number) => Vec2 {
  const pts: Vec2[] = [];
  const n = p.v.length;
  const segs = p.closed ? n : n - 1;
  for (let s = 0; s < segs; s++) {
    const a = p.v[s];
    const b = p.v[(s + 1) % n];
    const c1: Vec2 = [a[0] + (p.o?.[s]?.[0] ?? 0), a[1] + (p.o?.[s]?.[1] ?? 0)];
    const c2: Vec2 = [b[0] + (p.i?.[(s + 1) % n]?.[0] ?? 0), b[1] + (p.i?.[(s + 1) % n]?.[1] ?? 0)];
    for (let k = s === 0 ? 0 : 1; k <= 64; k++) {
      const t = k / 64;
      const m = 1 - t;
      pts.push([
        m * m * m * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * b[0],
        m * m * m * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * b[1],
      ]);
    }
  }
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = len[len.length - 1];
  return (u) => {
    const target = Math.max(0, Math.min(1, u)) * total;
    let k = 1;
    while (k < len.length - 1 && len[k] < target) k++;
    const f = (target - len[k - 1]) / Math.max(1e-9, len[k] - len[k - 1]);
    return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
  };
}
/** Smooth in-out (same feel as SOFT) for sampled motion. */
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Check a tile's animations against its drawing; throws with a precise message. */
export function validateTileAnims(key: string, anims: TileAnim[] = TILE_ANIMS[key] ?? []) {
  const used = new Map<number, string>();
  for (const look of ['live', 'active'] as const) {
    const L = TILES[key][look];
    for (const a of anims) {
      const where = `${key}/${look}/${a.kind}`;
      if (a.kind === 'type' || a.kind === 'timecode') {
        const t = L.texts[a.text];
        if (!t) throw new Error(`${where}: no text ${a.text}`);
        if (t.y <= TILE.head) throw new Error(`${where}: text ${a.text} is in the header`);
        continue;
      }
      if (!a.items.length) throw new Error(`${where}: no items`);
      for (const i of a.items) {
        const it = L.items[i];
        if (!it) throw new Error(`${where}: no item ${i}`);
        if (isHeader(it)) throw new Error(`${where}: item ${i} is in the header`);
        if (a.kind === 'draw' && (it.fill || !it.stroke)) throw new Error(`${where}: item ${i} is not stroke-only`);
        if (look === 'live') {
          if (used.has(i)) throw new Error(`${where}: item ${i} already used by ${used.get(i)}`);
          used.set(i, a.kind);
        }
      }
      if (a.kind === 'follow' && !L.items[a.path]) throw new Error(`${where}: no path item ${a.path}`);
      const periodic = 'period' in a ? a.period : 1;
      if (periodic < 0.4) throw new Error(`${where}: period ${periodic} s is too short`);
    }
  }
}

/** Layers for one animation (all in look-comp frames; t0 = landing, t1 = loop end). */
function animLayers(a: Exclude<TileAnim, {kind: 'type' | 'timecode'}>, L: Look, base: string, t0: number, t1: number, fps: number, common: Partial<Layer>): Layer[] {
  const F = (sec: number) => Math.round(sec * fps);
  const items = a.items.map((i) => L.items[i]);
  const name = `${base} ${a.kind} ${a.items.join('+')}`;
  const shape = (n: string, its: ArtItem[], transform: Layer['transform'], extra: Partial<Layer> = {}): Layer =>
    ({kind: 'shape', name: n, items: lookItems(its), transform, ...common, ...extra}) as Layer;
  /** alternating values every half period from `start` until t1, eased SOFT */
  const swing = <T>(start: number, half: number, values: [T, T]): Key<T>[] => {
    const keys: Key<T>[] = [];
    for (let t = start, k = 0; t < t1; t += half, k++) keys.push({t, v: values[k % 2], ease: SOFT});
    if (keys.length) delete keys[keys.length - 1].ease;
    return keys;
  };
  switch (a.kind) {
    case 'blink': {
      const keys: Key<number>[] = [];
      const half = Math.max(1, F(a.period / 2));
      let on = true;
      for (let t = t0 + F(a.delay ?? 0); t < t1; t += half, on = !on) keys.push({t, v: on ? 100 : 0, ease: 'hold'});
      if (keys.length) delete keys[keys.length - 1].ease;
      return [shape(name, items, {opacity: {keys}})];
    }
    case 'drift':
      return [shape(name, items, {position: {keys: [{t: t0, v: [0, 0]}, {t: t1, v: [a.dx, a.dy ?? 0]}]}})];
    case 'loop': {
      // plays forward by dx over each period, then jumps back (a playhead looping a section)
      const keys: Key<Vec2>[] = [];
      const P = F(a.period);
      for (let t = t0 + F(a.delay ?? 0.4); t + P <= t1; t += P) keys.push({t, v: [0, 0]}, {t: t + P - 1, v: [a.dx, 0], ease: 'hold'});
      if (keys.length) delete keys[keys.length - 1].ease;
      return [shape(name, items, {position: keys.length > 1 ? {keys} : [0, 0]})];
    }
    case 'pulse': {
      const pv = a.pivot ?? centre(bbox(items));
      const keys: Key<Vec2>[] = [];
      const up = F(0.18);
      const down = F(0.4);
      for (let t = t0 + F(a.delay ?? 0.5); t + up + down < t1; t += F(a.period)) {
        keys.push({t, v: [100, 100], ease: OUT}, {t: t + up, v: [a.scale, a.scale], ease: SOFT}, {t: t + up + down, v: [100, 100]});
      }
      return [shape(name, items, {anchor: pv, position: pv, scale: keys.length ? {keys} : [100, 100]})];
    }
    case 'draw':
      return a.items.map((idx, k) => {
        const t = t0 + F(a.delay + k * (a.stagger ?? 0));
        const its = lookItems([L.items[idx]]).map((si) => ({...si, trim: {end: {keys: [{t, v: 0, ease: SOFT}, {t: t + F(a.dur), v: 100}]}}}));
        return {kind: 'shape', name: `${base} draw ${idx}`, items: its, ...common} as Layer;
      });
    case 'pop':
      return a.items.map((idx, k) => {
        const t = t0 + F(a.delay + k * a.stagger);
        return shape(`${base} pop ${idx}`, [L.items[idx]], {
          position: {keys: [{t, v: [0, a.dy ?? 4], ease: OUT}, {t: t + F(0.4), v: [0, 0]}]},
          opacity: {keys: [{t, v: 0, ease: SOFT}, {t: t + F(0.3), v: 100}]},
        });
      });
    case 'bob': {
      const start = t0 + F((a.phase ?? 0) * a.period) + F(a.delay ?? 0.4);
      const keys = swing<Vec2>(start, F(a.period / 2), [[0, -a.amp / 2], [0, a.amp / 2]]);
      return [shape(name, items, {position: keys.length > 1 ? {keys: [{t: t0, v: [0, 0], ease: SOFT}, ...keys]} : [0, 0]})];
    }
    case 'tilt': {
      const pv = a.pivot ?? centre(bbox(items));
      const keys = swing<number>(t0 + F(a.delay ?? 0.5), F(a.period / 2), [-a.deg, a.deg]);
      return [shape(name, items, {anchor: pv, position: pv, rotation: keys.length > 1 ? {keys: [{t: t0, v: 0, ease: SOFT}, ...keys]} : 0})];
    }
    case 'pump': {
      // one layer, one group per item, each with its own scale keys (anchor at the bar's foot or centre)
      const groups: ShapeItem[] = [];
      a.items.forEach((idx, k) => {
        const b = bbox([L.items[idx]]);
        const pv: Vec2 = a.anchor === 'center' ? centre(b) : [(b[0] + b[2]) / 2, b[3]];
        const start = t0 + F((a.delay ?? 0.45) + ((k * (a.spread ?? 0.13)) % 1) * a.period);
        const keys = swing<Vec2>(start, F(a.period / 2), [[100, a.min], [100, 100]]);
        const scale = keys.length > 1 ? {keys: [{t: t0, v: [100, 100] as Vec2, ease: SOFT}, ...keys]} : ([100, 100] as Vec2);
        for (const si of lookItems([L.items[idx]])) groups.push({...si, transform: {anchor: pv, position: pv, scale}});
      });
      return [{kind: 'shape', name, items: groups, ...common} as Layer];
    }
    case 'follow': {
      const src = L.items[a.path];
      const geo = (src.stroke ?? src.fill)!.geo[0];
      const at = pathSampler(geo);
      const p0 = at(a.from);
      const keys: Key<Vec2>[] = [];
      const half = a.period / 2;
      const step = 2; // frames between samples
      for (let t = t0 + F(a.delay ?? 0.45), leg = 0; t < t1; leg++) {
        const legEnd = Math.min(t1, t + F(half));
        for (let f = t; f < legEnd; f += step) {
          const x = smooth((f - t) / F(half));
          const u = leg % 2 === 0 ? a.from + (a.to - a.from) * x : a.to + (a.from - a.to) * x;
          const p = at(u);
          keys.push({t: f, v: [a.axis === 'y' ? 0 : p[0] - p0[0], a.axis === 'x' ? 0 : p[1] - p0[1]]});
        }
        t = legEnd;
      }
      return [shape(name, items, {position: keys.length > 1 ? {keys} : [0, 0]})];
    }
    case 'hop': {
      const keys: Key<Vec2>[] = [{t: t0, v: [0, 0], ease: 'hold'}];
      const move = F(0.25);
      for (let t = t0 + F(a.delay ?? 1), k = 1; t + move < t1; t += move + F(a.hold), k++) {
        const prev = keys[keys.length - 1].v;
        keys.push({t, v: prev, ease: SOFT}, {t: t + move, v: a.offsets[k % a.offsets.length] as Vec2, ease: 'hold'});
      }
      delete keys[keys.length - 1].ease;
      return [shape(name, items, {position: keys.length > 1 ? {keys} : [0, 0]})];
    }
  }
}

/** One look's art panel as a comp: static runs of items in painter's order, animated items in place, then texts. */
function buildLookComp(i: number, look: 'live' | 'active', duration: number, fps: number, timing?: TileTiming): Comp {
  const {key, num, name} = tileInfo(i);
  const L = TILES[key][look];
  const base = `${num} ${name} | ${look}`;
  const anims = timing ? (TILE_ANIMS[key] ?? []) : [];
  if (timing) validateTileAnims(key, anims);
  const t0 = timing?.on ?? 0;
  const t1 = timing ? Math.max(timing.loopEnd, t0 + 1) : duration;
  const ZOOM = `${base} push-in`;
  const pv: Vec2 = [TILE.w / 2, TILE.head + TILE.panelH / 2];
  const layers: Layer[] = [];
  if (timing) layers.push({kind: 'null', name: ZOOM, transform: {anchor: pv, position: pv, scale: {keys: [{t: t0, v: [100, 100]}, {t: t1, v: [PANEL_PUSH, PANEL_PUSH]}]}}, label: 2});
  const common: Partial<Layer> = timing ? {parent: ZOOM} : {};
  const owner = new Map<number, TileAnim>();
  for (const a of anims) if (a.kind !== 'type' && a.kind !== 'timecode') for (const idx of a.items) owner.set(idx, a);
  let run: ArtItem[] = [];
  let runStart = 0;
  const flush = () => {
    if (run.length) layers.push({kind: 'shape', name: `${base} art ${runStart}-${runStart + run.length - 1}`, items: lookItems(run), label: look === 'active' ? 1 : 9, ...common} as Layer);
    run = [];
  };
  L.items.forEach((it, idx) => {
    if (isHeader(it)) return;
    const a = owner.get(idx);
    if (!a) {
      if (!run.length) runStart = idx;
      run.push(it);
      return;
    }
    flush();
    if (a.kind !== 'type' && a.kind !== 'timecode' && a.items[0] === idx) layers.push(...animLayers(a, L, base, t0, t1, fps, common));
  });
  flush();
  L.texts.forEach((t, k) => {
    if (t.y <= TILE.head) return;
    const tl = textLayer(t, `${base} text ${k + 1}`, timing ? {parent: ZOOM} : {});
    const a = anims.find((x) => (x.kind === 'type' || x.kind === 'timecode') && x.text === k);
    if (a?.kind === 'timecode') {
      tl.name = `${base} loop timecode`;
      const keys: Key<string>[] = [];
      for (let n = 0, f = t0; f < t1; n++, f = t0 + Math.round((n * fps) / a.rate)) keys.push({t: f, v: addFrames(t.text, n, a.rate), ease: 'hold'});
      delete keys[keys.length - 1].ease;
      tl.source = {kind: 'keyed', keys};
    } else if (a?.kind === 'type') {
      const chars: Key<number>[] = [{t: 0, v: 0, ease: 'hold'}];
      for (let c = 1; c <= t.text.length; c++) chars.push({t: t0 + Math.round((a.delay + (c - 1) / a.cps) * fps), v: c, ease: c < t.text.length ? 'hold' : undefined});
      tl.source = {kind: 'typeOn', text: t.text, chars: {keys: chars}};
    }
    layers.push(tl);
  });
  return {name: `TILE ${base}`, width: TILE.w, height: Math.ceil(TILE.h), fps, duration, layers};
}

/** One tile: its precomp first, then the precomps of its live and active art panels. Without timing it is permanently live. */
export function buildTileComps(i: number, duration: number, fps: number, timing?: TileTiming): Comp[] {
  const {key, num, name} = tileInfo(i);
  const a = TILES[key];
  const pre = `${num} ${name}`;
  const on = timing?.on ?? 0;
  const off = timing?.activeOff ?? 0;
  const WIPE_RULE = Math.round(0.28 * fps);
  const WIPE_PANEL = Math.round(0.4 * fps);
  const FADE = Math.round(0.3 * fps); // active (red) look dissolves into the live look
  const layers: Layer[] = [];
  const panelMatte = `${pre} | panel wipe`;
  const ease: Bezier = [0.45, 0, 0.15, 1]; // smooth in, long soft landing
  const ruleEase: Bezier = [0.25, 0.6, 0.2, 1];
  const fadeOut = (base = 100): Num => ({keys: [{t: off, v: base, ease: [0.4, 0, 0.6, 1]}, {t: off + FADE, v: 0}]});
  const comps: Comp[] = [];

  // a live tile is a card above the page: an opaque backing (header included) that hides its own shadow
  layers.push({
    kind: 'shape',
    name: `${pre} | card`,
    items: [{geo: {type: 'rect', size: [TILE.w, TILE.h], center: [TILE.w / 2, TILE.h / 2]}, fill: {color: C.paper}}],
    in: on,
    label: 16,
  });
  // EMPTY look (reserved slot) until the panel has wiped on
  if (timing) {
    const gone = Math.round(0.15 * fps);
    const fadeAway: Num = {keys: [{t: on, v: 100, ease: [0.4, 0, 0.6, 1]}, {t: on + gone, v: 0}]};
    layers.push({kind: 'shape', name: `${pre} | empty panel`, items: lookItems(a.empty.items, (it) => !isHeader(it)), out: on + WIPE_PANEL, label: 16});
    layers.push({kind: 'shape', name: `${pre} | empty rule`, items: lookItems(a.empty.items, isHeader), transform: {opacity: fadeAway}, out: on + gone, label: 16});
    a.empty.texts.forEach((t, k) => {
      const tl = textLayer(t, `${pre} | empty text ${k + 1}`);
      const head = t.y <= TILE.head;
      layers.push({...tl, ...(head ? {transform: {...tl.transform, opacity: fadeAway}, out: on + gone} : {out: on + WIPE_PANEL}), label: 16});
    });
  }
  // Panel wipe matte: grows from the top edge of the panel down
  layers.push({
    kind: 'shape',
    name: panelMatte,
    matteSource: true,
    items: [{geo: {type: 'rect', size: [TILE.w, TILE.panelH], center: [TILE.w / 2, TILE.panelH / 2]}, fill: {color: '#FFFFFF'}}],
    transform: {
      anchor: [0, 0],
      position: [0, TILE.head],
      scale: timing ? {keys: [{t: on, v: [100, 0], ease}, {t: on + WIPE_PANEL, v: [100, 100]}]} : [100, 100],
    },
    in: on,
  });
  const looks: Array<['live' | 'active', number, number | undefined]> = timing
    ? off > on
      ? [
          ['live', on, undefined],
          ['active', on, off + FADE],
        ]
      : [['live', on, undefined]]
    : [['live', 0, undefined]];
  for (const [look, inF, outF] of looks) {
    const L = a[look];
    const lbl = look === 'active' ? 1 : 9;
    const fades = look === 'active' && timing;
    const withFade = (tl: TextLayer): TextLayer =>
      fades ? {...tl, transform: {...tl.transform, opacity: fadeOut(typeof tl.transform?.opacity === 'number' ? tl.transform.opacity : 100)}} : tl;
    // the art panel (its own precomp: the illustration moves inside it)
    const lookComp = buildLookComp(i, look, duration, fps, timing);
    comps.push(lookComp);
    layers.push({
      kind: 'precomp',
      name: `${pre} | ${look} panel`,
      comp: lookComp.name,
      collapse: true,
      in: inF,
      out: outF,
      matte: {layer: panelMatte, type: 'alpha'},
      label: lbl,
      transform: fades ? {opacity: fadeOut()} : undefined,
    });
    // header: top rule wipes in from the left, number/label/tag cut on
    const headerItems = lookItems(L.items, isHeader);
    layers.push({
      kind: 'shape',
      name: `${pre} | ${look} rule`,
      items: headerItems,
      transform: {
        anchor: [0, 0],
        position: [0, 0],
        scale: timing ? {keys: [{t: inF, v: [0, 100], ease: ruleEase}, {t: inF + WIPE_RULE, v: [100, 100]}]} : [100, 100],
        opacity: fades ? fadeOut() : undefined,
      },
      in: inF,
      out: outF,
      label: lbl,
    });
    L.texts
      .filter((t) => t.y <= TILE.head)
      .forEach((t, k) => {
        const tl = textLayer(t, `${pre} | ${look} head ${k + 1}`);
        if (!timing) return layers.push({...tl, in: inF, out: outF, label: lbl});
        const base = typeof tl.transform?.opacity === 'number' ? tl.transform.opacity : 100;
        const t0 = inF + Math.round((k * 2 * fps) / 60);
        const opacity: Key<number>[] = [
          {t: t0, v: 0, ease: SOFT},
          {t: t0 + Math.round(0.22 * fps), v: base},
        ];
        if (fades) opacity.push({t: off, v: base, ease: [0.4, 0, 0.6, 1]}, {t: off + FADE, v: 0});
        const p = tl.transform!.position as Vec2;
        layers.push({
          ...tl,
          transform: {...tl.transform, opacity: {keys: opacity}, position: {keys: [{t: t0, v: [p[0], p[1] + 6], ease: OUT}, {t: t0 + Math.round(0.3 * fps), v: p}]}},
          in: inF,
          out: outF,
          label: lbl,
        });
      });
  }
  return [{name: `TILE ${pre}`, width: TILE.w, height: Math.ceil(TILE.h), fps, duration, layers}, ...comps];
}

export type {Num};
