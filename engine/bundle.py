"""bundle.py — 데스크용 묶음 파일 out/desk.json (요청 50개 → 1개)
데스크가 쓰는 것만: 관심 종목 분석(전체)·판단·원인·알림·일정·성적표 요약·수급 요약·스파크라인용 최근 종가
배치 끝에 실행. 없으면 앱은 예전처럼 파일을 하나씩 읽음.
"""
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
CTX = ["^KS11", "^KQ11", "^GSPC", "^VIX", "SOXX", "IONQ", "RGTI", "QBTS", "KRW=X", "^TNX", "DX-Y.NYB", "EWY", "^IXIC"]


def rd(p):
    p = ROOT / p
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def tail_csv(sym, n=40):
    p = ROOT / "data" / f"{sym}.csv"
    if not p.exists():
        return []
    lines = p.read_text(encoding="utf-8").strip().splitlines()[1:]
    rows = []
    for l in lines[-n:]:
        d, o, h, lo, c, v = l.split(",")
        rows.append({"time": d, "close": float(c)})
    return rows


def main():
    wl = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    files = {}
    for f in ("out/judgement.json", "out/attribution.json", "out/alerts.json", "events.json"):
        v = rd(f)
        if v is not None:
            files[f] = v
    tr = rd("out/track.json")
    if tr:
        files["out/track.json"] = {"summary": tr["summary"]}
    fl = rd("out/flows.json")
    if fl:
        files["out/flows.json"] = {s: {k: v for k, v in x.items() if k not in ("daily", "cum")} for s, x in fl.items()}
    for s in wl:
        v = rd(f"out/{s}.json")
        if v is not None:
            files[f"out/{s}.json"] = v
    csv = {s: tail_csv(s) for s in wl + CTX}
    asof = max((v.get("asof", "") for k, v in files.items() if k.startswith("out/") and isinstance(v, dict) and "asof" in v), default="")
    built = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M")  # 앱 설정 '마지막 갱신'
    out = {"asof": asof, "built": built, "watchlist": wl, "files": files, "csv": csv}
    # 종목명 사전: 포지션 이름 + 스크리너 + 검색 기록 → out/names.json (스크리너·검색으로 들어간 종목도 이름으로 보이게)
    names = dict((rd("positions.json") or {}).get("names", {}))
    for r in (rd("out/screener.json") or {}).get("rows", []):
        if r.get("symbol"): names.setdefault(r["symbol"], r["name"])
    for r in (rd("out/lookup.json") or []):
        if r.get("symbol"): names.setdefault(r["symbol"], r["name"])
    (OUT / "names.json").write_text(json.dumps(names, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "desk.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":"), default=float), encoding="utf-8")
    print(f"desk.json {len(json.dumps(out, ensure_ascii=False, default=float))//1024}KB · 파일 {len(files)} · csv {len(csv)}")


if __name__ == "__main__":
    main()
