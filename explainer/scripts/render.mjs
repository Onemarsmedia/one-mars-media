// Render the film and package the deliverables.
//   node scripts/render.mjs <compositionId> <outDir> [--audio master.wav] [--poster-frame N] [--captions words.json]
// Produces in <outDir>:
//   <id>-master.mp4   H.264 High, CRF 16, AAC 320k (archive / other platforms)
//   <id>-web.mp4      H.264 High@4.2 (4 refs), ~6 Mbps, AAC 192k, faststart (website)
//   <id>-720.mp4      H.264 High@3.2, 1280x720, ~3 Mbps, AAC 128k, faststart (website, phones)
//   <id>-poster.webp  the poster frame (website <video poster>), plus <id>-poster.jpg (thumbnail)
//   <id>.en.vtt       captions from the VO word timings (if --captions)
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {writeVtt} from './vtt.mjs';

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
const web720 = path.join(outDir, `${id}-720.mp4`);
ff('-i', silent, ...audioIn, '-map', '0:v:0', ...audioMap, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '3.2', '-x264-params', 'ref=4', '-crf', '21', '-maxrate', '3M', '-bufsize', '6M', '-preset', 'slow', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : []), '-movflags', '+faststart', web720);
fs.rmSync(silent);

if (posterFrame !== undefined) {
  const png = path.join(outDir, `${id}-poster.png`);
  await renderStill({composition, serveUrl, frame: Number(posterFrame), output: png, browserExecutable: BROWSER, logLevel: 'error'});
  ff('-i', png, '-q:v', '3', path.join(outDir, `${id}-poster.jpg`));
  ff('-i', png, '-c:v', 'libwebp', '-quality', '82', path.join(outDir, `${id}-poster.webp`));
  fs.rmSync(png);
}

if (captions) writeVtt(captions, path.join(outDir, `${id}.en.vtt`));

for (const f of fs.readdirSync(outDir)) console.log(' ', f, `${(fs.statSync(path.join(outDir, f)).size / 1e6).toFixed(2)} MB`);
