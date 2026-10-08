import type {Comp, Geometry, Layer, Num, PathData, ShapeItem, TextLayer} from '../../scene/types';
import art from './art.json';
import {C, fontFor} from './tokens';

// The 12 tile precomps, built from the extracted Editorial drawings (tools/extract-art.mjs).
// Each tile has three looks (empty / live / active); the film switches between them with layer
// in/out points, a top-rule wipe and a top-to-bottom panel wipe, as in the Editorial motion notes.

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

/**
 * Micro-loops that keep a live tile moving (item / text indices into its drawing; same in the active look).
 *   blink    - items switch on/off every half period (stepped)
 *   drift    - items glide right by dx px from the moment the tile lands to the end of the film
 *   timecode - a text counts frames at `rate` fps from its drawn value
 */
type Loop = {kind: 'blink'; items: number[]; period: number} | {kind: 'drift'; items: number[]; dx: number} | {kind: 'timecode'; text: number; rate: number};
const LOOPS: Record<string, Loop[]> = {
  filming: [
    {kind: 'blink', items: [20], period: 1},
    {kind: 'timecode', text: 4, rate: 25},
  ],
  editing: [{kind: 'drift', items: [132, 133], dx: 52}],
  podcast: [{kind: 'drift', items: [83, 84], dx: 48}],
  ai: [{kind: 'blink', items: [5], period: 0.8}],
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
}

/** One tile precomp. Without timing it is permanently live (for reference renders). */
export function buildTileComp(i: number, duration: number, fps: number, timing?: TileTiming): Comp {
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
  const ease: [number, number, number, number] = [0.45, 0, 0.15, 1]; // smooth in, long soft landing
  const ruleEase: [number, number, number, number] = [0.25, 0.6, 0.2, 1];
  const fadeOut = (base = 100): Num => ({keys: [{t: off, v: base, ease: [0.4, 0, 0.6, 1]}, {t: off + FADE, v: 0}]});

  // EMPTY look (reserved slot) until the panel has wiped on
  if (timing) {
    layers.push({kind: 'shape', name: `${pre} | empty`, items: lookItems(a.empty.items), out: on + WIPE_PANEL, label: 16});
    a.empty.texts.forEach((t, k) => layers.push({...textLayer(t, `${pre} | empty text ${k + 1}`), out: on + WIPE_PANEL, label: 16}));
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
    const loops = timing ? (LOOPS[key] ?? []) : [];
    const loopItems = new Set(loops.flatMap((lp) => (lp.kind === 'timecode' ? [] : lp.items)));
    const loopTexts = new Set(loops.flatMap((lp) => (lp.kind === 'timecode' ? [lp.text] : [])));
    const end = outF ?? duration;
    layers.push({
      kind: 'shape',
      name: `${pre} | ${look} panel`,
      items: lookItems(
        L.items.filter((_, k) => !loopItems.has(k)),
        (it) => !isHeader(it),
      ),
      in: inF,
      out: outF,
      matte: {layer: panelMatte, type: 'alpha'},
      label: lbl,
      transform: fades ? {opacity: fadeOut()} : undefined,
    });
    L.texts.forEach((t, k) => {
      if (t.y <= TILE.head) return;
      const tl = withFade(textLayer(t, `${pre} | ${look} text ${k + 1}`));
      if (loopTexts.has(k)) {
        const lp = loops.find((x) => x.kind === 'timecode' && x.text === k) as Extract<Loop, {kind: 'timecode'}>;
        const keys: Array<{t: number; v: string; ease?: 'hold'}> = [];
        for (let n = 0, t0 = inF; t0 < end; n++, t0 = inF + Math.round((n * fps) / lp.rate)) keys.push({t: t0, v: addFrames(t.text, n, lp.rate), ease: 'hold'});
        delete keys[keys.length - 1].ease;
        tl.source = {kind: 'keyed', keys};
      }
      layers.push({...tl, in: inF, out: outF, matte: {layer: panelMatte, type: 'alpha'}, label: lbl});
    });
    // micro-loops: their items on their own layers, above the panel
    for (const lp of loops) {
      if (lp.kind === 'timecode') continue;
      const tr: Layer['transform'] = {};
      if (lp.kind === 'blink') {
        const stop = fades ? off : end;
        const half = Math.round((lp.period * fps) / 2);
        const keys: Array<{t: number; v: number; ease?: 'hold' | [number, number, number, number]}> = [];
        let on = true;
        for (let t0 = inF; t0 < stop; t0 += half, on = !on) keys.push({t: t0, v: on ? 100 : 0, ease: 'hold'});
        if (fades) keys.push({t: off, v: on ? 100 : 0, ease: [0.4, 0, 0.6, 1]}, {t: off + FADE, v: 0});
        else delete keys[keys.length - 1].ease;
        tr.opacity = {keys};
      } else {
        tr.position = {keys: [{t: inF, v: [0, 0]}, {t: duration, v: [lp.dx, 0]}]};
        if (fades) tr.opacity = fadeOut();
      }
      layers.push({
        kind: 'shape',
        name: `${pre} | ${look} loop ${lp.kind} ${lp.items.join('+')}`,
        items: lookItems(lp.items.map((k) => L.items[k])),
        in: inF,
        out: outF,
        matte: {layer: panelMatte, type: 'alpha'},
        label: lbl,
        transform: tr,
      });
    }
    // header: top rule wipes in from the left, number/label/tag cut on
    const headerItems = lookItems(L.items, isHeader);
    layers.push({
      kind: 'shape',
      name: `${pre} | ${look} rule`,
      items: headerItems,
      transform: {
        anchor: [0, 0],
        position: [0, 0],
        scale: timing && look === 'live' ? {keys: [{t: inF, v: [0, 100], ease: ruleEase}, {t: inF + WIPE_RULE, v: [100, 100]}]} : [100, 100],
        opacity: fades ? fadeOut() : undefined,
      },
      in: inF,
      out: outF,
      label: lbl,
    });
    L.texts
      .filter((t) => t.y <= TILE.head)
      .forEach((t, k) => layers.push({...withFade(textLayer(t, `${pre} | ${look} head ${k + 1}`)), in: inF, out: outF, label: lbl}));
  }
  return {name: `TILE ${pre}`, width: TILE.w, height: Math.ceil(TILE.h), fps, duration, layers};
}

export type {Num};
