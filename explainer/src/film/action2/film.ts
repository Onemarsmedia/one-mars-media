import {circlePath, key} from '../../scene/builders';
import type {Bezier, Comp, Key, Layer, Scene, ShapeItem, TextLayer, Transform, Vec2} from '../../scene/types';
import {cardShadow} from '../editorial/shadows';
import {C, FONT} from '../editorial/tokens';
import vo from './vo.json';

// "Action taker" v2 (9:16): the perfectionist polishes v47 at the top while, below, a wall of real
// Onemarsmedia work drops in block by block (each block a still from a real shoot), the degree count
// climbs to 360 and the through-line frames the finished wall. Proof, then the sign-off.
// Master blueprint v1.3: VO (Paul), word-by-word captions above a two-line watermark, dark palette.

export const FPS = 60;
const W = 1080;
const H = 1920;
const f = (s: number) => Math.round(s * FPS);
const E: Record<'scene' | 'in' | 'out' | 'pop' | 'drop', Bezier> = {
  scene: [0.83, 0, 0.17, 1],
  in: [0.16, 1, 0.3, 1],
  out: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
  drop: [0.55, 0, 0.9, 0.5], // falls, accelerating
};
const BG = C.ink;
const CARD = '#1D1B19';
const TXT = C.paper;
const MUTE = '#9A9286';
const RED = C.red;

// ------------------------------------------------------------------ timing (edited VO, film time)
type Chunk = {text: string; start: number; end: number};
const ch = (vo as {chunks: Chunk[]}).chunks;
const words = (vo as {words: Array<{text: string; start: number; end: number}>}).words;
const T = {
  polish: ch[0].start,
  ship: ch[1].start,
  plan: ch[2].start,
  shoot: ch[3].start,
  cut: ch[4].start,
  animate: ch[5].start,
  out: ch[6].start,
  years: ch[7].start,
  vogue: ch[8].start,
  adidas: ch[9].start,
  asos: ch[10].start,
  stop: ch[11].start,
  start: ch[12].start,
  name: ch[13].start,
  end: ch[13].end,
};
export const DURATION = f(Math.ceil(T.end + 3.2));

// ------------------------------------------------------------------ builders
const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2], roundness: r},
  fill: {color, opacity},
});
const frame = (x: number, y: number, w: number, h: number, color: string, width: number, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2], roundness: r},
  stroke: {color, width, opacity},
});
const dot = (c: Vec2, r: number, color: string, opacity = 100): ShapeItem => ({geo: {type: 'path', path: circlePath(c[0], c[1], r)}, fill: {color, opacity}});
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
/** Rise + fade in at tin, optionally out at tout. */
function life(p: Vec2, tin: number, tout?: number, dy = 16, dur = 0.45): Transform {
  const pk: Key<Vec2>[] = [key(f(tin), [p[0], p[1] + dy] as Vec2, E.in), key(f(tin + dur), p)];
  const ok: Key<number>[] = [key(f(tin), 0, 'linear'), key(f(tin + dur * 0.7), 100)];
  if (tout !== undefined) {
    pk.push(key(f(tout), p, E.out), key(f(tout + 0.3), [p[0], p[1] - dy] as Vec2));
    ok.push(key(f(tout), 100, E.out), key(f(tout + 0.3), 0));
  }
  return {position: {keys: pk}, opacity: {keys: ok}};
}
const timed = <L extends Layer>(l: L, tin: number, tout?: number): L => ({...l, in: f(tin), out: tout !== undefined ? f(tout + 0.35) : undefined});

