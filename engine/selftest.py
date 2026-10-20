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
sys.exit(0 if ok else 1)
