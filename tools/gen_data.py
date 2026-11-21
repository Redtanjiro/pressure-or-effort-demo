"""Four weeks of made-up Google Fitbit Air data for The Blob demo (nothing here is real).

    python3 tools/gen_data.py tools/data-14day.js data.js

Run it on the ORIGINAL 14-day file (kept as tools/data-14day.js). It keeps those 14 days' heart rate, steps,
stories and answers exactly, adds 15 earlier days (13 to 27 Oct), and adds to every day: last night's sleep
and stages, HRV, breathing rate, SpO2, skin temperature, Active Zone Minutes, calories and recognised exercise.
Example care choices (which way of unwinding, and whether it helped) go on the stories.

Every answer and care choice below is the appendix of the handoff, encoded as data. Edit NEW or CARE and run again.
"""
import json
import random
import sys

# ---- the appendix -----------------------------------------------------------------------------
# story: (start, activity, due, onTop, flat, care)
#   activity: W walking somewhere · F on its feet working · S sitting still · T tennis (exercising)
#   care: None (not asked) · "no" (not now) · "<mode>+" (helped) · "<mode>-" (didn't settle)
NEW = [
    ("2026-10-13", "Lectures, then studio", [("08:20", "W", 0, 1, 2, "no"), ("12:10", "W", 0, 1, 1, None), ("15:00", "S", 1, 0, 4, "no")]),
    ("2026-10-14", "Studio, A1 crunch", [("08:30", "W", 0, 1, 2, None), ("14:20", "S", 1, 0, 5, "breathe-"), ("21:00", "S", 1, 0, 6, "no")]),
    ("2026-10-15", "Shift at Barangaroo, midday", [("11:30", "F", 0, 1, 2, None), ("12:40", "F", 0, 1, 3, "rest+"), ("20:40", "S", 1, 0, 6, "breathe+")]),
    ("2026-10-16", "Assessment 1 due, 5pm", [("08:10", "W", 1, 0, 3, "no"), ("11:00", "S", 1, 0, 6, "walk+"), ("15:30", "S", 1, 0, 7, "sigh+"), ("17:20", "W", 0, 1, 1, None)]),
    ("2026-10-17", "Tennis with friends, club shift", [("09:30", "T", 0, 1, 1, None), ("17:30", "F", 0, 1, 2, None), ("19:00", "F", 0, 1, 3, "stretch+")]),
    ("2026-10-18", "Nothing booked", [("11:00", "W", 0, 1, 1, None), ("16:00", "S", 0, 1, 2, None)]),
    ("2026-10-19", "Lectures", [("08:20", "W", 0, 1, 1, None), ("12:30", "W", 0, 1, 2, None), ("15:10", "S", 0, 1, 3, None)]),
    ("2026-10-20", "Studio, feedback session", [("08:30", "W", 0, 1, 2, None), ("13:40", "S", 1, 1, 4, "walk+"), ("20:30", "S", 0, 1, 2, None)]),
    ("2026-10-21", "Shift at Roseville, evening", [("09:00", "W", 0, 1, 1, None), ("18:00", "F", 0, 1, 2, None), ("19:30", "F", 0, 0, 4, "look+"), ("21:00", "F", 0, 1, 2, None)]),
    ("2026-10-22", "Lectures, A2 brief", [("08:40", "W", 0, 1, 2, None), ("14:30", "S", 1, 0, 5, "sigh+"), ("17:00", "W", 0, 1, 2, None)]),
    ("2026-10-23", "Studio day", [("08:30", "W", 0, 1, 1, None), ("11:00", "S", 0, 1, 3, None), ("15:00", "S", 1, 0, 4, "stretch+")]),
    ("2026-10-24", "Tennis, then nothing booked", [("09:00", "T", 0, 1, 1, None), ("14:00", "W", 0, 1, 1, None)]),
    ("2026-10-25", "Shift at Barangaroo, evening", [("17:00", "F", 0, 1, 2, None), ("18:30", "F", 0, 1, 3, "rest+"), ("21:30", "S", 0, 1, 2, None)]),
    ("2026-10-26", "Lectures, crit next week", [("08:20", "W", 0, 1, 2, None), ("13:00", "S", 1, 0, 5, "walk+"), ("21:10", "S", 1, 0, 5, "winddown+")]),
    ("2026-10-27", "Studio, crit prep", [("08:30", "W", 0, 1, 1, None), ("14:00", "S", 1, 0, 5, "breathe+"), ("20:50", "S", 1, 0, 5, "winddown+")]),
]
# care on the original 14 days, by story start time
CARE = {
    "2026-10-28": {"08:33": "no", "11:58": "no"},
    "2026-10-29": {"16:35": "no", "18:05": "no", "19:25": "no", "20:35": "stretch+"},
    "2026-10-30": {"08:28": "look-", "14:38": "sigh+", "17:25": "rest+", "20:35": "sigh+"},
    "2026-10-31": {"07:35": "rest+", "13:30": "breathe-", "14:20": "soften+", "20:03": "sigh+"},
    "2026-11-01": {"17:15": "no", "19:50": "stretch+", "20:20": "no"},
    "2026-11-02": {"11:55": "stretch+", "12:40": "no", "14:20": "no"},
    "2026-11-03": {"08:05": "no", "11:48": "no", "12:15": "soften+", "18:18": "no"},
    "2026-11-04": {"07:50": "no", "12:00": "rest+", "17:08": "no", "20:20": "winddown+"},
    "2026-11-05": {"08:15": "no", "11:58": "rest+", "17:40": "no"},
    "2026-11-06": {"11:05": "no", "12:55": "no", "13:55": "stretch+"},
    "2026-11-07": {"08:35": "no", "10:53": "no", "18:03": "no", "20:20": "winddown+"},
    "2026-11-08": {"17:00": "no", "19:00": "no", "19:55": "no"},
    "2026-11-09": {"20:25": "no", "20:50": "stretch+", "22:20": "no", "22:55": "no"},
}
# last night's sleep and HRV, for the day it leads into
NIGHT = {
    "2026-10-13": ("7h13", 50), "2026-10-14": ("6h40", 54), "2026-10-15": ("5h51", 36), "2026-10-16": ("4h51", 33),
    "2026-10-17": ("8h08", 44), "2026-10-18": ("8h18", 60), "2026-10-19": ("7h30", 50), "2026-10-20": ("7h16", 48),
    "2026-10-21": ("7h48", 49), "2026-10-22": ("6h33", 45), "2026-10-23": ("7h28", 55), "2026-10-24": ("8h16", 51),
    "2026-10-25": ("8h03", 60), "2026-10-26": ("6h10", 50), "2026-10-27": ("7h39", 53), "2026-10-28": ("7h45", 51),
    "2026-10-29": ("7h28", 49), "2026-10-30": ("7h15", 55), "2026-10-31": ("6h38", 39), "2026-11-01": ("7h19", 43),
    "2026-11-02": ("6h36", 48), "2026-11-03": ("7h05", 48), "2026-11-04": ("6h34", 49), "2026-11-05": ("6h39", 54),
    "2026-11-06": ("7h03", 54), "2026-11-07": ("7h03", 58), "2026-11-08": ("7h42", 58), "2026-11-09": ("6h22", 50),
    "2026-11-10": ("5h12", 54),
}
SOURCES = [
    {"id": "hr", "name": "Heart rate (every 5 min)"}, {"id": "steps", "name": "Steps"}, {"id": "exercise", "name": "Exercise (auto-recognised)"},
    {"id": "azm", "name": "Active Zone Minutes"}, {"id": "rhr", "name": "Resting heartbeat"}, {"id": "sleep", "name": "Sleep and stages"},
    {"id": "hrv", "name": "Heart rate variability"}, {"id": "breathing", "name": "Breathing rate"}, {"id": "spo2", "name": "Oxygen saturation (SpO2)"},
    {"id": "skin", "name": "Skin temperature"}, {"id": "calories", "name": "Calories"},
]
BUSY = ("Shift", "Tennis")


