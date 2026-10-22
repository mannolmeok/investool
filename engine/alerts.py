"""alerts.py — 알림 규칙 엔진 (v3.1: 쉬운 말 · 제목에 종목·상태, 본문에 가격 하나와 할 일)
입력: out/<sym>.json, out/judgement.json, positions.json, data/<sym>.csv, out/flows.json
출력: out/alerts.json      {"asof":..., "alerts":[{symbol, rule, tag, level, title, body, text, key}], "new":[...]}
      out/alerts_sent.json  (key 별 마지막 발송일 — 규칙당 하루 1회)
      out/alerts_log.json   {종가일: {key: alert}} — 알림 탭의 '어제·지난 알림' (최근 21개 종가일)
tag: go(조건 충족) · near(바닥 후보/막힐 자리 근접) · stop(손절, 끌 수 없음) · flow(수급 전환) · etc
실제 푸시 전송은 push.py. 여기선 '무엇을 보낼지'만 결정.
"""
import json
from pathlib import Path
from datetime import date
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
MINUS = "−"
LOG_DAYS = 21


def fmt(v, krw):
    return f"{v:,.0f}" if krw else f"{v:.2f}"


def pct(a, b):
    return (a / b - 1) * 100


def sp(v, d=1):
    """부호 있는 % — 진짜 마이너스 기호"""
    s = f"{abs(v):.{d}f}"
    if float(s) == 0:
        return s + "%"
    return ("+" if v > 0 else MINUS) + s + "%"


def eok(v):
    a = abs(v)
    s = f"{a/10000:.1f}조" if a >= 10000 else f"{a:,.0f}억"
    return ("+" if v > 0 else MINUS if v < 0 else "") + s


def strong_word(g):
    n = len(g["lines"])
    return "여러 기준이 겹친 자리예요" if n >= 4 else "기준 두세 개가 겹친 자리예요"


