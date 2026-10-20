"""screener.py — P3 스크리너: "다들 이름은 아는데, 번 돈에 비해 덜 오른 종목"

축 (모두 네이버 증권 모바일 API + 야후 1년 일봉)
 ① 인지도   시총 ≥ 5,000억 · 20일 평균 거래대금 ≥ 30억 · 우선주/스팩/리츠 제외
 ② 실적     최근 4분기 영업이익 모두 흑자 · (추정 EPS > 현재 EPS) 또는 (직전 분기 영업이익 YoY > 0)
 ③ 미반영   이익 성장률 − 1년 주가 상승률 (gap) 클수록 · PER 이 같은 업종 중간값보다 낮을수록
 ④ 관심 꺼짐 회전율(거래대금/시총) 낮을수록 · 최근 60일 리포트 수·조회수 낮을수록 · 52주 범위 아래쪽일수록
 ⑤ 깨어남   최근 20일 외국인+기관 순매수 금액 > 0 이고 최근 5일도 > 0 → ★
점수: ②~④ 각 지표를 후보 안에서 백분위로 바꿔 가중 평균 (gap 35 · 업종 대비 PER 20 · 관심 25 · 성장 20)
출력: out/screener.json (상위 40 + 근거 문장), --watch K 면 watchlist.txt 의 '스크리너' 구간을 상위 K(★ 우선)로 교체
"""
import json, sys, time, math, statistics as st
from datetime import datetime, timedelta, timezone
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import naver
from naver import num

KST = timezone(timedelta(hours=9))
MIN_CAP = 5000        # 억원
MIN_TV = 30           # 억원 (20일 평균 거래대금)
EXCL = ("스팩", "리츠", "REIT", "ETN")
WATCH_TAG = "# --- 스크리너 (자동 · 주 1회 교체) ---"


def log(*a):
    print(*a, flush=True)


def universe():
    out = []
    for mk in ("KOSPI", "KOSDAQ"):
        for p in range(1, 12):
            j = naver.get(f"/api/stocks/marketValue/{mk}?page={p}&pageSize=100")
            st_ = j.get("stocks") or []
            stop = False
            for s in st_:
                cap = num(s.get("marketValue"))
                if cap is None:
                    continue
                if cap < MIN_CAP:
                    stop = True; break
                nm = s["stockName"]
                if nm.endswith(("우", "우B", "우C")) or any(x in nm for x in EXCL) or s.get("stockEndType") != "stock":
                    continue
                out.append({"code": s["itemCode"], "name": nm, "market": mk, "cap": cap})
            if stop or len(st_) < 100:
                break
            time.sleep(0.3)
    return out


