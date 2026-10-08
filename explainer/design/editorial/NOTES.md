# Direction B: Editorial (Swiss poster / magazine)

Onemarsmedia "360" website explainer. Four styleframes plus one review extra.

| file | t | beat | 360° device |
|---|---|---|---|
| f1.png | ≈1.5 s | The brief, "We need / a launch." with a red cursor, plus a memo header (To: Onemarsmedia / From: Brand team / Re: Launch) | 000°, outline numerals, empty ring, empty ruler |
| f2.png | ≈9 s | Tile hero: a hard cut to a 320 % crop of the grid on 03 FILMING. The hero tile snaps to the left margin (64 px), so neighbour 02 is fully off-frame; the waiting 04 slot and row 2 bleed off the right and bottom. A contents column (from column 9, behind an ink divider at x = 1200) shows the position as 3 of 12 | 090°, numerals ¼ filled, ring arc 90° |
| f3.png | ≈20 s | The grid: 12 slots. 01–09 are alive, 10 APPS is active (red panel), 11 and 12 are hatched *reserved* slots (not X boxes, which read as missing images on a web poster). **Poster frame** | 300°, numerals ⅚ filled, ring arc 300°, ruler 10/12 |
| f4.png | ≈29 s | End card: "One team. / No limits." with the 12 deliverables as a contents list. The masthead keeps only "One brief. The whole campaign." (its wordmark and URL have dropped into the lockup, so nothing is duplicated). Band: "BRANDED CONTENT PRODUCTION, LONDON" label on top, the **Onemarsmedia** wordmark (112 px) and onemarsmedia.com on the shared baseline y = 1020, level with the 360° numerals | 360°, solid numerals, full red ring |
| tiles.png (extra) | ≈25 s | Pull-back: all 12 tiles alive. This is the only frame where 11 AI and 12 DISTRIBUTION can be seen | 360° |

Source: `frames.html?frame=f1|f2|f3|f4|tiles` (inline SVG; every tile is one function in `ART{}`).

---

## Palette

| hex | role |
|---|---|
| `#F1ECE2` | **Paper.** Ground for every frame. Warm and uncoated, never white |
| `#E3DBCB` | Paper‑2. Tile art panels and the light fills inside mini-UIs |
| `#CBC1AE` | Soft. Placeholder text bars and secondary fills |
| `#121110` | **Ink.** All type, rules, solid shapes, the filming viewfinder panel |
| `#6E675D` | Graphite. Secondary text, empty-tile rules, frames and hatch, future index rows |
| `#FF4A1C` | **REC red-orange, the one loud accent.** Cursor, active tile, degree ring arc, REC dot, playheads, key-visual disc, full stops of the sign-off |
| `#2A2724` | Dark‑2. Secondary fill inside a dark panel (only used if a tile is set to the dark theme) |
| `#B9AF9C` | Tan shade, used only for the presenter's neck and collar in FILMING |

Why red-orange: it is the colour of a camera's tally / REC light and of a print signal colour. One hue connects "production craft" (REC) with the editorial print look. It is warm, it sits on paper without glowing, and it is as far from Master of One's electric blue on black as possible. Rule: **at most one red mass per region**. Red is a signal, never a background, except for the one active tile.

## Fonts (both OFL, no monospace anywhere)

| family | weights | role |
|---|---|---|
| **Anton** | 400 (its only weight, heavy and condensed) | Poster type: the brief line, the sign-off, the giant degree numerals, tile numbers 01–12, display words inside mini-UIs ("THE LAUNCH.", "LAUNCH", "Aa") |
| **Schibsted Grotesk** | 800 / 700 / 600 / 500 | Everything else: running head, tile labels (800, caps, +0.1em tracking), memo, contents lists, captions, timecodes (tabular figures), and the **Onemarsmedia** wordmark (800, −3.5 tracking) |

Big Shoulders Display was tested and rejected: the variable instance renders overlap artefacts in "W". Timecodes and degrees use Schibsted's tabular figures instead of a mono font.

