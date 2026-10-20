import json, urllib.request
R = {}
for u in ["https://investool-quote.jsm2092.workers.dev/q?s=005930.KS,000660.KS,INFQ", "https://investool-quote.jsm2092.workers.dev/"]:
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", "Origin": "https://mannolmeok.github.io"}), timeout=20)
        R[u] = {"status": r.status, "cors": r.headers.get("Access-Control-Allow-Origin"), "body": r.read()[:900].decode("utf-8", "ignore")}
    except Exception as e:
        R[u] = repr(e)[:200]
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
