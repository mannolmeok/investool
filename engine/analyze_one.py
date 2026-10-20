"""analyze_one.py — 종목 하나를 바로 분석 (앱 '종목 찾기' / workflow_dispatch 입력)
사용: python engine/analyze_one.py "한화에어로스페이스" [--add]
     python engine/analyze_one.py 005930 / NVDA / 005930.KS
결과: data/<sym>.csv, out/<sym>.json, out/<sym>.png, out/lookup.json(마지막 조회), --add 면 watchlist 추가
"""
import sys, re, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import naver
from fetch import fetch
from render import render


def resolve(q):
    q = q.strip()
    if re.fullmatch(r"\d{6}\.(KS|KQ)", q, re.I):
        code = q[:6]; hits = naver.search(code)
        return q.upper(), (hits[0]["name"] if hits else code)
    if re.fullmatch(r"\d{6}", q) or re.search(r"[가-힣]", q):
        hits = naver.search(q)
        if not hits:
            raise SystemExit(f"'{q}' 국내 종목을 못 찾음")
        h = next((x for x in hits if x["name"] == q), hits[0])
        return naver.yahoo_symbol(h["code"], h["market"]), h["name"]
    return q.upper(), q.upper()  # 미국 티커


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    add = "--add" in sys.argv
    q = " ".join(args)
    sym, name = resolve(q)
    n = fetch(sym)
    if n < 130:
        raise SystemExit(f"{sym}: 데이터 {n}봉 — 분석에 부족(최소 130)")
    out = ROOT / "out"
    r = render(str(ROOT / "data" / f"{sym}.csv"), str(out / f"{sym}.png"))
    (out / f"{sym}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    # 이름 등록
    pj = ROOT / "positions.json"; cfg = json.loads(pj.read_text(encoding="utf-8"))
    cfg.setdefault("names", {})[sym] = name
    pj.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    wl = ROOT / "watchlist.txt"; lines = wl.read_text().splitlines()
    if add and sym not in [l.strip() for l in lines]:
        wl.write_text("\n".join(lines + [sym]) + "\n")
    from judge import main as judge_main
    judge_main()  # 판단 보드 갱신(관심 종목이면 카드에 반영)
    lf = out / "lookup.json"
    hist = json.loads(lf.read_text(encoding="utf-8")) if lf.exists() else []
    hist = [h for h in hist if h["symbol"] != sym]
    hist.insert(0, {"q": q, "symbol": sym, "name": name, "asof": r["asof"], "added": add})
    lf.write_text(json.dumps(hist[:40], ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"OK {sym} {name} asof {r['asof']} · " + " / ".join(r["sentences"][:2]))


if __name__ == "__main__":
    main()