## Grid and page furniture
- 1920×1080, 64 px margins. **12 columns × 131 px with 20 px gutters.** Hairline column guides (ink at 6–8.5 %) are visible on the paper, and tiles sit on paper so the guides show only in gutters and empty space.
- Running head: "Onemarsmedia", "One brief. The whole campaign." and onemarsmedia.com, set in Schibsted on a 2.5 px ink rule. It is a magazine masthead, not a corner HUD. On the end card only the tagline stays (moved to the left margin) and the wordmark and URL drop into the sign-off lockup.
- Tile = 2 columns + gutter = **282 px**. The grid is 6 × 2. Each tile has: a 6 px ink top rule, an Anton number (42 px), a caps label (19 px, 800, +1.6 tracking, at x = 54), a grey "+30°" tag (15 px; red on the active tile), and a 282×197 art panel.
- Bottom band: a 2.5 px rule at y = 652. Label and status at top left. A 12-segment ruler sits on the baseline, numbered 01–12 inside, with ticks at 0/90/180/270/360°. The giant degrees are right-aligned on the same baseline (y = 1020). f1, f3, f4 and the pull-back share this band, so the counter never moves; only the content above it changes.

## Tile drawing language
- **Printed flat graphics.** Hard-edged rectangles, no rounded corners on tiles, frames, phones or browser windows. No shadows, no gradients. Square caps and mitre joins.
- Strokes are 2.5–4.5 u in a 400×280 art space (≈1.8–3.2 px at grid size). Mini-UIs use ink, paper, paper-2 and soft, plus **one red element per tile** (REC dot, playhead, highlight, CTA, keyframe dot, selected variation).
- Real words appear inside the UIs (REC, 00:00:09:14, TITLE, EP. 01, POST IT / TOSS IT, LAUNCH, 16:9…) because they make each tile recognisable in under a second.
- **Campaign key visual.** A red disc rising over an ink horizon ramp is the client artwork. It recurs in Concept (moodboard), Storyboard (end frame), Design (poster), Social (post), Web (hero), Apps (swipe card), AI (4 variations) and Distribution (the same art in 16:9, 9:16, 1:1 and 4:5). FILMING's set uses the same disc as its backdrop. This shared motif is what makes 12 tiles read as **one campaign**.
- Three tile states:
  - **Empty / reserved:** a 2 px graphite rule, an outline number, a graphite label, and a panel of 45° graphite hatch hairlines (14 u pitch, 32 %) inside a 1.5 px frame. It reads as a print knock-out area waiting for its plate. No X placeholder: on a website poster frame an X-in-a-box reads as a broken image.
  - **Live:** ink rule, panel filled.
  - **Active:** red rule, red number, red panel. Inside it, red roles flip to paper.
- FILMING is the one dark (ink) panel. It is the craft hero and gives the grid a single black accent. The presenter is a medium close-up with squared shoulders and an open paper collar (not a bell/pawn silhouette); the HUD keeps REC + timecode + battery top, format + audio meters bottom-left, so nothing overlaps the subject.
- STORYBOARD is a 2 × 2 sheet of 16:9 sketch panels (01 WIDE, 02 PUSH IN with red camera-move arrows, 03 REVEAL, 04 END FRAME = the key visual), so it fills its panel like its neighbours.
- SOCIAL is a 9:16 post with the desktop-Reels layout beside it: avatar + handle bars, then like (red), comment and share with count bars. No floating hearts.

## The 360° device (typographic hero)
1. **Giant Anton numerals** (380 px in the band, 300 px in f2), padded to 3 digits (000 → 360). Two layers:
   - an ink outline;
   - an ink fill clipped by a rectangle that **rises from the baseline by deg/360**. The numerals fill like a gauge: 000 is empty outline, 360 is solid.
2. **The degree sign is a ring.** A hairline track plus a thick red arc drawn with a trim path to deg/360. At 000° only a red start tick shows at 12 o'clock. At 360° the ring is a full red circle: "full circle" is literally drawn.
3. **Split-flap seam.** A paper-coloured bar cuts through the digits at half cap-height. It is the hinge of the flap.
4. **Ruler.** 12 segments, one per tile, 30° each, so 12 × 30° = 360°. Segments go ink as tiles go live, red for the active one, and stay hairline while waiting. The tile tags "+30°" and the f2 contents list (030°…360°) repeat the same arithmetic.

