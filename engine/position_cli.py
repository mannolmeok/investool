"""position_cli.py — 앱에서 보낸 매매 입력을 positions.json · trades.json 에 반영 (매매 기록 = 일지)
사용: python engine/position_cli.py '{"action":"buy","symbol":"INFQ","qty":100,"price":8.8,"stop":8.4}'
action
  buy    : 매수. 보유 중이면 평단 재계산(가중평균). 처음이면 손절선 필수(규칙: 손절선 없이 매수 없음)
  sell   : 매도. 실현손익·R배수 기록. 다 팔면 관찰 종목으로 돌림
  set    : 손절선·장기 손절선·목표가·구분(lot)·메모 변경
  remove : 포지션 항목 삭제 (관심 종목은 그대로)
trades.json: [{id, date, symbol, name, side, qty, price, amount, stop, avg_before, realized, r, memo, rule}]
"""
import json, sys, uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))
WATCH_TAG = "# --- 스크리너 (자동 · 주 1회 교체) ---"


def load(p, default):
    f = ROOT / p
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else default


def save(p, v):
    (ROOT / p).write_text(json.dumps(v, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fnum(x):
    return None if x in (None, "", "null") else float(x)


def ensure_watch(sym):
    wl = ROOT / "watchlist.txt"
    lines = wl.read_text().splitlines()
    if WATCH_TAG in lines and sym in [l.strip() for l in lines[lines.index(WATCH_TAG):]]:
        lines = [l for i, l in enumerate(lines) if not (i > lines.index(WATCH_TAG) and l.strip() == sym)]  # 자동 구간에 있으면 고정 구간으로 옮김
    elif sym in [l.strip() for l in lines]:
        return
    if WATCH_TAG in lines:  # 스크리너 구간 위(핵심 관심 종목)에 넣는다
        i = lines.index(WATCH_TAG)
        while i > 0 and not lines[i - 1].strip():
            i -= 1
        lines.insert(i, sym)
    else:
        lines.append(sym)
    wl.write_text("\n".join(lines) + "\n")


def main(op):
    cfg = load("positions.json", {"rules": {}, "positions": [], "names": {}})
    trades = load("trades.json", [])
    sym = op["symbol"].strip().upper()
    name = op.get("name") or cfg.get("names", {}).get(sym) or sym
    if op.get("name"):
        cfg.setdefault("names", {})[sym] = op["name"]
    pos = next((p for p in cfg["positions"] if p["symbol"] == sym), None)
    act = op["action"]
    today = op.get("date") or datetime.now(KST).strftime("%Y-%m-%d")
    qty, price = fnum(op.get("qty")), fnum(op.get("price"))
    tr = {"id": op.get("id") or uuid.uuid4().hex[:10], "date": today, "symbol": sym, "name": name, "side": act, "memo": op.get("memo", "")}

    if act == "buy":
        assert qty and qty > 0 and price and price > 0, "수량·가격 필요"
        held = pos and pos.get("qty")
        stop = fnum(op.get("stop")) or (pos.get("stop") if held else None)
        assert stop, "손절선 없이 매수 없음 — 손절선을 입력하세요"
        assert stop < price, "손절선은 매수가보다 낮아야 해요"
        if not pos:
            pos = {"symbol": sym, "name": name}; cfg["positions"].append(pos)
        before = pos.get("avg")
        if held:
            pos["avg"] = round((pos["avg"] * pos["qty"] + price * qty) / (pos["qty"] + qty), 4)
            pos["qty"] = pos["qty"] + qty
        else:
            lot = op.get("lot") or (pos.get("lot") if pos.get("lot") not in (None, "관찰") else "단기")
            pos.update({"qty": qty, "avg": price, "lot": lot})
            for k in ("entry", "invalid"):
                pos.pop(k, None)
        pos["stop"] = stop
        if op.get("stop_long"): pos["stop_long"] = fnum(op["stop_long"])
        if op.get("targets"): pos["targets"] = [float(t) for t in op["targets"] if t not in (None, "")]
        pos.setdefault("since", today)
        tr.update({"qty": qty, "price": price, "amount": round(qty * price, 2), "stop": stop, "avg_before": before,
                   "risk": round((price - stop) * qty, 2), "rule": "ok"})
        ensure_watch(sym)

    elif act == "sell":
        assert pos and pos.get("qty"), "보유 중이 아니에요"
        assert qty and 0 < qty <= pos["qty"] + 1e-9, "보유 수량보다 많이 팔 수 없어요"
        assert price and price > 0, "가격 필요"
        avg, stop = pos["avg"], pos.get("stop")
        realized = round((price - avg) * qty, 2)
        r_mult = round((price - avg) / (avg - stop), 2) if stop and avg > stop else None
        # 규칙 채점: 손절선 아래에서 판 경우 → 손절이 늦었는지 (1% 이상 아래면 '늦은 손절')
        rule = "ok"
        if stop and price < stop * 0.99:
            rule = "late_stop"
        elif stop and price <= stop * 1.01:
            rule = "stop"
        tr.update({"qty": qty, "price": price, "amount": round(qty * price, 2), "avg_before": avg, "stop": stop,
                   "realized": realized, "r": r_mult, "rule": rule})
        pos["qty"] = round(pos["qty"] - qty, 6)
        if pos["qty"] <= 1e-9:
            keep = {k: pos[k] for k in ("symbol", "name", "note") if k in pos}
            keep["lot"] = "관찰"
            cfg["positions"][cfg["positions"].index(pos)] = keep

    elif act == "set":
        assert pos, "포지션이 없어요"
        for k in ("stop", "stop_long"):
            if op.get(k) not in (None, ""): pos[k] = fnum(op[k])
        if op.get("targets") is not None: pos["targets"] = [float(t) for t in op["targets"] if t not in (None, "")]
        for k in ("lot", "note"):
            if op.get(k) not in (None, ""): pos[k] = op[k]
        tr.update({"changes": {k: op.get(k) for k in ("stop", "stop_long", "targets", "lot", "note") if op.get(k) not in (None, "")}})

    elif act == "remove":
        cfg["positions"] = [p for p in cfg["positions"] if p["symbol"] != sym]
    else:
        raise SystemExit("알 수 없는 action: " + act)

    trades.append(tr)
    save("positions.json", cfg)
    save("trades.json", trades)
    print("OK", json.dumps(tr, ensure_ascii=False))
    return sym


if __name__ == "__main__":
    main(json.loads(sys.argv[1]))
