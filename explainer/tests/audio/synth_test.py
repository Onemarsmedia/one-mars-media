"""Synthetic check for audio/align.py: fake syllables with known timing, commas/full stops as pauses."""
import json, subprocess, sys, tempfile, os
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'audio'))
import align

SCRIPT = ("Then you need more than a video. You need every angle. We make them all. Think it, sketch it, shoot it. "
          "Cut it, move it, design it. That's halfway. Podcast it, post it, build the site. "
          "Code the app, version it with AI, ship it everywhere. That's three-sixty. One brief, the whole campaign. "
          "Onemarsmedia. One team. No limits.")
SR = 16000
rng = np.random.default_rng(7)
out, truth, t = [], [], 0.0
def silence(d):
    global t
    out.append(rng.normal(0, 0.0008, int(d * SR)).astype(np.float32)); t += d
silence(0.35)
for c in align.split_chunks(SCRIPT):
    for wi, w in enumerate(c["text"].split()):
        for s in range(align.syllables(w)):
            d = rng.uniform(0.13, 0.22)
            n = int(d * SR); tt = np.arange(n) / SR
            f0 = rng.uniform(110, 140)
            sig = sum(np.sin(2 * np.pi * f0 * k * tt) / k for k in range(1, 12))
            env = np.sin(np.pi * np.arange(n) / n) ** 1.5
            truth.append((w, t + d * 0.5))
            out.append((0.25 * sig * env).astype(np.float32)); t += d
            silence(rng.uniform(0.01, 0.045))  # syllable dip / plosive closure, must NOT read as a pause
    silence(rng.uniform(0.12, 0.2) if c["punct"].startswith(",") else rng.uniform(0.3, 0.45))
x = np.concatenate(out)
with tempfile.TemporaryDirectory() as td:
    wav = os.path.join(td, "vo.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", wav], input=x.tobytes(), check=True)
    res = align.align(wav, SCRIPT)
peaks = [s for w in res["words"] for s in w["syllables"]]
errs = [abs(p - tr[1]) for p, tr in zip(peaks, truth)]
assert len(peaks) == len(truth), (len(peaks), len(truth))
snapped = sum(w["snapped"] for w in res["words"])
print(f"chunks {len(res['chunks'])}, syllables {len(peaks)}, snapped words {snapped}/{len(res['words'])}, "
      f"max err {max(errs)*1000:.0f} ms, mean {np.mean(errs)*1000:.0f} ms")
ok = max(errs) < 0.06
print("ok" if ok else "FAIL")
sys.exit(0 if ok else 1)
