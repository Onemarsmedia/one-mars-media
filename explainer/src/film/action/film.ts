import {circlePath, key} from '../../scene/builders';
import type {Bezier, Comp, Key, Layer, ShapeItem, TextLayer, Transform, Vec2, Scene} from '../../scene/types';
import {C, FONT} from '../editorial/tokens';

// "Action taker": Onemarsmedia film no. 4, vertical (9:16), music and text, no voice-over.
// Top: PERFECTIONIST, one frame polished forever (v1 ... v47, the export never finishes).
// Bottom: ACTION TAKER, a 360 studio: thirty glossy blocks (every deliverable of a campaign) drop and stack
// into a wall, each one +12 deg, until the counter reaches 360. Then the line, then the name.

export const FPS = 60;
const W = 1080;
const H = 1920;
const f = (s: number) => Math.round(s * FPS);
export const DURATION = f(19);
const E: Record<'scene' | 'in' | 'out' | 'pop' | 'drop', Bezier> = {
  scene: [0.83, 0, 0.17, 1],
  in: [0.16, 1, 0.3, 1],
  out: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
  drop: [0.55, 0, 0.9, 0.5], // falls, accelerating
};
const BG = '#050505';
const FACE = '#ECE6DA';
const TOP = '#FFFFFF';
const SIDE = '#B9B1A3';
const TXT = '#F4F1EA';
const MUTE = '#8C857A';
const RED = C.red;

const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2], roundness: r},
  fill: {color, opacity},
});
const poly = (pts: Vec2[], color: string, opacity = 100): ShapeItem => ({geo: {type: 'path', path: {v: pts, closed: true}}, fill: {color, opacity}});
const ell = (c: Vec2, rx: number, ry: number, color: string, opacity: number): ShapeItem => ({geo: {type: 'ellipse', size: [rx * 2, ry * 2], center: c}, fill: {color, opacity}});
type FontKey = keyof typeof FONT;
const txt = (name: string, s: string, x: number, y: number, font: FontKey, size: number, color: string, extra: Partial<TextLayer> = {}): TextLayer => ({
  kind: 'text',
  name,
  source: {kind: 'static', text: s},
  font: FONT[font],
  size,
  color,
  transform: {position: [x, y]},
  ...extra,
});
const track = (px: number, size: number) => (px / size) * 1000;
function life(p: Vec2, tin: number, tout?: number, dy = 16, dur = 0.35): Transform {
  const pk: Key<Vec2>[] = [key(f(tin), [p[0], p[1] + dy] as Vec2, E.in), key(f(tin + dur), p)];
  const ok: Key<number>[] = [key(f(tin), 0, 'linear'), key(f(tin + dur * 0.7), 100)];
  if (tout !== undefined) {
    pk.push(key(f(tout), p, E.out), key(f(tout + 0.25), [p[0], p[1] - dy] as Vec2));
    ok.push(key(f(tout), 100, E.out), key(f(tout + 0.25), 0));
  }
  return {position: {keys: pk}, opacity: {keys: ok}};
}
const timed = <L extends Layer>(l: L, tin: number, tout?: number): L => ({...l, in: f(tin), out: tout !== undefined ? f(tout + 0.3) : undefined});

