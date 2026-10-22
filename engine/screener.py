"""screener.py — P3 스크리너: "다들 이름은 아는데, 번 돈에 비해 덜 오른 종목"
참고: 워뇨띠 Q&A — "저평가를 가장 먼저, 그다음 차트" · "시총 조 단위, 잡주 아님" · "주가가 아니라 매출·영업이익이
      신고점을 돌파하는 종목" · "영원히 주목 못 받을 애들 말고 몇 년 안에 주목받을 애들" · 평균 90일 보유 · 리스크 관리 최우선

축 (네이버 증권 모바일 API + 야후 1년 일봉)
 ① 인지도    시총 ≥ 3천억(수집) · 20일 평균 거래대금 ≥ 30억 · 우선주/스팩/리츠 제외 — 화면에서 3천억~1조 / 1~5조 / 5조↑ 필터
 ② 실적      최근 4분기 영업이익 모두 흑자 · 추정 EPS > 현재 EPS (앞으로도 증가 = "몇 년 안에 주목받을")
 ③ 저평가    PER 업종 중간값 대비 할인 · PER 절대 수준
 ④ 실적 신고점 직전 분기 매출 또는 영업이익이 확인 가능한 분기 중 최고 · 연간 영업이익 증가 행진
 ⑤ 미반영    이익 성장률 − 1년 주가 상승률(gap) · 52주 범위 아래쪽 · 리포트/거래 관심 낮음
 ★ 깨어남    최근 20일·5일 외국인+기관 순매수 > 0 (수급이 붙어야 오른다 — 차트·수급으로 타이밍 확인)
점수: 후보 안 백분위 가중 평균 (저평가 30 · 실적 신고점 25 · 미반영 25 · 성장 20)
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
MIN_CAP = 3000        # 억원 — 수집 하한(잡주 컷). 화면에서 시총 구간 필터
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
    # 지배구조: 연결 순이익 중 비지배지분(상장·비상장 자회사의 다른 주주 몫) 비중 — 지주사·중복상장 할인의 대표 신호
    ni, nci = fin["rows"].get("당기순이익", {}), fin["rows"].get("비지배주주순이익", {})
    k4 = [k for k in act[-4:] if ni.get(k) is not None and nci.get(k) is not None]
    ni4, nci4 = sum(ni[k] for k in k4), sum(nci[k] for k in k4)
    nci_ratio = (nci4 / ni4) if (k4 and ni4 > 0) else None
    sales = fin["rows"].get("매출액", {})
    def is_high(row):
        v = [row.get(k) for k in act if row.get(k) is not None]
        return len(v) >= 4 and v[-1] >= max(v[:-1])
    hi_op, hi_sales = is_high(op), is_high(sales)
    try:
        fa = naver.finance(code, "annual"); aop = fa["rows"].get("영업이익", {})
        ak = [k for k, _, c in fa["periods"] if not c]; av = [aop.get(k) for k in ak if aop.get(k) is not None]
        a_up = len(av) >= 2 and all(b > a for a, b in zip(av, av[1:]))  # 연간 영업이익 계속 증가
        a_last = av[-1] if av else None
    except Exception:
        a_up, a_last = False, None
    # 리포트
    rs = raw.get("researches") or []
    cutoff = (datetime.now(KST) - timedelta(days=60)).strftime("%Y%m%d")
    r60 = [r for r in rs if r.get("wdt", "") >= cutoff]
    rcnt = st.mean([num(r.get("rcnt")) or 0 for r in r60]) if r60 else 0
    cons = raw.get("consensusInfo") or {}
    return {**u, "close": close, "per": per, "pbr": pbr, "eps": eps, "cns_eps": cns_eps, "g_fwd": g_fwd, "op_yoy": op_yoy,
            "op_last4": last4, "profitable": len(last4) >= 4 and all(x > 0 for x in last4),
            "hi_op": hi_op, "hi_sales": hi_sales, "annual_up": a_up, "op_annual": a_last, "nci_ratio": nci_ratio,
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
    # 업종 이름 + 지배구조 플래그
    try:
        inames = {str(g["no"]): g["name"] for g in naver.get("/api/stocks/industry").get("groups", [])}
    except Exception:
        inames = {}
    for r in rows:
        r["industry_name"] = inames.get(str(r["industry"]), "")
        f = []
        if any(x in r["name"] for x in ("홀딩스", "지주")) or r["industry_name"] in ("복합기업",):
            f.append("지주사")
        if r["nci_ratio"] is not None and r["nci_ratio"] >= 0.3:
            f.append(f"자회사 몫 {r['nci_ratio']*100:.0f}%")
        r["gov_flags"] = f
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
         and (r["g_fwd"] or 0) > 0]
    log(f"gate ①② 통과 {len(C)} / {len(rows)}")
    why = {"거래대금": sum(r["tv20"] < MIN_TV for r in rows), "적자분기": sum(not r["profitable"] for r in rows),
           "PER": sum(not (r["per"] and 0 < r["per"] < 60) for r in rows), "추정EPS↓": sum(not ((r["g_fwd"] or 0) > 0) for r in rows)}
    log("탈락 사유(중복 포함):", why)
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
    # ③ 미반영 관문: 이익이 주가보다 더 늘었어야 함 (이미 많이 오른 주도주 제외 — 워뇨띠: 삼전·두산에너빌·한미반도체 회피)
    n0 = len(C)
    C = [r for r in C if r["gap"] is not None and r["gap"] > 0]
    log(f"gate ③ 이익>주가 통과 {len(C)} / {n0}")
    why["이미 많이 오름"] = n0 - len(C)
    # DART (키 있을 때만): 분할 이력·최대주주·감사의견·상장 자회사
    try:
        import dart
        dart.enrich(C, [r["name"] for r in rows])
    except Exception as e:
        log("dart fail", repr(e)[:100])
    # 점수 (후보 안 백분위)
    col = lambda k: [r.get(k) for r in C]
    for r in C:
        s_val = (pctl(col("per_disc"), r.get("per_disc")) + pctl(col("per"), r["per"], False)) / 2
        s_hi = (0.4 * r["hi_op"] + 0.3 * r["hi_sales"] + 0.3 * r["annual_up"])
        s_lag = (2 * pctl(col("gap"), r.get("gap")) + pctl(col("pos52"), r["pos52"], False)
                 + (pctl(col("turnover"), r["turnover"], False) + pctl(col("reports60"), r["reports60"], False)) / 2) / 4
        s_grw = pctl(col("growth"), r.get("growth"))
        r["score"] = round(100 * (0.30 * s_val + 0.25 * s_hi + 0.25 * s_lag + 0.20 * s_grw), 1)
        r["parts"] = {"싸다": round(s_val * 100), "신고점": round(s_hi * 100), "미반영": round(s_lag * 100), "성장": round(s_grw * 100)}
        r["awake"] = r["flow20"] > 0 and r["flow5"] > 0
        r["why"] = reasons(r)
    C.sort(key=lambda r: r["score"], reverse=True)
    top = C  # 전부 저장 — 화면에서 시총·시장·지배구조·수급 필터
    res = {"asof": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "universe": len(rows), "passed": len(C), "dropped": why,
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
    hi = [x for x, ok in (("영업이익", r.get("hi_op")), ("매출", r.get("hi_sales"))) if ok]
    if hi:
        w.append(f"직전 분기 {'·'.join(hi)} 최고치" + (" · 연간 영업이익 계속 증가" if r.get("annual_up") else ""))
    elif r.get("annual_up"):
        w.append("연간 영업이익 계속 증가")
    w.append(f"최근 60일 리포트 {r['reports60']}건 · 하루 거래대금 {r['tv20']:.0f}억")
    if r.get("gov_notes"):
        w.append("참고: " + " · ".join(r["gov_notes"]))
    if r.get("gov_flags"):
        w.append("⚠ 지배구조: " + " · ".join(r["gov_flags"]) + " — 지주사·중복상장 할인이나 분할 이슈로 싸게 머물 수 있음")
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
    hf = ROOT / "watch_hide.json"
    hide = set(json.loads(hf.read_text(encoding="utf-8") or "[]")) if hf.exists() else set()  # 앱에서 뺀 종목
    pool = [r for r in top if not r.get("gov_flags") and r["cap"] >= 5000 and r["symbol"] not in hide]
    picks = sorted(pool, key=lambda r: (not r["awake"], -r["score"]))[:k]
    new = [r["symbol"] for r in picks if r["symbol"] not in keep]
    wl.write_text("\n".join(keep + ["", WATCH_TAG] + new) + "\n")
    pj = ROOT / "positions.json"; cfg = json.loads(pj.read_text(encoding="utf-8"))
    for r in picks:
        cfg.setdefault("names", {})[r["symbol"]] = r["name"]
    pj.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    log("watchlist 스크리너 구간:", new)


if __name__ == "__main__":
    main()
