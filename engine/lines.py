"""
lines.py — 바닥코치 P1 선 긋기 엔진
입력: 일봉 CSV (date,open,high,low,close,volume)
출력: 선 8종(dict) + 합류 구간 + 해석 문장(list)

원칙
- 제일 유명한 선만 긋는다 (사람들이 따라가서 스스로 맞는 선)
- 모든 수치는 종가 기준, 기준일 명시
- 문장은 "가능성"으로만, 확률 숫자 없음, 반대 근거 1줄 포함
"""
from __future__ import annotations
import json, math, sys
from dataclasses import dataclass, field, asdict
from pathlib import Path

import pandas as pd
import numpy as np


# ---------------------------------------------------------------- 기본 유틸
def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    # 야후 간혹 거래량 0/비정상 행 → 거래량 평균 계산에서 제외용 플래그
    df["vol_ok"] = df["volume"] > df["volume"].median() * 0.01
    return df


def pct(a: float, b: float) -> float:
    """a 가 b 대비 몇 % 위/아래인지"""
    return (a / b - 1) * 100


def fmt(x: float, krw: bool) -> str:
    return f"{x:,.0f}" if krw else f"{x:.2f}"


# ---------------------------------------------------------------- 스윙 고/저점
def swing_points(df: pd.DataFrame, k: int = 3):
    """좌우 k봉보다 높은 고가 = 스윙 고점, 낮은 저가 = 스윙 저점"""
    hi, lo = df["high"].values, df["low"].values
    n = len(df)
    highs, lows = [], []
    for i in range(k, n - k):
        if hi[i] == max(hi[i - k:i + k + 1]):
            highs.append(i)
        if lo[i] == min(lo[i - k:i + k + 1]):
            lows.append(i)
    return highs, lows


# ---------------------------------------------------------------- 1. 이동평균
def moving_averages(df: pd.DataFrame, windows=(20, 60, 120, 200)):
    out = {}
    c = df["close"]
    for w in windows:
        if len(c) >= w:
            s = c.rolling(w).mean()
            out[f"sma{w}"] = {
                "value": float(s.iloc[-1]),
                "prev": float(s.iloc[-2]),
                "slope5": float(s.iloc[-1] - s.iloc[-6]) if len(c) >= w + 6 else None,
            }
    # 교차 (최근 10봉 내)
    crosses = []
    pairs = [(20, 60), (60, 120), (20, 120)]
    for a, b in pairs:
        ka, kb = f"sma{a}", f"sma{b}"
        if ka in out and kb in out:
            sa, sb = c.rolling(a).mean(), c.rolling(b).mean()
            diff = (sa - sb).dropna()
            if len(diff) > 10:
                recent = diff.iloc[-10:]
                sign = np.sign(recent.values)
                for i in range(1, len(sign)):
                    if sign[i - 1] < 0 <= sign[i]:
                        crosses.append({"pair": f"{a}/{b}", "type": "golden", "bars_ago": len(sign) - 1 - i})
                    if sign[i - 1] > 0 >= sign[i]:
                        crosses.append({"pair": f"{a}/{b}", "type": "dead", "bars_ago": len(sign) - 1 - i})
    # 배열
    vals = [out[k]["value"] for k in ("sma20", "sma60", "sma120") if k in out]
    arrangement = None
    if len(vals) == 3:
        arrangement = "정배열" if vals[0] > vals[1] > vals[2] else "역배열" if vals[0] < vals[1] < vals[2] else "혼조"
    return out, crosses, arrangement


# ---------------------------------------------------------------- 2. 수평 지지·저항 (클러스터 + 매물대)
def horizontal_levels(df: pd.DataFrame, lookback: int = 120, tol: float = 0.012, top_n: int = 4):
    d = df.iloc[-lookback:]
    highs, lows = swing_points(d, 3)
    pts = [(float(d["high"].iloc[i]), "H") for i in highs] + [(float(d["low"].iloc[i]), "L") for i in lows]
    pts.sort()
    clusters = []
    for p, kind in pts:
        if clusters and abs(p / clusters[-1]["price"] - 1) <= tol:
            cl = clusters[-1]
            cl["touches"] += 1
            cl["price"] = (cl["price"] * (cl["touches"] - 1) + p) / cl["touches"]
            cl["kinds"].append(kind)
        else:
            clusters.append({"price": p, "touches": 1, "kinds": [kind]})
    clusters = [c for c in clusters if c["touches"] >= 2]
    # 매물대: 거래량 가중 가격대 (20 bins)
    lo, hi = d["low"].min(), d["high"].max()
    bins = np.linspace(lo, hi, 21)
    vol_profile = np.zeros(20)
    for _, r in d.iterrows():
        if not r["vol_ok"]:
            continue
        idx = np.clip(np.searchsorted(bins, r["close"]) - 1, 0, 19)
        vol_profile[idx] += r["volume"]
    top_bins = np.argsort(vol_profile)[-3:]
    vol_zones = [{"low": float(bins[i]), "high": float(bins[i + 1]), "share": float(vol_profile[i] / vol_profile.sum())} for i in sorted(top_bins)]
    clusters.sort(key=lambda c: -c["touches"])
    return clusters[:top_n], vol_zones


