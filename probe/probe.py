import json, sys
sys.path.insert(0, "engine")
import naver
R = {}
for n in (60, 120):
    try: R[f"trend{n}"] = len(naver.get(f"/api/stock/000270/trend?pageSize={n}"))
    except Exception as e: R[f"trend{n}"] = repr(e)[:100]
for code in ("267250", "000880", "003550", "000270"):  # HD현대, 한화, LG, 기아
    i = naver.integration(code)["raw"]
    q = naver.finance(code, "quarter")
    R[code] = {"name": i.get("stockName"), "desc": (i.get("description") or "")[:300], "industryCode": i.get("industryCode"),
               "지배": q["rows"].get("지배주주순이익"), "비지배": q["rows"].get("비지배주주순이익"), "순이익": q["rows"].get("당기순이익")}
try: R["industry_name"] = str(naver.get("/api/stocks/industry/273?page=1&pageSize=1"))[:300]
except Exception as e: R["industry_name"] = repr(e)
for u in ["/api/stocks/industry", "/api/stock/267250/basic"]:
    try: R[u] = str(naver.get(u))[:600]
    except Exception as e: R[u] = repr(e)[:100]
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
