# 앱 알림 켜기 (DB 없이, 3분)

Supabase 같은 데이터베이스는 필요 없습니다. 1인용이라 구독 정보는 저장소 파일 `push_subs.json` 하나로 충분해요.

## 1. 비밀키 1개 등록 (GitHub, 1분)
저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Secret |
|---|---|
| `VAPID_PRIVATE_KEY` | Claude가 채팅으로 준 값 그대로 |

(짝이 되는 공개키는 이미 `config.js` 에 들어가 있음)

## 2. 폰에서 구독 (1분)
1. 배포된 사이트를 폰에서 열기 → (아이폰) 공유 → **홈 화면에 추가** → 그 아이콘으로 열기
2. **알림** 탭 → **알림 켜기** → 허용 → 테스트 알림이 뜨면 OK
3. **구독 코드 복사** → Claude에게 붙여넣기 (또는 `push_subs.json` 의 `[ ]` 안에 붙여넣고 커밋)

## 3. 확인
Actions → daily → Run workflow. 새 알림이 있으면 폰으로 옵니다. (규칙당 하루 1회)

---
- 구독 코드만으로는 알림을 보낼 수 없습니다(비밀키 필요) → 저장소에 있어도 안전.
- 폰을 바꾸거나 앱을 지우면 2번만 다시.
- 여러 기기를 쓰려면 `push_subs.json` 에 코드를 여러 개 넣으면 됩니다.