// ------------------------------------------------------------------ layout
const SPLIT = 770; // the through-line between the two halves
const TW = 222;
const TH = 214;
const G = 12;
const X0 = 78;
const Y0 = 880;
/** The wall fills from the floor up: bottom row first, left to right. */
const slot = (i: number): Vec2 => {
  const r = 2 - Math.floor(i / 4);
  const c = i % 4;
  return [X0 + c * (TW + G) + TW / 2, Y0 + r * (TH + G) + TH / 2];
};
const TILES = [
  {label: 'PLAN', t: T.plan + 0.1},
  {label: 'RECCE', t: T.plan + 0.42},
  {label: 'CREW', t: T.plan + 0.72},
  {label: 'SHOOT', t: T.shoot + 0.1},
  {label: 'BTS', t: T.shoot + 0.38},
  {label: 'DIRECT', t: T.shoot + 0.64},
  {label: 'EDIT', t: T.cut + 0.08},
  {label: 'MOTION', t: T.animate + 0.12},
  {label: 'SOUND', t: T.animate + 0.45},
  {label: 'HERO', t: T.out + 0.08},
  {label: 'SOCIAL', t: T.out + 0.36},
  {label: 'DELIVER', t: T.out + 0.66},
];
const FOCUS = 7; // MOTION: lift & focus with a callout
const tFocus = TILES[FOCUS].t + 0.1;
const tUnfocus = TILES[FOCUS + 1].t - 0.05;
const tDone = TILES[TILES.length - 1].t + 0.15; // 360
const tProofOut = T.stop - 0.35;

// ------------------------------------------------------------------ one tile: a real still, rounded, with a label and a shadow
function tileComp(label: string): Comp {
  const chipW = 20 + label.length * 10.6;
  return {
    name: `TILE ${label}`,
    width: TW,
    height: TH,
    fps: FPS,
    duration: DURATION,
    layers: [
      {kind: 'shape', name: 'shadow', items: cardShadow(TW, TH, 12, 55, 3), transform: {position: [0, 10]}},
      {kind: 'shape', name: 'matte', matteSource: true, items: [rect(0, 0, TW, TH, '#FFFFFF', 100, 12)]},
      // the stills are 480 x 480: fit the width, centre vertically (the matte trims the rest)
      {kind: 'image', name: 'still', file: `footage/action-v2/${label}.jpg`, width: 480, height: 480, matte: {layer: 'matte', type: 'alpha'}, transform: {anchor: [240, 240], position: [TW / 2, TH / 2], scale: [(TW / 480) * 100, (TW / 480) * 100]}},
      {kind: 'shape', name: 'edge', items: [frame(0.75, 0.75, TW - 1.5, TH - 1.5, TXT, 1.5, 12, 12)]},
      {kind: 'shape', name: 'chip', items: [rect(10, 10, chipW, 28, BG, 78, 6)]},
      txt('label', label, 19, 30, 'sg800', 14, TXT, {tracking: track(2, 14)}),
    ],
  };
}

