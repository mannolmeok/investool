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
    # 장중이면 마지막 봉은 아직 '종가'가 아님 → 버린다 (종가 기준 원칙)
    meta = res.get("meta", {})
    reg = (meta.get("currentTradingPeriod") or {}).get("regular") or {}
    now = int(time.time())
    if ts and reg and reg.get("start", 0) <= now < reg.get("end", 0) and ts[-1] >= reg.get("start", 0):
        ts = ts[:-1]
        for k in q: q[k] = q[k][:-1]
        print(f"{sym}: 장중 → 마지막 봉 제외")
    krw = sym.endswith((".KS", ".KQ"))
    rows = ["date,open,high,low,close,volume"]
    for i, t in enumerate(ts):
        if q["close"][i] is None:
            continue
        d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        f = (lambda v: f"{round(v):d}") if krw else (lambda v: f"{v:.2f}")
        rows.append(f"{d},{f(q['open'][i])},{f(q['high'][i])},{f(q['low'][i])},{f(q['close'][i])},{int(q['volume'][i] or 0)}")
    DATA.mkdir(exist_ok=True)
    f = DATA / f"{sym}.csv"
    # 야후가 가끔 최근 봉을 빠뜨린 채 응답 → 기존 파일의 더 최신 봉은 지우지 않고 합친다 (날짜 기준, 같은 날은 새 값)
    if f.exists():
        old = {l.split(",", 1)[0]: l for l in f.read_text(encoding="utf-8").splitlines()[1:] if l}
        new = {l.split(",", 1)[0]: l for l in rows[1:]}
        if new and old and max(old) > max(new):
            print(f"{sym}: 응답 최신 {max(new)} < 기존 {max(old)} → 기존 최신 봉 유지")
        if new:
            merged = {d: l for d, l in old.items() if d >= min(new)}
            merged.update(new)
        else:
            merged = old
        # 1년 창 유지: 새 응답 범위 + 그 이후 기존 봉
        rows = [rows[0]] + [merged[d] for d in sorted(merged)]
    f.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return len(rows) - 1


TF = {"w": ("1wk", "5y"), "m": ("1mo", "max"), "h": ("60m", "60d")}


def fetch_tf(sym: str, tf: str) -> int:
    """주봉(w)·월봉(m)·1시간봉(h) → data/<sym>.<tf>.csv  (진행 중인 봉 포함 — 차트·큰 그림용, 판단은 일봉 종가)"""
    interval, rng = TF[tf]
    u = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval={interval}&range={rng}"
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        res = json.load(r)["chart"]["result"][0]
    q, ts = res["indicators"]["quote"][0], res.get("timestamp") or []
    krw = sym.endswith((".KS", ".KQ"))
    f = (lambda v: f"{round(v):d}") if krw else (lambda v: f"{v:.2f}")
    rows, seen = ["date,open,high,low,close,volume"], set()
    for i, t in enumerate(ts):
        if q["close"][i] is None or q["open"][i] is None:
            continue
        if tf == "h":
            d = str(int(t))  # 유닉스 초 (차트에서 시간축)
        else:
            d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        if d in seen:
            rows[-1] = f"{d},{f(q['open'][i])},{f(q['high'][i])},{f(q['low'][i])},{f(q['close'][i])},{int(q['volume'][i] or 0)}"; continue
        seen.add(d)
        rows.append(f"{d},{f(q['open'][i])},{f(q['high'][i])},{f(q['low'][i])},{f(q['close'][i])},{int(q['volume'][i] or 0)}")
    # 야후가 신규 상장 종목에 1wk/1mo 대신 일봉을 주는 경우가 있음 → 직접 주·월 단위로 묶는다
    if tf in ("w", "m") and len(rows) > 1:
        from datetime import date as _d
        buckets = {}
        for l in rows[1:]:
            d, o, h, lo, c, v = l.split(",")
            y, mo, da = map(int, d.split("-"))
            k = (_d(y, mo, da) - __import__("datetime").timedelta(days=_d(y, mo, da).weekday())).isoformat() if tf == "w" else f"{y:04d}-{mo:02d}-01"
            b = buckets.get(k)
            if b is None:
                buckets[k] = [k, float(o), float(h), float(lo), float(c), int(v)]
            else:
                b[2] = max(b[2], float(h)); b[3] = min(b[3], float(lo)); b[4] = float(c); b[5] += int(v)
        rows = ["date,open,high,low,close,volume"] + [f"{b[0]},{f(b[1])},{f(b[2])},{f(b[3])},{f(b[4])},{b[5]}" for k, b in sorted(buckets.items())]
    if len(rows) > 3:
        (DATA / f"{sym}.{tf}.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
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
    # 관심 종목만: 주봉·월봉·1시간봉
    for s in (sys.argv[1:] or read_list("watchlist.txt")):
        for tf in TF:
            try:
                print(f"{s}.{tf}: {fetch_tf(s, tf)} bars")
            except Exception as e:
                print(f"{s}.{tf}: FAIL {e}")
            time.sleep(0.5)
