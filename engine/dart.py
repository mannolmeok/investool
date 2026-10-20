"""dart.py — 금융감독원 OpenDART: 지배구조·회계 위험 체크 (DART_API_KEY 있을 때만)
워뇨띠: "지분구조가 난해하거나, 분할상장을 남발하거나, 실적을 조작하는 게 아니면"
 - 분할: 최근 3년 주요사항보고서 중 '분할' 결정 공시 (물적분할·인적분할)
 - 최대주주 지분율: 최근 사업보고서 최대주주+특수관계인 합계
 - 감사의견: 최근 사업보고서 감사의견이 '적정'이 아니면 경고
 - 상장 자회사: 타법인 출자현황 중 상장사(우리 유니버스 이름과 일치) 수
키가 없거나 호출이 실패하면 빈 결과 → 스크리너는 그대로 동작
"""
import io, json, os, time, zipfile, urllib.request, urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get("DART_API_KEY", "").strip()
BASE = "https://opendart.fss.or.kr/api/"
CACHE = ROOT / "out" / "dart_corp_codes.json"


def _get(path, **q):
    q["crtfc_key"] = KEY
    u = BASE + path + "?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(u, timeout=30) as r:
        return r.read()


def corp_codes():
    """stock_code(6자리) → corp_code(8자리). 30일 캐시"""
    if CACHE.exists() and time.time() - CACHE.stat().st_mtime < 30 * 86400:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    z = zipfile.ZipFile(io.BytesIO(_get("corpCode.xml")))
    root = ET.fromstring(z.read(z.namelist()[0]))
    m = {}
    for el in root.iter("list"):
        sc = (el.findtext("stock_code") or "").strip()
        if sc:
            m[sc] = el.findtext("corp_code")
    CACHE.write_text(json.dumps(m), encoding="utf-8")
    return m


def _json(path, **q):
    j = json.loads(_get(path, **q))
    return j.get("list") or [] if j.get("status") == "000" else []


def check(stock_code, corp_code, listed_names=()):
    out = {"flags": []}
    today = datetime.now()
    # 1) 최근 3년 분할 결정 (주요사항보고서 B001)
    try:
        L = _json("list.json", corp_code=corp_code, bgn_de=(today - timedelta(days=3 * 365)).strftime("%Y%m%d"),
                  end_de=today.strftime("%Y%m%d"), pblntf_detail_ty="B001", page_count=100)
        sp = [x for x in L if "분할" in x.get("report_nm", "") and "결정" in x.get("report_nm", "")]
        out["splits"] = [{"date": x["rcept_dt"], "title": x["report_nm"].strip()} for x in sp]
        if sp:
            out["flags"].append(f"최근 3년 분할 결정 {len(sp)}건")
    except Exception as e:
        out["err_split"] = repr(e)[:80]
    # 사업보고서 연도: 올해-1 (없으면 올해-2)
    for yr in (today.year - 1, today.year - 2):
        try:
            hs = _json("hyslrSttus.json", corp_code=corp_code, bsns_year=str(yr), reprt_code="11011")
            if not hs:
                continue
            tot = [x for x in hs if (x.get("nm") or "").strip() in ("계", "합계")]
            pct = tot[0].get("trmend_posesn_stock_qota_rt") if tot else None
            out["major_pct"] = float(str(pct).replace(",", "")) if pct not in (None, "-", "") else None
            out["report_year"] = yr
            break
        except Exception as e:
            out["err_major"] = repr(e)[:80]
    yr = out.get("report_year", today.year - 1)
    try:
        au = _json("accnutAdtorNmNdAdtOpinion.json", corp_code=corp_code, bsns_year=str(yr), reprt_code="11011")
        op = [x.get("adt_opinion", "") for x in au if x.get("bsns_year", "").startswith("제") or True]
        op = [o for o in op if o and o != "-"]
        out["audit"] = op[0] if op else None
        if out["audit"] and "적정" not in out["audit"]:
            out["flags"].append(f"감사의견 {out['audit']}")
    except Exception as e:
        out["err_audit"] = repr(e)[:80]
    try:
        inv = _json("otrCprInvstmntSttus.json", corp_code=corp_code, bsns_year=str(yr), reprt_code="11011")
        names = {(x.get("inv_prm") or "").replace("(주)", "").replace("㈜", "").strip() for x in inv}
        ls = sorted(n for n in names if n and n in set(listed_names))
        out["listed_subs"] = ls
        if len(ls) >= 2:
            out["flags"].append(f"상장 자회사 {len(ls)}개")
    except Exception as e:
        out["err_inv"] = repr(e)[:80]
    if out.get("major_pct") is not None and out["major_pct"] < 20:
        out["flags"].append(f"최대주주 지분 {out['major_pct']:.0f}% (경영권 분쟁·주주환원 변수)")
    return out


def enrich(rows, universe_names):
    """스크리너 후보 rows 에 dart 결과·플래그를 붙인다. 키 없으면 아무것도 안 함"""
    if not KEY:
        print("dart: DART_API_KEY 없음 → 건너뜀"); return
    try:
        cc = corp_codes()
    except Exception as e:
        print("dart: corpCode 실패", repr(e)[:100]); return
    for r in rows:
        c = cc.get(r["code"])
        if not c:
            continue
        try:
            d = check(r["code"], c, universe_names)
            r["dart"] = d
            r.setdefault("gov_flags", [])
            r["gov_flags"] += [f for f in d["flags"] if f not in r["gov_flags"]]
        except Exception as e:
            print("dart skip", r["name"], repr(e)[:80])
        time.sleep(0.15)
    print(f"dart: {sum(1 for r in rows if r.get('dart'))}개 확인")
