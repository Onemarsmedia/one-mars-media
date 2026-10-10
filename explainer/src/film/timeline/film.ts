import {circlePath, key} from '../../scene/builders';
import type {Bezier, Comp, Key, Layer, Prop, Scene, ShapeItem, TextLayer, Transform, Vec2} from '../../scene/types';
import {C, FONT} from '../editorial/tokens';
import vo from './vo.json';

// "Timeline": Onemarsmedia explainer no. 3. The whole film happens inside an editing program, laid out at an
// angle (the workspace is tilted, the camera flies over it and rolls; long diagonal lines drift behind).
// Clips drop onto the tracks on their words, the viewer shows each one, changes shape for every screen,
// the timeline zooms out to thirteen years, and the play button is pressed on "Hit play".

export const FPS = 60;
const W = 1920;
const H = 1080;
const f = (s: number) => Math.round(s * FPS);
const E: Record<'scene' | 'in' | 'out' | 'pop', Bezier> = {
  scene: [0.83, 0, 0.17, 1],
  in: [0.16, 1, 0.3, 1],
  out: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
};
const BG = '#141312';
const PANEL = '#1E1C1A';
const TRACK = '#262320';
const TXT = C.paper;
const MUTE = '#8F877B';
const RED = C.red;
const TILT = -7; // the desk's angle

// ------------------------------------------------------------------ timing
const words = (vo as {words: Array<{text: string; start: number; end: number}>}).words;
const w = (text: string, nth = 0) => words.filter((x) => x.text.replace(/[^A-Za-z]/g, '').toLowerCase() === text)[nth].start;
const T = {
  plan: w('plan'),
  shoot: w('shoot'),
  edit: w('edit'),
  motion: w('motion'),
  sound: w('sound'),
  wide: w('wide'),
  vertical: w('vertical'),
  square: w('square'),
  years: w('thirteen'),
  one: w('timeline', 1),
  name: w('onemarsmedia'),
  play: w('play'),
  end: words[words.length - 1].end,
};
export const DURATION = f(Math.ceil(T.end + 3));

