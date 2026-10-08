import {circlePath, key} from '../../scene/builders';
import {evalVec2} from '../../scene/eval';
import type {AudioClip, Bezier, Comp, Key, Layer, Prop, Scene, ShapeItem, TextLayer, Transform, Vec2} from '../../scene/types';
import metrics from './metrics.json';
import {buildTileComps, TILE, tileInfo} from './tiles';
import plan from './timing/plan.json';
import typeOnsets from './timing/type_onsets.json';
import vo from './timing/vo.json';
import {BAND_Y, BASE, BIG, C, colX, COLW, DEG_SIZE, FONT, FPS, GRID_Y0, H, L1, L2, M, ROW_GAP, RUL_H, RUL_Y, W} from './tokens';

// "One brief -> the whole campaign", Editorial direction, v3 ("flowing"). 42 s, 1920x1080, 60 fps.
// The whole page (brief, grid, band, end card) lives in one WORLD precomp that a single camera
// (null "CAMERA") flies over without a cut: slow drifts between eased moves, pushes into the two
// hero tiles on the counter hits, one pull-back to the full wall. Only the masthead and the two
// contents columns (INDEX) are fixed to the screen. Motion blur is on (180 deg shutter).
// Every event comes from the edited voice-over (timing/vo.json) and the beat plan (timing/plan.json:
// counter hits on the music grid, the music button after "No limits").

export const DURATION = 42 * FPS;
const f = (sec: number) => Math.round(sec * FPS);

// eases (CSS cubic-bezier; converted exactly to AE speed/influence)
const SOFT: Bezier = [0.45, 0, 0.55, 1]; // drifts, fades
const MOVE: Bezier = [0.65, 0, 0.25, 1]; // camera moves: build up, long landing
const PUSH: Bezier = [0.5, 0, 0.15, 1]; // push into a hero, landing on the beat
const OUT: Bezier = [0.2, 0.7, 0.2, 1]; // entrances: quick start, soft settle
const EXIT: Bezier = [0.55, 0, 0.75, 0.45]; // exits: lift off
const WIPE: Bezier = [0.7, 0, 0.2, 1]; // rules and type wipes
const COUNT: Bezier = [0.4, 0, 0.2, 1]; // counter steps

// ------------------------------------------------------------------ timing
type Word = {text: string; start: number; end: number; syllables: number[]; chunk: number};
const words = vo.words as Word[];
const clean = (s: string) => s.replace(/[^A-Za-z-]/g, '').toLowerCase();
function word(text: string, nth = 0): Word {
  const hits = words.filter((w) => clean(w.text) === clean(text));
  if (!hits[nth]) throw new Error(`word ${text}#${nth} not in VO`);
  return hits[nth];
}
const LEAD = 0.03; // picture leads the sound by ~2 frames
const at = (w: Word) => w.start - LEAD;
const HIT = {90: plan.hits['90'], 180: plan.hits['180'], 270: plan.hits['270'], 360: plan.hits['360']};

/** Event times in seconds. */
export const S = {
  typeStart: 0.1,
  video: at(word('video')),
  every: at(word('every')),
  brk: at(word('one', 0)), // "...and ONE team": the brief breaks into the 12 slots
  // tiles 3, 6, 9 and 12 land on the counter hits (on the music grid); the others on their verbs
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
    HIT[360],
  ],
  halfway: at(word('halfway')),
  wall: 28.6, // the pull-back lands on the full wall
  oneCampaign: at(word('campaign')),
  endOut: 31.75, // tiles, ruler and status give way to the sign-off
  name: at(word('onemarsmedia')),
  nameEnd: word('onemarsmedia').end,
  oneTeam: at(word('one', 3)),
  noLimits: at(word('no')),
  lift: 37.1, // after the voice: the sign-off and contents give way to the final card
  button: plan.music.button, // the music's last hit: the credits land
};
const ON = S.tileOn.map(f);
// tile i is "active" (red) until the next tile lands; the last one until the wall.
// FILMING is the exception: its hero shows the dark viewfinder look from the approved frame (f2).
const ACTIVE_OFF = ON.map((t, i) => (i === 2 ? t : i < 11 ? ON[i + 1] : f(S.wall)));
export const T = {tileOn: ON, brk: f(S.brk), endOut: f(S.endOut), button: f(S.button)};

// ------------------------------------------------------------------ camera
// c = world point at the centre of the screen, z = zoom (%). WORLD position = -c, CAMERA scale = z.
type Cam = {t: number; c: Vec2; z: number; e?: Bezier};
const CAMERA: Cam[] = [
  {t: 0, c: [960, 540], z: 100, e: SOFT}, // slow push while the brief is typed (headline and memo stay in frame)
  {t: 3.4, c: [955, 530], z: 102.5, e: SOFT},
  {t: 5.6, c: [958, 522], z: 104.5, e: MOVE},
  {t: 7.2, c: [960, 540], z: 100, e: SOFT}, // out to the page as the brief breaks into the grid
  {t: 8.6, c: [960, 540], z: 101.5, e: MOVE},
  {t: 9.8, c: [540, 300], z: 172, e: SOFT}, // "It starts with the idea": row 1, left
  {t: 11.2, c: [595, 290], z: 175.5, e: PUSH},
  {t: S.tileOn[2], c: [948, 233.5], z: 320, e: SOFT}, // 090: FILMING hero (tile at the left margin, as f2)
  {t: 13.2, c: [952, 236], z: 326, e: MOVE},
  {t: 14.3, c: [1310, 300], z: 172, e: SOFT}, // "Then we shape it": row 1, right
  {t: 16.3, c: [1370, 290], z: 176, e: MOVE},
  {t: 17.1, c: [1452, 845], z: 205, e: SOFT}, // "That's halfway": the counter
  {t: 17.9, c: [1452, 845], z: 210, e: MOVE},
  {t: 19.0, c: [540, 620], z: 172, e: SOFT}, // "Now take it everywhere": row 2 + the status line
  {t: 22.2, c: [600, 620], z: 176, e: MOVE},
  {t: 23.0, c: [1310, 620], z: 172, e: SOFT}, // row 2, right
  {t: 25.1, c: [1362, 612], z: 175.5, e: PUSH},
  {t: S.tileOn[11], c: [1854, 511], z: 320, e: SOFT}, // 360: DISTRIBUTION hero
  {t: 27.0, c: [1854, 511], z: 326, e: MOVE},
  {t: S.wall, c: [960, 540], z: 100, e: SOFT}, // "That's three-sixty": the whole wall
  {t: 31.8, c: [960, 540], z: 101.5, e: MOVE},
  {t: 32.6, c: [960, 540], z: 100, e: SOFT}, // the sign-off and the final card
  {t: 42, c: [960, 540], z: 101.5},
];
const camPos: Prop<Vec2> = {keys: CAMERA.map((k) => key(f(k.t), [-k.c[0], -k.c[1]] as Vec2, k.e))};
const camScale: Prop<Vec2> = {keys: CAMERA.map((k) => key(f(k.t), [k.z, k.z] as Vec2, k.e))};

