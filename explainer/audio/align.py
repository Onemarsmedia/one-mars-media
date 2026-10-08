#!/usr/bin/env python3
"""Time every word of the voice-over without any speech model (free, offline).

The script is written with punctuation exactly where the picture cuts ("Think it, sketch it, shoot it."),
so the pauses the voice leaves at commas and full stops split the audio into the same chunks as the text.
1. Find pauses (RMS envelope; same idea as ffmpeg silencedetect, but ranked so we keep the real ones).
2. Pick the N-1 longest pauses for the N text chunks (full stops expect longer pauses than commas).
3. Inside each chunk, place words by syllable count, then snap syllables to energy peaks of the voice band.

Output JSON (seconds): {duration, chunks:[{text,start,end}], words:[{text,start,end,syllables:[t...]}]}
Usage: python3 -I align.py vo.wav script.txt out.json [--plot out.png]
"""
import json
import re
import subprocess
import sys

import numpy as np

SR = 16000
HOP = 0.01  # 10 ms analysis hop

# Syllable counts the heuristic gets wrong (lowercase, punctuation stripped).
SYLLABLES = {
    "onemarsmedia": 5,
    "ai": 2,
    "three-sixty": 3,
    "everywhere": 3,
    "video": 3,
    "halfway": 2,
    "campaign": 2,
    "design": 2,
    "podcast": 2,
    "version": 2,
    "angle": 2,
    "every": 2,
    "brief": 1,
    "site": 1,
    "make": 1,
    "the": 1,
    "whole": 1,
    "one": 1,
    "team": 1,
    "limits": 2,
    "code": 1,
    "move": 1,
    "more": 1,
    "app": 1,
}


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z\-']", "", word.lower())
    if w in SYLLABLES:
        return SYLLABLES[w]
    if "-" in w:
        return sum(syllables(p) for p in w.split("-") if p)
    groups = re.findall(r"[aeiouy]+", w)
    n = len(groups)
    if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and n > 1:
        n -= 1
    return max(1, n)


def load_audio(path: str) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def envelopes(x: np.ndarray):
    """Broadband RMS (dB) and voice-band (300-3000 Hz) energy per 10 ms hop."""
    hop = int(SR * HOP)
    win = int(SR * 0.025)
    n = max(1, (len(x) - win) // hop + 1)
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop][:n] * np.hanning(win)
    rms = np.sqrt(np.mean(frames**2, axis=1) + 1e-12)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    freqs = np.fft.rfftfreq(win, 1 / SR)
    band = spec[:, (freqs >= 300) & (freqs <= 3000)].sum(axis=1)
    k = np.ones(5) / 5  # 50 ms smoothing
    band = np.convolve(band, k, mode="same")
    return 20 * np.log10(rms), band


def find_pauses(db: np.ndarray, min_gap: float = 0.06):
    speech_level = np.percentile(db[db > db.max() - 60], 90)
    thresh = speech_level - 28
    silent = db < thresh
    pauses = []
    i = 0
    while i < len(silent):
        if silent[i]:
            j = i
            while j < len(silent) and silent[j]:
                j += 1
            if (j - i) * HOP >= min_gap:
                pauses.append((i * HOP, j * HOP))
            i = j
        else:
            i += 1
    return pauses, thresh


def split_chunks(script: str):
    """Chunks end at , . ! ? : ; and remember which punctuation closed them."""
    chunks = []
    for m in re.finditer(r"([^,.!?;:]+)([,.!?;:]+|$)", script.replace("\n", " ")):
        text = m.group(1).strip()
        if text:
            chunks.append({"text": text, "punct": m.group(2) or "."})
    return chunks


def choose_boundaries(pauses, chunks, chunk_syl, speech_start, speech_end):
    """Pick one pause per chunk boundary (in order) by dynamic programming.

    Cost per chunk: squared log-ratio of its duration to the duration its syllables predict.
    Cost per chosen pause: rewards longer pauses, more so where the text has a full stop.
    """
    need = len(chunks) - 1
    total_pause = sum(p[1] - p[0] for p in pauses)
    rate = max(0.05, (speech_end - speech_start - 0.6 * total_pause) / sum(chunk_syl))  # seconds per syllable
    starts = [speech_start] + [p[1] for p in pauses]
    ends = [p[0] for p in pauses] + [speech_end]
    n = len(pauses)
    INF = float("inf")

    def chunk_cost(k, a, b):
        dur = b - a
        if dur <= 0.08:
            return INF
        return 4.0 * np.log(dur / (chunk_syl[k] * rate)) ** 2

    def pause_cost(k, j):
        d = pauses[j][1] - pauses[j][0]
        full_stop = chunks[k]["punct"][0] in ".!?"
        expect = 0.32 if full_stop else 0.18
        return -1.5 * min(d, 0.6) / expect

    # cost[k][j]: best cost with boundary k placed at pause j (k, j 0-based)
    cost = [[INF] * n for _ in range(need)]
    back = [[-1] * n for _ in range(need)]
    for j in range(n):
        c = chunk_cost(0, speech_start, ends[j])
        if c < INF:
            cost[0][j] = c + pause_cost(0, j)
    for k in range(1, need):
        for j in range(k, n):
            best, arg = INF, -1
            for i in range(k - 1, j):
                if cost[k - 1][i] == INF:
                    continue
                c = cost[k - 1][i] + chunk_cost(k, starts[i + 1], ends[j])
                if c < best:
                    best, arg = c, i
            if arg >= 0:
                cost[k][j] = best + pause_cost(k, j)
                back[k][j] = arg
    best, arg = INF, -1
    for j in range(need - 1, n):
        if cost[need - 1][j] == INF:
            continue
        c = cost[need - 1][j] + chunk_cost(need, starts[j + 1], speech_end)
        if c < best:
            best, arg = c, j
    if arg < 0:
        return []
    picks = [arg]
    for k in range(need - 1, 0, -1):
        picks.append(back[k][picks[-1]])
    return [pauses[j] for j in reversed(picks)]


