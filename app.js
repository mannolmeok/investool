/* investool v3.1 — 결론 먼저 · 쉬운 말 · 계기판 숫자
   데이터: out/*.json + data/*.csv (GitHub Actions 배치 결과) · 서버 없음. 판단은 언제나 종가 기준.
   화면: 홈(오늘 할 일) · 종목(지금 사? 팔아? 기다려?) · 발굴 · 기록 · 알림 — 모바일 1열 / PC(1024px+) 목록+종목 한 화면 */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { } },
  del: k => { try { localStorage.removeItem(k); } catch { } },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MINUS = '−';
const isKrw = s => /\.(KS|KQ)$/.test(s || '');
const fmtP = (v, krw) => v == null || !isFinite(v) ? '—' : krw ? Math.round(v).toLocaleString('ko-KR') : (+v).toFixed(2);
const pct = (a, b) => (a / b - 1) * 100;
/* 부호 있는 % (진짜 마이너스) — 0으로 반올림되면 부호 없음 */
const sgn = (v, d = 1) => { if (v == null || !isFinite(v)) return '—'; const s = Math.abs(v).toFixed(d); return (+s === 0 ? '' : v > 0 ? '+' : MINUS) + s + '%'; };
const sgnNum = (v, krw) => v == null || !isFinite(v) ? '—' : (Math.abs(v) < (krw ? 0.5 : 0.005) ? '' : v > 0 ? '+' : MINUS) + fmtP(Math.abs(v), krw);
const tone = v => v > 0 ? 'up' : v < 0 ? 'dn' : '';
const N = (t, cls = '') => `<span class="n${cls ? ' ' + cls : ''}">${t}</span>`;
const eok = v => { if (v == null || !isFinite(v)) return '—'; const a = Math.abs(v); const s = a >= 10000 ? (a / 10000).toFixed(a >= 100000 ? 0 : 1) + '조' : Math.round(a).toLocaleString('ko-KR') + '억'; return (Math.round(a) === 0 ? '' : v > 0 ? '+' : MINUS) + s; };
const capTxt = v => v == null ? '—' : v >= 10000 ? (v / 10000).toFixed(1) + '조' : Math.round(v).toLocaleString('ko-KR') + '억';
const md = d => { const m = String(d || '').match(/(\d{4})-?(\d{2})-?(\d{2})/); return m ? `${+m[2]}/${+m[3]}` : String(d || ''); };
const DOW = '일월화수목금토';
const dayStart = d => { const x = d ? new Date(d) : new Date(); x.setHours(0, 0, 0, 0); return x; };
const parseDay = s => { const m = String(s || '').match(/(\d{4})-?(\d{2})-?(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const dDays = s => { const d = parseDay(s); return d ? Math.round((d - dayStart()) / 864e5) : null; };
const todayLabel = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()} ${DOW[d.getDay()]}`; };
const isPC = () => matchMedia('(min-width:1024px)').matches;
const enc = encodeURIComponent;
const tHref = s => '#/t/' + enc(s);

/* ---------------- 아이콘 (24 그리드, 선 아이콘) */
const ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  floor: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  ceil: '<path d="M4 4h16"/><path d="M12 20V9"/><path d="M7 14l5-5 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  upr: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  dnr: '<path d="M7 7l10 10"/><path d="M17 8v9H8"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  sort: '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M8 19l-1 2"/><path d="M12 19l-1 2"/><path d="M16 19l-1 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  shieldx: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M17 6l3 3"/><path d="M15 8l2 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.7 0-2.8 1-2.8 2.1 0 2.8 5.6 1.4 5.6 4.1 0 1.1-1.2 2.1-2.8 2.1-1.1 0-2.2-.6-2.7-1.6"/><path d="M12 6.5V8"/><path d="M12 16.2v1.3"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
};
const ic = (n, z = 20, sw = 1.8, extra = '') => `<svg class="ico" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${ICON[n] || ''}</svg>`;
const icFill = (n, z = 20) => `<svg class="ico" width="${z}" height="${z}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

/* ---------------- 종목 로고 (logos/index.json 에 있으면 이미지, 없으면 첫 글자 배지) */
let LOGOS = {};
const LOGOS_READY = fetch('logos/index.json').then(r => r.ok ? r.json() : {}).then(j => { LOGOS = j || {}; }).catch(() => { });
function logoMono(sym, n, z) {
  let h = 0; for (const ch of String(sym)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<span class="lg mono-lg" style="width:${z}px;height:${z}px;font-size:${Math.round(z * 0.44)}px;background:hsl(${h} 32% 34%)" aria-hidden="true">${esc((n || sym || '?').replace(/^[^가-힣A-Za-z0-9]+/, '').slice(0, 1))}</span>`;
}
function logo(sym, name, z = 36) {
  if (LOGOS[sym] === 'png') return `<img class="lg" src="logos/${enc(sym)}.png" alt="" width="${z}" height="${z}" style="width:${z}px;height:${z}px" loading="lazy" onerror="this.outerHTML=logoMono(this.dataset.s,this.dataset.n,${z})" data-s="${esc(sym)}" data-n="${esc(name || sym)}">`;
  return logoMono(sym, name, z);
}

/* ---------------- 데이터 */
const cache = {};
async function j(url, fresh = false) {
  if (!fresh && url in cache) return cache[url];
  try { const r = await fetch(url, fresh ? { cache: 'no-store' } : undefined); cache[url] = r.ok ? await r.json() : null; } catch { cache[url] = null; }
  return cache[url];
}
async function txt(url) { try { const r = await fetch(url); return r.ok ? await r.text() : ''; } catch { return ''; } }
async function loadWatchlist() { return (await txt('watchlist.txt')).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')); }
async function loadCsv(sym) {
  const t = await txt(`data/${sym}.csv`); if (!t) return [];
  return t.trim().split('\n').slice(1).map(l => { const [d, o, h, lo, c, v] = l.split(','); return { time: /^\d{9,}$/.test(d) ? +d + 9 * 3600 : d, open: +o, high: +h, low: +lo, close: +c, volume: +v }; }).filter(r => isFinite(r.close) && r.close > 0);
}
const NAMES = { 'INFQ': '인플렉션', '005930.KS': '삼성전자', '000660.KS': 'SK하이닉스', '^KS11': '코스피', '^KQ11': '코스닥', '^GSPC': 'S&P 500', '^VIX': 'VIX', 'SOXX': '반도체 ETF', 'IONQ': '아이온큐', 'RGTI': '리게티', 'QBTS': '디웨이브', '^IXIC': '나스닥', 'EWY': 'EWY', 'KRW=X': '원/달러' };
const NAMES_READY = fetch('out/names.json').then(r => r.ok ? r.json() : {}).then(m => { for (const [k, v] of Object.entries(m || {})) if (!NAMES[k]) NAMES[k] = v; }).catch(() => { });
function nameOf(s) {
  const J = CORE?.J;
  if (J?.[s]?.name && J[s].name !== s) return J[s].name;
  if (NAMES[s]) return NAMES[s];
  try { const n = JSON.parse(LS.get('names') || '{}')[s]; if (n) return n; } catch { }
  return s;
}
const CTX = ['^KS11', '^KQ11', '^GSPC', '^VIX', 'SOXX', 'KRW=X', '^TNX', 'DX-Y.NYB', 'EWY', '^IXIC'];
let CORE = null;
/* 홈·알림·PC 목록이 쓰는 것 전부 — out/desk.json 한 파일(없으면 하나씩) */
async function loadCore(force = false) {
  if (CORE && !force) return CORE;
  const D = await j('out/desk.json', force);
  const F = D?.files || {};
  const g = p => (p in F ? Promise.resolve(F[p]) : j(p, force));
  const wl = D?.watchlist || await loadWatchlist();
  const [J, AL, EV, TR, FL, AT] = await Promise.all(['out/judgement.json', 'out/alerts.json', 'events.json', 'out/track.json', 'out/flows.json', 'out/attribution.json'].map(g));
  const R = {};
  await Promise.all(wl.map(async s => { R[s] = await g(`out/${s}.json`); }));
  const CSV = { ...(D?.csv || {}) };
  if (!D) await Promise.all([...wl, ...CTX].map(async s => { const rows = await loadCsv(s); CSV[s] = rows.slice(-40).map(x => ({ time: x.time, close: x.close })); }));
  await Promise.all([NAMES_READY, LOGOS_READY]);
  const asof = Object.values(R).filter(Boolean).map(r => r.asof).sort().slice(-1)[0] || '';
  CORE = { wl, J: J || {}, AL: AL || { alerts: [] }, EV: EV || { events: [] }, TR, FL: FL || {}, AT: AT || {}, R, CSV, built: D?.built || null, asof };
  CORE.M = buildModel(CORE);
  return CORE;
}
function resetData() { Object.keys(cache).forEach(k => delete cache[k]); CORE = null; }

/* ================================================================ 판단 모델 — 조건표에서 상태가 나온다
   위 기준(top) 위 마감 = 조건 충족 · 아래 기준(bottom) 아래 마감 = 바닥 무너짐/손절 · 그 사이 = 근접 또는 기다림 */
const LINE_KO = s => String(s || '')
  .replace(/SMA(\d+)/g, '$1일선')
  .replace(/피보 (\d+)\.0%/g, '피보 $1%')
  .replace(/수평 (지지|저항)\((\d+)회\)/g, '수평 $1 $2회')
  .replace(/하락 추세선/g, '하락 흐름선').replace(/상승 추세선/g, '상승 흐름선').replace(/상단 추세선/g, '위쪽 흐름선').replace(/하단 추세선/g, '아래쪽 흐름선')
  .replace(/(\d+)월선/g, '$1개월선');
const PILL = {
  go: (t = '조건 충족') => ({ t, c: 'p-go', i: 'bolt' }),
  floor: (t = '바닥 후보 근접') => ({ t, c: 'p-floor', i: 'floor' }),
  ceil: (t = '막힐 자리 근접') => ({ t, c: 'p-ceil', i: 'ceil' }),
  stop: t => ({ t, c: 'p-stop', i: 'alert' }),
  wait: (t = '기다림') => ({ t, c: 'p-wait', i: 'clock' }),
};
const pillHTML = (p, mdz = false) => p ? `<span class="pill ${p.c}${mdz ? ' md' : ''}">${ic(p.i, mdz ? 14 : 12, 2.4)}${esc(p.t)}</span>` : '';

function rowNums(cond) { return (String(cond || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => +n.replace(/,/g, '')); }
function levelsOf(jd) {
  if (!jd) return {};
  const rows = jd.rows || [];
  let top = jd.top ?? null, bottom = jd.bottom ?? null, kind = jd.kind_top ?? null;
  if (top == null && rows.length) top = rowNums(rows[0].cond)[0] ?? null;
  if (bottom == null && rows.length >= 3) bottom = rowNums(rows[rows.length - 1].cond)[0] ?? null;
  if (jd.held && jd.stop) bottom = jd.stop;
  if (!kind) { const a = rows[0]?.action || ''; kind = jd.held ? 'next' : /추세선|흐름/.test(a) ? 'trend' : /진입 조건|매수 조건/.test(a) ? 'entry' : 'ceil'; }
  return { top, bottom, kind };
}
/* 판단 결과가 없는 종목(검색해서 들어온 종목) — judge.py 관찰 종목 규칙을 그대로 */
function synthJudge(r) {
  const c = r.close, conf = r.confluence || [];
  const tl = r.trend_upper?.value_today || null;
  const cb = conf.filter(g => g.price < c).sort((a, b) => b.price - a.price), ca = conf.filter(g => g.price >= c).sort((a, b) => a.price - b.price);
  const up = tl || (ca[0]?.price ?? null);
  const sups = (r.levels || []).map(l => l.price).filter(p => p < c);
  let dn = cb[0]?.price ?? (sups.length ? Math.max(...sups) : r.keys?.recent_low10 ?? null);
  if (up && dn && up <= dn) { const lower = [...sups, ...cb.map(g => g.price)].filter(x => x < up); dn = lower.length ? Math.max(...lower) : null; }
  return { symbol: r.symbol, name: nameOf(r.symbol), asof: r.asof, close: c, krw: r.krw, held: false, top: up, bottom: up && dn && up > dn ? dn : null, kind_top: tl ? 'trend' : 'ceil', rows: [], synthetic: true };
}
function daysAbove(tail, asof, level, slope = 0) {
  if (!tail?.length || !level) return 0;
  let i = tail.findIndex(x => x.time === asof); if (i < 0) i = tail.length - 1;
  let n = 0; for (let k = 0; i - k >= 0; k++) { if (tail[i - k].close >= level - slope * k) n++; else break; }
  return n;
}
function nextFloorBelow(r, p) {
  const c = [...(r.levels || []).map(l => ({ price: l.price, n: l.touches, kind: 'level' })), ...(r.confluence || []).map(g => ({ price: g.price, n: g.lines.length, kind: 'conf' }))].filter(x => x.price < p * 0.985).sort((a, b) => b.price - a.price)[0];
  if (c) return c;
  const w = r.keys?.w52_low; return w && w < p * 0.985 ? { price: w, kind: 'w52' } : null;
}
function eventsFor(EV, s) {
  return (EV?.events || []).filter(e => !s || (e.symbols || []).includes(s)).map(e => ({ ...e, dd: dDays(e.date) })).filter(e => e.dd != null && e.dd >= 0).sort((a, b) => a.dd - b.dd);
}
const evTitle = t => String(t || '').replace(/(\d)Q/g, '$1분기');
function evShort(e) { const k = e.kind === '실적' ? '실적' : evTitle(e.title).replace(/\s*\(.*\)$/, ''); return e.dd === 0 ? `오늘 ${k}` : e.dd === 1 ? `내일 ${k}` : `${md(e.date)} ${k}`; }
function flowWord(fl) {
  if (!fl?.fo) return null;
  const b = fl.fo['60'], r5 = fl.fo['5'];
  if (b > 0 && r5 > 0) return { t: '외국인·기관이 사는 중', tone: 'go' };
  if (b <= 0 && r5 > 0) return { t: '외국인·기관이 사기 시작', tone: 'go' };
  if (b > 0 && r5 <= 0) return { t: '사던 외국인·기관이 주춤', tone: 'wa' };
  return { t: '외국인·기관이 파는 중', tone: 'wa' };
}
const TOPN = { trend: ['하락 흐름선', '흐름선'], entry: ['매수 조건', '매수 조건'], ceil: ['막힐 자리', '막힐 자리'], next: ['다음 차수', '다음 차수'] };

function derive(s, r, jd0, ctx = CORE) {
  const jd = jd0 || synthJudge(r);
  const c = r.close, k = r.krw, f = v => fmtP(v, k);
  const { top, bottom, kind } = levelsOf(jd);
  const held = !!jd.held;
  const conf = r.confluence || [];
  const floors = conf.filter(g => g.price < c).sort((a, b) => b.price - a.price);
  const ceils = conf.filter(g => g.price >= c).sort((a, b) => a.price - b.price);
  const floor = floors[0] || null, ceil = ceils[0] || null;
  const tl = r.trend_upper;
  const tail = ctx?.CSV?.[s] || [];
  const fl = ctx?.FL?.[s];
  const fw = flowWord(fl);
  const evs = eventsFor(ctx?.EV, s);
  const dTop = top ? pct(top, c) : null, dBot = bottom ? pct(bottom, c) : null;
  let [topName, topShort] = TOPN[kind] || ['위 기준', '위 기준'];
  if (held && top) { const p = (jd.plan || []).find(p => p.cond && String(p.cond).startsWith(f(top))); topName = topShort = p ? `${p.n}차 매수` : '목표'; }
  const botName = held ? '손절선' : kind === 'entry' ? '무효선' : (floor && bottom && Math.abs(floor.price / bottom - 1) < 0.006) || conf.some(g => bottom && Math.abs(g.price / bottom - 1) < 0.006) ? '바닥 후보' : '바닥';
  let state;
  if (held) {
    if (bottom && c < bottom) state = 'exit';
    else if (bottom && pct(c, bottom) <= 1.0) state = 'stop';
    else if (top && c >= top) state = 'next';
    else state = 'hold';
  } else if (top && c >= top) state = 'enter';
  else if (bottom && c < bottom) state = 'broken';
  else if (floor && (!ceil || Math.abs(pct(floor.price, c)) <= Math.abs(pct(ceil.price, c)))) state = 'floor';
  else if (ceil) state = 'ceil';
  else state = 'wait';
  const slopeOk = kind === 'trend' && tl && top && Math.abs(tl.value_today / top - 1) < 0.003;
  const daysUp = (state === 'enter' || state === 'next') ? (jd.days_up || daysAbove(tail, r.asof, top, slopeOk ? tl.slope_per_bar : 0) || 1) : 0;
  const strong = g => g && g.lines.length >= 4;
  const ceilNote = ceil && pct(ceil.price, c) <= 3 ? `바로 위 막힐 자리 ${f(ceil.price)} (${sgn(pct(ceil.price, c))})` : '';
  const extras = [];
  if (r.rsi_volume?.rsi < 30) extras.push('많이 팔림'); else if (r.rsi_volume?.rsi > 70) extras.push('많이 오름');
  const ev = evs.find(e => e.dd <= 7);
  if (ev) extras.push(ev.dd <= 1 ? `<span class="wa-t">${esc(evShort(ev))}</span>` : esc(evShort(ev)));
  const xs = extras.map(x => ' · ' + x).join('');
  const waitHTML = top ? `${esc(topShort)}${extras.length ? ' ' : '까지 '}${N(sgn(dTop))}${xs}` : bottom ? `바닥까지 ${N(sgn(dBot))}${xs}` : (extras.join(' · ') || '가까운 기준선 없음');
  let pill, vpill, l1 = '', l2 = '', head = '', urgency = 9;
  switch (state) {
    case 'enter':
      pill = vpill = PILL.go(); urgency = 1;
      if (kind === 'trend') { l1 = `하락 흐름 끊김 — ${N(f(c))} 마감`; l2 = daysUp <= 1 ? '내일도 흐름선 위에서 마감하면 1/3 매수 검토' : `흐름선 위 ${daysUp}일째 · 1/3 매수 검토`; head = daysUp <= 1 ? '하락 흐름을 끊었어요 — 내일도 위에서 마감하면 1/3 매수 검토' : `하락 흐름선 위 ${daysUp}일째 — 1/3 매수를 검토할 자리예요`; }
      else if (kind === 'entry') { l1 = `매수 조건 충족 — ${N(f(c))} 마감`; l2 = `조건 ${f(top)} 위${daysUp > 1 ? ` ${daysUp}일째` : ''} · 계획대로 1/3만`; head = '매수 조건을 채웠어요 — 계획대로 1/3만 사요'; }
      else { l1 = `막힐 자리 돌파 — ${N(f(c))} 마감`; l2 = '흐름이 이어지는지 확인 · 관심 올리기'; head = '막힐 자리를 넘었어요 — 흐름이 이어지는지 봐요'; }
      if (ceilNote) l2 += ' · ' + ceilNote;
      break;
    case 'next':
      pill = vpill = PILL.go(); urgency = 1;
      l1 = `${N(f(top))} 위 마감 — ${esc(topName)} 조건`; l2 = '계획대로 다음 차수 검토 · 손절선도 함께 점검';
      head = `${topName} 조건을 채웠어요 — 계획대로 다음 차수를 검토해요`;
      break;
    case 'broken': {
      pill = PILL.stop('바닥 무너짐'); vpill = PILL.stop('관심 해제 검토'); urgency = 0;
      const nx = nextFloorBelow(r, bottom);
      l1 = `${esc(botName)} ${N(f(bottom))} 아래 마감 (${N(sgn(pct(c, bottom)))})`;
      l2 = '관심 해제 검토' + (nx ? ` · 다음 바닥 ${f(nx.price)} (${sgn(pct(nx.price, c))})` : '');
      head = kind === 'entry' ? '무효선 아래로 마감했어요 — 시나리오를 다시 봐요' : '바닥이 무너졌어요 — 관심 해제를 검토해요';
      break;
    }
    case 'exit':
      pill = PILL.stop('손절 이탈'); vpill = PILL.stop('정리'); urgency = 0;
      l1 = `손절선 ${N(f(bottom))} 아래 마감 (${N(sgn(pct(c, bottom)))})`; l2 = `규칙대로면 ${jd.lot ? esc(jd.lot) + '분 ' : ''}정리하는 날 · 종가 기준`;
      head = '손절선 아래에서 마감했어요 — 규칙대로면 정리하는 날';
      break;
    case 'stop':
      pill = vpill = PILL.stop('손절 근접'); urgency = 0;
      l1 = `손절선 ${N(f(bottom))}까지 ${N(sgn(dBot))}`; l2 = '오늘 종가가 손절선 아래면 정리 · 장중 흔들림은 무시';
      head = '손절선 바로 위예요 — 오늘 종가로만 판단해요';
      break;
    case 'floor':
      pill = PILL.floor(); vpill = PILL.wait(); urgency = 2;
      l1 = `바닥 후보 ${N(f(floor.price))}까지 ${N(sgn(pct(floor.price, c)))}`;
      l2 = (strong(floor) ? '여러 기준이 겹친 강한 자리' : fw?.tone === 'go' ? fw.t : '반응이 나오기 쉬운 자리') + ' · 반등 확인 후 판단';
      head = '바닥 후보 바로 위 — 반등을 확인할 때까지 기다려요';
      break;
    case 'ceil':
      pill = PILL.ceil(); vpill = PILL.wait(); urgency = 3;
      l1 = `막힐 자리 ${N(f(ceil.price))}까지 ${N(sgn(pct(ceil.price, c)))}`; l2 = '넘어서 마감하면 의미 큼 · 못 넘으면 되밀릴 수 있음';
      head = '막힐 자리 바로 아래 — 넘어서 마감하는지 지켜봐요';
      break;
    case 'hold':
      pill = vpill = PILL.wait('보유 유지');
      l1 = top ? `${esc(topName)}까지 ${N(sgn(dTop))}` : bottom ? `손절선까지 ${N(sgn(dBot))}` : '보유 중';
      l2 = top ? `${f(top)} 위로 마감하면 ${topName} 검토` : '반등 확인 전엔 더 사지 않기';
      head = top && dTop != null && Math.abs(dTop) < Math.abs(dBot ?? 99) ? `${topName}까지 ${sgn(dTop)} — ${f(top)} 위로 마감하면 검토해요` : bottom ? `손절선까지 ${sgn(dBot)} — 반등 확인 전엔 더 사지 않아요` : '손절선을 정해 두세요 — 손절선 없이 보유하지 않아요';
      break;
    default:
      pill = vpill = PILL.wait();
      l1 = waitHTML;
      head = top ? `${topName}까지 ${sgn(dTop)} — ${kind === 'entry' ? '조건을 채울' : '넘어서 마감할'} 때까지 기다려요` : '가까운 기준선이 없어요 — 기다려요';
  }
  const todo = held ? ['exit', 'stop', 'next'].includes(state) : ['enter', 'broken', 'floor', 'ceil'].includes(state);
  const urgent = ['enter', 'next', 'broken', 'exit', 'stop'].includes(state);
  const near = state === 'floor' || state === 'ceil';
  const dist = state === 'floor' ? Math.abs(pct(floor.price, c)) : state === 'ceil' ? Math.abs(pct(ceil.price, c)) : top ? Math.abs(dTop) : bottom ? Math.abs(dBot) : 99;
  return { s, r, jd, c, k, f, held, state, pill, vpill, l1, l2, head, waitHTML, top, bottom, kind, topName, topShort, botName, floor, ceil, floors, ceils, dTop, dBot, daysUp, todo, urgent, near, urgency, dist, fw, fl, evs };
}
function buildModel(C) {
  const items = C.wl.map(s => {
    const r = C.R[s]; if (!r || !r.close) return null;
    const d = derive(s, r, C.J[s], C);
    const tail = C.CSV[s] || [];
    d.name = nameOf(s);
    d.spark = tail.slice(-20).map(x => x.close);
    d.chg = r.rsi_volume?.chg_pct ?? (tail.length > 1 ? pct(tail[tail.length - 1].close, tail[tail.length - 2].close) : null);
    return d;
  }).filter(Boolean);
  const held = items.filter(d => d.held);
  const todo = items.filter(d => d.todo).sort((a, b) => a.urgency - b.urgency || a.dist - b.dist);
  const waiting = items.filter(d => !d.held && !d.todo).sort((a, b) => a.dist - b.dist);
  return { items, held, todo, waiting, urgent: todo.filter(d => d.urgent).length, near: todo.filter(d => d.near).length, by: Object.fromEntries(items.map(d => [d.s, d])) };
}

/* ---------------- 시장 날씨 (거시 6개 → 맑음/구름/비) */
const fmtW = v => Math.round(v).toLocaleString('ko-KR');
const MACRO = [
  { s: 'KRW=X', n: '원/달러', val: v => fmtW(v) + '원', read: (v, c20) => c20 >= 1.5 ? ['off', `원화 약세 · ${fmtW(v)}원`, '원화 약세 — 외국인이 한국 주식을 팔기 쉬운 환경'] : c20 <= -1.5 ? ['on', `원화 강세 · ${fmtW(v)}원`, '원화 강세 — 외국인 매수에 우호적'] : ['mid', `환율 안정 · ${fmtW(v)}원`, '환율 안정'] },
  { s: '^TNX', n: '미 10년물 금리', val: v => v.toFixed(2) + '%', bp: true, read: (v, c20, d20) => d20 >= 0.2 ? ['off', `미 금리 상승 · ${v.toFixed(2)}%`, '금리 상승 — 성장주·비싼 주식에 부담'] : d20 <= -0.2 ? ['on', `미 금리 하락 · ${v.toFixed(2)}%`, '금리 하락 — 성장주에 우호적'] : ['mid', `미 금리 보합 · ${v.toFixed(2)}%`, '금리 보합'] },
  { s: 'DX-Y.NYB', n: '달러 인덱스', val: v => v.toFixed(1), read: (v, c20) => c20 >= 2 ? ['off', '달러 강세', '달러 강세 — 한국 같은 신흥국에서 돈이 빠지기 쉬움'] : c20 <= -2 ? ['on', '달러 약세', '달러 약세 — 신흥국에 우호적'] : ['mid', '달러 보합', '달러 보합'] },
  { s: '^VIX', n: 'VIX 공포지수', val: v => v.toFixed(1), read: v => v < 15 ? ['on', `VIX ${v.toFixed(1)} 안정`, '시장이 편안함'] : v < 25 ? ['mid', `VIX ${v.toFixed(1)} 경계`, '경계 — 흔들릴 수 있음'] : ['off', `VIX ${v.toFixed(1)} 공포`, '공포 — 변동성 큼, 손절선 우선'] },
  { s: 'EWY', n: 'EWY · 해외에서 본 한국', val: v => '$' + v.toFixed(2), read: (v, c20, d20, above) => above ? ['on', '해외 자금 양호 · EWY 20일선 위', '20일선 위 — 해외 자금 흐름 양호'] : ['off', '해외 자금 약함 · EWY 20일선 아래', '20일선 아래 — 해외 자금 흐름 약함'] },
  { s: '^IXIC', n: '나스닥', val: v => Math.round(v).toLocaleString('en-US'), read: (v, c20, d20, above) => above ? ['on', '나스닥 20일선 위', '20일선 위 — 기술주 흐름 양호'] : ['off', '나스닥 20일선 아래', '20일선 아래 — 기술주 약세'] },
];
function macro(C) {
  const out = []; let on = 0, off = 0;
  for (const m of MACRO) {
    const rows = C.CSV[m.s] || []; if (rows.length < 22) continue;
    const cl = rows.map(r => r.close), v = cl[cl.length - 1], p1 = cl[cl.length - 2], p20 = cl[cl.length - 21];
    const c1 = pct(v, p1), c20 = pct(v, p20), d20 = v - p20, ma20 = cl.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const [t, chip, text] = m.read(v, c20, d20, v > ma20);
    if (t === 'on') on++; if (t === 'off') off++;
    out.push({ ...m, v, c1, c20, d20, t, chip, text, last: rows[rows.length - 1].time, spark: cl.slice(-30) });
  }
  if (!out.length) return null;
  const sc = on - off;
  const wx = sc >= 2 ? { i: 'sun', w: '맑음', line: '맑음 — 돈이 들어오기 좋은 환경', how: '종목별 기준선대로' } : sc <= -2 ? { i: 'rain', w: '비', line: '비 — 돈이 빠지기 쉬운 환경', how: '새로 살 땐 바닥 확인 후 · 손절선 먼저' } : { i: 'cloud', w: '구름', line: '구름 — 신호가 엇갈려요', how: '종목별 기준선대로' };
  const chips = [...out.filter(x => x.t === 'on'), ...out.filter(x => x.t === 'off'), ...out.filter(x => x.t === 'mid' && x.s === '^VIX')];
  const idx = [['^KS11', '코스피'], ['^KQ11', '코스닥'], ['^GSPC', 'S&P']].map(([s, n]) => { const r = C.CSV[s] || []; if (r.length < 2) return null; const v = r[r.length - 1].close, c1 = pct(v, r[r.length - 2].close); return { s, n, v, c1 }; }).filter(Boolean);
  return { on, off, wx, cards: out, chips, idx };
}

/* ================================================================ 화면 부품 */
function spark(vals, w = 56, h = 20) {
  if (!vals || vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / rg * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="var(--${vals[vals.length - 1] >= vals[0] ? 'up' : 'dn'})" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/></svg>`;
}
const chev = () => `<span class="chev">${ic('right', 20, 2)}</span>`;
const secHead = (title, count, right = '') => `<div class="sh"><h2>${esc(title)}</h2>${count != null ? `<span class="cnt">${count}</span>` : ''}${right}</div>`;
const liveP = (d, cls = 'p') => `<span class="${cls}" data-live-p="${esc(d.s)}" data-k="${d.k ? 1 : 0}">${d.f(d.c)}</span>`;
const liveC = (d, cls = 'c') => `<span class="${cls} ${tone(d.chg)}" data-live-c="${esc(d.s)}">${sgn(d.chg)}</span>`;

/* 오늘 할 일 한 줄 */
function rowTodo(d, cur = false) {
  return `<a class="row" href="${tHref(d.s)}"${cur ? ' aria-current="page"' : ''}>${logo(d.s, d.name, 36)}<div class="rc"><div class="rt"><span class="nm">${esc(d.name)}</span>${pillHTML(d.pill)}</div><span class="l1">${d.l1}</span>${d.l2 ? `<span class="l2">${d.l2}</span>` : ''}</div>${chev()}</a>`;
}
/* 기다리는 종목 한 줄 */
function rowWait(d, cur = false) {
  return `<a class="row mid" href="${tHref(d.s)}"${cur ? ' aria-current="page"' : ''}>${logo(d.s, d.name, 36)}<div class="rc"><span class="nm">${esc(d.name)}</span><span class="l1 t2" style="font-size:13px">${d.waitHTML}</span></div>${spark(d.spark)}<div class="rr">${liveP(d)}${liveC(d)}</div></a>`;
}
/* PC 왼쪽 목록용 짧은 줄 */
function rowCmp(d, sub, right, cur) {
  return `<a class="row cmp" href="${tHref(d.s)}"${cur ? ' aria-current="page"' : ''}>${logo(d.s, d.name, 32)}<div class="rc"><span class="nm" style="font-size:14px">${esc(d.name)}</span><span class="l2 t2">${sub}</span></div>${right}</a>`;
}

/* 눈금자 + 바늘 (보유 카드) — 손절(주황 핀) ↔ 다음 차수(청록 핀), 바늘 = 지금 */
function niceStep(span, target = 4) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (span / (m * p) <= target + 1) return m * p;
  return 10 * p;
}
function rulerSVG(lo, hi, c, k, label) {
  const W = 326;
  let a = Math.min(lo, hi, c), b = Math.max(lo, hi, c); const pad = (b - a) * 0.04 || Math.abs(c) * 0.01 || 1; a -= pad; b += pad;
  const x = p => (p - a) / (b - a) * W;
  const L = niceStep(b - a, 4), minor = L / 10;
  const dec = k ? 0 : Math.max(0, Math.ceil(-Math.log10(L) - 1e-9));
  let s = `<line x1="0" y1="24" x2="${W}" y2="24" stroke="var(--tick2)" stroke-width="1"/>`;
  const n0 = Math.ceil(a / minor - 1e-9), n1 = Math.floor(b / minor + 1e-9);
  for (let n = n0; n <= n1 && n - n0 < 400; n++) {
    const v = n * minor, X = x(v).toFixed(1), isM = n % 5 === 0, isL = n % 10 === 0;
    s += `<line x1="${X}" y1="${isM ? 12 : 18}" x2="${X}" y2="24" stroke="var(${isM ? '--tick2' : '--tick'})" stroke-width="1"/>`;
    if (isL && x(v) > 14 && x(v) < W - 14) s += `<text x="${X}" y="37" text-anchor="middle" font-family="Barlow, sans-serif" font-size="12" fill="var(--t3)">${k ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(dec)}</text>`;
  }
  const pin = (p, col) => `<line x1="${x(p).toFixed(1)}" y1="6" x2="${x(p).toFixed(1)}" y2="28" stroke="var(${col})" stroke-width="2.5"/>`;
  s += pin(lo, '--wa') + pin(hi, '--go');
  const xc = x(c).toFixed(1);
  s += `<line x1="${xc}" y1="3" x2="${xc}" y2="30" stroke="var(--t1)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${xc}" cy="3.5" r="3.5" fill="var(--t1)"/>`;
  return `<svg class="ruler" viewBox="0 0 ${W} 40" role="img" aria-label="${esc(label)}">${s}</svg>`;
}

/* 반원 계기판 (종목 결론) — 왼쪽 주황 = 아래 기준 밑, 가운데 회색 = 기다림, 오른쪽 청록 = 위 기준 위 */
function dialSVG({ lo, hi, c, k, names, aria }) {
  const cx = 163, cy = 176, R = 146, f = v => fmtP(v, k);
  let span = hi - lo; if (!(span > 0)) span = Math.abs(c) * 0.05 || 1;
  let a = lo - 0.7 * span, b = hi + 0.5 * span;
  const pad = (b - a) * 0.08; if (c < a + pad) a = c - pad; if (c > b - pad) b = c + pad;
  const fr = p => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const P = (fv, r) => { const th = Math.PI * (1 - fv); return [cx + r * Math.cos(th), cy - r * Math.sin(th)]; };
  const arc = (f0, f1, col, op) => { if (f1 - f0 < 0.002) return ''; const [x0, y0] = P(f0, R), [x1, y1] = P(f1, R); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="var(${col})" stroke-width="8"${op ? ` stroke-opacity="${op}"` : ''}/>`; };
  const fb = fr(lo), ft = fr(hi), fc = fr(c);
  let s = arc(0, fb, '--wa', '.55') + arc(fb, ft, '--track') + arc(ft, 1, '--go', '.6');
  for (let i = 0; i <= 40; i++) { const [x0, y0] = P(i / 40, 124), [x1, y1] = P(i / 40, 132); s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--tick)" stroke-width="1"/>`; }
  const lab = [];
  [[fb, lo], [ft, hi]].forEach(([fv, p]) => {
    const [x0, y0] = P(fv, 116), [x1, y1] = P(fv, 154);
    s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--t2)" stroke-width="2"/>`;
    let [lx, ly] = P(fv, 170); lx = Math.max(26, Math.min(300, lx)); ly = Math.max(16, ly);
    lab.push([lx, ly]);
    s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-family="Barlow, sans-serif" font-size="14" font-weight="600" fill="var(--t1)">${f(p)}</text>`;
  });
  const fm = (fb + ft) / 2, [mx, my] = P(fm, 158);
  if (!lab.some(([lx, ly]) => Math.abs(lx - mx) < 52 && Math.abs(ly - my) < 18)) s += `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-family="IBM Plex Sans KR, sans-serif" font-size="12" font-weight="600" fill="var(--t2)">${esc(names[1])}</text>`;
  s += `<text x="17" y="198" font-family="IBM Plex Sans KR, sans-serif" font-size="12" font-weight="600" fill="var(--wa-t)">${esc(names[0])}</text>`;
  s += `<text x="309" y="198" text-anchor="end" font-family="IBM Plex Sans KR, sans-serif" font-size="12" font-weight="600" fill="var(--go-t)">${esc(names[2])}</text>`;
  const [tx0, ty0] = P(fc, -18), [tx1, ty1] = P(fc, 138);
  s += `<line x1="${tx0.toFixed(1)}" y1="${ty0.toFixed(1)}" x2="${tx1.toFixed(1)}" y2="${ty1.toFixed(1)}" stroke="var(--t1)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="8" fill="var(--t1)"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--card)"/>`;
  return `<svg class="dial" viewBox="0 0 326 200" role="img" aria-label="${esc(aria)}">${s}</svg>`;
}

/* ---------------- 시트 · 토스트 */
let SHEET_CLOSE = null;
function openSheet(html, { label = '상세', onClose = null } = {}) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab" aria-hidden="true"></div>${html}`;
  sh.setAttribute('aria-label', label);
  sh.classList.add('on'); $('#scrim').classList.add('on');
  document.body.style.overflow = 'hidden';
  SHEET_CLOSE = onClose; sh.scrollTop = 0;
  setTimeout(() => (sh.querySelector('[autofocus]') || sh.querySelector('button, a, input'))?.focus({ preventScroll: true }), 260);
}
function closeSheet() {
  const sh = $('#sheet'); if (!sh.classList.contains('on')) return;
  sh.classList.remove('on'); $('#scrim').classList.remove('on'); document.body.style.overflow = '';
  const cb = SHEET_CLOSE; SHEET_CLOSE = null; cb?.();
}
const sheetHead = (title, extra = '') => `<div class="shh"><h2>${esc(title)}</h2><div class="end">${extra}<button class="ib" type="button" data-close aria-label="닫기">${ic('x', 20, 2)}</button></div></div>`;
let toastT = null;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------------- 화면 틀 (아래 탭 · PC 위 막대) */
function renderChrome() {
  const tc = $('#themeColor'); if (tc) tc.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#141517';
  const tabs = [['home', '#/', 'home', '홈'], ['screener', '#/screener', 'compass', '발굴'], ['journal', '#/journal', 'book', '기록'], ['alerts', '#/alerts', 'bell', '알림']];
  $('#tabbar').innerHTML = tabs.map(([k, h, i, t]) => `<a href="${h}" data-nav="${k}">${ic(i, 22, k === 'home' ? 2 : 1.8)}<span>${t}</span>${k === 'alerts' ? '<i class="bdg" data-badge hidden></i>' : ''}</a>`).join('');
  $('#topbar').innerHTML = `<a class="brand" href="#/">investool<i aria-hidden="true"></i></a>
    <nav class="tnav" aria-label="주 메뉴">${tabs.map(([k, h, , t]) => `<a href="${h}" data-nav="${k}">${t}${k === 'alerts' ? ' <i class="bdg" data-badge hidden></i>' : ''}</a>`).join('')}</nav>
    <form class="tsearch" id="tsearch" role="search" autocomplete="off"><label>${ic('search', 18)}<span class="sr">종목 검색</span><input id="tq" type="search" placeholder="종목 이름 · 코드 검색 — 바로 분석" enterkeyhint="search"><kbd>/</kbd></label><div class="drop" id="tdrop" hidden></div></form>
    <div class="tmkt" id="tmkt"></div>
    <a class="ib" href="#/settings" aria-label="설정" data-nav="settings">${ic('sliders', 20)}</a>`;
  bindTopSearch();
}
function setNav(name) {
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.body.classList.toggle('no-tab', name === 'ticker' || name === 'search');
}
function setBadge() {
  const n = CORE?.M?.todo?.length || 0;
  $$('[data-badge]').forEach(b => { b.textContent = n; b.hidden = !n; });
  const mk = CORE ? macro(CORE) : null, ks = mk?.idx?.find(x => x.s === '^KS11');
  const t = $('#tmkt'); if (t && mk) t.innerHTML = `<span class="wxs">${ic(mk.wx.i, 20)}<b>${mk.wx.w}</b>${mk.wx.w === '구름' ? '신호 엇갈림' : mk.wx.w === '맑음' ? '돈 들어오는 환경' : '돈 빠지는 환경'}</span>${ks ? `<span>코스피 <b>${Math.round(ks.v).toLocaleString('ko-KR')}</b> <span class="n ${tone(ks.c1)}">${sgn(ks.c1)}</span></span>` : ''}<span class="t3">${md(CORE.asof)} 종가 기준</span>`;
}

/* ================================================================ 홈 — "오늘 할 일이 있나?" */
const main = $('#main');
const manwon = v => v >= 1e8 ? (v / 1e8).toFixed(1) + '억 원' : v >= 1e4 ? Math.round(v / 1e4).toLocaleString('ko-KR') + '만 원' : Math.round(v).toLocaleString('ko-KR') + '원';
const usdkrw = () => { const r = CORE?.CSV?.['KRW=X'] || []; return r.length ? r[r.length - 1].close : null; };

function holdCard(d) {
  const jd = d.jd, f = d.f, k = d.k, c = d.c;
  const qty = jd.qty, avg = jd.avg, stop = d.bottom, top = d.top;
  const pnl = (c - avg) * qty, pp = pct(c, avg);
  const fx = usdkrw();
  const pnlTxt = k ? `${sgnNum(pnl, true)}원 · ${sgn(pp)}` : `${pnl > 0 ? '+' : pnl < 0 ? MINUS : ''}$${Math.abs(pnl).toFixed(0)} · ${sgn(pp)}`;
  const approx = !k && fx ? `약 ${pnl >= 0 ? '+' : MINUS}${manwon(Math.abs(pnl * fx))}` : '';
  const ruler = stop && top ? rulerSVG(stop, top, c, k, `손절 ${f(stop)}과 ${d.topName} ${f(top)} 사이, 지금 ${f(c)}`) : '';
  const labels = stop && top ? `<div class="rl"><span class="wa-t">손절 <b>${f(stop)}</b> · <b>${sgn(pct(stop, c))}</b></span><span class="go-t"><b>${sgn(d.dTop)}</b> · ${esc(d.topName)} <b>${f(top)}</b></span></div>` : !stop ? `<div class="rl"><span class="wa-t">손절선이 없어요 — 종목 화면에서 정해 두세요</span></div>` : '';
  const act = d.state === 'hold' ? `<b>보유 유지</b> — ${esc(d.l2)}` : `<b>${esc(d.pill.t)}</b> — ${d.l2 || d.l1}`;
  return `<a class="hold" href="${tHref(d.s)}">
    <div class="hold-h">${logo(d.s, d.name, 40)}<div class="rc"><span class="nm" style="font-size:16px">${esc(d.name)}</span><span class="l2">${esc(d.s)} · ${qty.toLocaleString('ko-KR')}주 · 평단 <span class="nr">${f(avg)}</span></span></div>
      <div class="rr"><span class="px" data-live-p="${esc(d.s)}" data-k="${k ? 1 : 0}">${f(c)}</span><span class="pc ${tone(d.chg)}" data-live-c="${esc(d.s)}">${sgn(d.chg)}</span></div></div>
    <div class="pl"><span class="t3" style="font-size:13px">평가 손익</span><span class="n ${tone(pnl)}" style="font-size:16px">${pnlTxt}</span>${approx ? `<span class="t2" style="font-size:13px">${approx}</span>` : ''}</div>
    ${ruler}${labels}
    <div class="act">${d.urgent ? ic('alert', 18, 1.9) : ic('target', 18, 1.9)}<span>${act}</span></div>
  </a>`;
}
function wxCard(mk, compact = false) {
  if (!mk) return `<div class="card t3" style="font-size:14px">시장 지표는 다음 배치 뒤에 보여요</div>`;
  return `<div class="card"><div class="wx"><span class="wx-i">${ic(mk.wx.i, 24)}</span><div><b>${mk.wx.line}</b><span>좋음 ${mk.on} · 나쁨 ${mk.off} · ${mk.wx.how}</span></div></div>
    <div class="chips">${mk.chips.slice(0, compact ? 3 : 4).map(x => `<span class="chip ${x.t === 'on' ? 'go' : x.t === 'off' ? 'wa' : ''}">${esc(x.chip)}</span>`).join('')}</div>
    ${mk.idx.length ? `<div class="idx">${mk.idx.map(x => `<span>${x.n}<b>${x.s === '^KQ11' ? x.v.toFixed(1) : Math.round(x.v).toLocaleString('ko-KR')}</b><span class="n ${tone(x.c1)}">${sgn(x.c1)}</span></span>`).join('')}</div>` : ''}</div>`;
}
function evRows(C, n = 5) {
  const held = new Set(C.M.held.map(d => d.s)), wl = new Set(C.wl);
  const evs = eventsFor(C.EV, null).slice(0, n);
  if (!evs.length) return '';
  return `<div class="list">${evs.map(e => {
    const syms = e.symbols || [];
    const tag = syms.some(s => held.has(s)) ? ['보유', 'mine'] : syms.some(s => wl.has(s)) ? ['관심', 'watch'] : ['시장', ''];
    const b = e.dd === 0 ? '<span class="evb today">오늘</span>' : `<span class="evb${e.dd <= 3 ? ' soon' : ''}">D-${e.dd}</span>`;
    const time = (e.title.match(/\((\d{1,2}:\d{2})[^)]*\)/) || [])[1];
    return `<div class="ev">${b}<div class="rc"><span>${esc(evTitle(e.title).replace(/\s*\((\d{1,2}:\d{2})[^)]*\)/, ''))}</span><span class="l2"><span class="nr">${md(e.date)}${time ? ' ' + time : ''}</span>${e.note ? ' · ' + esc(e.note) : ''}</span></div><span class="tag ${tag[1]}">${tag[0]}</span></div>`;
  }).join('')}</div>`;
}
function linksCard(C) {
  const FL = C.FL || {}, ents = Object.values(FL);
  const buy = ents.filter(f => f.fo?.['5'] > 0 && f.fo?.['20'] > 0 || f.tone === 'ok').length, sell = ents.filter(f => f.fo?.['5'] < 0 && f.fo?.['20'] < 0).length;
  const S = C.TR?.summary;
  return `<div class="list">
    <a class="lk" href="#/flows"><span class="lk-i">${ic('users', 22)}</span><div class="rc"><span style="font-size:15px">수급 레이더</span><span class="l2">${ents.length ? `외국인·기관이 사는 관심 종목 ${buy} · 파는 종목 ${sell}` : '다음 배치 뒤에 보여요'}</span></div>${chev()}</a>
    <a class="lk" href="#/track"><span class="lk-i">${ic('check', 22)}</span><div class="rc"><span style="font-size:15px">선 검증 성적</span><span class="l2">${S ? `바닥 후보 반응 ${S['받침']?.pct ?? '—'}% · 아무 선 ${S['더미 받침']?.pct ?? '—'}% · 막힐 자리 ${S['천장']?.pct ?? '—'}%` : '다음 배치 뒤에 보여요'}</span></div>${chev()}</a>
  </div>`;
}
let WAIT_SORT = LS.get('waitSort') || 'near';
function waitSorted(M) { return WAIT_SORT === 'chg' ? [...M.waiting].sort((a, b) => (b.chg ?? -99) - (a.chg ?? -99)) : M.waiting; }

function homeHTML(C) {
  const M = C.M;
  const head = `<header class="hh"><span class="big" aria-hidden="true">${M.urgent}</span><div><span class="ttl"><span class="sr">${M.urgent}개, </span>오늘 판단할 종목</span><span class="meta"><span><i class="lamp go"></i>근접 ${M.near}</span><span><i class="lamp"></i>기다림 ${M.waiting.length}</span><span>${md(C.asof)} 종가 기준</span></span></div><div style="margin-left:auto"><a class="ib" href="#/search" aria-label="종목 검색">${ic('search', 22)}</a></div></header>`;
  const held = M.held.length ? secHead('내 보유', M.held.length) + M.held.map(holdCard).join('') : '';
  const todo = secHead('오늘 할 일', M.todo.length, `<a class="more" href="#/alerts">알림 전체${ic('right', 16, 2)}</a>`) +
    (M.todo.length ? `<div class="list">${M.todo.map(d => rowTodo(d)).join('')}</div>` : `<div class="card t2" style="font-size:14px">오늘은 판단할 종목이 없어요. 기다리는 것도 일이에요.</div>`);
  const W = waitSorted(M), shown = W.slice(0, 7);
  const wait = M.waiting.length ? secHead('기다리는 종목', M.waiting.length, `<button class="more" type="button" id="waitSort">${ic('sort', 16, 2)}${WAIT_SORT === 'chg' ? '오늘 등락순' : '가까운 순'}</button>`) +
    `<div class="list">${shown.map(d => rowWait(d)).join('')}<a class="morebtn" href="#/watch">관심 종목 전체 ${M.items.length}개 보기${ic('right', 16, 2)}</a></div>` : '';
  const mk = macro(C);
  return `${head}${held}${todo}${wait}
    ${secHead('시장', null, `<a class="more" href="#/market">자세히${ic('right', 16, 2)}</a>`)}${wxCard(mk)}
    ${(() => { const e = evRows(C); return e ? secHead('다가오는 일정') + e : ''; })()}
    <div style="margin-top:16px">${linksCard(C)}</div>`;
}
async function renderHome() {
  setNav('home');
  if (isPC()) return renderSplit(null);
  const C = await loadCore();
  const draw = () => {
    main.innerHTML = homeHTML(C);
    const b = $('#waitSort'); if (b) b.onclick = () => { WAIT_SORT = WAIT_SORT === 'near' ? 'chg' : 'near'; LS.set('waitSort', WAIT_SORT); const y = scrollY; draw(); scrollTo(0, y); liveKick(); };
  };
  draw();
  setBadge();
}

/* 관심 종목 전체 */
async function renderWatch() {
  setNav('home');
  const C = await loadCore(), M = C.M;
  const all = [...M.held, ...M.todo.filter(d => !d.held), ...M.waiting];
  main.innerHTML = `<div class="${isPC() ? 'page' : ''}"><header class="back-h">${backBtn()}<h1>관심 종목 ${all.length}</h1></header>
    <div class="list">${all.map(d => `<a class="row mid" href="${tHref(d.s)}">${logo(d.s, d.name, 36)}<div class="rc"><div class="rt"><span class="nm">${esc(d.name)}</span>${pillHTML(d.pill)}</div><span class="l2 t2" style="font-size:13px">${d.state === 'wait' ? d.waitHTML : d.l1}</span></div><div class="rr">${liveP(d)}${liveC(d)}</div></a>`).join('')}</div>
    <p class="cap">관심 종목은 매일 장 마감 뒤 판단·알림 대상이에요. 종목을 추가하려면 검색해서 종목 화면의 별을 누르세요.</p></div>`;
}
const backBtn = () => `<button class="ib" type="button" data-back aria-label="뒤로">${ic('left', 22, 2)}</button>`;

/* ---------------- PC: 왼쪽 목록 + 오른쪽 종목 */
function asideHTML(C, cur) {
  const M = C.M;
  const held = M.held.map(holdCard).join('');
  const todo = M.todo.map(d => rowCmp(d, d.l1, pillHTML({ ...d.pill, t: d.pill.t.replace(' 후보', '').replace('막힐 자리', '막힘') }), d.s === cur)).join('');
  const wait = waitSorted(M).map(d => rowCmp(d, d.waitHTML, `<div class="rr">${liveP(d)}${liveC(d)}</div>`, d.s === cur)).join('');
  const ev = evRows(C, 4);
  return `${held ? `<div>${secHead('내 보유', M.held.length)}${held}</div>` : ''}
    <div class="aside-sec">${secHead('오늘 할 일', M.todo.length, `<a class="more" href="#/alerts">알림 전체${ic('right', 16, 2)}</a>`)}<div class="list">${todo || '<div class="empty">오늘은 판단할 종목이 없어요</div>'}</div></div>
    ${wait ? `<div class="aside-sec">${secHead('기다리는 종목', M.waiting.length, `<button class="more" type="button" id="waitSort">${ic('sort', 16, 2)}${WAIT_SORT === 'chg' ? '오늘 등락순' : '가까운 순'}</button>`)}<div class="list">${wait}</div></div>` : ''}
    ${ev ? `<div>${secHead('다가오는 일정')}${ev}</div>` : ''}
    <div>${linksCard(C)}</div>`;
}
let SPLIT_SYM = null;
async function renderSplit(sym) {
  const C = await loadCore();
  const pick = sym || (SPLIT_SYM && C.M.by[SPLIT_SYM] ? SPLIT_SYM : null) || C.M.todo[0]?.s || C.M.held[0]?.s || C.M.items[0]?.s;
  SPLIT_SYM = pick;
  if (!$('#aside')) {
    main.innerHTML = `<div class="split"><aside id="aside" aria-label="관심 종목"></aside><section id="pane" aria-live="polite"></section></div>`;
  }
  const y = $('#aside').scrollTop;
  $('#aside').innerHTML = asideHTML(C, pick);
  $('#aside').scrollTop = y;
  const ws = $('#waitSort'); if (ws) ws.onclick = () => { WAIT_SORT = WAIT_SORT === 'near' ? 'chg' : 'near'; LS.set('waitSort', WAIT_SORT); renderSplit(pick); };
  setBadge();
  if (pick) await renderTicker(pick, null, $('#pane'));
  else $('#pane').innerHTML = '<div class="empty">관심 종목이 아직 없어요. 위 검색창에서 종목을 찾아 보세요.</div>';
}

/* ================================================================ 종목 — "지금 사? 팔아? 기다려?"
   1층 결론(계기판) → 2층 판단 조건 · 차트 · 가격 지도 → 3층 근거 탭(수급·실적·큰 그림·일정) */
async function tickerData(sym, ov) {
  const C = await loadCore();
  let r = C.R[sym] || await j(`out/${sym}.json`);
  const [rows0, FLall, MTall, SC, V] = await Promise.all([loadCsv(sym), j('out/flows.json'), j('out/mtf.json'), j('out/screener.json'), j('out/validation.json')]);
  let rows = rows0, FL = FLall?.[sym] || null, MT = MTall?.[sym] || null;
  if (ov) { r = ov.r; rows = ov.rows; if (ov.F) FL = ov.F; if (ov.M) MT = ov.M; }
  if (!r) return null;
  const jd = C.J[sym] || null;  // 판단 조건은 언제나 배치(종가) 기준
  const ctx = { ...C, FL: { ...C.FL, [sym]: FL || C.FL[sym] }, CSV: { ...C.CSV, [sym]: rows.slice(-40).map(x => ({ time: x.time, close: x.close })) } };
  const d = derive(sym, r, jd, ctx);
  d.name = nameOf(sym);
  d.chg = r.rsi_volume?.chg_pct ?? null;
  const sc = (SC?.rows || []).find(x => x.symbol === sym) || null;
  return { C, d, r, rows, FL, MT, sc, scAsof: SC?.asof, V, inWl: C.wl.includes(sym), ov };
}
function valAgg(V) {
  const L = Object.values(V || {}).map(v => v.confluence).filter(c => c && c.n_touch);
  if (!L.length) return null;
  const n = L.reduce((a, c) => a + c.n_touch, 0);
  return { react: Math.round(L.reduce((a, c) => a + c.react_given_touch * c.n_touch, 0) / n * 100), brk: Math.round(L.reduce((a, c) => a + c.break_given_touch * c.n_touch, 0) / n * 100), n };
}
function mtfWith(MT, p) { return (MT?.strong || []).find(x => Math.abs(x.price / p - 1) < 0.006)?.with || []; }
function mtfWords(w) {
  if (!w.length) return '';
  if (w.length === 1) return LINE_KO(w[0]);
  const tfs = [...new Set(w.map(x => /주/.test(x) ? '주봉' : '월봉'))].sort((a, b) => (a === '주봉' ? -1 : 1) - (b === '주봉' ? -1 : 1));
  return `${tfs.join('·')} ${w.length}개`;
}
function strength(g, MT) {
  const w = mtfWith(MT, g.price), n = g.lines.length + w.length;
  return { w, n, dots: n >= 6 ? '●●●' : n >= 3 ? '●●○' : '●○○', word: n >= 6 ? '아주 강한' : n >= 4 ? '강한' : '' };
}
function confDesc(g, MT) {
  const st = strength(g, MT);
  return st.w.length ? `${g.lines.length}개 기준 + ${mtfWords(st.w)}${/[가-힣]$/.test(mtfWords(st.w)) && st.w.length === 1 ? '이' : '가'} 겹친${st.word ? ' ' + st.word : ''} 자리` : `${g.lines.length}개 기준이 겹친${st.word ? ' ' + st.word : ''} 자리`;
}

/* 판단 조건 3행 */
function condRows(d) {
  const f = d.f, c = d.c, out = [];
  const held = d.held;
  const upMean = held ? d.topName : d.kind === 'trend' ? '하락 흐름 끊김' : d.kind === 'entry' ? '매수 조건' : '막힐 자리 돌파';
  const upAct = held ? '다음 차수 검토' : d.kind === 'ceil' ? '관심 올리기' : '1/3 매수 검토';
  const lastAct = (d.jd?.rows || []).slice(-1)[0]?.action || '';
  const [dnAct0, ...dnRest] = held && /정리/.test(lastAct) ? lastAct.replace(/^\s*분\s*/, '').split(' · ') : [held ? '정리' : '관심 해제 검토'];
  const dnAct = dnAct0.trim();
  const dnMean = (held ? '손절선' : d.kind === 'entry' ? '시나리오 무효' : '바닥 무너짐') + (dnRest.length ? ' · ' + dnRest.join(' · ') : '');
  const zone = d.top && c >= d.top ? 'up' : d.bottom && c < d.bottom ? 'down' : 'mid';
  const upSub = zone === 'up' ? (d.daysUp > 1 ? `넘은 지 ${d.daysUp}일째` : '오늘 넘음') : `지금보다 ${N(sgn(d.dTop))}`;
  if (d.top) out.push(`<div class="crow${zone === 'up' ? ' now' : ''}"><span class="ci go">${ic('upr', 18, 2.2)}</span><div class="cm"><span>${N(f(d.top))} 위로 마감</span><span>${esc(upMean)} · ${upSub}</span></div><span class="ca go">${zone === 'up' ? `<span class="nowtag"><i>지금</i>${esc(upAct)}</span>` : esc(upAct)}</span></div>`);
  const midMain = d.top && d.bottom ? `${N(f(d.bottom))} ~ ${N(f(d.top))}` : d.top ? `${N(f(d.top))} 아래` : d.bottom ? `${N(f(d.bottom))} 위` : '기준선 없음';
  const midNote = held ? '반등 확인 전 추가 매수 금지' : '반등 확인 전엔 사지 않기';
  const midLab = held ? '보유' : '기다림';
  out.push(`<div class="crow${zone === 'mid' ? ' now' : ''}"><span class="ci mid">${ic('clock', 18, 2.2)}</span><div class="cm"><span>${midMain}</span><span>${midNote}</span></div><span class="ca">${zone === 'mid' ? `<span class="nowtag"><i>지금</i>${midLab}</span>` : midLab}</span></div>`);
  const dnSub = zone === 'down' ? `지금 ${N(sgn(pct(c, d.bottom)))} 아래` : `지금보다 ${N(sgn(d.dBot))}`;
  if (d.bottom) out.push(`<div class="crow${zone === 'down' ? ' now' : ''}"><span class="ci wa">${ic('dnr', 18, 2.2)}</span><div class="cm"><span>${N(f(d.bottom))} 아래로 마감</span><span>${esc(dnMean)} · ${dnSub}</span></div><span class="ca wa">${zone === 'down' ? `<span class="nowtag"><i>지금</i>${esc(dnAct)}</span>` : esc(dnAct)}</span></div>`);
  return `<div class="list conds">${out.join('')}</div>`;
}

/* 계기판 */
function verdictDial(d) {
  const r = d.r, c = d.c;
  let lo = d.bottom, hi = d.top, names;
  if (!lo) lo = nextFloorBelow(r, c)?.price ?? r.keys?.recent_low10;
  if (!hi) hi = d.ceil?.price ?? null;
  if (!lo || !hi || lo >= hi) return '';
  names = d.held ? ['정리', '보유', d.topShort] : [d.bottom ? '관심 해제' : '주의', '기다림', d.kind === 'ceil' ? '관심 올리기' : '매수 검토'];
  const zone = c >= hi ? names[2] : c < lo ? names[0] : names[1];
  return dialSVG({ lo, hi, c, k: d.k, names, aria: `바늘이 ${zone} 구간을 가리킴 — 지금 ${d.f(c)}, 아래 기준 ${d.f(lo)}, 위 기준 ${d.f(hi)}` });
}

/* 가격 지도 — 기준 가격은 여기 한 곳에 */
function priceMap(d, MT, V) {
  const r = d.r, c = d.c, f = d.f, it = [];
  const lot = d.jd?.lot || '';
  if (d.top) it.push({ p: d.top, name: d.held ? d.topName : d.kind === 'trend' ? '하락 흐름선' : d.kind === 'entry' ? '매수 조건' : '막힐 자리', nameTone: d.held || d.kind === 'entry' ? 'go-t' : 'wa-t', desc: d.held ? `넘어서 마감하면 ${d.topName} 검토` : d.kind === 'ceil' ? '넘어서 마감하면 관심 올리기' : '넘어서 마감하면 매수 검토 조건', dot: 'hollow' });
  const tl = r.trend_upper?.value_today;
  if (tl && tl > c && !(d.top && Math.abs(tl / d.top - 1) < 0.006)) it.push({ p: tl, name: '하락 흐름선', nameTone: 'wa-t', desc: '종가로 넘으면 하락 흐름 끊김', dot: 'hollow' });
  d.ceils.forEach(g => { const st = strength(g, MT); it.push({ p: g.price, name: '막힐 자리', nameTone: 'wa-t', dots: st.dots, desc: confDesc(g, MT), dot: 'wa', g, mt: st.w }); });
  d.floors.forEach(g => { const st = strength(g, MT); it.push({ p: g.price, name: '바닥 후보', nameTone: 'go-t', dots: st.dots, desc: confDesc(g, MT), dot: 'go', g, mt: st.w }); });
  if (d.bottom && !d.floors.some(g => Math.abs(g.price / d.bottom - 1) < 0.006)) it.push({ p: d.bottom, name: d.held ? '손절선' : d.kind === 'entry' ? '무효선' : '바닥', nameTone: 'wa-t', desc: d.held ? `종가로 깨지면 ${lot ? lot + '분 ' : ''}정리` : '종가로 깨지면 관심 해제 검토', dot: 'hollow' });
  const low = Math.min(c, d.bottom ?? c, ...d.floors.map(g => g.price));
  const nx = nextFloorBelow(r, low);
  if (nx && pct(nx.price, c) > -25) it.push({ p: nx.price, name: '다음 바닥', desc: `${f(low)}가 깨지면 열리는 자리 (${nx.kind === 'level' ? `지지 ${nx.n}회` : nx.kind === 'conf' ? `${nx.n}개 기준 겹침` : '52주 저점'})`, dot: 'hollow' });
  it.sort((a, b) => b.p - a.p);
  const merged = []; it.forEach(x => { const m = merged[merged.length - 1]; if (m && Math.abs(m.p / x.p - 1) < 0.003) { if (!m.g && x.g) merged[merged.length - 1] = { ...x, desc: x.desc }; } else merged.push(x); });
  const above = merged.filter(x => x.p > c).slice(-1)[0], below = merged.find(x => x.p < c);
  const nowDesc = [above ? `위 ${above.name} ${sgn(pct(above.p, c))}` : '', below ? `아래 ${below.name} ${sgn(pct(below.p, c))}` : ''].filter(Boolean).join(' · ') || '가까운 기준선 없음';
  const nowIdx = merged.findIndex(x => x.p < c);
  merged.splice(nowIdx < 0 ? merged.length : nowIdx, 0, { p: c, now: true });
  const va = valAgg(V);
  const nearestConf = [...d.floors.slice(0, 1), ...d.ceils.slice(0, 1)].sort((a, b) => Math.abs(a.price - c) - Math.abs(b.price - c))[0];
  return `<div class="pmap">${merged.map(x => {
    if (x.now) return `<div class="pm now"><div class="pv"><b data-live-p="${esc(d.s)}" data-k="${d.k ? 1 : 0}">${f(c)}</b><small class="t2">지금</small></div><div class="rail"><span class="dot now"></span></div><div class="pd"><span>지금 가격</span><span>${esc(nowDesc)}</span></div></div>`;
    const open = x.g && nearestConf && x.g === nearestConf;
    const more = x.g ? `<div class="more"${open ? '' : ' hidden'}><span><b>일봉</b>${esc(x.g.lines.map(LINE_KO).join(' · '))}</span>${x.mt?.length ? `<span><b>주·월봉</b>${esc(x.mt.map(LINE_KO).join(' · '))}</span>` : ''}${va && x.dot === 'go' ? `<span><b>과거 검증</b>닿은 뒤 +2% 반등 ${va.react}% · −2% 이탈 ${va.brk}% → 한 번 튀고 결판나는 자리</span>` : ''}</div>` : '';
    return `<div class="pm"${x.g ? ` data-tog role="button" tabindex="0" aria-expanded="${open}"` : ''}><div class="pv"><b>${f(x.p)}</b><small>${sgn(pct(x.p, c))}</small></div><div class="rail"><span class="dot ${x.dot || ''}"></span></div><div class="pd"><span class="${x.nameTone || ''}">${esc(x.name)}${x.dots ? `<span class="dots">${x.dots}</span>` : ''}</span><span>${esc(x.desc || '')}</span>${more}</div></div>`;
  }).join('')}</div>`;
}

/* ---------------- 근거 탭들 */
function tabReasons(d, FL) {
  const r = d.r, c = d.c, f = d.f, out = [];
  const R = (icn, cls, t, s) => out.push(`<div class="rsn"><span class="rsn-i ${cls}">${ic(icn, 20, 2)}</span><div class="rc"><span>${t}</span><span>${s}</span></div></div>`);
  switch (d.state) {
    case 'floor': R('floor', 'go', `바닥 후보가 바로 아래 (${sgn(pct(d.floor.price, c))})`, d.floor.lines.length >= 4 ? '여러 기준이 한 자리에 겹쳐 반응이 나오기 쉬운 자리예요. 바닥 보장은 아니라서 반등을 확인하고 판단해요.' : '유명한 선 두세 개가 겹친 자리예요. 한 번 튈 수는 있지만 바닥 보장은 아니에요.'); break;
    case 'ceil': R('ceil', 'wa', `막힐 자리가 바로 위 (${sgn(pct(d.ceil.price, c))})`, '여러 기준이 겹친 가격이라 한 번 막히기 쉬워요. 종가로 넘어서면 의미가 커요.'); break;
    case 'enter': R('trend', 'go', d.kind === 'trend' ? `하락 흐름선을 넘었어요${d.daysUp > 1 ? ` (${d.daysUp}일째)` : ''}` : d.kind === 'entry' ? '매수 조건을 채웠어요' : '막힐 자리를 넘었어요', d.kind === 'trend' ? '흐름선을 종가로 넘은 건 하락이 멈췄다는 첫 신호예요. 확신이 아니라 첫 신호라서 1/3만 사요.' : '계획한 조건이에요. 첫 매수는 1/3만, 손절선을 먼저 정해요.'); break;
    case 'next': R('trend', 'go', `${d.topName} 조건을 채웠어요`, '계획대로 다음 차수를 검토해요. 손절선도 같이 올릴지 봐요.'); break;
    case 'broken': R('alert', 'wa', `${d.botName} ${f(d.bottom)} 아래로 마감`, '다음 바닥까지 밀릴 수 있어요. 관심 해제를 검토해요.'); break;
    case 'exit': R('shieldx', 'wa', `손절선 ${f(d.bottom)} 아래로 마감`, '미리 정한 규칙대로면 정리하는 날이에요. 장중 흔들림 말고 종가로만 판단해요.'); break;
    case 'stop': R('shieldx', 'wa', `손절선까지 ${sgn(d.dBot)}`, '오늘 종가가 손절선 아래면 규칙대로 정리, 위면 그대로 보유해요.'); break;
    case 'hold': R('target', '', d.top ? `${d.topName}까지 ${sgn(d.dTop)}` : '보유 중', d.bottom ? `손절선까지 ${sgn(d.dBot)} 여유가 있어요. 추가 매수는 반등을 확인한 뒤에만.` : '손절선을 정해 두세요.'); break;
    default: R('clock', '', d.top ? `${d.topName}까지 ${sgn(d.dTop)}` : '가까운 기준선 없음', '근처에 겹친 자리가 없는 빈 공간이라 다음 기준선까지 움직일 수 있어요. 조건을 채울 때까지 기다려요.');
  }
  const bb = r.bollinger || {}, pat = r.pattern || {}, rv = r.rsi_volume || {};
  if (bb.width_pct_rank_60 != null && bb.width_pct_rank_60 <= 0.1) R('pulse', '', '움직임이 60일 중 가장 작아요', d.top && d.bottom ? `곧 위든 아래든 크게 움직일 수 있어요. ${f(d.top)}과 ${f(d.bottom)} 중 먼저 깨지는 쪽을 따라가요.` : '곧 위든 아래든 크게 움직일 수 있어요. 먼저 종가로 깨지는 쪽을 따라가요.');
  else if (['삼각수렴', '하락쐐기', '상승쐐기'].includes(pat.type) && pat.bars_to_apex && pat.bars_to_apex <= 60) R('pulse', '', `${pat.type} — 끝까지 약 ${pat.bars_to_apex}봉`, '폭이 좁아지는 중이라 끝나면 크게 움직이기 쉬워요. 방향은 먼저 종가로 깨지는 쪽이에요.');
  else if (rv.rsi < 30) R('pulse', 'go', `많이 팔린 상태 (RSI ${rv.rsi.toFixed(0)})`, '너무 많이 팔린 상태예요. 거래량이 늘며 오르면 바닥 신호로 봐요. 하락 흐름에선 며칠 이어질 수도 있어요.');
  else if (rv.rsi > 70) R('pulse', 'wa', `많이 오른 상태 (RSI ${rv.rsi.toFixed(0)})`, '단기로 많이 오른 상태예요. 쫓아 사기보다 눌림을 기다려요.');
  else { const ma = Object.values(r.ma || {}), a = ma.filter(v => c > v.value).length; if (ma.length) R('layers', '', `이동평균선 ${ma.length}개 중 ${a}개 위`, a === 0 ? '모든 이동평균선 아래 — 교과서적인 하락 흐름이에요. 받침이 잠깐 반응하고 깨지기 쉬워요.' : a === ma.length ? '모든 이동평균선 위 — 오름세가 이어지는 중이에요.' : '이동평균선 사이 — 방향을 고르는 중이에요.'); }
  if (FL?.fo) {
    const fo60 = FL.fo['60'], i60 = FL.sum?.i?.['60'], vr = rv.vol_ratio;
    const volNote = vr != null && vr < 0.8 ? ` 다만 ${md(r.asof)} 거래량은 평소의 ${vr.toFixed(1)}배라 ${fo60 > 0 ? '사는' : '파는'} 힘은 약해요.` : vr != null && vr > 1.5 ? ` ${md(r.asof)} 거래량은 평소의 ${vr.toFixed(1)}배로 많았어요.` : '';
    R('users', fo60 > 0 ? 'go' : 'wa', `외국인·기관은 60일간 ${fo60 > 0 ? '사는' : '파는'} 쪽`, `60일 합계 <b>${eok(fo60)}</b>${i60 != null ? `, 개인은 ${eok(i60)}` : ''}.${volNote}`);
  } else if (rv.vol_ratio != null) {
    R('users', '', `거래량 평소의 ${rv.vol_ratio.toFixed(1)}배`, rv.vol_ratio < 0.7 && rv.chg_pct < 0 ? '거래량 없이 내렸어요 — 파는 사람보다 사는 사람이 없는 하락이에요.' : rv.vol_ratio > 1.8 && rv.chg_pct < -3 ? '거래량을 동반해 크게 내렸어요 — 던지는 물량이 나왔어요.' : '거래량은 보통이에요. (미국 종목은 외국인·기관 수급 데이터가 없어요)');
  }
  const ctr = (r.sentences || []).find(x => x.startsWith('반대 근거'));
  const ctrTxt = ctr ? ctr.replace(/^반대 근거:\s*/, '').replace(/\.$/, '').replace(/지지선/g, '바닥 후보').replace(/RSI 과매도/g, '많이 팔린 상태').replace(/이평선/g, '이동평균선') : '';
  return `<div class="tabp flush">${out.join('')}${ctrTxt ? `<div class="counter"><b>반대로 보면</b> — ${esc(ctrTxt)}</div>` : ''}</div>`;
}
function flowBars(FL) {
  const W = 326, H = 96, s = FL.sum || {}, v = [['외국인', s.f?.['60'] ?? 0], ['기관', s.o?.['60'] ?? 0], ['개인', s.i?.['60'] ?? 0]];
  const m = Math.max(1, ...v.map(x => Math.abs(x[1]))), cx = 190, half = 96;
  return `<svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="60일 순매수 합계 — ${v.map(x => `${x[0]} ${eok(x[1])}`).join(', ')}"><line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="var(--line)" stroke-width="1"/>${v.map(([n, x], i) => { const y = 8 + i * 30, w = Math.abs(x) / m * half; return `<text x="0" y="${y + 13}" font-family="IBM Plex Sans KR, sans-serif" font-size="13" fill="var(--t2)">${n}</text><rect x="${x >= 0 ? cx : cx - w}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="18" rx="4" fill="var(--${x >= 0 ? 'up' : 'dn'})" fill-opacity=".85"/><text x="${x >= 0 ? cx - 6 : cx + 6}" y="${y + 13}" text-anchor="${x >= 0 ? 'end' : 'start'}" font-family="Barlow, sans-serif" font-size="13" font-weight="600" fill="var(--t1)">${eok(x)}</text>`; }).join('')}</svg>`;
}
function flowLines(FL) {
  if (!FL.cum?.f?.length) return '';
  const W = 326, H = 132, P = { l: 4, r: 52, t: 8, b: 22 }, cum = FL.cum, n = cum.f.length;
  const all = [...cum.f, ...cum.o, ...cum.i, 0], lo = Math.min(...all), hi = Math.max(...all), sp = hi - lo || 1;
  const x = i => P.l + i * (W - P.l - P.r) / Math.max(1, n - 1), y = v => P.t + (hi - v) / sp * (H - P.t - P.b);
  const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const L = [['f', '외국인', 'var(--t1)', 2.4], ['o', '기관', 'var(--wa)', 2], ['i', '개인', 'var(--t3)', 1.6]];
  const ends = L.map(([k, nm]) => ({ k, nm, y: y(cum[k][n - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const dd = s => s ? `${String(s).slice(4, 6)}/${String(s).slice(6, 8)}` : '';
  return `<svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="60일 누적 순매수 추이"><line x1="${P.l}" x2="${W - P.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 3"/>${L.map(([k, , col, w]) => `<path d="${path(cum[k])}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>`).join('')}${ends.map(e => { const l = L.find(z => z[0] === e.k); return `<text x="${W - P.r + 6}" y="${(e.y + 4).toFixed(1)}" font-family="IBM Plex Sans KR, sans-serif" font-size="12" font-weight="600" fill="${l[2]}">${e.nm}</text>`; }).join('')}<text x="${P.l}" y="${H - 4}" font-family="Barlow, sans-serif" font-size="12" fill="var(--t3)">${dd(FL.daily?.[0]?.d)}</text><text x="${W - P.r}" y="${H - 4}" text-anchor="end" font-family="Barlow, sans-serif" font-size="12" fill="var(--t3)">${dd(FL.asof)}</text></svg>`;
}
function bigRecent(FL) {
  if (FL.big && FL.recent) return [FL.big.replace(/^60일 큰 흐름 — /, ''), FL.recent.replace(/^최근 며칠 — /, '')];
  const fo = FL.fo, s = FL.sum || {}, st = FL.streak || {};
  const big = `외국인·기관이 ${fo['60'] > 0 ? '사는' : '파는'} 쪽 (${eok(fo['60'])}), 개인 ${eok(s.i?.['60'])}`;
  const who = [];
  [['외국인', st.f], ['기관', st.o]].forEach(([nm, v]) => { if (Math.abs(v || 0) >= 3) who.push(`${nm} ${Math.abs(v)}일 연속 ${v > 0 ? '순매수' : '순매도'}`); });
  if (!who.length) { const b = [['외국인', st.f], ['기관', st.o]].filter(x => x[1] > 0).map(x => x[0]), sl = [['외국인', st.f], ['기관', st.o]].filter(x => x[1] < 0).map(x => x[0]); if (b.length && sl.length) who.push(`마지막 날은 ${b.join('·')} 사고 ${sl.join('·')} 팔았어요`); else if (b.length) who.push(`마지막 날은 ${b.join('·')}${b.length > 1 ? ' 모두' : '이'} 샀어요`); else if (sl.length) who.push(`마지막 날은 ${sl.join('·')}${sl.length > 1 ? ' 모두' : '이'} 팔았어요`); }
  return [big, [`5일 동안 ${fo['5'] > 0 ? '사는' : '파는'} 쪽 (${eok(fo['5'])})`, ...who].join(' · ')];
}
function tabFlows(FL) {
  if (!FL?.fo) return '<div class="tabp t3">수급 데이터가 없어요</div>';
  const fw = flowWord(FL), s = FL.sum || {}, fo = FL.fo, i60 = s.i?.['60'];
  const lead = `60일 동안 외국인·기관이 ${N(eok(fo['60']))} ${fo['60'] > 0 ? '사고' : '팔고'}${i60 != null ? `, 개인이 ${N(eok(i60))} ${i60 > 0 ? '샀어요' : '팔았어요'}` : '어요'}.`;
  const [big, rec] = bigRecent(FL);
  return `<div class="tabp"><span class="pill md ${fw.tone === 'go' ? 'p-floor' : 'p-ceil'}">${ic('users', 14, 2.2)}${esc(fw.t)}</span>
    <p class="lead" style="font-size:15px;font-weight:600;margin-top:10px">${lead}</p>
    <div class="two"><div><b>60일 큰 흐름</b> — ${esc(big)}</div><div><b>최근 며칠</b> — ${esc(rec)}</div></div>
    <p class="cap">60일 합계 · 오른쪽 = 산 돈, 왼쪽 = 판 돈</p>${flowBars(FL)}
    <div class="kchips"><span class="chip">최근 5일 외·기 <b>${eok(fo['5'])}</b></span><span class="chip">20일 <b>${eok(fo['20'])}</b></span>${FL.hold?.now != null ? `<span class="chip">외국인 보유 <b>${FL.hold.now}%</b>${FL.hold.chg60 != null ? ` (60일 ${FL.hold.chg60 >= 0 ? '+' : MINUS}${Math.abs(FL.hold.chg60).toFixed(2)}%p)` : ''}</span>` : ''}</div>
    ${FL.cum ? `<p class="cap">60일 누적 — 선이 오른쪽 위로 갈수록 계속 사는 중</p>${flowLines(FL)}` : ''}</div>`;
}
function quarters(asof, n = 4) {
  const d = parseDay(asof) || new Date(); d.setDate(d.getDate() - 45);
  let y = d.getFullYear(), q = Math.floor(d.getMonth() / 3); // 끝난 분기
  if (q === 0) { y -= 1; q = 4; }
  const out = []; for (let i = 0; i < n; i++) { out.unshift(`${String(y).slice(2)}.${q}Q`); q -= 1; if (q === 0) { q = 4; y -= 1; } }
  return out;
}
function tabEarn(sc, scAsof, c, k) {
  if (!sc) return '<div class="tabp t3">발굴 목록 밖의 종목이라 실적 데이터가 없어요</div>';
  const g = sc.growth, p1 = sc.ret1y, pc = v => v == null ? '—' : (v >= 0 ? '+' : MINUS) + Math.abs(Math.round(v * 100)) + '%';
  const lead = g > 0.3 && (p1 ?? 0) < 0.1 ? '이익은 크게 느는데 주가는 제자리' : g > 0 && p1 > 0.1 ? '이익도 주가도 오르는 중' : g < 0 ? '내년 이익이 줄어들 걸로 봐요' : '이익과 주가가 비슷하게 움직여요';
  const op = sc.op_last4 || [], qs = quarters(scAsof, op.length), mx = Math.max(1, ...op), iMax = op.indexOf(Math.max(...op));
  const W = 326, H = 150, bw = 44, gap = (W - op.length * bw) / (op.length + 1);
  const bars = op.map((v, i) => { const h = Math.max(2, v / mx * 96), x = gap + i * (bw + gap), y = 118 - h; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="5" fill="var(${i === iMax ? '--go' : '--track'})"${i === iMax ? ' fill-opacity=".85"' : ''}/><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-family="Barlow, sans-serif" font-size="13" font-weight="600" fill="var(--t1)">${Math.round(v).toLocaleString('ko-KR')}${i === iMax ? ' 최고' : ''}</text><text x="${(x + bw / 2).toFixed(1)}" y="138" text-anchor="middle" font-family="Barlow, sans-serif" font-size="12" fill="var(--t3)">${qs[i] || ''}</text>`; }).join('');
  const parts = sc.parts || {}, PN = { '싸다': '싸다', '신고점': '실적 최고', '미반영': '덜 오름', '성장': '성장' };
  const lastIsMax = op.length && iMax === op.length - 1;
  return `<div class="tabp"><p class="lead">${lead}</p><p class="lead-s">내년 이익 <b class="n go-t">${pc(g)}</b> 예상 · 주가 1년 <b class="n ${tone(p1)}">${pc(p1)}</b></p>
    ${op.length ? `<p class="cap">분기 영업이익 (억 원)</p><svg class="qchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 ${op.length}개 분기 영업이익 ${op.map(v => Math.round(v).toLocaleString('ko-KR') + '억').join(', ')}">${bars}</svg>` : ''}
    <div class="kv"><div><span>PER (이익 대비 가격)</span><span><b>${sc.per?.toFixed(1) ?? '—'}배</b>${sc.ind_per ? ` <span class="t3">· 업종 ${sc.ind_per.toFixed(1)}배</span>` : ''}</span></div>
      ${sc.op_annual ? `<div><span>연간 영업이익</span><b>${sc.op_annual >= 10000 ? `${Math.floor(sc.op_annual / 10000)}조 ${Math.round(sc.op_annual % 10000).toLocaleString('ko-KR')}억` : Math.round(sc.op_annual).toLocaleString('ko-KR') + '억'}</b></div>` : ''}
      ${sc.div != null ? `<div><span>배당 수익률</span><b>${sc.div.toFixed(1)}%</b></div>` : ''}
      ${sc.target ? `<div><span>증권사 목표가 평균</span><span><b>${fmtP(sc.target, k)}</b> <span class="t3">· 지금보다 ${sgn(pct(sc.target, c), 0)}</span></span></div>` : ''}</div>
    <div class="scb"><div class="scb-h"><span style="font-size:14px">발굴 점수</span><b>${Math.round(sc.score)}</b></div><div class="bars">${Object.entries(PN).map(([kk, nm]) => `<div><span>${nm}</span><i><em style="width:${Math.max(0, Math.min(100, parts[kk] ?? 0))}%"></em></i><span>${parts[kk] ?? '—'}</span></div>`).join('')}</div>
      ${parts['신고점'] === 0 && op.length && !lastIsMax ? `<p class="cap" style="margin-top:10px">직전 분기가 최고치(${qs[iMax]})보다 낮아 '실적 최고' 점수는 0</p>` : ''}</div>
    <p class="cap">${md(scAsof)} 발굴 기준 · 매수 추천이 아니라 볼 종목 정보예요</p></div>`;
}
function tabBig(MT, d) {
  if (!MT || (!MT.w && !MT.m)) return '<div class="tabp t3">주봉·월봉 데이터가 아직 없어요</div>';
  const TW = t => t === '하락 추세' ? '내림세' : t === '상승 추세' ? '오름세' : t === '횡보·전환 구간' ? '옆걸음 · 전환 중' : (t || '—');
  const short = t => TW(t).split(' · ')[0];
  const w = MT.w, m = MT.m, f = d.f;
  const lead = w && m && short(w.trend) === short(m.trend) ? `주봉·월봉 모두 ${short(w.trend)} — ${short(w.trend) === '옆걸음' ? '방향은 아직' : short(w.trend) === '오름세' ? '큰 흐름은 위' : '큰 흐름은 아래'}` : `주봉 ${short(w?.trend)} · 월봉 ${short(m?.trend)}`;
  const tile = (x, nm, sub) => !x ? `<div><span class="k">${nm}</span><span class="v t3">데이터 부족</span></div>` : `<div><span class="k">${nm} · ${sub}</span><span class="v">${TW(x.trend)}</span><span class="d">이동평균 ${x.n_ma}개 중 ${x.above}개 위${x.tl && x.tl > x.close ? ` · ${nm.slice(0, 2)} 흐름선 <span class="nr">${f(x.tl)}</span> 아래` : x.rsi != null ? ` · ${x.rsi < 30 ? '많이 팔림' : x.rsi > 70 ? '많이 오름' : '과열·침체 아님'}` : ''}</span></div>`;
  const notes = (MT.strong || []).map(x => x.side === '받침' ? `<div class="note go">바닥 후보 <b class="n">${f(x.price)}</b>는 ${esc(x.with.map(LINE_KO).join(' · '))}과도 겹쳐요 → 더 강한 자리</div>` : `<div class="note wa">막힐 자리 <b class="n">${f(x.price)}</b>는 ${esc(x.with.map(LINE_KO).join(' · '))}과도 겹쳐요 → 넘기 쉽지 않은 자리</div>`).join('');
  return `<div class="tabp"><p class="lead">${esc(lead)}</p><div class="mtf">${tile(w, '주봉', '몇 달 흐름')}${tile(m, '월봉', '몇 년 흐름')}</div>${notes}<p class="cap">큰 봉일수록 보는 사람이 많아서, 큰 봉의 선과 겹치는 자리가 더 잘 맞아요</p></div>`;
}
function tabEvents(C, sym) {
  const mine = eventsFor(C.EV, sym), mkt = eventsFor(C.EV, null).filter(e => !(e.symbols || []).length && e.dd <= 14);
  const all = [...mine, ...mkt].sort((a, b) => a.dd - b.dd);
  if (!all.length) return '<div class="tabp t3">앞으로 2주 안에 잡힌 일정이 없어요</div>';
  return `<div class="list" style="margin-top:12px">${all.map(e => `<div class="ev">${e.dd === 0 ? '<span class="evb today">오늘</span>' : `<span class="evb${e.dd <= 3 ? ' soon' : ''}">D-${e.dd}</span>`}<div class="rc"><span>${esc(evTitle(e.title))}</span><span class="l2"><span class="nr">${md(e.date)}</span>${e.note ? ' · ' + esc(e.note) : ''}</span></div><span class="tag ${(e.symbols || []).includes(sym) ? 'mine' : ''}">${(e.symbols || []).includes(sym) ? '이 종목' : '시장'}</span></div>`).join('')}</div>`;
}

/* ---------------- 종목 화면 그리기 (모바일 = 전체 화면, PC = 오른쪽 칸) */
let TK = null;  // 지금 보고 있는 종목 데이터
async function renderTicker(sym, ov = null, el = null) {
  const pc = isPC();
  if (pc && !el) return renderSplit(sym);
  setNav(pc ? 'home' : 'ticker');
  const box = el || main;
  if (!ov) box.innerHTML = '<div class="loading">불러오는 중…</div>';
  let T = await tickerData(sym, ov);
  if (!T) {
    box.innerHTML = `${pc ? '' : `<header class="th">${backBtn()}<span class="tn">${esc(nameOf(sym))}</span></header>`}<div class="loading">데이터 받아서 선 긋는 중…</div>`;
    const b = await lvBundle(sym);
    if (!b) { box.innerHTML = `${pc ? '' : `<header class="th">${backBtn()}<span class="tn">${esc(nameOf(sym))}</span></header>`}<div class="empty">데이터를 못 받았어요. 종목 코드를 확인하거나 잠시 뒤 다시 시도해 주세요.</div>`; return; }
    T = await tickerData(sym, b);
    if (!T) return;
  }
  TK = T;
  const { C, d, r, MT, V, FL, sc } = T, f = d.f, k = d.k, held = d.held, jd = d.jd;
  const star = T.inWl ? `<button class="ib" type="button" id="tkStar" aria-label="관심 종목" aria-pressed="true" style="color:var(--wa)">${icFill('star', 21)}</button>` : `<button class="ib" type="button" id="tkStar" aria-label="관심 종목에 추가" aria-pressed="false">${ic('star', 21)}</button>`;
  const mineLine = held ? `<div class="mine"><span>보유 <b>${jd.qty.toLocaleString('ko-KR')}주</b></span><span>평단 <b>${f(jd.avg)}</b></span><span>손익 <b class="${tone(d.c - jd.avg)}">${sgn(pct(d.c, jd.avg))}</b></span>${d.bottom ? `<span>손절까지 <b>${sgn(d.dBot)}</b></span>` : '<span class="wa-t">손절선 없음</span>'}</div>` : '';
  const liveNote = T.ov ? `<p class="tp asof" style="margin-top:6px;font-size:12px;color:var(--t3)">${T.ov.open ? '장중' : '최신'} 값으로 계산 · ${T.ov.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} — 판단은 장 마감 뒤 종가로 다시 확인</p>` : '';
  const tabs = [['why', '근거'], ...(FL?.fo ? [['flow', '수급']] : []), ...(sc ? [['earn', '실적']] : []), ...(MT && (MT.w || MT.m) ? [['big', '큰 그림']] : []), ['ev', '일정']];
  let tab = LS.get('tkTab') || 'why'; if (!tabs.some(t => t[0] === tab)) tab = 'why';
  const plan = held && (jd.plan || []).length ? `<div class="tk-plan">${secHead('분할 계획', null, `<span class="more t3" style="cursor:default">손절선 없이 매수 없음</span>`)}<div class="list plan">${jd.plan.map(p => `<div><span class="pn">${p.n}차</span><span>${esc(p.cond)}<span class="ps${/체결/.test(p.status) ? ' done' : ''}"> · ${esc(p.status)}</span></span><span class="n">${esc(p.amount)}</span></div>`).join('')}</div></div>` : '';
  const dial = verdictDial(d);
  box.innerHTML = `<div class="tk">
    <header class="th">${backBtn()}${logo(sym, d.name, 28)}<span class="tn">${esc(d.name)}</span><span class="tc">${esc(sym.replace(/\.(KS|KQ)$/, ''))}</span><div class="end"><a class="ib" href="#/search" aria-label="종목 검색">${ic('search', 21)}</a>${star}</div></header>
    <div class="tk-pcbar">${logo(sym, d.name, 48)}<div class="nmw"><div><span class="nm1">${esc(d.name)}</span><span class="cd">${esc(sym.replace(/\.(KS|KQ)$/, ''))} · ${/\.KS$/.test(sym) ? '코스피' : /\.KQ$/.test(sym) ? '코스닥' : '미국'}</span></div><div><span class="px" data-live-p="${esc(sym)}" data-k="${k ? 1 : 0}">${f(d.c)}</span><span class="n ${tone(d.chg)}" style="font-size:16px" data-live-c="${esc(sym)}">${sgn(d.chg)}</span><span class="t3" style="font-size:13px">${md(r.asof)} 종가</span><span class="live" data-live-t="${esc(sym)}"></span></div></div>
      <div class="end">${star.replace('id="tkStar"', 'id="tkStar2"').replace('class="ib"', 'class="btn sec sq"')}<button class="btn sec sm" type="button" data-alarm>${ic('bell', 18)}${T.inWl ? '조건 알림 켜짐' : '알림 받기'}</button><button class="btn pri sm" type="button" data-trade>${held ? '매매 기록' : '매수 기록'}</button></div></div>
    <div class="tk-mprice"><div class="tp"><span class="big" data-live-p="${esc(sym)}" data-k="${k ? 1 : 0}">${f(d.c)}</span><div style="display:flex;flex-direction:column;padding-bottom:3px"><span class="chg ${tone(d.chg)}" data-live-c="${esc(sym)}">${r.rsi_volume?.chg_pct != null && T.rows.length > 1 ? `${sgnNum(d.c - T.rows[T.rows.length - 2].close, k)} · ` : ''}${sgn(d.chg)}</span><span class="asof">${md(r.asof)} 종가 <span class="live" data-live-t="${esc(sym)}"></span></span></div></div>${liveNote}
      <div class="livewarn" data-live-stop="${esc(sym)}" data-stop="${held && d.bottom ? d.bottom : ''}" data-k="${k ? 1 : 0}" hidden></div></div>
    <div class="tk-verdict"><section class="verdict" aria-label="결론"><div class="vh">${pillHTML(d.vpill, true)}<span class="t3" style="font-size:12px">판단은 종가 기준</span></div><h1>${esc(d.head)}</h1>${dial}${mineLine}
      ${!T.inWl ? `<div class="act" style="margin-top:0">${ic('star', 18)}<span>관심 종목이 아니에요 — 추가하면 매일 판단·알림 대상이 돼요</span><button class="btn sec sm" type="button" data-add style="margin-left:auto;height:36px">추가</button></div>` : ''}</section></div>
    <div class="tk-conds">${secHead('판단 조건', null, '<span class="more t3" style="cursor:default">장 마감 종가로 확인</span>')}${condRows(d)}</div>
    ${plan}
    <div class="tk-chart"><div class="seg" id="tfSeg" role="group" aria-label="봉 단위">${[['h', '1시간'], ['d', '일'], ['w', '주'], ['m', '월']].map(([v, t]) => `<button type="button" data-tf="${v}" aria-pressed="${(LS.get('chartTf') || 'd') === v}">${t}</button>`).join('')}</div>
      <div class="chartbox"><div id="chart" role="img" aria-label="${esc(d.name)} 차트 — 기준선 표시"></div><div class="clg" id="clg"></div></div></div>
    <div class="tk-map">${secHead('가격 지도', null, '<span class="more t3" style="cursor:default">기준 가격은 여기 한 곳에</span>')}${priceMap(d, MT, V)}</div>
    <div class="tk-tabs"><div class="tabs" role="tablist" aria-label="종목 정보">${tabs.map(([v, t]) => `<button type="button" role="tab" data-tab="${v}" aria-selected="${v === tab}">${t}</button>`).join('')}</div><div id="tabBody" role="tabpanel"></div></div>
  </div>
  ${pc ? '' : `<div class="actbar"><div class="in"><button class="btn sec sq" type="button" data-alarm aria-label="${T.inWl ? '조건 알림 켜짐' : '조건 알림 받기'}">${ic('bell', 22, 1.9)}</button><button class="btn pri grow" type="button" data-trade>${held ? '매매 기록' : '매수 기록'}</button></div></div>`}`;
  const drawTab = v => {
    LS.set('tkTab', v);
    $$('[data-tab]', box).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === v)));
    $('#tabBody', box).innerHTML = v === 'flow' ? tabFlows(FL) : v === 'earn' ? tabEarn(sc, T.scAsof, d.c, k) : v === 'big' ? tabBig(MT, d) : v === 'ev' ? tabEvents(C, sym) : tabReasons(d, FL);
  };
  $$('[data-tab]', box).forEach(b => b.onclick = () => drawTab(b.dataset.tab));
  drawTab(tab);
  $$('.pm[data-tog]', box).forEach(p => { const t = () => { const m = $('.more', p); if (!m) return; m.hidden = !m.hidden; p.setAttribute('aria-expanded', String(!m.hidden)); }; p.onclick = t; p.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
  $$('[data-trade]', box).forEach(b => b.onclick = () => openTrade(sym, d));
  $$('[data-alarm]', box).forEach(b => b.onclick = () => T.inWl ? toast('관심 종목이라 조건이 맞으면 알림이 와요 · 종류는 설정에서') : addToWatch(sym));
  $$('#tkStar, #tkStar2', box).forEach(b => b.onclick = () => T.inWl ? toast('관심 종목이에요 · 빼는 건 저장소 watchlist.txt에서') : addToWatch(sym));
  $$('[data-add]', box).forEach(b => b.onclick = () => addToWatch(sym));
  $$('[data-tf]', box).forEach(b => b.onclick = () => { LS.set('chartTf', b.dataset.tf); $$('[data-tf]', box).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawTf(); });
  const TFD = { d: { rows: T.rows, r } }; if (T.ov?.w) TFD.w = T.ov.w; if (T.ov?.m) TFD.m = T.ov.m;
  const drawTf = async () => {
    const tf = LS.get('chartTf') || 'd', all = LS.get('chartMode') === 'all', el2 = $('#chart', box); if (!el2) return;
    if (!TFD[tf]) {
      el2.innerHTML = '<div class="loading">불러오는 중…</div>';
      let rr = await loadCsv(`${sym}.${tf}`), ra = tf === 'h' ? r : await j(`out/${sym}.${tf}.json`);
      if ((!rr.length || !ra || tf === 'h') && QURL()) { const L = await lvChart(sym, tf); if (L?.rows.length) { rr = L.rows; if (tf !== 'h') { try { ra = Engine.analyze(engRows(rr), sym); } catch { } } } }
      TFD[tf] = { rows: rr, r: ra };
    }
    const D = TFD[tf];
    if (!D.rows.length || !D.r) { el2.innerHTML = `<div class="empty">${{ h: '1시간', w: '주', m: '월' }[tf] || ''}봉 데이터가 아직 없어요.${T.inWl ? ' 다음 배치(장 마감 뒤) 때 받아요.' : ''}</div>`; $('#clg', box).innerHTML = ''; delete TFD[tf]; return; }
    drawChart(el2, D.rows, tf === 'd' ? D.r : { ...D.r, close: tf === 'h' ? r.close : D.r.close }, d, all, tf);
    $('#clg', box).innerHTML = chartLegend(d, all, tf) + `<button class="tg" type="button" id="modeTg">${all ? '핵심 선만 보기' : '선 8종 전부 보기'}</button>`;
    $('#modeTg', box).onclick = () => { LS.set('chartMode', all ? 'key' : 'all'); drawTf(); };
  };
  drawTf();
  liveKick();
}
function chartLegend(d, all, tf) {
  const it = (style, col, t) => `<span><i class="${style}" style="${style === 'band' ? `background:${col}` : `border-color:${col}`}"></i>${t}</span>`;
  const u = { h: '시간', d: '일', w: '주', m: '월' }[tf];
  const L = [];
  if (d.r.trend_upper) L.push(it('dash', 'var(--wa)', '하락 흐름선'));
  if (d.ceils.length) L.push(it('band', 'var(--wa-tint)', '막힐 자리'));
  if (d.floors.length) L.push(it('band', 'var(--go-tint)', '바닥 후보'));
  if (d.held && d.bottom) L.push(it('', 'var(--wa)', '손절선'));
  if (d.top && (d.held || d.kind === 'entry')) L.push(it('dash', 'var(--go)', d.held ? d.topName : '매수 조건'));
  L.push(it('', 'var(--t3)', `20${u}선`));
  if (all) L.push(`<span class="t3">· 60·120·200${u}선 · 받침·천장 · 피보</span>`);
  if (tf !== 'd') L.push(`<span class="t3">· ${tf === 'h' ? '선은 일봉 기준' : `${u}봉으로 다시 그은 선`}</span>`);
  return L.join('');
}
/* 차트 — 기본은 핵심 선만 (선 30개 긋는 차트 금지) */
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function alpha(hex, a) { const h = hex.replace('#', ''); if (h.length !== 6) return hex; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
let CHART = null;
function drawChart(el, rows, r, d, all = false, tf = 'd') {
  if (!el || !window.LightweightCharts || !rows.length) return;
  el.innerHTML = '';
  try { CHART?.remove(); } catch { } CHART = null;
  const k = r.krw, V = n => cssVar(n);
  const up = V('--up'), dn = V('--dn'), go = V('--go'), wa = V('--wa'), t3 = V('--t3'), t2 = V('--t2'), line = V('--line'), card = V('--card');
  const chart = LightweightCharts.createChart(el, {
    layout: { background: { color: card }, textColor: t3, fontFamily: "Barlow, 'IBM Plex Sans KR', sans-serif", fontSize: 12 },
    grid: { vertLines: { visible: false }, horzLines: { color: line } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
    timeScale: { borderVisible: false, rightOffset: 6, timeVisible: tf === 'h', secondsVisible: false },
    handleScroll: { vertTouchDrag: false }, handleScale: { axisPressedMouseMove: { time: true, price: false } },
    crosshair: { mode: 0 }, localization: { locale: 'ko-KR', priceFormatter: v => fmtP(v, k) },
  });
  CHART = chart;
  const cs = chart.addCandlestickSeries({ upColor: up, downColor: dn, borderVisible: false, wickUpColor: up, wickDownColor: dn, priceLineColor: t2 });
  cs.setData(rows);
  const vs = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  vs.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vs.setData(rows.map(x => ({ time: x.time, value: x.volume, color: alpha(x.close >= x.open ? up : dn, 0.35) })));
  const sma = w => rows.map((x, i) => i < w - 1 ? null : { time: x.time, value: rows.slice(i - w + 1, i + 1).reduce((a, b) => a + b.close, 0) / w }).filter(Boolean);
  (all ? [[20, t3, 0], [60, t2, 2], [120, t3, 1], [200, t2, 3]] : [[20, t3, 0]]).forEach(([w, col, st]) => { if (rows.length >= w) chart.addLineSeries({ color: col, lineWidth: 1, lineStyle: st, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(sma(w)); });
  const pl = (price, color, title, style = 0, width = 1, label = true) => price && cs.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: label, title: label ? title : '' });
  const c = r.close;
  if (all) {
    (r.levels || []).forEach(l => pl(l.price, alpha(l.price < c ? go : wa, 0.7), l.price < c ? '받침' : '천장', 2, 1, false));
    Object.values(r.fib?.levels || {}).forEach(v => pl(v, alpha(t2, 0.5), '', 3, 1, false));
    if (r.keys?.w52_low) pl(r.keys.w52_low, alpha(dn, 0.7), '52주 저점', 3, 1, true);
  }
  (r.confluence || []).forEach(g => pl(g.price, alpha(g.price < c ? go : wa, 0.45), g.price < c ? '바닥 후보' : '막힐 자리', 0, 4, true));
  if (d.held && d.bottom) pl(d.bottom, wa, '손절', 0, 1, true);
  if (d.top && (d.held || d.kind === 'entry')) pl(d.top, go, d.held ? d.topName : '매수 조건', 2, 1, true);
  const idx = Object.fromEntries(rows.map((x, i) => [x.time, i]));
  const tline = (t, color, title, style) => {
    if (!t || idx[t.from] === undefined) return;
    const i0 = idx[t.from], n = rows.length, y0 = t.value_today - t.slope_per_bar * (n - 1 - i0);
    const pts = []; for (let i = i0; i < n; i++) pts.push({ time: rows[i].time, value: y0 + t.slope_per_bar * (i - i0) });
    chart.addLineSeries({ color, lineWidth: 2, lineStyle: style, priceLineVisible: false, lastValueVisible: !!title, crosshairMarkerVisible: false, title }).setData(pts);
  };
  tline(r.trend_upper, wa, '흐름선', 2);
  if (all) tline(r.trend_lower, alpha(go, 0.8), '', 2);
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, rows.length - ({ h: 120, d: 90, w: 104, m: 120 }[tf] || 90)), to: rows.length + 4 });
  new ResizeObserver(() => { if (el.clientWidth) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }); }).observe(el);
}
function bindBack() { /* 뒤로 버튼은 router 의 전역 처리로 */ }

/* ================================================================ 실시간 (Cloudflare Worker 중계) — 보는 용도. 판단·손절은 계속 종가 기준 */
const QURL = () => ((window.INVESTOOL_CONFIG || {}).QUOTE_URL || '').replace(/\/$/, '');
async function lvGet(path) { const u = QURL(); if (!u) return null; try { const r = await fetch(u + path); return r.ok ? await r.json() : null; } catch { return null; } }
async function lvChart(sym, tf) {
  const j0 = await lvGet(`/c?s=${enc(sym)}&tf=${tf}`); if (!j0?.rows?.length) return null;
  return { rows: j0.rows.map(([t, o, h, l, c, v]) => ({ time: tf === 'h' ? t + 9 * 3600 : t, open: o, high: h, low: l, close: c, volume: v })), open: j0.open };
}
const engRows = rows => rows.map(r => ({ date: r.time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
function lvFlows(t) {  // flows.py analyze 와 같은 계산
  if (!t?.length) return null;
  const daily = [...t].reverse().map(x => { const c = x.close || 0; return { d: x.date, f: Math.round((x.foreign || 0) * c / 1e7) / 10, o: Math.round((x.organ || 0) * c / 1e7) / 10, i: Math.round((x.indiv || 0) * c / 1e7) / 10, hr: x.foreign_ratio, c }; });
  const cum = { f: [], o: [], i: [] }, acc = { f: 0, o: 0, i: 0 };
  daily.forEach(d => ['f', 'o', 'i'].forEach(k => { acc[k] += d[k]; cum[k].push(Math.round(acc[k] * 10) / 10); }));
  const S = (k, n) => Math.round(daily.slice(-n).reduce((s, d) => s + d[k], 0) * 10) / 10;
  const streak = k => { const L = daily[daily.length - 1][k], sg = L > 0 ? 1 : L < 0 ? -1 : 0; let n = 0; for (let i = daily.length - 1; i >= 0; i--) { const v = daily[i][k]; if (sg && v !== 0 && (v > 0) === (sg > 0)) n++; else break; } return sg * n; };
  const sum = Object.fromEntries(['f', 'o', 'i'].map(k => [k, { 5: S(k, 5), 20: S(k, 20), 60: S(k, 60) }]));
  const fo = { 5: Math.round((sum.f[5] + sum.o[5]) * 10) / 10, 20: Math.round((sum.f[20] + sum.o[20]) * 10) / 10, 60: Math.round((sum.f[60] + sum.o[60]) * 10) / 10 };
  const hr = daily.map(d => d.hr).filter(x => x != null), hchg = hr.length > 1 ? Math.round((hr[hr.length - 1] - hr[0]) * 100) / 100 : null;
  return { asof: daily[daily.length - 1].d, daily, cum, sum, fo, streak: { f: streak('f'), o: streak('o') }, hold: { now: hr.length ? hr[hr.length - 1] : null, chg60: hchg } };
}
function lvMtf(rd, W, M) {  // mtf.py 와 같은 계산
  const U = { w: '주', m: '월' }, out = { near: [], strong: [] };
  const summ = (r, tf) => {
    const c = r.close, ma = r.ma || {}, above = Object.values(ma).filter(v => c > v.value).length, n = Object.keys(ma).length;
    const trend = !n ? '기간 짧음(상장 초기)' : above === 0 ? '하락 추세' : above === n ? '상승 추세' : '횡보·전환 구간';
    return { asof: r.asof, close: c, trend, above, n_ma: n, rsi: r.rsi_volume?.rsi, tl: r.trend_upper?.value_today ?? null };
  };
  const near = (r, tf) => {
    const u = U[tf], L = [];
    Object.entries(r.ma || {}).forEach(([k, v]) => L.push([`${k.replace('sma', '')}${u}선`, v.value]));
    (r.levels || []).forEach(l => L.push([`${u}봉 ${l.price < rd.close ? '지지' : '저항'}(${l.touches}회)`, l.price]));
    if (r.trend_upper) L.push([r.trend_upper.slope_per_bar < 0 ? `${u}봉 하락 추세선` : `${u}봉 상단 추세선`, r.trend_upper.value_today]);
    if (r.trend_lower) L.push([r.trend_lower.slope_per_bar > 0 ? `${u}봉 상승 추세선` : `${u}봉 하단 추세선`, r.trend_lower.value_today]);
    return L.filter(([, p]) => p && Math.abs(p / rd.close - 1) <= 0.03).map(([label, p]) => ({ tf, label, price: p, pct: Math.round((p / rd.close - 1) * 10000) / 100 }));
  };
  if (W) { out.w = summ(W, 'w'); out.near.push(...near(W, 'w')); }
  if (M) { out.m = summ(M, 'm'); out.near.push(...near(M, 'm')); }
  (rd.confluence || []).forEach(g => { const hits = out.near.filter(n => Math.abs(n.price / g.price - 1) <= 0.015); if (hits.length) out.strong.push({ price: g.price, side: g.price < rd.close ? '받침' : '천장', with: hits.map(h => h.label) }); });
  return (out.w || out.m) ? out : null;
}
async function lvBundle(sym) {
  if (!QURL() || !window.Engine) return null;
  const kr = isKrw(sym);
  const [d, w, m, ft] = await Promise.all([lvChart(sym, 'd'), lvChart(sym, 'w'), lvChart(sym, 'm'), kr ? lvGet(`/f?s=${sym}`) : null]);
  if (!d || d.rows.length < 40) return null;
  const r = Engine.analyze(engRows(d.rows), sym);
  const an = x => { try { return x && x.rows.length >= 20 ? Engine.analyze(engRows(x.rows), sym) : null; } catch { return null; } };
  const rw = an(w), rm = m && m.rows.length >= 15 ? an(m) : null;
  return { r, rows: d.rows, open: d.open, w: w ? { rows: w.rows, r: rw } : null, m: m ? { rows: m.rows, r: rm } : null, M: lvMtf(r, rw, rm), F: Array.isArray(ft) ? lvFlows(ft) : null, at: new Date() };
}
let LIVE = {}, liveTimer = null;
function liveKick() { clearInterval(liveTimer); liveTimer = null; setTimeout(liveStart, 400); }
function liveStart() {
  clearInterval(liveTimer); liveTimer = null;
  if (!QURL()) return;
  const syms = [...new Set($$('[data-live-p]').map(e => e.dataset.liveP))].slice(0, 40);
  if (!syms.length) return;
  const tick = async () => {
    if (document.hidden) return;
    try { const r = await fetch(QURL() + '/q?s=' + enc(syms.join(',')), { cache: 'no-store' }); if (r.ok) { LIVE = { ...LIVE, ...(await r.json()) }; liveApply(); } } catch { }
  };
  tick(); liveTimer = setInterval(tick, 15000);
}
function liveApply() {
  const now = Date.now(), cssSel = v => (window.CSS && CSS.escape) ? CSS.escape(v) : v;
  for (const [s, q] of Object.entries(LIVE)) {
    if (!q || q.p == null || s === '_at') continue;
    const open = q.st === 'open', upv = q.pct >= 0;
    if (!open) continue;  // 장이 닫혀 있으면 종가 그대로
    $$(`[data-live-p="${cssSel(s)}"]`).forEach(el => { const t = fmtP(q.p, el.dataset.k === '1'); if (el.textContent !== t) { el.textContent = t; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } });
    $$(`[data-live-c="${cssSel(s)}"]`).forEach(el => { el.textContent = sgn(q.pct, 2); el.classList.toggle('up', upv && q.pct > 0); el.classList.toggle('dn', q.pct < 0); });
    const ago = q.t ? Math.max(0, Math.round((now - new Date(q.t)) / 1000)) : null;
    $$(`[data-live-t="${cssSel(s)}"]`).forEach(el => { el.innerHTML = `<i></i>장중${ago != null && ago < 3600 ? ` · ${ago < 60 ? ago + '초' : Math.round(ago / 60) + '분'} 전` : ''}`; el.classList.add('on'); });
    $$(`[data-live-stop="${cssSel(s)}"]`).forEach(el => {
      const st = +el.dataset.stop; if (!st) { el.hidden = true; return; }
      const k = el.dataset.k === '1', room = (q.p / st - 1) * 100;
      if (room < 0) { el.hidden = false; el.className = 'livewarn hard'; el.innerHTML = `장중 ${fmtP(q.p, k)} — 손절선 ${fmtP(st, k)} <b>아래</b>예요. 규칙은 <b>종가</b>로만 판단해요. 마감까지 지켜보기.`; }
      else if (room < 1.5) { el.hidden = false; el.className = 'livewarn'; el.innerHTML = `장중 손절선 ${fmtP(st, k)}까지 <b>${room.toFixed(1)}%</b> — 종가 확인 전엔 매매하지 않기.`; }
      else el.hidden = true;
    });
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && liveTimer) liveStart(); });

/* ================================================================ GitHub 실행 (토큰은 이 기기에만) */
const REPO = 'mannolmeok/investool';
async function dispatch(wf, inputs) {
  const tok = LS.get('ghToken'); if (!tok) return { ok: false, why: 'token' };
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ ref: 'main', inputs }) }).catch(() => null);
  return res && res.status === 204 ? { ok: true } : { ok: false, why: res ? `HTTP ${res.status}` : '네트워크' };
}
async function addToWatch(sym) {
  if (!LS.get('ghToken')) { openTokenSheet(`"${nameOf(sym)}"을(를) 관심 종목에 넣으려면 GitHub 토큰이 한 번 필요해요.`); return; }
  toast('관심 종목에 추가 요청 중…');
  const r = await dispatch('analyze.yml', { q: sym, add: 'true' });
  toast(r.ok ? '추가 요청 완료 — 2~3분 뒤부터 매일 판단·알림 대상이에요' : `추가 실패 (${r.why}) — 토큰 권한(Actions: Read and write)을 확인해 주세요`, 4200);
}

/* ================================================================ 매매 기록 (앱에서 입력 → GitHub 가 positions.json·trades.json 반영) */
function openTrade(sym, d) {
  const held = d.held, jd = d.jd || {}, k = d.k, fmt = v => v === '' || v == null || !isFinite(v) ? '' : (k ? String(Math.round(+v)) : (+v).toFixed(2));
  const modes = held ? [['buy', '추가 매수'], ['sell', '매도'], ['set', '손절선·목표']] : [['buy', '매수']];
  let mode = 'buy';
  const draw = () => {
    const sup = d.floor?.price ?? d.bottom ?? d.r.keys?.recent_low10;
    const tg = (jd.targets?.length ? jd.targets : [d.top, d.ceil?.price].filter(x => x && x > d.c).sort((a, b) => a - b)).map(fmt).join(', ');
    const fld = (id, label, val, hint = '', type = 'decimal') => `<label class="field"><span>${label}</span><input id="pf_${id}" inputmode="${type}" value="${esc(val ?? '')}" placeholder="${esc(hint)}"></label>`;
    $('#trBody').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${mode !== 'set' ? fld('qty', mode === 'sell' ? '판 수량' : '산 수량', mode === 'sell' ? jd.qty : '', '주', 'numeric') + fld('price', mode === 'sell' ? '판 가격' : '산 가격', fmt(d.c)) : ''}
      ${mode !== 'sell' ? fld('stop', '손절선 (종가 기준 · 필수)', fmt(jd.stop || sup), '필수') + fld('targets', '목표가 (쉼표로)', tg) : ''}
      ${mode === 'set' ? fld('stop_long', '장기분 손절선 (선택)', jd.stop_long ? fmt(jd.stop_long) : '') : ''}</div>
      <label class="field" style="margin-top:10px"><span>메모 — 왜 ${mode === 'sell' ? '팔았' : '샀'}나</span><input id="pf_memo" value="" placeholder="${mode === 'sell' ? '예) 흐름선 돌파 실패' : '예) 바닥 후보에서 반등 확인'}"></label>
      <p class="msg" id="pfRisk" style="margin-top:10px"></p>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri grow" type="button" id="pfOk">저장</button><button class="btn sec" type="button" data-close>취소</button></div>
      <p class="msg" id="pfMsg" style="margin-top:10px"></p>`;
    const risk = () => {
      const q = +($('#pf_qty')?.value || 0), p = +($('#pf_price')?.value || 0), st = +($('#pf_stop')?.value || 0), el = $('#pfRisk');
      if (mode === 'buy' && q && p && st) el.innerHTML = st >= p ? '<span class="wa-t">손절선은 산 가격보다 낮아야 해요</span>' : `손절까지 <b class="n">${sgn(pct(st, p))}</b> · 최대 손실 <b class="n">${k ? Math.round((p - st) * q).toLocaleString('ko-KR') + '원' : '$' + ((p - st) * q).toFixed(2)}</b>`;
      else el.textContent = mode === 'buy' ? '손절선 없이 매수 없음 — 손절선을 먼저 정해요.' : '';
    };
    $$('#trBody input').forEach(i => i.oninput = risk); risk();
    $('#pfOk').onclick = () => saveTrade(sym, d, mode);
    $$('#trBody [data-close]').forEach(b => b.onclick = closeSheet);
  };
  openSheet(`${sheetHead(held ? '매매 기록' : '매수 기록')}
    <p class="msg" style="margin:-2px 0 12px">${esc(d.name)} · 지금 <span class="n">${d.f(d.c)}</span> · 저장하면 1~2분 뒤 판단·알림·기록에 반영돼요</p>
    ${modes.length > 1 ? `<div class="seg sm" id="trSeg" style="margin-bottom:14px">${modes.map(([m, t]) => `<button type="button" data-m="${m}" aria-pressed="${m === mode}">${t}</button>`).join('')}</div>` : ''}
    <div id="trBody"></div>`, { label: '매매 기록' });
  $$('#trSeg [data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#trSeg [data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); });
  $$('#sheet .shh [data-close]').forEach(b => b.onclick = closeSheet);
  draw();
}
async function saveTrade(sym, d, m) {
  const v = id => $('#pf_' + id)?.value.trim(), msg = $('#pfMsg');
  const op = { action: m, symbol: sym, name: d.name, id: Math.random().toString(16).slice(2, 12) };
  if (m !== 'set') { op.qty = +v('qty'); op.price = +v('price'); }
  if (m !== 'sell') { if (v('stop')) op.stop = +v('stop'); if (v('targets')) op.targets = v('targets').split(',').map(x => +x.trim()).filter(Boolean); }
  if (v('stop_long')) op.stop_long = +v('stop_long');
  if (v('memo')) op.memo = v('memo');
  if (m === 'buy' && !op.stop) { msg.className = 'msg bad'; msg.textContent = '손절선 없이 매수 없음 — 손절선을 넣어 주세요.'; return; }
  if (m === 'buy' && op.stop >= op.price) { msg.className = 'msg bad'; msg.textContent = '손절선은 산 가격보다 낮아야 해요.'; return; }
  if (m !== 'set' && (!op.qty || !op.price)) { msg.className = 'msg bad'; msg.textContent = '수량과 가격을 넣어 주세요.'; return; }
  const human = `${d.name} ${m === 'buy' ? '매수' : m === 'sell' ? '매도' : '설정 변경'}${op.qty ? ` ${op.qty}주` : ''}${op.price ? ` @ ${op.price}` : ''}${op.stop ? `, 손절 ${op.stop}` : ''}${op.targets ? `, 목표 ${op.targets.join('/')}` : ''}${op.memo ? ` (${op.memo})` : ''}`;
  if (!LS.get('ghToken')) { msg.className = 'msg'; msg.innerHTML = `GitHub 토큰이 없어서 저장을 못 했어요. 설정 → 연결에서 넣어 두거나, 이 문장을 Claude에게 보내 주세요:<br><b>${esc(human)}</b>`; return; }
  msg.className = 'msg'; msg.textContent = '저장 요청 중…'; $('#pfOk').disabled = true;
  const r = await dispatch('position.yml', { op: JSON.stringify(op) });
  if (!r.ok) { msg.className = 'msg bad'; msg.textContent = `실패 (${r.why}) — 토큰 권한(Actions: Read and write)을 확인해 주세요`; $('#pfOk').disabled = false; return; }
  closeSheet(); toast('저장 요청 완료 — 반영되면 화면이 새로 그려져요', 3600);
  const t0 = Date.now();
  const tick = async () => {
    try { const T = await (await fetch('trades.json?_=' + Date.now(), { cache: 'no-store' })).json(); if (T.some(x => x.id === op.id)) { toast('매매 기록 반영 완료'); resetData(); route(); return; } } catch { }
    if (Date.now() - t0 > 300000) { toast('5분이 지나도 반영이 안 보여요 — GitHub Actions의 position 기록을 확인해 주세요', 5000); return; }
    setTimeout(tick, 8000);
  };
  setTimeout(tick, 20000);
}
function openTokenSheet(why = '') {
  openSheet(`${sheetHead('GitHub 토큰')}
    ${why ? `<p class="msg" style="margin-bottom:12px">${esc(why)}</p>` : ''}
    <p class="msg">GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → 저장소는 investool만 → 권한 <b>Actions: Read and write</b> → 만든 토큰을 아래에 붙여 넣어요. 이 기기에만 저장돼요.</p>
    <label class="field" style="margin-top:12px"><span>토큰</span><input id="ghTok" type="password" autocomplete="off" placeholder="github_pat_…" value=""></label>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri grow" type="button" id="ghSave">저장</button>${LS.get('ghToken') ? '<button class="btn sec" type="button" id="ghDel">지우기</button>' : ''}</div>
    <p class="msg" id="ghMsg" style="margin-top:8px">${LS.get('ghToken') ? '지금 저장된 토큰이 있어요. 새로 넣으면 바뀌어요.' : ''}</p>`, { label: 'GitHub 토큰' });
  $$('#sheet [data-close]').forEach(b => b.onclick = closeSheet);
  $('#ghSave').onclick = () => { const v = $('#ghTok').value.trim(); if (!v) { $('#ghMsg').textContent = '토큰을 붙여 넣어 주세요.'; return; } LS.set('ghToken', v); closeSheet(); toast('토큰 저장됨 — 이 기기에서만 쓰여요'); if (location.hash.startsWith('#/settings')) route(); };
  const del = $('#ghDel'); if (del) del.onclick = () => { LS.del('ghToken'); closeSheet(); toast('토큰을 지웠어요'); if (location.hash.startsWith('#/settings')) route(); };
}

/* ================================================================ 알림 — 상태별 피드 (오늘 = 지금 판단 모델 · 지난 날 = 알림 기록 + 다음 날 결과) */
let AL_F = 'all';
const AL_OPEN = new Set();
function alertDetail(d) {
  const r = d.r, f = d.f, box = [];
  if (d.state === 'floor' && d.floor) {
    box.push(`<span><b>왜 바닥 후보?</b>${esc(d.floor.lines.map(LINE_KO).join(' · '))}${d.floor.lines.length >= 4 ? '이 한 자리에' : ''}</span>`);
    const va = valAgg(cache['out/validation.json']); if (va) box.push(`<span><b>과거엔</b>닿은 뒤 +2% 반등 ${va.react}% · −2% 이탈 ${va.brk}%</span>`);
  } else if (d.state === 'ceil' && d.ceil) box.push(`<span><b>왜 막힐 자리?</b>${esc(d.ceil.lines.map(LINE_KO).join(' · '))}</span>`);
  else if (d.state === 'enter' && d.kind === 'trend') box.push(`<span><b>흐름선</b>${f(d.top)} · 종가로 넘은 지 ${d.daysUp}일째</span>`);
  if (d.fw) box.push(`<span><b>수급</b>${esc(d.fw.t)}</span>`);
  return `<div class="detail"><div class="box">${box.join('') || '<span>자세한 근거는 종목 화면에서 볼 수 있어요</span>'}</div><div class="btns"><a class="btn sec sm" href="${tHref(d.s)}">종목 보기</a><button class="btn sm" type="button" data-fold style="background:none;color:var(--t2)">${ic('up', 16, 2)}접기</button></div></div>`;
}
function alertLine(d) {
  if (d.state === 'floor' && d.ceil) return `바닥 후보 ${N(d.f(d.floor.price))} (${N(sgn(pct(d.floor.price, d.c)))})와 막힐 자리 ${N(d.f(d.ceil.price))} (${N(sgn(pct(d.ceil.price, d.c)))}) 사이`;
  return d.l1;
}
async function renderAlerts() {
  setNav('alerts');
  const C = await loadCore(), M = C.M;
  const [LOG] = await Promise.all([j('out/alerts_log.json'), j('out/validation.json')]);
  const cats = { all: ['전체', M.todo], go: ['조건 충족', M.todo.filter(d => d.state === 'enter' || d.state === 'next')], near: ['근접', M.todo.filter(d => d.near)], held: ['보유', M.todo.filter(d => d.held)] };
  if (!cats[AL_F]) AL_F = 'all';
  const list = cats[AL_F][1];
  const today = list.map(d => {
    const open = AL_OPEN.has(d.s);
    return `<div class="exp"><div class="row" role="button" tabindex="0" aria-expanded="${open}" data-ex="${esc(d.s)}">${logo(d.s, d.name, 36)}<div class="rc"><div class="rt"><span class="nm">${esc(d.name)}</span>${pillHTML(d.pill)}</div><span class="l1">${alertLine(d)}</span>${open ? '' : `<span class="l2">${d.l2}</span>`}</div><span class="chev">${ic(open ? 'up' : 'down', 20, 2)}</span></div>${open ? alertDetail(d) : ''}</div>`;
  }).join('');
  const dates = Object.keys(LOG || {}).sort().reverse().filter(x => x < C.asof).slice(0, 7);
  const wl = new Set(C.wl);
  const past = dates.map((dt, i) => {
    let items = Object.values(LOG[dt] || {});
    if (AL_F === 'go') items = items.filter(x => x.tag === 'go'); else if (AL_F === 'near') items = items.filter(x => x.tag === 'near'); else if (AL_F === 'held') items = items.filter(x => x.tag === 'stop' || C.M.by[x.symbol]?.held);
    items.sort((a, b) => (wl.has(b.symbol) - wl.has(a.symbol)) || a.symbol.localeCompare(b.symbol));
    if (!items.length) return '';
    return `<div class="day past"><span>${i === 0 ? `<b>어제</b> · ${md(dt)} 종가 기준` : `<b>${md(dt)}</b> 종가 기준`}</span></div><div class="past"><div class="list">${items.map(x => {
      const first = (x.body || '').split(/(?<=\.)\s/)[0].replace(/\.$/, '');
      return `<a class="row" href="${tHref(x.symbol)}">${logo(x.symbol, nameOf(x.symbol), 28)}<div class="rc"><span style="font-size:14px">${esc(x.title)}</span><span class="l2">${esc(first)}${x.after ? ` → <span class="t2">${esc(x.after)}</span>` : ''}</span></div></a>`;
    }).join('')}</div></div>`;
  }).join('');
  main.innerHTML = `<div class="${isPC() ? 'page' : ''}"><header class="ph keep"><h1>알림</h1><div class="end"><a class="ib mob-only" href="#/search" aria-label="종목 검색">${ic('search', 21)}</a><a class="ib" href="#/settings" aria-label="설정">${ic('sliders', 22)}</a></div></header>
    <div class="filters" role="group" aria-label="알림 거르기">${Object.entries(cats).map(([key, [t, L]]) => `<button class="fchip" type="button" data-f="${key}" aria-pressed="${AL_F === key}">${t}<span class="n">${L.length}</span></button>`).join('')}</div>
    <div class="day"><span><b>오늘</b> · ${md(C.asof)} 종가 기준</span>${C.built ? `<span class="n" style="font-weight:500">${esc(C.built.slice(11, 16))}</span>` : ''}</div>
    ${today ? `<div class="list">${today}</div>` : `<div class="card t2" style="font-size:14px">${AL_F === 'all' ? '오늘은 판단할 종목이 없어요. 기다리는 것도 일이에요.' : '이 종류의 알림은 오늘 없어요.'}</div>`}
    ${past}
    <p class="cap">종가가 확정된 뒤 하루 한 번 · 같은 규칙은 하루 1회 · 누르면 그 종목 화면으로 · 알림 종류는 설정에서</p></div>`;
  $$('[data-f]').forEach(b => b.onclick = () => { AL_F = b.dataset.f; renderAlerts(); });
  $$('[data-ex]').forEach(el => { const t = () => { const s = el.dataset.ex; AL_OPEN.has(s) ? AL_OPEN.delete(s) : AL_OPEN.add(s); const y = scrollY; renderAlerts().then(() => scrollTo(0, y)); }; el.onclick = t; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
  $$('[data-fold]').forEach(b => b.onclick = e => { e.stopPropagation(); AL_OPEN.clear(); const y = scrollY; renderAlerts().then(() => scrollTo(0, y)); });
  setBadge();
}

/* ================================================================ 발굴 — "볼 만한 새 종목은?" 한 줄 목록 + 상세 시트 */
let SCF = { cap: 'all', mkt: 'all', sort: 'score', awake: 0, gov: 1, more: 0 };
try { SCF = { ...SCF, ...JSON.parse(LS.get('scrF3') || '{}'), more: 0 }; } catch { }
const SC_CAP = [['all', '시총 전체'], ['s', '3천억~1조'], ['m', '1~5조'], ['l', '5조 이상']], SC_MKT = [['all', '시장 전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']], SC_SORT = [['score', '종합 점수순'], ['gap', '덜 오른 순'], ['val', '싼 순'], ['flow', '수급(20일)순']];
const PARTS = [['싸다', '싸다'], ['신고점', '실적 최고'], ['미반영', '덜 오름'], ['성장', '성장']];
function bars4(parts, w = 29, h = 22) {
  const bw = 5, gap = (w - 4 * bw) / 3;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${PARTS.map(([k], i) => { const v = Math.max(0, Math.min(100, parts?.[k] ?? 0)), hh = Math.max(2, v / 100 * h); return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(h - hh).toFixed(1)}" width="${bw}" height="${hh.toFixed(1)}" rx="1.5" fill="var(${v >= 70 ? '--t2' : '--track'})"/>`; }).join('')}</svg>`;
}
const pc100 = v => v == null ? '—' : (v >= 0 ? '+' : MINUS) + Math.abs(Math.round(v * 100)) + '%';
async function renderScreener() {
  setNav('screener');
  const [SC] = await Promise.all([j('out/screener.json'), loadCore()]);
  const wl = new Set(CORE.wl);
  const head = `<header class="ph keep"><h1>발굴</h1><div class="end"><button class="ib" type="button" id="scInfo" aria-label="점수 기준 보기">${ic('info', 21)}</button><a class="ib mob-only" href="#/search" aria-label="종목 검색">${ic('search', 21)}</a></div></header>`;
  if (!SC?.rows?.length) { main.innerHTML = `<div class="${isPC() ? 'page' : ''}">${head}<div class="card t2">첫 발굴은 토요일 아침에 자동으로 돌아요.</div></div>`; return; }
  SC.rows.forEach(r => { if (r.symbol && !NAMES[r.symbol]) NAMES[r.symbol] = r.name; });
  let L = SC.rows.filter(r => (SCF.cap === 'all' || (SCF.cap === 's' ? r.cap < 10000 : SCF.cap === 'm' ? r.cap >= 10000 && r.cap < 50000 : r.cap >= 50000)) && (SCF.mkt === 'all' || r.market === SCF.mkt) && (!SCF.gov || !(r.gov_flags || []).length) && (!SCF.awake || r.awake));
  const key = { score: r => r.score, gap: r => r.parts?.['미반영'] ?? 0, val: r => r.parts?.['싸다'] ?? 0, flow: r => r.flow20 ?? -1e9 }[SCF.sort];
  L = [...L].sort((a, b) => key(b) - key(a));
  const N0 = 10, shown = SCF.more ? L : L.slice(0, N0);
  const dd = (k, opts) => `<button class="fchip dd" type="button" data-dd="${k}" aria-haspopup="true">${(opts.find(o => o[0] === String(SCF[k])) || opts[0])[1]}</button>`;
  const row = (r, i) => {
    const sub = r.awake ? `<span class="go-t">사기 시작</span>` : `<span class="go-t">이익 ${N(pc100(r.growth))}</span>`;
    const tail = r.awake && r.per && (r.ret1y == null || r.ret1y > 0) ? ` · PER ${N(r.per.toFixed(1))}` : ` · 주가 ${N(pc100(r.ret1y), tone(r.ret1y))}`;
    return `<button class="srow" type="button" data-sc="${esc(r.symbol)}"><span class="rk">${i + 1}</span>${logo(r.symbol, r.name, 36)}<div class="rc"><span class="nm">${esc(r.name)}${wl.has(r.symbol) ? `<span class="star-ic" role="img" aria-label="관심 종목">${icFill('star', 14)}</span>` : ''}</span><span class="l2" style="font-size:13px">${N(capTxt(r.cap))} · ${sub}${tail}</span></div>${bars4(r.parts)}<span class="sc">${Math.round(r.score)}</span></button>`;
  };
  main.innerHTML = `<div class="${isPC() ? 'page' : ''}">${head}
    <p class="t2" style="font-size:15px">이익은 느는데 주가는 덜 오른 종목</p>
    <p class="t3" style="font-size:12px;margin-top:2px"><span class="nr">${md(SC.asof)}</span> 기준 · 시총 3천억 이상 ${SC.universe}개 중 <b class="t1">${SC.passed}개</b> · 주 1회 갱신</p>
    <div class="filters" style="margin-top:12px">${dd('cap', SC_CAP)}${dd('mkt', SC_MKT)}${dd('sort', SC_SORT)}<button class="fchip" type="button" data-tg="awake" aria-pressed="${!!SCF.awake}">사기 시작만</button><button class="fchip" type="button" data-tg="gov" aria-pressed="${!!SCF.gov}">지배구조 주의 숨김</button></div>
    <div class="lgnd"><span>${{ score: '점수 높은 순', gap: '덜 오른 순', val: '싼 순', flow: '20일 수급 순' }[SCF.sort]} · ${L.length}개</span><span>막대 ${bars4({ '싸다': 80, '신고점': 60, '미반영': 90, '성장': 40 })} 싸다 · 실적 최고 · 덜 오름 · 성장</span></div>
    ${L.length ? `<div class="list">${shown.map(row).join('')}${L.length > N0 && !SCF.more ? `<button class="morebtn" type="button" id="scMore">${L.length - N0}개 더 보기${ic('down', 16, 2)}</button>` : ''}</div>` : '<div class="card t2">조건에 맞는 종목이 없어요. 거르기를 풀어 보세요.</div>'}
    <p class="cap">매수 추천이 아니라 볼 종목 목록이에요. ★ 사기 시작 상위 종목은 매주 관심 종목에 자동으로 들어가요.</p></div>`;
  const save = () => LS.set('scrF3', JSON.stringify({ ...SCF, more: 0 }));
  $$('[data-tg]').forEach(b => b.onclick = () => { SCF[b.dataset.tg] = SCF[b.dataset.tg] ? 0 : 1; save(); renderScreener(); });
  $$('[data-dd]').forEach(b => b.onclick = () => {
    const k = b.dataset.dd, opts = { cap: SC_CAP, mkt: SC_MKT, sort: SC_SORT }[k];
    openSheet(`${sheetHead({ cap: '시가총액', mkt: '시장', sort: '정렬' }[k])}<div class="list">${opts.map(([v, t]) => `<button class="set" type="button" data-v="${v}"><div class="rc"><span>${t}</span></div>${String(SCF[k]) === v ? `<span class="go-t">${ic('check', 20, 2.2)}</span>` : ''}</button>`).join('')}</div>`, { label: '거르기' });
    $$('#sheet [data-close]').forEach(x => x.onclick = closeSheet);
    $$('#sheet [data-v]').forEach(x => x.onclick = () => { SCF[k] = x.dataset.v; save(); closeSheet(); renderScreener(); });
  });
  const mb = $('#scMore'); if (mb) mb.onclick = () => { SCF.more = 1; renderScreener(); };
  $('#scInfo').onclick = () => { openSheet(`${sheetHead('점수 기준')}<div class="msg" style="display:flex;flex-direction:column;gap:10px">
    <p><b>① 잡주 컷</b> — 시총 3천억 이상 · 하루 거래 30억 이상</p><p><b>② 싸다</b> — PER이 업종보다 낮음 (가장 먼저 봄)</p><p><b>③ 실적 최고</b> — 주가 말고 매출·영업이익이 최고치</p><p><b>④ 덜 오름</b> — 이익 증가가 1년 주가 상승보다 큼 (필수)</p><p><b class="go-t">사기 시작</b> — 최근 20일·5일 모두 외국인·기관 순매수 = 타이밍</p>
    <p><b class="wa-t">지배구조 주의</b> — 지주사이거나 자회사 몫이 30% 이상, 분할 상장 남발, 상장 자회사 2개 이상, 감사의견 비적정. 지주사·중복상장 할인으로 싸게 머물 수 있어요.</p>
    <p class="t3">참고: 워뇨띠 Q&A — "저평가를 먼저, 그다음 차트" · "매출·영업이익이 신고점을 돌파하는 종목" · "몇 년 안에 주목받을 애들". 매수 추천이 아니라 볼 종목 목록이에요.</p></div>`, { label: '점수 기준' }); $$('#sheet [data-close]').forEach(x => x.onclick = closeSheet); };
  $$('[data-sc]').forEach(b => b.onclick = () => openScSheet(SC.rows.find(r => r.symbol === b.dataset.sc), wl.has(b.dataset.sc)));
}
function openScSheet(r, inWl) {
  if (!r) return;
  const why = r.why || [], k = true;
  const whyFor = { '싸다': why.find(x => /PER/.test(x)), '신고점': why.find(x => /최고치|신고점/.test(x)) || (r.parts?.['신고점'] ? '직전 분기 영업이익·매출이 지금까지 중 최고' : '직전 분기가 최고치보다 낮아요'), '미반영': `이익은 느는데 주가는 1년 ${pc100(r.ret1y)}${r.pos52 != null ? ` · 52주 범위 아래쪽 ${Math.round(r.pos52 * 100)}% 지점` : ''}`, '성장': `증권사 예상 내년 이익 ${pc100(r.growth)}` };
  const flowTxt = r.flow20 == null ? '' : r.awake ? `외국인·기관 20일 <b class="n">${eok(r.flow20)}</b> · 5일 <b class="n">${eok(r.flow5)}</b> — 사기 시작` : `외국인·기관 20일 <b class="n">${eok(r.flow20)}</b> — ${r.flow20 > 0 ? '사는 중' : '아직 파는 중 (사기 시작 전)'}`;
  const meta = [r.dart?.major_pct != null ? `최대주주 ${Math.round(r.dart.major_pct)}%` : '', r.reports60 != null ? `리포트 60일 ${r.reports60}건` : '', r.tv20 != null ? `하루 거래 ${Math.round(r.tv20).toLocaleString('ko-KR')}억` : ''].filter(Boolean).join(' · ');
  openSheet(`<div class="shh">${logo(r.symbol, r.name, 44)}<div class="rc"><span style="font-size:18px;font-weight:700">${esc(r.name)}</span><span class="t2" style="font-size:13px">${r.market === 'KOSPI' ? '코스피' : '코스닥'} · 시총 ${N(capTxt(r.cap))} · ${N(fmtP(r.close, k))}원</span></div><div class="end"><span class="nb" style="font-size:30px">${Math.round(r.score)}</span><span class="t2" style="font-size:13px;margin-right:4px">점</span><button class="ib" type="button" data-close aria-label="닫기">${ic('x', 20, 2)}</button></div></div>
    <p style="font-size:15px;font-weight:600;margin-top:8px">왜 골랐나</p>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">${PARTS.map(([kk, nm]) => `<div><div class="bars" style="margin:0"><div><span style="font-size:14px;color:var(--t1)">${nm}</span><i><em style="width:${Math.max(0, Math.min(100, r.parts?.[kk] ?? 0))}%"></em></i><span style="font-size:14px">${r.parts?.[kk] ?? '—'}</span></div></div><p class="t2" style="font-size:13px;margin-top:4px">${esc(String(whyFor[kk] || '').replace(/ — 업종/, ' — 업종').replace(/낮음$/, '낮아요'))}</p></div>`).join('')}</div>
    ${flowTxt ? `<div class="note ${r.awake || r.flow20 > 0 ? 'go' : 'wa'}" style="margin-top:14px">${flowTxt}</div>` : ''}
    ${(r.gov_flags || []).length ? `<div class="note wa">지배구조 주의 — ${esc(r.gov_flags.join(' · '))}</div>` : ''}
    ${meta ? `<p class="cap" style="margin-top:10px">${esc(meta)}</p>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px"><a class="btn sec grow" href="${tHref(r.symbol)}">종목 화면</a>${inWl ? `<button class="btn pri grow" type="button" disabled>관심 종목이에요</button>` : `<button class="btn pri grow" type="button" id="scAdd">관심에 추가</button>`}</div>`, { label: `${r.name} 발굴 상세` });
  $$('#sheet [data-close]').forEach(x => x.onclick = closeSheet);
  $$('#sheet a[href^="#/t/"]').forEach(a => a.addEventListener('click', () => closeSheet()));
  const add = $('#scAdd'); if (add) add.onclick = () => { closeSheet(); addToWatch(r.symbol); };
}

/* ================================================================ 기록 — "규칙대로 하고 있나?" (포지션 · 매매 · 규칙 점수) */
async function renderJournal() {
  setNav('journal');
  const [C, T0] = await Promise.all([loadCore(), txt('trades.json').then(x => { try { return JSON.parse(x); } catch { return []; } })]);
  const T = (T0 || []).filter(x => x.side === 'buy' || x.side === 'sell');
  const money = (v, krw) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? MINUS : '') + (krw ? Math.abs(Math.round(v)).toLocaleString('ko-KR') + '원' : '$' + Math.abs(v).toFixed(2));
  const sells = T.filter(x => x.side === 'sell'), buys = T.filter(x => x.side === 'buy');
  const realK = sells.filter(x => isKrw(x.symbol)).reduce((a, x) => a + (x.realized || 0), 0), realU = sells.filter(x => !isKrw(x.symbol)).reduce((a, x) => a + (x.realized || 0), 0);
  const wins = sells.filter(x => (x.realized || 0) > 0).length, rs = sells.filter(x => x.r != null).map(x => x.r);
  const water = buys.filter(x => x.avg_before && x.price < x.avg_before), late = sells.filter(x => x.rule === 'late_stop');
  const score = Math.max(0, 100 - late.length * 20 - water.length * 15);
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const ym = `${y}-${String(mo + 1).padStart(2, '0')}`, byDay = {};
  T.filter(x => (x.date || '').startsWith(ym)).forEach(x => { const d = +x.date.slice(8); (byDay[d] = byDay[d] || []).push(x); });
  const cal = '일월화수목금토'.split('').map(d => `<div class="cal-h">${d}</div>`).join('') + Array.from({ length: first }, () => '<div></div>').join('') +
    Array.from({ length: days }, (_, i) => { const d = i + 1, L = byDay[d] || [], r = L.filter(x => x.side === 'sell').reduce((a, x) => a + (x.realized || 0), 0), hasB = L.some(x => x.side === 'buy');
      return `<div class="cal-d ${r > 0 ? 'win' : r < 0 ? 'loss' : ''} ${d === now.getDate() ? 'today' : ''}"><span class="nr">${d}</span>${hasB ? '<i title="매수"></i>' : ''}${r ? `<em>${r > 0 ? '+' : MINUS}${Math.abs(r) >= 1e4 ? Math.round(Math.abs(r) / 1e4) + '만' : Math.abs(Math.round(r))}</em>` : ''}</div>`; }).join('');
  const ruleChip = x => x.side === 'buy' ? (x.avg_before && x.price < x.avg_before ? '<span class="pill p-ceil">평단 아래 추가</span>' : '<span class="pill p-floor">손절선 지정</span>') : x.rule === 'late_stop' ? '<span class="pill p-stop">늦은 손절</span>' : x.rule === 'stop' ? '<span class="pill p-floor">손절 지킴</span>' : '';
  const held = C.M.held;
  main.innerHTML = `<div class="${isPC() ? 'page' : ''}"><header class="ph keep"><h1>기록</h1><span class="sub">종목 화면 '매수 기록'으로 쌓여요</span></header>
    <div class="kpis">
      <div class="kpi"><span>실현 손익</span><b class="${tone(realK || realU)}">${sells.some(x => isKrw(x.symbol)) ? money(realK, true) : sells.length ? money(realU, false) : '—'}</b>${sells.some(x => isKrw(x.symbol)) && sells.some(x => !isKrw(x.symbol)) ? `<small class="n ${tone(realU)}">${money(realU, false)}</small>` : `<small>${sells.length}번 매도</small>`}</div>
      <div class="kpi"><span>승률</span><b>${sells.length ? Math.round(wins / sells.length * 100) + '%' : '—'}</b><small>${sells.length}번 중 ${wins}번 이익</small></div>
      <div class="kpi"><span>평균 R</span><b class="${avgR == null ? '' : tone(avgR)}">${avgR != null ? (avgR > 0 ? '+' : avgR < 0 ? MINUS : '') + Math.abs(avgR).toFixed(2) + 'R' : '—'}</b><small>1R = 손절까지 거리</small></div>
      <div class="kpi"><span>규칙 점수</span><b class="${score >= 80 ? 'go-t' : score >= 60 ? 'wa-t' : 'dn'}">${score}</b><small>늦은 손절 ${late.length} · 평단 아래 추가 ${water.length}</small></div>
    </div>
    ${secHead('지금 보유', held.length)}${held.length ? `<div class="list">${held.map(d => `<a class="row mid" href="${tHref(d.s)}">${logo(d.s, d.name, 36)}<div class="rc"><div class="rt"><span class="nm">${esc(d.name)}</span>${pillHTML(d.pill)}</div><span class="l2 t2" style="font-size:13px">${d.jd.qty.toLocaleString('ko-KR')}주 · 평단 ${N(d.f(d.jd.avg))} · 손절 ${d.bottom ? `${N(d.f(d.bottom))} (${N(sgn(d.dBot))})` : '<span class="wa-t">없음</span>'}</span></div><div class="rr"><span class="p ${tone(d.c - d.jd.avg)}">${sgn(pct(d.c, d.jd.avg))}</span><span class="c t3">손익</span></div></a>`).join('')}</div>` : '<div class="card t2" style="font-size:14px">보유 종목이 없어요</div>'}
    ${secHead(`${y}년 ${mo + 1}월`, null, '<span class="more t3" style="cursor:default">빨강 이익 · 파랑 손실 · 점 매수</span>')}<div class="list"><div class="cal">${cal}</div></div>
    ${secHead('매매 기록', T.length)}${T.length ? `<div class="list">${[...T].reverse().map(x => { const krw = isKrw(x.symbol), nm = nameOf(x.symbol) !== x.symbol ? nameOf(x.symbol) : x.name; return `<a class="row" href="${tHref(x.symbol)}">${logo(x.symbol, nm, 36)}<div class="rc"><div class="rt"><span class="nm">${esc(nm)}</span><span class="pill p-wait" style="color:var(--${x.side === 'buy' ? 'up' : 'dn'})">${x.side === 'buy' ? '매수' : '매도'}</span>${ruleChip(x)}</div><span class="l1"><span class="nr">${md(x.date)}</span> · ${N(x.qty)}주 @ ${N(fmtP(x.price, krw))}${x.side === 'sell' ? ` · <span class="n ${tone(x.realized)}">${money(x.realized, krw)}</span>${x.r != null ? ` · ${N((x.r > 0 ? '+' : x.r < 0 ? MINUS : '') + Math.abs(x.r) + 'R')}` : ''}` : x.stop ? ` · 손절 ${N(fmtP(x.stop, krw))}` : ''}</span>${x.memo ? `<span class="l2">${esc(x.memo)}</span>` : ''}</div></a>`; }).join('')}</div>` : '<div class="card t2" style="font-size:14px">아직 기록이 없어요</div>'}
    <details class="card" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">채점 기준</summary><div class="msg" style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <p><b>손절선 지정</b> — 살 때 손절선이 없으면 저장이 안 돼요 (규칙: 손절선 없이 매수 없음).</p><p><b class="dn">늦은 손절</b> — 손절선보다 1% 넘게 아래에서 판 경우 −20점.</p><p><b class="wa-t">평단 아래 추가</b> — 평단보다 낮은 가격에 더 산 경우 −15점. 반등 확인 뒤였다면 메모에 근거를 남겨 두세요.</p><p><b>R</b> = (판 가격 − 평단) ÷ (평단 − 손절선). +2R = 감수한 위험의 2배를 벌었다는 뜻.</p></div></details></div>`;
}

/* ================================================================ 설정 — 알림 · 데이터 · 연결 · 화면 */
const PREF_DEF = { go: true, near: true, flow: true, etc: true };
function prefsLocal() { try { return { ...PREF_DEF, ...JSON.parse(LS.get('pushPrefs') || '{}') }; } catch { return { ...PREF_DEF }; } }
function nextRun() {
  const now = new Date(), cands = [];
  for (let i = 0; i < 8; i++) { const d = new Date(now); d.setDate(now.getDate() + i); const dw = d.getDay(); for (const [h, m, txt0, wd] of [[15, 43, '국내 장 마감 후', [1, 2, 3, 4, 5]], [6, 13, '미국 장 마감 후', [2, 3, 4, 5, 6]]]) { if (!wd.includes(dw)) continue; const t = new Date(d); t.setHours(h, m, 0, 0); if (t > now) cands.push([t, txt0]); } }
  cands.sort((a, b) => a[0] - b[0]); const [t, why] = cands[0] || [];
  if (!t) return '';
  const sameDay = t.toDateString() === now.toDateString();
  return `${sameDay ? '' : `${t.getMonth() + 1}/${t.getDate()} `}${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}|${why}`;
}
async function renderSettings() {
  setNav('settings');
  const C = await loadCore();
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  let sub = null; try { const reg = supported ? await swReg() : null; sub = reg ? await reg.pushManager.getSubscription() : null; } catch { }
  const subs = await j('push_subs.json', true) || [];
  const linked = sub && (Array.isArray(subs) ? subs : [subs]).some(x => x.endpoint === sub.endpoint);
  const ua = navigator.userAgent, dev = /iphone|ipad/i.test(ua) ? '아이폰' : /android/i.test(ua) ? '안드로이드' : /mac/i.test(ua) ? '맥' : /win/i.test(ua) ? '윈도우' : '이 기기';
  const br = /edg\//i.test(ua) ? '엣지' : /chrome|crios/i.test(ua) ? '크롬' : /safari/i.test(ua) ? '사파리' : /firefox/i.test(ua) ? '파이어폭스' : '브라우저';
  const pushOn = perm === 'granted' && !!sub;
  const pushSub = !supported ? '이 브라우저는 알림을 지원하지 않아요' : /iphone|ipad/i.test(ua) && !(matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? '아이폰은 공유 → 홈 화면에 추가 뒤 그 아이콘으로 열어야 해요' : pushOn ? `이 기기 · ${dev} ${br} · ${linked ? '연결됨' : '구독 코드 등록 필요'}` : perm === 'denied' ? '브라우저에서 알림이 막혀 있어요 — 사이트 설정에서 허용해 주세요' : '꺼짐';
  const P = prefsLocal(), tok = !!LS.get('ghToken');
  const nr = nextRun().split('|');
  const sw = (id, on, label, dis = false) => `<button class="sw" type="button" role="switch" id="${id}" aria-checked="${on}" aria-label="${label}"${dis ? ' disabled' : ''}></button>`;
  const theme = LS.get('theme') || 'dark';
  main.innerHTML = `<div class="${isPC() ? 'page' : ''}"><header class="back-h">${backBtn()}<h1>설정</h1></header>
    <p class="sg">알림</p><div class="list">
      <div class="set"><div class="rc"><span>푸시 알림</span><span>${esc(pushSub)}</span></div>${sw('swPush', pushOn, '푸시 알림', !supported)}</div>
      <div class="set"><span class="tile go">${ic('bolt', 16, 2.4)}</span><div class="rc"><span>조건 충족</span><span>하락 흐름 끊김 · 매수 조건 · 다음 차수</span></div>${sw('pf_go', P.go, '조건 충족 알림')}</div>
      <div class="set"><span class="tile floor">${ic('floor', 16, 2.4)}</span><div class="rc"><span>바닥 후보 · 막힐 자리 근접</span><span>많이 팔린 상태 · 아래 흐름선 이탈 포함</span></div>${sw('pf_near', P.near, '근접 알림')}</div>
      <div class="set"><span class="tile stop">${ic('shieldx', 16, 2.2)}</span><div class="rc"><span>손절 근접 · 이탈</span><span>끌 수 없음</span></div>${sw('pf_stop', true, '손절 알림', true)}</div>
      <div class="set"><span class="tile mid">${ic('users', 16, 2)}</span><div class="rc"><span>수급 전환</span><span>외국인·기관이 사기 시작 · 팔기 시작</span></div>${sw('pf_flow', P.flow, '수급 전환 알림')}</div>
      <button class="set" type="button" id="btnTest"><div class="rc"><span>시험 알림 보내기</span><span>${tok ? '서버에서 이 기기로 한 통 · 1~2분' : '이 기기에서 바로 한 통'}</span></div>${chev()}</button>
    </div>
    <p class="msg" id="pfMsg" style="margin:8px 4px 0"></p>
    <div id="subBox" hidden><div class="card" style="margin-top:10px"><p class="msg">이 기기 구독 코드예요. 복사해서 Claude에게 붙여 넣거나 저장소의 push_subs.json에 추가하면 연결 끝.</p><textarea id="subTxt" readonly rows="3" style="width:100%;margin-top:8px;background:var(--s2);color:var(--t1);border:1px solid var(--line);border-radius:10px;padding:8px;font:12px/1.4 Barlow,monospace"></textarea><button class="btn sec sm" type="button" id="btnCopy" style="margin-top:8px">${ic('copy', 16)}구독 코드 복사</button></div></div>
    <p class="sg">데이터</p><div class="list">
      <div class="set"><div class="rc"><span>마지막 갱신</span></div><span class="val"><span class="dot${C.asof && dDays(C.asof) < -4 ? ' off' : ''}"></span><span class="n" style="font-weight:500">${esc(C.built ? md(C.built) + ' ' + C.built.slice(11, 16) : md(C.asof))}</span>${C.asof && dDays(C.asof) < -4 ? '오래됨' : '정상'}</span></div>
      <div class="set"><div class="rc"><span>다음 자동 갱신</span></div><span class="val"><span class="n" style="font-weight:500">${esc(nr[0] || '—')}</span>${esc(nr[1] || '')}</span></div>
      <button class="set" type="button" id="btnRefresh"><div class="rc"><span>지금 새로 받기</span><span>${tok ? '배치를 바로 돌려요 · 3~5분' : '이 기기에 최신 파일을 다시 받아요'}</span></div><span class="t2">${ic('refresh', 20)}</span></button>
    </div>
    <p class="sg">연결</p><div class="list">
      <button class="set" type="button" id="btnTok"><div class="rc"><span>GitHub 토큰</span><span>종목 추가 · 매매 기록 · 알림 설정 저장에 필요 · 이 기기에만 저장</span></div><span class="val ${tok ? 'go-t' : ''}">${tok ? `${ic('check', 16, 2.4)}저장됨` : '넣기'}</span></button>
      <button class="set" type="button" id="btnSub"><div class="rc"><span>푸시 구독 코드 복사</span><span>${sub ? (linked ? '등록돼 있어요' : '아직 등록 안 됐어요') : '알림을 먼저 켜 주세요'}</span></div><span class="t2">${ic('copy', 20)}</span></button>
    </div>
    <p class="sg">화면 · 도움말</p><div class="list">
      <div class="set"><div class="rc"><span>테마</span></div><div class="seg sm" style="width:200px" id="themeSel">${[['dark', '다크'], ['light', '라이트'], ['system', '기기']].map(([v, t]) => `<button type="button" data-t="${v}" aria-pressed="${theme === v}">${t}</button>`).join('')}</div></div>
      <a class="set" href="#/glossary"><div class="rc"><span>쉬운 말 사전 · 용어 풀이</span></div>${chev()}</a>
      <a class="set" href="#/rules"><div class="rc"><span>내 매매 규칙 — 종가 손절 · 반등 전 추가 매수 없음</span></div>${chev()}</a>
    </div>
    <p class="cap">야후 파이낸스 일봉(15분 지연) · 수급은 네이버 증권 · 판단은 모두 종가 기준이에요.</p></div>`;
  bindBack();
  $$('#themeSel [data-t]').forEach(b => b.onclick = () => { setTheme(b.dataset.t); $$('#themeSel [data-t]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('#btnTok').onclick = () => openTokenSheet();
  $('#swPush').onclick = async () => {
    const m = $('#pfMsg'); const cfg = window.INVESTOOL_CONFIG || {};
    if (pushOn) { try { await sub.unsubscribe(); } catch { } toast('이 기기 알림을 껐어요'); return renderSettings(); }
    const p = await Notification.requestPermission(); if (p !== 'granted') { m.className = 'msg bad'; m.textContent = '알림 권한이 거부됐어요.'; return; }
    if (!cfg.VAPID_PUBLIC_KEY) { m.textContent = 'config.js 에 공개키가 없어요.'; return; }
    try {
      const reg = await swReg(4000);
      if (!reg) { m.className = 'msg bad'; m.textContent = '앱 설치 정보(서비스 워커)가 아직 준비되지 않았어요. 새로고침 뒤 다시 눌러 주세요.'; return; }
      const s2 = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.VAPID_PUBLIC_KEY) });
      const js = JSON.stringify({ ...s2.toJSON(), _device: `${dev} ${br}` });
      reg.showNotification('investool · 시험 알림', { body: '이 기기에서 알림이 보이면 켜진 거예요.', icon: 'icons/icon-192.png' });
      await renderSettings();
      const subs2 = await j('push_subs.json', true) || [];
      if (!(Array.isArray(subs2) ? subs2 : [subs2]).some(x => x.endpoint === s2.endpoint)) { $('#subBox').hidden = false; $('#subTxt').value = js; }
    } catch (e) { m.className = 'msg bad'; m.textContent = '구독 실패: ' + e.message; }
  };
  const savePrefs = async (key, on) => {
    const P2 = { ...prefsLocal(), [key]: on }; LS.set('pushPrefs', JSON.stringify(P2));
    const m = $('#pfMsg');
    if (!LS.get('ghToken')) { m.className = 'msg'; m.innerHTML = '이 기기에 저장했어요. 서버 알림에도 적용하려면 <b>GitHub 토큰</b>이 필요해요.'; return; }
    m.className = 'msg'; m.textContent = '알림 설정 저장 중…';
    const r = await dispatch('prefs.yml', { prefs: JSON.stringify({ go: P2.go, near: P2.near, flow: P2.flow, etc: P2.near }) });
    m.className = r.ok ? 'msg ok' : 'msg bad'; m.textContent = r.ok ? '저장 요청 완료 — 다음 알림부터 적용돼요' : `저장 실패 (${r.why})`;
  };
  [['pf_go', 'go'], ['pf_near', 'near'], ['pf_flow', 'flow']].forEach(([id, key]) => { const b = $('#' + id); b.onclick = () => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on)); savePrefs(key, on); }; });
  $('#pf_stop').onclick = () => toast('손절 알림은 끌 수 없어요');
  $('#btnTest').onclick = async () => {
    if (LS.get('ghToken')) { const r = await dispatch('push-test.yml', {}); toast(r.ok ? '시험 알림 요청 — 1~2분 뒤 도착해요' : `요청 실패 (${r.why})`, 3600); return; }
    if (!supported || Notification.permission !== 'granted') { toast('먼저 푸시 알림을 켜 주세요'); return; }
    const reg = await swReg(); if (reg) reg.showNotification('investool · 시험 알림', { body: '이 기기에서 알림이 보이면 켜진 거예요.', icon: 'icons/icon-192.png' }); else toast('앱 설치 정보가 아직 준비되지 않았어요');
  };
  $('#btnRefresh').onclick = async () => {
    if (LS.get('ghToken')) { const r = await dispatch('daily.yml', {}); toast(r.ok ? '배치 실행 요청 — 3~5분 뒤 새 데이터가 들어와요' : `요청 실패 (${r.why})`, 3600); return; }
    resetData(); await loadCore(true); toast('최신 파일을 다시 받았어요'); renderSettings();
  };
  $('#btnSub').onclick = async () => {
    if (!sub) { toast('먼저 푸시 알림을 켜 주세요'); return; }
    const js = JSON.stringify({ ...sub.toJSON(), _device: `${dev} ${br}` });
    try { await navigator.clipboard.writeText(js); toast('구독 코드 복사됨'); } catch { $('#subBox').hidden = false; $('#subTxt').value = js; $('#subTxt').select(); }
  };
  const cp = $('#btnCopy'); if (cp) cp.onclick = async () => { const t = $('#subTxt'); try { await navigator.clipboard.writeText(t.value); toast('구독 코드 복사됨'); } catch { t.select(); document.execCommand('copy'); toast('구독 코드 복사됨'); } };
}
const swReg = (ms = 800) => Promise.race([navigator.serviceWorker.getRegistration().then(r => r?.active ? r : navigator.serviceWorker.ready), new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null);
function b64ToU8(b) { const p = '='.repeat((4 - b.length % 4) % 4); const s = (b + p).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function setTheme(t) {
  LS.set('theme', t);
  document.documentElement.dataset.theme = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  const m = $('#themeColor'); if (m) m.content = cssVar('--bg') || '#141517';
  if (TK && $('#chart')) route();
}

/* ================================================================ 보조 화면들 — 시장 · 수급 레이더 · 선 검증 성적 · 쉬운 말 사전 · 내 규칙 · 검색 */
const pageWrap = (title, body, sub = '') => `<div class="${isPC() ? 'page' : ''}"><header class="back-h">${backBtn()}<h1>${esc(title)}</h1>${sub ? `<span class="t3" style="font-size:12px;margin-left:6px;padding-top:3px">${sub}</span>` : ''}</header>${body}</div>`;

async function renderMarket() {
  setNav('home');
  const C = await loadCore(), mk = macro(C);
  if (!mk) { main.innerHTML = pageWrap('시장', '<div class="card t2">시장 지표는 다음 배치 뒤에 보여요</div>'); bindBack(); return; }
  const card = x => `<div class="card" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t2" style="font-size:13px">${esc(x.n)}</span><span class="t3 nr" style="font-size:12px">${md(x.last)}</span></div>
    <div style="display:flex;align-items:baseline;gap:10px;margin-top:2px"><span class="n" style="font-size:22px">${x.val(x.v)}</span><span class="n ${tone(x.c1)}" style="font-size:13px">${sgn(x.c1)}</span><span class="t3" style="font-size:12px">20일 ${x.bp ? `${x.d20 >= 0 ? '+' : MINUS}${Math.abs(Math.round(x.d20 * 100))}bp` : sgn(x.c20)}</span></div>
    <div style="margin-top:8px">${spark(x.spark, 300, 32).replace('class="spark"', 'class="spark" style="width:100%;height:32px" preserveAspectRatio="none"')}</div>
    <p style="font-size:13px;margin-top:8px" class="${x.t === 'on' ? 'go-t' : x.t === 'off' ? 'wa-t' : 't2'}">${esc(x.text)}</p></div>`;
  main.innerHTML = pageWrap('시장', `${wxCard(mk)}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:12px">${mk.cards.map(card).join('')}</div>
    <p class="cap">좋음은 청록, 나쁨은 주황. 좋음 − 나쁨이 2 이상이면 맑음, −2 이하면 비. 하루 두 번(국내·미국 장 마감 뒤) 갱신돼요.</p>`);
  bindBack();
}
async function renderFlowsRadar() {
  setNav('home');
  const C = await loadCore(), ents = Object.entries(C.FL || {}).sort((a, b) => (b[1].fo?.['5'] ?? 0) - (a[1].fo?.['5'] ?? 0));
  const m = Math.max(1, ...ents.flatMap(([, f]) => [Math.abs(f.fo?.['5'] ?? 0), Math.abs(f.fo?.['20'] ?? 0)]));
  const sc = v => Math.log10(1 + Math.abs(v)) / Math.log10(1 + m) * 50;  // 금액 차이가 수백 배라 로그 길이
  const bar = v => `<svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="4" width="100" height="2" rx="1" fill="var(--track)"/><rect x="${v >= 0 ? 50 : 50 - sc(v)}" y="1" width="${Math.max(0.6, sc(v))}" height="8" rx="2" fill="var(--${v >= 0 ? 'up' : 'dn'})"/><rect x="49.7" y="0" width="0.6" height="10" fill="var(--t3)"/></svg>`;
  main.innerHTML = pageWrap('수급 레이더', ents.length ? `<p class="t2" style="font-size:14px;margin-bottom:10px">"내 뒤에 사줄 사람이 있나" — 관심 종목의 외국인+기관 순매수 (최근 5일 순)</p>
    <div class="list">${ents.map(([s, f]) => { const fw = flowWord(f); return `<a class="row mid" href="${tHref(s)}">${logo(s, nameOf(s), 32)}<div class="rc" style="gap:6px"><div class="rt"><span class="nm" style="font-size:14px">${esc(nameOf(s))}</span>${fw ? `<span class="pill ${fw.tone === 'go' ? 'p-floor' : 'p-ceil'}">${esc(fw.t.replace('외국인·기관이 ', '').replace('사던 외국인·기관이 ', ''))}</span>` : ''}</div>
      <div style="display:grid;grid-template-columns:34px 1fr 64px;gap:8px;align-items:center;font-size:12px"><span class="t3">5일</span>${bar(f.fo['5'])}<span class="n ${tone(f.fo['5'])}" style="text-align:right">${eok(f.fo['5'])}</span><span class="t3">20일</span>${bar(f.fo['20'])}<span class="n ${tone(f.fo['20'])}" style="text-align:right">${eok(f.fo['20'])}</span></div></div></a>`; }).join('')}</div>
    <p class="cap">빨강 = 순매수 · 파랑 = 순매도 · 막대 길이는 금액 크기(로그) · 금액은 순매수 수량 × 그날 종가로 계산한 근삿값 · 네이버 증권</p>` : '<div class="card t2">수급 데이터는 다음 배치 뒤에 보여요 (국내 종목만)</div>', C.FL && Object.values(C.FL)[0]?.asof ? `${md(Object.values(C.FL)[0].asof)} 기준` : '');
  bindBack();
}
async function renderTrack() {
  setNav('home');
  const [TR] = await Promise.all([j('out/track.json'), loadCore()]);
  if (!TR?.summary) { main.innerHTML = pageWrap('선 검증 성적', '<div class="card t2">다음 배치 뒤에 생겨요</div>'); bindBack(); return; }
  const S = TR.summary, dmy = S['더미 받침']?.pct;
  const rate = (p, ref, col) => `<div class="rate"><i><em style="width:${p ?? 0}%;background:var(${col})"></em>${ref != null ? `<u style="left:${ref}%" title="아무 선 ${ref}%"></u>` : ''}</i><b>${p != null ? p + '%' : '—'}</b></div>`;
  const tn = { 반응: 'p-floor', 막힘: 'p-floor', 돌파: 'p-go', 이탈: 'p-stop', '못 넘음': 'p-wait', 애매: 'p-wait', '안 옴': 'p-wait', 대기: 'p-wait', '진행 중': 'p-ceil' };
  const kindW = k => k === '받침' ? '바닥 후보' : k === '천장' ? '막힐 자리' : k === '추세선' ? '흐름선' : k;
  const res = p => { const c = p.kind === '천장' && p.result === '돌파' ? 'p-stop' : tn[p.result] || 'p-wait'; return `<span class="pill ${c}">${kindW(p.kind)} ${esc(p.result || '대기')}</span>`; };
  const rows = TR.rows.filter(r => r.preds.length).slice(0, 80).map(r => `<a class="row" href="${tHref(r.sym)}">${logo(r.sym, nameOf(r.sym), 32)}<div class="rc"><div class="rt"><span class="nm" style="font-size:14px">${esc(nameOf(r.sym))}</span><span class="nr t3" style="font-size:12px">${md(r.asof)}</span><span class="${r.src === '재현' ? 't3' : 'go-t'}" style="font-size:12px">${r.src === '재현' ? '재현' : '실시간'}</span></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">${r.preds.map(res).join('')}</div></div><div class="rr"><span class="c ${tone(r.ret5 ?? r.ret1)}">${r.ret5 != null ? sgn(r.ret5) : r.ret1 != null ? sgn(r.ret1) : '—'}</span><span class="t3" style="font-size:12px">${r.ret5 != null ? '5일 뒤' : r.ret1 != null ? '1일 뒤' : ''}</span></div></a>`).join('');
  main.innerHTML = pageWrap('선 검증 성적', `<p class="t2" style="font-size:14px;margin-bottom:12px">엔진이 한 말이 ${S.horizon}일 뒤 맞았나 · <span class="nr">${md(S['기간'].from)} ~ ${md(S['기간'].to)}</span></p>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <div><p style="font-size:14px;margin-bottom:6px">바닥 후보에 오면 <b class="go-t">튀었나</b></p>${rate(S['받침'].pct, dmy, '--go')}<p class="cap" style="margin-top:4px">${S['받침'].n}번 중 ${S['받침'].good}번 · 세로선 = 아무 가격에 그은 선 ${dmy ?? '—'}%</p></div>
      <div><p style="font-size:14px;margin-bottom:6px">막힐 자리에 오면 <b class="wa-t">막혔나</b></p>${rate(S['천장'].pct, null, '--wa')}<p class="cap" style="margin-top:4px">${S['천장'].n}번 중 ${S['천장'].good}번</p></div>
      <div><p style="font-size:14px;margin-bottom:6px">흐름선을 넘은 뒤 <b class="up">5일 더 올랐나</b></p>${rate(S['추세선'].win, null, '--up')}<p class="cap" style="margin-top:4px">${S['추세선'].n_ret}번 · 평균 ${sgn(S['추세선'].avg_ret_after)}</p></div>
    </div>
    <details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">읽는 법</summary><div class="msg" style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><p>바닥 후보: 엔진이 "여기서 튈 수 있다"고 한 가격에 5일 안에 왔을 때, 5일째 종가가 그 위면 반응, 2% 넘게 아래면 이탈.</p><p>세로선 = 아무 가격(지금 가격 0.5~3% 아래 무작위)에 같은 규칙을 댄 결과. 바닥 후보 막대가 이 선보다 오른쪽이어야 엔진이 쓸모 있다는 뜻.</p><p>재현 = 지난 날짜를 그날 데이터까지만 써서 다시 돌린 기록 · 실시간 = ${md(S['기간']['실시간_시작'] || '')}부터 매일 쌓이는 진짜 기록.</p></div></details>
    ${secHead('기록', TR.rows.length)}<div class="list">${rows}</div>`);
  bindBack();
}
/* 쉬운 말 사전 — 그림 먼저 */
const GI = (() => {
  const P = (d, c, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const price = d => P(d, 'var(--t3)');
  const svg = inner => `<svg class="gi" viewBox="0 0 64 36" aria-hidden="true">${inner}</svg>`;
  return {
    '바닥 후보': svg(P('M4 28 L60 28', 'var(--go)', 'stroke-width="3" stroke-opacity=".6"') + price('M6 6 l10 20 l8 -12 l8 12 l8 -14 l8 14 l8 -16')),
    '막힐 자리': svg(P('M4 8 L60 8', 'var(--wa)', 'stroke-width="3" stroke-opacity=".6"') + price('M6 30 l10 -20 l8 12 l8 -12 l8 14 l8 -14 l8 16')),
    '하락 흐름선': svg(price('M4 10 l8 8 l6 -6 l8 10 l6 -4 l8 9 l6 -3 l8 6') + P('M4 6 L58 30', 'var(--wa)', 'stroke-dasharray="4 3"')),
    '하락 흐름 끊김': svg(P('M4 6 L58 30', 'var(--wa)', 'stroke-dasharray="4 3"') + price('M4 12 l8 8 l6 -4 l8 8 l6 -2 l8 4') + P('M40 26 l8 -12 l8 -6', 'var(--up)')),
    '겹친 자리': svg(P('M4 12 L60 24', 'var(--wa)') + P('M4 30 L60 22', 'var(--t2)') + P('M4 23 L60 23', 'var(--t3)', 'stroke-dasharray="3 3"') + `<rect x="44" y="19" width="16" height="8" rx="2" fill="var(--go)" opacity=".4"/>`),
    '많이 팔린 상태': svg(P('M8 30 A24 24 0 0 1 56 30', 'var(--track)', 'stroke-width="5"') + P('M8 30 A24 24 0 0 1 20 11', 'var(--go)', 'stroke-width="5"') + P('M44 11 A24 24 0 0 1 56 30', 'var(--wa)', 'stroke-width="5"') + P('M32 30 L18 16', 'var(--t1)')),
    '손절선': svg(price('M4 8 l8 6 l6 -3 l8 8 l6 2 l8 6') + P('M4 28 L60 28', 'var(--wa)', 'stroke-dasharray="4 3"') + P('M40 27 l6 7', 'var(--dn)')),
    '이동평균선': svg(price('M4 20 l6 -8 l6 10 l6 -12 l6 9 l6 -6 l6 8 l6 -10 l6 7 l6 -4') + P('M4 22 C 20 10, 40 26, 60 12', 'var(--t1)')),
    '피보나치': svg(price('M4 32 L34 6 L58 22') + P('M34 14 L60 14', 'var(--t2)', 'stroke-dasharray="3 3"') + P('M34 18 L60 18', 'var(--t2)', 'stroke-dasharray="3 3"') + P('M34 22 L60 22', 'var(--t2)', 'stroke-dasharray="3 3"')),
    '볼린저 밴드': svg(P('M4 8 C 20 2, 40 10, 60 6', 'var(--t2)') + P('M4 30 C 20 26, 40 34, 60 30', 'var(--t2)') + P('M4 19 C 20 14, 40 22, 60 18', 'var(--t3)', 'stroke-dasharray="3 3"') + price('M4 20 l8 -6 l8 10 l8 -8 l8 6 l8 -4 l8 8 l8 -10')),
    '거래량': svg([6, 14, 22, 30, 38, 46, 54].map((x, i) => { const h = [8, 12, 6, 10, 7, 22, 9][i]; return `<rect x="${x}" y="${34 - h}" width="6" height="${h}" fill="${i === 5 ? 'var(--up)' : 'var(--track)'}"/>`; }).join('') + P('M4 14 L60 14', 'var(--t3)', 'stroke-dasharray="2 3"')),
    '수렴 (쐐기·삼각)': svg(P('M4 6 L60 20', 'var(--wa)') + P('M4 32 L60 22', 'var(--wa)') + price('M6 18 l6 -8 l6 12 l6 -8 l6 10 l6 -6 l6 6 l6 -4 l6 3')),
  };
})();
const GLOSS = [
  ['바닥 후보', '받침 · ★합류 받침', '유명한 선 여러 개가 겹친 아래쪽 가격. 많은 사람이 같은 자리를 봐서 한 번 튀기 쉬워요. 바닥 보장은 아니라서 반등을 확인하고 판단해요.'],
  ['막힐 자리', '천장 · ★합류 천장', '유명한 선 여러 개가 겹친 위쪽 가격. 여기서 막히기 쉽고, 종가로 넘으면 의미가 커요.'],
  ['하락 흐름선', '하락 추세선', '최근 고점들을 이은 선. 가격이 이 선 아래 있으면 아직 내림세예요.'],
  ['하락 흐름 끊김', '추세선 돌파', '하락 흐름선 위에서 종가로 마감한 것. 하락이 멈췄다는 첫 신호라 1/3만 사요.'],
  ['겹친 자리', '합류 · 강함 ●●●', '선이 많이 겹칠수록 강해요. ●●● = 6개 이상(주봉·월봉 선 포함), ●●○ = 3~5개, ●○○ = 2개.'],
  ['많이 팔린 상태', 'RSI 30 이하 과매도', '0~100 점수에서 30 아래. 너무 많이 팔렸다는 뜻이지만 하락 흐름에선 며칠 이어질 수도 있어요.'],
  ['손절선', '종가 손절', '이 아래로 종가가 마감하면 손실을 확정하고 나오는 선. 사기 전에 미리 정하는 게 규칙이에요.'],
  ['이동평균선', '이평 · 20/60/120/200일선', '최근 N일 종가의 평균. 가격이 선 위면 그 기간 분위기가 좋고, 아래면 나빠요.'],
  ['피보나치', '피보 38.2 / 50 / 61.8%', '최근 큰 움직임의 38.2 · 50 · 61.8% 되돌림 자리. 많이 쓰여서 많이 반응해요.'],
  ['볼린저 밴드', '볼린저', '20일 평균 ±2표준편차 띠. 띠가 좁아지면 곧 크게 움직이기 쉬워요.'],
  ['거래량', '거래량 배수', '오늘 거래량 ÷ 최근 20일 평균. 내리는데 거래량이 적으면 "사는 사람이 없는" 하락이에요.'],
  ['수렴 (쐐기·삼각)', '쐐기 · 삼각수렴', '위아래 선이 좁아지는 모양. 끝나면 크게 움직이기 쉽지만 방향은 알려주지 않아요. 꼭짓점이 60봉 넘게 멀면 숨겨요.'],
];
function renderGlossary() {
  setNav('settings');
  main.innerHTML = pageWrap('쉬운 말 사전', `<p class="t2" style="font-size:14px;margin-bottom:12px">앱에서 쓰는 말 → 원래 차트 용어</p><div class="list">${GLOSS.map(([k, old, d]) => `<div class="gl">${GI[k] || ''}<div class="rc"><span>${esc(k)}</span><span>${esc(old)}</span><span>${esc(d)}</span></div></div>`).join('')}</div>`);
  bindBack();
}
function renderRules() {
  setNav('settings');
  const R = [['종가로만 판단', '장중 흔들림은 무시해요. 조건·손절 모두 그날 종가로 확인해요.'], ['손절선 없이 매수 없음', '사기 전에 손절선을 정해요. 앱도 손절선이 없으면 매수 기록을 저장하지 않아요.'], ['손절은 종가 기준', '손절선 아래에서 마감하면 규칙대로 정리해요.'], ['반등 확인 전 추가 매수 없음', '평단 아래로 더 사는 물타기는 반등을 확인한 뒤에만.'], ['첫 매수는 1/3', '조건을 채워도 계획한 금액의 1/3만. 나머지는 확인하면서.'], ['확률 숫자 대신 가능성', '"반응하기 쉬운 자리"처럼 말해요. 반대 근거도 한 줄씩 같이 봐요.']];
  main.innerHTML = pageWrap('내 매매 규칙', `<div class="list">${R.map(([t, d], i) => `<div class="gl"><span class="tile mid" style="width:32px;height:32px"><span class="n">${i + 1}</span></span><div class="rc"><span>${esc(t)}</span><span class="t2" style="font-size:13px">${esc(d)}</span></div></div>`).join('')}</div><p class="cap">기록 탭의 규칙 점수가 이 규칙으로 채점돼요.</p>`);
  bindBack();
}

/* ---------------- 검색 — 이름·코드·미국 티커 → 바로 분석 */
function searchPool() {
  const seen = new Set(), out = [];
  const add = (s, n, tag) => { if (!s || seen.has(s)) return; seen.add(s); out.push({ s, n: n || nameOf(s), tag }); };
  (CORE?.M?.items || []).forEach(d => add(d.s, d.name, d.held ? '보유' : '관심'));
  (cache['out/screener.json']?.rows || []).forEach(r => add(r.symbol, r.name, '발굴'));
  (cache['out/lookup.json'] || []).forEach(r => add(r.symbol, r.name, '최근 검색'));
  Object.entries(NAMES).forEach(([s, n]) => { if (!s.startsWith('^') && !/=|\.NYB$/.test(s)) add(s, n, ''); });
  return out;
}
function searchMatch(q) {
  const nq = q.toLowerCase().replace(/\s/g, '');
  if (!nq) return (CORE?.M?.items || []).slice(0, 8).map(d => ({ s: d.s, n: d.name, tag: d.held ? '보유' : '관심' }));
  return searchPool().filter(x => x.n.toLowerCase().replace(/\s/g, '').includes(nq) || x.s.toLowerCase().startsWith(nq)).slice(0, 12);
}
const resRow = x => `<a class="row mid" href="${tHref(x.s)}" data-pick="${esc(x.s)}">${logo(x.s, x.n, 32)}<div class="rc"><span class="nm" style="font-size:15px">${esc(x.n)}</span><span class="l2">${esc(x.s)}</span></div>${x.tag ? `<span class="t3" style="font-size:12px">${x.tag}</span>` : ''}</a>`;
async function goSearch(q, msgEl) {
  q = q.trim(); if (!q) return;
  const hit = searchMatch(q)[0];
  if (hit && (hit.n.replace(/\s/g, '') === q.replace(/\s/g, '') || hit.s.toLowerCase() === q.toLowerCase() || hit.s.slice(0, 6) === q)) { location.hash = tHref(hit.s); return; }
  if (!QURL()) { if (hit) { location.hash = tHref(hit.s); return; } if (msgEl) msgEl.textContent = '실시간 중계 주소(QUOTE_URL)가 없어 새 종목은 찾을 수 없어요.'; return; }
  if (msgEl) msgEl.textContent = `${q} 찾는 중…`;
  let sym = null, name = q;
  if (/[가-힣]/.test(q) || /^\d{6}$/.test(q)) { const res = await lvGet('/s?q=' + enc(q)); const h = (res || []).find(x => x.name === q) || (res || [])[0]; if (h) { sym = h.symbol; name = h.name; } }
  else if (/^\d{6}\.(KS|KQ)$/i.test(q) || /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(q)) { sym = q.toUpperCase(); name = sym; }
  if (!sym && hit) sym = hit.s;
  if (!sym) { if (msgEl) msgEl.textContent = `${q} — 종목을 못 찾았어요. 이름을 정확히 쓰거나 6자리 코드로 찾아 보세요.`; return; }
  try { const Nm = JSON.parse(LS.get('names') || '{}'); Nm[sym] = name; LS.set('names', JSON.stringify(Nm)); } catch { }
  if (!NAMES[sym]) NAMES[sym] = name;
  location.hash = tHref(sym);
}
async function renderSearch() {
  setNav('search');
  await loadCore(); j('out/screener.json'); j('out/lookup.json');
  main.innerHTML = `<div class="search"><form class="sbar" id="sform" role="search" autocomplete="off">${backBtn()}<input id="sq" type="search" placeholder="종목 이름 · 코드 · 미국 티커" enterkeyhint="search" aria-label="종목 검색" autofocus></form><p class="msg" id="smsg" style="margin:4px 2px 8px"></p><div class="list sres" id="sres"></div><p class="cap">관심 종목에 없는 종목도 찾으면 바로 선을 그어서 보여 줘요 (실시간 값으로 계산).</p></div>`;
  bindBack();
  const inp = $('#sq'), draw = () => { const L = searchMatch(inp.value); $('#sres').innerHTML = L.map(resRow).join('') || `<div class="empty">엔터를 누르면 "${esc(inp.value)}"을(를) 찾아서 분석해요</div>`; };
  inp.oninput = draw; draw(); setTimeout(() => inp.focus(), 50);
  $('#sform').onsubmit = e => { e.preventDefault(); goSearch(inp.value, $('#smsg')); };
}
function bindTopSearch() {
  const f = $('#tsearch'), inp = $('#tq'), drop = $('#tdrop'); if (!f) return;
  const draw = () => { const L = searchMatch(inp.value); drop.innerHTML = `<div class="list" style="border-radius:14px">${L.map(resRow).join('') || `<div class="empty">엔터 → "${esc(inp.value)}" 찾아서 분석</div>`}</div>`; drop.hidden = false; };
  inp.onfocus = () => { loadCore().then(() => { j('out/screener.json'); j('out/lookup.json'); draw(); }); };
  inp.oninput = draw;
  inp.onkeydown = e => { if (e.key === 'Escape') { drop.hidden = true; inp.blur(); } };
  drop.onclick = e => { if (e.target.closest('a')) { drop.hidden = true; inp.value = ''; inp.blur(); } };
  document.addEventListener('click', e => { if (!f.contains(e.target)) drop.hidden = true; });
  f.onsubmit = e => { e.preventDefault(); drop.hidden = true; goSearch(inp.value, null).then(() => { inp.value = ''; inp.blur(); }); };
  document.addEventListener('keydown', e => { if (e.key === '/' && isPC() && !/input|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); inp.focus(); } });
}

/* ================================================================ 길 찾기 */
let NAV_DEPTH = 0, LAST_PC = isPC();
async function route() {
  const h = location.hash || '#/';
  const m = h.match(/^#\/t\/(.+)$/);
  closeSheet();
  clearInterval(liveTimer); liveTimer = null;
  window.scrollTo(0, 0);
  if (!m) TK = null;
  try {
    if (m) await renderTicker(decodeURIComponent(m[1]));
    else if (h.startsWith('#/screener')) await renderScreener();
    else if (h.startsWith('#/journal')) await renderJournal();
    else if (h.startsWith('#/alerts')) await renderAlerts();
    else if (h.startsWith('#/settings')) await renderSettings();
    else if (h.startsWith('#/track')) await renderTrack();
    else if (h.startsWith('#/flows')) await renderFlowsRadar();
    else if (h.startsWith('#/market')) await renderMarket();
    else if (h.startsWith('#/watch')) await renderWatch();
    else if (h.startsWith('#/glossary')) renderGlossary();
    else if (h.startsWith('#/rules')) renderRules();
    else if (h.startsWith('#/search')) { if (isPC()) { location.replace('#/'); setTimeout(() => $('#tq')?.focus(), 50); } else await renderSearch(); }
    else await renderHome();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty">화면을 그리다 문제가 생겼어요. 잠시 뒤 다시 열어 주세요.<br><span class="t3" style="font-size:12px">${esc(e.message || e)}</span></div>`;
  }
  bindBack();
  setBadge();
  liveKick();
}
window.addEventListener('hashchange', () => { NAV_DEPTH++; route(); });
function bindBackGlobal() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-back]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (NAV_DEPTH > 0) { NAV_DEPTH -= 2; history.back(); } else location.hash = '#/';
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  $('#scrim').onclick = closeSheet;
  $('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  matchMedia('(min-width:1024px)').addEventListener('change', () => { const pc = isPC(); if (pc !== LAST_PC) { LAST_PC = pc; main.innerHTML = ''; route(); } });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if ((LS.get('theme') || 'dark') === 'system') setTheme('system'); });
}
renderChrome();
bindBackGlobal();
route();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => { });
  const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
  let pend = null;
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'updated') return;
    clearTimeout(pend); pend = setTimeout(() => {
      resetData();
      const y = window.scrollY, h = location.hash;
      Promise.resolve(route()).then(() => { if (location.hash === h) window.scrollTo(0, y); });
    }, 600);
  });
}
