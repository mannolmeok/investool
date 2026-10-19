"""attribution.py — 급락(급등) 원인 분해: 지수 / 업종 / 종목 고유 + 거래량 성격
입력: data/<sym>.csv (관심+맥락), sectors.json
출력: out/attribution.json { sym: {ret1, ret5, index:{sym,ret1,ret5,beta,contrib}, sector:{...}, idio, volume_ratio, kind, sentence} }
"""
import json
from pathlib import Path
import numpy as np, pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA, OUT = ROOT / "data", ROOT / "out"


def load(sym):
    p = DATA / f"{sym}.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, parse_dates=["date"]).set_index("date").sort_index()
    return df


def rets(df, n):
    c = df["close"]
    return float(c.iloc[-1] / c.iloc[-1 - n] - 1) * 100 if len(c) > n else None


def beta(a: pd.Series, b: pd.Series, n=60):
    j = pd.concat([a, b], axis=1, sort=True).dropna().iloc[-n:]
    if len(j) < 20:
        return 1.0
    ra, rb = j.iloc[:, 0].pct_change().dropna(), j.iloc[:, 1].pct_change().dropna()
    ra, rb = ra.align(rb, join="inner")
    v = np.var(rb)
    return float(np.clip(np.cov(ra, rb)[0, 1] / v, 0.0, 3.0)) if v > 0 else 1.0


def analyze(sym, cfg):
    df = load(sym)
    if df is None:
        return None
    idx = load(cfg["index"]) if cfg.get("index") else None
    peers = [p for p in (load(x) for x in cfg.get("peers", [])) if p is not None]
    out = {"symbol": sym, "asof": str(df.index[-1].date()), "ret1": rets(df, 1), "ret5": rets(df, 5)}
    r1 = out["ret1"] or 0.0
    # 지수
    if idx is not None:
        # 날짜 정렬: 마지막 공통 거래일 기준
        b = beta(df["close"], idx["close"])
        ir1 = rets(idx.loc[:df.index[-1]], 1) or 0.0
        out["index"] = {"symbol": cfg["index"], "ret1": ir1, "ret5": rets(idx.loc[:df.index[-1]], 5), "beta": b, "contrib": b * ir1}
    else:
        out["index"] = None
    # 업종 (피어 평균, 지수 초과분)
    if peers:
        pr1 = float(np.mean([rets(p.loc[:df.index[-1]], 1) or 0.0 for p in peers]))
        pr5 = float(np.mean([rets(p.loc[:df.index[-1]], 5) or 0.0 for p in peers]))
        excess = pr1 - (out["index"]["ret1"] if out["index"] else 0.0)
        out["sector"] = {"name": cfg.get("sector", "업종"), "peers": cfg["peers"], "ret1": pr1, "ret5": pr5, "excess1": excess}
    else:
        out["sector"] = None
    idx_c = out["index"]["contrib"] if out["index"] else 0.0
    sec_c = out["sector"]["excess1"] if out["sector"] else 0.0
    out["idio"] = r1 - idx_c - sec_c
    # 거래량 성격
    v = df["volume"]
    vr = float(v.iloc[-1] / v.iloc[-21:-1].mean()) if len(v) > 21 else None
    out["volume_ratio"] = vr
    parts = {"지수": abs(idx_c), "업종": abs(sec_c), "종목 고유": abs(out["idio"])}
    main = max(parts, key=parts.get)
    kind = "투매(거래량 동반)" if r1 < -3 and (vr or 0) > 1.8 else "매수 부재(거래량 없이 하락)" if r1 < 0 and (vr or 1) < 0.7 else "보통"
    out["main_driver"], out["kind"] = main, kind
    f = lambda x: f"{x:+.1f}%"
    s = f"[{out['asof']}] {sym} {f(r1)} = 지수 {f(idx_c)}" + (f"(β{out['index']['beta']:.1f}×{out['index']['symbol']} {f(out['index']['ret1'])})" if out["index"] else "") \
        + f" + 업종 {f(sec_c)}" + (f"({out['sector']['name']} 피어 {f(out['sector']['ret1'])})" if out["sector"] else "") \
        + f" + 종목 고유 {f(out['idio'])}. 주원인: {main}" + (f" · 거래량 {vr:.1f}× → {kind}" if vr else "") + "."
    if main == "종목 고유" and abs(out["idio"]) > 3:
        s += " 종목 고유 뉴스/공시를 먼저 확인."
    elif main == "업종":
        s += " 섹터 FUD 성격 — 펀더멘털 변화 없으면 플레이북 유지."
    elif main == "지수":
        s += " 시장 전체 움직임 — 종목 판단과 분리."
    out["sentence"] = s
    return out


def main():
    cfg = json.loads((ROOT / "sectors.json").read_text(encoding="utf-8"))
    res = {}
    for sym, c in cfg.items():
        if sym.startswith("_"):
            continue
        r = analyze(sym, c)
        if r:
            res[sym] = r
            print(r["sentence"])
    OUT.mkdir(exist_ok=True)
    (OUT / "attribution.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


if __name__ == "__main__":
    main()
