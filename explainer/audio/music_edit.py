#!/usr/bin/env python3
"""Cut the music to the film: each segment of the source is placed at its film_start (plan.json), joined
to the next with a short crossfade (on bar lines), padded/trimmed to the film length with a final fade.
Usage: python3 -I music_edit.py plan.json source.mp3 duration out.wav
"""
import json
import subprocess
import sys

plan_path, src, dur, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
segs = json.load(open(plan_path))["music"]["segments"]
XF = 0.03  # crossfade between segments (s)
FADE = 1.2  # final fade (s)
inputs, chains = [], []
for i, s in enumerate(segs):
    length = s["src_end"] - s["src_start"]
    # segments after the first start XF early so the two overlap by the crossfade
    start = s["film_start"] - (XF if i > 0 else 0)
    inputs += ["-ss", str(s["src_start"] - (XF if i > 0 else 0)), "-to", str(s["src_end"]), "-i", src]
    fx = "aresample=48000,aformat=channel_layouts=stereo:sample_fmts=flt"
    if i > 0:
        fx += f",afade=t=in:st=0:d={XF}"
    if i < len(segs) - 1:
        fx += f",afade=t=out:st={length - XF}:d={XF}"
    ms = int(round(start * 1000))
    fx += f",adelay={ms}|{ms}"
    chains.append(f"[{i}:a]{fx}[s{i}]")
graph = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(len(segs)))
graph += f"amix=inputs={len(segs)}:normalize=0:duration=longest,apad=whole_dur={dur},atrim=0:{dur},afade=t=out:st={dur - FADE}:d={FADE}[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_s24le", out], check=True)
print("music edit ->", out, "segments at", [s["film_start"] for s in segs])
