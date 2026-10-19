/* investool PWA — out/*.json + data/*.csv 를 읽어 데스크/종목 페이지를 그린다 */
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const C = { up: '#F25C5C', dn: '#4F9CF9', warn: '#F5A623', ok: '#3FBF7F', tag: '#B8A6FF', mut: '#8A8A8A', line: '#2A2A2A', txt: '#DCDDDE' };

const fmtP = (v, krw) => krw ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(2);
const pct = (a, b) => ((a / b - 1) * 100);
const sgn = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
const cls = v => v > 0 ? 'up' : v < 0 ? 'dn' : '';

async function loadWatchlist() {
  const t = await (await fetch('watchlist.txt', { cache: 'no-store' })).text();
  return t.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
}
let _judge = null;
async function loadJudge() { if (_judge) return _judge; try { _judge = await (await fetch('out/judgement.json', { cache: 'no-store' })).json(); } catch { _judge = {}; } return _judge; }
const CHIP = { exit: ['정리', 'dn'], warn: ['주의', 'warn'], hold: ['보유', 'ok'], target: ['목표', 'ok'], enter: ['진입', 'ok'], wait: ['관망', 'mut'], none: ['—', 'mut'] };
const chipHtml = j => { const [t, c] = CHIP[j?.chip] || CHIP.none; return `<span class="pill ${c}" style="border-color:currentColor;padding:1px 7px;font-size:11px">${t}</span>`; };
function judgeBoard(j, k) {
  if (!j || !j.rows) return '';
  const f = v => v;
  const rows = j.rows.map(r => `<div class="jrow ${r.tone}"><span class="mono">${r.cond}</span><span>${r.action}</span></div>`).join('');
  const plan = (j.plan || []).length ? `<table style="margin-top:6px"><thead><tr><th>차수</th><th>조건</th><th>금액</th><th>상태</th></tr></thead><tbody>${j.plan.map(p => `<tr><td class="mono">${p.n}차</td><td>${p.cond}</td><td class="mono">${p.amount}</td><td class="${/체결/.test(p.status) ? 'ok' : 'mut'}">${p.status}</td></tr>`).join('')}</tbody></table>` : '';
  const flags = (j.flags || []).map(x => `<div class="warn">! ${x}</div>`).join('');
  const wt = (j.watch_today || []).map(x => `<div>· ${x}</div>`).join('');
  const risk = j.held ? `<div class="mut">보유 ${j.qty}주 @ ${fmtP(j.avg, k)} · 손익 <b class="${cls(j.pnl_pct)}">${sgn(j.pnl_pct)}</b>${j.stop ? ` · 손절 ${fmtP(j.stop, k)} (여유 <b class="${j.stop_room_pct < 1 ? 'warn' : ''}">${j.stop_room_pct.toFixed(1)}%</b>)` : ''}${j.r_now != null ? ` · 현재 ${j.r_now.toFixed(2)}R` : ''}</div>` : '';
  return `<section><header><span>판단 보드 · 종가 기준</span>${chipHtml(j)}</header>
    <div class="sent"><div class="w" style="font-weight:600">${j.status}</div>${risk}${flags}</div>
    <div class="jrows">${rows}</div>
    ${plan ? `<div style="padding:0 12px 10px">${plan}</div>` : ''}
    <div class="sent" style="border-top:1px solid var(--line)"><div class="mut" style="padding-left:0;text-indent:0">오늘 볼 것</div>${wt}${j.note ? `<div class="mut">메모: ${j.note}</div>` : ''}</div></section>`;
}
let _attr = null;
async function loadAttr() { if (_attr) return _attr; try { _attr = await (await fetch('out/attribution.json', { cache: 'no-store' })).json(); } catch { _attr = {}; } return _attr; }
function attrBox(a) {
  const f = v => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%');
  const row = (n, v, sub) => `<div class="jrow"><span class="mono ${cls(v || 0)}">${f(v)}</span><span>${n}${sub ? ` <span class="mut">${sub}</span>` : ''}</span></div>`;
  return `<section><header><span>급락/급등 원인 분해 · ${a.asof}</span><small>하루 수익률 = 지수 + 업종 + 종목 고유</small></header>
    <div class="jrows">
      ${row('종목 하루 수익률', a.ret1, `5일 ${f(a.ret5)}`)}
      ${a.index ? row('지수 기여', a.index.contrib, `${a.index.symbol} ${f(a.index.ret1)} × β${a.index.beta.toFixed(1)}`) : ''}
      ${a.sector ? row('업종 기여', a.sector.excess1, `${a.sector.name} 피어 평균 ${f(a.sector.ret1)} (${a.sector.peers.join(', ')})`) : ''}
      ${row('종목 고유', a.idio, a.main_driver === '종목 고유' ? '<b class="warn">주원인</b>' : '')}
      ${row('거래량 / 20일', a.volume_ratio != null ? (a.volume_ratio - 1) * 100 : null, a.kind)}
    </div>
    <div class="sent"><div>· 주원인: <b class="w">${a.main_driver}</b>. ${a.sentence.split('. ').slice(-1)[0]}</div></div></section>`;
}
async function loadJson(sym) { try { return await (await fetch(`out/${sym}.json`, { cache: 'no-store' })).json(); } catch { return null; } }
async function loadCsv(sym) {
  const t = await (await fetch(`data/${sym}.csv`, { cache: 'no-store' })).text();
  return t.trim().split('\n').slice(1).map(l => { const [d, o, h, lo, c, v] = l.split(','); return { time: d, open: +o, high: +h, low: +lo, close: +c, volume: +v }; });
}
const sma = (rows, w) => rows.map((r, i) => i < w - 1 ? null : { time: r.time, value: rows.slice(i - w + 1, i + 1).reduce((a, b) => a + b.close, 0) / w }).filter(Boolean);

