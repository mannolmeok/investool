"""fetch.py — 야후 파이낸스 일봉 1년치 → data/<SYMBOL>.csv
사용: python engine/fetch.py            (watchlist.txt 전체)
      python engine/fetch.py INFQ 005930.KS
국내는 야후 심볼 규칙: 코스피 .KS / 코스닥 .KQ
"""
import sys, json, time
from pathlib import Path
from datetime import datetime, timezone
import urllib.request, urllib.parse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
URL = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
UA = {"User-Agent": "Mozilla/5.0 (investool daily batch)"}


def fetch(sym: str) -> int:
    req = urllib.request.Request(URL.format(sym=urllib.parse.quote(sym)), headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.load(r)
    res = j["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    ts = res["timestamp"]
    krw = sym.endswith((".KS", ".KQ"))
    rows = ["date,open,high,low,close,volume"]
    for i, t in enumerate(ts):
        if q["close"][i] is None:
            continue
        d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        f = (lambda v: f"{round(v):d}") if krw else (lambda v: f"{v:.2f}")
        rows.append(f"{d},{f(q['open'][i])},{f(q['high'][i])},{f(q['low'][i])},{f(q['close'][i])},{int(q['volume'][i] or 0)}")
    DATA.mkdir(exist_ok=True)
    (DATA / f"{sym}.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    return len(rows) - 1


if __name__ == "__main__":
    def read_list(name):
        f = ROOT / name
        return [s.strip() for s in f.read_text().splitlines() if s.strip() and not s.startswith("#")] if f.exists() else []
    syms = sys.argv[1:] or (read_list("watchlist.txt") + read_list("context.txt"))
    for s in syms:
        try:
            n = fetch(s)
            print(f"{s}: {n} bars")
        except Exception as e:  # 한 종목 실패가 전체를 막지 않게
            print(f"{s}: FAIL {e}")
        time.sleep(1)
