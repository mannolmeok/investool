"""데이터 소스 점검: pykrx(KRX) 재무·수급 / 네이버 금융 / 야후 한글 검색"""
import json, traceback, urllib.request, urllib.parse
R = {}
def t(name, f):
    try: R[name] = f()
    except Exception as e: R[name] = "FAIL " + repr(e)[:300]
def krx_fund():
    from pykrx import stock
    d = stock.get_nearest_business_day_in_a_week()
    f = stock.get_market_fundamental(d, market="ALL")
    return {"date": d, "rows": len(f), "head": f.head(3).reset_index().astype(str).to_dict("records")}
def krx_cap():
    from pykrx import stock
    d = stock.get_nearest_business_day_in_a_week()
    c = stock.get_market_cap(d, market="ALL")
    return {"rows": len(c), "cols": list(c.columns), "head": c.head(2).reset_index().astype(str).to_dict("records")}
def krx_fund_1y():
    from pykrx import stock
    f = stock.get_market_fundamental("20251017", market="ALL")
    return {"rows": len(f)}
def krx_inv():
    from pykrx import stock
    d = stock.get_nearest_business_day_in_a_week()
    x = stock.get_market_net_purchases_of_equities("20260921", d, "KOSPI", "외국인")
    return {"rows": len(x), "head": x.head(3).reset_index().astype(str).to_dict("records")}
def krx_inv_ticker():
    from pykrx import stock
    x = stock.get_market_trading_value_by_date("20260921", "20261019", "005930")
    return {"rows": len(x), "cols": list(x.columns)}
def krx_names():
    from pykrx import stock
    return {"kospi": len(stock.get_market_ticker_list(market="KOSPI")), "kosdaq": len(stock.get_market_ticker_list(market="KOSDAQ")), "005930": stock.get_market_ticker_name("005930")}
def naver_sum():
    req = urllib.request.Request("https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=1", headers={"User-Agent": "Mozilla/5.0"})
    h = urllib.request.urlopen(req, timeout=20).read().decode("euc-kr", "ignore")
    return {"len": len(h), "has_table": "type_2" in h}
def naver_main():
    req = urllib.request.Request("https://finance.naver.com/item/main.naver?code=005930", headers={"User-Agent": "Mozilla/5.0"})
    h = urllib.request.urlopen(req, timeout=20).read().decode("euc-kr", "ignore")
    return {"len": len(h), "has_fin": "cop_analysis" in h}
def yahoo_search():
    u = "https://query1.finance.yahoo.com/v1/finance/search?q=" + urllib.parse.quote("한화에어로스페이스")
    j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    return [q.get("symbol") for q in j.get("quotes", [])][:5]
for n, f in [("krx_fund", krx_fund), ("krx_cap", krx_cap), ("krx_fund_1y", krx_fund_1y), ("krx_inv", krx_inv), ("krx_inv_ticker", krx_inv_ticker), ("krx_names", krx_names), ("naver_sum", naver_sum), ("naver_main", naver_main), ("yahoo_search", yahoo_search)]:
    t(n, f)
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
print(json.dumps(R, ensure_ascii=False, indent=1)[:4000])