def align(audio_path: str, script: str):
    x = load_audio(audio_path)
    duration = len(x) / SR
    db, band = envelopes(x)
    pauses, thresh = find_pauses(db)
    voiced = np.where(db >= thresh)[0]
    if not len(voiced):
        raise SystemExit("no speech found")
    speech_start = voiced[0] * HOP
    speech_end = (voiced[-1] + 1) * HOP
    inner = [p for p in pauses if p[0] > speech_start + 0.05 and p[1] < speech_end - 0.05]
    chunks = split_chunks(script)
    need = len(chunks) - 1
    if len(inner) < need:
        print(f"warning: found {len(inner)} pauses for {need} chunk boundaries; falling back to syllable timing", file=sys.stderr)
    chunk_syl = [sum(syllables(w) for w in c["text"].split()) for c in chunks]
    chosen = choose_boundaries(inner, chunks, chunk_syl, speech_start, speech_end) if len(inner) >= need else []
    if len(chosen) == need:
        bounds = [speech_start] + [b for p in chosen for b in p] + [speech_end]
    else:
        # Distribute the boundaries by syllables over the whole read.
        total = sum(chunk_syl)
        acc = 0
        bounds = [speech_start]
        for n in chunk_syl[:-1]:
            acc += n
            t = speech_start + (speech_end - speech_start) * acc / total
            bounds += [t, t]
        bounds.append(speech_end)
    out_chunks, out_words = [], []
    for ci, c in enumerate(chunks):
        c0, c1 = bounds[2 * ci], bounds[2 * ci + 1]
        out_chunks.append({"text": c["text"], "punct": c["punct"], "start": round(c0, 3), "end": round(c1, 3)})
        words = c["text"].split()
        sylls = [syllables(w) for w in words]
        total = sum(sylls)
        # Syllable nuclei: local maxima of the voice-band energy inside the chunk.
        a, b = int(c0 / HOP), max(int(c0 / HOP) + 1, int(c1 / HOP))
        seg = band[a:b]
        peaks = []
        if len(seg) > 2:
            floor = seg.max() * 0.08
            for k in range(1, len(seg) - 1):
                if seg[k] >= seg[k - 1] and seg[k] > seg[k + 1] and seg[k] > floor:
                    if not peaks or (k - peaks[-1]) * HOP > 0.09:
                        peaks.append(k)
                    elif seg[k] > seg[peaks[-1]]:
                        peaks[-1] = k
        peak_times = [(a + k) * HOP for k in peaks]
        use_peaks = len(peak_times) == total
        acc = 0
        for w, s in zip(words, sylls):
            if use_peaks:
                syl = peak_times[acc : acc + s]
                prev = peak_times[acc - 1] if acc > 0 else c0
                start = c0 if acc == 0 else (prev + syl[0]) / 2
            else:
                step = (c1 - c0) / total
                syl = [c0 + (acc + i + 0.5) * step for i in range(s)]
                start = c0 + acc * step
            acc += s
            end = c1 if acc == total else None
            out_words.append({"text": w, "start": round(start, 3), "end": end, "syllables": [round(t, 3) for t in syl], "chunk": ci, "snapped": use_peaks})
        # Word ends = next word's start within the chunk.
        chunk_words = [wd for wd in out_words if wd["chunk"] == ci]
        for i, wd in enumerate(chunk_words):
            if wd["end"] is None:
                wd["end"] = chunk_words[i + 1]["start"]
            wd["end"] = round(wd["end"], 3)
    return {"duration": round(duration, 3), "speech": [round(speech_start, 3), round(speech_end, 3)], "chunks": out_chunks, "words": out_words}


def plot(audio_path: str, result: dict, out_png: str):
    """Waveform strip with chunk boundaries, for a visual check (PIL only)."""
    from PIL import Image, ImageDraw

    x = load_audio(audio_path)
    W, H = 2400, 360
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    per = max(1, len(x) // W)
    for i in range(W):
        s = x[i * per : (i + 1) * per]
        if len(s):
            v = float(np.abs(s).max())
            d.line([(i, H / 2 - v * H * 0.45), (i, H / 2 + v * H * 0.45)], fill=(60, 60, 60))
    sx = W / result["duration"]
    for c in result["chunks"]:
        d.rectangle([c["start"] * sx, 0, c["end"] * sx, 14], fill=(255, 74, 28))
        d.text((c["start"] * sx + 2, 16), c["text"][:24], fill=(0, 0, 0))
    for wd in result["words"]:
        for t in wd["syllables"]:
            d.line([(t * sx, H - 30), (t * sx, H - 10)], fill=(0, 120, 255), width=2)
    img.save(out_png)


if __name__ == "__main__":
    audio, script_path, out = sys.argv[1:4]
    res = align(audio, open(script_path, encoding="utf-8").read())
    json.dump(res, open(out, "w"), indent=1)
    if "--plot" in sys.argv:
        plot(audio, res, sys.argv[sys.argv.index("--plot") + 1])
    snapped = sum(1 for c in range(len(res["chunks"])) if all(w["snapped"] for w in res["words"] if w["chunk"] == c))
    print(f"{len(res['chunks'])} chunks, {len(res['words'])} words, {snapped} chunks snapped to syllable peaks, speech {res['speech']}")