// ------------------------------------------------------------------ small builders
const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100): ShapeItem => ({
  geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2]},
  fill: {color, opacity},
});
const vline = (x: number, y0: number, y1: number, color: string, width: number, opacity = 100): ShapeItem => ({
  geo: {type: 'path', path: {v: [[x, y0], [x, y1]], closed: false}},
  stroke: {color, width, opacity},
});
/** Letter-spacing in px (as in frames.html) to AE tracking. */
const ls = (px: number, size: number) => (px / size) * 1000;
const holdKeys = <T>(pairs: Array<[number, T]>): Prop<T> => ({keys: pairs.map(([t, v], i) => key(t, v, i < pairs.length - 1 ? 'hold' : undefined))});

/**
 * Entrance / exit for a layer that sits at `p`: rises in from `dy` below while fading up, and lifts
 * off by `outDy` while fading out. Times in seconds. Also sets the in/out points.
 */
interface Life {
  in?: number;
  inDur?: number;
  dy?: number;
  out?: number;
  outDur?: number;
  outDy?: number;
}
function life(p: Vec2, l: Life, extra: Transform = {}): {transform: Transform; in?: number; out?: number} {
  const pos: Key<Vec2>[] = [];
  const op: Key<number>[] = [];
  if (l.in !== undefined) {
    const d = l.inDur ?? 0.45;
    const dy = l.dy ?? 18;
    pos.push(key(f(l.in), [p[0], p[1] + dy] as Vec2, OUT), key(f(l.in) + f(d), p));
    op.push(key(f(l.in), 0, SOFT), key(f(l.in) + f(d * 0.8), 100));
  }
  if (l.out !== undefined) {
    const d = l.outDur ?? 0.4;
    const dy = l.outDy ?? 24;
    pos.push(key(f(l.out), p, EXIT), key(f(l.out) + f(d), [p[0], p[1] - dy] as Vec2));
    op.push(key(f(l.out), 100, SOFT), key(f(l.out) + f(d), 0));
  }
  return {
    transform: {...extra, position: pos.length ? {keys: pos} : p, opacity: op.length ? {keys: op} : extra.opacity},
    in: l.in !== undefined ? f(l.in) : undefined,
    out: l.out !== undefined ? f(l.out) + f(l.outDur ?? 0.4) : undefined,
  };
}

function text(name: string, s: string, x: number, y: number, font: (typeof FONT)[keyof typeof FONT], size: number, color: string, extra: Partial<TextLayer> = {}, l?: Life): TextLayer {
  const base: TextLayer = {kind: 'text', name, source: {kind: 'static', text: s}, font, size, color, transform: {position: [x, y]}, ...extra};
  if (!l) return base;
  const lf = life([x, y], l, extra.transform);
  return {...base, transform: lf.transform, in: lf.in ?? base.in, out: lf.out ?? base.out};
}

/** Scale-X wipe from the left edge (rules). Seconds. */
const wipeX = (x: number, y: number, t: number, dur: number): Pick<Layer, 'transform'> => ({
  transform: {anchor: [x, y], position: [x, y], scale: {keys: [key(f(t), [0, 100] as Vec2, WIPE), key(f(t) + f(dur), [100, 100] as Vec2)]}},
});

/** Alpha-matte rectangle that grows left -> right (type wipes). Seconds. */
function wipeMatte(name: string, x: number, y: number, w: number, h: number, t: number, dur: number): Layer {
  return {
    kind: 'shape',
    name,
    matteSource: true,
    items: [rect(0, 0, w, h, '#FFFFFF')],
    transform: {anchor: [0, 0], position: [x, y], scale: {keys: [key(f(t), [0, 100] as Vec2, WIPE), key(f(t) + f(dur), [100, 100] as Vec2)]}},
    in: f(t),
  };
}

const fadeOut = (t: number, dur = 0.35): Prop<number> => ({keys: [key(t, 100, SOFT), key(t + f(dur), 0)]});
const fadeIn = (t: number, dur = 0.35): Prop<number> => ({keys: [key(t, 0, SOFT), key(t + f(dur), 100)]});
const tc_ = (n: string) => (n === 'AI' ? 'AI' : n.charAt(0) + n.slice(1).toLowerCase());

function guideItems(y0: number, y1: number, op: number, minX = 0, cols: [number, number] = [0, 12]): ShapeItem[] {
  const items: ShapeItem[] = [];
  for (let k = cols[0]; k < cols[1]; k++) {
    const x = colX(k);
    for (const gx of [x + 0.5, x + COLW - 0.5]) if (gx > minX) items.push(vline(gx, y0, y1, C.ink, 1, op));
  }
  return items;
}

// ------------------------------------------------------------------ 360 device precomp
// Giant Anton numerals that fill like a gauge, a seam, and a degree ring drawn with Trim Paths.
// ONE slider ("360 CONTROL" > Degrees) drives digits, gauge, ring and the zero tick.
const DEG = {w: 760, h: 420, xr: 740, base: 390};

