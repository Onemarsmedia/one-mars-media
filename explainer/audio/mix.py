#!/usr/bin/env python3
"""Mix VO + music + SFX to -14 LUFS (true peak -1 dBTP) and export matching stems for After Effects.

Music is ducked under the voice with a sidechain compressor. The loudness gain is measured once on the
summed mix and then applied identically to every stem, so in AE the stems at 0 dB add up to the master.

Usage: python3 -I mix.py mix.json out_dir
mix.json: {
  "duration": 30,
  "vo":    {"file": "vo.wav", "start": 1.7, "gainDb": 0},
  "music": {"file": "music.wav", "start": 0, "gainDb": -14, "fadeOut": 1.5,
            "duck": {"threshold": 0.04, "ratio": 5, "attack": 25, "release": 350}},
  "sfx":   [{"file": "tick.wav", "t": 7.0, "gainDb": -26}, ...]
}
Writes: master.wav, stems/vo.wav, stems/music.wav, stems/sfx.wav, loudness.json
"""
import json
import os
import re
import subprocess
import sys

TARGET_I = -14.0
TARGET_TP = -1.0
RATE = 48000


def run(args, capture=False):
    r = subprocess.run(args, check=True, capture_output=True, text=True)
    return r.stderr if capture else None


def measure(path):
    """Integrated loudness and true peak via ffmpeg loudnorm analysis."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:print_format=json", "-f", "null", "-"], capture=True)
    data = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S).group(0))
    return float(data["input_i"]), float(data["input_tp"])


def main(cfg_path, out_dir):
    cfg = json.load(open(cfg_path))
    base = os.path.dirname(os.path.abspath(cfg_path))
    dur = float(cfg["duration"])
    os.makedirs(os.path.join(out_dir, "stems"), exist_ok=True)
    tmp = os.path.join(out_dir, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    p = lambda f: f if os.path.isabs(f) else os.path.join(base, f)

    def place(src, start, gain_db, extra=""):
        ms = max(0, int(round(start * 1000)))
        return f"aresample={RATE},aformat=channel_layouts=stereo,volume={gain_db}dB,adelay={ms}|{ms}{extra},apad,atrim=0:{dur}"

    # 1) VO stem
    vo = cfg["vo"]
    vo_raw = os.path.join(tmp, "vo.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", p(vo["file"]), "-af", place(vo["file"], vo["start"], vo.get("gainDb", 0)), "-ar", str(RATE), vo_raw])

    # 2) Music stem, ducked by the VO stem
    music_raw = None
    if cfg.get("music"):
        m = cfg["music"]
        duck = m.get("duck", {})
        fade_out = m.get("fadeOut", 0)
        fade = f",afade=t=out:st={dur - fade_out}:d={fade_out}" if fade_out else ""
        music_raw = os.path.join(tmp, "music.wav")
        graph = (
            f"[0:a]{place(m['file'], m.get('start', 0), m.get('gainDb', -14))}{fade}[m];"
            f"[1:a]aresample={RATE},aformat=channel_layouts=stereo[k];"
            f"[m][k]sidechaincompress=threshold={duck.get('threshold', 0.04)}:ratio={duck.get('ratio', 5)}:"
            f"attack={duck.get('attack', 25)}:release={duck.get('release', 350)}:makeup=1[out]"
        )
        run(["ffmpeg", "-v", "error", "-y", "-i", p(m["file"]), "-i", vo_raw, "-filter_complex", graph, "-map", "[out]", "-ar", str(RATE), music_raw])

    # 3) SFX stem
    sfx_raw = None
    if cfg.get("sfx"):
        sfx_raw = os.path.join(tmp, "sfx.wav")
        ins, chains = [], []
        for i, s in enumerate(cfg["sfx"]):
            ins += ["-i", p(s["file"])]
            chains.append(f"[{i}:a]{place(s['file'], s['t'], s.get('gainDb', -24))}[s{i}]")
        graph = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(len(cfg["sfx"]))) + f"amix=inputs={len(cfg['sfx'])}:normalize=0:duration=longest[out]"
        run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", graph, "-map", "[out]", "-ar", str(RATE), sfx_raw])

    stems = [s for s in [vo_raw, music_raw, sfx_raw] if s]

    # 4) Sum, measure, derive one gain for everything
    pre = os.path.join(tmp, "premix.wav")
    ins = sum((["-i", s] for s in stems), [])
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", "".join(f"[{i}:a]" for i in range(len(stems))) + f"amix=inputs={len(stems)}:normalize=0[out]", "-map", "[out]", "-ar", str(RATE), pre])
    i_in, tp_in = measure(pre)
    gain = TARGET_I - i_in
    # Keep true peak under the ceiling: if the gain would push peaks over, a limiter catches the master only.
    peak_after = tp_in + gain
    limiter = f",alimiter=limit={10 ** (TARGET_TP / 20):.4f}:attack=5:release=50:level=disabled" if peak_after > TARGET_TP else ""

    master = os.path.join(out_dir, "master.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af", f"volume={gain:.3f}dB{limiter}", "-ar", str(RATE), "-c:a", "pcm_s24le", master])
    for s in stems:
        name = os.path.basename(s)
        run(["ffmpeg", "-v", "error", "-y", "-i", s, "-af", f"volume={gain:.3f}dB", "-ar", str(RATE), "-c:a", "pcm_s24le", os.path.join(out_dir, "stems", name)])
    i_out, tp_out = measure(master)
    report = {"premix_lufs": i_in, "gain_db": round(gain, 2), "limited": bool(limiter), "master_lufs": i_out, "master_true_peak": tp_out}
    json.dump(report, open(os.path.join(out_dir, "loudness.json"), "w"), indent=1)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    print(json.dumps(report))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
