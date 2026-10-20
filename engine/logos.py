"""logos.py — 종목 로고 받아두기 (토스처럼 카드·목록에 아이콘)
국내: 네이버 증권 로고 CDN (Stock{코드}.png) · 미국: financialmodelingprep 공개 로고
logos/<심볼>.png 로 저장, logos/index.json = 받은 목록. 이미 있으면 건너뜀(로고는 거의 안 바뀜).
실패해도 앱은 이름 첫 글자 배지로 대신 표시.
"""
import json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "logos"
UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}


def url_for(sym):
    if sym.endswith((".KS", ".KQ")):
        return f"https://ssl.pstatic.net/imgstock/fn/real/logo/png/stock/Stock{sym[:6]}.png"
    if sym.startswith("^"):
        return None
    return f"https://financialmodelingprep.com/image-stock/{sym}.png"


def symbols():
    s = []
    for f in ("watchlist.txt", "context.txt"):
        p = ROOT / f
        if p.exists():
            s += [l.strip() for l in p.read_text().splitlines() if l.strip() and not l.startswith("#")]
    for f, key in (("out/screener.json", "rows"), ("out/lookup.json", None)):
        p = ROOT / f
        if p.exists():
            j = json.loads(p.read_text(encoding="utf-8"))
            rows = j.get(key, []) if key else j
            s += [r.get("symbol") for r in rows if r.get("symbol")]
    return list(dict.fromkeys(s))


def main():
    DIR.mkdir(exist_ok=True)
    idx_p = DIR / "index.json"
    idx = json.loads(idx_p.read_text()) if idx_p.exists() else {}
    got = miss = 0
    for sym in symbols():
        f = DIR / f"{sym}.png"
        if f.exists() or idx.get(sym) == "none":
            continue
        u = url_for(sym)
        if not u:
            continue
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=15).read()
            if len(b) > 200 and b[:4] == b"\x89PNG":
                f.write_bytes(b); idx[sym] = "png"; got += 1
            else:
                idx[sym] = "none"; miss += 1
        except Exception:
            idx[sym] = "none"; miss += 1
        time.sleep(0.1)
    idx_p.write_text(json.dumps(idx, ensure_ascii=False, sort_keys=True, indent=0))
    print(f"logos: 새로 {got} · 없음 {miss} · 전체 {sum(1 for v in idx.values() if v == 'png')}")


if __name__ == "__main__":
    main()