## v3 additions (client feedback on v2: "flows now; the pictures should move; the end card must say who we are")
- **Living tiles.** Each illustration is its own precomp with a slow 3 % push-in and one clear hero motion plus
  one or two quiet ones (tileAnims.ts): the brief line types, storyboard arrows draw, the viewfinder blinks REC and
  runs timecode while the focus box breathes, clips drop onto the timeline and the playhead loops, the bezier dot
  rides its curve, swatches land, waveform bars pump, likes swell, the CTA pulses, the swipe card tilts, the prompt
  types and the selection hops between variations, distribution arrows draw to the formats. Restraint: small
  amplitudes, staggered periods, nothing in sync on the wall.
- **Headers land softly.** The rule wipes (red and ink alike), number/label/tag rise in with a 2-frame stagger,
  the reserved slot's outline header fades out at once.
- **Final card (42 s).** After the voice, the sign-off and contents lift off, the wordmark rises from the band
  to the top of the page at twice the size, and on the music's stop the credits land: PRODUCTION
  Onemarsmedia Limited / Branded content production, London; DIRECTED BY Marek Mars; onemarsmedia.com.
  The masthead's right slot reads "One team. No limits." The camera rests on the end card.

## Motion v2: "one camera, one page" (supersedes the v1 signature below)
Client feedback on v1: the look is right, but the hard cuts feel choppy and stiff. v2 keeps the palette,
type, grid, tiles and 360° device, and changes only how things move. 40 s, 60 fps, motion blur (180°).
- **One continuous camera, no cuts.** Brief, grid, band and end card are one page (`WORLD`). A camera null
  drifts slowly between eased moves: row 1 left → push into the FILMING hero on the 90° hit → row 1 right →
  the counter on "That's halfway" → row 2 left (with the status line) → row 2 right → push into DISTRIBUTION
  on the 360° hit → one pull-back to the full wall on "That's three-sixty". Only the masthead and the two
  contents columns are fixed to the screen; the columns slide in from the right.
- **Break-apart.** The typed headline is cut into a 6×2 grid of slices that fly to the 12 tile slots on
  "...and one team"; each slice dissolves into its hatched reserved slot.
- **Easing.** Smooth in-out on camera moves and fades; entrances rise 10–26 px with a soft settle; wipes keep
  the rectangular mask language (rules left→right, panels top→bottom) but ease in and out. The active (red)
  tile and ruler segment dissolve into their done state.
- **Counter.** Counts up +30° over 0.35 s on each tile (0.5 s for the 360° lock). Tiles 3, 6, 9 and 12 land
  on the counter hits, so the counter, ruler, "N of 12" and the tile always agree.
- **Micro-loops.** REC blinks and the timecode runs (Filming), the playheads glide (Editing, Podcast), the
  prompt cursor blinks (AI).
- **End card.** Tiles lift off right-to-left, the status line fades, the contents list cascades in, the
  wordmark and "One team." / "No limits." wipe on with the voice, the red full stops rise in last.

## Motion signature v1: "print shop, not camera rig"
- **Grammar: hard cuts on the beat.** No dissolves, blurs, floating or slow push-ins. Every VO stress or music downbeat is a cut or a snap. The layout re-composes on the cut, like turning a magazine page.
- **Easing.** Mechanical and decisive. Moves last 4–8 frames with a strong ease-out (AE: incoming influence 85–90 %, outgoing 0 %), and things *arrive and stop*. **No springs, bounce or overshoot.** The only "life" is stepped: hold keyframes and 2-frame staggers.
- **Rectangular mask wipes** are the transition primitive. Panels, rules, the index highlight and the type column all reveal with axis-aligned rect masks: left→right for rules, top→bottom for panels.
- **0–3 s, the brief.** Typewriter at 2 frames per character with a red bar cursor that blinks 12 frames on / 12 off. Key click SFX. The memo block wipes in line by line.
- **3–6 s, break-apart.** The two lines of type are sliced by a 6×2 rectangle grid of masks. On the beat each slice snaps (one frame, no tween) into a tile position and becomes a hatched reserved slot. Type fills the frame, then snaps away.
- **6–24 s, tiles come alive**, each on its VO word:
  1. the top rule wipes 4 f;
  2. the panel rect-wipes down 5 f;
  3. the mini-UI parts land with a 2-frame stagger (8 px offsets, ease-out);
  4. one micro-loop runs: REC blinks, the playhead scrubs, waveform bars pump, the bezier dot travels, the prompt cursor blinks, the swipe card tilts.
  
  The active tile is red for its beat and returns to paper‑2 on the next cut.
