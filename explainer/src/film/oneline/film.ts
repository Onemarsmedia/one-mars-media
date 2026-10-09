import {circlePath, key} from '../../scene/builders';
import {evalNumber} from '../../scene/eval';
import type {Bezier, Comp, Key, Layer, Prop, Scene, ShapeItem, TextLayer, Transform, Vec2} from '../../scene/types';
import {C, FONT} from '../editorial/tokens';
import vo from './vo.json';

// "One line": Onemarsmedia explainer no. 2, built on the Through-line blueprint (BLUEPRINT_OMM_SAAS.md).
// Story shape B, before / after, dark mode. One red line runs through the whole film without a break:
// it underlines the brief, tangles between the suppliers, sweeps the frame from chaos to order, draws the
// project window, the callouts, the timeline and the chart, and underlines the name at the end
// (the last frame repeats the layout of the first, so it loops).

export const FPS = 60;
const W = 1920;
const H = 1080;
const f = (s: number) => Math.round(s * FPS);
export const DURATION = f(43);

const E: Record<'scene' | 'in' | 'out' | 'pop', Bezier> = {
  scene: [0.83, 0, 0.17, 1],
  in: [0.16, 1, 0.3, 1],
  out: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
};
const BG = C.ink;
const CARD = '#1D1B19';
const TXT = C.paper;
const MUTE = '#9A9286';
const RED = C.red;
const LINE_W = 4;

// ------------------------------------------------------------------ timing (edited VO, film time)
type Chunk = {text: string; start: number; end: number};
const ch = (vo as {chunks: Chunk[]}).chunks;
export const T = {
  hook: ch[0].start,
  agency: ch[1].start,
  crew: ch[2].start,
  editor: ch[3].start,
  designer: ch[4].start,
  nobody: ch[5].start,
  pull: ch[6].start,
  plan: ch[7].start,
  shoot: ch[8].start,
  cut: ch[9].start,
  ship: ch[10].start,
  years: ch[11].start,
  brands: ch[12].start,
  adidas: ch[13].start,
  team: ch[14].start,
  line: ch[15].start,
  name: ch[16].start,
  end: ch[16].end,
};
const SWEEP = {t0: T.pull - 0.35, t1: T.pull + 1.55, x1: 260}; // the line sweeps right to left, chaos to order

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
function txt(name: string, s: string, x: number, y: number, font: FontKey, size: number, color: string, extra: Partial<TextLayer> = {}): TextLayer {
  return {kind: 'text', name, source: {kind: 'static', text: s}, font: FONT[font], size, color, transform: {position: [x, y]}, ...extra};
}
const track = (px: number, size: number) => (px / size) * 1000;

/** Enter (rise + fade) at tin, optionally leave at tout. Position p is the layer's resting position. */
function life(p: Vec2, tin: number, tout?: number, dy = 18, dur = 0.55, extra: Partial<Transform> = {}): Transform {
  const pk: Key<Vec2>[] = [key(f(tin), [p[0], p[1] + dy] as Vec2, E.in), key(f(tin + dur), p)];
  const ok: Key<number>[] = [key(f(tin), 0, E.in), key(f(tin + dur * 0.8), 100)];
  if (tout !== undefined) {
    pk.push(key(f(tout), p, E.out), key(f(tout + 0.4), [p[0], p[1] - dy] as Vec2));
    ok.push(key(f(tout), 100, E.out), key(f(tout + 0.4), 0));
  }
  return {position: {keys: pk}, opacity: {keys: ok}, ...extra};
}
const lifeLayer = <L extends Layer>(l: L, tin: number, tout?: number): L => ({...l, in: f(tin), out: tout !== undefined ? f(tout + 0.45) : undefined});

