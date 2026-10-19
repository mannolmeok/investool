"""judge.py — P2 판단 보드
입력: positions.json + out/<SYM>.json (lines.py 결과)
출력: out/judgement.json  { symbol: {status, chip, rows[], watch_today[], plan[], risk{}, flags[]} }

원칙: 종가 기준. 문장은 가능성. 손절선 없는 보유 포지션은 flags 로 경고.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


def fmt(v, krw):
    return f"{v:,.0f}" if krw else f"{v:.2f}"


def pct(a, b):
    return (a / b - 1) * 100


def judge_one(p: dict, r: dict, rules: dict) -> dict:
    sym, krw, close = p["symbol"], r["krw"], r["close"]
    f = lambda v: fmt(v, krw)
    tl = r.get("trend_upper") or {}
    tl_val = tl.get("value_today")
    sma20 = (r.get("ma", {}).get("sma20") or {}).get("value")
    conf = r.get("confluence") or []
    flags, rows, watch_today = [], [], []
    held = bool(p.get("qty"))
    res = {"symbol": sym, "name": p.get("name") or rules.get("_names", {}).get(sym, sym), "lot": p.get("lot", ""), "asof": r["asof"], "close": close, "krw": krw, "held": held}

    if held:
        stop = p.get("stop")
        if stop is None:
            flags.append("손절선 없음 — 규칙 위반. 매수 전 손절선 필수.")
        avg = p["avg"]
        pl = pct(close, avg)
        res["pnl_pct"] = pl
        res["qty"], res["avg"] = p["qty"], avg
        if stop:
            room = pct(close, stop)
            res["stop"], res["stop_room_pct"] = stop, room
            risk_per_share = avg - stop
            res["r_now"] = (close - avg) / risk_per_share if risk_per_share > 0 else None
            t1 = (p.get("targets") or [None])[0]
            # 3행
            if t1:
                rows.append({"cond": f"≥ {f(t1)}", "action": "돌파 유지 → 다음 차수 검토", "tone": "up"})
            rows.append({"cond": f"{f(stop)} ~ {f(t1) if t1 else '…'}", "action": "보유 · 반등 확인 전 추가 매수 금지", "tone": "warn"})
            rows.append({"cond": f"< {f(stop)}", "action": f"{p.get('lot','')}분 정리" + (f" · 장기분은 {f(p['stop_long'])}" if p.get("stop_long") else ""), "tone": "down"})
            # 상태
            if close < stop:
                status, chip = f"종가 손절 이탈 ({f(close)} < {f(stop)}) — 규칙상 {p.get('lot','')}분 정리", "exit"
                if conf and conf[0]["price"] < close * 1.005 and conf[0]["price"] > stop * 0.97:
                    flags.append(f"손절선 바로 아래 ★합류 {f(conf[0]['price'])}가 있음 — '합류 이탈'을 최종 기준으로 쓸지는 규칙 선택(장기분 버퍼와 같은 논리). 결정은 아침에.")
            elif room <= rules.get("stop_warn_pct", 1.0):
                status, chip = f"경계선 보유 — 손절까지 {room:.1f}%", "warn"
            elif t1 and close >= t1:
                status, chip = f"1차 목표 {f(t1)} 도달 — 분할 청산/다음 차수 검토", "target"
            else:
                status, chip = f"보유 — 손절까지 {room:.1f}% 여유", "hold"
        else:
            status, chip = "보유 (손절선 미설정)", "warn"
        res["plan"] = p.get("plan", [])
    else:
        entry = p.get("entry") or {}
        inv = p.get("invalid")
        t = entry.get("type")
        if t == "close_above" and entry.get("level"):
            lvl = entry["level"]
            rows.append({"cond": f"≥ {f(lvl)} 종가", "action": f"진입 조건 충족 → 1/3 ({entry.get('why','')})", "tone": "up"})
            rows.append({"cond": f"{f(inv) if inv else '…'} ~ {f(lvl)}", "action": "조건 대기 · 관망", "tone": "warn"})
            if inv:
                rows.append({"cond": f"< {f(inv)}", "action": "시나리오 무효 — 관심 해제 검토", "tone": "down"})
            if close >= lvl:
                status, chip = f"진입 조건 충족 (종가 {f(close)} ≥ {f(lvl)})", "enter"
            elif inv and close < inv:
                status, chip = f"무효선 {f(inv)} 아래 — 시나리오 재검토", "exit"
            else:
                status, chip = f"조건 대기 — 진입선까지 {pct(lvl, close):+.1f}%", "wait"
        elif t == "close_above_trend" and tl_val:
            rows.append({"cond": f"≥ {f(tl_val)} 종가 (하락 추세선)", "action": "추세 전환 1차 → 1/3 검토", "tone": "up"})
            rows.append({"cond": f"< {f(tl_val)}", "action": "관망 · 추세선 아래선 매수 없음", "tone": "warn"})
            if close > tl_val:
                status, chip = f"추세선 종가 돌파 ({f(close)} > {f(tl_val)}) — 1차 전환 신호", "enter"
            else:
                status, chip = f"조건 대기 — 추세선까지 {pct(tl_val, close):+.1f}%", "wait"
        else:
            cb = [g for g in conf if g["price"] < close]; ca = [g for g in conf if g["price"] >= close]
            rv0 = r.get("rsi_volume", {})
            # 관찰 종목 기본 3행: 위 기준(추세선/천장) · 사이 · 아래 기준(받침/최근 저가)
            up_ref = tl_val if tl_val else (ca[0]["price"] if ca else None)
            sup_levels = [l["price"] for l in r.get("levels", []) if l["price"] < close]
            dn_ref = (cb[0]["price"] if cb else max(sup_levels) if sup_levels else r.get("keys", {}).get("recent_low10"))
            if up_ref and dn_ref and up_ref > dn_ref:
                rows.append({"cond": f"≥ {f(up_ref)} 종가", "action": ("하락 추세선 돌파 → 전환 1차, 1/3 검토" if tl_val else "천장 돌파 → 관심 ↑"), "tone": "up"})
                rows.append({"cond": f"{f(dn_ref)} ~ {f(up_ref)}", "action": "관망 · 기준선 사이", "tone": "warn"})
                rows.append({"cond": f"< {f(dn_ref)}", "action": "받침 이탈 → 다음 기준선까지 미끄러질 수 있음, 관심 해제 검토", "tone": "down"})
            if cb:
                status, chip = f"관망 — ★받침 {f(cb[0]['price'])} ({pct(cb[0]['price'], close):+.1f}%) 위. 반등 확인 전 진입 없음", "wait"
            elif ca:
                status, chip = f"관망 — ★천장 {f(ca[0]['price'])} ({pct(ca[0]['price'], close):+.1f}%) 아래. 종가 돌파 시 재검토", "wait"
            elif rv0.get("rsi", 50) < 30:
                status, chip = f"관망 — RSI {rv0['rsi']:.0f} 과매도, 받침은 없음. 거래량 동반 반등 기다림", "wait"
            else:
                status, chip = "관망 — 가까운 기준선 없음", "wait"

    # 오늘 볼 것 (공통)
    if tl_val:
        watch_today.append(f"하락 추세선 {f(tl_val)} ({pct(tl_val, close):+.1f}%) — 종가로 넘으면 추세 전환 1차")
    if sma20 and abs(pct(sma20, close)) <= 10:
        watch_today.append(f"20일선 {f(sma20)} ({pct(sma20, close):+.1f}%)")
    if conf:
        g = conf[0]
        watch_today.append(f"★합류 {f(g['price'])} ({pct(g['price'], close):+.1f}%): " + " + ".join(g["lines"]))
    rv = r.get("rsi_volume", {})
    if rv.get("rsi", 50) < 30:
        watch_today.append(f"RSI {rv['rsi']:.0f} 과매도 — 거래량 늘며 오르면 바닥 신호 승격")
    pat = r.get("pattern") or {}
    if pat.get("type"):
        watch_today.append(f"{pat['type']}" + (f" 꼭짓점까지 {pat['bars_to_apex']}봉" if pat.get("bars_to_apex") else "") + " — 상·하단 종가 이탈이 신호")

    res.update({"status": status, "chip": chip, "rows": rows, "watch_today": watch_today, "flags": flags, "note": p.get("note", "")})
    return res


def main():
    cfg = json.loads((ROOT / "positions.json").read_text(encoding="utf-8"))
    rules = cfg.get("rules", {})
    out = {}
    pos_by = {p["symbol"]: p for p in cfg["positions"]}
    wl = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    names = cfg.get("names", {})
    allp = [pos_by.get(s, {"symbol": s, "lot": "관찰", "name": names.get(s, s)}) for s in wl] + [p for s, p in pos_by.items() if s not in wl]
    for p in allp:
        jp = OUT / f"{p['symbol']}.json"
        if not jp.exists():
            out[p["symbol"]] = {"symbol": p["symbol"], "status": "분석 결과 없음", "chip": "none", "rows": [], "watch_today": [], "flags": []}
            continue
        r = json.loads(jp.read_text(encoding="utf-8"))
        out[p["symbol"]] = judge_one(p, r, rules)
    (OUT / "judgement.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for s, j in out.items():
        print(f"[{j.get('chip')}] {s}: {j['status']}")
        for fl in j.get("flags", []):
            print("   !", fl)
    return out


if __name__ == "__main__":
    main()
