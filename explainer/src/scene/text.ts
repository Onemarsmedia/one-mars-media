import {evalNumber, type LinkCtx} from './eval';
import type {TextSource} from './types';

// The visible string of a text layer at frame t. ae/emit-jsx.ts emits AE expressions that compute
// the same thing from a Slider Control, so keep the two in step:
//   typeOn : value.substr(0, Math.round(slider))
//   counter: prefix + zero-padded Math.round(slider) + suffix
//   counterDigit: one character of the zero-padded counter

export function padNumber(n: number, pad: number): string {
  const neg = n < 0;
  let s = String(Math.abs(n));
  while (s.length < pad) s = '0' + s;
  return neg ? '-' + s : s;
}

export function textAt(src: TextSource, t: number, ctx?: LinkCtx): string {
  switch (src.kind) {
    case 'static':
      return src.text;
    case 'typeOn':
      return src.text.substr(0, Math.max(0, Math.round(evalNumber(src.chars, t, src.text.length, ctx))));
    case 'counter':
      return (src.prefix ?? '') + padNumber(Math.round(evalNumber(src.value, t, 0, ctx)), src.pad) + (src.suffix ?? '');
    case 'counterDigit':
      return padNumber(Math.abs(Math.round(evalNumber(src.value, t, 0, ctx))), src.pad).charAt(src.index);
  }
}

/** The text AE stores as the layer's base Source Text (the expression trims or replaces it). */
export function baseText(src: TextSource): string {
  switch (src.kind) {
    case 'static':
    case 'typeOn':
      return src.text;
    case 'counter':
      return (src.prefix ?? '') + padNumber(0, src.pad) + (src.suffix ?? '');
    case 'counterDigit':
      return '0';
  }
}
