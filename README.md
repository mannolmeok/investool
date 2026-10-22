# investool — 바닥코치 (가칭)

개인용 주식 판단 보조 툴. **제일 유명한 선·지표를 자동으로 긋고, 한 문장으로 말해준다.**
전제: 유명한 선은 사람들이 따라가서 스스로 맞는다. 그러니 그 선들이 겹치는 자리(합류)를 찾는다.

## 지금 되는 것 (P1 완료 · P2 일부)
- `engine/fetch.py` — 야후 일봉 1년치 수집 (`watchlist.txt`)
- `engine/lines.py` — 선 8종: 이평 20/60/120/200 · 수평 지지저항(스윙 클러스터+매물대) · 추세선 · 박스/삼각/쐐기 · 전고저/52주 · 피보나치 · 볼린저 · RSI+거래량 → **합류 구간** → 해석 문장(+반대 근거 1줄)
- `engine/render.py` — 선 그어진 차트 PNG (상승 빨강 / 하락 파랑)
- `engine/judge.py` — 판단 보드(종가 기준 3행·상태 칩·분할 플랜) ← `positions.json`
- `engine/attribution.py` — 급락/급등 원인 분해(지수 β·업종 피어·종목 고유·거래량 성격) ← `sectors.json`, `context.txt`
- `engine/alerts.py` — 알림 규칙(손절 근접/이탈·하락 흐름 끊김·바닥 후보/막힐 자리 근접·조건 충족·많이 팔림·수급 전환) → `out/alerts.json` (제목 = 종목·상태, 본문 = 가격 하나와 할 일), 규칙당 하루 1회 · 지난 알림과 다음 날 결과 `out/alerts_log.json`
- `engine/backtest.py` — 워크포워드 검증 → `out/validation.md`
- `engine/push.py` — 웹 푸시 전송(설정 없으면 건너뜀) · 종류별 끄기 `push_prefs.json`(앱 설정 → `prefs.yml`) · 연결법 `docs_push_setup.md`
- `engine/run_daily.py` — 위 전부 + `out/summary.md`
- **앱(PWA) v3.1**: `index.html` `app.js` — 홈(오늘 할 일) / 종목(계기판 결론·조건표·가격 지도·근거 탭) / 발굴 / 기록 / 알림·설정. 모바일 1열 · PC 목록+종목 한 화면. GitHub Pages로 서빙 — 디자인 원칙은 `DESIGN_NOTES.md`
- GitHub Actions: 평일 15:40 KST(국내 마감) / 05:10 KST(미국 마감) 자동 실행 후 `out/` 커밋

## 파일로 조정하는 것
- `watchlist.txt` 관심 종목 · `context.txt` 지수/업종 대리 · `positions.json` 보유·규칙·한글명 · `sectors.json` 종목별 지수/피어 · `events.json` 일정

## 로컬 실행
```
pip install -r requirements.txt
python engine/run_daily.py
```

## 로드맵
P0 바닥 다지기 → **P1 선 긋기 엔진+종목 페이지** → P2 판단 보드·플랜 → P3 스크리너·일지 → P4 코치·거시·모바일
(디자인 시안·로드맵 보드는 Claude Design 캔버스 "주식 툴 1단계 화면 시안")

## 규칙
- 모든 판단은 종가 기준, 기준 시각·출처 표기
- 문장은 "가능성"으로만. 확률 숫자 금지. 반대 근거 1줄 필수
- 손절선 없이 매수 없음. 반등 확인 전 물타기 금지
