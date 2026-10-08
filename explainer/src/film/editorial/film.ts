import {circlePath, key} from '../../scene/builders';
import {EASE} from '../../scene/ease';
import type {AudioClip, Bezier, Comp, Key, Layer, Prop, Scene, ShapeItem, TextLayer, Vec2} from '../../scene/types';
import metrics from './metrics.json';
import {buildTileComp, TILE, tileInfo} from './tiles';
import plan from './timing/plan.json';
import typeOnsets from './timing/type_onsets.json';
import vo from './timing/vo.json';
import {BAND_Y, BASE, BIG, C, colX, COLW, DEG_SIZE, FONT, FPS, GRID_Y0, H, L1, L2, M, ROW_GAP, RUL_H, RUL_Y, W} from './tokens';

// "One brief -> the whole campaign", Editorial direction. 30 s, 1920x1080, 30 fps.
// Every event is derived from the edited voice-over (timing/vo.json) and the beat plan
// (timing/plan.json: counter hits on the music grid, music button on "Onemarsmedia").
// Grammar (design/editorial/NOTES.md): hard cuts on the beat, rectangular wipes, decisive
// ease-out moves of 4-8 frames, no springs, no blur, no camera drift.

export const DURATION = 30 * FPS;
const f = (sec: number) => Math.round(sec * FPS);
const STEP: Bezier = [0.05, 0.9, 0.12, 1]; // decisive ease-out (AE ~ 90% incoming influence)

// ------------------------------------------------------------------ timing
type Word = {text: string; start: number; end: number; syllables: number[]; chunk: number};
const words = vo.words as Word[];
const clean = (s: string) => s.replace(/[^A-Za-z-]/g, '').toLowerCase();
function word(text: string, nth = 0): Word {
  const hits = words.filter((w) => clean(w.text) === clean(text));
  if (!hits[nth]) throw new Error(`word ${text}#${nth} not in VO`);
  return hits[nth];
}
const LEAD = 0.03; // picture leads the sound by ~1 frame
const at = (w: Word) => f(w.start - LEAD);
const HIT = {90: f(plan.hits['90']), 180: f(plan.hits['180']), 270: f(plan.hits['270']), 360: f(plan.hits['360'])};
const END_CARD = f(plan.endCard); // a beat; the music carries on under the sign-off
const BUTTON = f(plan.music.button); // the music stops on this downbeat

export const T = {
  typeStart: f(0.1),
  video: at(word('video')),
  everyAngle: at(word('every')),
  breakApart: f(word('all').syllables[0] - 0.06),
  tileOn: [
    at(word('think')),
    at(word('sketch')),
    HIT[90],
    at(word('cut')),
    at(word('move')),
    HIT[180],
    at(word('podcast')),
    at(word('post')),
    HIT[270],
    at(word('code')),
    at(word('version')),
    at(word('ship')),
  ],
  halfway: at(word("that's", 0)),
  pull1: HIT[360] + f(1.0),
  pull2: HIT[360] + f(1.5),
  button: END_CARD,
  musicButton: BUTTON,
  name: at(word('onemarsmedia')),
  nameEnd: f(word('onemarsmedia').end),
  oneTeam: at(word('one', 1)),
  noLimits: at(word('no')),
};
// counter steps: +30 deg per tile; the last step lands on the 360 hit (music entry)
const STEPS = T.tileOn.map((t, i) => (i === 11 ? HIT[360] : t));
// tile i is "active" (red) until the next tile lands; the last one until the wall.
// FILMING is the exception: its hero shows the dark viewfinder look from the approved frame (f2).
const ACTIVE_OFF = T.tileOn.map((_, i) => (i === 2 ? T.tileOn[2] : i < 11 ? T.tileOn[i + 1] : T.pull2));

// ------------------------------------------------------------------ small builders
const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2]},
  fill: {color, opacity},
});
const hline = (x0: number, x1: number, y: number, color: string, width: number, opacity = 100): ShapeItem => ({
  geo: {type: 'path', path: {v: [[x0, y], [x1, y]], closed: false}},
  stroke: {color, width, opacity},
});
const vline = (x: number, y0: number, y1: number, color: string, width: number, opacity = 100): ShapeItem => ({
  geo: {type: 'path', path: {v: [[x, y0], [x, y1]], closed: false}},
  stroke: {color, width, opacity},
});

