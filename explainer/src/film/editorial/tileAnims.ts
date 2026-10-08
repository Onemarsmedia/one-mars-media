import type {Vec2} from '../../scene/types';

// Inner animation of the 12 tiles: what moves in each illustration once the tile has landed.
// Indices point into the tile's drawing (art.json, painter's order; print a table with
// `npx tsx tools/art-table.ts <tile>`); the live and active looks share them. Times in seconds from the
// moment the tile lands (its panel wipes on over 0.4 s); every loop runs until the tiles leave the page.
// `delay` (s after landing) holds a loop at rest before it starts.
export type TileAnim =
  /** on/off, stepped */
  | {kind: 'blink'; items: number[]; period: number; delay?: number}
  /** slow linear glide of dx/dy px over the remaining time */
  | {kind: 'drift'; items: number[]; dx: number; dy?: number}
  /** plays forward by dx over each period, then jumps back (a playhead looping a section) */
  | {kind: 'loop'; items: number[]; dx: number; period: number; delay?: number}
  /** soft swell to `scale` % and back, once per period */
  | {kind: 'pulse'; items: number[]; scale: number; period: number; delay?: number; pivot?: Vec2}
  /** stroke-only items reveal along their path once (Trim Paths) */
  | {kind: 'draw'; items: number[]; delay: number; dur: number; stagger?: number}
  /** items rise dy px and fade in once, one after another */
  | {kind: 'pop'; items: number[]; delay: number; stagger: number; dy?: number}
  /** smooth vertical float of amp px */
  | {kind: 'bob'; items: number[]; amp: number; period: number; phase?: number; delay?: number}
  /** smooth rotation swing of +/- deg */
  | {kind: 'tilt'; items: number[]; deg: number; period: number; pivot?: Vec2; delay?: number}
  /** each item scales vertically between min % and 100 %, phase-shifted by `spread` (0-1 of a period) */
  | {kind: 'pump'; items: number[]; min: number; period: number; spread?: number; anchor?: 'bottom' | 'center'; delay?: number}
  /** items travel along the path of item `path`, ping-pong between `from` and `to` (0-1 along it) */
  | {kind: 'follow'; items: number[]; path: number; period: number; axis?: 'xy' | 'x' | 'y'; from: number; to: number; delay?: number}
  /** stepped jumps through offsets: a quick move, then hold */
  | {kind: 'hop'; items: number[]; offsets: Vec2[]; hold: number; delay?: number}
  /** a text types on */
  | {kind: 'type'; text: number; delay: number; cps: number}
  /** a timecode text counts frames */
  | {kind: 'timecode'; text: number; rate: number};