function wallLayers(): Layer[] {
  const L: Layer[] = [];
  // empty slots: where the wall will stand
  const slots: ShapeItem[] = TILES.map((_, i) => {
    const [cx, cy] = slot(i);
    return {geo: {type: 'rect', size: [TW, TH], center: [cx, cy], roundness: 12}, stroke: {color: TXT, width: 2, opacity: 12, dash: [10, 8]}};
  });
  L.push({kind: 'shape', name: 'slots', items: slots, transform: {opacity: {keys: [key(0, 100, 'linear'), key(f(tDone - 0.3), 100, E.out), key(f(tDone), 0)]}}, out: f(tDone) + 1});
  TILES.forEach((tile, i) => {
    const p = slot(i);
    const t = tile.t;
    const side = i % 2 ? 1 : -1;
    const isFocus = i === FOCUS;
    // dim while MOTION is in focus, then everything dims under the end card
    const op: Key<number>[] = [key(f(t - 0.34), 0, 'linear'), key(f(t - 0.22), 100, 'linear')];
    if (!isFocus && t < tFocus) op.push(key(f(tFocus), 100, E.scene), key(f(tFocus + 0.25), 38, 'linear'), key(f(tUnfocus), 38, E.scene), key(f(tUnfocus + 0.3), 100, 'linear'));
    op.push(key(f(tProofOut), 100, E.scene), key(f(tProofOut + 0.6), 30));
    const sc: Key<Vec2>[] = [key(f(t - 0.34), [104, 104] as Vec2, 'linear'), key(f(t), [104, 104] as Vec2, E.pop), key(f(t + 0.25), [100, 100] as Vec2, 'linear')];
    if (isFocus) sc.push(key(f(tFocus), [100, 100] as Vec2, E.pop), key(f(tFocus + 0.35), [108, 108] as Vec2, 'linear'), key(f(tUnfocus), [108, 108] as Vec2, E.scene), key(f(tUnfocus + 0.3), [100, 100] as Vec2));
    L.push({
      kind: 'precomp',
      name: `TILE ${tile.label}`,
      comp: `TILE ${tile.label}`,
      collapse: true,
      transform: {
        anchor: [TW / 2, TH / 2],
        position: {keys: [key(f(t - 0.34), [p[0] + side * 18, p[1] - 250] as Vec2, E.drop), key(f(t), p, E.out), key(f(t + 0.06), [p[0], p[1] + 5] as Vec2, E.in), key(f(t + 0.22), p)]},
        rotation: {keys: [key(f(t - 0.34), side * 7, 'linear'), key(f(t), 0)]},
        scale: {keys: sc},
        opacity: {keys: op},
      },
      in: f(t - 0.34),
      label: 9,
    });
  });
  // the focus frame + callout on MOTION
  const [fx, fy] = slot(FOCUS);
  const fw = TW * 1.08;
  const fh = TH * 1.08;
  L.push(timed({kind: 'shape', name: 'focus frame', items: [frame(fx - fw / 2, fy - fh / 2, fw, fh, RED, 3, 100, 13)], transform: {opacity: {keys: [key(f(tFocus + 0.1), 0, 'linear'), key(f(tFocus + 0.3), 100, 'linear'), key(f(tUnfocus), 100, E.out), key(f(tUnfocus + 0.2), 0)]}}}, tFocus + 0.1, tUnfocus));
  const cTop = fy - fh / 2;
  L.push(timed({kind: 'shape', name: 'callout line', items: [{geo: {type: 'path', path: {v: [[fx, cTop - 4], [fx, cTop - 96]], closed: false}}, stroke: {color: RED, width: 3, cap: 'round'}, trim: {start: 0, end: {keys: [key(f(tFocus + 0.15), 0, E.in), key(f(tFocus + 0.45), 100)]}}}, dot([fx, cTop - 102], 7, RED)], transform: {opacity: {keys: [key(f(tUnfocus), 100, E.out), key(f(tUnfocus + 0.2), 0)]}}}, tFocus + 0.15, tUnfocus));
  L.push(timed({...txt('callout', 'Animated\nin-house.', fx - 26, cTop - 112, 'sg700', 32, TXT, {justify: 'right', leading: 38}), transform: life([fx - 26, cTop - 112], tFocus + 0.35, tUnfocus - 0.1, 8, 0.35)}, tFocus + 0.35, tUnfocus - 0.1));
  // 360: the through-line draws a frame around the finished wall
  const wx = X0 - 14;
  const wy = Y0 - 14;
  const ww = 4 * TW + 3 * G + 28;
  const wh = 3 * TH + 2 * G + 28;
  const r = 18;
  const pts: Vec2[] = [[wx + ww, wy + wh / 2], [wx + ww, wy + r], [wx + ww - r * 0.3, wy + r * 0.3], [wx + ww - r, wy], [wx + r, wy], [wx + r * 0.3, wy + r * 0.3], [wx, wy + r], [wx, wy + wh - r], [wx + r * 0.3, wy + wh - r * 0.3], [wx + r, wy + wh], [wx + ww - r, wy + wh], [wx + ww - r * 0.3, wy + wh - r * 0.3], [wx + ww, wy + wh - r], [wx + ww, wy + wh / 2]];
  L.push({
    kind: 'shape',
    name: 'wall frame',
    items: [{geo: {type: 'path', path: {v: pts, closed: false}}, stroke: {color: RED, width: 4, cap: 'round', join: 'round'}, trim: {start: 0, end: {keys: [key(f(tDone - 0.1), 0, E.scene), key(f(tDone + 0.8), 100)]}}}],
    transform: {opacity: {keys: [key(f(tProofOut), 100, E.scene), key(f(tProofOut + 0.6), 35)]}},
    in: f(tDone - 0.1),
    label: 1,
  });
  return L;
}

