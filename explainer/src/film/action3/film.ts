import {key} from '../../scene/builders';
import type {Bezier, Comp, Key, Layer, Scene, ShapeItem, TextLayer, Vec2} from '../../scene/types';
import {C, FONT} from '../editorial/tokens';
import vo from './vo.json';

// "Action taker" v3 (9:16, Gen Z cut): v47 and still not posted -> "Meanwhile" drops the beat and the
// film hard-cuts through full-screen stills of real Onemarsmedia work, one word slammed on each, a flicker
// montage zooms out into the 360 wall, proof slams, then back to the perfectionist: "Post the thing."
// Everything is cut on a 140 BPM grid (the VO phrases were placed on it too, see work/action3/gaps.json).

export const FPS = 60;
const W = 1080;
const H = 1920;
const f = (s: number) => Math.round(s * FPS);
const BEAT = 60 / 140;
const E: Record<'scene' | 'in' | 'out' | 'pop' | 'slam', Bezier> = {
  scene: [0.83, 0, 0.17, 1],
  in: [0.16, 1, 0.3, 1],
  out: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
  slam: [0.12, 0.9, 0.2, 1], // lands hard, no bounce
};
const BG = C.ink;
const TXT = C.paper;
const MUTE = '#9A9286';
const RED = C.red;

// ------------------------------------------------------------------ timing
type Chunk = {text: string; start: number; end: number};
const ch = (vo as {chunks: Chunk[]}).chunks;
const T = {
  v47: ch[0].start,
  notPosted: ch[1].start,
  meanwhile: ch[2].start,
  planned: ch[3].start,
  shot: ch[4].start,
  cut: ch[5].start,
  dropped: ch[6].start,
  years: ch[7].start,
  vogue: ch[8].start,
  adidas: ch[9].start,
  asos: ch[10].start,
  stop: ch[11].start,
  post: ch[12].start,
  name: ch[13].start,
};
export const DURATION = f(52 * BEAT); // 13 bars

// ------------------------------------------------------------------ builders
const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2], roundness: r},
  fill: {color, opacity},
});
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
const win = <L extends Layer>(l: L, t0: number, t1: number): L => ({...l, in: f(t0), out: f(t1)});
/** A soft dark band (stacked rects) behind type on top of footage. */
const shade = (y: number, h: number, peak = 55): ShapeItem[] => [0.2, 0.35, 0.5, 0.65, 0.8, 1].map((k) => rect(0, y + (h * (1 - k)) / 2, W, h * k, BG, peak / 4));

// ------------------------------------------------------------------ the cut list (full-screen stills)
type Cut = {t: number; still: string; word?: string};
const CUTS: Cut[] = [
  {t: T.meanwhile, still: 'RECCE'},
  {t: T.planned, still: 'PLAN', word: 'PLANNED'},
  {t: T.planned + BEAT, still: 'CREW'},
  {t: T.shot, still: 'SHOOT', word: 'SHOT'},
  {t: T.shot + BEAT, still: 'DIRECT'},
  {t: T.cut, still: 'EDIT', word: 'CUT'},
  {t: T.cut + BEAT * 0.75, still: 'MOTION'},
  {t: T.dropped, still: 'DELIVER', word: 'DROPPED'},
];
const tFlicker = T.dropped + BEAT * 1.5;
const FLICK = ['HERO', 'SOCIAL', 'BTS', 'SOUND', 'CREW', 'SHOOT', 'PLAN', 'MOTION', 'RECCE', 'DIRECT', 'EDIT', 'HERO'];
const tWall = tFlicker + FLICK.length * (BEAT / 4); // the flicker ends: the wall
const tProof = T.years;
const tBack = T.stop; // back to the perfectionist
const tEnd = T.name;

