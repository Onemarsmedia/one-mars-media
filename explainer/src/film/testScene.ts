import {anim, circlePath, key, pivot, springKeys, springScale} from '../scene/builders';
import {EASE} from '../scene/ease';
import type {FontRef, Scene} from '../scene/types';

// Exercises every feature of the scene model in 3 seconds. Used by the tests and as a
// render smoke test; the real film lives next to it once the visual direction is chosen.

const FPS = 30;

export const TEST_FONTS: Record<string, FontRef> = {
  geistMedium: {family: 'Geist', weight: 500, postscript: 'Geist-Medium', file: 'Geist-w500-s100.ttf'},
  geistBold: {family: 'Geist', weight: 700, postscript: 'Geist-Bold', file: 'Geist-w700-s100.ttf'},
  anton: {family: 'Anton', weight: 400, postscript: 'Anton-Regular', file: 'Anton-w400-s100.ttf'},
};

export function buildTestScene(): Scene {
  const tile = {
    name: 'TILE_TEST',
    width: 600,
    height: 400,
    fps: FPS,
    duration: 90,
    layers: [
      {
        kind: 'shape' as const,
        name: 'card',
        items: [{name: 'card', geo: {type: 'rect' as const, size: [560, 360] as [number, number], center: [300, 200] as [number, number], roundness: 28}, fill: {color: '#FFFFFF'}}],
        effects: [{type: 'dropShadow' as const, color: '#000000', opacity: 18, direction: 180, distance: 12, softness: 30}],
      },
      {
        kind: 'shape' as const,
        name: 'rec dot',
        items: [
          {
            name: 'dot',
            geo: {type: 'ellipse' as const, size: [36, 36] as [number, number], center: [80, 80] as [number, number]},
            fill: {color: anim(key(0, '#FF4F1A', 'hold'), key(30, '#111214', 'hold'), key(45, '#FF4F1A'))},
          },
        ],
      },
      {
        kind: 'text' as const,
        name: 'label',
        source: {kind: 'static' as const, text: '03 Filming'},
        font: TEST_FONTS.geistMedium,
        size: 34,
        color: '#111214',
        transform: {position: [120, 92] as [number, number]},
      },
    ],
  };

  const main = {
    name: 'ONEMARSMEDIA_TEST',
    width: 1920,
    height: 1080,
    fps: FPS,
    duration: 90,
    bg: '#F2EEE5',
    markers: [{t: 0, label: 'Brief'}, {t: 45, label: 'Tile'}],
    layers: [
      {
        kind: 'null' as const,
        name: '360 CONTROL',
        sliders: [{name: 'Degrees', value: anim(key(10, 0, EASE.out), key(40, 90, 'hold'), key(55, 90, EASE.snap), key(70, 360))}],
      },
      {
        kind: 'shape' as const,
        name: 'linked ring',
        items: [
          {
            geo: {type: 'path' as const, path: circlePath(960, 880, 120)},
            stroke: {color: '#111214', width: 14, cap: 'butt' as const},
            trim: {end: {link: {layer: '360 CONTROL', slider: 'Degrees', mul: 100 / 360, add: 0, min: 0, max: 100}}},
          },
        ],
      },
      ...[0, 1, 2].map((i) => ({
        kind: 'text' as const,
        name: `digit ${i + 1}`,
        source: {kind: 'counterDigit' as const, value: {link: {layer: '360 CONTROL', slider: 'Degrees'}}, pad: 3, index: i},
        font: TEST_FONTS.anton,
        size: 110,
        color: '#111214',
        noFill: i === 0,
        stroke: i === 0 ? {color: '#111214', width: 3} : undefined,
        justify: 'center' as const,
        transform: {position: [900 + i * 60, 920] as [number, number]},
      })),
      {
        kind: 'null' as const,
        name: 'RIG',
        transform: {...pivot(1500, 300), rotation: anim(key(0, 0, EASE.inOut), key(90, 90))},
      },
      {
        kind: 'shape' as const,
        name: 'ring track',
        items: [{geo: {type: 'path' as const, path: circlePath(0, 0, 160)}, stroke: {color: '#111214', width: 18, opacity: 13}}],
        transform: {position: [1500, 300] as [number, number]},
      },
      {
        kind: 'shape' as const,
        name: 'ring progress',
        parent: 'RIG',
        items: [
          {
            geo: {type: 'path' as const, path: circlePath(0, 0, 160)},
            stroke: {color: '#FF4F1A', width: 18, cap: 'round' as const},
            trim: {end: anim(key(0, 0, EASE.out), key(60, 75))},
          },
        ],
        transform: {position: [1500, 300] as [number, number]},
      },
      {
        kind: 'text' as const,
        name: 'counter',
        source: {kind: 'counter' as const, value: anim(key(0, 0, EASE.out), key(60, 270)), pad: 3, suffix: '°'},
        font: TEST_FONTS.anton,
        size: 120,
        color: '#111214',
        justify: 'center' as const,
        transform: {position: [1500, 345] as [number, number]},
      },
      {
        kind: 'text' as const,
        name: 'brief',
        source: {kind: 'typeOn' as const, text: 'We need a launch.', chars: anim(key(0, 0), key(36, 17))},
        font: TEST_FONTS.geistBold,
        size: 120,
        color: '#111214',
        tracking: -30,
        transform: {position: [120, 260] as [number, number]},
      },
      {
        kind: 'shape' as const,
        name: 'wipe matte',
        matteSource: true,
        items: [{geo: {type: 'rect' as const, size: anim<[number, number]>(key(20, [0, 200], EASE.inOut), key(50, [1200, 200])), center: [720, 520] as [number, number]}, fill: {color: '#FFFFFF'}}],
      },
      {
        kind: 'text' as const,
        name: 'wiped line',
        matte: {layer: 'wipe matte', type: 'alpha' as const},
        source: {kind: 'static' as const, text: 'One team.\nNo limits.'},
        font: TEST_FONTS.anton,
        size: 90,
        leading: 96,
        color: '#FF4F1A',
        transform: {position: [140, 500] as [number, number]},
      },
      {
        kind: 'precomp' as const,
        name: 'tile',
        comp: 'TILE_TEST',
        startTime: 30,
        in: 30,
        transform: {
          ...pivot(300, 200),
          position: anim<[number, number]>(key(30, [1300, 1000], EASE.out), key(52, [1300, 780])),
          scale: springScale(60, 100, 30, {fps: FPS, freq: 2.4, zeta: 0.5}),
          opacity: anim(key(30, 0, 'linear'), key(36, 100)),
        },
      },
      {
        kind: 'shape' as const,
        name: 'bouncer',
        items: [{geo: {type: 'rect' as const, size: [80, 80] as [number, number], roundness: 12}, fill: {color: '#111214'}}],
        transform: {...pivot(0, 0), position: anim<[number, number]>(key(0, [200, 900]), key(90, [800, 900])), rotation: anim(...springKeys(0, 180, 10, {fps: FPS}))},
      },
    ],
  };

  return {main: main.name, comps: {[main.name]: main, [tile.name]: tile}, fonts: Object.values(TEST_FONTS)};
}