def rules_for(sym, r, jd, pos, fl=None, name=None):
    k, c = r["krw"], r["close"]
    f = lambda v: fmt(v, k)
    nm = name or (jd or {}).get("name") or sym
    A = []
    asof = r["asof"]
    df = pd.read_csv(ROOT / "data" / f"{sym}.csv")
    prev = float(df["close"].iloc[-2]) if len(df) > 1 else None

    def add(rule, tag, level, key, state, body, price=None):
        A.append(dict(rule=rule, tag=tag, level=level, key=key, title=f"{nm} · {state}", state=state, body=body, text=body, price=price))

    # 1) 손절 — 보유 종목만, 끌 수 없음
    if pos and pos.get("stop") and pos.get("qty"):
        st = pos["stop"]
        if c < st:
            add("손절 이탈", "stop", "dn", f"{sym}:stop_break", "손절선 아래 마감",
                f"{f(c)}으로 마감해 손절선({f(st)}) 아래예요. 규칙대로면 {pos.get('lot','')}분 정리 — 다음 장 시작가 확인.", st)
        elif pct(c, st) <= 1.0:
            add("손절 근접", "stop", "warn", f"{sym}:stop_near", "손절 근접",
                f"손절선 {f(st)}까지 {sp(pct(st, c))}. 오늘 종가로만 판단하세요.", st)
    tl = r.get("trend_upper")
    tl_fired = False
    # 2) 하락 흐름 끊김 (하락 추세선 종가 돌파) — 처음 넘은 날만
    if tl and prev:
        v = tl["value_today"]; v_prev = v - tl["slope_per_bar"]
        if c > v and prev <= v_prev:
            tl_fired = True
            add("추세선 돌파", "go", "up", f"{sym}:tl_break:{asof}", "하락 흐름 끊김",
                f"{f(c)}으로 마감해 흐름선({f(v)}) 위로 올라섰어요. 내일도 위면 1/3 매수 검토.", v)
    low = r.get("trend_lower")
    if low and prev:
        v = low["value_today"]; v_prev = v - low["slope_per_bar"]
        if c < v and prev >= v_prev:
            add("하단선 이탈", "etc", "dn", f"{sym}:tl_lower_break:{asof}", "아래 흐름선 이탈",
                f"{f(c)}으로 마감해 아래 흐름선({f(v)}) 밑으로 내려갔어요. 다음 바닥까지 밀릴 수 있어요.")
    # 3) 바닥 후보 · 막힐 자리 근접 (±2% 안에 유명한 선 2개 이상 겹침)
    for g in r.get("confluence") or []:
        below = g["price"] < c
        d = pct(g["price"], c)
        if below:
            add("합류 받침", "near", "ok", f"{sym}:conf:{round(g['price'], 2)}", "바닥 후보 근접",
                f"{f(g['price'])}까지 {sp(d)}. {strong_word(g)} — 반등을 확인하고 판단하세요.", g["price"])
        else:
            add("합류 천장", "near", "warn", f"{sym}:conf:{round(g['price'], 2)}", "막힐 자리 근접",
                f"{f(g['price'])}까지 {sp(d)}. 넘어서 마감하면 의미가 커요.", g["price"])
    # 보조) 매수 조건 충족 — 조건표 위 칸에 처음 들어온 날만 (흐름선 돌파 알림과 겹치면 생략)
    if jd and jd.get("chip") in ("enter", "target") and jd.get("days_up", 1) <= 1 and not (tl_fired and jd.get("kind_top") == "trend"):
        top = jd.get("top")
        if jd.get("chip") == "target":
            add("진입 조건", "go", "up", f"{sym}:enter:{asof}", "다음 차수 조건",
                f"{f(c)}으로 마감해 {f(top)} 위예요. 계획대로 다음 차수를 검토하세요." if top else jd["status"])
        elif jd.get("kind_top") == "trend":
            add("진입 조건", "go", "up", f"{sym}:enter:{asof}", "하락 흐름 끊김",
                f"{f(c)}으로 마감해 흐름선({f(top)}) 위로 올라섰어요. 내일도 위면 1/3 매수 검토." if top else jd["status"])
        else:
            add("진입 조건", "go", "up", f"{sym}:enter:{asof}", "매수 조건 충족",
                f"{f(c)}으로 마감해 매수 조건({f(top)})을 채웠어요. 계획대로 1/3만." if top else jd["status"])
    # 보조) 많이 팔린 상태 진입 (RSI 30 하향 돌파)
    rv = r.get("rsi_volume", {})
    if rv.get("rsi", 50) < 30 <= rv.get("rsi_prev", 50):
        add("RSI 과매도", "etc", "ok", f"{sym}:rsi30:{asof}", "많이 팔린 상태",
            f"RSI {rv['rsi']:.0f} · 거래량 평소의 {rv['vol_ratio']:.1f}배. 거래량이 늘며 오르면 바닥 신호로 올라가요.")
    # 보조) 수급 전환: 20일 순매도였는데 최근 5일 외국인+기관 순매수
    if fl and fl["fo"]["20"] <= 0 < fl["fo"]["5"]:
        add("수급 전환", "flow", "ok", f"{sym}:flow_turn:{fl['asof']}", "외국인·기관이 사기 시작",
            f"최근 5일 외국인·기관 {eok(fl['fo']['5'])} 순매수 (20일은 {eok(fl['fo']['20'])}). 바닥 후보·흐름선과 같이 확인하세요.")
    for a in A:
        a["symbol"] = sym; a["asof"] = asof
    return A


