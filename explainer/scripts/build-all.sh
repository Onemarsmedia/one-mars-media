#!/usr/bin/env bash
# Rebuild everything from the source audio in assets/audio:
#   VO alignment -> beat-locked timing -> VO edit -> music edit -> mix -> tests -> render -> AE package
# Usage: bash scripts/build-all.sh   (from explainer/)
set -euo pipefail
A=assets/audio
W=work
DUR=42
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
"
npx tsx scripts/captions.ts src/film/editorial/timing/vo.json $DUR $W/captions.json
python3 -I audio/mix.py $W/mix.json $W/mixout
npx tsx tests/run-all.ts
node scripts/render.mjs Onemarsmedia360 out/final --audio $W/mixout/master.wav --poster-frame "$(npx tsx -e "import {posterFrame} from './src/film/editorial/film'; console.log(posterFrame())")" --captions $W/captions.json
npx tsx scripts/package-ae.ts $W/mixout
