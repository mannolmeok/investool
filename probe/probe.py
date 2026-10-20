import json, urllib.request, urllib.parse
R = {}
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "Referer": "https://m.stock.naver.com/"}
def get(u):
    try:
        b = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20).read()
        try: return {"ok": True, "json": json.loads(b)}
        except Exception: return {"ok": True, "text": b[:600].decode("utf-8", "ignore")}
    except Exception as e:
        return {"ok": False, "err": repr(e)[:200]}
def short(x, n=1500): return json.dumps(x, ensure_ascii=False)[:n]
U = {
 "mkt_rank": "https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=5",
 "integration": "https://m.stock.naver.com/api/stock/005930/integration",
 "basic": "https://m.stock.naver.com/api/stock/005930/basic",
 "fin_annual": "https://m.stock.naver.com/api/stock/005930/finance/annual",
 "fin_quarter": "https://m.stock.naver.com/api/stock/005930/finance/quarter",
 "trend": "https://m.stock.naver.com/api/stock/005930/trend?pageSize=5",
 "investor": "https://m.stock.naver.com/api/stock/005930/investorTrend?pageSize=5",
 "search": "https://m.stock.naver.com/front-api/search/autoComplete?query=" + urllib.parse.quote("한화에어로") + "&target=stock",
 "industry": "https://m.stock.naver.com/api/stocks/industry/278?page=1&pageSize=5",
 "yahoo_search": "https://query2.finance.yahoo.com/v1/finance/search?q=005930.KS&quotesCount=3",
 "naver_pc_sum": "https://finance.naver.com/sise/sise_market_sum.naver?sosok=1&page=1",
}
for k, u in U.items():
    R[k] = short(get(u))
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
