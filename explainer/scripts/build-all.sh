#!/usr/bin/env bash
# Rebuild everything from the source audio in assets/audio:
#   VO alignment -> beat-locked timing -> VO edit -> music edit -> mix -> render -> AE package
# Usage: bash scripts/build-all.sh   (from explainer/)
set -euo pipefail
A=assets/audio
W=work
mkdir -p $W/vo $W/music
python3 -I audio/align.py $A/vo_joshua_take4.mp3 $A/vo_script.txt $W/vo/align.json
python3 -I audio/plan_timing.py $W/vo/align.json $A/vo_base_gaps.json $W/vo
# keep the music button / end-card split that the film uses
python3 -I - <<'PY'
import json
p='work/vo/plan.json'; plan=json.load(open(p)); hit=plan['hits']['360']
plan['endCard']=plan['music']['button']; button=round(hit+10.0,3)
plan['music']['segments']=[{'src_start':plan['music']['segments'][0]['src_start'],'src_end':round(24.0+10.0,3),'film_start':0.0},{'src_start':42.0,'src_end':48.0,'film_start':button}]
plan['music']['button']=button
json.dump(plan,open(p,'w'),indent=1)
PY
python3 -I audio/vo_edit.py $A/vo_joshua_take4.mp3 $W/vo/align.json $W/vo/gaps.json 1.7 $W/vo/vo_edit.wav $W/vo/vo.json
cp $W/vo/vo.json src/film/editorial/timing/vo.json
cp $W/vo/plan.json src/film/editorial/timing/plan.json
cp $A/sfx/type_onsets.json src/film/editorial/timing/type_onsets.json
python3 -I audio/music_edit.py src/film/editorial/timing/plan.json $A/music_m4.mp3 30 $W/music/music_edit.wav
npx tsx -e "
import {sfxCues} from './src/film/editorial/film';
import fs from 'node:fs';
const plan = JSON.parse(fs.readFileSync('src/film/editorial/timing/plan.json', 'utf8'));
const vo = JSON.parse(fs.readFileSync('src/film/editorial/timing/vo.json', 'utf8'));
fs.writeFileSync('work/mix.json', JSON.stringify({duration: 30,
  vo: {file: 'vo/vo_edit.wav', start: vo.offset, gainDb: 0},
  music: {file: 'music/music_edit.wav', start: 0, gainDb: -8, envelope: [[0, 3], [plan.hits['360'] - 0.02, -3]], duck: {threshold: 0.03, ratio: 4, attack: 15, release: 280}},
  sfx: sfxCues().map((c) => ({...c, file: '../assets/audio/sfx/' + c.file}))}, null, 1));
const cues = []; let cur = [];
for (const c of vo.chunks) { cur.push(c); if (c.punct.startsWith('.')) { cues.push({start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((x) => x.text + x.punct).join(' ')}); cur = []; } }
const merged = [];
for (const q of cues) { const m = merged[merged.length - 1]; if (m && m.text.length + q.text.length <= 42 && q.start - m.end < 0.6) Object.assign(m, {end: q.end, text: m.text + ' ' + q.text}); else merged.push({...q}); }
merged.forEach((q, i) => (q.end = Math.min(q.end + 0.35, (merged[i + 1]?.start ?? 30) - 0.04)));
fs.writeFileSync('work/captions.json', JSON.stringify({cues: merged}, null, 1));
"
python3 -I audio/mix.py $W/mix.json $W/mixout
npx tsx tests/run-all.ts
node scripts/render.mjs Onemarsmedia360 out/final --audio $W/mixout/master.wav --poster-frame 645 --captions $W/captions.json
npx tsx scripts/package-ae.ts $W/mixout/stems
