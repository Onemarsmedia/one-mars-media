#!/usr/bin/env python3
"""Own music bed (no licences): soft kick, offbeat hats, sub bass and a warm pad, synthesised here.
Usage: python3 -I bed.py out.wav duration bpm drums_in drums_out
Drums play between drums_in and drums_out (s); the pad and bass run the whole length; fades at both ends.
"""
import sys
import wave
import numpy as np

out, dur, bpm, d_in, d_out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
SR = 48000
n = int(dur * SR)
t = np.arange(n) / SR
beat = 60.0 / bpm
rng = np.random.default_rng(7)
mix = np.zeros((n, 2))

def add(sig, start, gain, pan=0.0):
    i = int(start * SR)
    if i >= n:
        return
    sig = sig[: n - i]
    mix[i:i + len(sig), 0] += sig * gain * (1 - pan) ** 0.5
    mix[i:i + len(sig), 1] += sig * gain * (1 + pan) ** 0.5

# kick: a sine falling 110 -> 45 Hz with a quick decay
kt = np.arange(int(0.35 * SR)) / SR
kick = np.sin(2 * np.pi * np.cumsum(45 + 65 * np.exp(-kt * 30)) / SR) * np.exp(-kt * 9)
# hat: high-passed noise, very short
hn = rng.standard_normal(int(0.05 * SR))
hat = np.diff(np.concatenate([[0], hn])) * np.exp(-np.arange(len(hn)) / SR * 90)
# chord roots per bar (A minor-ish loop: Am - F - C - G), bass an octave down
roots = [55.0, 43.65, 65.41, 49.0]
bar = 4 * beat
k = 0
tt = 0.0
while tt < dur:
    r = roots[k % 4]
    L = int(bar * SR)
    bt = np.arange(L) / SR
    env = np.minimum(1, bt / 0.08) * np.minimum(1, (bar - bt) / 0.15)
    bass = (np.sin(2 * np.pi * r * bt) + 0.25 * np.sin(4 * np.pi * r * bt)) * env
    add(bass, tt, 0.28)
    third = 1.189 if k % 4 in (0, 3) else 1.26  # minor / major third
    pad = sum(np.sin(2 * np.pi * r * 4 * m * bt + ph) for m, ph in [(1, 0), (third, 1.3), (1.498, 2.1), (2.0, 0.7)])
    pad = pad * env * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * bt))
    add(pad, tt, 0.035, -0.3)
    add(np.roll(pad, 400), tt, 0.035, 0.3)
    tt += bar
    k += 1
b = 0
while b * beat < dur:
    s = b * beat
    if d_in <= s < d_out:
        add(kick, s, 0.55)
        add(hat, s + beat / 2, 0.12, 0.2)
        if b % 2 == 1:
            add(hat, s + beat * 0.75, 0.06, -0.2)
    b += 1
fade = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 2.2)
mix *= fade[:, None]
mix /= max(1e-9, np.abs(mix).max()) / 0.7
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(out, dur, 's')
