"""judge.py — P2 판단 보드 (v3.1: 상태는 조건표에서 나온다)
입력: positions.json + out/<SYM>.json (lines.py 결과) + data/<SYM>.csv (며칠째인지 셀 때)
출력: out/judgement.json  { symbol: {status, chip, zone, top, bottom, kind_top, days_up, rows[], watch_today[], plan[], flags[]} }

원칙
 - 종가 기준. 문장은 가능성. 손절선 없는 보유 포지션은 flags 로 경고.
 - 상태(chip)는 조건표 3행 중 '지금 종가가 어느 칸에 있나'로 정한다 → 조건표와 상태 문장이 어긋나지 않게.
   위 칸(≥ 위 기준) = enter/target, 가운데 = wait/hold, 아래 칸(< 아래 기준) = exit
 - 쉬운 말: 받침→바닥 후보, 천장→막힐 자리, 추세선→흐름선, 관망→기다림
 - 손절 여유는 '현재가에서 몇 % 내리면'(stop_dist_pct, 음수)로 쓴다.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
APEX_MAX = 60  # 수렴 꼭짓점이 이보다 멀면 의미 없는 숫자라 숨김


def fmt(v, krw):
    return f"{v:,.0f}" if krw else f"{v:.2f}"


def pct(a, b):
    return (a / b - 1) * 100


def closes_tail(sym, n=40):
    p = ROOT / "data" / f"{sym}.csv"
    if not p.exists():
        return []
    out = []
    for l in p.read_text(encoding="utf-8").strip().splitlines()[1:][-n:]:
        d, o, h, lo, c, v = l.split(",")[:6]
        try:
            out.append((d, float(c)))
        except ValueError:
            pass
    return out


def days_above(tail, asof, level, slope=0.0):
    """오늘부터 거꾸로, 종가가 선(level, 봉당 slope) 위에 있던 연속 일수"""
    if not tail or not level:
        return 0
    idx = next((i for i, (d, _) in enumerate(tail) if d == asof), len(tail) - 1)
    n = 0
    for k in range(idx + 1):
        if tail[idx - k][1] >= level - slope * k:
            n += 1
        else:
            break
    return n


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
    top = bottom = None
    kind_top = None
    days_up = 0
    tail = closes_tail(sym)

    if held:
        stop = p.get("stop")
        if stop is None:
            flags.append("손절선 없음 — 규칙 위반. 매수 전 손절선 필수.")
        avg = p["avg"]
        pl = pct(close, avg)
        res["pnl_pct"] = pl
        res["qty"], res["avg"] = p["qty"], avg
        res["targets"] = p.get("targets") or []
        res["since"] = p.get("since")
        if p.get("stop_long"):
            res["stop_long"] = p["stop_long"]
        kind_top = "next"
        if stop:
            room = pct(close, stop)                 # 예전 값(손절선 대비 +%) — 호환용
            dist = pct(stop, close)                 # 현재가에서 몇 % 내리면 손절 (음수)
            res["stop"], res["stop_room_pct"], res["stop_dist_pct"] = stop, room, dist
            risk_per_share = avg - stop
            res["r_now"] = (close - avg) / risk_per_share if risk_per_share > 0 else None
            t1 = (p.get("targets") or [None])[0]
            top, bottom = t1, stop
            if t1:
                rows.append({"cond": f"≥ {f(t1)}", "action": "다음 차수 검토", "tone": "up"})
            rows.append({"cond": f"{f(stop)} ~ {f(t1) if t1 else '…'}", "action": "보유 · 반등 확인 전 추가 매수 금지", "tone": "warn"})
            rows.append({"cond": f"< {f(stop)}", "action": f"{p.get('lot','')}분 정리" + (f" · 장기분은 {f(p['stop_long'])}" if p.get("stop_long") else ""), "tone": "down"})
            if close < stop:
                status, chip = f"손절선 {f(stop)} 아래 마감 — 규칙대로면 {p.get('lot','')}분 정리", "exit"
                if conf and conf[0]["price"] < close * 1.005 and conf[0]["price"] > stop * 0.97:
                    flags.append(f"손절선 바로 아래 바닥 후보 {f(conf[0]['price'])}가 있음 — '바닥 후보 이탈'을 최종 기준으로 쓸지는 규칙 선택(장기분 버퍼와 같은 논리). 결정은 아침에.")
            elif room <= rules.get("stop_warn_pct", 1.0):
                status, chip = f"손절 근접 — 현재가에서 {dist:.1f}% 내리면 손절", "warn"
            elif t1 and close >= t1:
                days_up = days_above(tail, r["asof"], t1)
                status, chip = f"{f(t1)} 위 마감 — 다음 차수 검토", "target"
            else:
                status, chip = f"보유 유지 — 손절까지 현재가에서 {dist:.1f}%", "hold"
        else:
            status, chip = "보유 (손절선 미설정)", "warn"
        res["plan"] = p.get("plan", [])
    else:
        entry = p.get("entry") or {}
        inv = p.get("invalid")
        t = entry.get("type")
        if t == "close_above" and entry.get("level"):
            lvl = entry["level"]
            kind_top, top, bottom = "entry", lvl, inv
            rows.append({"cond": f"≥ {f(lvl)} 종가", "action": f"매수 조건 충족 → 1/3" + (f" ({entry['why']})" if entry.get("why") else ""), "tone": "up"})
            rows.append({"cond": f"{f(inv) if inv else '…'} ~ {f(lvl)}", "action": "조건 대기 · 기다림", "tone": "warn"})
            if inv:
                rows.append({"cond": f"< {f(inv)}", "action": "시나리오 무효 → 관심 해제 검토", "tone": "down"})
            if close >= lvl:
                days_up = days_above(tail, r["asof"], lvl)
                status, chip = f"매수 조건 충족 — 종가 {f(close)} ≥ {f(lvl)}" + (f" · {days_up}일째" if days_up > 1 else ""), "enter"
            elif inv and close < inv:
                status, chip = f"무효선 {f(inv)} 아래 — 관심 해제 검토", "exit"
            else:
                status, chip = f"기다림 — 매수 조건까지 {pct(lvl, close):+.1f}%", "wait"
        elif t == "close_above_trend" and tl_val:
            kind_top, top = "trend", tl_val
            rows.append({"cond": f"≥ {f(tl_val)} 종가 (하락 흐름선)", "action": "하락 흐름 끊김 → 1/3 검토", "tone": "up"})
            rows.append({"cond": f"< {f(tl_val)}", "action": "기다림 · 흐름선 아래선 사지 않기", "tone": "warn"})
            if close >= tl_val:
                days_up = days_above(tail, r["asof"], tl_val, tl.get("slope_per_bar", 0))
                status, chip = f"하락 흐름 끊김 — 종가 {f(close)} ≥ 흐름선 {f(tl_val)}" + (f" · {days_up}일째" if days_up > 1 else ""), "enter"
            else:
                status, chip = f"기다림 — 흐름선까지 {pct(tl_val, close):+.1f}%", "wait"
        else:
            cb = [g for g in conf if g["price"] < close]; ca = [g for g in conf if g["price"] >= close]
            rv0 = r.get("rsi_volume", {})
            # 관찰 종목 기본 3행: 위 기준(흐름선/막힐 자리) · 사이 · 아래 기준(바닥 후보/받침/최근 저가)
            up_ref = tl_val if tl_val else (ca[0]["price"] if ca else None)
            sup_levels = [l["price"] for l in r.get("levels", []) if l["price"] < close]
            dn_ref = (cb[0]["price"] if cb else max(sup_levels) if sup_levels else r.get("keys", {}).get("recent_low10"))
            kind_top = "trend" if tl_val else "ceil"
            # 흐름선이 이미 아래에 있는데 아래 기준이 흐름선보다 위면(돌파 후) 아래 기준은 흐름선 아래 받침에서 찾음
            if up_ref and dn_ref and up_ref <= dn_ref:
                lower = [x for x in sup_levels + [g["price"] for g in cb] if x < up_ref]
                dn_ref = max(lower) if lower else None
            if up_ref and dn_ref and up_ref > dn_ref:
                top, bottom = up_ref, dn_ref
                rows.append({"cond": f"≥ {f(up_ref)} 종가", "action": ("하락 흐름 끊김 → 1/3 검토" if tl_val else "막힐 자리 돌파 → 관심 올리기"), "tone": "up"})
                rows.append({"cond": f"{f(dn_ref)} ~ {f(up_ref)}", "action": "기다림 · 반등 확인 전엔 사지 않기", "tone": "warn"})
                rows.append({"cond": f"< {f(dn_ref)}", "action": "바닥 무너짐 → 관심 해제 검토", "tone": "down"})
            elif up_ref:
                top = up_ref
                rows.append({"cond": f"≥ {f(up_ref)} 종가", "action": ("하락 흐름 끊김 → 1/3 검토" if tl_val else "막힐 자리 돌파 → 관심 올리기"), "tone": "up"})
                rows.append({"cond": f"< {f(up_ref)}", "action": "기다림", "tone": "warn"})
            # 상태 = 지금 종가가 조건표의 어느 칸인가
            if top and close >= top:
                days_up = days_above(tail, r["asof"], top, tl.get("slope_per_bar", 0) if (tl_val and abs(top / tl_val - 1) < 1e-9) else 0)
                ceil_note = f" · 바로 위 막힐 자리 {f(ca[0]['price'])} ({pct(ca[0]['price'], close):+.1f}%)" if ca else ""
                if tl_val:
                    status = f"하락 흐름 끊김 — 종가 {f(close)} ≥ 흐름선 {f(top)}" + (f" · {days_up}일째" if days_up > 1 else " · 내일도 위면 1/3 검토") + ceil_note
                else:
                    status = f"막힐 자리 {f(top)} 돌파 마감" + ceil_note
                chip = "enter"
            elif bottom and close < bottom:
                status, chip = f"바닥 {f(bottom)} 아래 마감 — 관심 해제 검토", "exit"
            elif cb and (not ca or abs(pct(cb[0]["price"], close)) <= abs(pct(ca[0]["price"], close))):
                status, chip = f"기다림 — 바닥 후보 {f(cb[0]['price'])} ({pct(cb[0]['price'], close):+.1f}%) 위. 반등 확인 전엔 사지 않기", "wait"
            elif ca:
                status, chip = f"기다림 — 막힐 자리 {f(ca[0]['price'])} ({pct(ca[0]['price'], close):+.1f}%) 아래. 넘어서 마감하면 다시 판단", "wait"
            elif rv0.get("rsi", 50) < 30:
                status, chip = f"기다림 — 많이 팔린 상태(RSI {rv0['rsi']:.0f}), 바닥 후보는 없음. 거래량 늘며 오르는지 보기", "wait"
            elif top:
                status, chip = f"기다림 — {'흐름선' if tl_val else '막힐 자리'}까지 {pct(top, close):+.1f}%", "wait"
            else:
                status, chip = "기다림 — 가까운 기준선 없음", "wait"

    # 오늘 볼 것 (공통)
    if tl_val:
        watch_today.append(f"하락 흐름선 {f(tl_val)} ({pct(tl_val, close):+.1f}%) — 종가로 넘으면 하락 흐름 끊김")
    if sma20 and abs(pct(sma20, close)) <= 10:
        watch_today.append(f"20일선 {f(sma20)} ({pct(sma20, close):+.1f}%)")
    if conf:
        g = conf[0]
        watch_today.append(f"{'바닥 후보' if g['price'] < close else '막힐 자리'} {f(g['price'])} ({pct(g['price'], close):+.1f}%): " + " + ".join(g["lines"]))
    rv = r.get("rsi_volume", {})
    if rv.get("rsi", 50) < 30:
        watch_today.append(f"많이 팔린 상태(RSI {rv['rsi']:.0f}) — 거래량 늘며 오르면 바닥 신호")
    pat = r.get("pattern") or {}
    bta = pat.get("bars_to_apex")
    if pat.get("type") in ("삼각수렴", "하락쐐기", "상승쐐기") and bta and bta <= APEX_MAX:
        watch_today.append(f"{pat['type']} 꼭짓점까지 {bta}봉 — 위·아래 중 먼저 종가로 깨지는 쪽이 신호")
    elif pat.get("type") == "박스":
        watch_today.append(f"박스 {f(pat['box_low'])}~{f(pat['box_high'])} — 위·아래 종가 이탈이 신호")

    res.update({"status": status, "chip": chip, "zone": ("up" if top and close >= top else "down" if bottom and close < bottom else "mid"),
                "top": top, "bottom": bottom, "kind_top": kind_top, "days_up": days_up,
                "rows": rows, "watch_today": watch_today, "flags": flags, "note": p.get("note", "")})
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
