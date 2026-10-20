"""alerts.py — 알림 규칙 엔진 (P1 3규칙 + 보조)
입력: out/<sym>.json, out/judgement.json, positions.json, data/<sym>.csv
출력: out/alerts.json  {"asof":..., "alerts":[{symbol, rule, level, text, key}]}
       out/alerts_sent.json  (key 별 마지막 발송일 — 규칙당 하루 1회)
실제 푸시 전송은 push.py (Supabase 구독 연결 후). 여기선 '무엇을 보낼지'만 결정.
"""
import json
from pathlib import Path
from datetime import date
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


def fmt(v, krw):
    return f"{v:,.0f}" if krw else f"{v:.2f}"


def pct(a, b):
    return (a / b - 1) * 100


def rules_for(sym, r, jd, pos, fl=None):
    k, c = r["krw"], r["close"]
    f = lambda v: fmt(v, k)
    A = []
    asof = r["asof"]
    # 전일 종가
    df = pd.read_csv(ROOT / "data" / f"{sym}.csv")
    prev = float(df["close"].iloc[-2]) if len(df) > 1 else None
    # 1) 손절선 ±1% 접근 / 종가 이탈
    if pos and pos.get("stop") and pos.get("qty"):
        st = pos["stop"]
        if c < st:
            A.append(dict(rule="손절 이탈", level="dn", key=f"{sym}:stop_break", text=f"종가 {f(c)} < 손절 {f(st)} — 규칙상 {pos.get('lot','')}분 정리. 장중 반응 말고 다음 장 시작가 확인."))
        elif pct(c, st) <= 1.0:
            A.append(dict(rule="손절 근접", level="warn", key=f"{sym}:stop_near", text=f"손절 {f(st)}까지 {pct(c, st):.1f}% — 오늘 밤 종가로만 판단."))
    # 2) 추세선 종가 돌파 / 이탈
    tl = r.get("trend_upper")
    if tl and prev:
        v = tl["value_today"]; v_prev = v - tl["slope_per_bar"]
        if c > v and prev <= v_prev:
            A.append(dict(rule="추세선 돌파", level="up", key=f"{sym}:tl_break:{asof}", text=f"하락 추세선 {f(v)}을 종가 {f(c)}로 돌파 — 추세 전환 1차 신호. 다음날 유지되면 2차."))
    low = r.get("trend_lower")
    if low and prev:
        v = low["value_today"]; v_prev = v - low["slope_per_bar"]
        if c < v and prev >= v_prev:
            A.append(dict(rule="하단선 이탈", level="dn", key=f"{sym}:tl_lower_break:{asof}", text=f"하단 추세선 {f(v)} 아래로 종가 마감 {f(c)} — 채널 이탈."))
    # 3) 합류 구간 진입 (±2%)
    for g in r.get("confluence") or []:
        below = g["price"] < c
        A.append(dict(rule="합류 받침" if below else "합류 천장", level="ok" if below else "warn", key=f"{sym}:conf:{round(g['price'], 2)}",
                      text=f"★{f(g['price'])} ({pct(g['price'], c):+.1f}%) = {' + '.join(g['lines'])} — " + ("튀어오를 수 있는 자리. 반등 확인 후 판단(바닥 보장 아님)." if below else "막힐 수 있는 자리. 종가로 넘으면 의미 큼.")))
    # 보조) 관찰 종목 진입 조건 충족
    if jd and jd.get("chip") == "enter":
        A.append(dict(rule="진입 조건", level="up", key=f"{sym}:enter:{asof}", text=jd["status"]))
    # 보조) RSI 30 하향 돌파
    rv = r.get("rsi_volume", {})
    if rv.get("rsi", 50) < 30 <= rv.get("rsi_prev", 50):
        A.append(dict(rule="RSI 과매도", level="ok", key=f"{sym}:rsi30:{asof}", text=f"RSI {rv['rsi']:.0f} — 과매도 진입. 거래량 {rv['vol_ratio']:.1f}×."))
    # 보조) 수급 전환: 20일 순매도였는데 최근 5일 외국인+기관 순매수
    if fl and fl["fo"]["20"] <= 0 < fl["fo"]["5"]:
        A.append(dict(rule="수급 전환", level="ok", key=f"{sym}:flow_turn:{fl['asof']}", text=f"외국인+기관 5일 {fl['fo']['5']:+,.0f}억 순매수 (20일은 {fl['fo']['20']:+,.0f}억) — 팔던 쪽이 사기 시작. 차트 받침·추세선과 같이 확인."))
    for a in A:
        a["symbol"] = sym; a["asof"] = asof
    return A


def main():
    cfg = json.loads((ROOT / "positions.json").read_text(encoding="utf-8"))
    pos = {p["symbol"]: p for p in cfg["positions"]}
    jd = json.loads((OUT / "judgement.json").read_text(encoding="utf-8")) if (OUT / "judgement.json").exists() else {}
    sent_p = OUT / "alerts_sent.json"
    sent = json.loads(sent_p.read_text(encoding="utf-8")) if sent_p.exists() else {}
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
        for a in rules_for(s, r, jd.get(s), pos.get(s), FL.get(s)):
            alerts.append(a)
            if sent.get(a["key"]) != today:  # 규칙당 하루 1회
                new.append(a); sent[a["key"]] = today
    (OUT / "alerts.json").write_text(json.dumps({"asof": today, "alerts": alerts, "new": new}, ensure_ascii=False, indent=1), encoding="utf-8")
    sent_p.write_text(json.dumps(sent, ensure_ascii=False, indent=1), encoding="utf-8")
    for a in alerts:
        print(f"[{a['level']}] {a['symbol']} {a['rule']}: {a['text']}")
    return alerts, new


if __name__ == "__main__":
    main()