# ---------------------------------------------------------------- 3. 추세선 (스윙 고점 상단 / 저점 하단)
def trendlines(df: pd.DataFrame, lookback: int = 45, recent_bars: int = 20):
    """최근 lookback봉의 스윙 고점/저점으로 상단·하단 추세선.
    - 선은 x1 이후의 모든 스윙점을 '덮어야' 함 (헐)
    - 두 번째 점 x2 는 최근 recent_bars 안에 있어야 함 (옛날 선 배제)
    """
    d = df.iloc[-lookback:].reset_index(drop=True)
    highs, lows = swing_points(d, 2)
    n = len(d)

    def best_line(idx, vals, upper: bool):
        best = None
        for i in range(len(idx)):
            for j in range(i + 1, len(idx)):
                x1, x2 = idx[i], idx[j]
                y1, y2 = vals[i], vals[j]
                if x2 - x1 < 4 or x2 < n - recent_bars:
                    continue
                slope = (y2 - y1) / (x2 - x1)
                ok, touches = True, 0
                for xk, yk in zip(idx, vals):
                    if xk < x1:
                        continue
                    ly = y1 + slope * (xk - x1)
                    if upper and yk > ly * 1.004:
                        ok = False; break
                    if not upper and yk < ly * 0.996:
                        ok = False; break
                    if abs(yk / ly - 1) <= 0.006:
                        touches += 1
                if ok and (best is None or touches > best["touches"] or (touches == best["touches"] and x2 > best["x2"])):
                    best = {"x1": x1, "x2": x2, "y1": y1, "slope": slope, "touches": touches}
        if best is None:
            return None
        today = n - 1
        val_today = best["y1"] + best["slope"] * (today - best["x1"])
        return {
            "from": str(d["date"].iloc[best["x1"]].date()),
            "to": str(d["date"].iloc[best["x2"]].date()),
            "slope_per_bar": float(best["slope"]),
            "slope_pct_per_bar": float(best["slope"] / best["y1"] * 100),
            "value_today": float(val_today),
            "touches": int(best["touches"]),
        }

    upper = best_line(highs, [float(d["high"].iloc[i]) for i in highs], upper=True) if len(highs) >= 2 else None
    lower = best_line(lows, [float(d["low"].iloc[i]) for i in lows], upper=False) if len(lows) >= 2 else None
    return upper, lower



def hull_from_last_swing(df: pd.DataFrame, upper: bool, lookback: int = 60, k: int = 3):
    """마지막 주요 스윙 고점(저점)에서 시작해 이후 모든 고가(저가)를 덮는 선.
    급락/급등 구간처럼 스윙점이 1개뿐일 때 쓰는 '현재 추세선'."""
    d = df.iloc[-lookback:].reset_index(drop=True)
    n = len(d)
    highs, lows = swing_points(d, k)
    pts = highs if upper else lows
    pts = [i for i in pts if n - 1 - i >= 5]
    if not pts:
        return None
    x1 = pts[-1]
    col = "high" if upper else "low"
    y = d[col].values
    y1 = float(y[x1])
    best = None
    for x2 in range(x1 + 3, n):
        slope = (y[x2] - y1) / (x2 - x1)
        ok, touches = True, 0
        for xk in range(x1 + 1, n):
            ly = y1 + slope * (xk - x1)
            if upper and y[xk] > ly * 1.004: ok = False; break
            if not upper and y[xk] < ly * 0.996: ok = False; break
            if abs(y[xk] / ly - 1) <= 0.006: touches += 1
        if ok and (best is None or touches > best["touches"] or (touches == best["touches"] and x2 > best["x2"])):
            best = {"x2": x2, "slope": slope, "touches": touches}
    if best is None:
        return None
    val_today = y1 + best["slope"] * (n - 1 - x1)
    return {"from": str(d["date"].iloc[x1].date()), "to": str(d["date"].iloc[best["x2"]].date()),
            "slope_per_bar": float(best["slope"]), "slope_pct_per_bar": float(best["slope"] / y1 * 100),
            "value_today": float(val_today), "touches": int(best["touches"]) + 1, "method": "hull"}