// ------------------------------------------------------------------ the through-line
// A line is a polyline (Catmull-Rom smoothed) drawn by Trim Paths; a small glowing dot rides its tip while
// it draws. Trim keys are given as [time, end %, ease] and [time, start %, ease].
function smooth(pts: Vec2[], n = 14): Vec2[] {
  if (pts.length < 3) return pts;
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const c = (a: number) =>
        0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * u + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * u * u + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * u * u * u);
      out.push([Math.round(c(0) * 10) / 10, Math.round(c(1) * 10) / 10]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const lengths = (pts: Vec2[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return acc;
};
const pointAt = (pts: Vec2[], acc: number[], u: number): Vec2 => {
  const L = acc[acc.length - 1] * Math.min(1, Math.max(0, u));
  let i = 1;
  while (i < acc.length - 1 && acc[i] < L) i++;
  const k = (L - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
};
/** Fraction along the path of the vertex nearest to p (to key the trim to land on a control point). */
const fracAt = (pts: Vec2[], acc: number[], p: Vec2) => {
  let best = 0;
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]) < Math.hypot(pts[best][0] - p[0], pts[best][1] - p[1])) best = i;
  return (acc[best] / acc[acc.length - 1]) * 100;
};
type TrimKey = [number, number, Bezier | 'linear'];
const trimProp = (ks: TrimKey[]): Prop<number> => ({keys: ks.map(([t, v, e], i) => key(f(t), v, i < ks.length - 1 ? e : undefined))});
function line(name: string, pts: Vec2[], end: TrimKey[], start: TrimKey[] = [[0, 0, 'linear']], opts: {width?: number; tip?: boolean; inT?: number; outT?: number} = {}): Layer[] {
  const endP = trimProp(end);
  const startP = trimProp(start);
  const inT = opts.inT ?? end[0][0];
  const outT = opts.outT ?? Math.max(end[end.length - 1][0], start[start.length - 1][0]) + 0.05;
  const layers: Layer[] = [
    {
      kind: 'shape',
      name: `line ${name}`,
      items: [{geo: {type: 'path', path: {v: pts, closed: false}}, stroke: {color: RED, width: opts.width ?? LINE_W, cap: 'round', join: 'round'}, trim: {start: startP, end: endP}}],
      in: f(inT),
      out: f(outT),
      label: 1,
    },
  ];
  if (opts.tip !== false) {
    // the tip glows while the line is drawing: sample the end trim every 2 frames
    const acc = lengths(pts);
    const t0 = end[0][0];
    const t1 = end[end.length - 1][0];
    const pk: Key<Vec2>[] = [];
    for (let fr = f(t0); fr <= f(t1); fr += 2) pk.push(key(fr, pointAt(pts, acc, evalNumber(endP, fr, 0) / 100)));
    const op: Key<number>[] = [key(f(t0), 0, E.in), key(f(t0) + 6, 100), key(f(t1) - 4, 100, E.out), key(f(t1) + 10, 0)];
    layers.push({
      kind: 'shape',
      name: `line ${name} tip`,
      items: [dot([0, 0], 16, RED, 22), dot([0, 0], 6.5, '#FFD9CC')],
      transform: {anchor: [0, 0], position: {keys: pk}, opacity: {keys: op}},
      in: f(t0),
      out: f(t1) + 11,
      label: 1,
    });
  }
  return layers;
}

// ------------------------------------------------------------------ cards (UI rebuilt as layers)
function cardComp(name: string, w: number, h: number, body: Layer[], accent = false): Comp {
  return {
    name,
    width: w,
    height: h,
    fps: FPS,
    duration: DURATION,
    layers: [
      {kind: 'shape', name: 'card', items: [rect(0, 0, w, h, CARD, 100, 18), frame(0.75, 0.75, w - 1.5, h - 1.5, accent ? RED : TXT, 1.5, accent ? 90 : 14, 18)]},
      ...body,
    ],
  };
}
const tag = (s: string, x: number, y: number, color = MUTE) => txt(`tag ${s}`, s, x, y, 'sg800', 15, color, {tracking: track(2.2, 15)});
const row = (s: string, y: number, color = TXT, size = 22, x = 28) => txt(`row ${s}`, s, x, y, 'sg600', size, color);
const bar = (x: number, y: number, w: number, color = TXT, op = 10) => ({kind: 'shape' as const, name: `bar ${x} ${y}`, items: [rect(x, y, w, 10, color, op, 5)]});

function chaosComps(): Comp[] {
  return [
    cardComp('CARD AGENCY', 440, 250, [
      tag('AGENCY', 28, 44),
      {kind: 'shape', name: 'badge', items: [rect(372, 24, 44, 28, RED, 100, 14)]},
      txt('badge 12', '12', 394, 45, 'sg800', 17, '#FFFFFF', {justify: 'center'}),
      row('Re: Re: Re: launch film', 98),
      row('Agency · 2 min ago', 126, MUTE, 17),
      row('Re: Fwd: new deck v3', 172),
      row('Re: budget??', 212, MUTE, 20),
    ]),
    cardComp('CARD CREW', 420, 240, [
      tag('CREW', 28, 44),
      row('Call sheet · Shoot day 1', 96),
      row('Location', 140, MUTE, 19),
      txt('loc tbc', 'TBC', 392, 140, 'sg800', 19, RED, {justify: 'right'}),
      row('Call time', 176, MUTE, 19),
      txt('call tbc', '06:00?', 392, 176, 'sg800', 19, RED, {justify: 'right'}),
      row('Kit list', 212, MUTE, 19),
      txt('kit tbc', 'TBC', 392, 212, 'sg800', 19, RED, {justify: 'right'}),
    ]),
    cardComp('CARD EDITOR', 440, 230, [
      tag('EDITOR', 28, 44),
      row('Edit_v4_FINAL_final.mp4', 96),
      bar(28, 124, 384),
      {kind: 'shape', name: 'progress', items: [rect(28, 124, 238, 10, RED, 100, 5)]},
      row('Notes pending (14)', 180, MUTE, 19),
      row('Export failed', 210, RED, 19),
    ]),
    cardComp('CARD DESIGNER', 420, 240, [
      tag('DESIGNER', 28, 44),
      {kind: 'shape', name: 'file icon', items: [rect(28, 70, 40, 50, TXT, 16, 6), rect(28, 150, 40, 50, TXT, 16, 6)]},
      row('Brand_assets(2).zip', 104, TXT, 21, 84),
      row('Logo_v9_new.ai', 184, TXT, 21, 84),
      row('Fonts missing', 214, RED, 17, 84),
    ]),
  ];
}
const CHAOS = [
  {comp: 'CARD AGENCY', c: [560, 360] as Vec2, w: 440, h: 250, rot: -4, t: T.agency + 0.05},
  {comp: 'CARD CREW', c: [1350, 300] as Vec2, w: 420, h: 240, rot: 3, t: T.crew + 0.05},
  {comp: 'CARD EDITOR', c: [700, 770] as Vec2, w: 440, h: 230, rot: 2.5, t: T.editor + 0.05},
  {comp: 'CARD DESIGNER', c: [1400, 720] as Vec2, w: 420, h: 240, rot: -3, t: T.designer + 0.05},
];
const PILLS: Array<[string, Vec2, number]> = [
  ["Where's the latest cut?", [1040, 170], T.agency + 0.9],
  ['3 new comments', [300, 600], T.editor + 0.5],
  ['Invoice overdue', [1180, 905], T.designer + 0.7],
  ['Who has the brief?', [1590, 520], T.nobody - 0.4],
];

