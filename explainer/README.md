# Onemarsmedia 360 explainer

30-second website explainer ("One brief → the whole campaign"), Editorial direction.
The film is described once in an After-Effects-shaped scene model and rendered two ways:

- **Remotion** → MP4 for the website (`src/render/SceneRenderer.tsx`)
- **After Effects** → an ExtendScript that rebuilds the film as a native, editable AE project (`ae/emit-jsx.ts`)

## Layout

| Path | What it is |
|---|---|
| `src/scene/` | Scene model (types), eases (exact AE speed/influence conversion), evaluation, builders |
| `src/render/` | Remotion renderer (AE semantics: parenting without opacity, alpha mattes, precomps) |
| `src/film/editorial/` | The film: tokens, tile precomps (`tiles.ts`, drawings in `art.json`), timeline (`film.ts`), timing data |
| `design/editorial/` | Approved styleframes (`frames.html`, PNGs) and motion notes |
| `ae/` | AE script generator and a recording mock of the AE DOM used by the tests |
| `audio/` | Offline VO alignment, beat-locked timing plan, VO pause edit, music edit, mix (-14 LUFS) |
| `assets/audio/` | Source audio: Joshua VO take, music, SFX (ElevenLabs) |
| `tools/` | `extract-art.mjs` (styleframes → vector JSON), `measure.mjs` (font metrics) |
| `scripts/` | `build-all.sh`, `render.mjs`, `package-ae.ts`, `stills.mjs` |
| `tests/` | Ease maths, springs, AE round trip of the test scene and of the whole film (every frame) |

## Commands (from `explainer/`)

```bash
npm install
npx tsx tests/run-all.ts            # all checks
bash scripts/build-all.sh           # audio → timing → render → AE package (deterministic)
node scripts/stills.mjs Onemarsmedia360 out/stills 0,240,645   # stills to review
npm run studio                      # Remotion Studio preview
```

Outputs: `out/final/` (master and web MP4, poster, VTT captions) and `out/ae/Onemarsmedia-360-AE.zip`.
The website uses the versioned copies in `../public/video/`.

## Changing things

- **Words on screen / layout / timing:** `src/film/editorial/film.ts`. Every event is derived from
  `timing/vo.json` (word times) and `timing/plan.json` (beat grid, music edit).
- **Voice-over:** replace `assets/audio/vo_*.mp3` and `vo_script.txt` (keep the commas where the picture cuts),
  then `bash scripts/build-all.sh`.
- **Tile drawings:** edit `design/editorial/frames.html`, then `node tools/extract-art.mjs`.
- Run the tests after any change: the AE round trip proves the AE project still matches the MP4.

Fonts are OFL (Anton, Schibsted Grotesk). Remotion is free for individuals and companies of up to 3 people;
larger companies need a Remotion company licence.
