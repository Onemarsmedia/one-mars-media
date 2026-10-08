import {circlePath} from '../../scene/builders';
import type {Comp, Layer, Scene, ShapeItem, TextLayer} from '../../scene/types';
import metrics from './metrics.json';
import {cardShadow, shadowSteps} from './shadows';
import {buildTileComps, TILE} from './tiles';
import {C, FONT, FPS} from './tokens';

// Cover for vertical social (Reels / TikTok / Shorts), 1080 x 1920. Everything that matters sits inside the
// centre 4:5 (y 285-1635), which is what a feed shows of a Reel; the profile grid crops to 3:4, inside that too.
// Same page, tiles, cards and type as the film: the 12 deliverables on a 4 x 3 wall, the headline above,
// the 360 counter below. Pick the frame (the tiles' inner animations run) with stills.mjs ReelCover.
export const COVER = {w: 1080, h: 1920, seconds: 10};
const X0 = 60;
const X1 = COVER.w - 60;
const GAP = 16;
const S = (X1 - X0 - 3 * GAP) / 4 / TILE.w; // tile scale: 4 across
const TW = TILE.w * S;
const TH = TILE.h * S;
const GRID_Y = 672;

const txt = (name: string, s: string, x: number, y: number, font: (typeof FONT)[keyof typeof FONT], size: number, color: string, extra: Partial<TextLayer> = {}): TextLayer => ({
  kind: 'text',
  name,
  source: {kind: 'static', text: s},
  font,
  size,
  color,
  transform: {position: [x, y]},
  ...extra,
});
const rect = (x: number, y: number, w: number, h: number, color: string, opacity = 100): ShapeItem => ({geo: {type: 'rect', size: [w, h], center: [x + w / 2, y + h / 2]}, fill: {color, opacity}});
const track = (px: number, size: number) => (px / size) * 1000;

/** The film's tagline, red full stops. Same place on the cover and on the vertical film. */
const headline = (): TextLayer[] => {
  const HS = 112;
  return [
    txt('headline 1', 'One brief', X0 - 3, 500, FONT.anton, HS, C.ink),
    txt('headline 1 stop', '.', X0 - 3 + 399.6, 500, FONT.anton, HS, C.red),
    txt('headline 2', 'The whole campaign', X0 - 3, 620, FONT.anton, HS, C.ink),
    txt('headline 2 stop', '.', X0 - 3 + 924.7, 620, FONT.anton, HS, C.red),
  ];
};

/**
 * Background of the vertical (9:16) film: the cover's headline, and a soft shadow around the slot where
 * the 16:9 film plays, full width, right under the headline (FILM_SLOT). The film's own paper matches.
 */
export const FILM_SLOT = {x: 0, y: 672, w: 1080, h: 608};
export function buildReelFrameScene(): Scene {
  const {x, y, w, h} = FILM_SLOT;
  const layers: Layer[] = [
    {kind: 'shape', name: 'film shadow', items: shadowSteps(12, 0.2, 2.5).map(({g, a}) => rect(x - 40, y - g + 4, w + 80, h + 2 * g + 8, C.ink, a))},
    {kind: 'shape', name: 'film paper', items: [rect(x, y, w, h, C.paper)]},
    ...headline(),
  ];
  const main: Comp = {name: 'REEL FRAME', width: COVER.w, height: COVER.h, fps: FPS, duration: 1, bg: C.paper, layers};
  return {main: main.name, comps: {[main.name]: main}, fonts: Object.values(FONT)};
}

