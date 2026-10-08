import type {Vec2} from '../scene/types';

/** 2D affine matrix [a, b, c, d, e, f] as in SVG: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function multiply(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** AE layer/group transform: translate(position) * rotate * scale * translate(-anchor). */
export function aeTransform(anchor: Vec2, position: Vec2, scale: Vec2, rotationDeg: number): Mat {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const sx = scale[0] / 100;
  const sy = scale[1] / 100;
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  return [a, b, c, d, position[0] - (a * anchor[0] + c * anchor[1]), position[1] - (b * anchor[0] + d * anchor[1])];
}

export function toSvg(m: Mat): string {
  return `matrix(${m.map((x) => +x.toFixed(6)).join(' ')})`;
}
