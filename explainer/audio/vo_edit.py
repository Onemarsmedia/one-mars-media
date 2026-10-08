#!/usr/bin/env python3
"""Tighten the voice-over: set every pause between script chunks to a chosen length.

Only the middle of each pause is removed (the voice's natural decay and the next breath-in stay),
so the read keeps its intonation but lands on our timing. Writes the edited VO and the word/chunk
timings in FILM time (VO placed at `offset` seconds).

Usage: python3 -I vo_edit.py take.mp3 take.align.json gaps.json offset out.wav out.timing.json
gaps.json: list of pause lengths in seconds, one per chunk boundary (len = chunks - 1)
"""
import json
import subprocess
import sys

import numpy as np

SR = 48000
KEEP = 0.06  # seconds kept on each side of a pause (decay after, breath before)
FADE = 0.006


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main(audio, align_path, gaps_path, offset, out_wav, out_timing):
    x = load(audio)
    al = json.load(open(align_path))
    gaps = json.load(open(gaps_path))
    chunks = al["chunks"]
    assert len(gaps) == len(chunks) - 1, f"need {len(chunks) - 1} gaps, got {len(gaps)}"
    pieces = []
    new_starts = []
    t_out = 0.0
    # leading: keep KEEP before first chunk
    for i, c in enumerate(chunks):
        a = max(0.0, c["start"] - KEEP)
        b = min(len(x) / SR, c["end"] + KEEP)
        seg = x[int(a * SR) : int(b * SR)].copy()
        n = int(FADE * SR)
        if len(seg) > 2 * n:
            seg[:n] *= np.linspace(0, 1, n)
            seg[-n:] *= np.linspace(1, 0, n)
        new_starts.append(t_out + (c["start"] - a))
        pieces.append(seg)
        t_out += len(seg) / SR
        if i < len(gaps):
            # pause = KEEP (in seg) + silence + KEEP (next seg); never shorter than the two keeps
            sil = max(0.0, gaps[i] - 2 * KEEP)
            pieces.append(np.zeros(int(sil * SR), dtype=np.float32))
            t_out += sil
    y = np.concatenate(pieces)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", out_wav], input=y.tobytes(), check=True)
    # remap timings: shift each chunk's words by (new_start - old_start), then add the film offset
    out_chunks, out_words = [], []
    for i, c in enumerate(chunks):
        d = new_starts[i] - c["start"] + offset
        out_chunks.append({**c, "start": round(c["start"] + d, 3), "end": round(c["end"] + d, 3)})
    for w in al["words"]:
        d = new_starts[w["chunk"]] - chunks[w["chunk"]]["start"] + offset
        out_words.append({**w, "start": round(w["start"] + d, 3), "end": round(w["end"] + d, 3), "syllables": [round(s + d, 3) for s in w["syllables"]]})
    timing = {"offset": offset, "vo_duration": round(len(y) / SR, 3), "chunks": out_chunks, "words": out_words}
    json.dump(timing, open(out_timing, "w"), indent=1)
    print(f"edited VO {len(x) / SR:.2f}s -> {len(y) / SR:.2f}s; speech ends at film {out_chunks[-1]['end']:.2f}s")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[1], a[2], float(a[3]), a[4], a[5])