// ------------------------------------------------------------------ the perfectionist (top half)
function topLayers(): Layer[] {
  const L: Layer[] = [];
  const WX = 80;
  const WY = 196;
  const WW = 920;
  const WH = 540;
  const tOut = T.years - 0.4; // the editor leaves for the proof
  const dimKeys: Key<number>[] = [key(0, 100, 'linear'), key(f(T.ship + 0.95), 100, E.scene), key(f(T.ship + 1.4), 45, 'linear'), key(f(T.cut), 45, E.scene), key(f(T.cut + 0.5), 30, 'linear'), key(f(tOut), 30, E.out), key(f(tOut + 0.4), 0)];
  const editor = (l: Layer): Layer => ({...l, parent: 'EDITOR', out: f(tOut + 0.45)});
  L.push({kind: 'null', name: 'EDITOR', transform: {anchor: [0, 0], position: {keys: [key(f(tOut), [0, 0] as Vec2, E.out), key(f(tOut + 0.45), [0, -60] as Vec2)]}}, out: f(tOut + 0.45), label: 2});
  L.push(editor({kind: 'shape', name: 'window', items: [rect(WX, WY, WW, WH, CARD, 100, 22), frame(WX, WY, WW, WH, TXT, 1.5, 12, 22), rect(WX, WY + 72, WW, 1.5, TXT, 10)], transform: {opacity: {keys: dimKeys}}}));
  L.push(editor({...txt('file name', 'Launch_film_FINAL.prproj', WX + 30, WY + 45, 'sg700', 22, TXT), transform: {position: [WX + 30, WY + 45], opacity: {keys: dimKeys}}}));
  // the version pill counts up while he polishes: v1 ... v47, then v48 later
  const vk: Key<string>[] = [];
  const t0 = 0.3;
  const t1 = T.polish + 2.1;
  for (let n = 1; n <= 47; n++) vk.push(key(f(t0 + (t1 - t0) * Math.pow((n - 1) / 46, 0.7)), `v${n}`, 'hold'));
  vk.push(key(f(T.shoot), 'v48', 'hold'));
  L.push(editor({kind: 'shape', name: 'version pill', items: [rect(WX + WW - 112, WY + 18, 86, 36, RED, 100, 18)], transform: {opacity: {keys: dimKeys}}}));
  L.push(editor({kind: 'text', name: 'version', source: {kind: 'keyed', keys: vk}, font: FONT.sg800, size: 20, color: '#FFFFFF', justify: 'center', transform: {position: [WX + WW - 69, WY + 43], opacity: {keys: dimKeys}}}));
  // viewer: one frame block nudged a pixel left, a pixel right, forever
  L.push(editor({kind: 'shape', name: 'viewer', items: [rect(WX + 30, WY + 96, WW - 60, 250, '#0B0A09', 100, 12)], transform: {opacity: {keys: dimKeys}}}));
  const nudge: Key<Vec2>[] = [];
  for (let t = 0.4, k = 0; t < tOut; t += 0.55, k++) nudge.push(key(f(t), [k % 2 ? 4 : -4, 0] as Vec2, E.scene));
  L.push(editor({kind: 'shape', name: 'frame block', items: [frame(WX + 350, WY + 141, 220, 160, TXT, 3, 100, 6)], transform: {anchor: [0, 0], position: {keys: nudge}, opacity: {keys: dimKeys}}}));
  const blink = (phase: number): Key<number>[] => {
    const k: Key<number>[] = [];
    for (let t = 0.4, i = 0; t < tOut; t += 0.55, i++) k.push(key(f(t), (i + phase) % 2 ? 100 : 25, 'hold'));
    return k;
  };
  L.push(editor({...txt('nudge left', '← 1 px', WX + 190, WY + 230, 'sg800', 22, RED), transform: {position: [WX + 190, WY + 230], opacity: {keys: blink(0)}}, out: f(T.ship + 1.0)}));
  L.push(editor({...txt('nudge right', '→ 1 px', WX + 620, WY + 230, 'sg800', 22, RED), transform: {position: [WX + 620, WY + 230], opacity: {keys: blink(1)}}, out: f(T.ship + 1.0)}));
  // the timeline row and the status line
  const clips: ShapeItem[] = [[0, 180], [188, 240], [436, 90], [534, 200]].map(([x, w], i) => rect(WX + 30 + x, WY + 368, w, 44, i === 2 ? RED : '#2D2A26', 100, 6));
  L.push(editor({kind: 'shape', name: 'clips', items: clips, transform: {opacity: {keys: dimKeys}}}));
  const tExp = T.ship - 0.45;
  L.push(editor({kind: 'text', name: 'status', source: {kind: 'keyed', keys: [key(0, 'Tweaking the kerning. Again.', 'hold'), key(f(tExp), 'Exporting… 99%', 'hold'), key(f(T.shoot), 'Tweaking the kerning. Again.', 'hold')]}, font: FONT.sg600, size: 24, color: MUTE, transform: {position: [WX + 30, WY + 470], opacity: {keys: dimKeys}}}));
  // export: fills to 99 % on "Some people ship" ... and is cancelled
  L.push(editor({kind: 'shape', name: 'export track', items: [rect(WX + 30, WY + 494, WW - 60, 12, TXT, 10, 6)], transform: {opacity: {keys: dimKeys}}, in: f(tExp), out: f(T.shoot)}));
  L.push(editor({kind: 'shape', name: 'export bar', items: [rect(0, 0, WW - 60, 12, RED, 100, 6)], transform: {anchor: [0, 0], position: [WX + 30, WY + 494], scale: {keys: [key(f(tExp), [0, 100] as Vec2, [0.2, 0.6, 0.35, 1]), key(f(T.ship + 0.8), [99, 100] as Vec2)]}, opacity: {keys: dimKeys}}, in: f(tExp), out: f(T.shoot)}));
  const tStamp = T.ship + 1.0;
  L.push({
    kind: 'shape',
    name: 'stamp',
    items: [rect(-300, -56, 600, 112, BG, 85, 10), frame(-300, -56, 600, 112, RED, 5, 100, 10)],
    transform: {anchor: [0, 0], position: [WX + WW / 2, WY + 300], rotation: -7, scale: {keys: [key(f(tStamp), [150, 150] as Vec2, E.pop), key(f(tStamp + 0.3), [100, 100] as Vec2)]}, opacity: {keys: [key(f(tStamp), 0, 'linear'), key(f(tStamp + 0.08), 100, 'linear'), key(f(T.cut), 100, E.out), key(f(T.cut + 0.4), 0)]}},
    in: f(tStamp),
    out: f(T.cut + 0.45),
  });
  L.push({
    ...txt('stamp text', 'EXPORT CANCELLED', 0, 20, 'sg800', 56, RED, {justify: 'center', tracking: track(3, 56)}),
    parent: 'stamp',
    transform: {position: [0, 20]},
    in: f(tStamp),
    out: f(T.cut + 0.45),
  });
  L.push({...txt('label top', 'THE PERFECTIONIST', 80, 168, 'sg800', 22, MUTE, {tracking: track(4, 22)}), transform: {position: [80, 168], opacity: {keys: [key(f(tOut), 100, E.out), key(f(tOut + 0.4), 0)]}}, out: f(tOut + 0.45)});
  return L;
}

