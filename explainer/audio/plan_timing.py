#!/usr/bin/env python3
"""Lock the VO to the music's beat grid and plan the music edit.

Counter hits (090/180/270/360) must land on beats. Only the pauses BEFORE each triad move
(sentence boundaries, kept between MIN_GAP and MAX_GAP); pauses inside triads stay tight.
The music's big section (source BIG_ENTRY, a downbeat) is aligned to the 360 hit, and the music
"buttons" (cuts to its ending at source ENDING) exactly when "Onemarsmedia" starts.

Usage: python3 -I plan_timing.py take.align.json base_gaps.json out_dir
Writes out_dir/gaps.json, out_dir/plan.json
"""
import json
import sys

OFFSET = 1.7  # VO starts here in film time
BEAT = 0.5  # 120 BPM
BAR = 2.0
BIG_ENTRY = 24.0  # source time where the kick/full section enters (a bar downbeat)
ENDING = 42.0  # source time where the full section stops and the ending tail starts
MIN_GAP, MAX_GAP = 0.2, 0.75
LEAD = 0.04  # visual hit slightly ahead of the vowel peak
# (word, syllable index) carrying each counter hit, and the gap index right before its triad
HITS = [("shoot", 0, 2, 90), ("design", 1, 5, 180), ("site", 0, 9, 270), ("everywhere", 2, 12, 360)]
NAME_CHUNK = 19  # "Onemarsmedia"
CAMPAIGN_GAP = 18  # pause after "the whole campaign." (before the name)


def film_starts(chunks, gaps, keep=0.06):
    """Same arithmetic as vo_edit.py: film start of every chunk."""
    t = OFFSET
    starts = []
    for i, c in enumerate(chunks):
        starts.append(t)
        t += (c["end"] - c["start"]) + (max(gaps[i], 2 * keep) if i < len(gaps) else 0)
    return starts


def word_time(al, word, syl, starts):
    for w in al["words"]:
        if w["text"].strip(",.").lower() == word:
            c = al["chunks"][w["chunk"]]
            return w["syllables"][syl] - c["start"] + starts[w["chunk"]] - LEAD
    raise KeyError(word)


def main(align_path, base_gaps_path, out_dir):
    al = json.load(open(align_path))
    gaps = json.load(open(base_gaps_path))
    chunks = al["chunks"]
    # First hit defines the grid phase; later hits snap to it by moving their pre-triad gap.
    starts = film_starts(chunks, gaps)
    grid0 = word_time(al, HITS[0][0], HITS[0][1], starts)
    log = []
    for word, syl, gi, deg in HITS[1:]:
        starts = film_starts(chunks, gaps)
        t = word_time(al, word, syl, starts)
        k = round((t - grid0) / BEAT)
        best = None
        for kk in (k - 1, k, k + 1, k + 2):
            target = grid0 + kk * BEAT
            g = gaps[gi] + (target - t)
            if MIN_GAP <= g <= MAX_GAP and (best is None or abs(g - gaps[gi]) < abs(best[1] - gaps[gi])):
                best = (target, g)
        if best is None:
            raise SystemExit(f"cannot put {deg} on the grid with gap {gi}")
        log.append(f"{deg:3d}: gap {gi} {gaps[gi]:.2f} -> {best[1]:.2f}")
        gaps[gi] = round(best[1], 4)
    starts = film_starts(chunks, gaps)
    hits = {deg: round(word_time(al, w, s, starts), 3) for w, s, _, deg in HITS}
    # Music: big entry on the 360 hit; ending on a bar boundary 2-4 bars later, where the name starts.
    music_start = BIG_ENTRY - hits[360]  # source time at film 0
    campaign_end = starts[CAMPAIGN_GAP] + chunks[CAMPAIGN_GAP]["end"] - chunks[CAMPAIGN_GAP]["start"]
    for bars in (2, 3, 4):
        button = hits[360] + bars * BAR
        if button - campaign_end >= 1.2:
            break
    keep = 0.06
    gaps[CAMPAIGN_GAP] = round(button + keep - campaign_end, 4)  # name's first sound ~ on the button
    starts = film_starts(chunks, gaps)
    plan = {
        "offset": OFFSET,
        "beat": BEAT,
        "grid0": round(grid0, 3),
        "hits": hits,
        "music": {
            "file": "m4.mp3",
            "segments": [
                {"src_start": round(music_start, 3), "src_end": round(BIG_ENTRY + (button - hits[360]), 3), "film_start": 0.0},
                {"src_start": ENDING, "src_end": ENDING + 6.0, "film_start": round(button, 3)},
            ],
            "button": round(button, 3),
        },
        "name_start": round(starts[NAME_CHUNK], 3),
        "vo_end": round(starts[-1] + chunks[-1]["end"] - chunks[-1]["start"], 3),
        "log": log,
    }
    json.dump(gaps, open(f"{out_dir}/gaps.json", "w"))
    json.dump(plan, open(f"{out_dir}/plan.json", "w"), indent=1)
    print("\n".join(log))
    print(json.dumps({k: plan[k] for k in ("hits", "name_start", "vo_end")}), "music", plan["music"]["segments"], "button", plan["music"]["button"])


if __name__ == "__main__":
    main(*sys.argv[1:4])
