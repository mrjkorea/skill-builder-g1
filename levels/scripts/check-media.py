#!/usr/bin/env python3
"""Check every picture and audio URL that Seed/Roots/Sprout/Sapling questions reference.
Usage: check-media.py [--local MEDIA_DIR] [--live N]
  --local DIR : map https://mrjkorea.github.io/skill-builder-media-2/<rel> to DIR/<rel> and check the file exists.
  --live N    : also HEAD-request N sampled URLs per level and require HTTP 200.
Also checks old-style relative pictures ../pictures/... exist in the repo. Exits 1 on any failure."""
import json, os, sys, random, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://mrjkorea.github.io/skill-builder-media-2/"
args = sys.argv[1:]
local = args[args.index("--local") + 1] if "--local" in args else None
live = int(args[args.index("--live") + 1]) if "--live" in args else 0
def urls(q):
    out = []
    for k in ("img", "aud", "aud_answer"):
        if q.get(k): out.append(q[k])
    out += q.get("imgs") or []
    out += list((q.get("opt_img") or {}).values())
    out += list((q.get("opt_aud") or {}).values())
    return out
bad = 0
for lv in ("seed", "roots", "sprout", "sapling"):
    seen = set(); n = 0
    for line in open(os.path.join(ROOT, lv, "questions.jsonl"), encoding="utf-8"):
        q = json.loads(line); n += 1
        for u in urls(q):
            seen.add(u)
            if not u.startswith(BASE) or any(c in u for c in "?# "):
                print("BAD URL", lv, q["id"], u); bad += 1; continue
            if local and not os.path.isfile(os.path.join(local, urllib.parse.unquote(u[len(BASE):]))):
                print("MISSING", lv, q["id"], u); bad += 1
        if q.get("v") == 2 and isinstance(q.get("answer"), str) and q["answer"] not in q.get("options", []):
            print("ANSWER NOT IN OPTIONS", q["id"]); bad += 1
    print(lv, "questions", n, "unique media urls", len(seen))
    if live:
        for u in random.Random(1).sample(sorted(seen), min(live, len(seen))):
            try:
                code = urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=20).status
            except Exception as e:
                code = getattr(e, "code", str(e))
            if code != 200: print("LIVE FAIL", code, u); bad += 1
print("FAILURES", bad)
sys.exit(1 if bad else 0)