// ------------------------------------------------------------------ proof (top half, after the editor)
function proofLayers(): Layer[] {
  const L: Layer[] = [];
  const x = 90;
  const out = tProofOut;
  L.push(timed({kind: 'text', name: 'years', source: {kind: 'counter', value: {keys: [key(f(T.years), 0, [0.25, 0.1, 0.25, 1]), key(f(T.years + 1.3), 13)]}, pad: 1}, font: FONT.anton, size: 380, color: TXT, transform: life([x - 8, 470], T.years - 0.05, out, 24, 0.55)}, T.years - 0.05, out));
  L.push(timed({...txt('years label', 'years of UK production', x, 548, 'sg700', 48, TXT), transform: life([x, 548], T.years + 0.35, out, 14, 0.5)}, T.years + 0.35, out));
  L.push(timed({...txt('brands label', 'FOR BRANDS LIKE', x, 640, 'sg800', 20, MUTE, {tracking: track(3, 20)}), transform: life([x, 640], T.vogue - 0.2, out, 10, 0.45)}, T.vogue - 0.2, out));
  const brands: Array<[string, number, number]> = [
    ['Vogue Arabia', x, T.vogue],
    ['Adidas', x + 400, T.adidas],
    ['ASOS', x + 630, T.asos],
  ];
  brands.forEach(([s, bx, t], i) => {
    L.push(timed({...txt(`brand ${s}`, s, bx, 712, 'sg700', 52, TXT), transform: life([bx, 712], t - 0.05, out, 14, 0.45)}, t - 0.05, out));
    if (i > 0) L.push(timed({kind: 'shape', name: `brand dot ${i}`, items: [dot([bx - 22, 694], 6, RED)], transform: life([0, 0], t, out, 0, 0.3)}, t, out));
  });
  return L;
}

