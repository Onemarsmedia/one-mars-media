// Build the After Effects package for the film:
//   out/ae/Onemarsmedia-360-AE/
//     build-onemarsmedia-360.jsx   (File > Scripts > Run Script File...)
//     audio/ mix.wav (final, -14 LUFS) + vo.wav music.wav sfx.wav (stems, switched off in AE)
//     fonts/ Anton + Schibsted Grotesk (OFL)
//     CZYTAJ-MNIE.txt / README.txt
// and zips it. Before writing anything, the script is run on the AE mock and every animated
// property, expression and text is checked against the scene (same checks as tests/run-all.ts).
//
// npx tsx scripts/package-ae.ts <mixDir>   (mix.py output: master.wav, stems/, loudness.json)
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import {emitJsx} from '../ae/emit-jsx';
import {runJsx} from '../ae/mock/ae-mock';
import {buildEditorialScene, DURATION} from '../src/film/editorial/film';

const mixDir = process.argv[2] ?? 'work/mixout';
const name = 'Onemarsmedia-360-AE';
const dir = path.resolve('out/ae', name);
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
fs.mkdirSync(path.join(dir, 'fonts'), {recursive: true});

const scene = buildEditorialScene();
const main = scene.comps[scene.main];
const {jsx, manifest} = emitJsx(scene);
acorn.parse(jsx, {ecmaVersion: 3, sourceType: 'script'});
if (!/^[\x00-\x7f]*$/.test(jsx)) throw new Error('jsx must be ASCII');
const run = runJsx(jsx, {scriptPath: `/pkg/build-onemarsmedia-360.jsx`, existingFiles: (scene.audio ?? []).map((a) => `/pkg/audio/${a.file}`)});
const stopped = run.alerts.filter((a) => a.startsWith('Build stopped'));
if (stopped.length) throw new Error(stopped.join('\n'));
const layers = run.comps.reduce((n, c) => n + c.layerList.length, 0);
console.log(`jsx ${(jsx.length / 1e6).toFixed(2)} MB, ES3 ok, mock AE ok: ${run.comps.length} comps, ${layers} layers, ${manifest.length} animated properties, ${DURATION} frames`);

// the stems must never clip: each one, and their sum, stays under -1 dBFS sample peak
function peakDb(files: string[]): number {
  const ins = files.flatMap((f) => ['-i', f]);
  const chain = 'aformat=sample_fmts=flt,astats=metadata=0:measure_perchannel=none';
  const af = files.length > 1 ? ['-filter_complex', `${files.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${files.length}:normalize=0,${chain}`] : ['-af', chain];
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...ins, ...af, '-f', 'null', '-'], {encoding: 'utf8'});
  const m = /Peak level dB:\s*(-?[\d.]+)/.exec(r.stderr);
  return m ? Number(m[1]) : NaN;
}
const stemFiles = ['vo.wav', 'music.wav', 'sfx.wav'].map((f) => path.join(mixDir, 'stems', f));
const peaks: Array<[string, number]> = [...stemFiles.map((f): [string, number] => [path.basename(f), peakDb([f])]), ['sum', peakDb(stemFiles)]];
for (const [n, p] of peaks) if (!(p <= -1)) throw new Error(`stem check: ${n} peaks at ${p} dBFS (must stay under -1)`);
console.log('stems peak (dBFS):', peaks.map(([n, p]) => `${n} ${p.toFixed(2)}`).join(', '));

fs.writeFileSync(path.join(dir, 'build-onemarsmedia-360.jsx'), jsx);
fs.copyFileSync(path.join(mixDir, 'master.wav'), path.join(dir, 'audio', 'mix.wav'));
for (const f of ['vo.wav', 'music.wav', 'sfx.wav']) fs.copyFileSync(path.join(mixDir, 'stems', f), path.join(dir, 'audio', f));
for (const font of scene.fonts) fs.copyFileSync(path.join('public/fonts', font.file), path.join(dir, 'fonts', `${font.postscript}.ttf`));
const loud = JSON.parse(fs.readFileSync(path.join(mixDir, 'loudness.json'), 'utf8'));
const headroom = Math.max(0, loud.gain_db - loud.stem_gain_db).toFixed(1).replace('.', ',');
const headroomEn = Math.max(0, loud.gain_db - loud.stem_gain_db).toFixed(1);
const secs = Math.round(main.duration / main.fps);

