#!/usr/bin/env python3
"""Find the drop in a music file: the biggest jump in short-term loudness (RMS of 50 ms frames, compared
over the half second before and after). Prints the time in seconds.
Usage: python3 -I find_drop.py music.(mp3|wav) [search_from] [search_to]"""
import subprocess
import sys
import numpy as np

src = sys.argv[1]
a = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
b = float(sys.argv[3]) if len(sys.argv) > 3 else 15.0
SR = 16000
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype='<f4')
hop = int(0.05 * SR)
rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
db = 20 * np.log10(rms)
w = 10  # 0.5 s
best, bt = -1e9, 0.0
for i in range(w, len(db) - w):
    t = i * 0.05
    if not (a <= t <= b):
        continue
    jump = db[i:i + w].mean() - db[i - w:i].mean()
    if jump > best:
        best, bt = jump, t
print(f'{bt:.2f} {best:.1f}dB len={len(x)/SR:.2f}')