export function buildReelCoverScene(): Scene {
  const duration = COVER.seconds * FPS;
  const comps: Record<string, Comp> = {};
  const layers: Layer[] = [];

  // page guides, as on the film's back plane
  const guides: ShapeItem[] = [];
  for (let c = 0; c < 4; c++) for (const x of [X0 + c * (TW + GAP), X0 + c * (TW + GAP) + TW]) guides.push(rect(x, 0, 1.5, COVER.h, C.ink, 7));
  layers.push({kind: 'shape', name: 'guides', items: guides});

  // masthead
  layers.push(txt('masthead Onemarsmedia', 'Onemarsmedia', X0, 336, FONT.sg800, 30, C.ink, {tracking: track(-0.3, 30)}));
  layers.push(txt('masthead url', 'onemarsmedia.com', X1, 336, FONT.sg600, 30, C.gr, {justify: 'right'}));
  layers.push({kind: 'shape', name: 'masthead rule', items: [rect(X0, 356, X1 - X0, 3, C.ink)]});

  layers.push(...headline());

  // the wall: 12 live tiles as cards (soft key shadow + contact shadow, as in the film)
  const keyShadow = cardShadow(TILE.w, TILE.h, 11, 0.22, 2.5);
  const contact = cardShadow(TILE.w, TILE.h, 2, 0.16, 1);
  const tiles: Layer[] = [];
  for (let i = 0; i < 12; i++) {
    const on = Math.round(0.3 * FPS);
    const all = buildTileComps(i, duration, FPS, {on, activeOff: on, loopEnd: duration});
    for (const c of all) comps[c.name] = c;
    const x = X0 + (i % 4) * (TW + GAP);
    const y = GRID_Y + Math.floor(i / 4) * (TH + GAP);
    const sc: [number, number] = [S * 100, S * 100];
    layers.push({kind: 'shape', name: `tile ${i + 1} shadow`, items: keyShadow, transform: {anchor: [0, 0], position: [x + 2 * S, y + 10 * S], scale: sc}});
    layers.push({kind: 'shape', name: `tile ${i + 1} contact`, items: contact, transform: {anchor: [0, 0], position: [x, y + 1.5 * S], scale: sc}});
    tiles.push({kind: 'precomp', name: `tile ${i + 1}`, comp: all[0].name, collapse: true, transform: {anchor: [0, 0], position: [x, y], scale: sc}});
  }
  layers.push(...tiles);

  // the band: status on the left, the 360 counter on the right
  const bandY = GRID_Y + 3 * TH + 2 * GAP + 34;
  layers.push({kind: 'shape', name: 'band rule', items: [rect(X0, bandY, X1 - X0, 3, C.ink)]});
  const DS = 250;
  const base = 1610;
  const adv = metrics.antonDigitAdv * DS;
  const capH = metrics.antonCap0 * DS;
  const rr = DS * 0.118;
  const rsw = DS * 0.062;
  const ringW = rr * 2 + rsw;
  const x0 = X1 - (adv * 3 + DS * 0.05 + ringW);
  layers.push(txt('360', '360', x0 + (adv * 3) / 2, base, FONT.anton, DS, C.ink, {justify: 'center'}));
  layers.push({
    kind: 'shape',
    name: 'degree ring',
    items: [{geo: {type: 'path', path: circlePath(X1 - ringW / 2, base - capH + ringW / 2, rr)}, stroke: {color: C.red, width: rsw}}],
  });
  layers.push(txt('THE WHOLE CAMPAIGN', 'THE WHOLE CAMPAIGN', X0, bandY + 74, FONT.sg800, 22, C.ink, {tracking: track(3.4, 22)}));
  layers.push(txt('12 of 12', '12 of 12 deliverables', X0, bandY + 124, FONT.sg600, 34, C.ink));
  layers.push(txt('one team', 'One team. No limits.', X0, bandY + 170, FONT.sg600, 34, C.red));

  const main: Comp = {name: 'REEL COVER', width: COVER.w, height: COVER.h, fps: FPS, duration, bg: C.paper, layers};
  comps[main.name] = main;
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

/**
 * Dark cover for the Reels tab (full 9:16, no feed crop), kept to three things: the tagline big on three
 * lines (paper, red full stops), the 360 with its red ring, and the name. Ink page, next to a 16:9 film
 * posted with black bars.
 */
export function buildReelCoverDarkScene(): Scene {
  const layers: Layer[] = [];
  const HS = 200;
  const lines: Array<[string, number, number | null]> = [
    ['One brief', 396, 713.5],
    ['The whole', 604, null],
    ['campaign', 812, 792.7],
  ];
  lines.forEach(([s, y, stop], i) => {
    layers.push(txt(`headline ${i + 1}`, s, X0 - 5, y, FONT.anton, HS, C.paper));
    if (stop !== null) layers.push(txt(`headline ${i + 1} stop`, '.', X0 - 5 + stop, y, FONT.anton, HS, C.red));
  });
  // the 360, as the film's counter ends: solid digits and the red ring
  const DS = 520;
  const base = 1560;
  const adv = metrics.antonDigitAdv * DS;
  const capH = metrics.antonCap0 * DS;
  const rr = DS * 0.118;
  const rsw = DS * 0.062;
  const ringW = rr * 2 + rsw;
  const x0 = X0 - 6;
  layers.push(txt('360', '360', x0 + (adv * 3) / 2, base, FONT.anton, DS, C.paper, {justify: 'center'}));
  layers.push({
    kind: 'shape',
    name: 'degree ring',
    items: [{geo: {type: 'path', path: circlePath(x0 + adv * 3 + DS * 0.05 + ringW / 2, base - capH + ringW / 2, rr)}, stroke: {color: C.red, width: rsw}}],
  });
  layers.push(txt('Onemarsmedia', 'Onemarsmedia', X0, 1690, FONT.sg800, 44, C.paper, {tracking: track(-0.4, 44)}));

  const main: Comp = {name: 'REEL COVER DARK', width: COVER.w, height: COVER.h, fps: FPS, duration: 1, bg: C.ink, layers};
  return {main: main.name, comps: {[main.name]: main}, fonts: Object.values(FONT)};
}
