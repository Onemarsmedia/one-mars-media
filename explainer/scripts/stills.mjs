// node scripts/stills.mjs <compositionId> <outDir> <frame,frame,...>
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

export const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const [id, outDir, frames] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const composition = await selectComposition({serveUrl, id, browserExecutable: BROWSER, logLevel: 'error'});
for (const f of frames.split(',').map(Number)) {
  const output = path.join(outDir, `${id}-${String(f).padStart(4, '0')}.png`);
  await renderStill({composition, serveUrl, frame: f, output, browserExecutable: BROWSER, logLevel: 'error'});
  console.log('wrote', output);
}