- **Counter.** On each tile, the digits **split-flap**: the top half folds down over 3 frames about the seam, with a soft clack SFX under the music. The fill gauge steps up 1/12 and the ring arc draws +30° in 6 f. All motion is stepped; nothing glides.
- **"Camera".** No virtual camera moves. Hero moments are **hard-cut re-crops** of the grid precomp (100 % → 320 %, f2). The contents column wipes in from the right (6 f) and the index highlight jumps row to row. The pull-back at 24–27 s is **three stepped scale cuts**, 320 → 180 → 100 %, on three beats. It is not a dolly.
- **End card.** The tiles collapse to their top rules with a 2-frame stagger, and the rules wipe off. "One team." then "No limits." hard-cut on, one line per beat, and the red full stops land last. The contents list wipes in. The masthead wordmark and URL hard-cut down into the lockup (the tagline slides to the left margin on the same cut). The wordmark rect-wipes left→right. The ring closes to 360° on the final hit.

## Why this is not Master of One

| Master of One | Editorial (this) |
|---|---|
| near-black #070708 ground | warm paper #F1ECE2 |
| electric blue #3D9BFF with glow | REC red-orange, flat, never glowing |
| Inter Tight + JetBrains Mono | Anton + Schibsted Grotesk, no mono at all |
| small mono HUD in four corners | one masthead rule, plus a giant counter as the layout's hero |
| film grain | clean print flats, no texture |
| words sliding up out of blur | hard cuts, rect-mask wipes, split-flap flips |
| glowing orb | no sphere: the only circle is the flat red disc of the client key visual and the degree ring |
| slow push-in | no camera drift, only stepped re-crops |

## After Effects build notes (all native)
- **Comp.** 1920×1080 at 30 fps. Background is a solid #F1ECE2. Guides are one shape layer of 24 vertical 1 px lines (ink, 8 % opacity).
- **Fonts.** Install Anton and Schibsted Grotesk (OFL). For timecodes and degrees turn on Character › OpenType › *Tabular lining*.
- **Tiles.** Each tile is a precomp of 282×253 (header shape layers and text, plus the art precomp at 400×280 scaled 70.5 %). The grid is a precomp of the 12 tiles. Turn on **Collapse Transformations** on the grid and the tiles so the 320 % crop cut stays vector-sharp. The reserved-slot hatch is one shape layer (a single line + Repeater, 45° rotation) masked by the panel rectangle; it wipes off top→bottom as the panel wipes on.
- **Key visual.** One 3-shape precomp (rect, ellipse, polygon), reused by 9 tiles, with per-instance parameters.
- **Gauge numerals.**
  - Text layer A: stroke only, 3.5 px at 380 pt.
  - Text layer B: fill only, under a rectangle shape set as an **Alpha Matte**.
  - A slider `deg` drives the matte's Y: `capHeight * deg/360`. Use hold keyframes every 30°. The seam is a 4 px paper rectangle.
- **Split-flap.** Each digit is a text layer with hold keyframes on Source Text. For the flip, duplicate it, mask the top half, and animate Scale Y 100 → 0 about an anchor on the seam (3 f), then reveal the new value.
- **Degree ring.** An Ellipse with a 23.5 px red stroke and **Trim Paths End = deg/360·100**. Set Offset so it starts at 12 o'clock and runs clockwise. Under it, the same ellipse as a 1.7 px ink track at 35 %.
- **Ruler.** 12 rectangles with hold-keyframed fill colour, plus 12 text layers.
- **Typing.** A text animator (Opacity 0, Range Selector based on characters, hold keyframes per character) or the Typewriter preset. The cursor is a red shape layer whose X follows `sourceRectAtTime().width` by expression.
- **Wipes.** Rectangle masks or track mattes. Ease-out only (influence 85–90 %).
- **Effects.** None are required: no glow, blur, grain or 3D. Everything is shape layers, text layers, masks and mattes, so it stays fully editable.

## Legibility at the 960 px embed
- Headlines are 260 px (130 px at half size). Degree numerals are 380 px. Tile numbers are 42 px (21 px at half).
- Tile labels are 19 px caps with tracking (≈9.5 px at half). Memo keys 17 px, memo values 24 px, ruler degree labels 18 px, end-card contents 22 px with 18 px numbers.
- The smallest in-UI text (≈8–10 px at 1080) is decorative texture. Every mini-UI reads by its silhouette first.
- Check `contact.png` (four frames at 960×540).