def hull_from_turning_points(df: pd.DataFrame, upper: bool, close: float, lookback: int = 60, min_after: int = 5, tol: float = 0.15):
    """가장 최근의 '꺾인 점'(이후 2봉보다 높은 고가 / 낮은 저가)부터 시작하는 헐 선 중
    오늘 값이 현재가 ±tol 안에 들어오는 첫 선."""
    d = df.iloc[-lookback:].reset_index(drop=True)
    n = len(d)
    col = "high" if upper else "low"
    y = d[col].values
    starts = []
    for i in range(1, n - min_after):
        nxt = y[i + 1:i + 3]
        if upper and y[i] > nxt.max():
            starts.append(i)
        if not upper and y[i] < nxt.min():
            starts.append(i)
    for x1 in reversed(starts):
        y1 = float(y[x1]); best = None
        for x2 in range(x1 + 2, n):
            slope = (y[x2] - y1) / (x2 - x1)
            ok, touches = True, 0
            for xk in range(x1 + 1, n):
                ly = y1 + slope * (xk - x1)
                if upper and y[xk] > ly * 1.004: ok = False; break
                if not upper and y[xk] < ly * 0.996: ok = False; break
                if abs(y[xk] / ly - 1) <= 0.006: touches += 1
            if ok and (best is None or touches > best["touches"] or (touches == best["touches"] and x2 > best["x2"])):
                best = {"x2": x2, "slope": slope, "touches": touches}
        if best is None:
            continue
        val_today = y1 + best["slope"] * (n - 1 - x1)
        if abs(val_today / close - 1) <= tol:
            return {"from": str(d["date"].iloc[x1].date()), "to": str(d["date"].iloc[best["x2"]].date()),
                    "slope_per_bar": float(best["slope"]), "slope_pct_per_bar": float(best["slope"] / y1 * 100),
                    "value_today": float(val_today), "touches": int(best["touches"]) + 1, "method": "turning"}
    return None

# ---------------------------------------------------------------- 4. 박스 / 수렴 패턴
def pattern(df: pd.DataFrame, upper, lower, levels):
    close = float(df["close"].iloc[-1])
    out = {"type": None}
    inside = upper and lower and lower["value_today"] * 0.97 <= close <= upper["value_today"] * 1.03
    if inside:
        su, sl = upper["slope_per_bar"], lower["slope_per_bar"]
        gap = upper["value_today"] - lower["value_today"]
        if gap > 0:
            # 수렴: 상단 내려오고 하단 올라오거나, 둘이 같은 방향인데 간격 줄어듦
            closing_rate = su - sl  # 음수면 좁아지는 중
            if closing_rate < 0:
                bars_to_apex = gap / (-closing_rate)
                if su < 0 and sl > 0:
                    out = {"type": "삼각수렴", "bars_to_apex": round(bars_to_apex)}
                elif su < 0 and sl < 0:
                    out = {"type": "하락쐐기", "bars_to_apex": round(bars_to_apex)}
                elif su > 0 and sl > 0:
                    out = {"type": "상승쐐기", "bars_to_apex": round(bars_to_apex)}
                out["upper_today"], out["lower_today"] = upper["value_today"], lower["value_today"]
    # 박스: 최근 15봉 종가가 지지/저항 두 레벨 사이에서 머묾
    if out["type"] is None and len(levels) >= 2:
        recent = df["close"].iloc[-15:]
        lv = sorted([l["price"] for l in levels])
        for i in range(len(lv) - 1):
            lo, hi = lv[i], lv[i + 1]
            if (recent.between(lo * 0.985, hi * 1.015)).all() and hi / lo - 1 < 0.12:
                out = {"type": "박스", "box_low": lo, "box_high": hi, "bars": 15}
    return out


