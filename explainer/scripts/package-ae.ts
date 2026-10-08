// Build the After Effects package for the film:
//   out/ae/Onemarsmedia-360-AE/
//     build-onemarsmedia-360.jsx   (File > Scripts > Run Script File...)
//     audio/ vo.wav music.wav sfx.wav   (stems that add up to the final mix)
//     fonts/ Anton + Schibsted Grotesk (OFL)
//     CZYTAJ-MNIE.txt / README.txt
// and zips it. Before writing anything, the script is run on the AE mock and every animated
// property, expression and text is checked against the scene (same checks as tests/run-all.ts).
//
// npx tsx scripts/package-ae.ts <stemsDir>
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import {emitJsx} from '../ae/emit-jsx';
import {runJsx} from '../ae/mock/ae-mock';
import {buildEditorialScene, DURATION} from '../src/film/editorial/film';

const stems = process.argv[2] ?? 'work/mixout/stems';
const name = 'Onemarsmedia-360-AE';
const dir = path.resolve('out/ae', name);
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
fs.mkdirSync(path.join(dir, 'fonts'), {recursive: true});

const scene = buildEditorialScene();
const {jsx, manifest} = emitJsx(scene);
acorn.parse(jsx, {ecmaVersion: 3, sourceType: 'script'});
if (!/^[\x00-\x7f]*$/.test(jsx)) throw new Error('jsx must be ASCII');
const run = runJsx(jsx, {scriptPath: `/pkg/build-onemarsmedia-360.jsx`, existingFiles: (scene.audio ?? []).map((a) => `/pkg/audio/${a.file}`)});
const stopped = run.alerts.filter((a) => a.startsWith('Build stopped'));
if (stopped.length) throw new Error(stopped.join('\n'));
const layers = run.comps.reduce((n, c) => n + c.layerList.length, 0);
console.log(`jsx ${(jsx.length / 1e6).toFixed(2)} MB, ES3 ok, mock AE ok: ${run.comps.length} comps, ${layers} layers, ${manifest.length} animated properties, ${DURATION} frames`);

fs.writeFileSync(path.join(dir, 'build-onemarsmedia-360.jsx'), jsx);
for (const f of ['vo.wav', 'music.wav', 'sfx.wav']) fs.copyFileSync(path.join(stems, f), path.join(dir, 'audio', f));
for (const font of scene.fonts) fs.copyFileSync(path.join('public/fonts', font.file), path.join(dir, 'fonts', `${font.postscript}.ttf`));

const pl = `ONEMARSMEDIA 360 - PROJEKT AFTER EFFECTS (AE 2025/2026)

1. Zainstaluj fonty z folderu "fonts" (dwuklik > Zainstaluj): Anton i Schibsted Grotesk.
   Są darmowe (licencja OFL). Zrób to PRZED uruchomieniem skryptu.
2. Otwórz After Effects (nowy, pusty projekt).
3. File > Scripts > Run Script File... > wybierz "build-onemarsmedia-360.jsx".
   Skrypt sam zbuduje cały projekt (ok. 1-3 min). Folder "audio" musi leżeć obok skryptu.
4. Na końcu pojawi się komunikat. Zapisz projekt: File > Save As.

CO JEST W ŚRODKU
- Kompozycja główna: "ONEMARSMEDIA 360" (30 s, 1920x1080, 30 kl./s) z markerami scen.
- Wszystko jest edytowalne: warstwy kształtów, teksty, klatki kluczowe.
- Licznik 360: prekompozycja "DEGREES 360", null "360 CONTROL", suwak "Degrees".
  Przesuwasz klatki tego suwaka i zmienia się tempo licznika, wypełnienie cyfr oraz pierścień.
- Kafle: "TILE 01 CONCEPT" ... "TILE 12 DISTRIBUTION". Każdy ma wygląd pusty, aktywny (czerwony) i gotowy.
- Siatka kafli: "GRID". Zbliżenia to twarde cięcia skali i pozycji tej warstwy (Collapse Transformations włączone).
- Pasek z licznikiem: "BAND" (null "BAND CONTROL", suwak "Tiles" = ile kafli jest gotowych).
- Audio: lektor, muzyka (już ściszona pod głosem) i SFX jako osobne ścieżki. Razem dają finalny miks (-14 LUFS).

DO PRZERÓBKI NA 9:16 LUB INNY FORMAT
Zrób nową kompozycję i przenieś do niej prekompozycje (GRID, BAND, DEGREES 360) – są od siebie niezależne.
`;
const en = `ONEMARSMEDIA 360 - AFTER EFFECTS PROJECT (AE 2025/2026)

1. Install the fonts in "fonts" (Anton, Schibsted Grotesk; OFL) BEFORE running the script.
2. After Effects > File > Scripts > Run Script File... > "build-onemarsmedia-360.jsx".
   Keep the "audio" folder next to the script. The build takes about 1-3 minutes.
3. File > Save As to keep the project.

Main comp "ONEMARSMEDIA 360" (30 s, 1920x1080, 30 fps) with scene markers. Everything is native and editable.
The counter is driven by one slider: "DEGREES 360" > "360 CONTROL" > Degrees.
`;
fs.writeFileSync(path.join(dir, 'CZYTAJ-MNIE.txt'), pl);
fs.writeFileSync(path.join(dir, 'README.txt'), en);
const zip = path.resolve('out/ae', `${name}.zip`);
fs.rmSync(zip, {force: true});
execFileSync('python3', ['-I', '-c', `import shutil; shutil.make_archive(${JSON.stringify(zip.replace(/\.zip$/, ''))}, 'zip', ${JSON.stringify(path.dirname(dir))}, ${JSON.stringify(name)})`]);
console.log('package:', zip, `${(fs.statSync(zip).size / 1e6).toFixed(1)} MB`);