/** A glossy block: front face, lit top face and a shaded side, as seen from slightly above and left. */
function block(w: number, h: number, d: number, accent = false): ShapeItem[] {
  return [
    poly([[0, 0], [d, -d * 0.7], [w + d, -d * 0.7], [w, 0]], accent ? '#FF7A55' : TOP),
    poly([[w, 0], [w + d, -d * 0.7], [w + d, h - d * 0.7], [w, h]], accent ? '#B8341A' : SIDE),
    rect(0, 0, w, h, accent ? RED : FACE, 100, 3),
    rect(4, 4, w - 8, 5, '#FFFFFF', accent ? 30 : 70, 2), // the gloss
  ];
}
/** Soft pool of light (stacked ellipses). */
const glow = (c: Vec2, rx: number, ry: number, op: number): ShapeItem[] => [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((k) => ell(c, rx * k, ry * k, '#FFFFFF', op / 3));

// ------------------------------------------------------------------ top: the perfectionist
const T0 = 0.9; // both start
const T_END = 12.4; // the wall is done
function topComp(): Comp {
  const L: Layer[] = [];
  L.push({kind: 'shape', name: 'top light', items: glow([540, 720], 520, 260, 3)});
  L.push({...txt('PERFECTIONIST', 'PERFECTIONIST', 540, 330, 'sg800', 38, TXT, {justify: 'center', tracking: track(14, 38)}), transform: life([540, 330], 0.25)});
  // the one frame, nudged again and again
  const bw = 440;
  const bh = 250;
  const cx = 540;
  const cy = 640;
  const nudge: Key<number>[] = [key(f(T0), 0, E.pop)];
  const nudgePos: Key<Vec2>[] = [key(f(T0), [cx, cy] as Vec2, E.pop)];
  for (let k = 1, t = T0 + 0.5; t < 13.6; t += 0.55, k++) {
    nudge.push(key(f(t), ((k * 37) % 7) - 3, E.pop));
    nudgePos.push(key(f(t), [cx + (((k * 53) % 9) - 4) * 1.5, cy + (((k * 29) % 5) - 2)] as Vec2, E.pop));
  }
  L.push({
    kind: 'shape',
    name: 'the one frame',
    items: [...block(bw, bh, 34), rect(18, 18, bw - 36, bh - 36, '#0B0B0B', 100, 6), poly([[bw / 2 - 26, bh / 2 - 34], [bw / 2 + 36, bh / 2], [bw / 2 - 26, bh / 2 + 34]], TXT, 80)],
    transform: {anchor: [bw / 2, bh / 2], position: {keys: nudgePos}, rotation: {keys: nudge}, scale: {keys: [key(f(0.4), [80, 80] as Vec2, E.pop), key(f(0.9), [100, 100] as Vec2)]}, opacity: {keys: [key(f(0.4), 0, 'linear'), key(f(0.6), 100)]}},
  });
  L.push({kind: 'shape', name: 'frame reflection', items: [rect(cx - bw / 2, cy + bh / 2 + 22, bw, 90, FACE, 7, 3)], transform: {opacity: {keys: [key(f(0.6), 0, 'linear'), key(f(0.9), 100)]}}});
  // version counter: faster and faster, never done
  const vKeys: Key<string>[] = [key(0, 'v1', 'hold')];
  for (let k = 2; k <= 47; k++) vKeys.push(key(f(T0 + 11.2 * Math.pow((k - 1) / 46, 0.75)), `v${k}`, 'hold'));
  vKeys.push(key(f(13.0), 'v48 · almost ready'));
  L.push({kind: 'text', name: 'version', source: {kind: 'keyed', keys: vKeys}, font: FONT.sg800, size: 44, color: TXT, justify: 'center', transform: life([540, 905], 0.6)});
  // export bar: crawls to the high nineties, falls back, again
  const barX = 290;
  const barW = 500;
  L.push({kind: 'shape', name: 'export track', items: [rect(barX, 950, barW, 10, '#FFFFFF', 12, 5)], transform: {opacity: {keys: [key(f(0.7), 0, 'linear'), key(f(1.0), 100)]}}});
  const fills: Array<[number, number]> = [[T0, 0], [4.2, 0.94], [4.3, 0.58], [7.6, 0.97], [7.7, 0.62], [11.0, 0.98], [11.1, 0.7], [13.6, 0.99]];
  L.push({
    kind: 'shape',
    name: 'export fill',
    items: [rect(barX, 950, barW, 10, TXT, 90, 5)],
    transform: {anchor: [barX, 955], position: [barX, 955], scale: {keys: fills.map(([t, v], i) => key(f(t), [Math.max(0.1, v * 100), 100] as Vec2, i % 2 === 0 ? [0.3, 0, 0.9, 1] : 'linear'))}},
  });
  [4.3, 7.7, 11.1].forEach((t, i) => L.push(timed({...txt(`cancelled ${i + 1}`, 'EXPORT CANCELLED', 540, 1010, 'sg800', 22, RED, {justify: 'center', tracking: track(5, 22)}), transform: life([540, 1010], t, t + 0.9, 6, 0.15)}, t, t + 0.9)));
  return {name: 'TOP', width: W, height: H, fps: FPS, duration: DURATION, layers: L};
}

// ------------------------------------------------------------------ bottom: the action taker (a 360 studio)
const LABELS = ['FILM', 'EDIT', 'MOTION', 'DESIGN', '16:9', '9:16', '1:1', 'SOCIAL', 'PODCAST', 'WEB', 'APPS', 'ADS', 'CUTDOWNS', 'CAPTIONS', 'STILLS', 'REELS', 'SHORTS', 'STORIES', 'THUMBNAILS', 'BTS', 'SOUND', 'GRADE', 'COPY', 'LAUNCH', 'EMAIL', 'DECK', 'EVENTS', 'LOOPS', 'OOH', 'DISTRIBUTION'];
const COLS = 6;
const BW = 128;
const BH = 58;
const GAP = 8;
const FLOOR = 1650;
const WX0 = (W - (COLS * BW + (COLS - 1) * GAP)) / 2 - 10;
const dropT = (i: number) => T0 + 0.3 + i * 0.37;
function bottomComp(): Comp {
  const L: Layer[] = [];
  L.push({kind: 'shape', name: 'floor light', items: glow([540, FLOOR], 560, 120, 3)});
  L.push({...txt('ACTION TAKER', 'ACTION TAKER', 540, 1150, 'sg800', 38, TXT, {justify: 'center', tracking: track(14, 38)}), transform: life([540, 1150], 0.35)});
  LABELS.forEach((label, i) => {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = WX0 + c * (BW + GAP) + (r % 2 ? 22 : 0); // brick bond
    const y = FLOOR - BH - r * (BH + GAP);
    const t = dropT(i);
    const accent = i % 7 === 3;
    L.push(
      timed(
        {
          kind: 'shape',
          name: `block ${String(i + 1).padStart(2, '0')} ${label}`,
          items: block(BW, BH, 18, accent),
          transform: {anchor: [BW / 2, BH], position: {keys: [key(f(t - 0.28), [x + BW / 2, y + BH - 300] as Vec2, E.drop), key(f(t), [x + BW / 2, y + BH] as Vec2)]}, scale: {keys: [key(f(t), [104, 90] as Vec2, E.pop), key(f(t + 0.22), [100, 100] as Vec2)]}, opacity: {keys: [key(f(t - 0.28), 0, 'linear'), key(f(t - 0.18), 100)]}},
        },
        t - 0.28,
      ),
    );
    L.push(timed({...txt(`block ${i + 1} label`, label, x + BW / 2, y + BH / 2 + 7, 'sg800', label.length > 9 ? 11 : 14, accent ? '#FFFFFF' : '#1A1917', {justify: 'center', tracking: track(1.5, 16)}), transform: {position: {keys: [key(f(t - 0.28), [x + BW / 2, y + BH / 2 + 7 - 300] as Vec2, E.drop), key(f(t), [x + BW / 2, y + BH / 2 + 7] as Vec2)]}, opacity: {keys: [key(f(t - 0.28), 0, 'linear'), key(f(t - 0.18), 100)]}}}, t - 0.28));
    if (r === 0) L.push(timed({kind: 'shape', name: `reflection ${i + 1}`, items: [rect(x, FLOOR + 10, BW, 40, accent ? RED : FACE, 9, 3)], transform: {opacity: {keys: [key(f(t), 0, 'linear'), key(f(t + 0.2), 100)]}}}, t));
  });
  // the counter: +12 deg per block, a full turn at the last one
  const deg: Key<number>[] = [key(0, 0, 'hold')];
  LABELS.forEach((_, i) => deg.push(key(f(dropT(i)), (i + 1) * 12, 'hold')));
  L.push({kind: 'text', name: 'degrees', source: {kind: 'counter', value: {keys: deg}, pad: 1, suffix: '°'}, font: FONT.anton, size: 120, color: TXT, justify: 'right', transform: life([960, 1268], 0.7)});
  L.push({...txt('shipped label', 'SHIPPED', 960, 1298, 'sg800', 18, MUTE, {justify: 'right', tracking: track(5, 18)}), transform: life([960, 1298], 0.8)});
  // ring around the counter closes as it fills
  L.push({kind: 'shape', name: 'ring', items: [{geo: {type: 'path', path: circlePath(170, 1232, 40)}, stroke: {color: RED, width: 9, cap: 'round'}, trim: {end: {keys: [key(0, 0, 'hold'), ...LABELS.map((_, i) => key(f(dropT(i)), ((i + 1) * 100) / 30, i < LABELS.length - 1 ? E.in : undefined))]}}}], transform: {opacity: {keys: [key(f(0.8), 0, 'linear'), key(f(1.1), 100)]}}});
  return {name: 'BOTTOM', width: W, height: H, fps: FPS, duration: DURATION, layers: L};
}

// ------------------------------------------------------------------ main
export function buildActionScene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  add(topComp());
  add(bottomComp());
  const L: Layer[] = [];
  const dim = (t: number) => ({keys: [key(f(t), 100, E.out), key(f(t + 0.5), 0)]});
  // the two halves, pushed in slowly; they give way to the line
  L.push({kind: 'precomp', name: 'TOP', comp: 'TOP', collapse: true, transform: {anchor: [540, 960], position: [540, 960], scale: {keys: [key(0, [100, 100] as Vec2, 'linear'), key(f(13.8), [104, 104] as Vec2)]}, opacity: dim(13.8)}, out: f(14.4)});
  L.push({kind: 'precomp', name: 'BOTTOM', comp: 'BOTTOM', collapse: true, transform: {anchor: [540, 960], position: [540, 960], scale: {keys: [key(0, [100, 100] as Vec2, 'linear'), key(f(T_END), [102, 102] as Vec2, E.pop), key(f(T_END + 0.3), [104, 104] as Vec2, 'linear'), key(f(13.8), [104, 104] as Vec2)]}, opacity: dim(13.8)}, out: f(14.4)});
  L.push({kind: 'shape', name: 'divider', items: [rect(140, 1078, 800, 2, '#FFFFFF', 14)], transform: {anchor: [540, 1079], position: [540, 1079], scale: {keys: [key(f(0.2), [0, 100] as Vec2, E.in), key(f(0.8), [100, 100] as Vec2, 'linear'), key(f(13.8), [100, 100] as Vec2, E.out), key(f(14.2), [0, 100] as Vec2)]}}, out: f(14.3)});
  // the line, one thought at a time
  const lines: Array<[string, number, number, string]> = [
    ['One team.', 14.3, 860, TXT],
    ['The whole campaign.', 14.75, 960, TXT],
    ['Shipped.', 15.25, 1060, RED],
  ];
  lines.forEach(([s, t, y, col]) => L.push(timed({...txt(`line ${s}`, s, 540, y, 'sg800', 78, col, {justify: 'center', tracking: track(-2, 78)}), transform: life([540, y], t, 16.6, 20, 0.35)}, t, 16.6)));
  // the name
  L.push(timed({...txt('wordmark', 'Onemarsmedia', 540, 960, 'sg800', 112, TXT, {justify: 'center', tracking: track(-3, 112)}), transform: life([540, 960], 16.9, undefined, 24, 0.5)}, 16.9));
  L.push(timed({...txt('descriptor', '360 PRODUCTION STUDIO · LONDON', 540, 1030, 'sg800', 24, MUTE, {justify: 'center', tracking: track(6, 24)}), transform: life([540, 1030], 17.2, undefined, 10, 0.4)}, 17.2));
  L.push(timed({kind: 'shape', name: 'ring end', items: [{geo: {type: 'path', path: circlePath(540, 760, 44)}, stroke: {color: RED, width: 10, cap: 'round'}, trim: {end: {keys: [key(f(16.8), 0, E.scene), key(f(17.6), 100)]}}}]}, 16.8));
  L.push(timed({...txt('url', 'onemarsmedia.com', 540, 1100, 'sg600', 30, TXT, {justify: 'center'}), transform: life([540, 1100], 17.5, undefined, 8, 0.4)}, 17.5));
  // watermark: two lines in 9:16, above the bottom caption zone
  L.push({kind: 'shape', name: 'watermark band', items: [rect(0, H - 214, W, 110, BG, 70)], label: 16});
  L.push({...txt('watermark 1', 'Directed & produced by Marek Mars', 540, H - 168, 'sg600', 26, TXT, {justify: 'center'}), transform: {position: [540, H - 168], opacity: 85}, label: 16});
  L.push({...txt('watermark 2', 'Onemarsmedia Limited · onemarsmedia.com', 540, H - 128, 'sg600', 26, TXT, {justify: 'center'}), transform: {position: [540, H - 128], opacity: 85}, label: 16});
  const main: Comp = {name: 'Action taker', width: W, height: H, fps: FPS, duration: DURATION, bg: BG, motionBlur: {shutterAngle: 180, samples: 6}, layers: L};
  add(main);
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    ...LABELS.map((_, i) => ({file: 'tap.wav', t: dropT(i), gainDb: -31})),
    ...[4.3, 7.7, 11.1].map((t) => ({file: 'flap.wav', t, gainDb: -32})),
    {file: 'lock.wav', t: T_END, gainDb: -24},
    {file: 'whoosh.wav', t: 13.9, gainDb: -30},
    ...[14.3, 14.75, 15.25].map((t) => ({file: 'tap.wav', t, gainDb: -28})),
    {file: 'tap.wav', t: 16.9, gainDb: -26},
  ];
}
