"""track.py — P1 검증 로그: 매일 엔진이 한 말 → 이후 실제로 맞았나

기록(out/track_log.json): 종목·기준일마다 엔진이 내놓은 '예상'을 한 번만 저장 (첫 기록 우선, 나중에 고치지 않음)
  - 받침(합류, 현재가 아래): 오면 튀어오를 가능성
  - 천장(합류, 현재가 위): 오면 막힐 가능성
  - 추세선(하락 추세선): 종가로 넘으면 전환 1차
  - 상태 칩(exit/warn/hold/wait/enter)
채점(out/track.json): 데이터가 쌓인 만큼만 채점 (1일 후 / 5일 후)
  - 받침: 5일 안에 ±1% 안으로 왔나(touch) → 왔다면 5일째 종가가 받침 위(반응) / 2% 넘게 아래(이탈) / 그 사이(애매)
  - 천장: 왔다면 5일째 종가가 천장 아래(막힘) / 2% 넘게 위(돌파) / 애매
  - 추세선: 5일 안에 종가 돌파했나 + 돌파 다음날부터 5일 수익
  - 비교 기준: 같은 기간 무작위 가격(현재가 ±3% 아무 데나)에 같은 규칙을 적용한 '더미 선' 반응률

--seed N : 지난 N거래일을 '그 날 데이터까지만' 써서 재현 기록(출처 '재현')으로 채움. 실시간 기록과 구분 표시.
"""
import json, sys, random
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
sys.path.insert(0, str(ROOT / "engine"))
from lines import load_csv, analyze_df

H = 5  # 채점 기간(거래일)


def read_list(name):
    f = ROOT / name
    return [s.strip() for s in f.read_text().splitlines() if s.strip() and not s.startswith("#")] if f.exists() else []


def snapshot(r: dict, src: str) -> dict:
    c = r["close"]
    conf = r.get("confluence") or []
    tl = r.get("trend_upper") or {}
    p = {"sym": r["symbol"], "asof": r["asof"], "close": c, "krw": r["krw"], "src": src, "preds": []}
    for g in conf:
        p["preds"].append({"kind": "받침" if g["price"] < c else "천장", "price": round(g["price"], 4), "lines": g["lines"]})
    if tl.get("value_today"):
        p["preds"].append({"kind": "추세선", "price": round(tl["value_today"], 4), "slope": tl["slope_per_bar"]})
    return p


def add_chip(p, sym):
    jd = OUT / "judgement.json"
    if jd.exists():
        j = json.loads(jd.read_text(encoding="utf-8")).get(sym) or {}
        if j.get("asof") == p["asof"]:
            p["chip"] = j.get("chip")


def score_entry(e: dict, df: pd.DataFrame) -> dict:
    """e 이후의 봉으로 채점. 반환: {n_after, ret1, ret5, preds:[{..., result}]}"""
    after = df[df["date"] > pd.Timestamp(e["asof"])].head(H)
    n = len(after)
    res = {"n_after": n}
    if n == 0:
        return res
    c0 = e["close"]
    res["ret1"] = round((after["close"].iloc[0] / c0 - 1) * 100, 2)
    if n >= H:
        res["ret5"] = round((after["close"].iloc[-1] / c0 - 1) * 100, 2)
    # 워뇨띠식 보유 기간(평균 90일 ≈ 60거래일)까지 길게도 본다
    longer = df[df["date"] > pd.Timestamp(e["asof"])]
    for d in (20, 60):
        if len(longer) >= d:
            res[f"ret{d}"] = round((longer["close"].iloc[d - 1] / c0 - 1) * 100, 2)
    out = []
    for p in e["preds"]:
        q = dict(p); px = p["price"]
        if p["kind"] in ("받침", "천장"):
            touched = bool((after["low"] <= px * 1.01).any()) if p["kind"] == "받침" else bool((after["high"] >= px * 0.99).any())
            if not touched:
                q["result"] = "안 옴" if n >= H else "대기"
            elif n < H:
                q["result"] = "진행 중"
            else:
                last = after["close"].iloc[-1]
                if p["kind"] == "받침":
                    q["result"] = "반응" if last >= px else ("이탈" if last < px * 0.98 else "애매")
                else:
                    q["result"] = "막힘" if last <= px else ("돌파" if last > px * 1.02 else "애매")
        elif p["kind"] == "추세선":
            line = [px + p["slope"] * (i + 1) for i in range(n)]
            brk = [i for i in range(n) if after["close"].iloc[i] > line[i]]
            if brk:
                i = brk[0]; q["result"] = "돌파"; q["break_day"] = i + 1
                rest = df[df["date"] > after["date"].iloc[i]].head(H)
                if len(rest) >= H:
                    q["ret_after"] = round((rest["close"].iloc[-1] / after["close"].iloc[i] - 1) * 100, 2)
            else:
                q["result"] = "못 넘음" if n >= H else "대기"
        out.append(q)
    res["preds"] = out
    return res