function beforeComp(): Comp {
  const layers: Layer[] = [];
  const tEnd = SWEEP.t1;
  // the tangle: the line threads through every supplier (behind the cards)
  const P: Vec2[] = [
    [1532, 590],
    [1240, 520],
    [760, 400],
    [980, 250],
    [1180, 300],
    [1500, 400],
    [1300, 560],
    [900, 700],
    [620, 820],
    [520, 600],
    [980, 560],
    [1240, 700],
    [1440, 760],
    [1700, 600],
    [1500, 470],
    [1120, 470],
    [960, 540],
  ];
  const pts = smooth(P);
  const acc = lengths(pts);
  const at = (i: number) => fracAt(pts, acc, P[i]);
  layers.push(
    ...line(
      'tangle',
      pts,
      [
        [3.55, 0, E.in],
        [T.agency + 0.35, at(2), E.scene],
        [T.crew + 0.3, at(4), E.scene],
        [T.editor + 0.35, at(8), E.scene],
        [T.designer + 0.4, at(12), E.scene],
        [T.nobody + 1.6, 100, 'linear'],
      ],
      [
        [3.55, 0, E.scene],
        [SWEEP.t0, 0, E.scene],
        [SWEEP.t0 + 0.5, 100, 'linear'],
      ],
      {outT: SWEEP.t0 + 0.55},
    ),
  );
  // the suppliers pile up, then drift apart and dim as "nobody holds the whole thing"
  CHAOS.forEach((k, i) => {
    const drift: Vec2 = [k.c[0] + (k.c[0] < 960 ? -40 : 40), k.c[1] + (k.c[1] < 540 ? -24 : 24)];
    layers.push({
      kind: 'precomp',
      name: k.comp,
      comp: k.comp,
      collapse: true,
      transform: {
        anchor: [k.w / 2, k.h / 2],
        position: {keys: [key(f(k.t), [k.c[0], k.c[1] + 40] as Vec2, E.in), key(f(k.t + 0.6), k.c, 'linear'), key(f(T.nobody), k.c, E.scene), key(f(T.nobody + 1.4), drift)]},
        rotation: {keys: [key(f(k.t), k.rot * 2.2, E.in), key(f(k.t + 0.6), k.rot, 'linear'), key(f(T.nobody), k.rot, E.scene), key(f(T.nobody + 1.4), k.rot * 1.8)]},
        scale: {keys: [key(f(k.t), [92, 92] as Vec2, E.pop), key(f(k.t + 0.5), [100, 100] as Vec2)]},
        opacity: {keys: [key(f(k.t), 0, E.in), key(f(k.t + 0.3), 100, 'linear'), key(f(T.nobody), 100, E.scene), key(f(T.nobody + 0.8), 34)]},
      },
      in: f(k.t),
      label: 9 + i,
    });
  });
  // notifications pop in on top
  PILLS.forEach(([s, c, t], i) => {
    const w = 64 + s.length * 11.2;
    layers.push({
      kind: 'shape',
      name: `pill ${i + 1}`,
      items: [rect(-w / 2, -28, w, 56, '#2A2724', 100, 28), dot([-w / 2 + 28, 0], 7, RED)],
      transform: {anchor: [0, 0], position: c, scale: {keys: [key(f(t), [60, 60] as Vec2, E.pop), key(f(t + 0.45), [100, 100] as Vec2)]}, opacity: {keys: [key(f(t), 0, 'linear'), key(f(t + 0.12), 100, 'linear'), key(f(T.nobody + 0.3), 100, E.out), key(f(T.nobody + 0.9), 30)]}},
      in: f(t),
    });
    layers.push({...txt(`pill ${i + 1} text`, s, c[0] - w / 2 + 48, c[1] + 7, 'sg600', 19, TXT), transform: {position: [c[0] - w / 2 + 48, c[1] + 7], opacity: {keys: [key(f(t + 0.1), 0, 'linear'), key(f(t + 0.25), 100, 'linear'), key(f(T.nobody + 0.3), 100, E.out), key(f(T.nobody + 0.9), 30)]}}, in: f(t)});
  });
  // the problem, said once
  const nb = 'Nobody holds the whole thing.';
  layers.push(lifeLayer({...txt('nobody', nb, (W - 841.3) / 2, 560, 'sg800', 56, TXT), transform: life([(W - 841.3) / 2, 560], T.nobody + 0.15)}, T.nobody + 0.15));
  return {name: 'BEFORE', width: W, height: H, fps: FPS, duration: DURATION, layers: layers.map((l) => ({...l, out: l.out ?? f(tEnd + 0.1)}))};
}

