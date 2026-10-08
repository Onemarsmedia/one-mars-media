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
  const WIPE_RULE = 4;
  const WIPE_PANEL = 5;
  const layers: Layer[] = [];
  const panelMatte = `${pre} | panel wipe`;
  const ease: [number, number, number, number] = [0.05, 0.9, 0.12, 1]; // decisive ease-out, no overshoot

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
          ['active', on, off],
        ]
      : [['live', on, undefined]]
    : [['live', 0, undefined]];
  for (const [look, inF, outF] of looks) {
    const L = a[look];
    const lbl = look === 'active' ? 1 : 9;
    layers.push({kind: 'shape', name: `${pre} | ${look} panel`, items: lookItems(L.items, (it) => !isHeader(it)), in: inF, out: outF, matte: {layer: panelMatte, type: 'alpha'}, label: lbl});
    L.texts
      .filter((t) => t.y > TILE.head)
      .forEach((t, k) => layers.push({...textLayer(t, `${pre} | ${look} text ${k + 1}`), in: inF, out: outF, matte: {layer: panelMatte, type: 'alpha'}, label: lbl}));
    // header: top rule wipes in from the left, number/label/tag cut on
    const headerItems = lookItems(L.items, isHeader);
    layers.push({
      kind: 'shape',
      name: `${pre} | ${look} rule`,
      items: headerItems,
      transform: {anchor: [0, 0], position: [0, 0], scale: timing && look === 'live' ? {keys: [{t: inF, v: [0, 100], ease}, {t: inF + WIPE_RULE, v: [100, 100]}]} : [100, 100]},
      in: inF,
      out: outF,
      label: lbl,
    });
    L.texts
      .filter((t) => t.y <= TILE.head)
      .forEach((t, k) => layers.push({...textLayer(t, `${pre} | ${look} head ${k + 1}`), in: inF, out: outF, label: lbl}));
  }
  return {name: `TILE ${pre}`, width: TILE.w, height: Math.ceil(TILE.h), fps, duration, layers};
}

export type {Num};
