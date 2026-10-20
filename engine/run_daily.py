"""run_daily.py — 매일 배치: fetch → analyze → render → out/summary.md"""
import sys, json, subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
from lines import analyze
from render import render
from judge import main as judge_main
from attribution import main as attribution_main
from alerts import main as alerts_main
from track import main as track_main

KST = timezone(timedelta(hours=9))

def main():
    subprocess.run([sys.executable, str(ROOT / "engine/fetch.py")], check=False)
    syms = [s.strip() for s in (ROOT / "watchlist.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]
    out = ROOT / "out"; out.mkdir(exist_ok=True)
    md = [f"# 선 긋기 리포트 · {datetime.now(KST):%Y-%m-%d %H:%M} KST", "", "데이터: 야후 파이낸스 일봉(15분 지연) · 문장은 가능성 표현, 확률 아님", ""]
    for s in syms:
        csv = ROOT / "data" / f"{s}.csv"
        if not csv.exists():
            md.append(f"## {s}\n- 데이터 없음\n"); continue
        r = render(str(csv), str(out / f"{s}.png"))
        (out / f"{s}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
        md.append(f"## {s} · {r['asof']} 종가 {r['close']:,.2f}" if not r["krw"] else f"## {s} · {r['asof']} 종가 {r['close']:,.0f}")
        md.append(f"![{s}](./{s}.png)")
        md += ["- " + x for x in r["sentences"]]
        md.append("")
    try:
        from mtf import main as mtf_main
        mtf_main()
    except Exception as e:
        print('mtf fail', e)
    try:
        from flows import main as flows_main
        flows_main()
    except Exception as e:  # 네이버 장애가 배치를 막지 않게
        print('flows fail', e)
    try:
        from logos import main as logos_main
        logos_main()
    except Exception as e:
        print('logos fail', e)
    at = attribution_main()
    jd = judge_main()
    al, al_new = alerts_main()
    try:
        track_main()
    except Exception as e:  # 검증 로그 실패가 배치를 막지 않게
        print('track fail', e)
    md.append("## 알림")
    for a in al: md.append(f"- [{a['level']}] **{a['symbol']}** {a['rule']}: {a['text']}")
    md.append("")
    md.append("## 급락/급등 원인 분해")
    for sym, a in at.items(): md.append(f"- {a['sentence']}")
    md.append("")
    md.append("## 판단 보드")
    for sym, j in jd.items():
        md.append(f"- **{sym}** [{j.get('chip')}] {j['status']}")
        for fl in j.get('flags', []): md.append(f"  - ! {fl}")
    md.append("")
    (out / "summary.md").write_text("\n".join(md), encoding="utf-8")
    try:
        from bundle import main as bundle_main
        bundle_main()
    except Exception as e:
        print("bundle fail", e)
    print("\n".join(md))

if __name__ == "__main__":
    main()