function text(name: string, s: string, x: number, y: number, font: (typeof FONT)[keyof typeof FONT], size: number, color: string, extra: Partial<TextLayer> = {}): TextLayer {
  return {kind: 'text', name, source: {kind: 'static', text: s}, font, size, color, transform: {position: [x, y]}, ...extra};
}
/** Letter-spacing in px (as in frames.html) to AE tracking. */
const ls = (px: number, size: number) => (px / size) * 1000;

/** Scale-X wipe from the left edge (rules). */
const wipeX = (x: number, y: number, t: number, frames: number): Pick<Layer, 'transform'> => ({
  transform: {anchor: [x, y], position: [x, y], scale: {keys: [key(t, [0, 100] as Vec2, STEP), key(t + frames, [100, 100] as Vec2)]}},
});

/** Alpha-matte rectangle that grows left -> right (text wipes). */
function wipeMatte(name: string, x: number, y: number, w: number, h: number, t: number, frames: number): Layer {
  return {
    kind: 'shape',
    name,
    matteSource: true,
    items: [rect(0, 0, w, h, '#FFFFFF')],
    transform: {anchor: [0, 0], position: [x, y], scale: {keys: [key(t, [0, 100] as Vec2, STEP), key(t + frames, [100, 100] as Vec2)]}},
    in: t,
  };
}

const holdKeys = <T>(pairs: Array<[number, T]>): Prop<T> => ({keys: pairs.map(([t, v], i) => key(t, v, i < pairs.length - 1 ? 'hold' : undefined))});

// ------------------------------------------------------------------ 360 device precomp
// Giant Anton numerals that fill like a gauge, a split-flap seam, and a degree ring drawn with
// Trim Paths. ONE slider ("360 CONTROL" > Degrees) drives digits, gauge, ring and the zero tick.
const DEG = {w: 760, h: 420, xr: 740, base: 390};