// ------------------------------------------------------------------ after: one project window, three steps
const WIN = {x: 260, y: 170, w: 1400, h: 700};
const STEP = [
  {name: 'PLAN', n: '01', cx: 520, t: T.plan, callout: 'Storyboard, signed off.'},
  {name: 'SHOOT', n: '02', cx: 960, t: T.shoot, callout: 'One crew. One shoot day.'},
  {name: 'DELIVER', n: '03', cx: 1400, t: T.cut, callout: 'Cut once. Ship everywhere.'},
];
const CARD_W = 400;
const CARD_H = 430;
const CARD_Y = 575; // centre
function stepComps(): Comp[] {
  const sb = (x: number, y: number, k: number): ShapeItem[] => [
    rect(x, y, 160, 96, '#26231F', 100, 8),
    ...(k % 2 === 0 ? [dot([x + 110, y + 40], 18, RED)] : [rect(x + 24, y + 30, 50, 50, TXT, 30, 25)]),
    rect(x, y + 70, 160, 26, TXT, 12, 0),
  ];
  return [
    cardComp('STEP PLAN', CARD_W, CARD_H, [
      tag('01  PLAN', 30, 48, RED),
      {kind: 'shape', name: 'storyboard', items: [...sb(30, 80, 0), ...sb(210, 80, 1), ...sb(30, 196, 1), ...sb(210, 196, 2)]},
      txt('sb label', 'Storyboard', 30, 340, 'sg700', 26, TXT),
      txt('sb sub', 'Script · shot list · schedule', 30, 374, 'sg600', 18, MUTE),
    ]),
    cardComp('STEP SHOOT', CARD_W, CARD_H, [
      tag('02  SHOOT', 30, 48, RED),
      {
        kind: 'shape',
        name: 'viewfinder',
        items: [
          rect(30, 76, 340, 210, '#0B0A09', 100, 10),
          dot([200, 186], 46, RED),
          rect(170, 208, 60, 78, TXT, 70, 30),
          ...([[48, 94], [352, 94], [48, 268], [352, 268]] as Vec2[]).map(([x, y]): ShapeItem => ({geo: {type: 'path', path: {v: [[x, y + (y < 200 ? 22 : -22)], [x, y], [x + (x < 200 ? 22 : -22), y]], closed: false}}, stroke: {color: TXT, width: 3}})),
          dot([60, 116], 6, RED),
        ],
      },
      txt('rec', 'REC', 74, 122, 'sg800', 16, TXT),
      txt('tc', '00:00:12:08', 352, 122, 'sg800', 16, TXT, {justify: 'right'}),
      txt('shoot label', 'Shoot day', 30, 340, 'sg700', 26, TXT),
      txt('shoot sub', 'Crew · kit · locations', 30, 374, 'sg600', 18, MUTE),
    ]),
    cardComp('STEP DELIVER', CARD_W, CARD_H, [
      tag('03  DELIVER', 30, 48, RED),
      {
        kind: 'shape',
        name: 'formats',
        items: [frame(30, 110, 176, 99, TXT, 3, 80, 6), frame(226, 80, 70, 124, TXT, 3, 80, 6), frame(314, 120, 84, 84, TXT, 3, 80, 6), frame(30, 226, 120, 60, TXT, 3, 40, 6)],
      },
      txt('f169', '16:9', 118, 168, 'sg800', 18, TXT, {justify: 'center'}),
      txt('f916', '9:16', 261, 148, 'sg800', 16, TXT, {justify: 'center'}),
      txt('f11', '1:1', 356, 168, 'sg800', 16, TXT, {justify: 'center'}),
      txt('cutdowns', 'Cutdowns', 90, 262, 'sg700', 15, MUTE, {justify: 'center'}),
      txt('deliver label', 'Every format', 30, 340, 'sg700', 26, TXT),
      txt('deliver sub', 'Edit · motion · captions · exports', 30, 374, 'sg600', 18, MUTE),
    ]),
  ];
}