# ---------------------------------------------------------------- 5. 전고·전저·52주
def key_levels(df: pd.DataFrame):
    close = float(df["close"].iloc[-1])
    y = df.iloc[-250:]
    highs, lows = swing_points(df.iloc[-60:], 3)
    d60 = df.iloc[-60:].reset_index(drop=True)
    prev_high = float(d60["high"].iloc[highs[-1]]) if highs else None
    prev_low = float(d60["low"].iloc[lows[-1]]) if lows else None
    return {
        "prev_swing_high": prev_high,
        "prev_swing_low": prev_low,
        "recent_low10": float(df["low"].iloc[-10:].min()),
        "recent_low10_date": str(df.loc[df["low"].iloc[-10:].idxmin(), "date"].date()),
        "w52_high": float(y["high"].max()),
        "w52_low": float(y["low"].min()),
        "all_low": float(df["low"].min()),
        "all_high": float(df["high"].max()),
    }


# ---------------------------------------------------------------- 6. 피보나치
def fibonacci(df: pd.DataFrame, lookback: int = 120):
    d = df.iloc[-lookback:]
    hi_i, lo_i = d["high"].idxmax(), d["low"].idxmin()
    hi, lo = float(d["high"].max()), float(d["low"].min())
    rng = hi - lo
    direction = "down" if hi_i < lo_i else "up"  # 고점이 먼저면 하락 스윙
    if direction == "up":
        levels = {k: hi - rng * k for k in (0.382, 0.5, 0.618)}
    else:
        levels = {k: lo + rng * k for k in (0.382, 0.5, 0.618)}
    return {"swing_high": hi, "swing_low": lo, "direction": direction,
            "swing_high_date": str(d.loc[hi_i, "date"].date()), "swing_low_date": str(d.loc[lo_i, "date"].date()),
            "levels": {f"{int(k*1000)/10}%": float(v) for k, v in levels.items()}}


# ---------------------------------------------------------------- 7. 볼린저
def bollinger(df: pd.DataFrame, w: int = 20, k: float = 2.0):
    c = df["close"]
    m, s = c.rolling(w).mean(), c.rolling(w).std()
    up, lo = m + k * s, m - k * s
    width = (up - lo) / m
    return {
        "mid": float(m.iloc[-1]), "upper": float(up.iloc[-1]), "lower": float(lo.iloc[-1]),
        "width": float(width.iloc[-1]),
        "width_pct_rank_60": float((width.iloc[-60:] < width.iloc[-1]).mean()),  # 0 = 60일 중 최저 폭
        "close_vs": "above" if c.iloc[-1] > up.iloc[-1] else "below" if c.iloc[-1] < lo.iloc[-1] else "inside",
    }


# ---------------------------------------------------------------- 8. RSI · 거래량
def rsi_volume(df: pd.DataFrame, n: int = 14):
    c = df["close"]
    delta = c.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = gain / loss
    rsi = 100 - 100 / (1 + rs)
    v = df.loc[df["vol_ok"], "volume"]
    vol_ratio = float(df["volume"].iloc[-1] / v.iloc[-21:-1].mean())
    chg = float(pct(c.iloc[-1], c.iloc[-2]))
    return {"rsi": float(rsi.iloc[-1]), "rsi_prev": float(rsi.iloc[-2]), "vol_ratio": vol_ratio, "chg_pct": chg}


# ---------------------------------------------------------------- 합류 구간
def confluence(close: float, items: list[tuple[str, float]], tol: float = 0.02):
    """현재가 ±tol 안에 있는 선들을 모음"""
    near = [(name, v) for name, v in items if v and abs(v / close - 1) <= tol]
    # 가격대 묶기 (±1%)
    near.sort(key=lambda x: x[1])
    groups = []
    for name, v in near:
        if groups and abs(v / groups[-1]["price"] - 1) <= 0.01:
            groups[-1]["lines"].append(name)
            groups[-1]["price"] = np.mean([groups[-1]["price"], v])
        else:
            groups.append({"price": v, "lines": [name]})
    groups = [g for g in groups if len(g["lines"]) >= 2]
    return groups


