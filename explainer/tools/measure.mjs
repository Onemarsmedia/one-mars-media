// Text metrics the film layout needs, measured with the real font files (kerning included).
// node tools/measure.mjs -> src/film/editorial/metrics.json
import * as fontkit from 'fontkit';
import fs from 'node:fs';

const load = (f) => fontkit.openSync(`public/fonts/${f}`);
const anton = load('Anton-w400-s100.ttf');
const sg600 = load('SchibstedGrotesk-w600-s100.ttf');
const sg800 = load('SchibstedGrotesk-w800-s100.ttf');
const width = (font, s, size, tracking = 0) => {
  const run = font.layout(s);
  const adv = run.positions.reduce((a, p) => a + p.xAdvance, 0);
  return (adv / font.unitsPerEm) * size + tracking * s.length;
};
const yMax = (font, ch) => font.glyphForCodePoint(ch.codePointAt(0)).bbox.maxY / font.unitsPerEm;
const prefixes = (font, s, size) => Array.from({length: s.length + 1}, (_, i) => +width(font, s.slice(0, i), size).toFixed(2));

const m = {
  antonCap0: yMax(anton, '0'),
  antonCapH: yMax(anton, 'H'),
  antonDigitAdv: anton.glyphForCodePoint(48).advanceWidth / anton.unitsPerEm,
  brief: {line1: prefixes(anton, 'We need', 260), line2: prefixes(anton, 'a launch.', 260)},
  signoff: {oneTeam: +width(anton, 'One team', 260).toFixed(2), noLimits: +width(anton, 'No limits', 260).toFixed(2)},
  deliverables: Object.fromEntries(Array.from({length: 13}, (_, n) => [n, +width(sg600, `${n} of 12 deliverables`, 36).toFixed(2)])),
  wordmark112: +width(sg800, 'Onemarsmedia', 112, -3.8).toFixed(2),
};
fs.writeFileSync('src/film/editorial/metrics.json', JSON.stringify(m, null, 1));
console.log(JSON.stringify(m).slice(0, 400));
