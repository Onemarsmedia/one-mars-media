import type {Comp, Scene} from '../../scene/types';
import {buildTileComps, TILE} from './tiles';
import {C, colX, FONT, FPS, GRID_Y0, H, ROW_GAP, W} from './tokens';

// Reference render: the 12 live tiles at their grid positions, for a pixel comparison with
// design/editorial/tiles.png (only the grid area matches; the band is not drawn here).
export const gridPos = (i: number): [number, number] => [colX((i % 6) * 2), GRID_Y0 + Math.floor(i / 6) * (TILE.h + ROW_GAP)];

export function buildReferenceScene(): Scene {
  const comps: Record<string, Comp> = {};
  const main: Comp = {name: 'EDITORIAL_TILES_REF', width: W, height: H, fps: FPS, duration: 1, bg: C.paper, layers: []};
  for (let i = 0; i < 12; i++) {
    const [tc, ...looks] = buildTileComps(i, 1, FPS);
    for (const c of [tc, ...looks]) comps[c.name] = c;
    const [x, y] = gridPos(i);
    main.layers.push({kind: 'precomp', name: `tile ${i + 1}`, comp: tc.name, transform: {position: [x, y]}});
  }
  comps[main.name] = main;
  return {main: main.name, comps, fonts: Object.values(FONT)};
}

/** Review render: the 12 live tiles at grid size, all landing at once, with their inner animations (10 s). */
export function buildTileAnimScene(seconds = 10): Scene {
  const duration = seconds * FPS;
  const comps: Record<string, Comp> = {};
  const main: Comp = {name: 'EDITORIAL_TILES_ANIM', width: W, height: H, fps: FPS, duration, bg: C.paper, layers: []};
  for (let i = 0; i < 12; i++) {
    const on = Math.round(0.3 * FPS);
    const all = buildTileComps(i, duration, FPS, {on, activeOff: on, loopEnd: duration});
    for (const c of all) comps[c.name] = c;
    const [x, y] = gridPos(i);
    main.layers.push({kind: 'precomp', name: `tile ${i + 1}`, comp: all[0].name, collapse: true, transform: {position: [x, y]}});
  }
  comps[main.name] = main;
  return {main: main.name, comps, fonts: Object.values(FONT)};
}