// ------------------------------------------------------------------ builders
const rect = (x: number, y: number, ww: number, hh: number, color: string, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [ww, hh], center: [x + ww / 2, y + hh / 2], roundness: r},
  fill: {color, opacity},
});
const frame = (x: number, y: number, ww: number, hh: number, color: string, width: number, opacity = 100, r = 0): ShapeItem => ({
  geo: {type: 'rect', size: [ww, hh], center: [x + ww / 2, y + hh / 2], roundness: r},
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
/** Visible from tin (quick fade + rise), optionally gone at tout. */
function life(p: Vec2, tin: number, tout?: number, dy = 14, dur = 0.3): Transform {
  const pk: Key<Vec2>[] = [key(f(tin), [p[0], p[1] + dy] as Vec2, E.in), key(f(tin + dur), p)];
  const ok: Key<number>[] = [key(f(tin), 0, 'linear'), key(f(tin + dur * 0.6), 100)];
  if (tout !== undefined) {
    pk.push(key(f(tout), p, E.out), key(f(tout + 0.2), [p[0], p[1] - dy] as Vec2));
    ok.push(key(f(tout), 100, E.out), key(f(tout + 0.2), 0));
  }
  return {position: {keys: pk}, opacity: {keys: ok}};
}
const timed = <L extends Layer>(l: L, tin: number, tout?: number): L => ({...l, in: f(tin), out: tout !== undefined ? f(tout + 0.25) : undefined});

// ------------------------------------------------------------------ the editor (desk coordinates)
const VIEW = {cx: 960, cy: 300, w: 800, h: 450};
const TL = {x: 140, y: 600, w: 1640, h: 420};
const TX0 = 260; // track area starts
const TX1 = 1760;
const TRACKS: Record<string, number> = {V3: 660, V2: 722, V1: 784, A1: 860, A2: 922};
const TH = 54;
type Clip = {name: string; tr: string; x0: number; x1: number; t: number; color: string; ink: string};
const CLIPS: Clip[] = [
  {name: 'PLAN', tr: 'V1', x0: TX0, x1: 560, t: T.plan, color: TXT, ink: C.ink},
  {name: 'SHOOT', tr: 'V1', x0: 568, x1: 920, t: T.shoot, color: TXT, ink: C.ink},
  {name: 'EDIT', tr: 'V2', x0: 928, x1: 1240, t: T.edit, color: RED, ink: '#FFFFFF'},
  {name: 'MOTION', tr: 'V3', x0: 1080, x1: 1420, t: T.motion, color: TXT, ink: C.ink},
];

function editorLayers(): Layer[] {
  const L: Layer[] = [];
  // panels
  L.push({kind: 'shape', name: 'viewer panel', items: [rect(VIEW.cx - 470, 30, 940, 540, PANEL, 100, 18), frame(VIEW.cx - 470, 30, 940, 540, TXT, 1.5, 10, 18)]});
  L.push(txt('viewer label', 'PROGRAM', VIEW.cx - 440, 64, 'sg800', 15, MUTE, {tracking: track(2.4, 15)}));
  L.push({kind: 'shape', name: 'timeline panel', items: [rect(TL.x, TL.y - 20, TL.w, TL.h + 40, PANEL, 100, 18), frame(TL.x, TL.y - 20, TL.w, TL.h + 40, TXT, 1.5, 10, 18)]});
  // tracks
  const trackItems: ShapeItem[] = [];
  for (const [n, y] of Object.entries(TRACKS)) trackItems.push(rect(TX0, y, TX1 - TX0, TH, TRACK, 100, 6));
  L.push({kind: 'shape', name: 'tracks', items: trackItems});
  for (const [n, y] of Object.entries(TRACKS)) L.push(txt(`track ${n}`, n, TL.x + 40, y + 35, 'sg800', 18, MUTE));
  // ruler: timecode, later years
  const ticks: ShapeItem[] = [];
  for (let x = TX0; x <= TX1; x += 30) ticks.push(rect(x, 622 - ((x - TX0) % 150 === 0 ? 14 : 6), 1.5, (x - TX0) % 150 === 0 ? 14 : 6, TXT, 30));
  L.push({kind: 'shape', name: 'ruler ticks', items: ticks});
  for (let k = 0; k <= 10; k++) {
    const x = TX0 + k * 150;
    L.push(timed({...txt(`tc ${k}`, `00:${String(k * 2).padStart(2, '0')}`, x + 6, 612, 'sg600', 14, MUTE), transform: {position: [x + 6, 612], opacity: {keys: [key(0, 100, 'linear'), key(f(T.years), 100, E.out), key(f(T.years + 0.2), 0)]}}}, 0, T.years));
    L.push(timed({...txt(`yr ${k}`, String(2013 + Math.round((k * 13) / 10)), x + 6, 612, 'sg800', 15, TXT), transform: life([x + 6, 612], T.years + 0.1 + k * 0.03, undefined, 8, 0.25)}, T.years + 0.1 + k * 0.03));
  }
  // the thirteen years fill every track (deterministic pattern)
  const dense: Layer[] = [];
  let n = 0;
  for (const [tr, y] of Object.entries(TRACKS)) {
    let x = TX0;
    let k = 0;
    while (x < TX1 - 30) {
      const len = 40 + ((k * 37 + y * 13) % 90);
      const x1 = Math.min(TX1, x + len);
      const t0 = T.years + 0.15 + ((x - TX0) / (TX1 - TX0)) * 1.1 + (n % 3) * 0.02;
      const col = (k + y) % 7 === 0 ? RED : tr.startsWith('A') ? MUTE : TXT;
      dense.push(timed({kind: 'shape', name: `year clip ${tr} ${k}`, items: [rect(x, y + 4, x1 - x - 4, TH - 8, col, tr.startsWith('A') ? 60 : 85, 5)], transform: {anchor: [x, y + TH / 2], position: [x, y + TH / 2], scale: {keys: [key(f(t0), [0, 100] as Vec2, E.in), key(f(t0 + 0.25), [100, 100] as Vec2)]}}}, t0));
      x = x1 + 4;
      k++;
      n++;
    }
  }
  L.push(...dense);
  // the sound: a waveform fills A1 from the left
  const wave: ShapeItem[] = [];
  for (let x = TX0 + 6; x < 1420; x += 7) {
    const a = 6 + Math.abs(Math.sin(x * 0.07) * 14 + Math.sin(x * 0.023) * 9);
    wave.push(rect(x, TRACKS.A1 + TH / 2 - a / 2, 3.5, a, TXT, 80));
  }
  L.push(timed({kind: 'shape', name: 'sound clip', items: [rect(TX0, TRACKS.A1 + 3, 1420 - TX0, TH - 6, '#3A3631', 100, 6), ...wave], transform: {anchor: [TX0, TRACKS.A1], position: [TX0, TRACKS.A1], scale: {keys: [key(f(T.sound - 0.05), [0, 100] as Vec2, E.in), key(f(T.sound + 0.45), [100, 100] as Vec2)]}}}, T.sound - 0.05));
  L.push(timed({...txt('sound label', 'SOUND', TX0 + 14, TRACKS.A1 + 20, 'sg800', 13, TXT, {tracking: track(2, 13)}), transform: life([TX0 + 14, TRACKS.A1 + 20], T.sound + 0.2, undefined, 0, 0.2)}, T.sound + 0.2));
  // clips drop in from above and snap
  CLIPS.forEach((c) => {
    const y = TRACKS[c.tr];
    const cw = c.x1 - c.x0;
    const cx = c.x0 + cw / 2;
    const cy = y + TH / 2;
    L.push(
      timed(
        {
          kind: 'shape',
          name: `clip ${c.name}`,
          items: [rect(-cw / 2, -TH / 2 + 3, cw, TH - 6, c.color, 100, 6), rect(-cw / 2, -TH / 2 + 3, 6, TH - 6, c.ink, 25, 3)],
          transform: {
            anchor: [0, 0],
            position: {keys: [key(f(c.t - 0.32), [cx + 40, cy - 260] as Vec2, E.in), key(f(c.t), [cx, cy] as Vec2)]},
            rotation: {keys: [key(f(c.t - 0.32), 9, E.in), key(f(c.t), 0)]},
            scale: {keys: [key(f(c.t - 0.32), [112, 112] as Vec2, E.in), key(f(c.t), [100, 100] as Vec2, E.pop), key(f(c.t + 0.18), [100, 100] as Vec2)]},
            opacity: {keys: [key(f(c.t - 0.32), 0, 'linear'), key(f(c.t - 0.2), 100)]},
          },
        },
        c.t - 0.32,
      ),
    );
    L.push(timed({...txt(`clip ${c.name} label`, c.name, c.x0 + 16, cy + 6, 'sg800', 16, c.ink, {tracking: track(2, 16)}), transform: life([c.x0 + 16, cy + 6], c.t + 0.02, undefined, 0, 0.15)}, c.t + 0.02));
  });
  // playhead: blinks at zero, then rides the end of each new clip, sweeps on the years and on "Hit play"
  const ph: Key<Vec2>[] = [
    key(0, [TX0, 0] as Vec2, 'hold'),
    key(f(T.plan - 0.1), [TX0, 0] as Vec2, E.scene),
    key(f(T.plan + 0.3), [560, 0] as Vec2, 'linear'),
    key(f(T.shoot - 0.1), [560, 0] as Vec2, E.scene),
    key(f(T.shoot + 0.3), [920, 0] as Vec2, 'linear'),
    key(f(T.edit - 0.1), [920, 0] as Vec2, E.scene),
    key(f(T.edit + 0.3), [1240, 0] as Vec2, 'linear'),
    key(f(T.motion - 0.1), [1240, 0] as Vec2, E.scene),
    key(f(T.motion + 0.3), [1420, 0] as Vec2, 'linear'),
    key(f(T.years), [1420, 0] as Vec2, E.scene),
    key(f(T.years + 1.4), [TX1, 0] as Vec2, 'linear'),
    key(f(T.play - 0.05), [TX1, 0] as Vec2, E.scene),
    key(f(T.play + 0.3), [TX0, 0] as Vec2, 'linear'),
    key(f(T.play + 0.35), [TX0, 0] as Vec2, 'linear'),
    key(DURATION - 1, [TX0 + 420, 0] as Vec2),
  ];
  const blink: Key<number>[] = [];
  for (let t = 0; t < T.plan - 0.1; t += 0.5) blink.push(key(f(t), Math.round(t * 2) % 2 === 0 ? 100 : 25, 'hold'));
  blink.push(key(f(T.plan - 0.1), 100));
  L.push({
    kind: 'shape',
    name: 'playhead',
    items: [rect(-1.5, 598, 3, 390, RED), {geo: {type: 'path', path: {v: [[-11, 586], [11, 586], [11, 598], [0, 610], [-11, 598]], closed: true}}, fill: {color: RED}}],
    transform: {anchor: [0, 0], position: {keys: ph}, opacity: {keys: blink}},
    label: 1,
  });
  return L;
}

// ------------------------------------------------------------------ the viewer: what each clip shows
function viewerComp(): Comp {
  const cw = 800;
  const ch = 800;
  const c: Vec2 = [cw / 2, ch / 2];
  const L: Layer[] = [];
  const seg = (name: string, tin: number, tout: number | undefined, items: ShapeItem[], extra: Layer[] = []) => {
    L.push(timed({kind: 'shape', name, items, transform: {opacity: {keys: [key(f(tin), 0, 'linear'), key(f(tin) + 4, 100, 'linear'), ...(tout !== undefined ? [key(f(tout) - 3, 100, 'linear'), key(f(tout), 0)] : [])]}}}, tin, tout));
    extra.forEach((l) => L.push(timed(l, tin, tout)));
  };
  // empty: timecode zero
  L.push(timed({...txt('tc zero', '00:00:00:00', c[0], c[1] + 16, 'sg700', 46, MUTE, {justify: 'center'}), transform: {position: [c[0], c[1] + 16], opacity: {keys: [key(0, 100, 'linear'), key(f(T.plan) - 3, 100, 'linear'), key(f(T.plan), 0)]}}}, 0, T.plan));
  // plan: storyboard 2x2
  const sb = (x: number, y: number, k: number): ShapeItem[] => [rect(x, y, 230, 130, '#2B2825', 100, 8), k % 2 ? rect(x + 40, y + 36, 60, 60, TXT, 40, 30) : dot([x + 150, y + 56], 26, RED), rect(x, y + 96, 230, 34, TXT, 14)];
  seg('plan board', T.plan, T.shoot, [...sb(160, 250, 0), ...sb(410, 250, 1), ...sb(160, 410, 1), ...sb(410, 410, 2)]);
  // shoot: viewfinder
  const br = ([x, y]: Vec2): ShapeItem => ({geo: {type: 'path', path: {v: [[x, y + (y < 400 ? 30 : -30)], [x, y], [x + (x < 400 ? 30 : -30), y]], closed: false}}, stroke: {color: TXT, width: 4}});
  seg('shoot viewfinder', T.shoot, T.edit, [dot(c, 90, RED), rect(c[0] - 46, c[1] + 40, 92, 120, TXT, 80, 46), ...([[120, 220], [680, 220], [120, 580], [680, 580]] as Vec2[]).map(br), dot([150, 262], 9, RED)], [txt('rec', 'REC', 170, 270, 'sg800', 22, TXT), txt('tc run', '00:00:12:08', 650, 270, 'sg800', 22, TXT, {justify: 'right'})]);
  // edit: two shots and a cut
  seg('edit cut', T.edit, T.motion, [rect(110, 260, 280, 280, '#2B2825', 100, 8), dot([250, 400], 60, RED), rect(410, 260, 280, 280, '#2B2825', 100, 8), rect(500, 330, 100, 140, TXT, 70, 50), rect(398, 230, 4, 340, RED)]);
  // motion: shapes in motion
  L.push(
    timed(
      {
        kind: 'shape',
        name: 'motion ball',
        items: [dot([0, 0], 54, RED)],
        transform: {anchor: [0, 0], position: {keys: [key(f(T.motion), [220, 520] as Vec2, E.scene), key(f(T.sound), [580, 300] as Vec2)]}, opacity: {keys: [key(f(T.motion), 0, 'linear'), key(f(T.motion) + 4, 100, 'linear'), key(f(T.sound) - 3, 100, 'linear'), key(f(T.sound), 0)]}},
      },
      T.motion,
      T.sound,
    ),
  );
  seg('motion path', T.motion, T.sound, [{geo: {type: 'path', path: {v: [[220, 520], [400, 520], [580, 300]], closed: false}}, stroke: {color: TXT, width: 3, opacity: 40, dash: [10, 10]}}]);
  // sound: meters
  const meters: Layer[] = [];
  for (let k = 0; k < 14; k++) {
    const x = 160 + k * 36;
    const hk = [120, 260, 180, 320, 220, 140, 300, 240, 160, 280, 200, 120, 240, 180];
    meters.push(timed({kind: 'shape', name: `meter ${k}`, items: [rect(x, 400 - 160, 22, 320, TXT, 8, 4), rect(x, 400 + 160 - hk[k], 22, hk[k], k === 3 || k === 6 ? RED : TXT, 85, 4)], transform: {anchor: [x, 560], position: [x, 560], scale: {keys: [key(f(T.sound + k * 0.015), [100, 20] as Vec2, E.pop), key(f(T.sound + 0.3 + k * 0.015), [100, 100] as Vec2, 'linear'), key(f(T.wide - 0.1), [100, 100] as Vec2, 'linear'), key(f(T.wide), [100, 0] as Vec2)]}}}, T.sound, T.wide));
  }
  L.push(...meters);
  // every screen: one composition that fits any shape
  seg('screens sun', T.wide - 0.05, T.years, [rect(0, 430, cw, 370, '#2B2825'), dot([400, 380], 120, RED), rect(340, 430, 120, 200, TXT, 85, 60)]);
  // thirteen years
  L.push(timed({kind: 'text', name: 'years 13', source: {kind: 'counter', value: {keys: [key(f(T.years), 0, [0.25, 0.1, 0.25, 1]), key(f(T.years + 1.2), 13)]}, pad: 1}, font: FONT.anton, size: 300, color: TXT, justify: 'center', transform: {position: [c[0], c[1] + 70], opacity: {keys: [key(f(T.years), 0, 'linear'), key(f(T.years) + 5, 100, 'linear'), key(f(T.name - 0.3), 100, E.out), key(f(T.name - 0.1), 0)]}}}, T.years, T.name - 0.1));
  L.push(timed({...txt('years label', 'YEARS OF UK PRODUCTION', c[0], c[1] + 140, 'sg800', 26, TXT, {justify: 'center', tracking: track(4, 26)}), transform: life([c[0], c[1] + 140], T.years + 0.3, T.name - 0.3, 10, 0.3)}, T.years + 0.3, T.name - 0.3));
  // the name and the play button
  L.push(timed({...txt('name', 'Onemarsmedia', c[0], c[1] - 10, 'sg800', 92, TXT, {justify: 'center', tracking: track(-2.5, 92)}), transform: life([c[0], c[1] - 10], T.name - 0.05, undefined, 18, 0.4)}, T.name - 0.05));
  L.push(
    timed(
      {
        kind: 'shape',
        name: 'play button',
        items: [dot([0, 0], 46, RED), {geo: {type: 'path', path: {v: [[-14, -22], [24, 0], [-14, 22]], closed: true}}, fill: {color: '#FFFFFF'}}],
        transform: {anchor: [0, 0], position: [c[0], c[1] + 110], scale: {keys: [key(f(T.name + 0.4), [0, 0] as Vec2, E.pop), key(f(T.name + 0.75), [100, 100] as Vec2, 'linear'), key(f(T.play - 0.08), [100, 100] as Vec2, E.out), key(f(T.play + 0.02), [82, 82] as Vec2, E.pop), key(f(T.play + 0.3), [100, 100] as Vec2)]}},
      },
      T.name + 0.4,
    ),
  );
  L.push(timed({...txt('url', 'onemarsmedia.com', c[0], c[1] + 210, 'sg600', 26, MUTE, {justify: 'center'}), transform: life([c[0], c[1] + 210], T.play + 0.3, undefined, 8, 0.35)}, T.play + 0.3));
  return {name: 'VIEWER CONTENT', width: cw, height: ch, fps: FPS, duration: DURATION, layers: L};
}

// ------------------------------------------------------------------ main
export function buildTimelineScene(): Scene {
  const comps: Record<string, Comp> = {};
  const add = (c: Comp) => (comps[c.name] = c);
  add(viewerComp());
  const L: Layer[] = [];

  // background: long diagonal lines drifting at an angle, two speeds (parallax)
  const diag: Array<[number, number, string, number, number]> = [
    [-300, 3, TXT, 7, 0.6],
    [200, 2, TXT, 5, 1],
    [620, 3, RED, 45, 0.8],
    [1100, 2, TXT, 6, 1.3],
    [1500, 4, TXT, 8, 0.7],
  ];
  diag.forEach(([y, wd, col, op, sp], i) => {
    L.push({
      kind: 'shape',
      name: `diagonal ${i + 1}`,
      items: [{geo: {type: 'path', path: {v: [[-600, y + 400], [2600, y - 700]], closed: false}}, stroke: {color: col, width: wd, opacity: op}}],
      transform: {anchor: [0, 0], position: {keys: [key(0, [0, 0] as Vec2, 'linear'), key(DURATION - 1, [-260 * sp, 90 * sp] as Vec2)]}},
      label: 16,
    });
  });

  // camera: flies over the tilted desk; CAMERA = zoom + roll at the screen centre, PAN = -centre, DESK = tilt
  const rad = (TILT * Math.PI) / 180;
  const toPan = (p: Vec2): Vec2 => [960 + Math.cos(rad) * (p[0] - 960) - Math.sin(rad) * (p[1] - 540), 540 + Math.sin(rad) * (p[0] - 960) + Math.cos(rad) * (p[1] - 540)];
  type Cam = [number, Vec2, number, number];
  const CAMS: Cam[] = [
    [0, [960, 800], 150, 2],
    [2.7, [640, 790], 168, 0],
    [T.plan - 0.25, [520, 620], 128, -1],
    [T.shoot - 0.2, [760, 600], 126, 1],
    [T.edit - 0.2, [1000, 590], 124, -1],
    [T.motion - 0.2, [1180, 590], 124, 1],
    [T.sound - 0.15, [960, 640], 110, 0],
    [T.wide - 0.15, [960, 300], 160, 2],
    [T.square + 0.2, [960, 300], 166, -1],
    [T.years - 0.05, [960, 560], 90, -2],
    [T.one, [1000, 740], 104, 0],
    [T.name - 0.1, [960, 300], 176, 0],
    [DURATION / FPS, [960, 300], 184, 1],
  ];
  const ce = (i: number) => (i < CAMS.length - 1 ? E.scene : undefined);
  L.push({kind: 'null', name: 'CAMERA', transform: {anchor: [0, 0], position: [W / 2, H / 2], scale: {keys: CAMS.map(([t, , z], i) => key(f(t), [z, z] as Vec2, ce(i)))}, rotation: {keys: CAMS.map(([t, , , r], i) => key(f(t), r, ce(i)))}}, label: 2});
  L.push({kind: 'null', name: 'PAN', parent: 'CAMERA', transform: {anchor: [0, 0], position: {keys: CAMS.map(([t, p], i) => key(f(t), toPan(p).map((v) => -v) as Vec2, ce(i)))}}, label: 2});
  L.push({kind: 'null', name: 'DESK', parent: 'PAN', transform: {anchor: [960, 540], position: [960, 540], rotation: TILT}, label: 2});

  const desk = editorLayers();
  // the viewer: its frame changes shape for every screen; the content is matted inside it
  const vk = (wd: number, ht: number) => [wd, ht] as Vec2;
  const vsize: Prop<Vec2> = {keys: [key(f(T.wide - 0.05), vk(800, 450), E.pop), key(f(T.wide + 0.3), vk(800, 450), 'linear'), key(f(T.vertical - 0.05), vk(800, 450), E.pop), key(f(T.vertical + 0.3), vk(253, 450), 'linear'), key(f(T.square - 0.05), vk(253, 450), E.pop), key(f(T.square + 0.3), vk(450, 450), 'linear'), key(f(T.years - 0.1), vk(450, 450), E.scene), key(f(T.years + 0.3), vk(800, 450))]};
  desk.push({kind: 'shape', name: 'viewer screen', items: [{geo: {type: 'rect', size: vsize, center: [VIEW.cx, VIEW.cy]}, fill: {color: '#0B0A09'}}]});
  desk.push({kind: 'shape', name: 'viewer matte', matteSource: true, items: [{geo: {type: 'rect', size: vsize, center: [VIEW.cx, VIEW.cy]}, fill: {color: '#FFFFFF'}}]});
  desk.push({kind: 'precomp', name: 'VIEWER CONTENT', comp: 'VIEWER CONTENT', collapse: true, matte: {layer: 'viewer matte', type: 'alpha'}, transform: {anchor: [400, 400], position: [VIEW.cx, VIEW.cy]}});
  desk.push({kind: 'shape', name: 'viewer frame', items: [{geo: {type: 'rect', size: vsize, center: [VIEW.cx, VIEW.cy]}, stroke: {color: TXT, width: 2, opacity: 30}}]});
  // aspect labels land big under the viewer on their words
  const AR: Array<[string, number, number]> = [['16:9', T.wide, T.vertical], ['9:16', T.vertical, T.square], ['1:1', T.square, T.years - 0.1]];
  AR.forEach(([s, t0, t1]) => desk.push(timed({...txt(`aspect ${s}`, s, VIEW.cx, 560, 'sg800', 40, RED, {justify: 'center'}), transform: life([VIEW.cx, 560], t0 - 0.02, t1 - 0.2, 10, 0.2)}, t0 - 0.02, t1 - 0.2)));
  L.push(...desk.map((l) => ({...l, parent: l.parent ?? 'DESK'})));

  // watermark (master blueprint: 24-28 px, 80-90 %)
  L.push({kind: 'shape', name: 'watermark band', items: [rect(0, H - 76, W, 76, BG, 78)], label: 16});
  L.push({...txt('watermark', 'Directed & produced by Marek Mars · Onemarsmedia Limited · onemarsmedia.com', W / 2, H - 32, 'sg600', 26, TXT, {justify: 'center'}), transform: {position: [W / 2, H - 32], opacity: 85}, label: 16});

  const main: Comp = {name: 'Timeline', width: W, height: H, fps: FPS, duration: DURATION, bg: BG, motionBlur: {shutterAngle: 180, samples: 8}, layers: L};
  add(main);
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

export function sfxCues(): Array<{file: string; t: number; gainDb: number}> {
  return [
    ...CLIPS.map((c) => ({file: 'tap.wav', t: c.t, gainDb: -26})),
    {file: 'tap.wav', t: T.sound, gainDb: -29},
    ...[T.wide, T.vertical, T.square].map((t) => ({file: 'tap.wav', t, gainDb: -30})),
    {file: 'whoosh.wav', t: T.years - 0.2, gainDb: -29},
    {file: 'lock.wav', t: T.years + 1.2, gainDb: -26},
    {file: 'tap.wav', t: T.play, gainDb: -24},
  ];
}
