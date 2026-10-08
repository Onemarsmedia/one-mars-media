#!/usr/bin/env python3
"""Cut the music to the film: segments of the source placed on film time, joined with short
crossfades at bar boundaries, padded/trimmed to the film length with a gentle final fade.
Usage: python3 -I music_edit.py plan.json source.mp3 duration out.wav
"""
import json
import subprocess
import sys

plan_path, src, dur, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
segs = json.load(open(plan_path))["music"]["segments"]
XF = 0.03
inputs, chains = [], []
for i, s in enumerate(segs):
    inputs += ["-ss", str(s["src_start"]), "-to", str(s["src_end"]), "-i", src]
    chains.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[s{i}]")
graph = ";".join(chains)
cur = "[s0]"
for i in range(1, len(segs)):
    graph += f";{cur}[s{i}]acrossfade=d={XF}:c1=tri:c2=tri[x{i}]"
    cur = f"[x{i}]"
graph += f";{cur}apad=whole_dur={dur},atrim=0:{dur},afade=t=out:st={dur - 1.2}:d=1.2[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_s24le", out], check=True)
print("music edit ->", out)