const pl = `Onemarsmedia 360 - projekt After Effects
After Effects 2023 lub nowszy (przygotowane pod AE 2025/2026). Bez pluginów.

JAK OTWORZYĆ
1. Zainstaluj fonty z folderu "fonts": zaznacz wszystkie pliki z folderu > prawy przycisk > Zainstaluj
   (Mac: dwuklik na pliku > Zainstaluj czcionkę). Anton i Schibsted Grotesk są darmowe (licencja OFL).
   Potem uruchom ponownie After Effects.
2. File > Scripts > Run Script File... > wybierz "build-onemarsmedia-360.jsx".
   Folder "audio" musi leżeć obok skryptu. Gdy skrypt zapyta o nowy, pusty projekt
   ("...into a new, empty project?"), kliknij "Yes". Budowanie trwa ok. 1-3 min.
3. Na końcu pojawi się komunikat. Zapisz projekt: File > Save As > Save As... (Ctrl+Shift+S / Cmd+Shift+S).
   Jeśli komunikat wymienia podmienione fonty: zainstaluj je, uruchom AE ponownie i zbuduj projekt jeszcze raz
   (samo ponowne otwarcie projektu nie naprawi tekstów).

CO JEST W ŚRODKU
- Kompozycja główna "Onemarsmedia 360": ${secs} s, 1920x1080, ${main.fps} kl./s, markery scen, włączony motion blur.
- Wszystko jest natywne i edytowalne: warstwy kształtów, teksty, klatki kluczowe.
- Kamera: null "CAMERA" (skala = zbliżenie) i prekompozycja "WORLD" (pozycja = kadr).
  Cała strona (brief, kafle, pasek z licznikiem, plansza końcowa) leży w "WORLD".
  Głębia (2.5D): za stroną leżą jeszcze cztery płaszczyzny, każda z własnym nullem:
  "CAMERA FAR" + "WORLD FAR" i "CAMERA MID" + "WORLD MID" (duże koła, półkola i łuki w tle, same dryfują i się obracają),
  "CAMERA BACK" + "WORLD BACK" (linie siatki) i "CAMERA SHADOWS" + "WORLD SHADOWS" (cienie kafli).
  Wszystkie nulle CAMERA są dziećmi nulla "CAMERA RIG": jego Rotation to lekkie przechylenie kamery (maks. 1°) na ruchach w bok.
  Ich Scale to zbliżenie przeliczone na głębokość (dalsza płaszczyzna rośnie wolniej),
  dlatego przy najazdach warstwy się rozjeżdżają.
  Ruch kamery zmieniasz tak: Scale na nullach CAMERA i Position na prekompozycjach WORLD (te same czasy kluczy).
  Kamera płynie: klucze mają prędkość (influence 33%), więc nie zatrzymuje się na każdym kluczu.
  Wzór na skalę płaszczyzn jest w film.ts (planeScale), płynność liczy flowEases.
- Cienie (bez efektów, same kształty, więc wyglądają identycznie jak w MP4 i skalują się z kamerą):
  pod każdym gotowym kaflem "NN NAZWA shadow" (miękki cień) i "NN NAZWA contact" (ciemna krawędź przy stronie)
  w "WORLD SHADOWS". Kafel to karta: warstwa "... | card" w prekompozycji kafla zasłania jego własny cień.
  Na uderzeniu kafel podskakuje (Scale 104% na warstwie kafla w "GRID"), a cień odrywa się i opada razem z nim.
  "column shadow" (kolumny INDEX) i "masthead shadow" (nagłówek, tylko gdy strona przesuwa się pod nim).
  Słabsze cienie kafli: zmniejsz Opacity warstwy "WORLD SHADOWS" w kompozycji głównej (jedna wartość, bez kluczy).
- Kursor (strzałka) prowadzi widza: warstwy "cursor" i "click ring" na samej górze kompozycji głównej.
  Pozycja to klatki kluczowe co 2 klatki (ścieżka po stronie przeliczona przez kamerę),
  klik = klucze Scale na "cursor" i jeden błysk "click ring".
- Do ekranu przypięte są tylko: nagłówek (masthead) oraz kolumny "INDEX 03 FILMING" i "INDEX 12 DISTRIBUTION",
  które wjeżdżają z prawej.
- Licznik 360: prekompozycja "DEGREES 360", null "360 CONTROL", suwak "Degrees".
  Suwak steruje cyframi, ich wypełnieniem i pierścieniem.
  Uwaga: kafle, suwak "Tiles" (w "BAND STATUS"), napis "Now:" i linijka mają własne klatki kluczowe.
  Przy zmianie tempa przesuń je razem z kluczami suwaka "Degrees".
- Kafle: "TILE 01 CONCEPT" ... "TILE 12 DISTRIBUTION". Każdy kafel ma trzy stany: pusty (empty),
  aktywny, czerwony (active) i gotowy (live). Wyjątek: 03 FILMING to ciemny panel bez stanu czerwonego.
- Ilustracje kafli są w osobnych prekompozycjach, np. "TILE 03 FILMING | live" i "TILE 03 FILMING | active".
  W środku: null "... push-in" (powolny najazd na całą ilustrację) i warstwy animacji nazwane od rodzaju ruchu
  ("... blink 20", "... pulse 16+17+18+19", "... draw 27", "... loop 132+133" itd.).
  Timecode w FILMING to klatki kluczowe Source Text na warstwie "03 FILMING | live loop timecode".
- Brief: prekompozycja "BRIEF TYPE" i 12 warstw "brief slice" z track matte. To one rozlatują się na miejsca kafli.
- Plansza końcowa: logo słowne "Onemarsmedia wordmark" rośnie z pasa na górę strony,
  a na ostatnie uderzenie muzyki wchodzą napisy ("credit company", "credit director" itd.).
- Audio: warstwa "Mix (final, -14 LUFS)" to gotowy miks, ten sam co w MP4.
  Stemy (lektor, muzyka, SFX) są wyłączone. Włącz je, jeśli chcesz zrobić własny miks: są bez limitera
  i ściszone o ${headroom} dB względem miksu, żeby ich suma nie przesterowywała.

WERSJA 9:16 LUB INNY FORMAT
Utwórz nową kompozycję i przeciągnij do niej z panelu Project potrzebne prekompozycje
(GRID, BAND, DEGREES 360, TILE ...). Nie zależą od siebie. Kadr ustawisz nullem, tak jak w "Onemarsmedia 360".
`;
const en = `Onemarsmedia 360 - After Effects project
After Effects 2023 or newer (prepared for AE 2025/2026). No plugins.

HOW TO OPEN
1. Install the fonts in "fonts": select all the files > right-click > Install (Mac: double-click > Install Font).
   Anton and Schibsted Grotesk are free (OFL). Then restart After Effects.
2. File > Scripts > Run Script File... > "build-onemarsmedia-360.jsx".
   Keep the "audio" folder next to the script. When the script asks about a new, empty project, click "Yes".
   The build takes about 1-3 minutes.
3. A message appears at the end. Save: File > Save As > Save As... (Ctrl+Shift+S / Cmd+Shift+S).
   If the message lists substituted fonts: install them, restart AE and build again
   (reopening the project will not fix the text).

WHAT IS INSIDE
- Main comp "Onemarsmedia 360": ${secs} s, 1920x1080, ${main.fps} fps, scene markers, motion blur on.
- Everything is native and editable: shape layers, text, keyframes.
- Camera: null "CAMERA" (scale = zoom) and the precomp "WORLD" (position = framing).
  The whole page (brief, tiles, counter band, final card) lives in "WORLD".
  Depth (2.5D): four more planes sit behind the page, each with its own null:
  "CAMERA FAR" + "WORLD FAR" and "CAMERA MID" + "WORLD MID" (big rings, half-discs and arcs that drift and turn),
  "CAMERA BACK" + "WORLD BACK" (the grid lines) and "CAMERA SHADOWS" + "WORLD SHADOWS" (the tile shadows).
  All the CAMERA nulls are children of the "CAMERA RIG" null: its Rotation is the gentle bank (max 1 deg) on sideways moves.
  Their Scale is the zoom converted to their depth (a farther plane grows more slowly),
  so the layers separate during the push-ins.
  To change the camera move: Scale on the CAMERA nulls and Position on the WORLD precomps (same key times).
  The camera flows: the keys carry speed (33% influence), so it does not stop at every key.
  The plane scale formula is in film.ts (planeScale); the flow is computed by flowEases.
- Shadows (no effects, plain shapes, so they look exactly like the MP4 and scale with the camera):
  under every live tile "NN NAME shadow" (the soft shadow) and "NN NAME contact" (the dark edge at the page)
  in "WORLD SHADOWS". A tile is a card: the "... | card" layer in the tile precomp hides its own shadow.
  On its hit the tile pops (Scale 104% on the tile layer in "GRID") and its shadow lifts and settles with it.
  "column shadow" (the INDEX columns) and "masthead shadow" (the masthead, only while the page moves under it).
  Weaker tile shadows: lower the Opacity of the "WORLD SHADOWS" layer in the main comp (one value, no keys).
- An arrow cursor leads the viewer: the "cursor" and "click ring" layers at the top of the main comp.
  Its position is keyed every 2 frames (a path on the page projected through the camera);
  a click is Scale keys on "cursor" and one flash of "click ring".
- Fixed to the screen: only the masthead and the "INDEX 03 FILMING" / "INDEX 12 DISTRIBUTION" columns,
  which slide in from the right.
- 360 counter: precomp "DEGREES 360", null "360 CONTROL", slider "Degrees".
  The slider drives the digits, their fill and the ring.
  Note: the tiles, the "Tiles" slider (in "BAND STATUS"), the "Now:" text and the ruler have their own keyframes.
  To change the pace, move them together with the "Degrees" keys.
- Tiles: "TILE 01 CONCEPT" ... "TILE 12 DISTRIBUTION". Each tile has three states: empty, active (red)
  and live. Exception: 03 FILMING is the dark panel and has no red state.
- The tile illustrations are precomps of their own, e.g. "TILE 03 FILMING | live" and "TILE 03 FILMING | active".
  Inside: a "... push-in" null (a slow push on the whole illustration) and animation layers named by their move
  ("... blink 20", "... pulse 16+17+18+19", "... draw 27", "... loop 132+133" and so on).
  The FILMING timecode is Source Text keyframes on "03 FILMING | live loop timecode".
- Brief: precomp "BRIEF TYPE" and 12 "brief slice" layers with track mattes; they fly to the tile slots.
- Final card: the "Onemarsmedia wordmark" rises from the band to the top of the page, and the credits
  ("credit company", "credit director" ...) land on the music's last hit.
- Audio: the "Mix (final, -14 LUFS)" layer is the finished mix, the same as in the MP4.
  The stems (VO, music, SFX) are switched off. Turn them on for your own mix: they have no limiter
  and sit ${headroomEn} dB below the mix, so their sum does not clip.

9:16 OR ANOTHER FORMAT
Create a new comp and drag the precomps you need from the Project panel
(GRID, BAND, DEGREES 360, TILE ...). They are independent. Frame them with a null, as in "Onemarsmedia 360".
`;
fs.writeFileSync(path.join(dir, 'CZYTAJ-MNIE.txt'), pl);
fs.writeFileSync(path.join(dir, 'README.txt'), en);
const zip = path.resolve('out/ae', `${name}.zip`);
fs.rmSync(zip, {force: true});
execFileSync('python3', ['-I', '-c', `import shutil; shutil.make_archive(${JSON.stringify(zip.replace(/\.zip$/, ''))}, 'zip', ${JSON.stringify(path.dirname(dir))}, ${JSON.stringify(name)})`]);
console.log('package:', zip, `${(fs.statSync(zip).size / 1e6).toFixed(1)} MB`);