# ---------------------------------------------------------------- 메인 분석
def analyze(path: str, symbol: str | None = None) -> dict:
    df = load_csv(path)
    symbol = symbol or Path(path).stem
    krw = symbol.endswith(".KS") or symbol.endswith(".KQ")
    close = float(df["close"].iloc[-1])
    asof = str(df["date"].iloc[-1].date())
    f = lambda x: fmt(x, krw)

    mas, crosses, arr = moving_averages(df)
    levels, vol_zones = horizontal_levels(df)
    upper, lower = trendlines(df)
    def near(l): return l is not None and abs(l["value_today"] / close - 1) <= 0.15
    for side in ("upper", "lower"):
        cur = upper if side == "upper" else lower
        if not near(cur):
            cur = hull_from_turning_points(df, upper=(side == "upper"), close=close) or cur
        if not near(cur):
            for k in (3, 2, 1):
                cand_l = hull_from_last_swing(df, upper=(side == "upper"), k=k)
                if near(cand_l):
                    cur = cand_l; break
            else:
                cur = cur or hull_from_last_swing(df, upper=(side == "upper"), k=3)
        if side == "upper": upper = cur
        else: lower = cur
    pat = pattern(df, upper, lower, levels)
    keys = key_levels(df)
    fib = fibonacci(df)
    bb = bollinger(df)
    rv = rsi_volume(df)

    # 합류 후보 모음
    cand = [(f"{k.upper()}", v["value"]) for k, v in mas.items()]
    cand += [(f"수평 {'지지' if l['price'] < close else '저항'}({l['touches']}회)", l["price"]) for l in levels]
    if upper: cand.append(("하락 추세선" if upper["slope_per_bar"] < 0 else "상단 추세선", upper["value_today"]))
    if lower: cand.append(("상승 추세선" if lower["slope_per_bar"] > 0 else "하단 추세선", lower["value_today"]))
    cand += [(f"피보 {k}", v) for k, v in fib["levels"].items()]
    cand += [("전저점", keys["prev_swing_low"]), ("전고점", keys["prev_swing_high"]), ("52주 저점", keys["w52_low"]), ("최근 저가", keys["recent_low10"])]
    cand += [("볼린저 하단", bb["lower"]), ("볼린저 중심", bb["mid"])]
    conf = confluence(close, cand)

    # ---------------- 문장
    S = []
    # 위치 요약
    above = [k for k, v in mas.items() if close > v["value"]]
    below = [k for k, v in mas.items() if close <= v["value"]]
    S.append(f"[{asof} 종가 {f(close)}] 이동평균 {len(above)}/{len(mas)}개 위. "
             + (f"{arr}. " if arr else "")
             + (f"최근 {crosses[-1]['pair']} {'골든' if crosses[-1]['type']=='golden' else '데드'}크로스({crosses[-1]['bars_ago']}봉 전). " if crosses else "")
             + ("20·60·120일선 전부 아래 — 교과서적 하락 추세." if len(above) == 0 and len(mas) >= 3 else ""))
    # 지지/저항
    sup = [l for l in levels if l["price"] < close]
    res = [l for l in levels if l["price"] >= close]
    if sup:
        s0 = max(sup, key=lambda l: l["price"])
        S.append(f"가장 가까운 수평 지지 {f(s0['price'])} ({s0['touches']}회 반응, {pct(close, s0['price']):+.1f}% 위). 깨지면 다음은 {f(keys['w52_low'])}(52주 저점).")
    else:
        rl = keys["recent_low10"]
        S.append(f"여러 번 반응한 수평 지지는 없음. 1차 기준은 최근 저가 {f(rl)}({keys['recent_low10_date']}, {pct(close, rl):+.1f}% 위)"
                 + (f", 그 아래 52주 저점 {f(keys['w52_low'])}." if rl * 0.75 < keys["w52_low"] < rl * 0.98 else " = 52주 저점. 깨지면 신저가라 아래 기준선 없음." if keys["w52_low"] >= rl * 0.98 else ". 그 아래는 1년 내 기준선이 멀어 올해 상승분 되돌림 구간(피보나치 참고)."))
    if res:
        r0 = min(res, key=lambda l: l["price"])
        S.append(f"가장 가까운 저항 {f(r0['price'])} ({r0['touches']}회, {pct(r0['price'], close):+.1f}% 위).")
    # 추세선
    if upper:
        S.append(f"{'하락' if upper['slope_per_bar']<0 else '상단'} 추세선 {upper['from']}→{upper['to']} ({upper['touches']}터치, 봉당 {upper['slope_pct_per_bar']:+.1f}%), 오늘 값 {f(upper['value_today'])}({pct(upper['value_today'], close):+.1f}%). "
                 f"종가로 넘으면 추세 전환 1차 신호.")
    if lower:
        S.append(f"{'상승' if lower['slope_per_bar']>0 else '하단'} 추세선 {lower['from']}→{lower['to']}, 오늘 값 {f(lower['value_today'])}"
                 + (" — 현재가가 이미 아래(이탈)." if close < lower["value_today"] * 0.995 else "."))
    # 패턴
    if pat["type"] in ("삼각수렴", "하락쐐기", "상승쐐기"):
        S.append(f"{pat['type']} 진행 중 (상단 {f(pat['upper_today'])} / 하단 {f(pat['lower_today'])}), 꼭짓점까지 약 {pat['bars_to_apex']}봉. "
                 f"→ 수렴 끝까지 횡보 가능성, 그 뒤 방향 결정 구간.")
    elif pat["type"] == "박스":
        S.append(f"박스권 {f(pat['box_low'])}~{f(pat['box_high'])} {pat['bars']}봉째. 박스 안에서는 횡보 가능성 높고, 상·하단 종가 이탈이 신호.")
    # 피보
    fl = fib["levels"]
    if fib["direction"] == "up":
        S.append(f"피보나치(상승 스윙 {fib['swing_low_date']}→{fib['swing_high_date']}의 되돌림): 38.2% {f(fl['38.2%'])} · 50% {f(fl['50.0%'])} · 61.8% {f(fl['61.8%'])}. "
                 + ("61.8% 아래 — 되돌림이 깊어 상승 추세 자체가 의심되는 구간." if close < fl["61.8%"] else ""))
    else:
        S.append(f"피보나치(하락 스윙 {fib['swing_high_date']}→{fib['swing_low_date']}의 반등 목표): 38.2% {f(fl['38.2%'])} · 50% {f(fl['50.0%'])} · 61.8% {f(fl['61.8%'])}. "
                 f"반등해도 38.2%({f(fl['38.2%'])}) 전까진 '하락 중 반등'으로 봄.")
    # 볼린저
    if bb["width_pct_rank_60"] <= 0.1:
        S.append(f"볼린저 폭이 60일 중 최저 수준(스퀴즈) → 곧 큰 움직임 가능성, 방향은 추세선·패턴 기준.")
    if bb["close_vs"] == "below":
        S.append(f"종가가 볼린저 하단({f(bb['lower'])}) 밖 — 단기 과매도 반등 가능성과 추세 하락 지속이 충돌하는 자리.")
    # RSI/거래량
    tone = "투매(거래량 동반)" if rv["chg_pct"] < -3 and rv["vol_ratio"] > 1.8 else "매수 부재(거래량 없이 하락)" if rv["chg_pct"] < 0 and rv["vol_ratio"] < 0.7 else None
    S.append(f"RSI {rv['rsi']:.0f}" + (" 과매도" if rv["rsi"] < 30 else " 과매수" if rv["rsi"] > 70 else "")
             + f" · 거래량 20일 평균의 {rv['vol_ratio']:.1f}×" + (f" → {tone}" if tone else "") + ".")
    # 합류
    if conf:
        for g in conf:
            S.append(f"★ 합류 구간 {f(g['price'])} ({pct(g['price'], close):+.1f}%): " + " + ".join(g["lines"])
                     + " — 유명한 선 여러 개가 겹치는 자리라 여기서 멈추거나 반응할 가능성이 높음.")
    else:
        S.append("현재가 ±2% 안에 겹치는 유명한 선 없음 — 기준선 사이 '빈 공간'. 다음 선까지 미끄러질 수 있음.")
    # 반대 근거 (필수 1줄)
    counter = []
    if rv["rsi"] < 30: counter.append("RSI 과매도는 하락 추세에서 며칠씩 유지될 수 있음")
    if len(above) == 0: counter.append("모든 이평선 아래에서는 지지선이 자주 '잠깐' 반응하고 깨짐")
    if rv["vol_ratio"] < 0.7: counter.append("거래량 없는 반등은 되돌림이 빠름")
    S.append("반대 근거: " + ("; ".join(counter) if counter else "추세 추종 입장에선 아직 반등 확인 전") + ".")

    return {
        "symbol": symbol, "asof": asof, "close": close, "krw": krw,
        "ma": mas, "ma_crosses": crosses, "ma_arrangement": arr,
        "levels": levels, "volume_zones": vol_zones,
        "trend_upper": upper, "trend_lower": lower, "pattern": pat,
        "keys": keys, "fib": fib, "bollinger": bb, "rsi_volume": rv,
        "confluence": conf, "sentences": S,
    }


if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = analyze(p)
        print("=" * 72)
        print(r["symbol"], r["asof"], r["close"])
        for s in r["sentences"]:
            print(" -", s)
        Path("out").mkdir(exist_ok=True)
        Path(f"out/{r['symbol']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