function afterComp(): Comp {
  const layers: Layer[] = [];
  const tWin = SWEEP.t1; // the window frame is drawn as the sweep lands
  const tCards = tWin + 0.35;
  const tOut = T.years - 0.55; // the window lifts away for the proof
  const outKeys = (base: number): Key<number>[] => [key(f(tOut), base, E.out), key(f(tOut + 0.5), 0)];
  // window: title bar and body appear inside the frame the line draws
  layers.push({
    kind: 'shape',
    name: 'window',
    items: [rect(WIN.x, WIN.y, WIN.w, WIN.h, '#171513', 100, 22), rect(WIN.x, WIN.y + 64, WIN.w, 1.5, TXT, 12)],
    transform: {opacity: {keys: [key(f(tWin), 0, E.in), key(f(tWin + 0.5), 100), ...outKeys(100)]}},
    in: f(tWin),
    out: f(tOut + 0.55),
  });
  layers.push({...txt('window title', 'Launch film', WIN.x + 34, WIN.y + 42, 'sg700', 24, TXT), transform: {position: [WIN.x + 34, WIN.y + 42], opacity: {keys: [key(f(tWin + 0.2), 0, E.in), key(f(tWin + 0.6), 100), ...outKeys(100)]}}, in: f(tWin), out: f(tOut + 0.55)});
  layers.push({...txt('window team', 'Onemarsmedia · one team', WIN.x + WIN.w - 34, WIN.y + 42, 'sg600', 19, MUTE, {justify: 'right'}), transform: {position: [WIN.x + WIN.w - 34, WIN.y + 42], opacity: {keys: [key(f(tWin + 0.3), 0, E.in), key(f(tWin + 0.7), 100), ...outKeys(100)]}}, in: f(tWin), out: f(tOut + 0.55)});
  // the window frame: drawn by the line, from the left edge where the sweep landed
  const r = 22;
  const x0 = WIN.x;
  const y0 = WIN.y;
  const x1 = WIN.x + WIN.w;
  const y1 = WIN.y + WIN.h;
  const ym = 540;
  const framePts: Vec2[] = [[x0, ym], [x0, y0 + r], [x0 + r * 0.3, y0 + r * 0.3], [x0 + r, y0], [x1 - r, y0], [x1 - r * 0.3, y0 + r * 0.3], [x1, y0 + r], [x1, y1 - r], [x1 - r * 0.3, y1 - r * 0.3], [x1 - r, y1], [x0 + r, y1], [x0 + r * 0.3, y1 - r * 0.3], [x0, y1 - r], [x0, ym]];
  layers.push(...line('window', framePts, [[tWin - 0.05, 0, E.scene], [tWin + 1.0, 100, 'linear']], [[tOut, 0, E.out], [tOut + 0.5, 100, 'linear']], {width: 3, outT: tOut + 0.55}));
  // the three steps; each one in turn: lift -> focus -> callout
  STEP.forEach((s, i) => {
    const c: Vec2 = [s.cx, CARD_Y];
    const tin = tCards + i * 0.07;
    const focusOn = s.t - 0.1;
    const next = i < 2 ? STEP[i + 1].t - 0.1 : T.years - 1.1;
    const others = STEP.map((o) => o.t - 0.1);
    // opacity: 100 until the first focus, then 30 unless in focus; all back at the end
    const op: Key<number>[] = [key(f(tin), 0, E.in), key(f(tin + 0.4), 100, 'linear')];
    others.forEach((t, j) => op.push(key(f(t), op[op.length - 1].v, E.scene), key(f(t + 0.35), j === i ? 100 : 30, 'linear')));
    op.push(key(f(T.years - 1.1), op[op.length - 1].v, E.scene), key(f(T.years - 0.75), 100, 'linear'), ...outKeys(100));
    layers.push({
      kind: 'precomp',
      name: `STEP ${s.name}`,
      comp: `STEP ${s.name}`,
      collapse: true,
      transform: {
        anchor: [CARD_W / 2, CARD_H / 2],
        position: {keys: [key(f(tin), [c[0], c[1] + 36] as Vec2, E.in), key(f(tin + 0.55), c)]},
        scale: {keys: [key(f(focusOn), [100, 100] as Vec2, E.pop), key(f(focusOn + 0.45), [104, 104] as Vec2, 'linear'), key(f(next), [104, 104] as Vec2, E.scene), key(f(next + 0.4), [100, 100] as Vec2)]},
        opacity: {keys: op},
      },
      in: f(tin),
      out: f(tOut + 0.55),
    });
    // callout: the line rises from the card to a short caption, a dot at its end
    const top = CARD_Y - CARD_H / 2 - 12;
    const cy = WIN.y - 46;
    const cpts: Vec2[] = [[s.cx, top], [s.cx, cy + 22], [s.cx + 18, cy]];
    layers.push(...line(`callout ${s.name}`, cpts, [[focusOn + 0.15, 0, E.in], [focusOn + 0.65, 100, 'linear']], [[next - 0.1, 0, E.out], [next + 0.25, 100, 'linear']], {width: 3}));
    layers.push({kind: 'shape', name: `callout ${s.name} dot`, items: [dot([s.cx + 18, cy], 7, RED)], transform: {anchor: [s.cx + 18, cy], position: [s.cx + 18, cy], scale: {keys: [key(f(focusOn + 0.6), [0, 0] as Vec2, E.pop), key(f(focusOn + 0.9), [100, 100] as Vec2, 'linear'), key(f(next - 0.1), [100, 100] as Vec2, E.out), key(f(next + 0.2), [0, 0] as Vec2)]}}, in: f(focusOn + 0.6), out: f(next + 0.25)});
    layers.push(lifeLayer({...txt(`callout ${s.name} text`, s.callout, s.cx + 36, cy + 10, 'sg700', 30, TXT), transform: life([s.cx + 36, cy + 10], focusOn + 0.65, next - 0.15, 10, 0.45)}, focusOn + 0.65, next - 0.15));
  });
  // the timeline under the cards fills as the steps go: the line as a progress bar
  const tlY = WIN.y + WIN.h - 50;
  layers.push({kind: 'shape', name: 'timeline track', items: [rect(WIN.x + 60, tlY, WIN.w - 120, 4, TXT, 12, 2)], transform: {opacity: {keys: [key(f(tCards), 0, E.in), key(f(tCards + 0.5), 100), ...outKeys(100)]}}, in: f(tCards), out: f(tOut + 0.55)});
  layers.push(
    ...line(
      'timeline',
      [[WIN.x + 60, tlY + 2], [WIN.x + WIN.w - 60, tlY + 2]],
      [[T.plan - 0.1, 0, E.scene], [T.shoot - 0.1, 33, E.scene], [T.cut - 0.1, 66, E.scene], [T.ship + 1.0, 100, 'linear']],
      [[tOut, 0, E.out], [tOut + 0.5, 100, 'linear']],
      {width: 4, outT: tOut + 0.55},
    ),
  );
  return {name: 'AFTER', width: W, height: H, fps: FPS, duration: DURATION, layers};
}

