// Render the film and package the deliverables.
//   node scripts/render.mjs <compositionId> <outDir> [--audio master.wav] [--poster-frame N] [--captions words.json]
// Produces in <outDir>:
//   <id>-master.mp4   H.264 High, CRF 16, AAC 320k (archive / other platforms)
//   <id>-web.mp4      H.264 High@4.2 (4 refs), ~6 Mbps, AAC 192k, faststart (website)
//   <id>-poster.webp  the poster frame (website <video poster>), plus <id>-poster.jpg (thumbnail)
//   <id>.en.vtt       captions from the VO word timings (if --captions)
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const args = process.argv.slice(2);
const [id, outDir] = args;
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const audio = opt('--audio');
const posterFrame = opt('--poster-frame');
const captions = opt('--captions');
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const composition = await selectComposition({serveUrl, id, browserExecutable: BROWSER, logLevel: 'error'});
const silent = path.join(outDir, `${id}-video.mp4`);
const t0 = Date.now();
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 12,
  pixelFormat: 'yuv420p',
  outputLocation: silent,
  browserExecutable: BROWSER,
  concurrency: 3,
  muted: true,
  logLevel: 'error',
});
console.log(`video rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], {stdio: 'inherit'});
const master = path.join(outDir, `${id}-master.mp4`);
const web = path.join(outDir, `${id}-web.mp4`);
const audioIn = audio ? ['-i', audio] : [];
const audioMap = audio ? ['-map', '1:a:0', '-shortest'] : [];
ff('-i', silent, ...audioIn, '-map', '0:v:0', ...audioMap, '-c:v', 'libx264', '-profile:v', 'high', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '320k'] : []), '-movflags', '+faststart', master);
ff('-i', silent, ...audioIn, '-map', '0:v:0', ...audioMap, '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.2', '-x264-params', 'ref=4', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M', '-preset', 'slow', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '192k'] : []), '-movflags', '+faststart', web);
fs.rmSync(silent);

if (posterFrame !== undefined) {
  const png = path.join(outDir, `${id}-poster.png`);
  await renderStill({composition, serveUrl, frame: Number(posterFrame), output: png, browserExecutable: BROWSER, logLevel: 'error'});
  ff('-i', png, '-q:v', '3', path.join(outDir, `${id}-poster.jpg`));
  ff('-i', png, '-c:v', 'libwebp', '-quality', '82', path.join(outDir, `${id}-poster.webp`));
  fs.rmSync(png);
}

if (captions) {
  // Either ready-made cues [{start, end, text}] (film seconds) or aligned words to group by sentence.
  const data = JSON.parse(fs.readFileSync(captions, 'utf8'));
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
  const vtt = ['WEBVTT', ''].concat(lines.flat());
  fs.writeFileSync(path.join(outDir, `${id}.en.vtt`), vtt.join('\n'));
}

for (const f of fs.readdirSync(outDir)) console.log(' ', f, `${(fs.statSync(path.join(outDir, f)).size / 1e6).toFixed(2)} MB`);