function stillLayers(): Layer[] {
  const L: Layer[] = [];
  const all: Cut[] = [...CUTS];
  FLICK.forEach((s, i) => all.push({t: tFlicker + i * (BEAT / 4), still: s}));
  all.forEach((c, i) => {
    const next = i < all.length - 1 ? all[i + 1].t : tWall;
    const punch = c.word ? 114 : 108;
    L.push(
      win(
        {
          kind: 'image',
          name: `still ${i + 1} ${c.still}`,
          file: `footage/action-v3/${c.still}.jpg`,
          width: W,
          height: H,
          transform: {
            anchor: [W / 2, H / 2],
            position: [W / 2, H / 2],
            scale: {keys: [key(f(c.t), [punch, punch] as Vec2, E.out), key(f(Math.min(next, c.t + 0.45)), [100, 100] as Vec2)]},
            rotation: {keys: [key(f(c.t), i % 2 ? 1.2 : -1.2, E.out), key(f(c.t + 0.3), 0)]},
          },
          label: 9,
        },
        c.t,
        next,
      ),
    );
    if (c.word) {
      const wEnd = next;
      const y = 1360;
      L.push(win({kind: 'shape', name: `shade ${c.word}`, items: shade(y - 250, 360, 60)}, c.t, wEnd));
      L.push(
        win(
          {
            ...txt(`word ${c.word}`, c.word, W / 2, y, 'anton', 250, '#FFFFFF', {justify: 'center', tracking: track(2, 250)}),
            transform: {
              position: [W / 2, y],
              scale: {keys: [key(f(c.t), [150, 150] as Vec2, E.slam), key(f(c.t + 0.12), [100, 100] as Vec2, 'linear'), key(f(wEnd), [96, 96] as Vec2)]},
              opacity: {keys: [key(f(c.t), 0, 'linear'), key(f(c.t) + 2, 100)]},
            },
            label: 1,
          },
          c.t,
          wEnd,
        ),
      );
      // the red bar under the word wipes in on the next half beat
      L.push(win({kind: 'shape', name: `bar ${c.word}`, items: [rect(0, 0, 360, 16, RED, 100, 8)], transform: {anchor: [180, 8], position: [W / 2, y + 44], scale: {keys: [key(f(c.t + 0.05), [0, 100] as Vec2, E.slam), key(f(c.t + 0.25), [100, 100] as Vec2)]}}, label: 1}, c.t, wEnd));
    }
  });
  // "Meanwhile..." sits small at the top of the first still
  L.push(win({kind: 'shape', name: 'shade meanwhile', items: shade(150, 200, 50)}, T.meanwhile, T.planned));
  L.push(win({...txt('meanwhile', 'Meanwhile…', W / 2, 280, 'sg800', 72, '#FFFFFF', {justify: 'center', tracking: track(-1.5, 72)}), transform: {position: [W / 2, 280], scale: {keys: [key(f(T.meanwhile), [130, 130] as Vec2, E.slam), key(f(T.meanwhile + 0.12), [100, 100] as Vec2)]}}}, T.meanwhile, T.planned));
  return L;
}