// ------------------------------------------------------------------ main
export function buildOneLineScene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  chaosComps().forEach(add);
  stepComps().forEach(add);
  add(beforeComp());
  add(afterComp());

  const L: Layer[] = [];
  // background: a fine dot grid in paper, drifting slowly (never a dead background)
  const dots: ShapeItem[] = [];
  for (let y = -48; y < H + 96; y += 48) for (let x = -48; x < W + 96; x += 48) dots.push({geo: {type: 'ellipse', size: [3, 3], center: [x, y]}, fill: {color: TXT, opacity: 9}});
  L.push({kind: 'shape', name: 'dot grid', items: dots, transform: {anchor: [0, 0], position: {keys: [key(0, [0, 0] as Vec2, 'linear'), key(DURATION - 1, [-48, -24] as Vec2)]}}, label: 16});

  // camera: a slow push on every held frame (+3-5 %), around the centre
  const cam: Key<Vec2>[] = [
    key(0, [100, 100] as Vec2, 'linear'),
    key(f(T.agency - 0.3), [103, 103] as Vec2, E.scene),
    key(f(T.agency + 0.6), [100, 100] as Vec2, 'linear'),
    key(f(SWEEP.t0), [103, 103] as Vec2, E.scene),
    key(f(SWEEP.t1), [100, 100] as Vec2, 'linear'),
    key(f(T.years - 0.6), [104, 104] as Vec2, E.scene),
    key(f(T.years), [100, 100] as Vec2, 'linear'),
    key(f(T.team - 0.2), [103, 103] as Vec2, E.scene),
    key(f(T.team + 0.6), [100, 100] as Vec2, 'linear'),
    key(DURATION - 1, [104, 104] as Vec2),
  ];
  L.push({kind: 'null', name: 'CAMERA', transform: {anchor: [0, 0], position: [W / 2, H / 2], scale: {keys: cam}}, label: 2});
  const inCam = (l: Layer): Layer => ({...l, parent: 'CAMERA', transform: {...(l.transform ?? {}), position: shiftProp(l.transform?.position)}});

  const scene: Layer[] = [];
  // 1. hook
  const hookX = (W - 1199.4) / 2;
  scene.push(lifeLayer({...txt('hook', 'Your launch has a brief.', hookX, 560, 'sg800', 104, TXT, {tracking: track(-2, 104)}), transform: life([hookX, 560], 0.15, 3.65, 22, 0.6)}, 0.15, 3.65));
  const ulY = 600;
  const bx0 = hookX + 922.6;
  const bx1 = hookX + 1199.4 - 26;
  scene.push(...line('hook', [[-30, ulY], [bx1, ulY]], [[0.35, 0, E.scene], [T.hook + 1.2, 100, 'linear']], [[0.35, 0, E.scene], [T.hook + 1.2, 0, E.scene], [T.hook + 1.6, ((bx0 + 30) / (bx1 + 30)) * 100, E.scene], [3.55, ((bx0 + 30) / (bx1 + 30)) * 100, E.scene], [4.05, 100, 'linear']]));
  // 2-3. before | after, split by the line as it sweeps
  const lineX: Prop<Vec2> = {keys: [key(f(SWEEP.t0), [W + 12, 0] as Vec2, E.scene), key(f(SWEEP.t1), [SWEEP.x1, 0] as Vec2)]};
  const matte = (name: string): Layer => ({kind: 'shape', name, matteSource: true, items: [rect(0, -200, W + 400, H + 400, '#FFFFFF')], transform: {anchor: [0, 0], position: lineX}, in: f(SWEEP.t0), out: f(SWEEP.t1 + 0.2)});
  scene.push({kind: 'precomp', name: 'BEFORE', comp: 'BEFORE', collapse: true, out: f(SWEEP.t0)});
  scene.push(matte('before matte'), {kind: 'precomp', name: 'BEFORE (wiped)', comp: 'BEFORE', collapse: true, matte: {layer: 'before matte', type: 'alphaInverted'}, in: f(SWEEP.t0), out: f(SWEEP.t1 + 0.2)});
  scene.push(matte('after matte'), {kind: 'precomp', name: 'AFTER (wiped)', comp: 'AFTER', collapse: true, matte: {layer: 'after matte', type: 'alpha'}, in: f(SWEEP.t0), out: f(SWEEP.t1 + 0.2)});
  scene.push({kind: 'precomp', name: 'AFTER', comp: 'AFTER', collapse: true, in: f(SWEEP.t1 + 0.2)});
  // the sweep itself: grows from where the tangle ended (screen centre), then rides the wipe edge
  scene.push({
    kind: 'shape',
    name: 'line sweep',
    items: [{geo: {type: 'path', path: {v: [[0, -20], [0, H + 20]], closed: false}}, stroke: {color: RED, width: LINE_W, cap: 'round'}, trim: {start: trimProp([[SWEEP.t0, 50, E.scene], [SWEEP.t0 + 0.45, 0, 'linear'], [SWEEP.t1, 0, E.scene], [SWEEP.t1 + 0.35, 50, 'linear']]), end: trimProp([[SWEEP.t0, 50, E.scene], [SWEEP.t0 + 0.45, 100, 'linear'], [SWEEP.t1, 100, E.scene], [SWEEP.t1 + 0.35, 50, 'linear']])}}],
    transform: {anchor: [0, 0], position: {keys: [key(f(SWEEP.t0), [W + 12, 0] as Vec2, E.scene), key(f(SWEEP.t1), [SWEEP.x1, 0] as Vec2)]}},
    in: f(SWEEP.t0),
    out: f(SWEEP.t1 + 0.4),
    label: 1,
  });

  // 4. proof: the timeline becomes a rising chart; 13 years; the brands, text only
  const tP = T.years - 0.55;
  const chart: Vec2[] = [[WIN.x + 60, 870], [520, 830], [700, 790], [840, 800], [1000, 700], [1160, 690], [1320, 560], [1480, 520], [1660, 380]];
  scene.push(...line('chart', chart, [[tP, 0, E.scene], [tP + 1.8, 100, 'linear']], [[T.team - 0.9, 0, E.out], [T.team - 0.3, 100, 'linear']], {width: 4}));
  const yearsKeys: Prop<number> = {keys: [key(f(T.years), 0, [0.25, 0.1, 0.25, 1]), key(f(T.years + 1.6), 13)]};
  scene.push(lifeLayer({kind: 'text', name: 'years counter', source: {kind: 'counter', value: yearsKeys, pad: 1}, font: FONT.anton, size: 360, color: TXT, transform: life([260, 640], T.years - 0.05, T.team - 0.9, 24, 0.6)}, T.years - 0.05, T.team - 0.9));
  scene.push(lifeLayer({...txt('years label', 'years of UK production', 270, 720, 'sg700', 44, TXT), transform: life([270, 720], T.years + 0.25, T.team - 0.9, 16, 0.55)}, T.years + 0.25, T.team - 0.9));
  const brands: Array<[string, number, number]> = [['Vogue Arabia', 299.8, T.brands + 0.75], ['Adidas', 157.1, T.adidas - 0.05], ['ASOS', 129.9, T.adidas + 0.75]];
  const gap = 64;
  let bx = 270;
  scene.push(lifeLayer({...txt('brands label', 'FOR BRANDS LIKE', 270, 830, 'sg800', 18, MUTE, {tracking: track(2.6, 18)}), transform: life([270, 830], T.brands + 0.1, T.team - 0.9, 10, 0.5)}, T.brands + 0.1, T.team - 0.9));
  brands.forEach(([s, w, t], i) => {
    scene.push(lifeLayer({...txt(`brand ${s}`, s, bx, 892, 'sg700', 46, TXT), transform: life([bx, 892], t, T.team - 0.9, 14, 0.5)}, t, T.team - 0.9));
    if (i < 2) scene.push(lifeLayer({kind: 'shape', name: `brand dot ${i + 1}`, items: [dot([bx + w + gap / 2, 876], 5, RED)], transform: life([0, 0], t + 0.2, T.team - 0.9, 0, 0.3)}, t + 0.2, T.team - 0.9));
    bx += w + gap;
  });

  // 5. sign-off in the hook's layout: "One team. One line." then the name, underlined (loops to frame 1)
  const sX = (W - 998) / 2;
  scene.push(lifeLayer({...txt('one team', 'One team.', sX, 560, 'sg800', 104, TXT, {tracking: track(-2, 104)}), transform: life([sX, 560], T.team - 0.05, T.name - 0.35, 22, 0.55)}, T.team - 0.05, T.name - 0.35));
  scene.push(lifeLayer({...txt('one line', 'One line.', sX + 545.7, 560, 'sg800', 104, TXT, {tracking: track(-2, 104)}), transform: life([sX + 545.7, 560], T.line - 0.05, T.name - 0.35, 22, 0.55)}, T.line - 0.05, T.name - 0.35));
  const lx0 = sX + 545.7;
  const lx1 = sX + 998 - 26;
  const olPts: Vec2[] = [[1660, 380], [1560, 470], [lx0 - 40, ulY], [lx1, ulY]];
  const olAcc = lengths(olPts);
  const olKeep = (olAcc[2] / olAcc[3]) * 100; // what stays: the underline under "One line."
  scene.push(...line('one line', olPts, [[T.line - 0.25, 0, E.scene], [T.line + 0.75, 100, 'linear']], [[T.line - 0.25, 0, E.scene], [T.line + 0.75, olKeep, E.scene], [T.name - 0.35, olKeep, E.scene], [T.name + 0.2, 100, 'linear']]));
  const nX = (W - 1150.8) / 2;
  scene.push(lifeLayer({...txt('wordmark', 'Onemarsmedia', nX, 560, 'sg800', 150, TXT, {tracking: track(-3, 150)}), transform: life([nX, 560], T.name - 0.1, undefined, 26, 0.7)}, T.name - 0.1));
  const nulY = 610;
  scene.push(...line('name', [[nX + 4, nulY], [nX + 1150.8 - 30, nulY]], [[T.name, 50, E.scene], [T.name + 0.9, 100, 'linear']], [[T.name, 50, E.scene], [T.name + 0.9, 0, 'linear']], {tip: false, outT: 43}));
  scene.push(lifeLayer({...txt('url', 'onemarsmedia.com', W / 2, 690, 'sg600', 34, MUTE, {justify: 'center'}), transform: life([W / 2, 690], T.name + 0.7, undefined, 12, 0.55)}, T.name + 0.7));

  L.push(...scene.map(inCam));

  // watermark: the whole film, bottom centre, one line (blueprint section 9)
  L.push({
    ...txt('watermark', 'Directed & produced by Marek Mars · Onemarsmedia Limited · onemarsmedia.com', W / 2, H - 34, 'sg600', 18, TXT, {justify: 'center'}),
    transform: {position: [W / 2, H - 34], opacity: 70},
    label: 16,
  });

  const main: Comp = {name: 'One line', width: W, height: H, fps: FPS, duration: DURATION, bg: BG, motionBlur: {shutterAngle: 180, samples: 5}, layers: L};
  add(main);
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

/** Layers parented to the CAMERA null (anchored at the screen centre) are offset by -centre. */
function shiftProp(p: Prop<Vec2> | undefined): Prop<Vec2> {
  const s = (v: Vec2): Vec2 => [v[0] - W / 2, v[1] - H / 2];
  if (p === undefined) return [-W / 2, -H / 2];
  if (Array.isArray(p)) return s(p as Vec2);
  return {keys: (p as {keys: Key<Vec2>[]}).keys.map((k) => ({...k, v: s(k.v)}))};
}

/** SFX cue list (seconds): quiet UI taps, a whoosh on the sweep, a lock on the count. */
export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    ...CHAOS.map((k) => ({file: 'tap.wav', t: k.t, gainDb: -30})),
    ...PILLS.map(([, , t]) => ({file: 'tap.wav', t, gainDb: -33})),
    {file: 'whoosh.wav', t: SWEEP.t0 + 0.4, gainDb: -30},
    ...STEP.map((s) => ({file: 'tap.wav', t: s.t - 0.1, gainDb: -28})),
    {file: 'lock.wav', t: T.years + 1.6, gainDb: -24},
    {file: 'tap.wav', t: T.name, gainDb: -27},
  ];
}