function degreesComp(): Comp {
  const S = DEG_SIZE;
  const adv = metrics.antonDigitAdv * S;
  const wDigits = adv * 3;
  const capH = metrics.antonCap0 * S;
  const rr = S * 0.118;
  const rsw = S * 0.062;
  const ringW = rr * 2 + rsw;
  const gapR = S * 0.05;
  const x0 = DEG.xr - (wDigits + gapR + ringW);
  const base = DEG.base;
  const cx = x0 + wDigits + gapR + ringW / 2;
  const cy = base - capH + ringW / 2;
  const seamY = base - capH / 2;
  const CTRL = '360 CONTROL';
  const deg = {link: {layer: CTRL, slider: 'Degrees'}};

  // Degrees: hold, then a 6-frame ease-out step of +30 on every tile
  const dk: Key<number>[] = [key(0, 0, 'hold')];
  STEPS.forEach((t, i) => {
    dk.push(key(t, i * 30, STEP));
    dk.push(key(t + 6, (i + 1) * 30, i < 11 ? 'hold' : undefined));
  });
  // split-flap: the digits fold about the seam for 3 frames on every step
  const flap: Key<Vec2>[] = [key(0, [100, 100], 'hold')];
  STEPS.forEach((t) => {
    flap.push(key(t, [100, 100], EASE.in));
    flap.push(key(t + 1, [100, 30], EASE.out));
    flap.push(key(t + 3, [100, 100], 'hold'));
  });
  delete flap[flap.length - 1].ease;

  const layers: Layer[] = [
    {kind: 'null', name: CTRL, sliders: [{name: 'Degrees', value: {keys: dk}}], label: 2},
    {kind: 'null', name: 'FLAP', transform: {anchor: [x0 + wDigits / 2, seamY], position: [x0 + wDigits / 2, seamY], scale: {keys: flap}}, label: 2},
    // gauge matte: rises from the baseline by Degrees/360
    {
      kind: 'shape',
      name: 'gauge matte',
      parent: 'FLAP',
      matteSource: true,
      items: [rect(x0 - 20, base - capH, wDigits + 40, capH + 20, '#FFFFFF')],
      transform: {anchor: [0, base], position: [0, base], scale: {linkVec: {layer: CTRL, slider: 'Degrees', x: {mul: 0, add: 100}, y: {mul: 100 / 360, min: 0, max: 100}}}},
    },
  ];
  for (let k = 0; k < 3; k++) {
    const x = x0 + adv * (k + 0.5);
    layers.push({
      kind: 'text',
      name: `digit ${k + 1} outline`,
      parent: 'FLAP',
      source: {kind: 'counterDigit', value: deg, pad: 3, index: k},
      font: FONT.anton,
      size: S,
      color: C.ink,
      noFill: true,
      stroke: {color: C.ink, width: Math.max(2.5, S / 110)},
      justify: 'center',
      transform: {position: [x, base]},
    });
    layers.push({
      kind: 'text',
      name: `digit ${k + 1} fill`,
      parent: 'FLAP',
      source: {kind: 'counterDigit', value: deg, pad: 3, index: k},
      font: FONT.anton,
      size: S,
      color: C.ink,
      justify: 'center',
      transform: {position: [x, base]},
      matte: {layer: 'gauge matte', type: 'alpha'},
    });
  }
  layers.push({kind: 'shape', name: 'split-flap seam', parent: 'FLAP', items: [rect(x0 + S * 0.02, seamY - S * 0.006, wDigits - S * 0.05, Math.max(3, S * 0.012), C.paper)]});
  // ring: hairline track (hidden at 360), red arc (Trim Paths End = Degrees/360), zero tick
  layers.push({
    kind: 'shape',
    name: 'ring track',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.ink, width: Math.max(1.5, S / 220), opacity: {link: {layer: CTRL, slider: 'Degrees', mul: -100, add: 36000, min: 0, max: 35}}}}],
  });
  layers.push({
    kind: 'shape',
    name: 'ring arc',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.red, width: rsw, cap: 'butt'}, trim: {end: {link: {layer: CTRL, slider: 'Degrees', mul: 100 / 360, min: 0, max: 100}}}}],
  });
  // "every angle": a preview sweep of the full ring, then it erases itself
  const a = T.everyAngle;
  layers.push({
    kind: 'shape',
    name: 'ring preview sweep',
    items: [
      {
        geo: {type: 'path', path: circlePath(cx, cy, rr)},
        stroke: {color: C.red, width: rsw, cap: 'butt'},
        trim: {
          start: {keys: [key(a + 14, 0, EASE.inOut), key(a + 24, 100)]},
          end: {keys: [key(a, 0, EASE.inOut), key(a + 14, 100)]},
        },
      },
    ],
    in: a,
    out: a + 25,
  });
  // the music's final downbeat: the ring clears and redraws once, full circle
  layers.push({
    kind: 'shape',
    name: 'ring clear for redraw',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.paper, width: rsw + 2, cap: 'butt'}}],
    in: T.musicButton,
    out: T.musicButton + 9,
  });
  layers.push({
    kind: 'shape',
    name: 'ring final redraw',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.red, width: rsw, cap: 'butt'}, trim: {end: {keys: [key(T.musicButton, 0, STEP), key(T.musicButton + 8, 100)]}}}],
    in: T.musicButton,
    out: T.musicButton + 9,
  });
  layers.push({
    kind: 'shape',
    name: 'zero tick',
    items: [rect(cx - rsw * 0.18, cy - rr - rsw / 2, rsw * 0.36, rsw, C.red)],
    transform: {opacity: {link: {layer: CTRL, slider: 'Degrees', mul: -400, add: 100, min: 0, max: 100}}},
  });
  return {name: 'DEGREES 360', width: DEG.w, height: DEG.h, fps: FPS, duration: DURATION, layers};
}

/** Place the DEGREES precomp with its right edge / baseline at (xr, base). */
const degreesLayer = (name: string, xr: number, base: number, scale = 100, extra: {in?: number; out?: number} = {}): Layer => ({
  kind: 'precomp',
  name,
  comp: 'DEGREES 360',
  collapse: true,
  transform: {anchor: [DEG.xr, DEG.base], position: [xr, base], scale: [scale, scale]},
  ...extra,
});