def dummy_rate(df: pd.DataFrame, entries: list, rng: random.Random) -> dict:
    """같은 날짜들에 현재가 아래 0.5~3% 아무 가격을 '받침'이라 치고 같은 규칙으로 채점"""
    hit = tot = 0
    for e in entries:
        after = df[df["date"] > pd.Timestamp(e["asof"])].head(H)
        if len(after) < H:
            continue
        for _ in range(3):
            px = e["close"] * (1 - rng.uniform(0.005, 0.03))
            if (after["low"] <= px * 1.01).any():
                tot += 1; hit += int(after["close"].iloc[-1] >= px)
    return {"hit": hit, "n": tot}


def seed(days: int):
    log = load_log()
    have = {(e["sym"], e["asof"]) for e in log}
    for s in read_list("watchlist.txt"):
        f = ROOT / "data" / f"{s}.csv"
        if not f.exists():
            continue
        df = load_csv(str(f))
        for k in range(days, 0, -1):
            sub = df.iloc[:-k].reset_index(drop=True)
            if len(sub) < 130:
                continue
            asof = str(sub["date"].iloc[-1].date())
            if (s, asof) in have:
                continue
            try:
                r = analyze_df(sub, s)
            except Exception as ex:
                print("seed fail", s, asof, ex); continue
            log.append(snapshot(r, "재현")); have.add((s, asof))
    save_log(log)


def load_log():
    f = OUT / "track_log.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def save_log(log):
    log.sort(key=lambda e: (e["asof"], e["sym"]))
    (OUT / "track_log.json").write_text(json.dumps(log, ensure_ascii=False, indent=0, default=float), encoding="utf-8")


def record_today():
    log = load_log()
    have = {(e["sym"], e["asof"]) for e in log}
    for s in read_list("watchlist.txt"):
        f = OUT / f"{s}.json"
        if not f.exists():
            continue
        r = json.loads(f.read_text(encoding="utf-8"))
        if (s, r["asof"]) in have:
            continue
        p = snapshot(r, "실시간"); add_chip(p, s)
        log.append(p)
    save_log(log)
    return log


def score(log):
    rng = random.Random(7)
    rows, agg = [], {}
    by_sym = {}
    for e in log:
        by_sym.setdefault(e["sym"], []).append(e)
    dummy = {"hit": 0, "n": 0}
    for s, es in by_sym.items():
        f = ROOT / "data" / f"{s}.csv"
        if not f.exists():
            continue
        df = load_csv(str(f))
        d = dummy_rate(df, es, rng); dummy["hit"] += d["hit"]; dummy["n"] += d["n"]
        for e in es:
            sc = score_entry(e, df)
            row = {k: e[k] for k in ("sym", "asof", "close", "krw", "src")}
            row.update({k: v for k, v in sc.items() if k != "preds"})
            if e.get("chip"): row["chip"] = e["chip"]
            row["preds"] = sc.get("preds", e["preds"])
            rows.append(row)
            for p in sc.get("preds", []):
                key = p["kind"]; a = agg.setdefault(key, {})
                a[p["result"]] = a.get(p["result"], 0) + 1
    def rate(a, good, bad):
        n = sum(a.get(k, 0) for k in good + bad + ["애매"])
        return {"n": n, "good": sum(a.get(k, 0) for k in good), "pct": round(100 * sum(a.get(k, 0) for k in good) / n) if n else None}
    tl_rets = [p["ret_after"] for r in rows for p in r["preds"] if p["kind"] == "추세선" and "ret_after" in p]
    summary = {
        "받침": {**rate(agg.get("받침", {}), ["반응"], ["이탈"]), "raw": agg.get("받침", {})},
        "천장": {**rate(agg.get("천장", {}), ["막힘"], ["돌파"]), "raw": agg.get("천장", {})},
        "추세선": {"raw": agg.get("추세선", {}), "n_ret": len(tl_rets), "avg_ret_after": round(sum(tl_rets) / len(tl_rets), 2) if tl_rets else None,
                  "win": round(100 * sum(1 for x in tl_rets if x > 0) / len(tl_rets)) if tl_rets else None},
        "더미 받침": {"n": dummy["n"], "good": dummy["hit"], "pct": round(100 * dummy["hit"] / dummy["n"]) if dummy["n"] else None},
        "기간": {"from": min((e["asof"] for e in log), default=None), "to": max((e["asof"] for e in log), default=None),
                "실시간_시작": min((e["asof"] for e in log if e["src"] == "실시간"), default=None)},
        "horizon": H,
    }
    rows.sort(key=lambda r: (r["asof"], r["sym"]), reverse=True)
    (OUT / "track.json").write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=0, default=float), encoding="utf-8")
    return summary


def main():
    if "--seed" in sys.argv:
        seed(int(sys.argv[sys.argv.index("--seed") + 1]))
    log = record_today()
    s = score(log)
    print("track:", json.dumps(s, ensure_ascii=False))
    return s


if __name__ == "__main__":
    main()
