import type {Comp, Scene} from '../../scene/types';
import {buildTileComp, TILE} from './tiles';
import {C, colX, FONT, FPS, GRID_Y0, H, ROW_GAP, W} from './tokens';

// Reference render: the 12 live tiles at their grid positions, for a pixel comparison with
// design/editorial/tiles.png (only the grid area matches; the band is not drawn here).
export const gridPos = (i: number): [number, number] => [colX((i % 6) * 2), GRID_Y0 + Math.floor(i / 6) * (TILE.h + ROW_GAP)];

export function buildReferenceScene(): Scene {
  const comps: Record<string, Comp> = {};
  const main: Comp = {name: 'EDITORIAL_TILES_REF', width: W, height: H, fps: FPS, duration: 1, bg: C.paper, layers: []};
  for (let i = 0; i < 12; i++) {
    const tc = buildTileComp(i, 1, FPS);
    comps[tc.name] = tc;
    const [x, y] = gridPos(i);
    main.layers.push({kind: 'precomp', name: `tile ${i + 1}`, comp: tc.name, transform: {position: [x, y]}});
  }
  comps[main.name] = main;
  return {main: main.name, comps, fonts: Object.values(FONT)};
}
