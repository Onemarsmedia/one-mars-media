#!/usr/bin/env python3
"""Own modern beat (no licences): 808 kick + sliding sub, claps, trap hats with rolls, a riser, impacts.
Usage: python3 -I beat.py out.wav cues.json
cues.json: {"duration": s, "bpm": 140, "origin": s (a downbeat, default 0), "drop": s, "rollFrom": s, "rollTo": s, "breakdown": s, "impacts": [s, ...]}
Before the drop: a filtered pad, a clock tick on the 8ths and a riser into the drop.
"""
import json
import sys
import wave
import numpy as np

out, cfg = sys.argv[1], json.load(open(sys.argv[2]))
SR = 48000
dur = cfg['duration']
B = 60 / cfg['bpm']
n = int(dur * SR)
mix = np.zeros((n, 2))
rng = np.random.default_rng(11)

def add(sig, start, gain, pan=0.0):
    i = int(round(start * SR))
    if i >= n or i < 0:
        return
    sig = sig[: n - i]
    mix[i:i + len(sig), 0] += sig * gain * np.sqrt(1 - pan)
    mix[i:i + len(sig), 1] += sig * gain * np.sqrt(1 + pan)

def env_exp(L, rate):
    return np.exp(-np.arange(L) / SR * rate)

# 808: a long sine with a pitch drop; sub notes follow a minor riff
def k808(note=43.65, L=0.55):
    t = np.arange(int(L * SR)) / SR
    f = note + 140 * np.exp(-t * 38)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    return np.tanh(s * 1.8) * 0.9

def clap():
    L = int(0.18 * SR)
    nz = rng.standard_normal(L)
    e = np.zeros(L)
    for d in (0, 0.009, 0.018):
        i = int(d * SR)
        e[i:] += np.exp(-np.arange(L - i) / SR * 38)
    s = np.diff(np.concatenate([[0], nz])) * e
    return s / np.abs(s).max()

def hat(L=0.035, rate=120):
    nz = rng.standard_normal(int(L * SR))
    s = np.diff(np.concatenate([[0], np.diff(np.concatenate([[0], nz]))])) * env_exp(len(nz), rate)
    return s / np.abs(s).max()

def tick():
    t = np.arange(int(0.03 * SR)) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 180)

def impact(L=2.2):
    t = np.arange(int(L * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.2)
    nz = rng.standard_normal(len(t)) * np.exp(-t * 9) * 0.35
    return np.tanh((boom + nz) * 1.6)

def pad(L, root, gain_lp=1.0):
    t = np.arange(int(L * SR)) / SR
    s = sum(np.sin(2 * np.pi * root * m * t + p) for m, p in [(1, 0), (1.189, 1.1), (1.498, 2.3), (2, 0.4), (2.997, 1.7)])
    e = np.minimum(1, t / 0.25) * np.minimum(1, (L - t) / 0.3)
    return s * e * gain_lp / 5

drop, bd = cfg['drop'], cfg['breakdown']
roots = [220.0, 174.61, 261.63, 196.0]  # Am F C G
riff = [43.65 * 1.26, 43.65, 43.65 * 1.498, 43.65 * 1.122]  # 808 notes per bar (A, F, C, G an octave down-ish)
O = cfg.get('origin', 0.0)  # the grid is anchored on this downbeat
first_bar = -int(np.ceil(O / (4 * B)))
bars = int(np.ceil((dur - O) / (4 * B)))
for b in range(first_bar, bars):
    t0 = O + b * 4 * B
    if t0 + 4 * B <= 0:
        continue
    t0 = max(t0, 0.0)
    # pad everywhere, quieter after the drop
    add(pad(4 * B, roots[b % 4] / 2), t0, 0.22 if t0 < drop else 0.12, -0.2)
    add(pad(4 * B, roots[b % 4]), t0 + 0.01, 0.08 if t0 < drop else 0.05, 0.25)
for k in range(-int(np.ceil(O / B)), int((dur - O) / B) + 1):
    t = O + k * B
    if t < 0:
        continue
    in_drop = drop - 1e-3 <= t < bd
    in_bd = bd - 1e-3 <= t < cfg['impacts'][-1]
    note = riff[int(np.floor((t - O) / (4 * B))) % 4]
    if t < drop - 1e-3:
        add(tick(), t, 0.10, 0.3)
        add(tick(), t + B / 2, 0.06, -0.3)
    elif in_drop:
        pos = k % 8  # 2-bar trap pattern on the kick
        if pos in (0, 3, 6):
            add(k808(note), t, 0.85)
        if pos == 3:
            add(k808(note), t + B * 0.5, 0.6)
        if k % 2 == 1:
            add(clap(), t, 0.42)
        rolling = cfg['rollFrom'] <= t < cfg['rollTo']
        sub = 4 if rolling else 2
        for j in range(sub):
            add(hat(), t + j * B / sub, 0.16 if j == 0 else 0.11, 0.25 if j % 2 else -0.15)
        if not rolling and k % 4 == 3:  # a 16th roll at the end of every bar
            for j in range(4):
                add(hat(0.02, 160), t + B / 2 + j * B / 8, 0.08, 0.2)
    elif in_bd:
        if k % 4 == 0:
            add(k808(note, 0.9), t, 0.7)
        add(tick(), t + B / 2, 0.05)
# riser into the drop and into the name
for t_end, L in [(drop, 4 * B), (cfg['impacts'][-1], 2 * B)]:
    m = int(L * SR)
    tt = np.arange(m) / SR
    nz = rng.standard_normal(m)
    # a crude rising band: differentiate more as it rises (brighter), swell in level
    s = nz * (tt / L) ** 2
    s = s - np.convolve(s, np.ones(24) / 24, mode='same') * (1 - tt / L)
    add(s / np.abs(s).max(), t_end - L, 0.16)
for t in cfg['impacts']:
    add(impact(), t, 0.75)
mix = np.tanh(mix * 1.1)
fade = np.minimum(1, np.arange(n) / SR / 0.05) * np.minimum(1, (dur - np.arange(n) / SR) / 1.8)
mix *= fade[:, None]
mix /= np.abs(mix).max() / 0.8
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print(out, dur)