def yahoo_1y(sym):
    u = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    c = [x for x in j["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x]
    return c


def collect(u):
    code = u["code"]
    it = naver.integration(code); info = it["info"]; raw = it["raw"]
    fin = naver.finance(code, "quarter")
    tr = naver.trend(code, 20)
    per, eps, cns_eps, pbr = num(info.get("per")), num(info.get("eps")), num(info.get("cnsEps")), num(info.get("pbr"))
    hi52, lo52 = num(info.get("highPriceOf52Weeks")), num(info.get("lowPriceOf52Weeks"))
    close = tr[0]["close"] if tr else None
    # 20일 평균 거래대금(억) — 수량×종가
    tv = [x["vol"] * x["close"] / 1e8 for x in tr if x["vol"] and x["close"]]
    tv20 = sum(tv) / len(tv) if tv else 0
    # 수급: 수량×종가 (억)
    flow = lambda xs: sum(((x["foreign"] or 0) + (x["organ"] or 0)) * (x["close"] or 0) for x in xs) / 1e8
    f20, f5 = flow(tr), flow(tr[:5])
    # 분기 영업이익
    act = [k for k, _, c in fin["periods"] if not c]
    op = fin["rows"].get("영업이익", {})
    ops = [op.get(k) for k in act]
    last4 = [x for x in ops[-4:] if x is not None]
    op_yoy = None
    if act:
        k = act[-1]; ky = str(int(k[:4]) - 1) + k[4:]
        if op.get(ky) and op.get(k) is not None and op[ky] > 0:
            op_yoy = op[k] / op[ky] - 1
    g_fwd = (cns_eps / eps - 1) if (eps and cns_eps and eps > 0) else None
    # 리포트
    rs = raw.get("researches") or []
    cutoff = (datetime.now(KST) - timedelta(days=60)).strftime("%Y%m%d")
    r60 = [r for r in rs if r.get("wdt", "") >= cutoff]
    rcnt = st.mean([num(r.get("rcnt")) or 0 for r in r60]) if r60 else 0
    cons = raw.get("consensusInfo") or {}
    return {**u, "close": close, "per": per, "pbr": pbr, "eps": eps, "cns_eps": cns_eps, "g_fwd": g_fwd, "op_yoy": op_yoy,
            "op_last4": last4, "profitable": len(last4) >= 4 and all(x > 0 for x in last4),
            "tv20": round(tv20, 1), "turnover": (tv20 / u["cap"]) if u["cap"] else None,
            "flow20": round(f20, 1), "flow5": round(f5, 1),
            "hi52": hi52, "lo52": lo52, "pos52": ((close - lo52) / (hi52 - lo52)) if (close and hi52 and lo52 and hi52 > lo52) else None,
            "reports60": len(r60), "report_reads": round(rcnt), "industry": raw.get("industryCode"),
            "target": num(cons.get("priceTargetMean")), "recomm": num(cons.get("recommMean")),
            "div": num(info.get("dividendYieldRatio"))}


def pctl(vals, x, higher_better=True):
    v = sorted(a for a in vals if a is not None)
    if x is None or not v:
        return 0.5
    i = sum(1 for a in v if a < x) + 0.5 * sum(1 for a in v if a == x)
    p = i / len(v)
    return p if higher_better else 1 - p


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    U = universe()
    log(f"universe {len(U)} (시총 ≥ {MIN_CAP}억)")
    if limit:
        U = U[:limit]
    rows = []
    for i, u in enumerate(U):
        try:
            rows.append(collect(u))
        except Exception as e:
            log("skip", u["name"], repr(e)[:80])
        time.sleep(0.25)
        if i % 50 == 0:
            log(i, u["name"])
    # 업종 PER 중간값 (흑자·PER>0 만)
    ind = {}
    for r in rows:
        if r["per"] and r["per"] > 0:
            ind.setdefault(r["industry"], []).append(r["per"])
    for r in rows:
        peers = ind.get(r["industry"], [])
        r["ind_per"] = st.median(peers) if len(peers) >= 3 else None
        r["per_disc"] = (1 - r["per"] / r["ind_per"]) if (r["per"] and r["per"] > 0 and r["ind_per"]) else None
    # 1차 관문 ①②
    C = [r for r in rows if r["tv20"] >= MIN_TV and r["profitable"] and r["per"] and 0 < r["per"] < 60
         and ((r["g_fwd"] or 0) > 0 or (r["op_yoy"] or 0) > 0)]
    log(f"gate ①② 통과 {len(C)} / {len(rows)}")
    # 1년 수익률 (야후) — 통과 종목만
    for r in C:
        sym = naver.yahoo_symbol(r["code"], r["market"]); r["symbol"] = sym
        try:
            c = yahoo_1y(sym); r["ret1y"] = (c[-1] / c[0] - 1) if len(c) > 150 else None
        except Exception:
            r["ret1y"] = None
        time.sleep(0.4)
    for r in C:
        g = r["g_fwd"] if r["g_fwd"] is not None else r["op_yoy"]
        r["growth"] = g
        r["gap"] = (g - r["ret1y"]) if (g is not None and r["ret1y"] is not None) else None
    # 점수 (후보 안 백분위)
    col = lambda k: [r.get(k) for r in C]
    for r in C:
        s_gap = pctl(col("gap"), r.get("gap"))
        s_per = pctl(col("per_disc"), r.get("per_disc"))
        s_grw = pctl(col("growth"), r.get("growth"))
        s_att = (pctl(col("turnover"), r["turnover"], False) + pctl(col("reports60"), r["reports60"], False)
                 + pctl(col("report_reads"), r["report_reads"], False) + pctl(col("pos52"), r["pos52"], False)) / 4
        r["score"] = round(100 * (0.35 * s_gap + 0.20 * s_per + 0.25 * s_att + 0.20 * s_grw), 1)
        r["parts"] = {"미반영": round(s_gap * 100), "싸다": round(s_per * 100), "관심↓": round(s_att * 100), "성장": round(s_grw * 100)}
        r["awake"] = r["flow20"] > 0 and r["flow5"] > 0
        r["why"] = reasons(r)
    C.sort(key=lambda r: r["score"], reverse=True)
    top = C[:40]
    res = {"asof": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "universe": len(rows), "passed": len(C),
           "rule": {"min_cap_eok": MIN_CAP, "min_tv_eok": MIN_TV}, "rows": top}
    (ROOT / "out" / "screener.json").write_text(json.dumps(res, ensure_ascii=False, indent=0, default=float), encoding="utf-8")
    log(f"top {len(top)}")
    for r in top[:15]:
        log(f"{r['score']:5.1f} {'★' if r['awake'] else ' '} {r['name']:<12} cap {r['cap']/1e4:.1f}조 PER {r['per']} g {fmtp(r['growth'])} 1y {fmtp(r.get('ret1y'))} | {r['why'][0]}")
    if "--watch" in sys.argv:
        update_watch(top, int(sys.argv[sys.argv.index("--watch") + 1]))
    return res


def fmtp(x):
    return "—" if x is None else f"{x*100:+.0f}%"


def reasons(r):
    w = []
    if r.get("growth") is not None and r.get("ret1y") is not None:
        w.append(f"이익 {fmtp(r['growth'])} 예상인데 주가는 1년 {fmtp(r['ret1y'])}")
    if r.get("per_disc") is not None and r["ind_per"]:
        w.append(f"PER {r['per']:.1f}배 — 업종 중간 {r['ind_per']:.1f}배보다 {abs(r['per_disc'])*100:.0f}% {'낮음' if r['per_disc'] > 0 else '높음'}")
    w.append(f"최근 60일 리포트 {r['reports60']}건 · 하루 거래대금 {r['tv20']:.0f}억")
    if r.get("pos52") is not None:
        w.append(f"52주 범위 아래에서 {r['pos52']*100:.0f}% 지점")
    if r["awake"]:
        w.append(f"★ 외국인+기관 20일 {r['flow20']:+,.0f}억 · 5일 {r['flow5']:+,.0f}억 순매수 — 들어오기 시작")
    elif r["flow20"] < 0:
        w.append(f"외국인+기관 20일 {r['flow20']:+,.0f}억 — 아직 파는 중")
    return w


def update_watch(top, k):
    wl = ROOT / "watchlist.txt"
    lines = wl.read_text().splitlines()
    if WATCH_TAG in lines:
        head = lines[:lines.index(WATCH_TAG)]
    else:
        head = lines
    keep = [l for l in head if l.strip()]
    picks = sorted(top, key=lambda r: (not r["awake"], -r["score"]))[:k]
    new = [r["symbol"] for r in picks if r["symbol"] not in keep]
    wl.write_text("\n".join(keep + ["", WATCH_TAG] + new) + "\n")
    pj = ROOT / "positions.json"; cfg = json.loads(pj.read_text(encoding="utf-8"))
    for r in picks:
        cfg.setdefault("names", {})[r["symbol"]] = r["name"]
    pj.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    log("watchlist 스크리너 구간:", new)


if __name__ == "__main__":
    main()