// ------------------------------------------------------------------ the 360 wall: the flicker zooms out into it
const TW = 222;
const TH = 214;
const G = 12;
const WALL = ['PLAN', 'RECCE', 'CREW', 'SHOOT', 'BTS', 'DIRECT', 'EDIT', 'MOTION', 'SOUND', 'HERO', 'SOCIAL', 'DELIVER'];
function wallComp(): Comp {
  const x0 = (W - (4 * TW + 3 * G)) / 2;
  const y0 = (H - (3 * TH + 2 * G)) / 2 - 60;
  const layers: Layer[] = [];
  WALL.forEach((s, i) => {
    const x = x0 + (i % 4) * (TW + G);
    const y = y0 + Math.floor(i / 4) * (TH + G);
    layers.push({kind: 'shape', name: `matte ${s}`, matteSource: true, items: [rect(x, y, TW, TH, '#FFFFFF', 100, 12)]});
    layers.push({kind: 'image', name: `tile ${s}`, file: `footage/action-v2/${s}.jpg`, width: 480, height: 480, matte: {layer: `matte ${s}`, type: 'alpha'}, transform: {anchor: [240, 240], position: [x + TW / 2, y + TH / 2], scale: [(TW / 480) * 100, (TW / 480) * 100]}});
  });
  // the through-line frames the wall
  const wx = x0 - 14;
  const wy = y0 - 14;
  const ww = 4 * TW + 3 * G + 28;
  const wh = 3 * TH + 2 * G + 28;
  layers.push({kind: 'shape', name: 'wall frame', items: [{geo: {type: 'rect', size: [ww, wh], center: [wx + ww / 2, wy + wh / 2], roundness: 18}, stroke: {color: RED, width: 5}, trim: {start: 0, end: {keys: [key(f(tWall + 0.25), 0, E.scene), key(f(tWall + 0.25 + BEAT * 2), 100)]}}}]});
  return {name: 'WALL', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ the perfectionist screen (start, and the return)
function perfLayers(t0: number, t1: number, back: boolean): Layer[] {
  const L: Layer[] = [];
  const tag = back ? 'B' : 'A';
  const cx = W / 2;
  // file chip
  L.push(win({kind: 'shape', name: `${tag} file chip`, items: [rect(cx - 330, 360, 660, 66, '#24211E', 100, 33)]}, t0, t1));
  L.push(win(txt(`${tag} file`, 'Launch_film_FINAL_final_v2.mp4', cx, 404, 'sg700', 26, MUTE, {justify: 'center'}), t0, t1));
  // the version number: counts up (start) or sits at v47 (the return)
  if (!back) {
    const vk: Key<string>[] = [];
    const end = T.v47 + 1.0;
    for (let n = 1; n <= 47; n++) vk.push(key(f(end * Math.pow((n - 1) / 46, 0.6)), `v${n}`, 'hold'));
    L.push(win({kind: 'text', name: 'A version', source: {kind: 'keyed', keys: vk}, font: FONT.anton, size: 420, color: TXT, justify: 'center', transform: {position: [cx, 900]}}, t0, t1));
  } else {
    L.push(win(txt('B version', 'v47', cx, 900, 'anton', 420, TXT, {justify: 'center'}), t0, t1));
    // struck through on "Stop overthinking"
    L.push(win({kind: 'shape', name: 'B strike', items: [rect(0, 0, 560, 26, RED, 100, 13)], transform: {anchor: [0, 13], position: [cx - 280, 770], rotation: -8, scale: {keys: [key(f(t0 + 0.1), [0, 100] as Vec2, E.slam), key(f(t0 + 0.3), [100, 100] as Vec2)]}}}, t0, t1));
  }
  // the Post button
  const by = 1130;
  const clickT = T.post + BEAT * 1.5;
  if (!back) {
    L.push(win({kind: 'shape', name: 'A post button', items: [rect(cx - 170, by, 340, 104, '#2D2A26', 100, 52)], transform: {anchor: [cx, by + 52], position: [cx, by + 52], rotation: {keys: [key(f(T.notPosted + 0.2), 0, 'linear'), key(f(T.notPosted + 0.28), -3, 'linear'), key(f(T.notPosted + 0.36), 3, 'linear'), key(f(T.notPosted + 0.44), -2, 'linear'), key(f(T.notPosted + 0.52), 0)]}}}, t0, t1));
    L.push(win(txt('A post label', 'Post', cx, by + 68, 'sg800', 44, MUTE, {justify: 'center'}), t0, t1));
  } else {
    L.push(win({kind: 'shape', name: 'B post button', items: [rect(cx - 170, by, 340, 104, '#2D2A26', 100, 52)]}, t0, clickT));
    L.push(win(txt('B post label', 'Post', cx, by + 68, 'sg800', 44, TXT, {justify: 'center'}), t0, clickT));
    L.push(win({kind: 'shape', name: 'B posted button', items: [rect(cx - 170, by, 340, 104, RED, 100, 52)], transform: {anchor: [cx, by + 52], position: [cx, by + 52], scale: {keys: [key(f(clickT), [88, 88] as Vec2, E.pop), key(f(clickT + 0.3), [100, 100] as Vec2)]}}}, clickT, t1));
    L.push(win(txt('B posted label', 'Posted ✓', cx, by + 68, 'sg800', 44, '#FFFFFF', {justify: 'center'}), clickT, t1));
    // a ring ripples out from the click
    L.push(win({kind: 'shape', name: 'B ripple', items: [{geo: {type: 'ellipse', size: [120, 120], center: [0, 0]}, stroke: {color: RED, width: 4}}], transform: {anchor: [0, 0], position: [cx + 40, by + 60], scale: {keys: [key(f(clickT), [20, 20] as Vec2, E.out), key(f(clickT + 0.45), [420, 420] as Vec2)]}, opacity: {keys: [key(f(clickT), 100, 'linear'), key(f(clickT + 0.45), 0)]}}}, clickT, clickT + 0.5));
  }
  // the cursor: hovers and hesitates (start), goes straight in and clicks (return)
  const arrow: ShapeItem = {geo: {type: 'path', path: {v: [[0, 0], [0, 46], [12, 35], [20, 54], [28, 51], [20, 32], [36, 32]], closed: true}}, fill: {color: '#FFFFFF'}, stroke: {color: BG, width: 2.5}};
  const ck: Key<Vec2>[] = back
    ? [key(f(t0), [cx + 300, by + 420] as Vec2, E.scene), key(f(clickT - 0.05), [cx + 40, by + 60] as Vec2, 'linear'), key(f(t1), [cx + 40, by + 60] as Vec2)]
    : (() => {
        const k: Key<Vec2>[] = [key(f(t0), [cx + 260, by + 330] as Vec2, E.scene)];
        const hover: Vec2[] = [[cx + 60, by + 150], [cx + 110, by + 210], [cx + 30, by + 170], [cx + 90, by + 140], [cx + 50, by + 200]];
        hover.forEach((p, i) => k.push(key(f(t0 + 0.5 + i * BEAT), p, E.scene)));
        return k;
      })();
  const cs: Key<Vec2>[] = back ? [key(f(clickT - 0.05), [100, 100] as Vec2, E.out), key(f(clickT), [82, 82] as Vec2, E.out), key(f(clickT + 0.12), [100, 100] as Vec2)] : [key(0, [100, 100] as Vec2)];
  L.push(win({kind: 'shape', name: `${tag} cursor`, items: [arrow], transform: {anchor: [0, 0], position: {keys: ck}, scale: {keys: cs}}, label: 1}, t0, t1));
  return L;
}

/** Big type slammed on the beat, centred. */
function slam(name: string, s: string, t0: number, t1: number, y: number, size: number, color = '#FFFFFF', font: FontKey = 'sg800'): Layer[] {
  return [
    win(
      {
        ...txt(name, s, W / 2, y, font, size, color, {justify: 'center', tracking: track(font === 'anton' ? 2 : -2, size), leading: size * 1.05}),
        transform: {position: [W / 2, y], scale: {keys: [key(f(t0), [140, 140] as Vec2, E.slam), key(f(t0 + 0.12), [100, 100] as Vec2, 'linear'), key(f(t1), [97, 97] as Vec2)]}, opacity: {keys: [key(f(t0), 0, 'linear'), key(f(t0) + 2, 100)]}},
        label: 1,
      },
      t0,
      t1,
    ),
  ];
}

// ------------------------------------------------------------------ main
export function buildAction3Scene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  add(wallComp());
  const L: Layer[] = [];

  const dots: ShapeItem[] = [];
  for (let y = -48; y < H + 96; y += 48) for (let x = -48; x < W + 96; x += 48) dots.push({geo: {type: 'ellipse', size: [3, 3], center: [x, y]}, fill: {color: TXT, opacity: 9}});
  L.push({kind: 'shape', name: 'dot grid', items: dots, transform: {anchor: [0, 0], position: {keys: [key(0, [0, 0] as Vec2, 'linear'), key(DURATION - 1, [-48, -40] as Vec2)]}}, label: 16});

  // camera: a slow push on held beats, a kick (scale bump + shake) on every hard cut
  const hits = [T.meanwhile, ...CUTS.slice(1).map((c) => c.t), tWall, tProof, T.vogue, T.adidas, T.asos, tBack, T.post, tEnd];
  const sk: Key<Vec2>[] = [key(0, [100, 100] as Vec2, 'linear'), key(f(T.meanwhile - 0.02), [104, 104] as Vec2, 'linear')];
  const pk: Key<Vec2>[] = [key(0, [W / 2, H / 2] as Vec2, 'linear')];
  hits.forEach((t, i) => {
    sk.push(key(f(t), [104, 104] as Vec2, E.out), key(f(t + 0.14), [100, 100] as Vec2, 'linear'), key(f(t + 0.4), [101, 101] as Vec2, 'linear'));
    const d = i % 2 ? 1 : -1;
    pk.push(key(f(t), [W / 2, H / 2] as Vec2, 'linear'), key(f(t) + 2, [W / 2 + 14 * d, H / 2 - 9] as Vec2, 'linear'), key(f(t) + 4, [W / 2 - 9 * d, H / 2 + 6] as Vec2, 'linear'), key(f(t) + 7, [W / 2, H / 2] as Vec2, 'linear'));
  });
  sk.sort((a, b) => a.t - b.t);
  L.push({kind: 'null', name: 'CAMERA', transform: {anchor: [W / 2, H / 2], position: {keys: dedupe(pk)}, scale: {keys: dedupe(sk)}}, label: 2});
  const cam = (l: Layer): Layer => ({...l, parent: l.parent ?? 'CAMERA'});

  // 1. the perfectionist
  perfLayers(0, T.meanwhile, false).forEach((l) => L.push(cam(l)));
  L.push(...slam('still not posted', 'Still not posted.', T.notPosted, T.meanwhile, 1480, 88).map(cam));
  // 2. the montage
  stillLayers().forEach((l) => L.push(cam(l)));
  // 3. the wall (zooms out of the flicker), then dims under the proof
  L.push(
    cam(
      win(
        {
          kind: 'precomp',
          name: 'WALL',
          comp: 'WALL',
          collapse: true,
          transform: {
            anchor: [W / 2, H / 2],
            position: [W / 2, H / 2],
            scale: {keys: [key(f(tWall), [320, 320] as Vec2, E.scene), key(f(tWall + BEAT * 1.5), [100, 100] as Vec2, 'linear'), key(f(tBack), [106, 106] as Vec2)]},
            opacity: {keys: [key(f(tProof), 100, E.scene), key(f(tProof + 0.3), 22)]},
          },
        },
        tWall,
        tBack,
      ),
    ),
  );
  L.push(...slam('degrees', '360°', tWall + BEAT * 1.5, tProof, 1560, 150, RED, 'anton').map(cam));
  // 4. proof: one slam per beat word
  L.push(...slam('13', '13', tProof, T.vogue, 1000, 560, '#FFFFFF', 'anton').map(cam));
  L.push(...slam('years', 'YEARS OF UK PRODUCTION', tProof + BEAT, T.vogue, 1150, 54, TXT).map(cam));
  L.push(...slam('vogue', 'VOGUE\nARABIA', T.vogue, T.adidas, 900, 230, '#FFFFFF', 'anton').map(cam));
  L.push(...slam('adidas', 'ADIDAS', T.adidas, T.asos, 1000, 260, '#FFFFFF', 'anton').map(cam));
  L.push(...slam('asos', 'ASOS', T.asos, tBack, 1000, 300, '#FFFFFF', 'anton').map(cam));
  // 5. back to the perfectionist: struck v47, the cursor posts it
  L.push(cam(win({kind: 'shape', name: 'back plate', items: [rect(-100, -100, W + 200, H + 200, BG)]}, tBack, tEnd)));
  perfLayers(tBack, tEnd, true).forEach((l) => L.push(cam(l)));
  L.push(...slam('stop', 'Stop\noverthinking.', tBack, T.post, 1430, 96).map(cam));
  L.push(...slam('post', 'Post the thing.', T.post, tEnd, 1480, 96, RED).map(cam));
  // 6. the name
  L.push(cam(win({kind: 'shape', name: 'end plate', items: [rect(-100, -100, W + 200, H + 200, BG)]}, tEnd, DURATION / FPS)));
  L.push(...slam('wordmark', 'Onemarsmedia', tEnd, DURATION / FPS, 940, 124, TXT).map(cam));
  L.push(cam({kind: 'shape', name: 'wordmark line', items: [{geo: {type: 'path', path: {v: [[W / 2 - 455, 990], [W / 2 + 430, 990]], closed: false}}, stroke: {color: RED, width: 5, cap: 'round'}, trim: {start: {keys: [key(f(tEnd + 0.1), 50, E.scene), key(f(tEnd + 0.1 + BEAT * 2), 0)]}, end: {keys: [key(f(tEnd + 0.1), 50, E.scene), key(f(tEnd + 0.1 + BEAT * 2), 100)]}}}], in: f(tEnd + 0.1), label: 1}));
  L.push(cam(win({...txt('studio', '360 PRODUCTION STUDIO · LONDON', W / 2, 1070, 'sg800', 24, MUTE, {justify: 'center', tracking: track(4, 24)}), transform: {position: [W / 2, 1070], opacity: {keys: [key(f(tEnd + BEAT * 2), 0, 'linear'), key(f(tEnd + BEAT * 2.5), 100)]}}}, tEnd, DURATION / FPS)));
  L.push(cam(win({...txt('url', 'onemarsmedia.com', W / 2, 1600, 'sg600', 36, MUTE, {justify: 'center'}), transform: {position: [W / 2, 1600], opacity: {keys: [key(f(tEnd + BEAT * 3), 0, 'linear'), key(f(tEnd + BEAT * 3.5), 100)]}}}, tEnd, DURATION / FPS)));

  // white flash frames on the two drops
  [T.meanwhile, tEnd].forEach((t, i) => L.push(win({kind: 'shape', name: `flash ${i + 1}`, items: [rect(0, 0, W, H, '#FFFFFF')], transform: {opacity: {keys: [key(f(t), 85, 'linear'), key(f(t) + 3, 0)]}}}, t, t + 0.06)));

  // watermark: whole film, two lines, 26 px at 85 % on a dark band (master blueprint v1.3)
  L.push({kind: 'shape', name: 'watermark band', items: [rect(0, H - 150, W, 150, BG, 78)], label: 16});
  L.push({...txt('watermark', 'Directed & produced by Marek Mars\nOnemarsmedia Limited · onemarsmedia.com', W / 2, H - 92, 'sg600', 26, TXT, {justify: 'center', leading: 38}), transform: {position: [W / 2, H - 92], opacity: 85}, label: 16});

  const main: Comp = {name: 'Action taker v3', width: W, height: H, fps: FPS, duration: DURATION, bg: BG, motionBlur: {shutterAngle: 180, samples: 8}, layers: L};
  add(main);
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

/** Keys sorted by time, later duplicates dropped (overlapping hits). */
function dedupe<T>(keys: Key<T>[]): Key<T>[] {
  const out: Key<T>[] = [];
  [...keys].sort((a, b) => a.t - b.t).forEach((k) => {
    if (!out.length || k.t > out[out.length - 1].t) out.push(k);
  });
  return out;
}

/** Beat-grid cue times for the music and SFX. */
export const cues = {meanwhile: T.meanwhile, wall: tWall, years: tProof, back: tBack, click: T.post + BEAT * 1.5, name: tEnd, flicker: tFlicker};
export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    {file: 'whoosh.wav', t: tFlicker - 0.1, gainDb: -27},
    {file: 'lock.wav', t: tWall + BEAT * 1.5, gainDb: -22},
    {file: 'tap.wav', t: cues.click, gainDb: -20},
  ];
}
