"""backtest.py — 선 엔진 워크포워드 검증
매 거래일 t 에 대해 df[:t+1] 로 analyze → 그날 나온 선/합류/신호가 다음 5일에 어떻게 됐는지 집계.
결과: out/validation.md, out/validation.json

검증 항목
1. 합류 지지 (현재가 아래 5% 이내 ★합류): 5일 내 터치율 / 터치 후 반응(+2% 반등)율 / 이탈(-2% 종가)율
   - 비교군: 같은 날 "현재가 -3% 가상 지지선" (아무 근거 없는 선)
2. 단일 수평 지지(2회 이상 반응): 같은 지표
3. 하락 추세선 종가 돌파 다음날 → 5일 수익률 vs 전체 평균
4. RSI<30 → 5일 수익률 vs 전체
5. 빈 공간(겹치는 선 없음) vs 합류 근접 → 5일 최대 낙폭(MDD) 비교
"""
import json, sys, warnings
from pathlib import Path
import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from lines import load_csv, analyze_df
warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
H = 5  # forward horizon


def fwd_stats(df, t, level=None):
    """t 이후 H일: 수익률, 최대낙폭, (level 있으면) 터치/반응/이탈"""
    c0 = df["close"].iloc[t]
    seg = df.iloc[t + 1:t + 1 + H]
    if len(seg) < H:
        return None
    ret = seg["close"].iloc[-1] / c0 - 1
    mdd = seg["low"].min() / c0 - 1
    out = {"ret": ret, "mdd": mdd}
    if level:
        touched = (seg["low"] <= level * 1.01).any()
        out["touch"] = bool(touched)
        if touched:
            i = int(np.argmax((seg["low"] <= level * 1.01).values))
            after = seg.iloc[i:]
            out["react"] = bool((after["close"].max() >= level * 1.02))
            out["break"] = bool((after["close"] <= level * 0.98).any())
        else:
            out["react"] = out["break"] = None
    return out


def run(sym):
    df = load_csv(ROOT / "data" / f"{sym}.csv")
    n = len(df)
    rows = []
    for t in range(60, n - H):
        sub = df.iloc[:t + 1].reset_index(drop=True)
        try:
            r = analyze_df(sub, sym)
        except Exception as e:
            continue
        close = r["close"]
        rec = {"t": str(sub["date"].iloc[-1].date()), "close": close, "rsi": r["rsi_volume"]["rsi"],
               "conf_below": None, "level_below": None, "tl": r["trend_upper"]["value_today"] if r["trend_upper"] else None,
               "pattern": (r["pattern"] or {}).get("type")}
        # 합류 지지: 아래 5% 이내 중 가장 가까운
        cb = [g for g in r["confluence"] if g["price"] < close and g["price"] >= close * 0.95]
        if cb:
            rec["conf_below"] = max(cb, key=lambda g: g["price"])["price"]
        lb = [l for l in r["levels"] if l["price"] < close and l["price"] >= close * 0.95]
        if lb:
            rec["level_below"] = max(lb, key=lambda l: l["price"])["price"]
        base = fwd_stats(df, t)
        rec.update({"fwd_ret": base["ret"], "fwd_mdd": base["mdd"]})
        rec["conf_test"] = fwd_stats(df, t, rec["conf_below"]) if rec["conf_below"] else None
        rec["level_test"] = fwd_stats(df, t, rec["level_below"]) if rec["level_below"] else None
        rec["dummy_test"] = fwd_stats(df, t, close * 0.97)
        # 추세선 돌파: 다음날 종가 > 오늘 추세선 값 (근사)
        if rec["tl"] and t + 1 < n:
            rec["tl_break"] = bool(df["close"].iloc[t + 1] > rec["tl"]) and close <= rec["tl"]
            rec["tl_fwd_ret"] = df["close"].iloc[min(t + 1 + H, n - 1)] / df["close"].iloc[t + 1] - 1
        else:
            rec["tl_break"] = None
        rows.append(rec)
    return rows


def rate(xs):
    xs = [x for x in xs if x is not None]
    return (sum(xs) / len(xs), len(xs)) if xs else (None, 0)


def summarize(sym, rows):
    s = {"symbol": sym, "days": len(rows)}
    def test_block(key):
        ts = [r[key] for r in rows if r.get(key)]
        touch, n = rate([x["touch"] for x in ts])
        react, nt = rate([x["react"] for x in ts if x["touch"]])
        brk, _ = rate([x["break"] for x in ts if x["touch"]])
        return {"n": n, "touch": touch, "react_given_touch": react, "break_given_touch": brk, "n_touch": nt}
    s["confluence"] = test_block("conf_test")
    s["single_level"] = test_block("level_test")
    s["dummy_3pct"] = test_block("dummy_test")
    all_ret = [r["fwd_ret"] for r in rows]
    s["base_fwd_ret"] = float(np.mean(all_ret)); s["base_fwd_mdd"] = float(np.mean([r["fwd_mdd"] for r in rows]))
    tb = [r["tl_fwd_ret"] for r in rows if r.get("tl_break")]
    s["tl_break"] = {"n": len(tb), "fwd_ret": float(np.mean(tb)) if tb else None, "win": float(np.mean([x > 0 for x in tb])) if tb else None}
    rsi = [r["fwd_ret"] for r in rows if r["rsi"] < 30]
    s["rsi_lt30"] = {"n": len(rsi), "fwd_ret": float(np.mean(rsi)) if rsi else None, "win": float(np.mean([x > 0 for x in rsi])) if rsi else None}
    near = [r for r in rows if r["conf_below"]]; empty = [r for r in rows if not r["conf_below"] and not r["level_below"]]
    s["near_conf"] = {"n": len(near), "fwd_mdd": float(np.mean([r["fwd_mdd"] for r in near])) if near else None, "fwd_ret": float(np.mean([r["fwd_ret"] for r in near])) if near else None}
    s["empty_space"] = {"n": len(empty), "fwd_mdd": float(np.mean([r["fwd_mdd"] for r in empty])) if empty else None, "fwd_ret": float(np.mean([r["fwd_ret"] for r in empty])) if empty else None}
    pats = {}
    for r in rows:
        if r["pattern"]:
            pats.setdefault(r["pattern"], []).append(abs(r["fwd_ret"]))
    s["pattern_abs_move"] = {k: {"n": len(v), "abs_ret": float(np.mean(v))} for k, v in pats.items()}
    return s


