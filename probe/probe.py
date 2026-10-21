import json, urllib.request
R = {}
for u in ["https://investool-quote.jsm2092.workers.dev/", "https://investool-quote.jsm2092.workers.dev/kick-test?x=2"]:
    try:
        R[u] = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read()[:300].decode()
    except Exception as e:
        R[u] = repr(e)[:200]
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
