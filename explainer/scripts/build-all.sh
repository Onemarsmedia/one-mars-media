#!/usr/bin/env bash
# Rebuild everything from the source audio in assets/audio:
#   VO alignment -> beat-locked timing -> VO edit -> music edit -> mix -> tests -> render -> AE package
# Usage: bash scripts/build-all.sh   (from explainer/)
set -euo pipefail
A=assets/audio
W=work
DUR=40
mkdir -p $W/vo $W/music
python3 -I audio/align.py $A/vo2_joshua_take3.mp3 $A/vo2_script.txt $W/vo/align.json
python3 -I audio/plan_timing.py $W/vo/align.json $A/plan_config.json $W/vo
python3 -I audio/vo_edit.py $A/vo2_joshua_take3.mp3 $W/vo/align.json $W/vo/gaps.json "$(python3 -I -c "import json; print(json.load(open('$A/plan_config.json'))['offset'])")" $W/vo/vo_edit.wav $W/vo/vo.json
cp $W/vo/vo.json src/film/editorial/timing/vo.json
cp $W/vo/plan.json src/film/editorial/timing/plan.json
cp $A/sfx/type_onsets.json src/film/editorial/timing/type_onsets.json
python3 -I audio/music_edit.py src/film/editorial/timing/plan.json $A/music_m4.mp3 $DUR $W/music/music_edit.wav
npx tsx -e "
import {sfxCues, DURATION} from './src/film/editorial/film';
import {FPS} from './src/film/editorial/tokens';
import fs from 'node:fs';
const dur = DURATION / FPS;
const plan = JSON.parse(fs.readFileSync('src/film/editorial/timing/plan.json', 'utf8'));
const vo = JSON.parse(fs.readFileSync('src/film/editorial/timing/vo.json', 'utf8'));
fs.writeFileSync('work/mix.json', JSON.stringify({duration: dur,
  vo: {file: 'vo/vo_edit.wav', start: vo.offset, gainDb: 0},
  music: {file: 'music/music_edit.wav', start: 0, gainDb: -8, envelope: [[0, 3], [plan.hits['360'] - 0.02, -3]], duck: {threshold: 0.03, ratio: 4, attack: 15, release: 280}},
  sfx: sfxCues().map((c) => ({...c, file: '../assets/audio/sfx/' + c.file}))}, null, 1));
// captions: one cue per sentence (merged when short), broken onto two lines at a clause, no 1-frame gaps
const cues = []; let cur = [];
for (const c of vo.chunks) { cur.push(c); if (c.punct.startsWith('.')) { cues.push({start: cur[0].start, end: cur[cur.length - 1].end, parts: cur.map((x) => x.text + x.punct)}); cur = []; } }
const merged = [];
for (const q of cues) { const m = merged[merged.length - 1]; const len = (x) => x.parts.join(' ').length; if (m && len(m) + len(q) <= 42 && q.start - m.end < 0.6) Object.assign(m, {end: q.end, parts: [...m.parts, ...q.parts]}); else merged.push({...q}); }
const lines = (parts) => { const t = parts.join(' '); if (t.length <= 37) return t; let best = 1, score = 1e9; for (let i = 1; i < parts.length; i++) { const a = parts.slice(0, i).join(' ').length, b = parts.slice(i).join(' ').length; if (Math.abs(a - b) < score) { score = Math.abs(a - b); best = i; } } return parts.slice(0, best).join(' ') + '\n' + parts.slice(best).join(' '); };
const out = merged.map((q, i) => ({start: q.start, end: merged[i + 1] && merged[i + 1].start - (q.end + 0.35) < 0.1 ? merged[i + 1].start : Math.min(q.end + 0.35, dur), text: lines(q.parts)}));
fs.writeFileSync('work/captions.json', JSON.stringify({cues: out}, null, 1));
"
python3 -I audio/mix.py $W/mix.json $W/mixout
npx tsx tests/run-all.ts
node scripts/render.mjs Onemarsmedia360 out/final --audio $W/mixout/master.wav --poster-frame "$(npx tsx -e "import {posterFrame} from './src/film/editorial/film'; console.log(posterFrame())")" --captions $W/captions.json
npx tsx scripts/package-ae.ts $W/mixout
