"""selftest.py — 배치 전 자가 점검: 모든 데이터로 analyze 가 돌고 핵심 필드가 있는지"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from lines import analyze
ROOT = Path(__file__).resolve().parent.parent
ok = True
for p in sorted((ROOT / "data").glob("*.csv")):
    if p.stem.startswith("^") or p.stem.endswith((".w", ".m", ".h")):  # 주·월·1시간봉은 일봉 점검 대상 아님
        continue
    try:
        r = analyze(str(p))
        assert r["close"] > 0 and r["sentences"] and "rsi" in r["rsi_volume"]
        assert any(s.startswith("반대 근거") for s in r["sentences"])
        print(f"ok   {p.stem} {r['asof']} {r['close']}")
    except Exception as e:
        ok = False; print(f"FAIL {p.stem}: {e}")
# 국내 일봉 보충 (자정~아침 야후 공백) — 네트워크 없이 가짜 응답으로
try:
    from datetime import datetime
    import fetch as F
    K = F.KST
    T = lambda *a: int(datetime(*a, tzinfo=K).timestamp())
    H = {"timestamp": [T(2026, 10, 27, h) for h in range(9, 15)] + [T(2026, 10, 28, h) for h in range(9, 16)],
         "indicators": {"quote": [{"open": [100] * 13, "high": [110] * 12 + [105], "low": [90] * 13,
                                   "close": [100] * 12 + [105], "volume": [10] * 12 + [0]}]}}
    meta = {"regularMarketTime": T(2026, 10, 28, 15, 30), "regularMarketPrice": 105, "regularMarketDayHigh": 112,
            "regularMarketDayLow": 88, "regularMarketVolume": 80}
    have = {"2026-10-27": 78.0}
    assert F.kr_missing_day(meta, have, datetime(2026, 10, 29, 0, 44, tzinfo=K)) == "2026-10-28"
    assert F.kr_missing_day(meta, have, datetime(2026, 10, 28, 16, 0, tzinfo=K)) is None  # 아직 확정 전
    assert F.kr_missing_day(meta, {**have, "2026-10-28": 1.0}, datetime(2026, 10, 29, 1, 0, tzinfo=K)) is None  # 이미 있음
    assert F.kr_bar("2026-10-28", meta, H, have) == (100, 112, 88, 105, 80, "meta")
    assert F.kr_bar("2026-10-28", {"regularMarketTime": meta["regularMarketTime"]}, H, have) == (100, 110, 90, 105, 78, "추정")
    print("ok   국내 일봉 보충")
except Exception as e:
    ok = False; print(f"FAIL 국내 일봉 보충: {e!r}")
sys.exit(0 if ok else 1)