// ------------------------------------------------------------------ sign-off
function endLayers(): Layer[] {
  const L: Layer[] = [];
  const cx = W / 2;
  L.push(timed({...txt('stop', 'Stop polishing.', cx, 560, 'sg800', 92, TXT, {justify: 'center', tracking: track(-2, 92)}), transform: life([cx, 560], T.stop - 0.05, T.name - 0.35, 20, 0.5)}, T.stop - 0.05, T.name - 0.35));
  L.push(timed({...txt('start', 'Start shipping.', cx, 670, 'sg800', 92, RED, {justify: 'center', tracking: track(-2, 92)}), transform: life([cx, 670], T.start - 0.05, T.name - 0.35, 20, 0.5)}, T.start - 0.05, T.name - 0.35));
  const NW = 921.6; // "Onemarsmedia", sg800 124 px, -2.5 px tracking
  L.push(timed({...txt('wordmark', 'Onemarsmedia', cx, 560, 'sg800', 124, TXT, {justify: 'center', tracking: track(-3, 150)}), transform: life([cx, 560], T.name - 0.1, undefined, 24, 0.6)}, T.name - 0.1));
  L.push({kind: 'shape', name: 'wordmark line', items: [{geo: {type: 'path', path: {v: [[cx - NW / 2 + 6, 604], [cx + NW / 2 - 30, 604]], closed: false}}, stroke: {color: RED, width: 4, cap: 'round'}, trim: {start: {keys: [key(f(T.name + 0.05), 50, E.scene), key(f(T.name + 0.9), 0)]}, end: {keys: [key(f(T.name + 0.05), 50, E.scene), key(f(T.name + 0.9), 100)]}}}], in: f(T.name + 0.05), label: 1});
  L.push(timed({...txt('studio', '360 PRODUCTION STUDIO · LONDON', cx, 680, 'sg800', 22, MUTE, {justify: 'center', tracking: track(4, 22)}), transform: life([cx, 680], T.name + 0.5, undefined, 10, 0.45)}, T.name + 0.5));
  L.push(timed({...txt('url', 'onemarsmedia.com', cx, 1640, 'sg600', 34, MUTE, {justify: 'center'}), transform: life([cx, 1640], T.name + 0.8, undefined, 10, 0.45)}, T.name + 0.8));
  return L;
}

