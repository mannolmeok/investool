"""fetch.py — 야후 파이낸스 일봉 1년치 → data/<SYMBOL>.csv
사용: python engine/fetch.py            (watchlist.txt 전체)
      python engine/fetch.py INFQ 005930.KS
국내는 야후 심볼 규칙: 코스피 .KS / 코스닥 .KQ
"""
import sys, json, time, statistics
from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.request, urllib.parse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
URL = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
H5 = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=60m&range=5d"
UA = {"User-Agent": "Mozilla/5.0 (investool daily batch)"}
KST = timezone(timedelta(hours=9))
# 야후 국내 시세는 20분 지연 → 마감 직후 25분 안에는 마지막 봉이 아직 확정 종가가 아닐 수 있음
# (10/20 15:40 실행: 삼성전자 210,750 → 15:53 실행: 확정 211,500)
DELAY = 25 * 60
FILLED = []  # 이번 실행에서 직접 만든 국내 일봉 (배치 끝에 한 줄 알림)


def _chart(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        return json.load(r)["chart"]["result"][0]


def kr_missing_day(meta, have, now=None):
    """야후는 한국 시간 자정이 지나면 그날 국내 일봉을 빼 두었다가 다음 날 아침(7~8시쯤) 확정본을 다시 넣는다.
    (git 기록: 21:15 · 23:29 · 23:42 실행엔 그날 봉 있음 / 00:34 · 00:44 · 01:21 · 02:26 실행엔 없음 / 07:52 이후 다시 있음)
    그 사이 배치가 돌면 국내 판단이 하루 밀린다 → 마지막 거래일이 빠졌으면 그 날짜를 돌려준다.  have: {날짜: 거래량}"""
    rt = meta.get("regularMarketTime")
    if not rt:
        return None
    t0 = datetime.fromtimestamp(rt, KST)
    day = t0.strftime("%Y-%m-%d")
    if day in have or (have and day < max(have)):
        return None
    if (now or datetime.now(KST)) < t0.replace(hour=17, minute=0, second=0, microsecond=0):  # 마감(15:30, 수능날 16:30) + 지연 여유
        return None
    return day


def kr_bar(day, meta, hourly, have):
    """빠진 국내 일봉 만들기 — 종가·고가·저가·거래량 = meta(마지막 거래일 값), 시가 = 그날 첫 1시간봉.
    meta 가 비면 1시간봉으로 (1시간봉엔 동시호가 거래량이 빠져 합이 일봉의 약 78% → 최근 며칠 일봉÷1시간봉 비율로 보정).
    다음 배치에서 야후 확정본이 오면 같은 날짜로 그대로 덮어쓴다.  반환 (o, h, l, c, v, 거래량 출처) | None"""
    q, ts = hourly["indicators"]["quote"][0], hourly.get("timestamp") or []
    by = {}
    for i, t in enumerate(ts):
        c = q["close"][i]
        if not c or c <= 0:
            continue
        d = datetime.fromtimestamp(t, KST).strftime("%Y-%m-%d")
        by.setdefault(d, []).append((q["open"][i] or c, q["high"][i] or c, q["low"][i] or c, c, q["volume"][i] or 0))
    bars = by.get(day)
    if not bars:
        return None
    o = bars[0][0]
    c = meta.get("regularMarketPrice") or bars[-1][3]
    h = max(meta.get("regularMarketDayHigh") or 0, max(b[1] for b in bars), o, c)
    lows = [x for x in (meta.get("regularMarketDayLow"),) if x and x > 0] + [b[2] for b in bars]
    l = min(lows + [o, c])
    hv = sum(b[4] for b in bars)
    mv = meta.get("regularMarketVolume") or 0
    if mv and mv >= hv:
        return o, h, l, c, int(mv), "meta"
    rs = [have[d] / s for d, bb in by.items() if d != day and len(bb) >= 6 and have.get(d) and (s := sum(b[4] for b in bb)) > 0]  # 온전한 날만
    return o, h, l, c, int(round(hv * (statistics.median(rs) if rs else 1.28))), "추정"


def fetch(sym: str) -> int:
    res = _chart(URL.format(sym=urllib.parse.quote(sym)))
    q = res["indicators"]["quote"][0]
    ts = res.get("timestamp") or []
    # 장중이면 마지막 봉은 아직 '종가'가 아님 → 버린다 (종가 기준 원칙). 마감 직후 지연 구간도 같이
    meta = res.get("meta", {})
    reg = (meta.get("currentTradingPeriod") or {}).get("regular") or {}
    now = int(time.time())
    if ts and reg and reg.get("start", 0) <= now < reg.get("end", 0) + DELAY and ts[-1] >= reg.get("start", 0):
        ts = ts[:-1]
        for k in q: q[k] = q[k][:-1]
        print(f"{sym}: 장중(또는 마감 직후 지연 구간) → 마지막 봉 제외")
    krw = sym.endswith((".KS", ".KQ"))
    fm = (lambda v: f"{round(v):d}") if krw else (lambda v: f"{v:.2f}")
    rows = ["date,open,high,low,close,volume"]
    for i, t in enumerate(ts):
        if q["close"][i] is None:
            continue
        d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        rows.append(f"{d},{fm(q['open'][i])},{fm(q['high'][i])},{fm(q['low'][i])},{fm(q['close'][i])},{int(q['volume'][i] or 0)}")
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
    # 국내(지수 포함): 자정~아침 사이엔 야후가 마지막 거래일 일봉을 빼 둠 → 직접 만들어 붙인다
    if krw or meta.get("exchangeTimezoneName") == "Asia/Seoul":
        try:
            have = {l.split(",")[0]: float(l.split(",")[5]) for l in rows[1:]}
            day = kr_missing_day(meta, have)
            b = day and kr_bar(day, meta, _chart(H5.format(sym=urllib.parse.quote(sym))), have)
            if b:
                o, h, l, c, v, src = b
                rows.append(f"{day},{fm(o)},{fm(h)},{fm(l)},{fm(c)},{v}")
                FILLED.append(f"{sym} {day} 종가 {fm(c)} · 거래량 {v:,} ({src})")
                print(f"{sym}: 야후 일봉에 {day} 없음 → 직접 만듦 (종가 {fm(c)}, 거래량 {src})")
        except Exception as e:  # 보충 실패가 원래 수집을 막지 않게
            print(f"{sym}: 국내 일봉 보충 실패 {e!r}"[:160])
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
        if q["close"][i] is None or q["open"][i] is None or not q["close"][i] or q["close"][i] <= 0:
            continue
        # 야후가 진행 중인 봉에 시가·고가·저가 0을 보내는 경우 → 종가로 메움
        for kk in ("open", "high", "low"):
            if not q[kk][i] or q[kk][i] <= 0:
                q[kk][i] = q["close"][i]
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
    if FILLED:  # GitHub 실행 화면(요약)에 한 줄로 — 다음 날 아침 야후 확정본과 비교용
        print(f"::notice title=국내 일봉 직접 만듦 {len(FILLED)}종목::" + "%0A".join(FILLED))
