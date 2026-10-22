"""flows.py — 수급: '내 뒤에 사줄 사람이 있나'
관심 종목(국내)마다 최근 60거래일 외국인·기관·개인 순매수 (네이버 증권)
금액(억) ≈ 순매수 수량 × 그날 종가. 출력 out/flows.json
 - daily: 날짜별 외/기/개 금액, 외국인 보유율
 - cum: 누적 (차트용)
 - 요약: 5·20·60일 합, 외국인 연속 순매수/순매도 일수, 보유율 변화, 전환 신호, 한 줄 문장
"""
import json, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import naver


def analyze(code):
    t = list(reversed(naver.trend(code, 60)))  # 오래된 → 최근
    daily = []
    for x in t:
        c = x["close"] or 0
        daily.append({"d": x["date"], "f": round((x["foreign"] or 0) * c / 1e8, 1), "o": round((x["organ"] or 0) * c / 1e8, 1),
                      "i": round((x["indiv"] or 0) * c / 1e8, 1), "hr": x["foreign_ratio"], "c": c})
    if not daily:
        return None
    cum = {"f": [], "o": [], "i": []}; acc = {"f": 0, "o": 0, "i": 0}
    for d in daily:
        for k in acc:
            acc[k] += d[k]; cum[k].append(round(acc[k], 1))
    S = lambda k, n: round(sum(d[k] for d in daily[-n:]), 1)
    def streak(k):
        n = 0; sign = 1 if daily[-1][k] > 0 else -1 if daily[-1][k] < 0 else 0
        for d in reversed(daily):
            if sign and (d[k] > 0) == (sign > 0) and d[k] != 0: n += 1
            else: break
        return sign * n
    sm = {k: {"5": S(k, 5), "20": S(k, 20), "60": S(k, 60)} for k in ("f", "o", "i")}
    fo5, fo20, fo60 = (round(sm["f"][n] + sm["o"][n], 1) for n in ("5", "20", "60"))
    hr = [d["hr"] for d in daily if d["hr"] is not None]
    hr_chg = round(hr[-1] - hr[0], 2) if len(hr) > 1 else None
    # 상태: 전환(20일 매도 → 5일 매수) / 유입 / 이탈 / 혼조
    if fo20 <= 0 < fo5:
        state, tone = "전환 — 팔던 외국인·기관이 최근 5일 사기 시작", "ok"
    elif fo5 > 0 and fo20 > 0:
        state, tone = "유입 — 외국인·기관이 계속 사는 중", "up"
    elif fo5 < 0 and fo20 < 0:
        state, tone = "이탈 — 외국인·기관이 계속 파는 중 (개인이 받는 중)" if sm["i"]["20"] > 0 else "이탈 — 외국인·기관이 계속 파는 중", "dn"
    elif fo20 > 0 >= fo5:
        state, tone = "주춤 — 사던 외국인·기관이 최근 5일 멈춤/매도", "warn"
    else:
        state, tone = "혼조", "mut"
    fs = streak("f"); os_ = streak("o")
    bits = [state]
    if abs(fs) >= 3: bits.append(f"외국인 {abs(fs)}일 연속 {'순매수' if fs > 0 else '순매도'}")
    if abs(os_) >= 3: bits.append(f"기관 {abs(os_)}일 연속 {'순매수' if os_ > 0 else '순매도'}")
    if hr_chg is not None and abs(hr_chg) >= 0.3: bits.append(f"외국인 보유율 60일 {hr_chg:+.2f}%p")
    # v3.1: 문장을 둘로 — 60일 큰 흐름 / 최근 며칠 (한 문장에 섞어 쓰면 '사는 중'인지 '파는 중'인지 헷갈림)
    big, recent = big_recent(fo60, fo5, sm, fs, os_)
    return {"asof": daily[-1]["d"], "daily": daily, "cum": cum, "sum": sm, "fo": {"5": fo5, "20": fo20, "60": fo60},
            "streak": {"f": fs, "o": os_}, "hold": {"now": hr[-1] if hr else None, "chg60": hr_chg}, "state": state, "tone": tone,
            "big": big, "recent": recent, "sentence": " · ".join(bits)}


def _eok(v):
    a = abs(v)
    s = f"{a/10000:.1f}조" if a >= 10000 else f"{int(a + 0.5):,}억"
    return ("+" if v > 0 else "\u2212" if v < 0 else "") + s


def big_recent(fo60, fo5, sm, fs, os_):
    """60일 큰 흐름 한 줄 + 최근 며칠 한 줄"""
    big = (f"60일 큰 흐름 — 외국인·기관이 사는 쪽 ({_eok(fo60)}), 개인 {_eok(sm['i']['60'])}" if fo60 > 0
           else f"60일 큰 흐름 — 외국인·기관이 파는 쪽 ({_eok(fo60)}), 개인 {_eok(sm['i']['60'])}")
    r5 = f"5일 동안 {'사는 쪽' if fo5 > 0 else '파는 쪽'} ({_eok(fo5)})"
    who = []
    for nm, st in (("외국인", fs), ("기관", os_)):
        if abs(st) >= 3:
            who.append(f"{nm} {abs(st)}일 연속 {'순매수' if st > 0 else '순매도'}")
    if not who:
        buy = [nm for nm, st in (("외국인", fs), ("기관", os_)) if st > 0]
        sell = [nm for nm, st in (("외국인", fs), ("기관", os_)) if st < 0]
        if buy and sell:
            who.append(f"마지막 날은 {'·'.join(buy)} 사고 {'·'.join(sell)} 팔았어요")
        elif buy:
            who.append(f"마지막 날은 {'·'.join(buy)} 모두 샀어요" if len(buy) > 1 else f"마지막 날은 {buy[0]}이 샀어요")
        elif sell:
            who.append(f"마지막 날은 {'·'.join(sell)} 모두 팔았어요" if len(sell) > 1 else f"마지막 날은 {sell[0]}이 팔았어요")
    recent = "최근 며칠 — " + " · ".join([r5] + who)
    return big, recent


def main():
    syms = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    out = {}
    for s in syms:
        if not s.endswith((".KS", ".KQ")):
            continue
        try:
            r = analyze(s[:6])
            if r: out[s] = r
        except Exception as e:
            print("flows skip", s, repr(e)[:80])
        time.sleep(0.3)
    (ROOT / "out" / "flows.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for s, r in out.items():
        print(f"{s}: {r['sentence']} (외+기 5일 {r['fo']['5']:+.0f}억 / 20일 {r['fo']['20']:+.0f}억)")
    return out


if __name__ == "__main__":
    main()
