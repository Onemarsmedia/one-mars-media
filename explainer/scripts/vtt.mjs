// WebVTT from captions JSON: either ready-made cues [{start, end, text}] (film seconds) or aligned
// words grouped by sentence.  node scripts/vtt.mjs <captions.json> <out.vtt>
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export function writeVtt(captionsPath, outFile) {
  const data = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
  const {words = [], offset = 0} = data;
  const ts = (s) => {
    const ms = Math.max(0, Math.round((s + offset) * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
    const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
    return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const cues = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?]$/.test(w.text) || w.end - cur[0].start > 3.2) {
      cues.push(cur);
      cur = [];
    }
  }
  if (cur.length) cues.push(cur);
  const lines = data.cues
    ? data.cues.map((c, i) => [String(i + 1), `${ts(c.start)} --> ${ts(c.end)}`, c.text, ''])
    : cues.map((c, i) => [String(i + 1), `${ts(c[0].start)} --> ${ts(c[c.length - 1].end + 0.25)}`, c.map((w) => w.text).join(' '), '']);
  fs.writeFileSync(outFile, ['WEBVTT', ''].concat(lines.flat()).join('\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeVtt(process.argv[2], process.argv[3]);
