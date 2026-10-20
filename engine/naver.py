"""naver.py — 네이버 증권 모바일 API 얇은 래퍼 (GitHub Actions 에서 동작 확인)"""
import json, time, urllib.request, urllib.parse

UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "Referer": "https://m.stock.naver.com/"}
BASE = "https://m.stock.naver.com"


def get(path, retry=2):
    for i in range(retry + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=UA), timeout=20) as r:
                return json.loads(r.read())
        except Exception:
            if i == retry:
                raise
            time.sleep(1.5)


def num(s):
    """'1,234' / '+1,234' / '-' / None → float | None"""
    if s is None:
        return None
    import re
    m = re.search(r"-?\d+(?:\.\d+)?", str(s).replace(",", ""))  # '6.29배' '18,004원' '+1,234' '39.13%'
    return float(m.group()) if m else None


def search(q):
    """한글명/코드 → [{code, name, market}] (국내 주식만)"""
    j = get("/front-api/search/autoComplete?query=" + urllib.parse.quote(q) + "&target=stock")
    out = []
    for it in (j.get("result") or {}).get("items", []):
        if it.get("nationCode") == "KOR" and it.get("category") == "stock" and not it.get("isEtf"):
            out.append({"code": it["code"], "name": it["name"], "market": it.get("typeCode")})
    return out


def yahoo_symbol(code, market):
    return f"{code}.KS" if market == "KOSPI" else f"{code}.KQ"


def rank(market, pages=5, size=100):
    """시총 순위 리스트. marketValue 단위 = 억원, accumulatedTradingValue 단위 = 백만원"""
    out = []
    for p in range(1, pages + 1):
        j = get(f"/api/stocks/marketValue/{market}?page={p}&pageSize={size}")
        st = j.get("stocks") or []
        out += st
        if len(st) < size:
            break
        time.sleep(0.3)
    return out


def finance(code, period="quarter"):
    """{'periods':[(key,title,is_consensus)], 'rows':{title:{key:value}}}"""
    j = get(f"/api/stock/{code}/finance/{period}")
    fi = j.get("financeInfo") or {}
    per = [(t["key"], t["title"], t.get("isConsensus") == "Y") for t in fi.get("trTitleList", [])]
    rows = {r["title"]: {k: num(v.get("value")) for k, v in r.get("columns", {}).items()} for r in fi.get("rowList", [])}
    return {"periods": per, "rows": rows}


def trend(code, n=20):
    """일별 외국인/기관/개인 순매수 수량 (최근 n일)"""
    j = get(f"/api/stock/{code}/trend?pageSize={n}")
    return [{"date": x["bizdate"], "foreign": num(x.get("foreignerPureBuyQuant")), "organ": num(x.get("organPureBuyQuant")),
             "indiv": num(x.get("individualPureBuyQuant")), "close": num(x.get("closePrice")), "vol": num(x.get("accumulatedTradingVolume")),
             "foreign_ratio": num(x.get("foreignerHoldRatio"))} for x in j]


def integration(code):
    j = get(f"/api/stock/{code}/integration")
    info = {x.get("code"): x.get("value") for x in j.get("totalInfos", [])}
    return {"name": j.get("stockName"), "info": info, "raw": j}
