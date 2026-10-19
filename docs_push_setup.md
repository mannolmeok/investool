# 앱 알림(웹 푸시) 연결 — 5단계 (승민 할 일 약 10분)

1. **Supabase** 프로젝트 생성 (무료) → SQL Editor 에서:
   ```sql
   create table push_subscriptions (
     id bigserial primary key,
     endpoint text unique not null,
     sub jsonb not null,
     created_at timestamptz default now()
   );
   alter table push_subscriptions enable row level security;
   create policy "anon insert" on push_subscriptions for insert to anon with check (true);
   ```
   (anon 은 insert 만. 읽기/삭제는 service 키로 배치에서만.)
2. Supabase → Settings → API 에서 `Project URL`, `anon public` 키, `service_role` 키 복사.
3. **VAPID 키** 생성 (아무 터미널): `npx web-push generate-vapid-keys` → Public/Private 복사.
4. GitHub 저장소 → Settings → Secrets → Actions 에 추가:
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (`mailto:본인메일`)
5. `config.js` 에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY` 채워서 커밋.

그 다음 앱 → 알림 탭 → **알림 켜기** (아이폰은 홈 화면에 추가한 아이콘으로 열어서). 다음 배치부터 `out/alerts.json`의 새 알림이 푸시로 옴.