function setNav(name) { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name)); }
function stamp() { const d = new Date(); return d.toLocaleString('ko-KR', { hour12: false }); }

/* ---------------- 데스크 ---------------- */
async function renderDesk() {
  setNav('desk');
  const syms = await loadWatchlist();
  const J = await loadJudge();
  const items = (await Promise.all(syms.map(async s => ({ s, r: await loadJson(s) })))).filter(x => x.r);
  const rows = items.map(({ s, r }) => {
    const j = J[s];
    const k = r.krw, c = r.close;
    const ma20 = r.ma.sma20?.value, tl = r.trend_upper?.value_today, conf = r.confluence?.[0];
    const sup = r.levels.filter(l => l.price < c).sort((a, b) => b.price - a.price)[0];
    const chg = r.rsi_volume.chg_pct;
    const status = j ? `${chipHtml(j)} <span class="dim" style="font-size:11px">${j.status}</span>` : conf ? `<span class="ok">★ 합류 ${fmtP(conf.price, k)}</span>` : r.pattern?.type ? `<span class="warn">${r.pattern.type}</span>` : '<span class="mut">빈 공간</span>';
    return `<tr class="r" onclick="location.hash='#/t/${s}'">
      <td class="w">${s}<div class="mut" style="font-size:11px">${r.asof}</div></td>
      <td class="mono ${cls(chg)}">${fmtP(c, k)}<div style="font-size:11px">${sgn(chg)}</div></td>
      <td class="mono">${r.rsi_volume.rsi.toFixed(0)}${r.rsi_volume.rsi < 30 ? ' <span class="ok">과매도</span>' : r.rsi_volume.rsi > 70 ? ' <span class="warn">과매수</span>' : ''}</td>
      <td class="mono">${tl ? fmtP(tl, k) + ' <span class="' + cls(pct(tl, c)) + '">' + sgn(pct(tl, c)) + '</span>' : '—'}</td>
      <td class="mono">${ma20 ? fmtP(ma20, k) + ' <span class="' + cls(pct(ma20, c)) + '">' + sgn(pct(ma20, c)) + '</span>' : '—'}</td>
      <td class="mono">${sup ? fmtP(sup.price, k) + ' <span class="mut">' + sgn(pct(c, sup.price)) + ' 위</span>' : fmtP(r.keys.recent_low10, k) + ' <span class="mut">최근저가</span>'}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
  main.innerHTML = `
    <div class="bar"><h1>데스크</h1><span class="mono mut" style="font-size:12px">야후 일봉 · 15분 지연 · 평일 15:40 / 05:10 KST 자동 갱신</span><span class="tag" style="margin-left:auto">P1</span></div>
    <section><header><span>관심 종목 ${items.length}</span><small>행 클릭 → 종목 페이지</small></header>
    <table><thead><tr><th>종목</th><th>종가</th><th>RSI</th><th>추세선(상) 오늘</th><th>20일선</th><th>1차 지지</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></section>
    <section><header><span>오늘 한 줄</span><small>각 종목 합류/패턴 문장만</small></header><div class="sent">${items.map(({ s, r }) => {
      const pick = r.sentences.find(x => x.startsWith('★')) || r.sentences.find(x => /쐐기|삼각|박스/.test(x)) || r.sentences[1];
      return `<div><b class="w">${s}</b> — ${pick}</div>`; }).join('')}</div></section>
    <section><header><span>규칙</span><small>CLAUDE.md</small></header><div class="sent">
      <div>· 모든 판단은 종가 기준. 장중 흔들림은 무시.</div><div>· 손절선 없이 매수 없음. 반등 확인 전 물타기 금지.</div><div>· 문장은 가능성 표현. 확률 숫자 없음. 반대 근거 1줄 필수.</div></div></section>`;
  $('#foot').textContent = `읽음 ${stamp()}`;
}

/* ---------------- 종목 페이지 ---------------- */
async function renderTicker(sym) {
  setNav('desk');
  const [r, rows, J, A] = await Promise.all([loadJson(sym), loadCsv(sym), loadJudge(), loadAttr()]);
  const a = A[sym];
  const j = J[sym];
  if (!r) { main.innerHTML = `<div class="bar"><h1>${sym}</h1><span class="mut">분석 결과 없음 — 다음 배치 후 생성</span></div>`; return; }
  const k = r.krw, c = r.close, f = v => fmtP(v, k);
  const conf = r.confluence || [];
  const near = Math.abs(pct(r.keys.recent_low10, c));
  const status = conf.length ? `<span class="pill ok" style="border-color:#3FBF7F">★ 합류 ${f(conf[0].price)} (${sgn(pct(conf[0].price, c))})</span>` : `<span class="pill mut" style="border-color:#3A3A3A">겹치는 선 없음</span>`;
  const lineRows = [];
  Object.entries(r.ma).forEach(([n, v]) => lineRows.push([n.toUpperCase(), v.value, '#7C9CFF']));
  r.levels.forEach(l => lineRows.push([(l.price < c ? '수평 지지' : '수평 저항') + ` (${l.touches}회)`, l.price, l.price < c ? C.ok : C.warn]));
  if (r.trend_upper) lineRows.push([`${r.trend_upper.slope_per_bar < 0 ? '하락' : '상단'} 추세선 ${r.trend_upper.from}→${r.trend_upper.to}`, r.trend_upper.value_today, C.warn]);
  if (r.trend_lower) lineRows.push([`${r.trend_lower.slope_per_bar > 0 ? '상승' : '하단'} 추세선 ${r.trend_lower.from}→${r.trend_lower.to}`, r.trend_lower.value_today, C.warn]);
  Object.entries(r.fib.levels).forEach(([n, v]) => lineRows.push([`피보 ${n}`, v, C.tag]));
  lineRows.push(['볼린저 하단', r.bollinger.lower, '#7C9CFF'], ['볼린저 상단', r.bollinger.upper, '#7C9CFF'], ['52주 저점', r.keys.w52_low, C.dn], ['최근 저가(10일)', r.keys.recent_low10, C.dn]);
  lineRows.sort((a, b) => b[1] - a[1]);
  const lt = lineRows.map(([n, v, col]) => `<span class="n" style="color:${col}">${n}</span><span>${f(v)}</span><span class="${cls(pct(v, c))}">${sgn(pct(v, c))}</span>`).join('');
  const pat = r.pattern?.type ? `${r.pattern.type}${r.pattern.bars_to_apex ? ` · 꼭짓점까지 ${r.pattern.bars_to_apex}봉` : ''}` : '패턴 없음';
  main.innerHTML = `
    <div class="bar"><a href="#/" class="mut" style="text-decoration:none">‹</a><h1>${sym}</h1>
      <span class="mono ${cls(r.rsi_volume.chg_pct)}" style="font-size:18px;font-weight:600">${f(c)} ${sgn(r.rsi_volume.chg_pct)}</span>
      <span class="mono mut" style="font-size:12px">${r.asof} 종가 · 야후 15분 지연</span>
      <span style="margin-left:auto">${status}</span></div>
    <div class="grid2">
      <section><header><span>일봉 · 선 8종</span><small>${pat}</small></header><div id="chart"></div>
        <div class="cells">
          <div><div class="k">RSI 14</div><div class="v mono ${r.rsi_volume.rsi < 30 ? 'ok' : r.rsi_volume.rsi > 70 ? 'warn' : ''}">${r.rsi_volume.rsi.toFixed(0)}</div></div>
          <div><div class="k">거래량/20일</div><div class="v mono">${r.rsi_volume.vol_ratio.toFixed(1)}×</div></div>
          <div><div class="k">배열</div><div class="v">${r.ma_arrangement || '—'}</div></div>
          <div><div class="k">볼린저</div><div class="v">${r.bollinger.close_vs === 'below' ? '<span class="warn">하단 밖</span>' : r.bollinger.close_vs === 'above' ? '<span class="warn">상단 밖</span>' : '안'}${r.bollinger.width_pct_rank_60 <= .1 ? ' <span class="warn">스퀴즈</span>' : ''}</div></div>
          <div><div class="k">최근 저가까지</div><div class="v mono ${near < 2 ? 'warn' : ''}">${sgn(-near)}</div></div>
        </div></section>
      <section><header><span>선 목록 · 오늘 값</span><small>현재가 대비</small></header><div class="lines">${lt}</div></section>
    </div>
    ${judgeBoard(j, k)}
    ${a ? attrBox(a) : ''}
    <section><header><span>해석</span><small>규칙 기반 · 가능성 표현 · 반대 근거 포함</small></header>
      <div class="sent">${r.sentences.map(s => `<div class="${s.startsWith('★') ? 'conf' : s.startsWith('반대 근거') ? 'counter' : ''}">· ${s}</div>`).join('')}</div></section>
    <section><header><span>정적 이미지</span><small>배치가 만든 PNG (동일 내용)</small></header><img src="out/${sym}.png" style="width:100%;display:block"></section>`;
  drawChart(rows, r);
  $('#foot').textContent = `${sym} · ${stamp()}`;
}

function drawChart(rows, r) {
  const el = $('#chart'); const k = r.krw;
  const chart = LightweightCharts.createChart(el, {
    layout: { background: { color: '#1E1E1E' }, textColor: C.mut, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 },
    grid: { vertLines: { color: C.line }, horzLines: { color: C.line } },
    rightPriceScale: { borderColor: C.line }, timeScale: { borderColor: C.line, rightOffset: 8 },
    crosshair: { mode: 0 }, localization: { locale: 'ko-KR', priceFormatter: v => fmtP(v, k) },
  });
  const cs = chart.addCandlestickSeries({ upColor: C.up, downColor: C.dn, borderVisible: false, wickUpColor: C.up, wickDownColor: C.dn });
  cs.setData(rows);
  const vs = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  vs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  vs.setData(rows.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(242,92,92,.45)' : 'rgba(79,156,249,.45)' })));
  [[20, '#7C9CFF'], [60, '#E8891D'], [120, '#B8A6FF'], [200, '#FFFFFF']].forEach(([w, col]) => {
    if (rows.length >= w) chart.addLineSeries({ color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(sma(rows, w));
  });
  // 수평선들
  const pl = (price, color, title, style = 2) => cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
  r.levels.forEach(l => pl(l.price, l.price < r.close ? C.ok : C.warn, `${l.price < r.close ? '지지' : '저항'} ${l.touches}회`));
  Object.entries(r.fib.levels).forEach(([n, v]) => pl(v, C.tag, `피보 ${n}`, 3));
  pl(r.keys.w52_low, C.dn, '52주 저점', 4);
  (r.confluence || []).forEach(g => pl(g.price, C.ok, '★ 합류', 0));
  // 추세선: from 날짜부터 마지막+6봉까지
  const idx = Object.fromEntries(rows.map((x, i) => [x.time, i]));
  const tl = (t, color) => {
    if (!t || idx[t.from] === undefined) return;
    const i0 = idx[t.from], n = rows.length, y0 = t.value_today - t.slope_per_bar * (n - 1 - i0);
    const pts = []; for (let i = i0; i < n; i++) pts.push({ time: rows[i].time, value: y0 + t.slope_per_bar * (i - i0) });
    chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: '추세선' }).setData(pts);
  };
  tl(r.trend_upper, C.warn); tl(r.trend_lower, C.warn);
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, rows.length - 90), to: rows.length + 6 });
  new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })).observe(el);
}

/* ---------------- 설정 / 알림 ---------------- */
async function renderSettings() {
  setNav('settings');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const ios = /iphone|ipad/i.test(navigator.userAgent); const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  main.innerHTML = `
    <div class="bar"><h1>알림 · 설정</h1></div>
    <section><header><span>앱 알림 (웹 푸시)</span><small>P1.5 — 구독 저장소(Supabase) 연결 전</small></header><div class="sent">
      <div>· 브라우저 지원: <b class="${supported ? 'ok' : 'dn'}">${supported ? '됨' : '안 됨'}</b> · 권한: <b>${perm}</b></div>
      ${ios && !standalone ? '<div class="warn">· 아이폰은 공유 → "홈 화면에 추가" 후 그 아이콘으로 열어야 알림이 옵니다.</div>' : ''}
      <div style="text-indent:0;padding-left:0"><button class="btn pri" id="btnNotif">알림 켜기</button> <span class="mut" id="notifMsg"></span></div>
      <div class="mut">· 규칙(P1): 손절선 ±1% 접근 · 추세선 종가 돌파/이탈 · 합류 구간 진입. 규칙당 하루 1회.</div></div></section>
    <section><header><span>관심 종목</span><small>watchlist.txt</small></header><div class="sent"><div>· 저장소의 <span class="mono">watchlist.txt</span>에 야후 심볼 한 줄 추가 → 다음 배치부터 반영 (코스피 .KS / 코스닥 .KQ)</div></div></section>`;
  $('#btnNotif').onclick = async () => {
    const m = $('#notifMsg');
    if (!supported) { m.textContent = '이 브라우저는 푸시를 지원하지 않아요.'; return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { m.textContent = '권한이 거부됐어요.'; return; }
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('investool', { body: '알림이 켜졌어요. 서버 연결(Supabase)은 다음 단계에서.', icon: 'icons/icon-192.png' });
    m.textContent = '테스트 알림을 보냈어요 (서버 구독 저장은 P1.5).';
  };
}

function renderStub(name, phase) {
  setNav(name);
  main.innerHTML = `<div class="bar"><h1>${name === 'screener' ? '스크리너' : '일지'}</h1><span class="tag">${phase}</span></div><section><div class="sent"><div class="mut">로드맵 ${phase}에서 구현. 지금은 데스크 · 종목 페이지만.</div></div></section>`;
}

function route() {
  const h = location.hash || '#/';
  const m = h.match(/^#\/t\/(.+)$/);
  if (m) return renderTicker(decodeURIComponent(m[1]));
  if (h === '#/screener') return renderStub('screener', 'P3');
  if (h === '#/journal') return renderStub('journal', 'P3');
  if (h === '#/settings') return renderSettings();
  return renderDesk();
}
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