function degreesComp(): Comp {
  const Sz = DEG_SIZE;
  const adv = metrics.antonDigitAdv * Sz;
  const wDigits = adv * 3;
  const capH = metrics.antonCap0 * Sz;
  const rr = Sz * 0.118;
  const rsw = Sz * 0.062;
  const ringW = rr * 2 + rsw;
  const gapR = Sz * 0.05;
  const x0 = DEG.xr - (wDigits + gapR + ringW);
  const base = DEG.base;
  const cx = x0 + wDigits + gapR + ringW / 2;
  const cy = base - capH + ringW / 2;
  const seamY = base - capH / 2;
  const CTRL = '360 CONTROL';
  const deg = {link: {layer: CTRL, slider: 'Degrees'}};

  // Degrees: +30 on every tile, counted up over 0.35 s (the last step, the 360 lock, over 0.5 s)
  const dk: Key<number>[] = [key(0, 0, 'hold')];
  ON.forEach((t, i) => {
    dk.push(key(t, i * 30, COUNT));
    dk.push(key(t + f(i === 11 ? 0.5 : 0.35), (i + 1) * 30, i < 11 ? 'hold' : undefined));
  });

  const layers: Layer[] = [
    {kind: 'null', name: CTRL, sliders: [{name: 'Degrees', value: {keys: dk}}], label: 2},
    // gauge matte: rises from the baseline by Degrees/360
    {
      kind: 'shape',
      name: 'gauge matte',
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
      source: {kind: 'counterDigit', value: deg, pad: 3, index: k},
      font: FONT.anton,
      size: Sz,
      color: C.ink,
      noFill: true,
      stroke: {color: C.ink, width: Math.max(2.5, Sz / 110)},
      justify: 'center',
      transform: {position: [x, base]},
    });
    layers.push({
      kind: 'text',
      name: `digit ${k + 1} fill`,
      source: {kind: 'counterDigit', value: deg, pad: 3, index: k},
      font: FONT.anton,
      size: Sz,
      color: C.ink,
      justify: 'center',
      transform: {position: [x, base]},
      matte: {layer: 'gauge matte', type: 'alpha'},
    });
  }
  layers.push({kind: 'shape', name: 'seam', items: [rect(x0 + Sz * 0.02, seamY - Sz * 0.006, wDigits - Sz * 0.05, Math.max(3, Sz * 0.012), C.paper)]});
  // ring: hairline track (hidden at 360), red arc (Trim Paths End = Degrees/360), zero tick
  layers.push({
    kind: 'shape',
    name: 'ring track',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.ink, width: Math.max(1.5, Sz / 220), opacity: {link: {layer: CTRL, slider: 'Degrees', mul: -100, add: 36000, min: 0, max: 35}}}}],
  });
  layers.push({
    kind: 'shape',
    name: 'ring arc',
    items: [{geo: {type: 'path', path: circlePath(cx, cy, rr)}, stroke: {color: C.red, width: rsw, cap: 'butt'}, trim: {end: {link: {layer: CTRL, slider: 'Degrees', mul: 100 / 360, min: 0, max: 100}}}}],
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
const degreesLayer = (name: string, xr: number, base: number, scale = 100, extra: Partial<Layer> = {}): Layer =>
  ({
    kind: 'precomp',
    name,
    comp: 'DEGREES 360',
    collapse: true,
    transform: {anchor: [DEG.xr, DEG.base], position: [xr, base], scale: [scale, scale]},
    ...extra,
  }) as Layer;

// ------------------------------------------------------------------ band
const FADE = f(0.3);
const nowX = (n: number) => M + (metrics.deliverables as Record<string, number>)[String(n)] + 34;

/** Left half of the band: label, "N of 12 deliverables", "Now: ...", the 12-segment ruler. */
function bandStatusComp(): Comp {
  const layers: Layer[] = [];
  const Y = BAND_Y + 94;
  layers.push({kind: 'null', name: 'BAND CONTROL', sliders: [{name: 'Tiles', value: holdKeys([[0, 0], ...ON.map((t, i): [number, number] => [t, i + 1])])}], label: 2});
  layers.push(text('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', M, BAND_Y + 48, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}, {in: 0.33}));
  layers.push(text('0 of 12 deliverables', '0 of 12 deliverables', M, Y, FONT.sg600, 36, C.gr, {out: ON[0]}, {in: 0.38}));
  layers.push({
    kind: 'text',
    name: 'N of 12 deliverables',
    source: {kind: 'counter', value: {link: {layer: 'BAND CONTROL', slider: 'Tiles'}}, pad: 1, suffix: ' of 12 deliverables'},
    font: FONT.sg600,
    size: 36,
    color: C.ink,
    transform: {position: [M, Y]},
    in: ON[0],
  });
  // "Now: 10 Apps" follows the count; "Halfway." on the VO, "One campaign." on the wall
  const nowKeys: Array<[number, string, number]> = ON.map((t, i) => {
    const {num, name} = tileInfo(i);
    return [t, `Now: ${num} ${tc_(name)}`, i + 1];
  });
  nowKeys.splice(6, 0, [f(S.halfway), 'Halfway.', 6]);
  nowKeys.push([f(S.oneCampaign), 'One campaign.', 12]);
  layers.push({
    kind: 'text',
    name: 'Now',
    source: {kind: 'keyed', keys: nowKeys.map(([t, s], i) => key(t, s, i < nowKeys.length - 1 ? 'hold' : undefined))},
    font: FONT.sg800,
    size: 36,
    color: C.red,
    transform: {position: holdKeys(nowKeys.map(([t, , n]): [number, Vec2] => [t, [nowX(n), Y]]))},
    in: ON[0],
  });
  // ruler: 12 segments (30 deg each) + 0/90/180/270/360 ticks
  const n = 12;
  const g = 6;
  const w = 900;
  const sw = (w - g * (n - 1)) / n;
  const cy = RUL_Y + RUL_H;
  for (let i = 0; i < n; i++) {
    const sx = M + i * (sw + g);
    const lbl = String(i + 1).padStart(2, '0');
    const on = ON[i];
    const off = ACTIVE_OFF[i];
    const tIn = 0.42 + i * 0.03;
    const slotLife = life([0, 0], {in: tIn, inDur: 0.4, dy: 10});
    layers.push({kind: 'shape', name: `ruler ${lbl} slot`, items: [{geo: {type: 'rect', size: [sw - 1.5, RUL_H - 1.5], center: [sx + sw / 2, RUL_Y + RUL_H / 2]}, stroke: {color: C.gr, width: 1.5}}], ...slotLife});
    // fill wipes up from the bottom; the red (active) fill dissolves into the ink (done) fill
    const fillT: Transform = {anchor: [sx, cy], position: [sx, cy], scale: {keys: [key(on, [100, 0] as Vec2, WIPE), key(on + f(0.3), [100, 100] as Vec2)]}};
    layers.push({kind: 'shape', name: `ruler ${lbl} done`, items: [rect(sx, RUL_Y, sw, RUL_H, C.ink)], transform: fillT, in: on});
    if (off > on) layers.push({kind: 'shape', name: `ruler ${lbl} active`, items: [rect(sx, RUL_Y, sw, RUL_H, C.red)], transform: {...fillT, opacity: fadeOut(off, 0.3)}, in: on, out: off + FADE});
    const num = (suffix: string, color: string, inF: number, outF: number | undefined, opacity?: Prop<number>) => {
      if (outF === undefined || outF > inF) layers.push(text(`ruler ${lbl} number ${suffix}`, lbl, sx + 9, RUL_Y + RUL_H - 11, FONT.sg800, 20, color, {in: inF, out: outF, transform: {position: [sx + 9, RUL_Y + RUL_H - 11], opacity}}));
    };
    const swap = on + f(0.12);
    num('waiting', C.gr, f(tIn), swap, fadeIn(f(tIn), 0.3));
    if (off > on) {
      num('now', C.ink, swap, off + FADE, fadeOut(off, 0.3));
      num('done', C.paper, off, undefined, fadeIn(off, 0.3));
    } else num('done', C.paper, swap, undefined);
  }
  const ticks: ShapeItem[] = [];
  for (let k = 0; k <= 4; k++) {
    const tx = k === 4 ? M + w - 1 : k === 0 ? M + 1 : M + k * 3 * (sw + g) - g / 2;
    ticks.push(vline(tx, RUL_Y + RUL_H + 6, RUL_Y + RUL_H + 18, C.ink, 2));
    layers.push(text(`tick ${k * 90}`, `${k * 90}°`, tx, RUL_Y + RUL_H + 18 + 18 + 4, FONT.sg700, 18, C.ink, {justify: k === 0 ? 'left' : k === 4 ? 'right' : 'center'}, {in: 0.55 + k * 0.03, dy: 10}));
  }
  layers.push({kind: 'shape', name: 'ruler ticks', items: ticks, ...life([0, 0], {in: 0.55, dy: 10})});
  return {name: 'BAND STATUS', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

function bandComp(): Comp {
  const layers: Layer[] = [
    {kind: 'shape', name: 'band rule', items: [rect(M, BAND_Y, W - 2 * M, 2.5, C.ink)], ...wipeX(M, BAND_Y, 0.13, 0.5)},
    // the status half gives way to the sign-off lockup
    {kind: 'precomp', name: 'BAND STATUS', comp: 'BAND STATUS', collapse: true, transform: {opacity: fadeOut(T.endOut, 0.35)}, out: T.endOut + f(0.35)},
    degreesLayer('360', W - M, BASE, 100, {transform: {anchor: [DEG.xr, DEG.base], ...life([W - M, BASE], {in: 0.46, inDur: 0.6, dy: 24}).transform, scale: [100, 100]}, in: f(0.46)}),
  ];
  return {name: 'BAND', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ grid of tiles
export const gridPos = (i: number): Vec2 => [colX((i % 6) * 2), GRID_Y0 + Math.floor(i / 6) * (TILE.h + ROW_GAP)];

// The brief headline is cut into a 6 x 2 grid of slices; slice k flies to tile k's slot.
const CELL = {x0: 54, w: 170, rows: [120, 384, 650]};
const sliceStart = (k: number) => S.brk + 0.03 * (k % 6) + 0.05 * Math.floor(k / 6);
const SLICE_DUR = 0.7;
function slicePos(k: number): Prop<Vec2> {
  const c = k % 6;
  const r = Math.floor(k / 6);
  const [tx, ty] = gridPos(k);
  const h = CELL.rows[r + 1] - CELL.rows[r];
  const d: Vec2 = [tx + TILE.w / 2 - (CELL.x0 + c * CELL.w + CELL.w / 2), ty + TILE.h / 2 - (CELL.rows[r] + h / 2)];
  const s0 = f(sliceStart(k));
  const b = f(S.brk);
  return {keys: [...(s0 > b ? [key(b, [0, 0] as Vec2, 'hold')] : []), key(s0, [0, 0] as Vec2, [0.55, 0, 0.1, 1]), key(s0 + f(SLICE_DUR), d)]};
}
const slotIn = (k: number) => sliceStart(k) + 0.32; // the reserved slot fades up under its slice
const waveOut = (k: number) => S.endOut + 0.045 * (5 - (k % 6) + Math.floor(k / 6)); // right side first, clearing the contents list

function gridComp(): Comp {
  const layers: Layer[] = [];
  for (let i = 0; i < 12; i++) {
    const [x, y] = gridPos(i);
    const {num, name} = tileInfo(i);
    const a = f(slotIn(i));
    const b = f(waveOut(i));
    layers.push({
      kind: 'precomp',
      name: `${num} ${name}`,
      comp: `TILE ${num} ${name}`,
      collapse: true,
      transform: {
        anchor: [0, 0],
        position: {keys: [key(a, [x, y + 26] as Vec2, OUT), key(a + f(0.55), [x, y] as Vec2), key(b, [x, y] as Vec2, EXIT), key(b + f(0.4), [x, y - 30] as Vec2)]},
        opacity: {keys: [key(a, 0, SOFT), key(a + f(0.4), 100), key(b, 100, SOFT), key(b + f(0.4), 0)]},
      },
      in: a,
      out: b + f(0.4),
    });
  }
  return {name: 'GRID', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ contents columns (screen-fixed)
function indexComp(name: string, current: number): Comp {
  const cx = 1200;
  const x0 = colX(8);
  const x1 = W - M;
  const layers: Layer[] = [
    {kind: 'shape', name: 'column paper', items: [rect(cx, 0, W - cx + 40, H, C.paper)]},
    {kind: 'shape', name: 'column guides', items: guideItems(64, H, 6, cx)},
    {kind: 'shape', name: 'column divider', items: [rect(cx, 64, 3, H - 64, C.ink)]},
    text('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', x0, 128, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}),
  ];
  // two states that swap on the tile's hit: before (tile current-1 highlighted) and after (current)
  const hit = ON[current];
  for (const [state, cur, inF, outF] of [
    ['before', current - 1, 0, hit],
    ['now', current, hit, undefined],
  ] as Array<[string, number, number, number | undefined]>) {
    const rh = 38;
    const ry0 = 150;
    const rows: ShapeItem[] = [];
    const span = {in: inF || undefined, out: outF};
    layers.push(text(`${state} count`, `${cur + 1} / 12`, x1, 128, FONT.sg800, 19, C.ink, {justify: 'right', ...span}));
    for (let i = 0; i < 12; i++) {
      const {num, name: nm} = tileInfo(i);
      const y = ry0 + i * rh;
      const done = i < cur;
      const isCur = i === cur;
      if (isCur) rows.push(rect(x0, y, x1 - x0, rh, C.red));
      else rows.push(rect(x0, y + rh - 1, x1 - x0, 1, C.ink, done ? 50 : 18));
      const col = isCur || done ? C.ink : C.gr;
      layers.push(text(`${state} row ${num} number`, num, x0 + (isCur ? 12 : 0), y + 27, FONT.sg800, 19, col, span));
      layers.push(text(`${state} row ${num} name`, tc_(nm), x0 + (isCur ? 64 : 52), y + 27, isCur ? FONT.sg800 : FONT.sg600, 21, col, span));
      layers.push(
        text(`${state} row ${num} degrees`, `${String((i + 1) * 30).padStart(3, '0')}°`, x1 - (isCur ? 12 : 0), y + 27, FONT.sg700, 19, col, {
          justify: 'right',
          transform: {position: [x1 - (isCur ? 12 : 0), y + 27], opacity: done || isCur ? 100 : 80},
          ...span,
        }),
      );
    }
    layers.push({kind: 'shape', name: `${state} rows`, items: rows, ...span});
  }
  layers.push({kind: 'shape', name: 'column rule', items: [rect(x0, BAND_Y + 30, x1 - x0, 2.5, C.ink)]});
  layers.push(degreesLayer('360 small', W - M, BASE, (300 / DEG_SIZE) * 100));
  return {name, width: W, height: H, fps: FPS, duration: DURATION, layers};
}

/** The contents columns slide in from the right edge and back out (seconds). */
const SLIDES: Array<[string, number, number]> = [
  ['INDEX 03 FILMING', S.tileOn[2] - 0.55, 13.2],
  ['INDEX 12 DISTRIBUTION', S.tileOn[11] - 0.55, 27.6],
];
function slideKeys(tIn: number, tOut: number): Prop<Vec2> {
  const off: Vec2 = [W - 1200 + 40, 0];
  return {keys: [key(f(tIn), off, OUT), key(f(tIn + 0.5), [0, 0] as Vec2), key(f(tOut), [0, 0] as Vec2, EXIT), key(f(tOut + 0.45), off)]};
}
const slideLayer = ([comp, tIn, tOut]: [string, number, number]): Layer => ({
  kind: 'precomp',
  name: comp,
  comp,
  transform: {position: slideKeys(tIn, tOut)},
  in: f(tIn),
  out: f(tOut + 0.45),
  label: 11,
});

// ------------------------------------------------------------------ the brief
function briefTypeComp(): Comp {
  const charKeys: Key<number>[] = [key(0, 0, 'hold')];
  typeOnsets.slice(0, 17).forEach((s: number, i: number) => charKeys.push(key(f(S.typeStart + s), i + 1, i < 16 ? 'hold' : undefined)));
  return {
    name: 'BRIEF TYPE',
    width: W,
    height: H,
    fps: FPS,
    duration: DURATION,
    layers: [
      {
        kind: 'text',
        name: 'brief headline',
        source: {kind: 'typeOn', text: 'We need\na launch.', chars: {keys: charKeys}},
        font: FONT.anton,
        size: BIG,
        leading: L2 - L1,
        color: C.ink,
        transform: {position: [M - 5, L1]},
      },
    ],
  };
}

function briefLayers(): Layer[] {
  const brk = S.brk;
  const capH = metrics.antonCapH * BIG;
  const layers: Layer[] = [];
  layers.push(text('THE BRIEF', 'THE BRIEF', M, 112, FONT.sg800, 19, C.red, {tracking: ls(3, 19)}, {in: 0.2, out: brk - 0.2}));
  // memo: TO / FROM / RE, then the twist rows on the voice-over
  const mx = colX(8);
  const rows: Array<[string, string, number]> = [
    ['TO', 'Onemarsmedia', 0.27],
    ['FROM', 'Brand team', 0.34],
    ['RE', 'Launch', 0.41],
    ['NEED', 'A video', S.video],
  ];
  rows.forEach(([k, v, t], i) => {
    const y = 112 + i * 40;
    const out = brk - 0.25 + i * 0.04;
    layers.push(text(`memo ${k} key`, k, mx, y, FONT.sg800, 17, C.gr, {tracking: ls(1.6, 17)}, {in: t, out}));
    layers.push(text(`memo ${k} value`, v, mx + 151, y, FONT.sg600, 24, C.ink, {}, {in: t + 0.04, out}));
    layers.push({
      kind: 'shape',
      name: `memo ${k} rule`,
      items: [rect(mx, y + 14, 584, 1, C.ink, 22)],
      transform: {anchor: [mx, y + 14], position: [mx, y + 14], scale: {keys: [key(f(t), [0, 100] as Vec2, WIPE), key(f(t + 0.4), [100, 100] as Vec2)]}, opacity: fadeOut(f(out), 0.4)},
      in: f(t),
      out: f(out + 0.4),
    });
  });
  // "every angle": strike the video, write the real need
  const sy = 112 + 3 * 40 - 8;
  const out3 = brk - 0.25 + 3 * 0.04;
  layers.push({
    kind: 'shape',
    name: 'strike A video',
    items: [rect(mx + 151 - 4, sy, 104, 3, C.red)],
    transform: {anchor: [mx + 147, sy], position: [mx + 147, sy], scale: {keys: [key(f(S.every), [0, 100] as Vec2, WIPE), key(f(S.every + 0.25), [100, 100] as Vec2)]}, opacity: fadeOut(f(out3), 0.4)},
    in: f(S.every),
    out: f(out3 + 0.4),
  });
  const ex = mx + 151 + 118;
  const ey = 112 + 3 * 40;
  layers.push(wipeMatte('Every angle wipe', ex - 4, ey - 30, 170, 42, S.every + 0.15, 0.4));
  layers.push(text('memo NEED new', 'Every angle.', ex, ey, FONT.sg800, 24, C.red, {in: f(S.every + 0.15), matte: {layer: 'Every angle wipe', type: 'alpha'}}, {out: out3}));

  // the headline: one layer until the break, then 12 slices that fly to the tile slots
  layers.push({kind: 'precomp', name: 'brief type', comp: 'BRIEF TYPE', collapse: true, out: f(brk)});
  for (let k = 0; k < 12; k++) {
    const c = k % 6;
    const r = Math.floor(k / 6);
    const x = CELL.x0 + c * CELL.w;
    const y0 = CELL.rows[r];
    const h = CELL.rows[r + 1] - y0;
    const s0 = f(sliceStart(k));
    const lbl = String(k + 1).padStart(2, '0');
    layers.push({kind: 'shape', name: `brief cell ${lbl}`, matteSource: true, parent: `brief slice ${lbl}`, items: [rect(x, y0, CELL.w, h, '#FFFFFF')], in: f(brk)});
    layers.push({
      kind: 'precomp',
      name: `brief slice ${lbl}`,
      comp: 'BRIEF TYPE',
      collapse: true,
      matte: {layer: `brief cell ${lbl}`, type: 'alpha'},
      transform: {
        anchor: [0, 0],
        position: slicePos(k),
        opacity: {keys: [key(s0 + f(0.36), 100, SOFT), key(s0 + f(SLICE_DUR), 0)]},
      },
      in: f(brk),
      out: s0 + f(SLICE_DUR),
    });
  }
  // cursor: follows the typing, blinks, and goes out just before the break
  const p1 = metrics.brief.line1;
  const p2 = metrics.brief.line2;
  const curPos: Array<[number, Vec2]> = [[0, [M - 5 + 18, L1]]];
  typeOnsets.slice(0, 17).forEach((s: number, i: number) => {
    const n = i + 1; // characters typed
    const pos: Vec2 = n <= 7 ? [M - 5 + p1[n] + 18, L1] : [M - 5 + p2[Math.max(0, n - 8)] + 18, L2];
    curPos.push([f(S.typeStart + s), pos]);
  });
  const typed = f(S.typeStart + typeOnsets[16]);
  const cursorOut = f(brk - 0.1);
  const blink: Array<[number, number]> = [[0, 100]];
  for (let t = typed + f(0.4), on = false; t < cursorOut; t += f(0.4), on = !on) blink.push([t, on ? 100 : 0]);
  layers.push({
    kind: 'shape',
    name: 'cursor',
    items: [rect(0, -capH, 30, capH, C.red)],
    transform: {position: holdKeys(curPos), opacity: holdKeys(blink)},
    out: cursorOut,
  });
  return layers;
}

// ------------------------------------------------------------------ masthead (screen-fixed)
function mastheadLayers(): Layer[] {
  const e = S.endOut + 0.1;
  return [
    {kind: 'shape', name: 'masthead paper', items: [rect(0, 0, W, 64, C.paper)]},
    {kind: 'shape', name: 'masthead rule', items: [rect(M, 62, W - 2 * M, 2.5, C.ink)], ...wipeX(M, 62, 0, 0.5)},
    text('masthead Onemarsmedia', 'Onemarsmedia', M, 46, FONT.sg800, 19, C.ink, {tracking: ls(-0.2, 19)}, {in: 0.08, dy: 10, out: e, outDy: 10}),
    {
      ...text('masthead tagline', 'One brief. The whole campaign.', colX(4), 46, FONT.sg600, 19, C.ink),
      transform: {
        position: {keys: [key(f(0.12), [colX(4), 56] as Vec2, OUT), key(f(0.57), [colX(4), 46] as Vec2), key(f(e + 0.15), [colX(4), 46] as Vec2, MOVE), key(f(e + 0.9), [M, 46] as Vec2)]},
        opacity: fadeIn(f(0.12), 0.36),
      },
      in: f(0.12),
    },
    text('masthead url', 'onemarsmedia.com', W - M, 46, FONT.sg600, 19, C.gr, {justify: 'right'}, {in: 0.16, dy: 10, out: e, outDy: 10}),
    text('masthead sign-off', 'One team. No limits.', W - M, 46, FONT.sg600, 19, C.ink, {justify: 'right'}, {in: S.button + 0.3, dy: 10}),
  ];
}

// ------------------------------------------------------------------ the sign-off and the final card (in the world)
function endCardLayers(): Layer[] {
  const layers: Layer[] = [];
  const lift = S.lift;
  // sign-off lines wipe on with the voice; their red full stops follow; after the voice they lift off
  const line = (name: string, s: string, y: number, w: number, t: number, k: number) => {
    layers.push(wipeMatte(`${name} wipe`, M - 12, y - BIG * 1.1, w + 24, BIG * 1.3, t, 0.45));
    layers.push(text(name, s, M - 5, y, FONT.anton, BIG, C.ink, {in: f(t), matte: {layer: `${name} wipe`, type: 'alpha'}}, {out: lift + 0.05 * k, outDur: 0.45, outDy: 30}));
    layers.push(text(`${name} dot`, '.', M - 5 + w, y, FONT.anton, BIG, C.red, {}, {in: t + 0.28, inDur: 0.35, dy: 14, out: lift + 0.05 * k + 0.03, outDur: 0.45, outDy: 30}));
  };
  line('One team', 'One team', L1, metrics.signoff.oneTeam, S.oneTeam, 0);
  line('No limits', 'No limits', L2, metrics.signoff.noLimits, S.noLimits, 1);
  // the whole campaign, as a contents list (lifts off with the sign-off)
  const x0 = colX(8);
  const x1 = W - M;
  const c0 = S.endOut + 0.65;
  layers.push(text('end THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', x0, 112, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}, {in: c0, out: lift}));
  layers.push(text('end count', '12 / 12', x1, 112, FONT.sg800, 19, C.red, {justify: 'right'}, {in: c0, out: lift}));
  for (let i = 0; i < 12; i++) {
    const {num, name} = tileInfo(i);
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    const x = col ? colX(10) : x0;
    const y = 160 + row * 40;
    const t = c0 + 0.08 + i * 0.035;
    const o = lift + 0.03 + i * 0.02;
    layers.push(text(`end row ${num} number`, num, x, y, FONT.sg800, 18, C.gr, {}, {in: t, dy: 12, out: o}));
    layers.push(text(`end row ${num} name`, tc_(name), x + 38, y, FONT.sg600, 22, C.ink, {}, {in: t + 0.02, dy: 12, out: o}));
    const rw = col ? x1 - colX(10) : colX(10) - 20 - x0;
    const w = wipeX(x, y + 14, t, 0.45);
    layers.push({kind: 'shape', name: `end row ${num} rule`, items: [rect(x, y + 14, rw, 1, C.ink, 22)], transform: {...w.transform, opacity: fadeOut(f(o), 0.4)}, in: f(t), out: f(o + 0.4)});
  }
  // lockup on the band: descriptor, wordmark (wipes on with the name), URL
  layers.push(text('BRANDED CONTENT PRODUCTION', 'BRANDED CONTENT PRODUCTION, LONDON', M, BAND_Y + 48, FONT.sg800, 19, C.ink, {tracking: ls(3, 19)}, {in: S.endOut + 0.45, out: lift}));
  // the final card: the wordmark rises from the band to the top of the page at twice the size...
  const WM = 220;
  const wmFrom: Vec2 = [M - 5, 934];
  const wmTo: Vec2 = [M - 8, 430];
  const a0 = f(lift + 0.15);
  const a1 = f(S.button);
  // the wipe matte rides with the wordmark: parented to it, in its layer space (origin = the text's baseline start)
  layers.push({...wipeMatte('wordmark wipe', M - 10 - wmFrom[0], -110, metrics.wordmark112 + 30, 140, S.name, 0.55), parent: 'Onemarsmedia wordmark'});
  layers.push(
    text('Onemarsmedia wordmark', 'Onemarsmedia', M - 5, 934, FONT.sg800, 112, C.ink, {
      tracking: ls(-3.8, 112),
      in: f(S.name),
      matte: {layer: 'wordmark wipe', type: 'alpha'},
      transform: {
        anchor: [0, 0],
        position: {keys: [key(a0, wmFrom, MOVE), key(a1, wmTo)]},
        scale: {keys: [key(a0, [100, 100] as Vec2, MOVE), key(a1, [(WM / 112) * 100, (WM / 112) * 100] as Vec2)]},
      },
    }),
  );
  layers.push(text('onemarsmedia.com', 'onemarsmedia.com', M, BASE, FONT.sg600, 40, C.ink, {}, {in: S.nameEnd, dy: 14}));
  // ...and the credits land on the music's last hit
  const c = S.button;
  const credit = (name: string, s: string, x: number, y: number, font: (typeof FONT)[keyof typeof FONT], size: number, color: string, t: number, extra: Partial<TextLayer> = {}) =>
    layers.push(text(name, s, x, y, font, size, color, extra, {in: t, dy: 14}));
  credit('credit PRODUCTION', 'PRODUCTION', M, 760, FONT.sg800, 17, C.gr, c, {tracking: ls(1.6, 17)});
  credit('credit company', 'Onemarsmedia Limited', M, 806, FONT.sg700, 34, C.ink, c + 0.06);
  credit('credit descriptor', 'Branded content production, London', M, 842, FONT.sg600, 22, C.gr, c + 0.12);
  credit('credit DIRECTED BY', 'DIRECTED BY', colX(4), 760, FONT.sg800, 17, C.gr, c + 0.1, {tracking: ls(1.6, 17)});
  credit('credit director', 'Marek Mars', colX(4), 806, FONT.sg700, 34, C.ink, c + 0.16);
  return layers;
}

// ------------------------------------------------------------------ scene
export function buildEditorialScene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  for (let i = 0; i < 12; i++) buildTileComps(i, DURATION, FPS, {on: ON[i], activeOff: ACTIVE_OFF[i], loopEnd: f(waveOut(i) + 0.4)}).forEach(add);
  add(degreesComp());
  add(bandStatusComp());
  add(bandComp());
  add(gridComp());
  add(briefTypeComp());
  add(indexComp('INDEX 03 FILMING', 2));
  add(indexComp('INDEX 12 DISTRIBUTION', 11));

  add({
    name: 'WORLD',
    width: W,
    height: H,
    fps: FPS,
    duration: DURATION,
    layers: [
      // column guides run past the page on every side so the camera never finds their ends
      {kind: 'shape', name: 'guides', items: guideItems(-400, H + 400, 7, -Infinity, [-4, 16]), label: 16},
      {kind: 'precomp', name: 'GRID', comp: 'GRID', collapse: true, label: 10},
      ...briefLayers(),
      {kind: 'precomp', name: 'BAND', comp: 'BAND', collapse: true, label: 13},
      ...endCardLayers(),
    ],
  });

  const main: Comp = {
    name: 'Onemarsmedia 360',
    width: W,
    height: H,
    fps: FPS,
    duration: DURATION,
    bg: C.paper,
    motionBlur: {shutterAngle: 180, samples: 8, perFrame: blurSamples()},
    markers: [
      {t: 0, label: 'Brief typed: We need a launch.'},
      {t: f(vo.chunks[0].start), label: 'VO: Then you need more than a video.'},
      {t: f(S.every), label: 'VO: You need every angle.'},
      {t: f(S.brk), label: 'The brief breaks into 12 slots'},
      {t: ON[2], label: '090 FILMING hero'},
      {t: ON[5], label: '180'},
      {t: f(S.halfway), label: "That's halfway: the counter"},
      {t: ON[8], label: '270'},
      {t: ON[11], label: '360 lock / music in / DISTRIBUTION hero'},
      {t: f(S.wall), label: 'Full wall'},
      {t: posterFrame(), label: 'Poster frame (website)'},
      {t: T.endOut, label: 'Sign-off'},
      {t: f(S.lift), label: 'Final card: the wordmark rises'},
      {t: T.button, label: 'Music button: credits'},
    ],
    layers: [
      {kind: 'null', name: 'CAMERA', transform: {anchor: [0, 0], position: [W / 2, H / 2], scale: camScale}, label: 2},
      {kind: 'precomp', name: 'WORLD', comp: 'WORLD', collapse: true, parent: 'CAMERA', transform: {anchor: [0, 0], position: camPos}, label: 10},
      ...SLIDES.map(slideLayer),
      ...mastheadLayers(),
    ],
  };
  add(main);

  // the final mix plays; the stems are there (switched off) for a re-mix
  const audio: AudioClip[] = [
    {name: 'Mix (final, -14 LUFS)', file: 'mix.wav', start: 0},
    {name: 'Stem - VO (Joshua)', file: 'vo.wav', start: 0, muted: true},
    {name: 'Stem - Music (ducked)', file: 'music.wav', start: 0, muted: true},
    {name: 'Stem - SFX', file: 'sfx.wav', start: 0, muted: true},
  ];
  return {main: main.name, comps, fonts: Object.values(FONT), audio};
}

/**
 * How far things move on screen during one shutter interval at frame t (px). The renderer uses it to
 * pick the number of motion-blur samples per frame (AE picks its own).
 */
export function motionAmount(t: number): number {
  const half = 0.25; // 180 deg shutter = half a frame, centred on the frame
  const z = (tt: number) => evalVec2(camScale, tt, [100, 100])[0] / 100;
  const c = (tt: number) => evalVec2(camPos, tt, [0, 0]); // = -centre
  const screen = (tt: number, p: Vec2): Vec2 => [W / 2 + z(tt) * (p[0] + c(tt)[0]), H / 2 + z(tt) * (p[1] + c(tt)[1])];
  const world = (tt: number, s: Vec2): Vec2 => [(s[0] - W / 2) / z(tt) - c(tt)[0], (s[1] - H / 2) / z(tt) - c(tt)[1]];
  const dist = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let m = 0;
  // what is under the screen corners now, and where it is at the start / end of the shutter
  for (const s of [[0, 0], [W, 0], [0, H], [W, H]] as Vec2[]) {
    const p = world(t, s);
    m = Math.max(m, dist(screen(t - half, p), screen(t + half, p)));
  }
  for (const [, tIn, tOut] of SLIDES) {
    const k = slideKeys(tIn, tOut);
    m = Math.max(m, dist(evalVec2(k, t - half, [0, 0]), evalVec2(k, t + half, [0, 0])));
  }
  for (let k = 0; k < 12; k++) {
    const p = slicePos(k);
    m = Math.max(m, z(t) * dist(evalVec2(p, t - half, [0, 0]), evalVec2(p, t + half, [0, 0])));
  }
  return m;
}

/** Motion-blur samples per frame for the Remotion render: about one sample per 3 px of motion. */
export function blurSamples(): number[] {
  return Array.from({length: DURATION}, (_, t) => Math.max(1, Math.min(24, Math.ceil(motionAmount(t) / 3))));
}

/** Poster frame for the website: the whole wall, all 12 live, counter at 360. */
export const posterFrame = () => f(30.05);

/** SFX cue list for the mix (seconds), derived from the same timeline. */
export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    {file: 'type.wav', t: S.typeStart, gainDb: -20},
    {file: 'whoosh.wav', t: S.brk - 0.1, gainDb: -32},
    ...S.tileOn.map((t) => ({file: 'tap.wav', t, gainDb: -27})),
    ...[HIT[90], HIT[180], HIT[270]].map((t) => ({file: 'flap.wav', t, gainDb: -27})),
    {file: 'whoosh.wav', t: 11.2 + 0.2, gainDb: -31},
    {file: 'whoosh.wav', t: 25.1 + 0.25, gainDb: -31},
    {file: 'lock.wav', t: HIT[360], gainDb: -20},
    {file: 'whoosh.wav', t: 27.0 + 0.45, gainDb: -30},
    {file: 'whoosh.wav', t: S.lift + 0.3, gainDb: -33},
    {file: 'tap.wav', t: S.oneTeam, gainDb: -28},
    {file: 'tap.wav', t: S.noLimits, gainDb: -28},
  ];
}

