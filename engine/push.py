"""push.py — 웹 푸시 전송
필요한 것: GitHub Secret VAPID_PRIVATE_KEY 1개 (+ 선택 VAPID_SUBJECT)
구독 목록: push_subs.json (앱 '알림 켜기' → 구독 코드 복사 → 이 파일에 추가). DB 없음.
          구독 정보만으로는 푸시를 보낼 수 없음(VAPID 비밀키 필요) → 저장소에 있어도 안전.
선택: SUPABASE_URL/SUPABASE_SERVICE_KEY 가 있으면 그 테이블 구독도 합쳐서 보냄.
동작: out/alerts.json 의 new[] 만 전송. 설정이 없으면 조용히 건너뜀.
      push_prefs.json (앱 설정 → 알림 스위치) 으로 종류별 끄기: {"go":true,"near":true,"flow":true,"etc":true}
      종목별 끄기: "mute": ["SYM", ...] (앱 내 종목 → ⋯ → 이 종목 알림 끄기)
      손절(stop)은 끌 수 없음 — 종목을 꺼도 손절 알림은 간다. 제목 = "종목 · 상태", 본문 = 가격 하나와 할 일.
사용: python engine/push.py            (새 알림 전송)
      python engine/push.py --test     (테스트 알림 1건)
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


def load_subs():
    subs = []
    f = ROOT / "push_subs.json"
    if f.exists():
        try:
            d = json.loads(f.read_text(encoding="utf-8") or "[]")
            subs += [{k: v for k, v in x.items() if not k.startswith("_")} for x in (d if isinstance(d, list) else [d])]
        except Exception as e:
            print("push_subs.json 읽기 실패:", e)
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        import requests
        rows = requests.get(f"{url}/rest/v1/push_subscriptions?select=sub", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20).json()
        subs += [r["sub"] for r in rows]
    seen, out = set(), []
    for s in subs:
        if s.get("endpoint") and s["endpoint"] not in seen:
            seen.add(s["endpoint"]); out.append(s)
    return out


def load_prefs():
    f = ROOT / "push_prefs.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    except Exception:
        d = {}
    pr = {"go": True, "near": True, "flow": True, "etc": True}
    pr.update({k: bool(v) for k, v in d.items() if k in pr})
    pr["stop"] = True  # 손절 알림은 끌 수 없음
    pr["mute"] = set(d.get("mute") or []) if isinstance(d.get("mute"), list) else set()
    return pr


def main():
    vpriv = os.environ.get("VAPID_PRIVATE_KEY")
    subj = os.environ.get("VAPID_SUBJECT") or "mailto:noreply@example.com"
    if not vpriv:
        print("push: VAPID_PRIVATE_KEY 없음 → 건너뜀"); return
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("push: pywebpush 미설치 → 건너뜀"); return
    subs = load_subs()
    if not subs:
        print("push: 구독 없음 (push_subs.json 비어 있음) → 건너뜀"); return
    if "--test" in sys.argv:
        new = [{"symbol": "investool", "rule": "테스트", "tag": "stop", "title": "investool · 시험 알림", "body": "이 기기에서 이 알림이 보이면 연결 완료예요."}]
    else:
        al = json.loads((OUT / "alerts.json").read_text(encoding="utf-8"))
        new = al.get("new") or []
    prefs = load_prefs()
    ok = lambda a: (prefs.get(a.get("tag", "etc"), True) and a.get("symbol") not in prefs["mute"]) or a.get("tag") == "stop"
    skipped = [a for a in new if not ok(a)]
    new = [a for a in new if ok(a)]
    if skipped:
        print(f"push: 설정으로 끈 알림 {len(skipped)}건 건너뜀")
    if not new:
        print("push: 새 알림 없음"); return
    names = json.loads((ROOT / "positions.json").read_text(encoding="utf-8")).get("names", {})
    sent = 0
    for a in new:
        title = a.get("title") or f"{names.get(a['symbol'], a['symbol'])} · {a['rule']}"
        body = a.get("body") or a.get("text", "")
        payload = json.dumps({"title": title, "body": body[:180], "url": f"./#/t/{a['symbol']}", "tag": a.get("tag", "")}, ensure_ascii=False)
        for s in subs:
            try:
                webpush(subscription_info=s, data=payload, vapid_private_key=vpriv, vapid_claims={"sub": subj}, ttl=3600)
                sent += 1
            except WebPushException as e:
                code = getattr(e.response, "status_code", None)
                print("push fail", code, "(404/410 = 만료된 구독, push_subs.json 에서 지우기)" if code in (404, 410) else str(e)[:120])
    print(f"push: {sent}건 전송 ({len(new)} 알림 × {len(subs)} 구독)")


if __name__ == "__main__":
    main()
