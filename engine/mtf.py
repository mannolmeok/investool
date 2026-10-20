"""mtf.py — 큰 그림: 주봉·월봉에 같은 선 엔진을 돌리고, 일봉 현재가 근처에 있는 '큰 봉의 선'을 찾는다
출력
 - out/<sym>.w.json / out/<sym>.m.json : 주봉·월봉 분석 (lines.analyze_df 결과, 문장 제외)
 - out/mtf.json : {sym: {w: 요약, m: 요약, near: [주봉·월봉 선 중 일봉 종가 ±3% 안], sentence}}
원리: 같은 지지선이라도 주봉·월봉 선과 겹치면 보는 사람이 더 많다 → 더 강한 자리
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
sys.path.insert(0, str(ROOT / "engine"))
from lines import load_csv, analyze_df

UNIT = {"w": "주", "m": "월"}


def summarize(r, tf):
    c, u = r["close"], UNIT[tf]
    ma = r.get("ma", {})
    above = [k for k, v in ma.items() if c > v["value"]]
    tl = r.get("trend_upper") or {}
    lo = r.get("trend_lower") or {}
    conf = r.get("confluence") or []
    sup = sorted([l["price"] for l in r.get("levels", []) if l["price"] < c] + [g["price"] for g in conf if g["price"] < c], reverse=True)
    res = sorted([l["price"] for l in r.get("levels", []) if l["price"] >= c] + [g["price"] for g in conf if g["price"] >= c])
    rsi = (r.get("rsi_volume") or {}).get("rsi")
    if ma and not above:
        trend = "하락 추세"
    elif ma and len(above) == len(ma):
        trend = "상승 추세"
    else:
        trend = "횡보·전환 구간"
    bits = [f"{u}봉 {trend}", f"이평 {len(above)}/{len(ma)}개 위"]
    if rsi is not None:
        bits.append(f"RSI {rsi:.0f}" + (" 과매도" if rsi < 30 else " 과매수" if rsi > 70 else ""))
    if tl.get("value_today") and tl.get("slope_per_bar", 0) < 0 and c < tl["value_today"]:
        bits.append(f"하락 추세선 {tl['value_today']:,.0f} 아래" if r.get("krw") else f"하락 추세선 {tl['value_today']:.2f} 아래")
    return {"asof": r["asof"], "close": c, "trend": trend, "above": len(above), "n_ma": len(ma),
            "ma": {k: round(v["value"], 4) for k, v in ma.items()}, "arr": r.get("ma_arrangement"), "rsi": rsi,
            "sup": sup[0] if sup else None, "res": res[0] if res else None,
            "tl": tl.get("value_today"), "tl_slope": tl.get("slope_per_bar"), "tl_lower": lo.get("value_today"),
            "sentence": " · ".join(bits)}


def near_lines(daily_close, r, tf, band=0.03):
    u = UNIT[tf]; out = []
    for k, v in (r.get("ma") or {}).items():
        out.append((f"{k.replace('sma', '')}{u}선", v["value"]))
    for l in r.get("levels", []):
        out.append((f"{u}봉 {'지지' if l['price'] < daily_close else '저항'}({l['touches']}회)", l["price"]))
    if r.get("trend_upper"): out.append((f"{u}봉 하락 추세선" if r["trend_upper"]["slope_per_bar"] < 0 else f"{u}봉 상단 추세선", r["trend_upper"]["value_today"]))
    if r.get("trend_lower"): out.append((f"{u}봉 상승 추세선" if r["trend_lower"]["slope_per_bar"] > 0 else f"{u}봉 하단 추세선", r["trend_lower"]["value_today"]))
    for k, v in (r.get("fib", {}).get("levels") or {}).items():
        out.append((f"{u}봉 피보 {k}", v))
    bb = r.get("bollinger") or {}
    if bb.get("lower"): out.append((f"{u}봉 볼린저 하단", bb["lower"]))
    res = []
    for label, p in out:
        if p and abs(p / daily_close - 1) <= band:
            res.append({"tf": tf, "label": label, "price": round(p, 4), "pct": round((p / daily_close - 1) * 100, 2)})
    return res


def main():
    syms = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    M = {}
    for s in syms:
        dj = OUT / f"{s}.json"
        if not dj.exists():
            continue
        d = json.loads(dj.read_text(encoding="utf-8"))
        item = {"near": []}
        for tf in ("w", "m"):
            f = ROOT / "data" / f"{s}.{tf}.csv"
            if not f.exists():
                continue
            df = load_csv(str(f))
            if len(df) < (20 if tf == "w" else 15):
                continue
            try:
                r = analyze_df(df.reset_index(drop=True), s)
            except Exception as e:
                print("mtf skip", s, tf, repr(e)[:80]); continue
            r.pop("sentences", None)
            (OUT / f"{s}.{tf}.json").write_text(json.dumps(r, ensure_ascii=False, default=float), encoding="utf-8")
            item[tf] = summarize(r, tf)
            item["near"] += near_lines(d["close"], r, tf)
        item["near"].sort(key=lambda x: abs(x["pct"]))
        # 일봉 ★받침/천장과 겹치는 큰 봉 선 → '더 강한 자리'
        strong = []
        for g in d.get("confluence") or []:
            hits = [n for n in item["near"] if abs(n["price"] / g["price"] - 1) <= 0.015]
            if hits:
                strong.append({"price": g["price"], "side": "받침" if g["price"] < d["close"] else "천장", "with": [h["label"] for h in hits]})
        item["strong"] = strong
        parts = [item[tf]["sentence"] for tf in ("m", "w") if tf in item]
        if strong:
            fp = (lambda v: f"{v:,.0f}") if d.get("krw") else (lambda v: f"{v:.2f}")
            parts.append(" / ".join(f"★{x['side']} {fp(x['price'])} = {' + '.join(x['with'])}도 겹침 → 더 강한 자리" for x in strong))
        item["sentence"] = " · ".join(parts)
        M[s] = item
    (OUT / "mtf.json").write_text(json.dumps(M, ensure_ascii=False, default=float), encoding="utf-8")
    for s, it in M.items():
        print(f"{s}: {it['sentence']}")
    return M


if __name__ == "__main__":
    main()
