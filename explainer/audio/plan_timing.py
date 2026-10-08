#!/usr/bin/env python3
"""Lock the VO to the music's beat grid and plan the music edit (config-driven).

Counter hits must land on beats. Each hit names a word (+ syllable) and the pause that may move
to put it on the grid (a section-transition pause, so sentences keep their rhythm). The first hit
defines the grid phase. The music's big section (a downbeat at config.music.big_entry in the
source) lands on the last hit; the music "buttons" (its stop at config.music.ending) a whole number of
bars later, with the last ending_bars bars before the stop played in full.

Usage: python3 -I plan_timing.py take.align.json config.json out_dir
config.json: {
  "offset": 2.2, "beat": 0.5, "bar": 2.0, "lead": 0.04, "keep": 0.06,
  "gaps": [...one per chunk boundary...],
  "hits": [{"deg": 90, "word": "shoot", "syl": 0, "gap": null, "min": 0, "max": 0}, ...],
  "music": {"big_entry": 24.0, "ending": 42.0, "tail": 6.0, "ending_bars": 1, "button_bars": [5, 4, 6], "latest_button": 38.2,
            "intro_loop": {"from": 6.0, "to": 16.0, "start_max": 3.0}}
}
Writes out_dir/gaps.json, out_dir/plan.json
"""
import json
import sys


def film_starts(chunks, gaps, offset, keep):
    """Same arithmetic as vo_edit.py: film start of every chunk."""
    t = offset
    starts = []
    for i, c in enumerate(chunks):
        starts.append(t)
        t += (c["end"] - c["start"]) + (max(gaps[i], 2 * keep) if i < len(gaps) else 0)
    return starts


def word_time(al, word, syl, starts, lead, nth=0):
    hits = [w for w in al["words"] if w["text"].strip(",.").lower() == word]
    w = hits[nth]
    c = al["chunks"][w["chunk"]]
    return w["syllables"][syl] - c["start"] + starts[w["chunk"]] - lead


def main(align_path, cfg_path, out_dir):
    al = json.load(open(align_path))
    cfg = json.load(open(cfg_path))
    gaps = list(cfg["gaps"])
    chunks = al["chunks"]
    assert len(gaps) == len(chunks) - 1, f"need {len(chunks) - 1} gaps, got {len(gaps)}"
    off, beat, bar, lead, keep = cfg["offset"], cfg["beat"], cfg["bar"], cfg["lead"], cfg["keep"]
    hits_cfg = cfg["hits"]
    starts = film_starts(chunks, gaps, off, keep)
    first = hits_cfg[0]
    grid0 = word_time(al, first["word"], first["syl"], starts, lead, first.get("nth", 0))
    log = []
    for h in hits_cfg[1:]:
        starts = film_starts(chunks, gaps, off, keep)
        t = word_time(al, h["word"], h["syl"], starts, lead, h.get("nth", 0))
        gi = h["gap"]
        k = round((t - grid0) / beat)
        best = None
        for kk in range(k - 2, k + 3):
            target = grid0 + kk * beat
            g = gaps[gi] + (target - t)
            if h["min"] <= g <= h["max"] and (best is None or abs(g - gaps[gi]) < abs(best[1] - gaps[gi])):
                best = (target, g)
        if best is None:
            raise SystemExit(f"cannot put {h['deg']} on the grid with gap {gi}")
        log.append(f"{h['deg']:3d}: gap {gi} {gaps[gi]:.2f} -> {best[1]:.2f}")
        gaps[gi] = round(best[1], 4)
    starts = film_starts(chunks, gaps, off, keep)
    hits = {str(h["deg"]): round(word_time(al, h["word"], h["syl"], starts, lead, h.get("nth", 0)), 3) for h in hits_cfg}
    last = hits[str(hits_cfg[-1]["deg"])]
    m = cfg["music"]
    music_film_start = max(0.0, last - m["big_entry"])  # music may start after film 0 (quiet typing intro)
    src_start = max(0.0, m["big_entry"] - last)
    # a long film: repeat whole bars of the intro (ending at intro_loop.to) so the music still starts by start_max
    loop = m.get("intro_loop")
    extra = 0.0
    if loop and music_film_start > loop["start_max"]:
        bars = -(-(music_film_start - loop["start_max"]) // bar)
        extra = min(bars * bar, loop["to"] - loop.get("from", 0.0))
        music_film_start -= extra
    button = None
    for bars in m["button_bars"]:
        b = last + bars * bar
        if b <= m["latest_button"]:
            button = b
            break
    if button is None:
        raise SystemExit("no musical button fits before latest_button")
    vo_end = starts[-1] + chunks[-1]["end"] - chunks[-1]["start"]
    pre = m.get("ending_bars", 0) * bar
    plan = {
        "offset": off,
        "beat": beat,
        "grid0": round(grid0, 3),
        "hits": hits,
        "music": {
            # the last `ending_bars` bars before the source's stop play in full, so the stop lands on the button
            "segments": ([
                {"src_start": round(src_start, 3), "src_end": loop["to"], "film_start": round(music_film_start, 3)},
                {"src_start": round(loop["to"] - extra, 3), "src_end": round(m["big_entry"] + (button - last) - pre, 3), "film_start": round(music_film_start + loop["to"] - src_start, 3)},
            ] if extra else [
                {"src_start": round(src_start, 3), "src_end": round(m["big_entry"] + (button - last) - pre, 3), "film_start": round(music_film_start, 3)},
            ]) + [
                {"src_start": m["ending"] - pre, "src_end": m["ending"] + m["tail"], "film_start": round(button - pre, 3)},
            ],
            "button": round(button, 3),
        },
        "vo_end": round(vo_end, 3),
        "log": log,
    }
    json.dump(gaps, open(f"{out_dir}/gaps.json", "w"))
    json.dump(plan, open(f"{out_dir}/plan.json", "w"), indent=1)
    print("\n".join(log))
    print(json.dumps({"hits": hits, "vo_end": plan["vo_end"], "music": plan["music"]}))


if __name__ == "__main__":
    main(*sys.argv[1:4])
