import json, urllib.request
R = {}
for u in ["https://investool-quote.jsm2092.workers.dev/", "https://investool-quote.jsm2092.workers.dev/c?s=005930.KS&tf=w"]:
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20)
        R[u] = r.read()[:300].decode("utf-8", "ignore")
    except Exception as e:
        R[u] = repr(e)[:200]
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
