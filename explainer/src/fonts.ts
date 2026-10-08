import {continueRender, delayRender, staticFile} from 'remotion';
import type {FontRef} from './scene/types';

// Load every font the scene uses before the first frame renders.
const loaded = new Set<string>();

export function loadFonts(fonts: FontRef[]) {
  const pending = fonts.filter((f) => !loaded.has(f.file));
  if (!pending.length) return;
  const handle = delayRender('fonts');
  Promise.all(
    pending.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`, {weight: String(f.weight), style: f.style ?? 'normal'});
      await face.load();
      (document.fonts as FontFaceSet & {add(f: FontFace): void}).add(face);
      loaded.add(f.file);
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
}