def pc(x): return "—" if x is None else f"{x*100:.0f}%"
def pr(x): return "—" if x is None else f"{x*100:+.1f}%"


def main(syms):
    out = {}
    md = ["# 선 엔진 워크포워드 검증", "", f"기간: 각 종목 61번째 봉부터 마지막-{H}봉까지, 매일 그날까지의 데이터로만 분석(미래 안 봄). 전방 {H}거래일 기준.", "",
          "읽는 법: '터치'는 5일 내 저가가 그 선 ±1% 안에 온 비율. '반응'은 터치 후 종가가 선 +2% 이상 간 비율. '이탈'은 터치 후 종가가 선 −2% 아래로 간 비율. 비교군 '가상 −3%선'은 아무 근거 없이 현재가 3% 아래 그은 선.", ""]
    for sym in syms:
        rows = run(sym)
        if not rows:
            continue
        s = summarize(sym, rows); out[sym] = s
        md += [f"## {sym} · {s['days']}일", "",
               "| 지지선 종류 | 표본 | 터치 | 터치→반응 | 터치→이탈 |", "|---|---|---|---|---|",
               f"| ★합류 (아래 5%) | {s['confluence']['n']} | {pc(s['confluence']['touch'])} | {pc(s['confluence']['react_given_touch'])} | {pc(s['confluence']['break_given_touch'])} |",
               f"| 단일 수평 지지 | {s['single_level']['n']} | {pc(s['single_level']['touch'])} | {pc(s['single_level']['react_given_touch'])} | {pc(s['single_level']['break_given_touch'])} |",
               f"| 가상 −3%선 (비교군) | {s['dummy_3pct']['n']} | {pc(s['dummy_3pct']['touch'])} | {pc(s['dummy_3pct']['react_given_touch'])} | {pc(s['dummy_3pct']['break_given_touch'])} |", "",
               f"- 전체 평균 5일 수익률 {pr(s['base_fwd_ret'])} · 평균 5일 최대낙폭 {pr(s['base_fwd_mdd'])}",
               f"- 하락 추세선 종가 돌파 다음날 진입: n={s['tl_break']['n']} · 5일 수익률 {pr(s['tl_break']['fwd_ret'])} · 승률 {pc(s['tl_break']['win'])}",
               f"- RSI<30 인 날: n={s['rsi_lt30']['n']} · 5일 수익률 {pr(s['rsi_lt30']['fwd_ret'])} · 승률 {pc(s['rsi_lt30']['win'])}",
               f"- ★합류 근접일 n={s['near_conf']['n']}: 5일 수익률 {pr(s['near_conf']['fwd_ret'])} · 최대낙폭 {pr(s['near_conf']['fwd_mdd'])}  vs  빈 공간일 n={s['empty_space']['n']}: {pr(s['empty_space']['fwd_ret'])} · {pr(s['empty_space']['fwd_mdd'])}",
               "- 패턴별 5일 절대 변동: " + (", ".join(f"{k} n={v['n']} {v['abs_ret']*100:.1f}%" for k, v in s["pattern_abs_move"].items()) or "—"), ""]
    # 종합
    agg = {}
    for key in ("confluence", "single_level", "dummy_3pct"):
        tt = [out[s][key] for s in out if out[s][key]["n"]]
        if tt:
            w = sum(x["n"] for x in tt)
            agg[key] = {"touch": sum((x["touch"] or 0) * x["n"] for x in tt) / w,
                        "react": sum((x["react_given_touch"] or 0) * x["n_touch"] for x in tt) / max(1, sum(x["n_touch"] for x in tt)),
                        "break": sum((x["break_given_touch"] or 0) * x["n_touch"] for x in tt) / max(1, sum(x["n_touch"] for x in tt)), "n": w}
    md += ["## 종합 (표본 가중)", "", "| 지지선 종류 | 표본 | 터치 | 터치→반응 | 터치→이탈 |", "|---|---|---|---|---|"]
    names = {"confluence": "★합류", "single_level": "단일 수평 지지", "dummy_3pct": "가상 −3%선"}
    for k, v in agg.items():
        md.append(f"| {names[k]} | {v['n']} | {pc(v['touch'])} | {pc(v['react'])} | {pc(v['break'])} |")
    md += ["", "주의: 표본이 수십 건 수준이고 종목 3개뿐이라 통계적 결론이 아니라 '방향 확인'용. 관심 종목이 늘면 자동으로 표본이 쌓임.", ""]
    (ROOT / "out" / "validation.md").write_text("\n".join(md), encoding="utf-8")
    (ROOT / "out" / "validation.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    syms = sys.argv[1:] or [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    main(syms)
