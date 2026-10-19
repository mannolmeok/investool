"""push.py — 웹 푸시 전송 (P1.5)
전제: Supabase 테이블 push_subscriptions(id, endpoint text unique, sub jsonb, created_at)
      GitHub Secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT(mailto:)
동작: out/alerts.json 의 new[] 만 전송 (규칙당 하루 1회는 alerts.py 가 보장)
설정이 없으면 조용히 건너뜀 (배치가 깨지지 않게).
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


def main():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    vpriv, vpub, subj = os.environ.get("VAPID_PRIVATE_KEY"), os.environ.get("VAPID_PUBLIC_KEY"), os.environ.get("VAPID_SUBJECT", "mailto:noreply@example.com")
    if not (url and key and vpriv):
        print("push: 설정 없음 → 건너뜀"); return
    try:
        import requests
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("push: pywebpush/requests 미설치 → 건너뜀"); return
    al = json.loads((OUT / "alerts.json").read_text(encoding="utf-8"))
    new = al.get("new") or []
    if not new:
        print("push: 새 알림 없음"); return
    subs = requests.get(f"{url}/rest/v1/push_subscriptions?select=endpoint,sub", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20).json()
    sent = 0
    for a in new:
        payload = json.dumps({"title": f"{a['symbol']} · {a['rule']}", "body": a["text"][:160], "url": f"./#/t/{a['symbol']}"}, ensure_ascii=False)
        for s in subs:
            try:
                webpush(subscription_info=s["sub"], data=payload, vapid_private_key=vpriv, vapid_claims={"sub": subj}, ttl=3600)
                sent += 1
            except WebPushException as e:
                code = getattr(e.response, "status_code", None)
                if code in (404, 410):  # 만료 구독 삭제
                    requests.delete(f"{url}/rest/v1/push_subscriptions?endpoint=eq.{s['endpoint']}", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20)
                print("push fail", code, str(e)[:120])
    print(f"push: {sent}건 전송 ({len(new)} 알림 × {len(subs)} 구독)")


if __name__ == "__main__":
    main()