// ------------------------------------------------------------------ band (counter row)
function bandComp(): Comp {
  const layers: Layer[] = [];
  const end = T.button; // ruler and the left band copy give way to the sign-off lockup
  layers.push({kind: 'null', name: 'BAND CONTROL', sliders: [{name: 'Tiles', value: holdKeys([[0, 0], ...T.tileOn.map((t, i): [number, number] => [t, i + 1])])}], label: 2});
  layers.push({kind: 'shape', name: 'band rule', items: [rect(M, BAND_Y, W - 2 * M, 2.5, C.ink)], ...wipeX(M, BAND_Y, f(0.13), 8)});
  layers.push(text('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', M, BAND_Y + 48, FONT.sg800, 19, C.ink, {tracking: ls(3, 19), in: f(0.33), out: end}));
  layers.push(text('0 of 12 deliverables', '0 of 12 deliverables', M, BAND_Y + 94, FONT.sg600, 36, C.gr, {in: f(0.33), out: T.tileOn[0]}));
  layers.push({
    kind: 'text',
    name: 'N of 12 deliverables',
    source: {kind: 'counter', value: {link: {layer: 'BAND CONTROL', slider: 'Tiles'}}, pad: 1, suffix: ' of 12 deliverables'},
    font: FONT.sg600,
    size: 36,
    color: C.ink,
    transform: {position: [M, BAND_Y + 94]},
    in: T.tileOn[0],
    out: end,
  });
  // "Now: 10 Apps" follows the count; on the wall it reads "One campaign."
  const nowKeys: Key<string>[] = T.tileOn.map((t, i) => {
    const {num, name} = tileInfo(i);
    return key(t, `Now: ${num} ${name === 'AI' ? 'AI' : name.charAt(0) + name.slice(1).toLowerCase()}`);
  });
  nowKeys.push(key(T.pull2, 'One campaign.'));
  const nowX = (n: number) => M + (metrics.deliverables as Record<string, number>)[String(n)] + 34;
  layers.push({
    kind: 'text',
    name: 'Now',
    source: {kind: 'keyed', keys: nowKeys},
    font: FONT.sg800,
    size: 36,
    color: C.red,
    transform: {position: holdKeys(T.tileOn.map((t, i): [number, Vec2] => [t, [nowX(i + 1), BAND_Y + 94]]))},
    in: T.tileOn[0],
    out: end,
  });
  // ruler: 12 segments (30 deg each) + 0/90/180/270/360 ticks
  const n = 12;
  const g = 6;
  const w = 900;
  const sw = (w - g * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const sx = M + i * (sw + g);
    const lbl = String(i + 1).padStart(2, '0');
    const on = T.tileOn[i];
    const off = ACTIVE_OFF[i];
    const tIn = f(0.4) + i;
    layers.push({kind: 'shape', name: `ruler ${lbl} slot`, items: [{geo: {type: 'rect', size: [sw - 1.5, RUL_H - 1.5], center: [sx + sw / 2, RUL_Y + RUL_H / 2]}, stroke: {color: C.gr, width: 1.5}}], in: tIn, out: end});
    layers.push({
      kind: 'shape',
      name: `ruler ${lbl} fill`,
      items: [{geo: {type: 'rect', size: [sw, RUL_H], center: [sx + sw / 2, RUL_Y + RUL_H / 2]}, fill: {color: off > on ? holdKeys([[on, C.red], [off, C.ink]]) : C.ink}}],
      in: on,
      out: end,
    });
    const num = (suffix: string, color: string, inF: number, outF: number) => {
      if (outF > inF) layers.push(text(`ruler ${lbl} number ${suffix}`, lbl, sx + 9, RUL_Y + RUL_H - 11, FONT.sg800, 20, color, {in: inF, out: outF}));
    };
    num('waiting', C.gr, tIn, on);
    num('now', C.ink, on, off);
    num('done', C.paper, off, end);
  }
  const ticks: ShapeItem[] = [];
  for (let k = 0; k <= 4; k++) {
    const tx = k === 4 ? M + w - 1 : k === 0 ? M + 1 : M + k * 3 * (sw + g) - g / 2;
    ticks.push(vline(tx, RUL_Y + RUL_H + 6, RUL_Y + RUL_H + 18, C.ink, 2));
    layers.push(
      text(`tick ${k * 90}`, `${k * 90}°`, tx, RUL_Y + RUL_H + 18 + 18 + 4, FONT.sg700, 18, C.ink, {
        justify: k === 0 ? 'left' : k === 4 ? 'right' : 'center',
        in: f(0.5),
        out: end,
      }),
    );
  }
  layers.push({kind: 'shape', name: 'ruler ticks', items: ticks, in: f(0.5), out: end});
  layers.push(degreesLayer('360', W - M, BASE, 100, {in: f(0.46)}));
  return {name: 'BAND', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ grid of tiles
export const gridPos = (i: number): Vec2 => [colX((i % 6) * 2), GRID_Y0 + Math.floor(i / 6) * (TILE.h + ROW_GAP)];

function gridComp(): Comp {
  const layers: Layer[] = [];
  for (let i = 0; i < 12; i++) {
    const [x, y] = gridPos(i);
    const {num, name} = tileInfo(i);
    const tIn = T.breakApart + 2 * i; // the brief breaks into 12 reserved slots, 2-frame stagger
    const tc = T.button + i; // end card: tiles collapse to their top edge, 1-frame stagger
    layers.push({
      kind: 'precomp',
      name: `${num} ${name}`,
      comp: `TILE ${num} ${name}`,
      collapse: true,
      transform: {anchor: [0, 0], position: [x, y], scale: {keys: [key(tc, [100, 100] as Vec2, EASE.in), key(tc + 4, [100, 0] as Vec2)]}},
      in: tIn,
      out: tc + 4,
    });
  }
  return {name: 'GRID', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ hero overlays (contents column)
const tc_ = (n: string) => (n === 'AI' ? 'AI' : n.charAt(0) + n.slice(1).toLowerCase());

function guideItems(y0: number, y1: number, op: number, minX = 0): ShapeItem[] {
  const items: ShapeItem[] = [];
  for (let k = 0; k < 12; k++) {
    const x = colX(k);
    for (const gx of [x + 0.5, x + COLW - 0.5]) if (gx > minX) items.push(vline(gx, y0, y1, C.ink, 1, op));
  }
  return items;
}

function indexComp(name: string, current: number, opts: {degrees: boolean}): Comp {
  const cx = 1200;
  const x0 = colX(8);
  const x1 = W - M;
  const layers: Layer[] = [
    {kind: 'shape', name: 'column paper', items: [rect(cx, 0, W - cx, H, C.paper)]},
    {kind: 'shape', name: 'column guides', items: guideItems(64, H, 6, cx)},
    {kind: 'shape', name: 'column divider', items: [rect(cx, 64, 3, H - 64, C.ink)]},
    {kind: 'shape', name: 'masthead paper', items: [rect(0, 0, W, 64, C.paper)]},
    text('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', x0, 128, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}),
    text('count', `${current + 1} / 12`, x1, 128, FONT.sg800, 19, C.ink, {justify: 'right'}),
  ];
  const rh = 38;
  const ry0 = 150;
  const rows: ShapeItem[] = [];
  for (let i = 0; i < 12; i++) {
    const {num, name: nm} = tileInfo(i);
    const y = ry0 + i * rh;
    const done = i < current;
    const cur = i === current;
    if (cur) rows.push(rect(x0, y, x1 - x0, rh, C.red));
    else rows.push(rect(x0, y + rh - 1, x1 - x0, 1, C.ink, done ? 50 : 18));
    const col = cur || done ? C.ink : C.gr;
    layers.push(text(`row ${num} number`, num, x0 + (cur ? 12 : 0), y + 27, FONT.sg800, 19, col));
    layers.push(text(`row ${num} name`, tc_(nm), x0 + (cur ? 64 : 52), y + 27, cur ? FONT.sg800 : FONT.sg600, 21, col));
    layers.push(
      text(`row ${num} degrees`, `${String((i + 1) * 30).padStart(3, '0')}°`, x1 - (cur ? 12 : 0), y + 27, FONT.sg700, 19, col, {
        justify: 'right',
        transform: {position: [x1 - (cur ? 12 : 0), y + 27], opacity: done || cur ? 100 : 80},
      }),
    );
  }
  layers.splice(6, 0, {kind: 'shape', name: 'rows', items: rows});
  layers.push({kind: 'shape', name: 'column rule', items: [rect(x0, BAND_Y + 30, x1 - x0, 2.5, C.ink)]});
  if (opts.degrees) layers.push(degreesLayer('360 small', W - M, BASE, (300 / DEG_SIZE) * 100));
  return {name, width: W, height: H, fps: FPS, duration: DURATION, layers};
}

/** "That's halfway.": the counter takes the frame. */
function halfwayComp(): Comp {
  const s = 162;
  return {
    name: 'HALFWAY',
    width: W,
    height: H,
    fps: FPS,
    duration: DURATION,
    layers: [
      {kind: 'shape', name: 'paper', items: [rect(0, 0, 1200, H, C.paper)]},
      {kind: 'shape', name: 'guides', items: guideItems(64, H, 6).filter((it) => ((it.geo as {path: {v: Vec2[]}}).path.v[0][0] < 1200))},
      text('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', M, 128, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}),
      text('6 of 12', '6 of 12 deliverables', M, 174, FONT.sg600, 36, C.ink),
      text('Halfway', 'Halfway.', M + (metrics.deliverables as Record<string, number>)['6'] + 34, 174, FONT.sg800, 36, C.red),
      degreesLayer('360 giant', M + (DEG.xr - 44.44) * (s / 100) + 0, 1000, s),
    ],
  };
}

// ------------------------------------------------------------------ main comp
function briefLayers(): Layer[] {
  const out = T.breakApart;
  const capH = metrics.antonCapH * BIG;
  const layers: Layer[] = [];
  layers.push(text('THE BRIEF', 'THE BRIEF', M, 112, FONT.sg800, 19, C.red, {tracking: ls(3, 19), in: f(0.2), out}));
  // memo: TO / FROM / RE, then the twist rows on the voice-over
  const mx = colX(8);
  const rows: Array<[string, string, number]> = [
    ['TO', 'Onemarsmedia', f(0.27)],
    ['FROM', 'Brand team', f(0.33)],
    ['RE', 'Launch', f(0.4)],
    ['NEED', 'A video', T.video],
  ];
  rows.forEach(([k, v, t], i) => {
    const y = 112 + i * 40;
    layers.push(text(`memo ${k} key`, k, mx, y, FONT.sg800, 17, C.gr, {tracking: ls(1.6, 17), in: t, out}));
    layers.push(text(`memo ${k} value`, v, mx + 151, y, FONT.sg600, 24, C.ink, {in: t, out}));
    layers.push({kind: 'shape', name: `memo ${k} rule`, items: [rect(mx, y + 14, 584, 1, C.ink, 22)], ...wipeX(mx, y + 14, t, 6), in: t, out});
  });
  // "every angle": strike the video, write the real need
  const sy = 112 + 3 * 40 - 8;
  layers.push({kind: 'shape', name: 'strike A video', items: [rect(mx + 151 - 4, sy, 104, 3, C.red)], ...wipeX(mx + 151 - 4, sy, T.everyAngle, 5), in: T.everyAngle, out});
  layers.push(text('memo NEED new', 'Every angle.', mx + 151 + 118, 112 + 3 * 40, FONT.sg800, 24, C.red, {in: T.everyAngle + 6, out}));
  // the brief, typed on the key sounds (one key = one character, the space key breaks the line)
  const charKeys: Key<number>[] = [key(0, 0, 'hold')];
  typeOnsets.slice(0, 17).forEach((s: number, i: number) => charKeys.push(key(T.typeStart + f(s), i + 1, i < 16 ? 'hold' : undefined)));
  layers.push({
    kind: 'text',
    name: 'brief headline',
    source: {kind: 'typeOn', text: 'We need\na launch.', chars: {keys: charKeys}},
    font: FONT.anton,
    size: BIG,
    leading: L2 - L1,
    color: C.ink,
    transform: {position: [M - 5, L1]},
    out,
  });
  // cursor: follows the typing, then blinks 12 on / 12 off until the break
  const p1 = metrics.brief.line1;
  const p2 = metrics.brief.line2;
  const curPos: Array<[number, Vec2]> = [[0, [M - 5 + 18, L1]]];
  typeOnsets.slice(0, 17).forEach((s: number, i: number) => {
    const n = i + 1; // characters typed
    const pos: Vec2 = n <= 7 ? [M - 5 + p1[n] + 18, L1] : [M - 5 + p2[Math.max(0, n - 8)] + 18, L2];
    curPos.push([T.typeStart + f(s), pos]);
  });
  const typed = T.typeStart + f(typeOnsets[16]);
  const blink: Array<[number, number]> = [[0, 100]];
  for (let t = typed + 12, on = false; t < out; t += 12, on = !on) blink.push([t, on ? 100 : 0]);
  layers.push({
    kind: 'shape',
    name: 'cursor',
    items: [rect(0, -capH, 30, capH, C.red)],
    transform: {position: holdKeys(curPos), opacity: holdKeys(blink)},
    out,
  });
  return layers;
}

function mastheadLayers(): Layer[] {
  const b = T.button;
  return [
    {kind: 'shape', name: 'masthead paper', items: [rect(0, 0, W, 64, C.paper)]},
    {kind: 'shape', name: 'masthead rule', items: [rect(M, 62, W - 2 * M, 2.5, C.ink)], ...wipeX(M, 62, 0, 8)},
    text('masthead Onemarsmedia', 'Onemarsmedia', M, 46, FONT.sg800, 19, C.ink, {tracking: ls(-0.2, 19), in: 3, out: b}),
    text('masthead tagline', 'One brief. The whole campaign.', colX(4), 46, FONT.sg600, 19, C.ink, {
      transform: {position: holdKeys<Vec2>([[0, [colX(4), 46]], [b, [M, 46]]])},
      in: 3,
    }),
    text('masthead url', 'onemarsmedia.com', W - M, 46, FONT.sg600, 19, C.gr, {justify: 'right', in: 3, out: b}),
  ];
}

function endCardLayers(): Layer[] {
  const b = T.button;
  const layers: Layer[] = [];
  // sign-off lines cut on with the voice; their red full stops land 4 frames later
  layers.push(text('One team', 'One team', M - 5, L1, FONT.anton, BIG, C.ink, {in: T.oneTeam}));
  layers.push(text('One team dot', '.', M - 5 + metrics.signoff.oneTeam, L1, FONT.anton, BIG, C.red, {in: T.oneTeam + 4}));
  layers.push(text('No limits', 'No limits', M - 5, L2, FONT.anton, BIG, C.ink, {in: T.noLimits}));
  layers.push(text('No limits dot', '.', M - 5 + metrics.signoff.noLimits, L2, FONT.anton, BIG, C.red, {in: T.noLimits + 4}));
  // the whole campaign, as a contents list
  const x0 = colX(8);
  const x1 = W - M;
  layers.push(text('end THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', x0, 112, FONT.sg800, 19, C.ink, {tracking: ls(3, 19), in: b + 6}));
  layers.push(text('end 12 / 12', '12 / 12', x1, 112, FONT.sg800, 19, C.red, {justify: 'right', in: b + 6}));
  for (let i = 0; i < 12; i++) {
    const {num, name} = tileInfo(i);
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    const x = col ? colX(10) : x0;
    const y = 160 + row * 40;
    const t = b + 8 + i;
    layers.push(text(`end row ${num} number`, num, x, y, FONT.sg800, 18, C.gr, {in: t}));
    layers.push(text(`end row ${num} name`, tc_(name), x + 38, y, FONT.sg600, 22, C.ink, {in: t}));
    layers.push({kind: 'shape', name: `end row ${num} rule`, items: [rect(x, y + 14, col ? x1 - colX(10) : colX(10) - 20 - x0, 1, C.ink, 22)], in: t});
  }
  // lockup on the band: descriptor, wordmark (wipes on with the name), URL
  layers.push(text('BRANDED CONTENT PRODUCTION', 'BRANDED CONTENT PRODUCTION, LONDON', M, BAND_Y + 48, FONT.sg800, 19, C.ink, {tracking: ls(3, 19), in: b + 2}));
  layers.push(wipeMatte('wordmark wipe', M - 10, 934 - 110, metrics.wordmark112 + 30, 140, T.name, 8));
  layers.push(text('Onemarsmedia wordmark', 'Onemarsmedia', M - 5, 934, FONT.sg800, 112, C.ink, {tracking: ls(-3.8, 112), in: T.name, matte: {layer: 'wordmark wipe', type: 'alpha'}}));
  layers.push(text('onemarsmedia.com', 'onemarsmedia.com', M, BASE, FONT.sg600, 40, C.ink, {in: T.nameEnd}));
  return layers;
}

export function buildEditorialScene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  for (let i = 0; i < 12; i++) add(buildTileComp(i, DURATION, FPS, {on: T.tileOn[i], activeOff: ACTIVE_OFF[i]}));
  add(degreesComp());
  add(bandComp());
  add(gridComp());
  add(indexComp('INDEX 03 FILMING', 2, {degrees: true}));
  add(indexComp('INDEX 06 HALFWAY', 5, {degrees: false}));
  add(indexComp('INDEX 12 DISTRIBUTION', 11, {degrees: true}));
  add(halfwayComp());

  // grid "camera": hard-cut re-crops (hold keys), as in the Editorial notes
  const crop = (i: number, z: number): Vec2 => {
    const [tx, ty] = gridPos(i);
    return [M - tx * (z / 100), 100 - ty * (z / 100)];
  };
  const [t12x, t12y] = gridPos(11);
  const pull1Pos: Vec2 = [W - M - (t12x + TILE.w) * 1.8, 950 - (t12y + TILE.h) * 1.8]; // both rows, right-aligned
  const gridPosKeys = holdKeys<Vec2>([
    [0, [0, 0]],
    [HIT[90], crop(2, 320)],
    [T.tileOn[3], [0, 0]],
    [HIT[360], crop(11, 320)],
    [T.pull1, pull1Pos],
    [T.pull2, [0, 0]],
  ]);
  const gridScaleKeys = holdKeys<Vec2>([
    [0, [100, 100]],
    [HIT[90], [320, 320]],
    [T.tileOn[3], [100, 100]],
    [HIT[360], [320, 320]],
    [T.pull1, [180, 180]],
    [T.pull2, [100, 100]],
  ]);
  const heroOff = (from: number, to: number) => [from, to] as const;
  const filming = heroOff(HIT[90], T.tileOn[3]);
  const halfway = heroOff(T.halfway, T.tileOn[6]);
  const distribution = heroOff(HIT[360], T.pull1);
  const bandOpacity = holdKeys<number>([
    [0, 100],
    [filming[0], 0],
    [filming[1], 100],
    [halfway[0], 0],
    [halfway[1], 100],
    [distribution[0], 0],
    [T.pull2, 100],
  ]);

  const main: Comp = {
    name: 'ONEMARSMEDIA 360',
    width: W,
    height: H,
    fps: FPS,
    duration: DURATION,
    bg: C.paper,
    markers: [
      {t: 0, label: 'Brief typed: We need a launch.'},
      {t: f(vo.chunks[0].start), label: 'VO: Then you need more than a video.'},
      {t: T.everyAngle, label: 'VO: You need every angle.'},
      {t: T.breakApart, label: 'Brief breaks into 12 slots'},
      {t: HIT[90], label: '090 FILMING hero'},
      {t: HIT[180], label: '180'},
      {t: T.halfway, label: "That's halfway"},
      {t: HIT[270], label: '270'},
      {t: HIT[360], label: '360 lock / music in / DISTRIBUTION hero'},
      {t: T.pull2, label: 'Full wall (poster frame)'},
      {t: T.button, label: 'End card'},
      {t: T.musicButton, label: 'Music button: ring redraws'},
    ],
    layers: [
      {kind: 'shape', name: 'guides', items: guideItems(64, H, 7), label: 16},
      ...briefLayers(),
      {
        kind: 'precomp',
        name: 'GRID',
        comp: 'GRID',
        collapse: true,
        transform: {anchor: [0, 0], position: gridPosKeys, scale: gridScaleKeys, opacity: holdKeys<number>([[0, 100], [halfway[0], 0], [halfway[1], 100]])},
        in: T.breakApart,
        out: T.button + 16,
        label: 10,
      },
      {kind: 'precomp', name: 'HALFWAY', comp: 'HALFWAY', in: halfway[0], out: halfway[1], label: 11},
      {kind: 'precomp', name: 'INDEX 03 FILMING', comp: 'INDEX 03 FILMING', in: filming[0], out: filming[1], label: 11},
      {kind: 'precomp', name: 'INDEX 06 HALFWAY', comp: 'INDEX 06 HALFWAY', in: halfway[0], out: halfway[1], label: 11},
      {kind: 'precomp', name: 'INDEX 12 DISTRIBUTION', comp: 'INDEX 12 DISTRIBUTION', in: distribution[0], out: distribution[1], label: 11},
      {kind: 'precomp', name: 'BAND', comp: 'BAND', transform: {opacity: bandOpacity}, label: 13},
      ...endCardLayers(),
      ...mastheadLayers(),
    ],
  };
  add(main);

  const audio: AudioClip[] = [
    {name: 'VO (Joshua)', file: 'vo.wav', start: 0},
    {name: 'Music (ducked)', file: 'music.wav', start: 0},
    {name: 'SFX', file: 'sfx.wav', start: 0},
  ];
  return {main: main.name, comps, fonts: Object.values(FONT), audio};
}

/** SFX cue list for the mix (seconds), derived from the same timeline. */
export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  const s = (fr: number) => fr / FPS;
  const cues = [
    {file: 'type.wav', t: s(T.typeStart), gainDb: -20},
    {file: 'flap.wav', t: s(T.breakApart), gainDb: -26},
    ...T.tileOn.map((t) => ({file: 'tap.wav', t: s(t), gainDb: -27})),
    ...[HIT[90], HIT[180], HIT[270]].map((t) => ({file: 'flap.wav', t: s(t), gainDb: -24})),
    {file: 'lock.wav', t: s(HIT[360]), gainDb: -20},
    {file: 'whoosh.wav', t: s(T.pull1) - 0.15, gainDb: -26},
    {file: 'tap.wav', t: s(T.oneTeam), gainDb: -28},
    {file: 'tap.wav', t: s(T.noLimits), gainDb: -28},
  ];
  return cues;
}

export type {Prop};
