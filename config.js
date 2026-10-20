/* 앱 설정 (공개해도 되는 값만).
   VAPID_PUBLIC_KEY: 웹 푸시 공개키. 짝이 되는 비밀키는 GitHub Secrets 의 VAPID_PRIVATE_KEY 에만 있음.
   SUPABASE_*: 선택. 비워두면 구독 정보를 push_subs.json 에 저장하는 방식(DB 없음, 1인용). */
window.INVESTOOL_CONFIG = {
  VAPID_PUBLIC_KEY: "BH5_qXvIZbO_lUkkiUQflaA7wjnJsOkJvCLx6uEoiKXE-N8988ayTOAzFdLbocIoG5ZcjlLbCKeIkflBCuyiX6c",
  QUOTE_URL: "",  // 실시간 시세 중계(Cloudflare Worker) 주소. 예: https://investool-quote.<이름>.workers.dev
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
