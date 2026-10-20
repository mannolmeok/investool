import json, sys
sys.path.insert(0, "engine")
import naver
code = "277810"
R = {}
i = naver.integration(code); raw = i["raw"]
R["info"] = i["info"]; R["industry"] = raw.get("industryCode"); R["consensus"] = raw.get("consensusInfo")
R["researches"] = [(x.get("wdt"), x.get("bnm"), x.get("tit")) for x in raw.get("researches") or []]
R["peers"] = [(x.get("stockName"), x.get("marketValue")) for x in (raw.get("industryCompareInfo") or [])[:6]]
for per in ("quarter", "annual"):
    f = naver.finance(code, per)
    R[per] = {"periods": f["periods"], "rows": {k: f["rows"].get(k) for k in ("매출액", "영업이익", "당기순이익", "지배주주순이익", "비지배주주순이익", "영업이익률", "ROE", "EPS", "PER", "PBR", "부채비율")}}
R["trend"] = naver.trend(code, 20)
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=0))