def outcome(e):
    """지난 알림이 다음 날 어떻게 됐나 — 알림 탭 '어제' 줄에 붙는 한 마디"""
    p = e.get("price")
    sym = e["symbol"]
    path = ROOT / "data" / f"{sym}.csv"
    if not p or not path.exists():
        return None
    df = pd.read_csv(path)
    df["date"] = df["date"].astype(str).str[:10]
    nxt = df[df["date"] > e["asof"]]
    before = df[df["date"] <= e["asof"]]
    if nxt.empty or before.empty:
        return None
    krw = sym.endswith((".KS", ".KQ"))
    f = lambda v: fmt(v, krw)
    n = nxt.iloc[0]; pc = float(before["close"].iloc[-1])
    hi, lo, c = float(n["high"]), float(n["low"]), float(n["close"])
    move = "상승" if c > pc else "하락" if c < pc else "보합"
    st = e.get("state", "")
    if st == "막힐 자리 근접":
        if hi >= p * 0.998:
            return f"넘어서 {f(c)} 마감" if c >= p else f"닿은 뒤 되밀려 {f(c)} 마감"
        return f"닿지 못하고 {move}"
    if st == "바닥 후보 근접":
        if lo <= p * 1.002:
            return f"닿고 버텨 {f(c)} 마감" if c >= p else f"아래로 {f(c)} 마감"
        return f"닿지 않고 {move}"
    if st == "하락 흐름 끊김":
        return f"다음 날도 흐름선 위 {f(c)}" if c >= p else f"다음 날 다시 아래 {f(c)}"
    if st == "손절 근접":
        return "손절선 아래 마감" if c < p else "손절선 위 유지"
    return None


def main():
    cfg = json.loads((ROOT / "positions.json").read_text(encoding="utf-8"))
    pos = {p["symbol"]: p for p in cfg["positions"]}
    names = cfg.get("names", {})
    jd = json.loads((OUT / "judgement.json").read_text(encoding="utf-8")) if (OUT / "judgement.json").exists() else {}
    sent_p = OUT / "alerts_sent.json"
    sent = json.loads(sent_p.read_text(encoding="utf-8")) if sent_p.exists() else {}
    log_p = OUT / "alerts_log.json"
    log = json.loads(log_p.read_text(encoding="utf-8")) if log_p.exists() else {}
    today = str(date.today())
    syms = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    fp = OUT / "flows.json"
    FL = json.loads(fp.read_text(encoding="utf-8")) if fp.exists() else {}
    alerts, new = [], []
    for s in syms:
        jp = OUT / f"{s}.json"
        if not jp.exists():
            continue
        r = json.loads(jp.read_text(encoding="utf-8"))
        nm = (jd.get(s) or {}).get("name") or names.get(s) or s
        for a in rules_for(s, r, jd.get(s), pos.get(s), FL.get(s), nm):
            alerts.append(a)
            if sent.get(a["key"]) != today:  # 규칙당 하루 1회
                new.append(a); sent[a["key"]] = today
    # 지난 알림 기록 (종가일 기준으로 묶음 — 같은 종가일을 두 번 돌려도 한 번만)
    for a in alerts:
        log.setdefault(a["asof"], {})[f"{a['symbol']}:{a['state']}"] = {k: a.get(k) for k in ("symbol", "rule", "tag", "level", "title", "state", "body", "asof", "price")}
    for d in sorted(log)[:-LOG_DAYS]:
        log.pop(d, None)
    for d, items in log.items():
        for e in items.values():
            if not e.get("after"):
                try:
                    o = outcome(e)
                    if o:
                        e["after"] = o
                except Exception as ex:  # 기록 보강 실패가 알림을 막지 않게
                    print("outcome skip", e.get("symbol"), repr(ex)[:60])
    (OUT / "alerts.json").write_text(json.dumps({"asof": today, "alerts": alerts, "new": new}, ensure_ascii=False, indent=1), encoding="utf-8")
    sent_p.write_text(json.dumps(sent, ensure_ascii=False, indent=1), encoding="utf-8")
    log_p.write_text(json.dumps(log, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for a in alerts:
        print(f"[{a['tag']}] {a['title']}: {a['body']}")
    return alerts, new


if __name__ == "__main__":
    main()