// v4: CONCEPT and STORYBOARD now have ~1.5 s alone on screen (was ~0.5 s), so their one-shot
// animations run at a calmer pace than the art director's v3 timings quoted in the notes below.
export const TILE_ANIMS: Record<string, TileAnim[]> = {
  // CONCEPT: The key line 'Make it land.' types onto the red highlight of the brief while the moodboard swatch is
  // quickly pencil-hatched. Both finish before the camera pushes away (~0.75 s). After that, the red disc of the
  // moodboard key visual rises and settles behind its horizon, in step with the four DISTRIBUTION discs: one idea,
  // every format.
  concept: [
    // HERO. Text 5 'Make it land.' (ink, sitting on the red highlight bar 7, which stays static) types on: the idea
    // being written into the brief. AD: it was delay 0.4 at 18 cps, finishing at 1.07 s. CONCEPT is fully in frame
    // for only ~0.75 s after landing (10.61-11.35), because the camera starts its push into FILMING at 11.2 s, so
    // the line has to be done by ~0.7 s. At 30 cps the 13 chars run 0.25-0.65 s. The panel wipe uncovers this row (y
    // ~150-168) at ~0.15 s. It plays in the active look, where the bar is red on red but the ink text still reads.
    {kind: 'type', text: 5, delay: 0.35, cps: 18},
    // Secondary, plays once. The 15 diagonal hatch lines of the moodboard swatch (stroke-only ink w1.41, each
    // running bottom-left to top-right) draw in painter's order, from the top-left fragment 18 to the bottom-right
    // 32, like a pencil hatching a texture. AD: tightened from 0.5-1.24 s to 0.3-0.78 s so it finishes while the
    // tile is still in frame. The wipe has passed the swatch (y 190-238) by ~0.3 s. Swatch bg 17 and frame 33 stay
    // static.
    {kind: 'draw', items: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32], delay: 0.5, dur: 0.25, stagger: 0.04},
    // Wall loop. The red KV disc of the moodboard thumbnail (circle 12, under the ink ground 13) rises and settles
    // behind its horizon by +/-1.5 px. Its top stays at >= 78.8, inside thumbnail 11 / frame 14 (71.5). AD: amp 2 ->
    // 3, and delay 1.89 so its keys fall on the same frames as the four DISTRIBUTION discs (amp 3, period 3; top at
    // 27.5, bottom at 29.0, top at 30.5 s). On the full wall the brief's key visual and every format then breathe
    // together. delay = (26.08 + 1.42) - 10.61 - 5 x 3.0; recompute it if the landing times move. The first leg (0
    // to -1.5 px over 1.89 s) is just slower than the rest.
    {kind: 'bob', items: [12], delay: 2.92, period: 3, amp: 3},
  ],
  // STORYBOARD: The four red push-in arrows of panel 02 are sketched in, one corner after another, in the half
  // second the board is in frame. On the full wall, the presenter in that panel gives a small push-in nudge toward
  // camera.
  storyboard: [
    // HERO. The red push-in arrows (stroke-only #FF4A1C w2.82). Each is a shaft drawn from the panel corner inward,
    // then its L-shaped head: 14/15 TL, 16/17 TR, 18/19 BL, 20/21 BR. Drawing them annotates the planned camera
    // move. AD: it was 0.4-1.0 s, but STORYBOARD lands as the camera starts its push into FILMING. Panel 02 is fully
    // in frame for only ~0.45 s and leaves at ~0.6 s, so the draw now runs 0.12-0.51 s. The wipe uncovers panel 02
    // (y 66-132) by ~0.1 s. The arrows sit on paper panel 11, so they also read in the red active look.
    {kind: 'draw', items: [14, 15, 16, 17, 18, 19, 20, 21], delay: 0.3, dur: 0.25, stagger: 0.06},
    // Wall loop. The presenter's head 12 and shoulders 13 swell to 104 % from the bottom-centre of the panel, so the
    // shoulders stay on its bottom edge (y 132.1) and the head rises ~2 px: the push-in, previewed. It stays inside
    // panel 02 (x 183.6-242.2, top 80.1 vs 65.9) and clear of the corner arrows. AD: the tile is not in frame again
    // until the wall, so period 2.4 -> 2.2 and delay 1.0 -> 2.13 put its peaks at 28.9 and 31.1 s. That keeps it
    // away from FILMING's focus pulse right next to it (29.67 s) and from the other wall pulses.
    {kind: 'pulse', items: [12, 13], delay: 1.2, period: 2.2, scale: 104, pivot: [212.9, 132.1]},
  ],
  // FILMING: A live viewfinder. REC blinks and the timecode runs (both kept), the red focus box breathes like
  // autofocus locking onto the face, and the CH1/CH2 levels peak out of step. It reads as 'we're rolling' at 320 %
  // and stays alive on the wall.
  filming: [
    // HERO (kept). The REC dot 20 (red circle, x 28.6-39.1, y 86-96.5) blinks once a second.
    {kind: 'blink', items: [20], period: 1},
    // HERO (kept). Text 4 '00:00:09:14' counts frames at 25 fps, matching the '4K 25P' label.
    {kind: 'timecode', text: 4, rate: 25},
    // Secondary. The four red focus-box corners (stroke-only, around the face) swell to 105 % about the head centre,
    // moving ~1.6 px: autofocus re-acquiring. The first lock peaks at 0.78 s, inside the 320 % hero. AD: period 2.5
    // -> 2.4, so its only wall peak lands at 29.67 s instead of 30.36. At 30.36 it sat right above WEB's CTA (30.08)
    // and next to SOCIAL's heart (30.55).
    {kind: 'pulse', items: [16, 17, 18, 19], delay: 0.6, period: 2.4, scale: 105, pivot: [177.65, 136.35]},
    // Secondary, audio meters 1 of 2. The CH1 level bar 22 (paper) peaks from its left end and reaches 88.3, inside
    // its 25 % track 21 (ends at 97.3). The meters are in frame at 320 % for the first ~1.5 s.
    {kind: 'pulse', items: [22], delay: 0.5, period: 1.2, scale: 110, pivot: [47.9, 219.55]},
    // Secondary, audio meters 2 of 2. The CH2 bar 24 has its own period and offset, so the two channels never move
    // in lockstep. It reaches 81.1, inside track 23. Tracks 21 and 23 stay static. If FILMING reads as busy, drop
    // the two meter pulses first.
    {kind: 'pulse', items: [24], delay: 0.85, period: 1.7, scale: 112, pivot: [47.9, 230.85]},
  ],
  // EDITING: As the tile lands, the four V1 picture clips drop onto the track left to right, so the edit
  // assembles. Then the red playhead plays slowly through the cut until the tiles leave.
  editing: [
    // Secondary, plays once. V1 clips 30 (ink), 32 (soft), 34 (ink) and 36 (soft), each followed 0.06 s later by its
    // thumbnail (31/33/35/37), so the edit assembles from 0.35 to 1.17 s. The tile is in frame at ~172 % for ~2 s,
    // so all of it is seen. dy 2.5 keeps clip 36 inside its track rect 26 (bottom 161.8). Nothing above overlaps
    // (38+ is at y >= 170, and the playhead is its own top layer). AD: delay 0.4 -> 0.35; the wipe uncovers the V1
    // row at ~0.13 s.
    {kind: 'pop', items: [30, 31, 32, 33, 34, 35, 36, 37], delay: 0.35, stagger: 0.06, dy: 2.5},
    // HERO (kept, slightly faster: 52 -> 64 px over the ~17.6 s loop, ~3.6 px/s). Playhead line 132 and head 133
    // play through the edit and pass the end of the A1 voice clip (x 220). They end at x 241.7 (head 235-248),
    // inside the ruler and tracks (end 272). It is the topmost item, so nothing covers it, and it is still moving on
    // the wall.
    {kind: 'loop', items: [132, 133], dx: 64, period: 3.2},
  ],
  // MOTION: The eased bezier draws itself on from the bottom-left keyframe. Then the red value point rides the
  // S-curve between the steep middle and the ease-in bend, with the dashed red time cursor tracking it, like
  // scrubbing a graph editor.
  motion: [
    // HERO, part 1. Curve 27 (stroke-only ink w3.88, from A 33.8,212.5 to D 266.5,91.3; the path starts at A) draws
    // on with the SOFT ease from 0.25 to 0.95 s. The wipe uncovers its start (y 212) at ~0.2 s. This is the motion
    // seen at landing: ink on red reads in the active look. Keyframe diamonds 30 and 31 stay on top of its ends. AD:
    // dur 0.75 -> 0.7.
    {kind: 'draw', items: [27], delay: 0.25, dur: 0.7},
    // The dashed red time cursor 28 (vertical at x 184.7, y 71.5-222.4) moves on x only. It has the same path,
    // period, from, to and delay as point 29, so it always passes through the value point. Its x range is 184.7 ->
    // 86.1, inside the graph (31-270.7), and it keeps its vertical extent.
    {kind: 'follow', items: [28], path: 27, delay: 0.95, period: 3, axis: 'x', from: 0.677, to: 0.2},
    // HERO, part 2. Red value point 29 (12.7 px square) is drawn at u = 0.677 of path 27: the engine's sampler gives
    // 184.70,117.64 against its centre 184.75,117.65. Each 1.5 s smoothstep leg runs down through the steep middle
    // into the ease-in bend at u = 0.2 (86.1,200.4), then back up. AD: to 0.15 -> 0.2, so a leg covers 129 px
    // instead of 143 (~86 px/s average): calmer, still shows the bend, and 37 px clear of diamond 30. delay 0.45 ->
    // 0.95, so it starts once the curve is drawn and as the live look fades in; before that the point is red on red.
    // The point is seen mainly on the wall, turning at 29.63 and 31.13 s.
    {kind: 'follow', items: [29], path: 27, delay: 0.95, period: 3, axis: 'xy', from: 0.677, to: 0.2},
  ],
  // DESIGN: In the half second the tile is in frame, the four palette chips drop in one after another and the rule
  // under 'Aa' is ruled: a brand system being set. On the wall, the red sun on the LAUNCH poster floats gently.
  design: [
    // HERO, plays once. Palette swatches 8 (ink), 9 (red), 10 (soft) and 11 (paper with outline), top row then
    // bottom row (x 212.9-272.1, y 71.5-130.7), rise 3 px and fade in at 0.12, 0.17, 0.22 and 0.27 s. AD: it was
    // delay 0.35 with stagger 0.08. DESIGN is fully in frame for only ~0.5 s after landing, because the camera
    // leaves for the counter at 16.3 s. The swatches sit at the top of the panel, which the wipe uncovers by
    // ~0.12-0.15 s, so they now land by ~0.6 s instead of 1.0 s. They are contiguous, and nothing above overlaps
    // them.
    {kind: 'pop', items: [8, 9, 10, 11], delay: 0.12, stagger: 0.05, dy: 3},
    // Secondary, plays once. Specimen rule 7 under 'Aa' (stroke-only ink w1.41, drawn left to right from 121.3 to
    // 201.6 at y 177.3, uncovered by the wipe at ~0.17 s) is ruled from 0.2 to 0.5 s. AD: it was 0.45-0.95 s, mostly
    // after the tile had left the frame.
    {kind: 'draw', items: [7], delay: 0.2, dur: 0.3},
    // Wall loop. The poster's red sun 4 (x 28.2-93.1, y 92.7-157.5) floats +/-2 px inside the ink poster 3 (y
    // 70.1-239.3), clear of the LAUNCH text (cap top ~184). Nothing above it overlaps (5 and 6 are at y 212+). AD:
    // period 3 -> 2.6, so it does not move in step with the synced key-visual discs of CONCEPT and DISTRIBUTION
    // (period 3). delay 0.65 makes the first rise as fast as the later legs.
    {kind: 'bob', items: [4], delay: 0.65, period: 2.6, amp: 4},
  ],
  // PODCAST: The two-voice waveform comes alive. All 70 bars breathe around their centre lines with scattered
  // phases, like live audio, while the red playhead keeps gliding through the episode.
  podcast: [
    // HERO. The HOST and GUEST waveform bars 13-82 are one contiguous run, alternating host and guest: played
    // ink/graphite 13-56, unplayed soft 57-82. Each bar is symmetric about its row's centre line, so anchor
    // 'center'. Bars only shrink, so they never grow into the HOST/GUEST labels. With spread 0.69, neighbouring bars
    // in a row are 0.38 of a period apart, which gives an organic shimmer and no travelling wave. AD: min 72 -> 76,
    // so a 30 px bar moves ~7 px instead of 8.4. That is calmer at 172 % and still reads at 100 % on the wall.
    // Visible in both looks.
    {kind: 'pump', items: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82], delay: 0.45, period: 1.5, min: 76, spread: 0.69, anchor: 'center'},
    // Secondary, kept. Playhead line 83 and head 84 glide 48 px right over the ~12.3 s the tile is on the page (x
    // 204.8 -> 252.8, inside the waveform end at 272), ~3.9 px/s: the episode plays. They sit above the bars in
    // painter's order, so nothing covers them.
    {kind: 'loop', items: [83, 84], dx: 48, period: 2.8},
  ],
  // SOCIAL: A like lands on the beat: the red heart swells and its count bar ticks out right after it, every 4
  // beats. On landing, the comment and share line icons draw themselves in.
  social: [
    // HERO. Red heart 16 (bbox centre 183.3,131.3) swells to 112 % (~+2.9 px): a quick swell and a soft release.
    // delay 1.43 puts the first peak at 22.55 s, on a beat. That is right after the red active look has dissolved
    // (22.08 s + 0.3 s fade; before that the heart is red on red) and just as the camera whips right. Period 2.0 s
    // is 4 beats. Wall peaks at 28.55 and 30.55 s interleave with WEB's CTA (30.08 s).
    {kind: 'pulse', items: [16], delay: 1.43, period: 2, scale: 112},
    // Part of the hero beat. Like-count bar 17 (ink) stretches ~3.5 px to the right from its left edge and peaks 0.1
    // s after the heart: cause, then effect. It is a separate anim because it needs its own pivot. It is the next
    // item in painter's order, and nothing overlaps it.
    {kind: 'pulse', items: [17], delay: 1.53, period: 2, scale: 110, pivot: [205.9, 130.75]},
    // Secondary, plays once. Comment bubble 18 (stroke-only closed path, ink) traces on from 0.45 to 1.05 s. The ink
    // strokes on the red panel give the landing visible motion while the heart is hidden.
    {kind: 'draw', items: [18], delay: 0.45, dur: 0.6},
    // The same arrival, 0.2 s later. Share plane 20 (stroke-only; the outline and the fold line draw together)
    // traces on from 0.65 to 1.25 s. It is its own anim because count bar 19 sits between 18 and 20. Everything is
    // drawn while SOCIAL is in frame (~1.6 s).
    {kind: 'draw', items: [20], delay: 0.65, dur: 0.6},
  ],
  // WEB: The landing page is live. The red DISCOVER button gives a soft CTA pulse half a second after landing and
  // every 5 beats after that, while the red sun of the hero visual slowly rises clear of the launch ramp.
  web: [
    // HERO. The red DISCOVER CTA 15 (centre 56.4,221.0) swells to 106 %: ~2 px each side and 0.6 px in height. The
    // label text 5 stays put, so it reads as a hover or an invitation, not a jump. It stays inside the browser
    // frame. The first peak comes at 0.5 s (22.58 s), while the CTA is still in frame; the camera crops it from ~0.7
    // s as it moves right. Then every 2.5 s (5 beats): the wall peak at 30.08 s falls between SOCIAL's hearts (28.55
    // and 30.55 s) and never coincides with them.
    {kind: 'pulse', items: [15], delay: 0.32, period: 2.5, scale: 106},
    // Secondary. Red sun 17 of the hero visual sits between paper bg 16 and the ink ramp 18, which keeps covering
    // its lower part. It rises 14 px over the ~10.25 s on the page (~1.4 px/s), from half-sunk behind the ramp to
    // just clear of it: 'THE LAUNCH.' lifting off. It moves one way only and never loops. Its top ends at 120.9,
    // inside the visual (116.6). It stays in frame while the camera crops WEB's left side (23.0-25.1 s).
    {kind: 'drift', items: [17], dx: 0, dy: -14},
  ],
  // APPS: The swipe card on the phone rocks slowly between TOSS IT and POST IT, and each time it leans toward POST
  // the red check button gives a soft swell. On landing, the two swipe arrows draw outward from their labels, toss
  // first and post second.
  apps: [
    // HERO. The key-visual card 6-9 (paper bg, red disc, ink ground and outline, contiguous) rocks +/-2.5 deg about
    // its centre (141,137.75). -2.5 leans it further toward TOSS (it is drawn at about -9 deg); +2.5 brings it
    // nearer upright, toward POST. delay 0.6 is a quarter period, so the first leg moves at the same speed as the
    // rest. The extremes fall at 0.6 s (toss) and at 1.8 s + 2.4k (post). Verified: at -2.5 deg the fill spans x
    // 109.64-172.36, inside the screen (109.3-172.7); only the outer half of the outline meets the ink bezel. Its y
    // span is 94.3-181.3, below LAUNCH and above the buttons (197).
    {kind: 'tilt', items: [6, 7, 8, 9], delay: 0.6, period: 2.4, deg: 2.5, pivot: [141, 137.75]},
    // Secondary. The red check button 13 and its tick 14 swell to 108 % (+0.8 px each side, clear of the X button).
    // Each swell peaks exactly at a POST extreme (1.62 + 0.18 = 1.8 s, then every 2.4 s), so the app answers the
    // swipe. Wall peak at 29.38 s.
    {kind: 'pulse', items: [13, 14], delay: 1.62, period: 2.4, scale: 108, pivot: [155.1, 206.85]},
    // Secondary, plays once. The swipe hints draw outward from their labels: the TOSS line 15 (93.1 -> 46.5), then
    // its head 16; the POST line 17 (188.9 -> 235.5), then its head 18 (barb, tip, barb). Each head starts as its
    // line finishes. Toss is done at 0.89 s and post at 1.29 s, so the eye ends on the POST side. In the active look
    // 17 and 18 flip to paper and still read.
    {kind: 'draw', items: [15, 16, 17, 18], delay: 0.45, dur: 0.24, stagger: 0.2},
  ],
  // AI: The prompt types in with the caret held solid. As it completes, variations 1, 2 and 4 rise in one after
  // another around the picked variation 3. Then the red selection frame and its checkbox step slowly 3, 2, 1, 2, 3
  // through the versions while the caret blinks.
  ai: [
    // HERO, part 1. Prompt text 3 'launch visual, bold, warm' (25 chars) types from 0.35 to 1.27 s, while AI is in
    // frame at ~172 % (~1.9 s). The caret 5 stays at the end of the field (x 167.8) and cannot travel with the text,
    // because it keeps its blink. The text grows toward a waiting caret, which reads fine for 0.9 s.
    {kind: 'type', text: 3, delay: 0.35, cps: 26},
    // Kept loop, improved. Ink caret 5, period 0.8 as before. The 1.3 s delay holds it solid (the first key is 'on')
    // while the prompt types, like a real text field; then it blinks through the full wall.
    {kind: 'blink', items: [5], delay: 1.3, period: 0.8},
    // HERO, part 2 (generate). Variation 1 (9 bg, 10 disc, 11 ground, 12 outline) rises 4 px and fades in as one
    // piece (stagger 0) as the prompt completes. Card 3 (17-20) is deliberately not popped: it carries the red
    // selection frame from the first frame, so it reads as the picked visual the versions are generated from.
    {kind: 'pop', items: [9, 10, 11, 12], delay: 1.3, stagger: 0, dy: 4},
    // Variation 2 (13 bg, 14 disc, 15 ground, 16 outline), 0.15 s after variation 1, so the generation reads left to
    // right.
    {kind: 'pop', items: [13, 14, 15, 16], delay: 1.45, stagger: 0, dy: 4},
    // Secondary loop: choosing among the versions. Selection frame 21, checkbox 22 and tick 23 (contiguous) step by
    // the exact card pitch of 66.27 px, through cards 3 -> 2 -> 1 -> 2 -> 3. They never go to card 4, whose bg is
    // painted later and would cover the checkbox. At card 1 the frame's outer edge is ~6 px from the panel edge.
    // Each step is a 0.25 s move, then a 1.4 s hold. Moves come at 25.85, 27.5, 29.15 (to card 2, on the wall) and
    // 30.8 s (back to the pick as the tiles leave).
    {kind: 'hop', items: [21, 22, 23], delay: 2.2, offsets: [[0, 0], [-66.27, 0], [-132.54, 0], [-66.27, 0]], hold: 1.4},
    // Variation 4 (24 bg, 25 disc, 26 ground, 27 outline) pops after skipping the already-present card 3, so the
    // cascade 1, 2, (3), 4 settles by 2.0 s, still in frame.
    {kind: 'pop', items: [24, 25, 26, 27], delay: 1.6, stagger: 0, dy: 4},
  ],
  // DISTRIBUTION: On the 360 hit the master asset ships to every format: the four drop arrows shoot down from the
  // bus into 16:9, 9:16, 1:1 and 4:5, left to right. Then the same sun rises and settles in sync in all four
  // frames, in step with the brief's key visual in CONCEPT: one idea, every format.
  distribution: [
    // HERO, 16:9 branch. Drop line 6 (drawn top to bottom from the bus, 96.9 -> 148.4) and arrowhead 7 (barb, tip,
    // barb), stroke-only and contiguous; the head starts as the line finishes. Source 3, trunk 4 and bus 5 stay
    // static as the pipe: the bus path runs left to right, so drawing it would start away from the trunk. AD: the
    // cascade starts 0.1 s earlier (0.3, 0.4, 0.5, 0.6 s), so the drops follow the 360 hit closely; all are done by
    // 1.0 s at 320 %.
    {kind: 'draw', items: [6, 7], delay: 0.3, dur: 0.22, stagger: 0.18},
    // Secondary loop, 16:9 disc 9 (between card bg 8 and the ink ground 10). It rises and settles +/-1.5 px behind
    // its own horizon; its top stays at 161.3, below the card top at 154.7. All four discs share amp 3, period 3 and
    // delay 1.42 and move in perfect sync, and so does CONCEPT's moodboard disc: top at 27.5 s, bottom at 29.0, top
    // at 30.5. They move through the whole wall.
    {kind: 'bob', items: [9], delay: 1.42, period: 3, amp: 3},
    // HERO, 9:16 branch: drop line 12 (96.9 -> 128.6) and head 13, 0.1 s after 16:9.
    {kind: 'draw', items: [12, 13], delay: 0.4, dur: 0.22, stagger: 0.18},
    // 9:16 disc 15 (between 14 and 16), same synced bob. Its top stays at 154.0, below the card top at 135.0.
    {kind: 'bob', items: [15], delay: 1.42, period: 3, amp: 3},
    // HERO, 1:1 branch: drop line 18 (96.9 -> 139.9) and head 19.
    {kind: 'draw', items: [18, 19], delay: 0.5, dur: 0.22, stagger: 0.18},
    // 1:1 disc 21 (between 20 and 22), same synced bob. Its top stays at 154.2, below the card top at 146.2.
    {kind: 'bob', items: [21], delay: 1.42, period: 3, amp: 3},
    // HERO, 4:5 branch: drop line 24 (96.9 -> 132.1) and head 25; done at 1.0 s.
    {kind: 'draw', items: [24, 25], delay: 0.6, dur: 0.22, stagger: 0.18},
    // 4:5 disc 27 (between 26 and 28), same synced bob. Its top stays at 151.7, below the card top at 138.5.
    {kind: 'bob', items: [27], delay: 1.42, period: 3, amp: 3},
  ],
};