// ------------------------------------------------------------------ captions (word by word, above the watermark)
const scriptText = `Some people polish version forty-seven.
Some people ship.
We plan it. Shoot it. Cut it. Animate it. And put it out.
Thirteen years of UK production. Vogue Arabia. Adidas. ASOS.
Stop polishing. Start shipping. Onemarsmedia.`; // assets/audio/action2/script.txt
// off from "Thirteen years" on: the screen says it
const CAPTION_GROUPS = [[0], [1], [2, 3], [4, 5], [6]];
function captionLayers(): Layer[] {
  const tokens = scriptText.split(/\s+/).filter(Boolean);
  if (tokens.length !== words.length) throw new Error(`captions: ${tokens.length} script words vs ${words.length} aligned`);
  const inChunk = (c: Chunk) => words.map((w, i) => ({w, tok: tokens[i]})).filter(({w}) => w.start >= c.start - 0.02 && w.start < c.end - 0.01);
  const keys: Key<string>[] = [key(0, '', 'hold')];
  const band: Key<number>[] = [key(0, 0, 'hold')];
  CAPTION_GROUPS.forEach((g, gi) => {
    const ws = g.flatMap((ci) => inChunk(ch[ci]));
    const full = ws.map((x) => x.tok).join(' ');
    let brk = ws.length;
    if (full.length > 22) {
      let best = 1;
      const len = (k: number) => ws.slice(0, k).map((x) => x.tok).join(' ').length;
      for (let k = 1; k < ws.length; k++) if (Math.abs(len(k) - full.length / 2) < Math.abs(len(best) - full.length / 2)) best = k;
      brk = best;
    }
    ws.forEach((x, k) => keys.push(key(f(x.w.start) - 2, ws.slice(0, k + 1).map((y, j) => (j === brk ? '\n' : j > 0 ? ' ' : '') + y.tok).join(''), 'hold')));
    const last = ch[g[g.length - 1]];
    const nextG = CAPTION_GROUPS[gi + 1];
    const tEnd = nextG ? Math.min(last.end + 0.45, ch[nextG[0]].start - 0.02) : last.end + 0.45;
    keys.push(key(f(tEnd), '', 'hold'));
    band.push(key(f(ws[0].w.start) - 2, 100, 'hold'), key(f(tEnd), 0, 'hold'));
  });
  const y = 1650;
  return [
    {kind: 'shape', name: 'caption band', items: [rect(0, y - 66, W, 146, BG, 60)], transform: {opacity: {keys: band}}, label: 16},
    {kind: 'text', name: 'captions', source: {kind: 'keyed', keys}, font: FONT.sg800, size: 50, color: TXT, justify: 'center', leading: 60, transform: {position: [W / 2, y]}, label: 16},
  ];
}