def hhmm(m):
    return "%02d:%02d" % (m // 60 % 24, m % 60)


def mins_of(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def care_of(code):
    if code is None:
        return None
    if code == "no":
        return {"mode": None, "notNow": True}
    return {"mode": code[:-1], "settled": code[-1] == "+"}


def whole_of(flats):
    return max(1, min(7, round((sum(flats) / len(flats) + max(flats)) / 2)))


# ---- a new day's heart rate and steps -------------------------------------------------------------
def build_day(rng, date, context, stories):
    rest = round(rng.uniform(58.5, 61.5), 1)
    busy = any(b in context for b in BUSY)
    bpm = [0.0] * 288
    steps = [0] * 288
    for s in range(288):
        m = s * 5
        awake = 7 * 60 <= m < 23 * 60
        bpm[s] = rest + (rng.uniform(8, 14) if awake else rng.uniform(-3, 1.5))
        if awake:
            base = rng.choice([0, 0, 10, 25, 60, 120] if busy else [0, 0, 0, 8, 20, 60])
            steps[s] = base
    rises = []
    for start_t, act, due, on_top, flat, care in stories:
        start = mins_of(start_t)
        mins = {"W": 25, "F": 50, "S": 45 if start < 20 * 60 else 40, "T": 70}[act]
        if act == "S" and flat <= 2:
            mins = 30
        lift = {"W": rng.uniform(31, 40), "F": rng.uniform(30, 40), "T": rng.uniform(66, 74),
                "S": rng.uniform(46, 52) if flat >= 6 else rng.uniform(30, 41)}[act]
        per5 = {"W": rng.randint(480, 540), "F": rng.randint(170, 280), "T": rng.randint(620, 700), "S": rng.randint(0, 6)}[act]
        a, b = start // 5, (start + mins) // 5
        for s in range(a, b):
            shape = 1 - abs((s - a) - (b - a - 1) / 2) / max(1, (b - a) / 2)
            bpm[s] = rest + lift * (0.55 + 0.45 * shape) + rng.uniform(-1.5, 1.5)
            steps[s] = per5 + rng.randint(-20, 20) if per5 > 20 else per5
        peak = max(range(a, b), key=lambda s: bpm[s])
        steps10 = steps[peak] + steps[peak - 1]
        moving = steps10 > 250
        situation = {"W": "Walking", "F": "On its feet", "T": "Exercising"}.get(act) or ("Sitting still, evening" if start >= 18 * 60 else "Sitting still, daytime")
        r = {"peakMin": peak * 5, "bpm": round(bpm[peak]), "mins": mins, "steps10": steps10, "moving": moving, "situation": situation,
             "start": start, "end": start + mins,
             "answer": {"due": bool(due), "onTop": bool(on_top), "flat": flat, "cantRemember": False}}
        if act == "T":
            r["answer"]["activity"] = "Exercising"
        c = care_of(care)
        if c:
            r["care"] = c
        rises.append(r)
    flats = [r["answer"]["flat"] for r in rises]
    whole = whole_of(flats)
    return {"date": date, "rhr": rest, "steps": sum(steps), "nRises": len(rises), "context": context,
            "series": [[s * 5, round(bpm[s], 1), steps[s]] for s in range(288)], "rises": rises, "guess": whole, "whole": whole}


# ---- what every day gets from the Fitbit ------------------------------------------------------------
def add_body(rng, day, wound_down_before):
    asleep_txt, hrv = NIGHT[day["date"]]
    h, m = asleep_txt.split("h")
    asleep = int(h) * 60 + int(m)
    to_sleep = 8 if wound_down_before else rng.randint(10, 17)
    awake = round(asleep * rng.uniform(0.08, 0.1))
    wake = rng.choice([420, 425, 430, 440]) if asleep >= 390 else rng.choice([415, 425])
    bed = (wake - asleep - awake - to_sleep) % 1440
    deep = round(asleep * rng.uniform(0.13, 0.16))
    rem = round(asleep * rng.uniform(0.19, 0.22))
    day["sleep"] = {"bed": hhmm(bed), "wake": hhmm(wake), "minutesAsleep": asleep, "deep": deep, "light": asleep - deep - rem, "rem": rem,
                    "awake": awake, "minutesToFallAsleep": to_sleep, "efficiency": round(100 * asleep / (asleep + awake + to_sleep))}
    day["hrv"] = float(hrv) + round(rng.uniform(-0.4, 0.4), 1)
    day["breathingRate"] = round(rng.uniform(14.1, 15.2) + (0.4 if asleep < 390 else 0), 1)
    day["spo2"] = round(rng.uniform(95.9, 97.6), 1)
    day["skinTemp"] = round(rng.uniform(-0.3, 0.35), 2)
    rest = day["rhr"]
    fat = sum(5 for _, b, _ in day["series"] if 30 <= b - rest < 55)
    cardio = sum(5 for _, b, _ in day["series"] if 55 <= b - rest < 75)
    peak = sum(5 for _, b, _ in day["series"] if b - rest >= 75)
    day["azm"] = {"fatBurn": fat, "cardio": cardio, "peak": peak, "total": fat + 2 * (cardio + peak)}
    day["calories"] = round(1650 + day["steps"] * 0.045 + day["azm"]["total"] * 6 + rng.uniform(-80, 80))
    ex = []
    for r in day["rises"]:
        if r.get("situation") == "Exercising":
            ex.append({"type": "Tennis", "start": hhmm(r["start"]), "mins": r["mins"], "avgHr": round(rest + 70)})
        elif r.get("situation") == "Walking" and r["mins"] >= 20:
            ex.append({"type": "Walk", "start": hhmm(r["start"]), "mins": r["mins"], "avgHr": round(r["bpm"] - 6)})
    day["exercise"] = ex


def main():
    src, out = sys.argv[1], sys.argv[2]
    text = open(src).read()
    D = json.loads(text[text.index("=") + 1:text.rstrip().rindex(";")])
    if len(D["days"]) != 14:
        sys.exit("Expected the original 14-day data.js; this one has %d days." % len(D["days"]))
    rng = random.Random(1013)
    new_days = [build_day(rng, d, c, s) for d, c, s in NEW]
    for day in D["days"]:
        care = CARE.get(day["date"], {})
        for r in day["rises"]:
            c = care_of(care.get(hhmm(r["start"])))
            if c:
                r["care"] = c
    days = new_days + D["days"]
    for i, day in enumerate(days):
        prev = days[i - 1] if i else None
        wound = bool(prev and any((r.get("care") or {}).get("mode") == "winddown" for r in prev["rises"]))
        add_body(rng, day, wound)
    D["days"] = days
    D["device"] = "Google Fitbit Air"
    D["sources"] = SOURCES
    D["examples"] = {"sugg": {"still": "try", "steps": "try", "sleep": "try", "rhr": "no"}}
    open(out, "w").write("window.BLOB_DATA=" + json.dumps(D, separators=(",", ":")) + ";\n")
    answered = sum(1 for d in days for r in d["rises"] if r.get("answer"))
    asked = [r["care"] for d in days for r in d["rises"] if r.get("care")]
    done = [c for c in asked if c.get("mode")]
    print(len(days), "days,", answered, "answered stories,", len(asked), "care asks:", len(done), "done (", sum(1 for c in done if c["settled"]), "settled ),",
          len(asked) - len(done), "not now")


if __name__ == "__main__":
    main()
