// Captions from the edited VO: one cue per sentence (short neighbours merged), at most two lines,
// broken at a sentence end when one fits, otherwise at the most balanced clause; no 1-frame gaps.
//   npx tsx scripts/captions.ts <vo.json> <duration s> <out captions.json>
import fs from 'node:fs';

type Chunk = {text: string; punct: string; start: number; end: number};
const [voPath, durArg, out] = process.argv.slice(2);
const vo = JSON.parse(fs.readFileSync(voPath, 'utf8')) as {chunks: Chunk[]};
const dur = Number(durArg);
const MAX = 42; // characters per cue when merging
const LINE = 37; // a single line up to this length

type Cue = {start: number; end: number; parts: string[]};
const sentences: Cue[] = [];
let cur: Chunk[] = [];
for (const c of vo.chunks) {
  cur.push(c);
  if (c.punct.startsWith('.')) {
    sentences.push({start: cur[0].start, end: cur[cur.length - 1].end, parts: cur.map((x) => x.text + x.punct)});
    cur = [];
  }
}
const len = (parts: string[]) => parts.join(' ').length;
const merged: Cue[] = [];
for (const q of sentences) {
  const m = merged[merged.length - 1];
  if (m && len(m.parts) + len(q.parts) <= MAX && q.start - m.end < 0.6) Object.assign(m, {end: q.end, parts: [...m.parts, ...q.parts]});
  else merged.push({...q});
}
function lines(parts: string[]): string {
  if (len(parts) <= LINE) return parts.join(' ');
  let best = 1;
  let score = Infinity;
  for (let i = 1; i < parts.length; i++) {
    const a = len(parts.slice(0, i));
    const b = len(parts.slice(i));
    const sentenceEnd = parts[i - 1].endsWith('.') && a <= MAX && b <= MAX;
    const s = (sentenceEnd ? -1000 : 0) + Math.abs(a - b);
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return `${parts.slice(0, best).join(' ')}\n${parts.slice(best).join(' ')}`;
}
const cues = merged.map((q, i) => {
  const next = merged[i + 1];
  const end = next && next.start - (q.end + 0.35) < 0.1 ? next.start : Math.min(q.end + 0.35, dur);
  return {start: q.start, end, text: lines(q.parts)};
});
fs.writeFileSync(out, JSON.stringify({cues}, null, 1));
console.log(`captions: ${cues.length} cues -> ${out}`);
