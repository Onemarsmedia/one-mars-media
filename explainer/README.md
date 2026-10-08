# Onemarsmedia 360 explainer

54-second website explainer ("One brief → the whole campaign"), Editorial direction, v5:
one camera flies over a single page with no cuts, every tile lands on a beat and stays long enough to read,
the page has 2.5D depth (grid, shadows and tiles on separate planes), an arrow cursor leads the eye, and
the film ends on a clear credit card (Onemarsmedia Limited, directed by Marek Mars). 60 fps, motion blur.
The film is described once in an After-Effects-shaped scene model and rendered two ways:

- **Remotion** → MP4 for the website (`src/render/SceneRenderer.tsx`)
- **After Effects** → an ExtendScript that rebuilds the film as a native, editable AE project (`ae/emit-jsx.ts`)

## Layout

| Path | What it is |
|---|---|
| `src/scene/` | Scene model (types), eases (exact AE speed/influence conversion), evaluation, builders |
| `src/render/` | Remotion renderer (AE semantics: parenting without opacity, alpha mattes, precomps) and motion blur |
| `src/film/editorial/` | The film: tokens, tile precomps and their animation engine (`tiles.ts`, drawings in `art.json`), what moves in each tile (`tileAnims.ts`), timeline and camera (`film.ts`), timing data |
| `design/editorial/` | Approved styleframes (`frames.html`, PNGs) and motion notes |
| `ae/` | AE script generator and a recording mock of the AE DOM used by the tests |
| `audio/` | Offline VO alignment, beat-locked timing plan, VO pause edit, music edit, mix (-14 LUFS) |
| `assets/audio/` | Source audio: Joshua VO take (`vo2_*`), timing config, music, SFX (ElevenLabs) |
| `tools/` | `extract-art.mjs` (styleframes → vector JSON), `measure.mjs` (font metrics), `art-table.ts` (a tile's items, to pick animation indices), `write-tile-anims.ts` |
| `scripts/` | `build-all.sh`, `render.mjs`, `package-ae.ts`, `stills.mjs` |
| `tests/` | Ease maths, springs, AE round trip of the test scene and of the whole film (every frame) |

## Commands (from `explainer/`)

```bash
npm install
npx tsx tests/run-all.ts            # all checks
bash scripts/build-all.sh           # audio → timing → render → AE package (deterministic)
node scripts/stills.mjs Onemarsmedia360 out/stills 300,725,1830   # stills to review (frames at 60 fps)
node scripts/render.mjs TilesAnim out/tilesanim   # 10 s of the 12 tiles animating
npm run studio                      # Remotion Studio preview
```

Outputs: `out/final/` (master and web MP4, poster WebP/JPEG, VTT captions) and `out/ae/Onemarsmedia-360-AE.zip`
(script + final mix + switched-off stems + fonts + readmes in PL/EN).
The website uses the versioned copies in `../public/video/`.

## Changing things

- **Words on screen / layout / timing:** `src/film/editorial/film.ts`. Every event is derived from
  `timing/vo.json` (word times) and `timing/plan.json` (beat grid, music edit).
- **Camera:** the `CAMERA` table in `film.ts` (time, world point at the centre of the screen, zoom, ease).
  In AE it is the null `CAMERA` (scale) and the precomp `WORLD` (position). Two depth planes follow it at
  perspective-correct scales (`planeScale`, `DEPTH`): `CAMERA BACK`/`WORLD BACK` (grid) and
  `CAMERA SHADOWS`/`WORLD SHADOWS` (tile shadows).
- **Shadows:** `shadowLayers()` (tiles: soft key + contact shadow, both pop with the tile on its hit), the column
  shadow in `indexComp()` and the sticky masthead shadow in `mastheadLayers()`. They are stacked rects with a
  Gaussian falloff (`shadowSteps`), not effects: the MP4 and AE match exactly and the softness scales with the camera.
- **Cursor:** `cursorPlan()` in `film.ts` (time, point on the page, click). It is projected through the camera,
  so it stays on what it points at; clicks that are not tile hits get a quiet tap.
- **Voice-over:** replace `assets/audio/vo2_*.mp3` and `vo2_script.txt` (keep the commas where the picture
  changes), adjust `assets/audio/plan_config.json` (pauses, which words land on the beat), then
  `bash scripts/build-all.sh`.
- **Tile drawings:** edit `design/editorial/frames.html`, then `node tools/extract-art.mjs`
  (check `tileAnims.ts` indices afterwards: the tests validate them).
- **Tile animations:** `src/film/editorial/tileAnims.ts` (blink, drift, loop, pulse, draw, pop, bob, tilt, pump,
  follow, hop, type, timecode). Find indices with `npx tsx tools/art-table.ts <tile>`.
- Run the tests after any change: the AE round trip proves the AE project still matches the MP4.

Fonts are OFL (Anton, Schibsted Grotesk). Remotion is free for individuals and companies of up to 3 people;
larger companies need a Remotion company licence.
