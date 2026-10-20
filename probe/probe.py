import json, sys
sys.path.insert(0, "engine")
import naver
i = naver.integration("000270")["raw"]
R = {"researches": i.get("researches"), "industryCompareInfo": (i.get("industryCompareInfo") or [])[:2], "dealTrendInfos": (i.get("dealTrendInfos") or [])[:2], "consensusInfo": i.get("consensusInfo")}
R["chart_try"] = None
import urllib.request
for u in ["https://api.stock.naver.com/chart/domestic/item/000270/day?startDateTime=202510010000&endDateTime=202610200000",
          "https://m.stock.naver.com/api/chart/domestic/item/000270/day?periodType=year"]:
    try:
        b = urllib.request.urlopen(urllib.request.Request(u, headers=naver.UA), timeout=20).read()[:400]
        R.setdefault("charts", []).append([u, b.decode("utf-8", "ignore")])
    except Exception as e:
        R.setdefault("charts", []).append([u, repr(e)[:120]])
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1)[:9000])