// ------------------------------------------------------------------ main
export function buildAction2Scene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  TILES.forEach((t) => add(tileComp(t.label)));
  const L: Layer[] = [];

  // background: a fine dot grid drifting (never a dead background)
  const dots: ShapeItem[] = [];
  for (let y = -48; y < H + 96; y += 48) for (let x = -48; x < W + 96; x += 48) dots.push({geo: {type: 'ellipse', size: [3, 3], center: [x, y]}, fill: {color: TXT, opacity: 9}});
  L.push({kind: 'shape', name: 'dot grid', items: dots, transform: {anchor: [0, 0], position: {keys: [key(0, [0, 0] as Vec2, 'linear'), key(DURATION - 1, [-48, -32] as Vec2)]}}, label: 16});

  // camera: slow pushes on the held beats, settles on each change (scale about the centre)
  const cams: Array<[number, number]> = [[0, 100], [T.ship + 0.9, 103], [T.ship + 1.3, 100], [tDone, 102.5], [T.years - 0.3, 100], [tProofOut, 103], [tProofOut + 0.5, 100], [DURATION / FPS, 104]];
  L.push({kind: 'null', name: 'CAMERA', transform: {anchor: [W / 2, H / 2], position: [W / 2, H / 2], scale: {keys: cams.map(([t, z], i) => key(f(t), [z, z] as Vec2, i < cams.length - 1 ? E.scene : undefined))}}, label: 2});
  const cam = (l: Layer): Layer => ({...l, parent: l.parent ?? 'CAMERA'});

  // the through-line between the halves: draws in from the left, a glowing dot at its tip
  L.push(cam({kind: 'shape', name: 'line split', items: [{geo: {type: 'path', path: {v: [[-20, SPLIT], [W + 20, SPLIT]], closed: false}}, stroke: {color: RED, width: 4, cap: 'round'}, trim: {start: 0, end: {keys: [key(0, 0, E.scene), key(f(0.9), 100)]}}}], transform: {opacity: {keys: [key(f(tProofOut), 100, E.scene), key(f(tProofOut + 0.5), 0)]}}, out: f(tProofOut + 0.55), label: 1}));
  L.push(cam({kind: 'shape', name: 'line tip', items: [dot([0, 0], 16, RED, 22), dot([0, 0], 6.5, '#FFD9CC')], transform: {anchor: [0, 0], position: {keys: [key(0, [-20, SPLIT] as Vec2, E.scene), key(f(0.9), [W + 20, SPLIT] as Vec2)]}}, out: f(1), label: 1}));
  L.push(cam({...txt('label bottom', 'THE ACTION TAKER', 80, 812, 'sg800', 22, RED, {tracking: track(4, 22)}), transform: {position: [80, 812], opacity: {keys: [key(f(tProofOut), 100, E.out), key(f(tProofOut + 0.4), 0)]}}, out: f(tProofOut + 0.45)}));

  // degrees: +30 per block landed, the ring closes at 360
  const dk: Key<number>[] = [key(0, 0, 'hold'), ...TILES.map((t, i) => key(f(t.t), (i + 1) * 30, 'hold'))];
  const degOp = {keys: [key(f(tProofOut), 100, E.out), key(f(tProofOut + 0.4), 0)]};
  L.push(cam({kind: 'text', name: 'degrees', source: {kind: 'counter', value: {keys: dk}, pad: 1}, font: FONT.anton, size: 96, color: TXT, justify: 'right', transform: {position: [952, 858], opacity: degOp}, out: f(tProofOut + 0.45)}));
  L.push(cam({...txt('degree sign', '°', 958, 858, 'anton', 96, RED), transform: {position: [958, 858], opacity: degOp}, out: f(tProofOut + 0.45)}));

  topLayers().forEach((l) => L.push(cam(l)));
  wallLayers().forEach((l) => L.push(cam(l)));
  proofLayers().forEach((l) => L.push(cam(l)));
  endLayers().forEach((l) => L.push(cam(l)));

  L.push(...captionLayers());
  // watermark: whole film, bottom centre, two lines, 26 px at 85 % on a dark band (master blueprint v1.3)
  L.push({kind: 'shape', name: 'watermark band', items: [rect(0, H - 150, W, 150, BG, 78)], label: 16});
  L.push({...txt('watermark', 'Directed & produced by Marek Mars\nOnemarsmedia Limited · onemarsmedia.com', W / 2, H - 92, 'sg600', 26, TXT, {justify: 'center', leading: 38}), transform: {position: [W / 2, H - 92], opacity: 85}, label: 16});

  const main: Comp = {name: 'Action taker v2', width: W, height: H, fps: FPS, duration: DURATION, bg: BG, motionBlur: {shutterAngle: 180, samples: 8}, layers: L};
  add(main);
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

/** SFX: soft taps on every block, a stamp on the cancel, a lock on 360, quiet. */
export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    ...TILES.map((t) => ({file: 'tap.wav', t: t.t, gainDb: -29})),
    {file: 'lock.wav', t: T.ship + 1.0, gainDb: -25},
    {file: 'lock.wav', t: tDone, gainDb: -25},
    {file: 'whoosh.wav', t: T.years - 0.4, gainDb: -31},
    {file: 'whoosh.wav', t: tProofOut, gainDb: -31},
    {file: 'tap.wav', t: T.name, gainDb: -26},
  ];
}
