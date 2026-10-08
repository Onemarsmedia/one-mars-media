import type {FontRef} from '../../scene/types';

// Design tokens of the approved Editorial direction (design/editorial/frames.html, NOTES.md).

export const W = 1920;
export const H = 1080;
export const M = 64;
export const FPS = 60;

export const C = {
  paper: '#F1ECE2',
  p2: '#E3DBCB',
  soft: '#CBC1AE',
  ink: '#121110',
  gr: '#6E675D',
  red: '#FF4A1C',
};

export const COLW = 131;
export const GUT = 20;
export const colX = (k: number) => M + k * (COLW + GUT);

export const FONT = {
  anton: {family: 'Anton', weight: 400, postscript: 'Anton-Regular', file: 'Anton-w400-s100.ttf'},
  sg500: {family: 'Schibsted Grotesk', weight: 500, postscript: 'SchibstedGrotesk-Medium', file: 'SchibstedGrotesk-w500-s100.ttf'},
  sg600: {family: 'Schibsted Grotesk', weight: 600, postscript: 'SchibstedGrotesk-SemiBold', file: 'SchibstedGrotesk-w600-s100.ttf'},
  sg700: {family: 'Schibsted Grotesk', weight: 700, postscript: 'SchibstedGrotesk-Bold', file: 'SchibstedGrotesk-w700-s100.ttf'},
  sg800: {family: 'Schibsted Grotesk', weight: 800, postscript: 'SchibstedGrotesk-ExtraBold', file: 'SchibstedGrotesk-w800-s100.ttf'},
} satisfies Record<string, FontRef>;

export function fontFor(family: string, weight: number): FontRef {
  if (family === 'Anton') return FONT.anton;
  const w = weight >= 750 ? 800 : weight >= 650 ? 700 : weight >= 550 ? 600 : 500;
  return FONT[`sg${w}` as 'sg500' | 'sg600' | 'sg700' | 'sg800'];
}

// Page geometry from frames.html
export const BAND_Y = 652;
export const BASE = 1020;
export const DEG_SIZE = 380;
export const L1 = 370;
export const L2 = 622;
export const BIG = 260;
export const RUL_H = 64;
export const RUL_Y = BASE - RUL_H - 18 - 16 - 4;
export const GRID_Y0 = 96;
export const ROW_GAP = 24;
