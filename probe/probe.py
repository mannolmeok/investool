import json, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "Referer": "https://m.stock.naver.com/"}
def g(u): return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20).read())
R = {}
q = g("https://m.stock.naver.com/api/stock/000270/finance/quarter")
R["q_titles"] = [r["title"] for r in q["financeInfo"]["rowList"]]
R["q_periods"] = q["financeInfo"]["trTitleList"]
R["q_sample"] = q["financeInfo"]["rowList"][:3]
a = g("https://m.stock.naver.com/api/stock/000270/finance/annual")
R["a_titles"] = [r["title"] for r in a["financeInfo"]["rowList"]]
i = g("https://m.stock.naver.com/api/stock/000270/integration")
R["int_keys"] = list(i.keys())
R["int_total"] = [(x.get("code"), x.get("key"), x.get("value")) for x in i.get("totalInfos", [])]
R["int_industry"] = i.get("industryCode"), i.get("industryCompareInfo", [])[:2] if isinstance(i.get("industryCompareInfo"), list) else str(i.get("industryCompareInfo"))[:300]
R["int_consensus"] = str(i.get("consensusInfo"))[:400]
r = g("https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ?page=1&pageSize=100")
R["rank_n"] = len(r["stocks"]); R["rank_total"] = r.get("totalCount"); R["rank_keys"] = list(r["stocks"][0].keys())
R["rank_last"] = {k: r["stocks"][-1][k] for k in ("stockName", "marketValue", "accumulatedTradingValue")}
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
