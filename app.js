/* investool PWA v2 — 시각 우선. out/*.json + data/*.csv 만 읽는다 (서버 없음) */
const $ = (s, el = document) => el.querySelector(s);
/* 종목 로고 (토스처럼) — logos/index.json 에 있으면 이미지, 없으면 이름 첫 글자 배지 */
let LOGOS = {};
fetch('logos/index.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(j => { LOGOS = j || {}; document.querySelectorAll('.lg[data-s]').forEach(el => { if (LOGOS[el.dataset.s] === 'png') el.outerHTML = logo(el.dataset.s, el.dataset.n, +el.dataset.z); }); }).catch(() => { });
function logo(sym, name, z = 28) {
  const n = (name || sym || '?').replace(/^[^가-힣A-Za-z0-9]+/, '');
  if (LOGOS[sym] === 'png') return `<img class="lg" src="logos/${encodeURIComponent(sym)}.png" alt="" width="${z}" height="${z}" loading="lazy" onerror="this.outerHTML=logoMono('${esc(sym)}','${esc(n).replace(/'/g, '')}',${z})">`;
  return logoMono(sym, n, z);
}
function logoMono(sym, n, z) {
  let h = 0; for (const ch of sym) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<span class="lg mono-lg" data-s="${esc(sym)}" data-n="${esc(n)}" data-z="${z}" style="width:${z}px;height:${z}px;font-size:${Math.round(z * 0.46)}px;background:hsl(${h} 35% 32%)">${esc(n.slice(0, 1))}</span>`;
}
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } } };
const main = $('#main');
const C = { ma20: '#7C9CFF', ma60: '#E8891D', ma120: '#B8A6FF' };
/* 테마 토큰은 CSS 변수에서 읽는다 (다크/라이트 공용) */
function syncTheme() {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  Object.assign(C, { up: v('--up'), dn: v('--dn'), warn: v('--warn'), ok: v('--ok'), tag: v('--tag'), mut: v('--mut'), line: v('--line'), txt: v('--txt'), bg: v('--bg'), w: v('--w') });
  C.ma200 = C.w; C.ma120 = C.tag; C.sma20 = C.ma20; C.sma60 = C.ma60; C.sma120 = C.ma120; C.sma200 = C.ma200;
  const m = document.getElementById('themeColor'); if (m) m.content = v('--nav') || C.bg;
}
function setTheme(t) { LS.set('theme', t); const real = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t; document.documentElement.dataset.theme = real; syncTheme(); }
syncTheme();

const fmtP = (v, krw) => v == null ? '—' : krw ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(2);
const pct = (a, b) => ((a / b - 1) * 100);
const sgn = (v, d = 1) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(d) + '%';
const cls = v => v > 0 ? 'up' : v < 0 ? 'dn' : '';
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const G = { // 초보용 용어 설명 (탭하면 뜸)
  '추세선': '최근 고점들을 이은 선. 가격이 이 선을 "종가로" 넘으면 하락이 멈췄다는 첫 신호로 봅니다.',
  '이평': '이동평균선. 최근 N일 종가의 평균. 20일선 위면 단기 분위기 좋음, 아래면 나쁨. 20·60·120·200일이 제일 많이 쓰임.',
  '합류': '유명한 선 여러 개가 같은 가격에 겹치는 자리. 많은 사람이 같은 자리를 보니 실제로 가격이 멈추거나 튀는 일이 잦습니다.',
  'RSI': '0~100. 30 아래면 "너무 많이 팔렸다"(과매도), 70 위면 "너무 많이 샀다"(과매수).',
  '손절': '여기 아래로 종가가 마감하면 손실을 확정하고 나오는 선. 사기 전에 미리 정해두는 게 규칙.',
  '지지': '가격이 내려오다 멈춘 적 있는 자리. 다시 멈출 가능성이 있어 "받침"으로 봅니다.',
  '저항': '가격이 오르다 막힌 적 있는 자리. 다시 막힐 가능성이 있어 "천장"으로 봅니다.',
  '피보': '최근 큰 움직임의 38.2 / 50 / 61.8% 되돌림 자리. 많이 쓰여서 많이 반응하는 선.',
  '볼린저': '20일 평균 ±2표준편차 띠. 띠 밖이면 평소보다 크게 벗어난 상태.',
  '거래량': '오늘 거래량 ÷ 최근 20일 평균. 떨어지는데 거래량이 적으면 "투매"가 아니라 "사는 사람이 없는" 하락.',
  '쐐기': '위아래 선이 좁아지는 모양. 좁아질수록 곧 한쪽으로 크게 움직일 가능성.',
};
/* 용어 그림 (64×36 SVG) — 글보다 먼저 눈에 들어오게 */
const GI = (() => {
  const W = 'currentColor', P = (d, c, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const price = (d) => P(d, 'var(--mut)');
  const svg = inner => `<svg class="gi" viewBox="0 0 64 36" width="64" height="36" aria-hidden="true">${inner}</svg>`;
  return {
    '추세선': svg(price('M4 10 l8 8 l6 -6 l8 10 l6 -4 l8 9 l6 -3 l8 6') + P('M4 6 L58 30', 'var(--warn)') + P('M50 20 l8 -10', 'var(--up)')),
    '이평': svg(price('M4 20 l6 -8 l6 10 l6 -12 l6 9 l6 -6 l6 8 l6 -10 l6 7 l6 -4') + P('M4 22 C 20 10, 40 26, 60 12', '#7C9CFF')),
    '합류': svg(P('M4 12 L60 24', 'var(--warn)') + P('M4 30 L60 22', '#7C9CFF') + P('M4 23 L60 23', 'var(--tag)', 'stroke-dasharray="3 3"') + `<rect x="46" y="19" width="14" height="8" rx="2" fill="var(--ok)" opacity=".35"/>` + `<text x="2" y="9" font-size="7" fill="var(--ok)">★ 겹치는 자리</text>`),
    'RSI': svg(P('M8 30 A24 24 0 0 1 56 30', 'var(--track)', 'stroke-width="5"') + P('M8 30 A24 24 0 0 1 20 11', 'var(--ok)', 'stroke-width="5"') + P('M44 11 A24 24 0 0 1 56 30', 'var(--warn)', 'stroke-width="5"') + P('M32 30 L18 16', W) + `<text x="4" y="35" font-size="7" fill="var(--mut)">30</text><text x="50" y="35" font-size="7" fill="var(--mut)">70</text>`),
    '손절': svg(price('M4 8 l8 6 l6 -3 l8 8 l6 2 l8 6') + P('M4 28 L60 28', 'var(--up)', 'stroke-dasharray="4 3"') + P('M40 27 l6 7', 'var(--up)') + `<text x="40" y="24" font-size="7" fill="var(--up)">종가 이탈</text>`),
    '지지': svg(P('M4 28 L60 28', 'var(--ok)') + price('M6 6 l10 20 l8 -12 l8 12 l8 -14 l8 14 l8 -16') + `<text x="36" y="12" font-size="7" fill="var(--ok)">받침</text>`),
    '저항': svg(P('M4 8 L60 8', 'var(--warn)') + price('M6 30 l10 -20 l8 12 l8 -12 l8 14 l8 -14 l8 16') + `<text x="36" y="26" font-size="7" fill="var(--warn)">천장</text>`),
    '피보': svg(price('M4 32 L34 6 L58 22') + P('M34 14 L60 14', 'var(--tag)', 'stroke-dasharray="3 3"') + P('M34 18 L60 18', 'var(--tag)', 'stroke-dasharray="3 3"') + P('M34 22 L60 22', 'var(--tag)', 'stroke-dasharray="3 3"') + `<text x="4" y="10" font-size="7" fill="var(--tag)">38·50·62%</text>`),
    '볼린저': svg(P('M4 8 C 20 2, 40 10, 60 6', '#7C9CFF', 'opacity=".7"') + P('M4 30 C 20 26, 40 34, 60 30', '#7C9CFF', 'opacity=".7"') + P('M4 19 C 20 14, 40 22, 60 18', '#7C9CFF', 'stroke-dasharray="3 3"') + price('M4 20 l8 -6 l8 10 l8 -8 l8 6 l8 -4 l8 8 l8 -10')),
    '거래량': svg([6, 14, 22, 30, 38, 46, 54].map((x, i) => { const h = [8, 12, 6, 10, 7, 22, 9][i]; return `<rect x="${x}" y="${34 - h}" width="6" height="${h}" fill="${i === 5 ? 'var(--up)' : 'var(--track)'}"/>`; }).join('') + P('M4 14 L60 14', 'var(--mut)', 'stroke-dasharray="2 3"') + `<text x="4" y="11" font-size="7" fill="var(--mut)">20일 평균</text>`),
    '쐐기': svg(P('M4 6 L60 20', 'var(--warn)') + P('M4 32 L60 22', 'var(--warn)') + price('M6 18 l6 -8 l6 12 l6 -8 l6 10 l6 -6 l6 6 l6 -4 l6 3') + P('M54 21 l6 -5', 'var(--up)') + P('M54 21 l6 5', 'var(--dn)')),
  };
})();
const PLAIN = { exit: '미리 정한 손절선 아래에서 하루를 마감했어요. 규칙대로면 파는 날이에요 — 장중 흔들림 말고 종가로만 판단해요.', warn: '손절선 바로 위예요. 오늘 밤 종가가 손절선 아래면 규칙대로 정리, 위면 그대로 보유.', hold: '손절선까지 여유가 있어요. 추가 매수는 반등을 확인한 뒤에만.', target: '1차 목표에 닿았어요. 일부 팔거나 다음 차수를 검토할 때.', enter: '미리 정한 진입 조건을 종가로 만족했어요. 첫 매수는 계획 금액의 1/3만.', wait: '아직 진입 조건이 안 됐어요. 기다리는 게 일이에요.' };
const term = (t, label = t) => `<span class="term" data-g="${t}">${label}</span>`;

/* ------------------------------------------------------------ 데이터 */
const cache = {};
async function j(url) { if (url in cache) return cache[url]; try { const res = await fetch(url); cache[url] = res.ok ? await res.json() : null; } catch { cache[url] = null; } return cache[url]; }
async function t(url) { try { const res = await fetch(url); return res.ok ? await res.text() : ''; } catch { return ''; } }
async function loadWatchlist() { return (await t('watchlist.txt')).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')); }
async function loadCsv(sym) {
  const txt = await t(`data/${sym}.csv`); if (!txt) return [];
  return txt.trim().split('\n').slice(1).map(l => { const [d, o, h, lo, c, v] = l.split(','); return { time: /^\d{9,}$/.test(d) ? +d + 9 * 3600 : d, open: +o, high: +h, low: +lo, close: +c, volume: +v }; });
}
const sma = (rows, w) => rows.map((r, i) => i < w - 1 ? null : { time: r.time, value: rows.slice(i - w + 1, i + 1).reduce((a, b) => a + b.close, 0) / w }).filter(Boolean);
const NAMES = { 'INFQ': '인플렉션', '005930.KS': '삼성전자', '000660.KS': 'SK하이닉스', '013030.KQ': '하이록코리아', '054950.KQ': '제이브이엠', '236200.KQ': '슈프리마', '036800.KQ': '나이스정보통신', '200670.KQ': '휴메딕스', '015230.KS': '대창단조', '044960.KQ': '이글벳', '^KS11': '코스피', '^KQ11': '코스닥', '^GSPC': 'S&P 500', '^VIX': 'VIX', 'SOXX': '반도체 ETF', 'IONQ': '아이온큐', 'RGTI': '리게티', 'QBTS': '디웨이브' };
// 종목명 사전(배치가 만든 names.json) — 스크리너·검색으로 들어간 종목도 이름으로
const NAMES_READY = fetch('out/names.json').then(r => r.ok ? r.json() : {}).then(m => { for (const [k, v] of Object.entries(m || {})) if (!NAMES[k]) NAMES[k] = v; }).catch(() => { });
const nameOf = (s, J) => (J && J[s] && J[s].name && J[s].name !== s ? J[s].name : null) || NAMES[s] || (() => { try { return JSON.parse(LS.get('names') || '{}')[s]; } catch { return null; } })() || s;

/* ------------------------------------------------------------ 시각 컴포넌트 */
function sparkline(vals, color, w = 90, h = 28) {
  if (!vals || vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / rg * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;max-width:${w}px;height:${h}px;display:block" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/></svg>`;
}
/* 가로 레벨 바: 손절/지지 ← 현재 → 추세선/목표 */
function levelBar(items, close, krw, sym = '') {
  const ps = items.map(i => i.price).concat([close]);
  let mn = Math.min(...ps), mx = Math.max(...ps); const pad = (mx - mn) * 0.12 || close * 0.02; mn -= pad; mx += pad;
  const x = p => (p - mn) / (mx - mn) * 100;
  // 가격순 정렬 → 이웃끼리 위/아래 번갈아, 가까우면(8% 이내) 한 번 더 띄움
  const sorted = [...items].sort((a, b) => a.price - b.price);
  let lastX = -100, side = 0;
  const marks = sorted.map(i => {
    const xi = x(i.price); side = (xi - lastX < 14) ? 1 - side : 0; lastX = xi;
    return `<div class="lb-mark ${side ? 'alt' : ''}" style="left:${xi.toFixed(1)}%;--c:${i.color}"><i></i><b>${esc(i.label)}</b><span class="mono">${fmtP(i.price, krw)}</span></div>`;
  }).join('');
  return `<div class="lb" ${sym ? `data-live-bar="${esc(sym)}" data-mn="${mn}" data-mx="${mx}"` : ''}><div class="lb-track"></div>${marks}<div class="lb-now" style="left:${x(close).toFixed(1)}%"><i></i></div></div>`;
}
/* 3구간 바 (판단 보드) */
function zoneBar(stop, top, close, krw, labels = ['정리', '보유 · 추가 매수 금지', '돌파 → 다음 차수']) {
  const lo = Math.min(stop, close) * 0.97, hi = Math.max(top, close) * 1.03;
  const x = p => ((p - lo) / (hi - lo) * 100);
  const seg = (cl, l, w, txt) => `<div class="zb-seg ${cl}" style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%">${w > 14 ? `<span>${txt}</span>` : ''}</div>`;
  return `<div class="zb">
    ${seg('dn', 0, x(stop), esc(labels[0]))}${seg('warn', x(stop), x(top) - x(stop), esc(labels[1]))}${seg('up', x(top), 100 - x(top), esc(labels[2]))}
    <div class="zb-tick" style="left:${x(stop).toFixed(1)}%"><span class="mono">${fmtP(stop, krw)}</span></div>
    <div class="zb-tick" style="left:${x(top).toFixed(1)}%"><span class="mono">${fmtP(top, krw)}</span></div>
    <div class="zb-now" style="left:${x(close).toFixed(1)}%"><span class="mono">현재 ${fmtP(close, krw)}</span><i></i></div>
  </div>`;
}
/* 세로 사다리 */
function ladder(r, rows) {
  const k = r.krw, c = r.close;
  const L = [];
  Object.entries(r.ma || {}).forEach(([n, v]) => L.push({ n: n.replace('sma', '') + '일선', p: v.value, col: C[n] || C.ma20, t: '이평' }));
  (r.levels || []).forEach(l => L.push({ n: (l.price < c ? '지지' : '저항') + ` ${l.touches}회`, p: l.price, col: l.price < c ? C.ok : C.warn, t: l.price < c ? '지지' : '저항' }));
  if (r.trend_upper) L.push({ n: '추세선 ↘', p: r.trend_upper.value_today, col: C.warn, t: '추세선' });
  if (r.trend_lower) L.push({ n: '추세선 하단', p: r.trend_lower.value_today, col: C.warn, t: '추세선' });
  Object.entries(r.fib.levels).forEach(([n, v]) => L.push({ n: `피보 ${n}`, p: v, col: C.tag, t: '피보' }));
  L.push({ n: '52주 저점', p: r.keys.w52_low, col: C.dn, t: '지지' });
  L.push({ n: '볼린저 하단', p: r.bollinger.lower, col: '#7C9CFF', t: '볼린저' }, { n: '볼린저 상단', p: r.bollinger.upper, col: '#7C9CFF', t: '볼린저' });
  const conf = (r.confluence || []).map(g => g.price);
  const win = (rows || []).slice(-80);
  const lo0 = win.length ? Math.min(...win.map(x => x.low), c * 0.95) : c * 0.8, hi0 = win.length ? Math.max(...win.map(x => x.high), c * 1.05) : c * 1.3;
  // 같은 가격(0.6% 이내) 합치기
  L.push({ n: '현재가', p: c, col: C.w, t: '', now: true });
  const sorted = L.filter(l => l.p >= lo0 && l.p <= hi0).sort((a, b) => b.p - a.p);
  const merged = []; sorted.forEach(l => { const m = merged[merged.length - 1]; if (m && !m.now && !l.now && Math.abs(m.p / l.p - 1) < 0.006) { m.n += ' · ' + l.n; } else merged.push({ ...l }); });
  // 가까운 선은 넓게, 먼 선은 압축 (로그 거리) — 현재가 ±5% 가 화면의 절반 정도를 차지
  // 행 간격 = 로그 거리 (최소 24px · 최대 64px) — 가까운 선은 붙고, 먼 선은 너무 멀어지지 않게
  const zc = p => { const d = pct(p, c); return Math.sign(d) * Math.log1p(Math.abs(d) / 2); };
  let lastY = 18, lastZ = null; const placed = merged.map(l => { const z = zc(l.p); const yy = lastZ === null ? lastY : lastY + Math.max(24, Math.min(64, (lastZ - z) * 90)); lastY = yy; lastZ = z; return { ...l, yy, y0: yy }; });
  const Hfin = lastY + 24;
  const rowsH = placed.map(l => {
    const isConf = conf.some(cp => Math.abs(cp / l.p - 1) < 0.012);
    const d = pct(l.p, c);
    if (l.now) return `<div class="ld-row now" style="top:${l.yy.toFixed(1)}px"><span class="ld-dot"></span><span class="ld-n">현재가</span><span class="ld-p mono">${fmtP(l.p, k)}</span><span class="ld-d mono"></span></div>`;
    return `<div class="ld-row ${isConf ? 'conf' : ''} ${d >= 0 ? 'above' : 'below'}" style="top:${l.yy.toFixed(1)}px;--c:${l.col}"><span class="ld-dot"></span><span class="ld-n">${term(l.t, l.n)}</span><span class="ld-p mono">${fmtP(l.p, k)}</span><span class="ld-d mono ${cls(d)}">${sgn(d)}</span></div>`;
  }).join('');
  return `<div class="ladder" style="height:${Hfin}px"><div class="ld-axis"></div>${rowsH}</div>`;
}
/* 카드·헤더용 핵심 기준선 (손절/지지 · ★합류 · 추세선 · 목표/진입) — 0.6% 이내 중복 제거 */
function keyLevels(r, jd) {
  const c = r.close, lv = [];
  if (jd?.held && jd.stop) lv.push({ label: '손절', price: jd.stop, color: C.dn });
  else { const sup = r.levels.filter(l => l.price < c).sort((x, y) => y.price - x.price)[0]; lv.push(sup ? { label: '지지', price: sup.price, color: C.ok } : { label: '최근저가', price: r.keys.recent_low10, color: C.dn }); }
  r.confluence?.slice(0, 2).forEach(g => lv.push({ label: g.price < c ? '★받침' : '★천장', price: g.price, color: g.price < c ? C.ok : C.warn }));
  if (r.trend_upper) lv.push({ label: '추세선', price: r.trend_upper.value_today, color: C.warn });
  const t1 = (jd?.rows?.[0]?.cond || '').match(/≥ ([\d,.]+)/); if (t1) lv.push({ label: jd.held ? '목표' : '진입', price: +t1[1].replace(/,/g, ''), color: C.up });
  const uniq = []; lv.forEach(x => { if (!uniq.some(u => Math.abs(u.price / x.price - 1) < 0.006)) uniq.push(x); });
  return uniq;
}
/* 기여도 바 */
function contribBar(a) {
  const parts = [['지수', a.index ? a.index.contrib : 0, '#7C9CFF'], ['업종', a.sector ? a.sector.excess1 : 0, C.tag], ['종목 고유', a.idio, C.warn]];
  const tot = Math.max(1e-6, parts.reduce((s, p) => s + Math.abs(p[1]), 0));
  return `<div class="cb">${parts.map(([n, v, col]) => `<div class="cb-seg" style="width:${(Math.abs(v) / tot * 100).toFixed(1)}%;background:${col};opacity:${v < 0 ? .95 : .55}">${Math.abs(v) / tot > 0.14 ? `<span>${n} ${sgn(v)}</span>` : ''}</div>`).join('')}</div>`;
}
function eventsStrip(EV, J, sym) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const evs = ((EV && EV.events) || []).filter(e => new Date(e.date) >= today && (!sym || !e.symbols.length || e.symbols.includes(sym))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, sym ? 4 : 6);
  if (!evs.length) return '';
  const K = { '실적': 'up', '거시': 'warn', '정책': 'tag', '종목': 'ok' };
  return `<section><header><span>${sym ? '이 종목 관련 일정' : '앞으로 2주'}</span><small>events.json</small></header><div class="ev-list">${evs.map(e => {
    const d = Math.round((new Date(e.date) - today) / 864e5);
    return `<div class="ev"><span class="mono ${d <= 3 ? 'warn' : 'mut'}">${e.date.slice(5).replace('-', '/')}<small>D-${d}</small></span><span class="chip ${K[e.kind] || 'mut'}" style="${e.kind === '정책' ? 'color:var(--tag)' : ''}">${esc(e.kind)}</span><span><b class="w">${esc(e.title)}</b>${e.symbols.length ? ` <span class="mut">${e.symbols.map(x => nameOf(x, J)).join(', ')}</span>` : ''}${e.note ? `<div class="mut" style="font-size:11.5px">${esc(e.note)}</div>` : ''}</span></div>`; }).join('')}</div></section>`;
}
function chip(jd) {
  const M = { exit: ['정리', 'dn'], warn: ['주의', 'warn'], hold: ['보유', 'ok'], target: ['목표', 'ok'], enter: ['진입', 'ok'], wait: ['관망', 'mut'], none: ['—', 'mut'] };
  const [tx, c] = M[jd?.chip] || M.none; return `<span class="chip ${c}">${tx}</span>`;
}

/* ------------------------------------------------------------ 데스크 */
async function renderDesk() {
  setNav('desk'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  // 묶음 파일 하나로 (없으면 예전처럼 하나씩)
  const D = await j('out/desk.json');
  if (D) Object.entries(D.files).forEach(([k, v]) => { if (/^out\/[^/]+\.json$/.test(k) && !['out/track.json', 'out/flows.json'].includes(k)) cache[k] = v; });
  const g = p => D?.files?.[p] !== undefined ? D.files[p] : j(p);
  const csvOf = s => D?.csv?.[s] ? D.csv[s] : loadCsv(s);
  const [syms, J, A, AL, EV, TR, FL] = await Promise.all([D ? D.watchlist : loadWatchlist(), g('out/judgement.json'), g('out/attribution.json'), g('out/alerts.json'), g('events.json'), g('out/track.json'), g('out/flows.json')]);
  const items = (await Promise.all(syms.map(async s => ({ s, r: await g(`out/${s}.json`), rows: await csvOf(s) })))).filter(x => x.r);
  const ctx = [['^KS11', '코스피'], ['^KQ11', '코스닥'], ['^GSPC', 'S&P 500'], ['^VIX', 'VIX 공포지수']];
  const sect = await Promise.all([['SOXX', '반도체 ETF'], ['IONQ', '아이온큐'], ['RGTI', '리게티'], ['QBTS', '디웨이브']].map(async ([s, n]) => ({ s, n, rows: await csvOf(s) })));
  const sectH = sect.filter(m => m.rows.length > 2).map(m => { const l = m.rows[m.rows.length - 1], p = m.rows[m.rows.length - 2]; const ch = pct(l.close, p.close); return `<span class="sc"><b>${m.n}</b> <span class="mono ${cls(ch)}">${sgn(ch)}</span></span>`; }).join('');
  const mk = await Promise.all(ctx.map(async ([s, n]) => ({ s, n, rows: await csvOf(s) })));
  const MW = await macroWeather(csvOf);
  const mkt = mk.filter(m => m.rows.length > 2).map(m => {
    const last = m.rows[m.rows.length - 1], prev = m.rows[m.rows.length - 2];
    const chg = pct(last.close, prev.close);
    const isVix = m.s === '^VIX';
    const band = isVix ? (last.close < 15 ? ['안정', 'ok'] : last.close < 25 ? ['경계', 'warn'] : last.close < 35 ? ['공포', 'up'] : ['패닉', 'up']) : null;
    return `<div class="mk"><div class="mk-n">${m.n} <span class="mut mono" style="font-size:10px">${last.time.slice(5)}</span></div>
      <div class="mk-v mono ${isVix ? band[1] : cls(chg)}">${isVix ? last.close.toFixed(1) : Math.round(last.close).toLocaleString('ko-KR')}</div>
      <div class="mk-c"><span class="mono ${cls(chg)}">${sgn(chg)}</span>${isVix ? `<span class="chip ${band[1]}">${band[0]}</span>` : ''}</div>
      <div class="mk-s">${sparkline(m.rows.slice(-20).map(x => x.close), isVix ? C.warn : chg >= 0 ? C.up : C.dn)}</div></div>`;
  }).join('');
  const cnt = {}; items.forEach(({ s }) => { const c = (J?.[s]?.chip) || 'none'; cnt[c] = (cnt[c] || 0) + 1; });
  const order = ['exit', 'warn', 'enter', 'target', 'hold', 'wait'];
  const sum = order.filter(c => cnt[c]).map(c => `${chip({ chip: c })} <b class="mono">${cnt[c]}</b>`).join('<span class="mut" style="margin:0 8px">·</span>');
  const PR = { exit: 0, warn: 1, enter: 2, target: 3, hold: 4, wait: 5, none: 6 };
  items.sort((a, b) => (PR[J?.[a.s]?.chip ?? 'none'] - PR[J?.[b.s]?.chip ?? 'none']));
  const trs = [];
  const cards = items.map(({ s, r, rows }) => {
    const jd = J?.[s], a = A?.[s], k = r.krw, c = r.close;
    const uniq = keyLevels(r, jd);
    const chg = r.rsi_volume.chg_pct, rsi = r.rsi_volume.rsi;
    const why = a ? `${a.main_driver} 영향` : '';
    const one = jd?.status || (r.sentences.find(x => x.startsWith('★')) || '').replace(/ —.*$/, '');
    const below = uniq.filter(x => x.price < c).sort((x, y) => y.price - x.price)[0], abv = uniq.filter(x => x.price >= c).sort((x, y) => x.price - y.price)[0];
    trs.push({ s, jd, c, k, chg, rsi, below, abv, one });
    return `<a class="card st-${jd?.chip || 'none'}" href="#/t/${encodeURIComponent(s)}">
      <div class="card-h"><div class="lgrow">${logo(s, nameOf(s, J), 32)}<div><div class="card-n w">${nameOf(s, J)} <span class="mut mono" style="font-size:11px">${esc(s)}</span></div><div class="mut mono" style="font-size:11px">${r.asof} 종가</div></div></div>${chip(jd)}</div>
      <div class="card-p"><span class="mono ${cls(chg)}" style="font-size:24px;font-weight:600" data-live-p="${esc(s)}" data-k="${k ? 1 : 0}">${fmtP(c, k)}</span><span class="mono ${cls(chg)}" data-live-c="${esc(s)}">${sgn(chg)}</span><span class="live" data-live-t="${esc(s)}"></span>${why ? `<span class="mut why" style="font-size:11px">${why}</span>` : ''}<span class="card-sp">${sparkline(rows.slice(-30).map(x => x.close), rows.length > 30 && rows[rows.length - 1].close >= rows[rows.length - 30].close ? C.up : C.dn, 80, 24)}</span></div>
      ${levelBar(uniq, c, k, s)}
      <div class="card-f"><span class="${rsi < 30 ? 'ok' : rsi > 70 ? 'warn' : 'mut'}">${term('RSI')} ${rsi.toFixed(0)}${rsi < 30 ? ' 과매도' : rsi > 70 ? ' 과매수' : ''}</span><span class="mut">·</span><span class="mut">${term('거래량')} ${r.rsi_volume.vol_ratio.toFixed(1)}×</span>${r.pattern?.type ? `<span class="mut">·</span><span class="warn">${term('쐐기', r.pattern.type)}</span>` : ''}${FL?.[s] ? `<span class="mut">·</span><span class="${FL[s].fo['5'] >= 0 ? 'up' : 'dn'}">외+기 5일 ${eok(FL[s].fo['5'])}</span>` : ''}</div>
      <div class="card-one">${esc(one)}</div>
    </a>`;
  }).join('');
  // 표 보기: 한 줄에 한 종목 — 받침 ↔ 현재 ↔ 천장 위치를 작은 막대로
  const miniBar = x => {
    if (!x.below && !x.abv) return '<span class="mut" style="font-size:11px">기준선 없음</span>';
    const lo = x.below ? x.below.price : x.c * 0.97, hi = x.abv ? x.abv.price : x.c * 1.03;
    const pos = v => Math.max(2, Math.min(98, (v - lo) / (hi - lo) * 100));
    const lab = (o, side) => o ? `<span class="lab" style="${side}:0;color:${o.color}">${o.label} ${fmtP(o.price, x.k)}</span>` : '';
    const md = (o, side) => o ? `<span class="md ${o.price < x.c ? 'ok' : 'warn'}" style="${side}:0">${sgn(pct(o.price, x.c))}</span>` : '';
    return `<div class="mini">${lab(x.below, 'left')}${lab(x.abv, 'right')}${md(x.below, 'left')}${md(x.abv, 'right')}<div class="t"></div>${x.below ? `<div class="m" style="left:2%;background:${x.below.color}"></div>` : ''}${x.abv ? `<div class="m" style="left:98%;background:${x.abv.color}"></div>` : ''}<div class="m now" style="left:${pos(x.c)}%"></div></div>`;
  };
  const dist = (o, c) => o ? `<span class="${o.price < c ? 'ok' : 'warn'}">${sgn(pct(o.price, c))}</span>` : '<span class="mut">—</span>';
  const table = `<div class="tbl"><div class="tr"><span>종목</span><span>종가</span><span>받침 ↔ 천장 (현재 위치)</span><span class="d">아래선까지</span><span class="d">위선까지</span><span class="d">RSI</span><span>상태</span></div>${trs.map(x => `<a class="tr" href="#/t/${encodeURIComponent(x.s)}" title="${esc(x.one)}"><span class="n lgrow">${logo(x.s, nameOf(x.s, J), 26)}<span>${nameOf(x.s, J)}<small>${esc(x.s)}</small></span></span><span class="pr ${cls(x.chg)}" data-live-cls="${esc(x.s)}"><span data-live-p="${esc(x.s)}" data-k="${x.k ? 1 : 0}">${fmtP(x.c, x.k)}</span><small data-live-c="${esc(x.s)}">${sgn(x.chg)}</small></span>${miniBar(x)}<span class="d hd">${dist(x.below, x.c)}</span><span class="d hd">${dist(x.abv, x.c)}</span><span class="d hd ${x.rsi < 30 ? 'ok' : x.rsi > 70 ? 'warn' : 'mut'}">${x.rsi.toFixed(0)}</span><span>${chip(x.jd)}</span></a>`).join('')}</div>`;
  const view = LS.get('deskView') || 'card';
  main.innerHTML = `
    <form class="find" id="findF" autocomplete="off"><input id="findQ" placeholder="종목 찾기 — 이름·코드·미국 티커 (예: 한화에어로스페이스, NVDA) · 바로 분석" enterkeyhint="search"><button class="btn pri">분석</button></form><div id="findMsg" class="find-msg" hidden></div>
    <div class="bar"><h1>데스크</h1><span class="mut mono" style="font-size:12px">종가 기준 · 평일 15:40 / 05:10 KST 자동</span>${(() => { const m = MW.match(/<span class="mw-i">(.*?)<\/span><div><b>(.*?)<\/b>/); return m ? `<a class="mw-pill" href="#mw">${m[1]} 시장 ${m[2]}</a>` : ''; })()}<span class="legend" style="margin-left:auto"><i style="background:${C.up}"></i>상승 <i style="background:${C.dn}"></i>하락 <i style="background:${C.ok}"></i>받침·충족 <i style="background:${C.warn}"></i>주의·선</span></div>
    ${(() => { const al = (AL?.alerts || []); if (!al.length) return '';
      const pr = { '손절 이탈': 0, '손절 근접': 1, '진입 조건': 2, '추세선 돌파': 3, '수급 전환': 4, '하단선 이탈': 5, '합류 받침': 6, 'RSI 과매도': 7, '합류 천장': 8 };
      const sorted = [...al].sort((a, b) => (pr[a.rule] ?? 9) - (pr[b.rule] ?? 9));
      const row = x => `<a class="al" href="#/t/${encodeURIComponent(x.symbol)}"><span class="chip ${x.level}">${esc(x.rule)}</span><b class="w lgrow">${logo(x.symbol, nameOf(x.symbol, J), 18)}${nameOf(x.symbol, J)}</b><span class="dim">${esc(x.text)}</span></a>`;
      const head = sorted.slice(0, 4).map(row).join(''), rest = sorted.slice(4).map(row).join('');
      return `<section class="alerts"><header><span>오늘 알림 ${al.length}</span><small>규칙당 하루 1회 · ${AL.asof}</small></header><div class="al-list">${head}${rest ? `<details class="al-more"><summary>${sorted.length - 4}개 더</summary>${rest}</details>` : ''}</div></section>`; })()}
    <div class="sumrow">${sum || '<span class="mut">판단 결과 없음</span>'}<span class="vt"><button data-v="card" class="${view === 'card' ? 'on' : ''}">카드</button><button data-v="table" class="${view === 'table' ? 'on' : ''}">표</button></span><span class="mut" style="margin-left:auto;font-size:11px">탭 → 종목 페이지</span></div>
    <div class="cards" ${view === 'table' ? 'hidden' : ''}>${cards}</div>
    <div id="tblv" ${view === 'card' ? 'hidden' : ''}>${table}</div>
    ${flowRadar(FL, J)}
    ${trackStrip(TR)}
    ${eventsStrip(EV, J)}
    ${MW}
    <div class="mut" style="font-size:12px;padding:2px 2px 0">지수</div>
    <div class="mkts">${mkt || '<div class="mut" style="padding:8px 12px">시장 지표는 다음 배치 후 표시</div>'}</div>
    ${sectH ? `<div class="sects"><span class="mut">업종 맥락</span>${sectH}</div>` : ''}
    <details class="rules"><summary>규칙 3줄</summary><div class="sent"><div>· 모든 판단은 종가 기준. 장중 흔들림은 무시.</div><div>· 손절선 없이 매수 없음. 반등 확인 전 물타기 금지.</div><div>· 문장은 가능성 표현. 확률 숫자 없음. 반대 근거 1줄 필수.</div></div></details>`;
  bindTerms(); bindFind(J);
  document.querySelectorAll('.vt button').forEach(b => b.onclick = () => { LS.set('deskView', b.dataset.v); document.querySelectorAll('.vt button').forEach(x => x.classList.toggle('on', x === b)); $('.cards').hidden = b.dataset.v === 'table'; $('#tblv').hidden = b.dataset.v === 'card'; });
  $('#foot').textContent = `읽음 ${stamp()}`;
}

/* ------------------------------------------------------------ 즉시 계산 (중계 + engine.js)
   배치 결과가 있으면 먼저 그것을 보여주고, 뒤에서 최신 데이터로 다시 계산해 바뀌었으면 조용히 교체.
   배치 결과가 없는 종목(검색)은 여기서 바로 계산. 판단 보드·손절 판정은 계속 배치(종가) 기준. */
const QURL = () => ((window.INVESTOOL_CONFIG || {}).QUOTE_URL || '').replace(/\/$/, '');
async function lvGet(path) { const u = QURL(); if (!u) return null; try { const r = await fetch(u + path); return r.ok ? await r.json() : null; } catch { return null; } }
async function lvChart(sym, tf) {
  const j0 = await lvGet(`/c?s=${encodeURIComponent(sym)}&tf=${tf}`); if (!j0?.rows?.length) return null;
  const rows = j0.rows.map(([t, o, h, l, c, v]) => ({ time: tf === 'h' ? t + 9 * 3600 : t, open: o, high: h, low: l, close: c, volume: v }));
  return { rows, open: j0.open };
}
const engRows = rows => rows.map(r => ({ date: r.time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
function lvFlows(t) {  // flows.py analyze 와 같은 계산
  if (!t?.length) return null;
  const daily = [...t].reverse().map(x => { const c = x.close || 0; return { d: x.date, f: Math.round((x.foreign || 0) * c / 1e7) / 10, o: Math.round((x.organ || 0) * c / 1e7) / 10, i: Math.round((x.indiv || 0) * c / 1e7) / 10, hr: x.foreign_ratio, c }; });
  const cum = { f: [], o: [], i: [] }, acc = { f: 0, o: 0, i: 0 };
  daily.forEach(d => ['f', 'o', 'i'].forEach(k => { acc[k] += d[k]; cum[k].push(Math.round(acc[k] * 10) / 10); }));
  const S = (k, n) => Math.round(daily.slice(-n).reduce((s, d) => s + d[k], 0) * 10) / 10;
  const streak = k => { const L = daily[daily.length - 1][k], sg = L > 0 ? 1 : L < 0 ? -1 : 0; let n = 0; for (let i = daily.length - 1; i >= 0; i--) { const v = daily[i][k]; if (sg && v !== 0 && (v > 0) === (sg > 0)) n++; else break; } return sg * n; };
  const sm = Object.fromEntries(['f', 'o', 'i'].map(k => [k, { 5: S(k, 5), 20: S(k, 20), 60: S(k, 60) }]));
  const fo = { 5: Math.round((sm.f[5] + sm.o[5]) * 10) / 10, 20: Math.round((sm.f[20] + sm.o[20]) * 10) / 10, 60: Math.round((sm.f[60] + sm.o[60]) * 10) / 10 };
  const hr = daily.map(d => d.hr).filter(x => x != null), hchg = hr.length > 1 ? Math.round((hr[hr.length - 1] - hr[0]) * 100) / 100 : null;
  let state, tone;
  if (fo[20] <= 0 && 0 < fo[5]) [state, tone] = ['전환 — 팔던 외국인·기관이 최근 5일 사기 시작', 'ok'];
  else if (fo[5] > 0 && fo[20] > 0) [state, tone] = ['유입 — 외국인·기관이 계속 사는 중', 'up'];
  else if (fo[5] < 0 && fo[20] < 0) [state, tone] = [sm.i[20] > 0 ? '이탈 — 외국인·기관이 계속 파는 중 (개인이 받는 중)' : '이탈 — 외국인·기관이 계속 파는 중', 'dn'];
  else if (fo[20] > 0 && 0 >= fo[5]) [state, tone] = ['주춤 — 사던 외국인·기관이 최근 5일 멈춤/매도', 'warn'];
  else [state, tone] = ['혼조', 'mut'];
  const fs = streak('f'), os = streak('o'), bits = [state];
  if (Math.abs(fs) >= 3) bits.push(`외국인 ${Math.abs(fs)}일 연속 ${fs > 0 ? '순매수' : '순매도'}`);
  if (Math.abs(os) >= 3) bits.push(`기관 ${Math.abs(os)}일 연속 ${os > 0 ? '순매수' : '순매도'}`);
  if (hchg != null && Math.abs(hchg) >= 0.3) bits.push(`외국인 보유율 60일 ${hchg >= 0 ? '+' : ''}${hchg.toFixed(2)}%p`);
  return { asof: daily[daily.length - 1].d, daily, cum, sum: sm, fo, streak: { f: fs, o: os }, hold: { now: hr.length ? hr[hr.length - 1] : null, chg60: hchg }, state, tone, sentence: bits.join(' · ') };
}
function lvMtf(rd, W, M) {  // mtf.py summarize / near_lines / strong 와 같은 계산
  const U = { w: '주', m: '월' }, out = { near: [], strong: [] };
  const summ = (r, tf) => {
    const c = r.close, ma = r.ma || {}, above = Object.values(ma).filter(v => c > v.value).length, n = Object.keys(ma).length;
    const conf = r.confluence || [], tl = r.trend_upper || {};
    const sup = [...(r.levels || []).filter(l => l.price < c).map(l => l.price), ...conf.filter(g => g.price < c).map(g => g.price)].sort((a, b) => b - a);
    const res = [...(r.levels || []).filter(l => l.price >= c).map(l => l.price), ...conf.filter(g => g.price >= c).map(g => g.price)].sort((a, b) => a - b);
    const trend = !n ? '기간 짧음(상장 초기)' : above === 0 ? '하락 추세' : above === n ? '상승 추세' : '횡보·전환 구간';
    const rsi = r.rsi_volume?.rsi, bits = [`${U[tf]}봉 ${trend}`, `이평 ${above}/${n}개 위`];
    if (rsi != null) bits.push(`RSI ${rsi.toFixed(0)}` + (rsi < 30 ? ' 과매도' : rsi > 70 ? ' 과매수' : ''));
    return { asof: r.asof, close: c, trend, above, n_ma: n, rsi, sup: sup[0] ?? null, res: res[0] ?? null, sentence: bits.join(' · ') };
  };
  const near = (r, tf) => {
    const u = U[tf], L = [];
    Object.entries(r.ma || {}).forEach(([k, v]) => L.push([`${k.replace('sma', '')}${u}선`, v.value]));
    (r.levels || []).forEach(l => L.push([`${u}봉 ${l.price < rd.close ? '지지' : '저항'}(${l.touches}회)`, l.price]));
    if (r.trend_upper) L.push([r.trend_upper.slope_per_bar < 0 ? `${u}봉 하락 추세선` : `${u}봉 상단 추세선`, r.trend_upper.value_today]);
    if (r.trend_lower) L.push([r.trend_lower.slope_per_bar > 0 ? `${u}봉 상승 추세선` : `${u}봉 하단 추세선`, r.trend_lower.value_today]);
    Object.entries(r.fib?.levels || {}).forEach(([k, v]) => L.push([`${u}봉 피보 ${k}`, v]));
    if (r.bollinger?.lower) L.push([`${u}봉 볼린저 하단`, r.bollinger.lower]);
    return L.filter(([, p]) => p && Math.abs(p / rd.close - 1) <= 0.03).map(([label, p]) => ({ tf, label, price: p, pct: Math.round((p / rd.close - 1) * 10000) / 100 }));
  };
  if (W) { out.w = summ(W, 'w'); out.near.push(...near(W, 'w')); }
  if (M) { out.m = summ(M, 'm'); out.near.push(...near(M, 'm')); }
  out.near.sort((a, b) => Math.abs(a.pct) - Math.abs(b.pct));
  (rd.confluence || []).forEach(g => { const hits = out.near.filter(n => Math.abs(n.price / g.price - 1) <= 0.015); if (hits.length) out.strong.push({ price: g.price, side: g.price < rd.close ? '받침' : '천장', with: hits.map(h => h.label) }); });
  return (out.w || out.m) ? out : null;
}
async function lvBundle(sym) {
  if (!QURL() || !window.Engine) return null;
  const kr = /\.(KS|KQ)$/.test(sym);
  const [d, w, m, ft] = await Promise.all([lvChart(sym, 'd'), lvChart(sym, 'w'), lvChart(sym, 'm'), kr ? lvGet(`/f?s=${sym}`) : null]);
  if (!d || d.rows.length < 40) return null;
  const r = Engine.analyze(engRows(d.rows), sym);
  const an = x => { try { return x && x.rows.length >= 20 ? Engine.analyze(engRows(x.rows), sym) : null; } catch { return null; } };
  const rw = an(w), rm = m && m.rows.length >= 15 ? an(m) : null;
  return { r, rows: d.rows, open: d.open, w: w ? { rows: w.rows, r: rw } : null, m: m ? { rows: m.rows, r: rm } : null, M: lvMtf(r, rw, rm), F: Array.isArray(ft) ? lvFlows(ft) : null, at: new Date() };
}
async function lvRefresh(sym, r0) {
  const b = await lvBundle(sym); if (!b) return;
  if (location.hash !== '#/t/' + encodeURIComponent(sym) && decodeURIComponent(location.hash.slice(4)) !== sym) return;
  if (b.r.asof === r0.asof && b.r.close === r0.close) return;  // 바뀐 게 없으면 그대로
  const y = window.scrollY; await renderTicker(sym, b); window.scrollTo(0, y);
}
/* 큰 그림 — 월봉·주봉·일봉을 한 줄로 */
function bigPicture(M, r) {
  if (!M || (!M.w && !M.m)) return '';
  const k = r.krw, f = v => v == null ? '—' : fmtP(v, k);
  const day = { trend: (() => { const ma = Object.values(r.ma || {}); const a = ma.filter(v => r.close > v.value).length; return !ma.length ? '—' : a === 0 ? '하락 추세' : a === ma.length ? '상승 추세' : '횡보·전환 구간'; })(),
    above: Object.values(r.ma || {}).filter(v => r.close > v.value).length, n_ma: Object.keys(r.ma || {}).length, rsi: r.rsi_volume?.rsi,
    sup: [...(r.levels || []).map(l => l.price), ...(r.confluence || []).map(g => g.price)].filter(p => p < r.close).sort((a, b) => b - a)[0],
    res: [...(r.levels || []).map(l => l.price), ...(r.confluence || []).map(g => g.price)].filter(p => p >= r.close).sort((a, b) => a - b)[0] };
  const tone = t => t === '상승 추세' ? 'up' : t === '하락 추세' ? 'dn' : 'warn';
  const col = (name, x, hint) => !x ? `<div class="bp-c off"><div class="bp-h">${name}</div><div class="mut" style="font-size:11px">데이터 부족</div></div>` :
    `<div class="bp-c"><div class="bp-h">${name}<small>${hint}</small></div><div class="bp-t ${tone(x.trend)}">${x.trend}</div>
      <div class="bp-dots">${Array.from({ length: x.n_ma }, (_, i) => `<i class="${i < x.above ? 'on' : ''}"></i>`).join('')}<span>이평 ${x.above}/${x.n_ma} 위</span></div>
      <div class="bp-r"><span>RSI</span><b class="mono ${x.rsi < 30 ? 'ok' : x.rsi > 70 ? 'warn' : ''}">${x.rsi != null ? x.rsi.toFixed(0) : '—'}</b></div>
      <div class="bp-r"><span>아래 받침</span><b class="mono ok">${f(x.sup)}</b></div><div class="bp-r"><span>위 천장</span><b class="mono warn">${f(x.res)}</b></div></div>`;
  const strong = (M.strong || []).map(x => `<div class="bp-s">★ ${x.side} <b class="mono">${f(x.price)}</b> — 일봉 선에 <b>${x.with.map(esc).join(' · ')}</b>까지 겹침 → <b class="ok">더 강한 자리</b></div>`).join('');
  const near = (M.near || []).slice(0, 4).map(n => `<span class="bp-n"><b>${esc(n.label)}</b> <span class="mono">${f(n.price)}</span> <span class="mono ${n.pct >= 0 ? 'warn' : 'ok'}">${n.pct >= 0 ? '+' : ''}${n.pct.toFixed(1)}%</span></span>`).join('');
  return `<section class="bp"><header><span>큰 그림 · 월봉 → 주봉 → 일봉</span><small>큰 봉일수록 보는 사람이 많아요</small></header>
    <div class="bp-g">${col('월봉', M.m, '몇 년')}${col('주봉', M.w, '몇 달')}${col('일봉', day, '판단 기준')}</div>
    ${strong}${near ? `<div class="bp-nl"><span class="mut">지금 가격 ±3% 안의 큰 봉 선</span>${near}</div>` : ''}</section>`;
}
/* 실시간 시세 (Cloudflare Worker 중계) — 보는 용도. 판단·손절은 계속 종가 기준 */
let LIVE = {}, liveTimer = null, liveSyms = [];
function liveStart() {
  clearInterval(liveTimer); liveTimer = null;
  const url = (window.INVESTOOL_CONFIG || {}).QUOTE_URL; if (!url) return;
  liveSyms = [...new Set([...document.querySelectorAll('[data-live-p]')].map(e => e.dataset.liveP))].slice(0, 40);
  if (!liveSyms.length) return;
  const tick = async () => {
    if (document.hidden) return;
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/q?s=' + encodeURIComponent(liveSyms.join(',')), { cache: 'no-store' });
      if (r.ok) { LIVE = { ...LIVE, ...(await r.json()) }; liveApply(); }
    } catch { }
  };
  tick(); liveTimer = setInterval(tick, 15000);
}
function liveApply() {
  const now = Date.now();
  for (const [s, q] of Object.entries(LIVE)) {
    if (!q || q.p == null || s === '_at') continue;
    const open = q.st === 'open', up = q.pct >= 0;
    const cssSel = v => CSS.escape ? CSS.escape(v) : v;
    document.querySelectorAll(`[data-live-p="${cssSel(s)}"]`).forEach(el => { const k = el.dataset.k === '1'; const t = fmtP(q.p, k); if (el.textContent !== t) { el.textContent = t; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } el.classList.toggle('up', up); el.classList.toggle('dn', !up); });
    document.querySelectorAll(`[data-live-c="${cssSel(s)}"]`).forEach(el => { el.textContent = sgn(q.pct, 2); el.classList.toggle('up', up); el.classList.toggle('dn', !up); });
    document.querySelectorAll(`[data-live-cls="${cssSel(s)}"]`).forEach(el => { el.classList.toggle('up', up); el.classList.toggle('dn', !up); });
    const ago = q.t ? Math.max(0, Math.round((now - new Date(q.t)) / 1000)) : null;
    document.querySelectorAll(`[data-live-t="${cssSel(s)}"]`).forEach(el => { el.innerHTML = open ? `<i></i>장중${ago != null && ago < 3600 ? ` · ${ago < 60 ? ago + '초' : Math.round(ago / 60) + '분'} 전` : ''}` : q.st === 'pre' ? '<i class="off"></i>장 전' : ''; el.classList.toggle('on', open); });
    document.querySelectorAll(`[data-live-bar="${cssSel(s)}"]`).forEach(el => { const mn = +el.dataset.mn, mx = +el.dataset.mx; const n = el.querySelector('.lb-now'); if (n && mx > mn && open) n.style.left = Math.max(0, Math.min(100, (q.p - mn) / (mx - mn) * 100)).toFixed(1) + '%'; });
    document.querySelectorAll(`[data-live-stop="${cssSel(s)}"]`).forEach(el => {
      const st = +el.dataset.stop; if (!st || !open) { el.hidden = true; return; }
      const room = (q.p / st - 1) * 100;
      if (room < 0) { el.hidden = false; el.className = 'livewarn dn'; el.innerHTML = `장중 ${fmtP(q.p, false)} — 손절선 ${st} <b>아래</b>. 규칙은 <b>종가</b>로만 판단해요. 마감까지 지켜보기.`; }
      else if (room < 1.5) { el.hidden = false; el.className = 'livewarn warn'; el.innerHTML = `장중 손절선 ${st}까지 <b>${room.toFixed(1)}%</b> — 종가 확인 전 매매 금지.`; }
      else el.hidden = true;
    });
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && liveTimer) liveStart(); });
/* 종목 찾기: 이미 분석된 종목이면 바로 이동, 아니면 GitHub에서 분석 실행(토큰 있으면 원탭, 없으면 실행 페이지로) */
const REPO = 'mannolmeok/investool';
function bindFind(J) {
  const f = $('#findF'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const q = $('#findQ').value.trim(); if (!q) return;
    const msg = $('#findMsg'); msg.hidden = false;
    const norm = x => (x || '').toLowerCase().replace(/\s/g, '');
    const LK = (delete cache['out/lookup.json'], await j('out/lookup.json')) || [];
    const known = [...Object.values(J || {}).map(x => ({ symbol: x.symbol, name: x.name })), ...LK];
    const hit = known.find(x => [norm(x.symbol), norm(x.name), norm(x.symbol).slice(0, 6), norm(x.q)].includes(norm(q)));
    if (hit && await j(`out/${hit.symbol}.json`)) { location.hash = '#/t/' + encodeURIComponent(hit.symbol); return; }
    // 즉시: 이름·코드 → 중계 검색 → 바로 종목 페이지 (그 자리에서 계산)
    if (QURL()) {
      msg.innerHTML = `<b>${esc(q)}</b> 찾는 중…`;
      let sym = null, name = q;
      if (/[가-힣]/.test(q) || /^\d{6}$/.test(q)) {
        const res = await lvGet('/s?q=' + encodeURIComponent(q));
        const h = (res || []).find(x => x.name === q) || (res || [])[0];
        if (h) { sym = h.symbol; name = h.name; }
      } else if (/^\d{6}\.(KS|KQ)$/i.test(q) || /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(q)) { sym = q.toUpperCase(); name = sym; }
      if (!sym) { msg.innerHTML = `<b>${esc(q)}</b> — 종목을 못 찾았어요. 이름을 정확히 쓰거나 6자리 코드로 검색해 보세요.`; return; }
      try { const N = JSON.parse(LS.get('names') || '{}'); N[sym] = name; LS.set('names', JSON.stringify(N)); } catch { }
      msg.hidden = true; location.hash = '#/t/' + encodeURIComponent(sym); return;
    }
    msg.innerHTML = '실시간 중계 주소(QUOTE_URL)가 설정돼 있지 않아요.';
  };
}
/* ------------------------------------------------------------ 내 포지션 (앱에서 매매 입력 → GitHub 가 positions.json·trades.json 반영) */
function posPanel(sym, r, jd) {
  const k = r.krw, f = v => fmtP(v, k), c = r.close;
  const held = jd?.held;
  const sup = [...(r.levels || []).map(l => l.price), ...(r.confluence || []).map(g => g.price), r.keys?.recent_low10].filter(p => p && p < c).sort((a, b) => b - a)[0];
  const res = [r.trend_upper?.value_today, ...(r.levels || []).map(l => l.price), ...(r.confluence || []).map(g => g.price)].filter(p => p && p > c).sort((a, b) => a - b);
  const head = held ? `<div class="pp-sum"><div><span>보유</span><b class="mono">${jd.qty}주</b></div><div><span>평단</span><b class="mono">${f(jd.avg)}</b></div><div><span>손익</span><b class="mono ${cls(jd.pnl_pct)}" data-pnl="${esc(sym)}" data-avg="${jd.avg}">${sgn(jd.pnl_pct)}</b></div><div><span>손절</span><b class="mono">${jd.stop ? f(jd.stop) : '—'}</b></div></div>`
    : `<div class="mut" style="font-size:12px;padding:2px 0 6px">보유 중이 아니에요. 사면 여기에 기록하세요 — 판단 보드·손절 알림·일지가 이 기준으로 바뀌어요.</div>`;
  const btn = (m, t) => `<button class="btn ${m === 'buy' && !held ? 'pri' : ''}" data-pm="${m}">${t}</button>`;
  return `<section class="pp" data-sym="${esc(sym)}" data-krw="${k ? 1 : 0}" data-close="${c}" data-sup="${sup ?? ''}" data-res="${res.slice(0, 2).join(',')}" data-held="${held ? 1 : 0}" data-qty="${held ? jd.qty : ''}" data-stop="${jd?.stop ?? ''}" data-targets="${(jd?.targets || []).join(',')}">
    <header><span>내 포지션</span><small>입력하면 1~2분 뒤 판단 보드·알림·일지에 반영</small></header>
    <div style="padding:8px 12px 10px">${head}<div class="pp-btns">${held ? btn('buy', '＋ 추가 매수') + btn('sell', '－ 매도') + btn('set', '손절선·목표 수정') : btn('buy', '＋ 매수 기록')}</div>
    <div class="pp-form" hidden></div><div class="pp-msg mut"></div></div></section>`;
}
function bindPosPanel(sym) {
  const P = $('.pp'); if (!P) return;
  const D = P.dataset, krw = D.krw === '1', fmt = v => v === '' || v == null ? '' : (krw ? Math.round(+v) : (+v).toFixed(2));
  const form = P.querySelector('.pp-form'), msg = P.querySelector('.pp-msg');
  P.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => {
    const m = b.dataset.pm; form.hidden = false; msg.textContent = '';
    const tg = (D.targets || D.res || '').split(',').filter(Boolean).map(fmt).join(', ');
    const fld = (id, label, val, hint = '') => `<label class="pf"><span>${label}</span><input id="pf_${id}" inputmode="decimal" value="${val ?? ''}" placeholder="${hint}"></label>`;
    form.innerHTML = `<div class="pf-g">${m !== 'set' ? fld('qty', m === 'sell' ? '판 수량' : '산 수량', m === 'sell' ? D.qty : '', '주') + fld('price', m === 'sell' ? '판 가격' : '산 가격', fmt(D.close)) : ''}
      ${m !== 'sell' ? fld('stop', '손절선 (종가 기준)', fmt(D.stop || D.sup), '필수') + fld('targets', '목표가 (쉼표로)', tg) : ''}
      ${m === 'set' ? fld('stop_long', '장기분 손절선 (선택)', '') : ''}
      ${fld('memo', '메모 (왜 샀/팔았나)', '', m === 'sell' ? '예) 추세선 돌파 실패' : '예) 120주선 받침 반등 확인')}</div>
      <div class="pf-risk mut"></div><div class="pp-btns"><button class="btn pri" id="pf_ok">저장</button><button class="btn" id="pf_x">취소</button></div>`;
    const risk = () => { const q = +$('#pf_qty')?.value || 0, p = +$('#pf_price')?.value || 0, st = +$('#pf_stop')?.value || 0;
      if (m === 'buy' && q && p && st) $('.pf-risk').innerHTML = st >= p ? '<span class="dn">손절선은 산 가격보다 낮아야 해요</span>' : `손절까지 <b>${((1 - st / p) * 100).toFixed(1)}%</b> · 최대 손실 <b class="mono">${krw ? Math.round((p - st) * q).toLocaleString() + '원' : '$' + ((p - st) * q).toFixed(2)}</b>`;
      else $('.pf-risk').textContent = ''; };
    form.querySelectorAll('input').forEach(i => i.oninput = risk); risk();
    $('#pf_x').onclick = () => { form.hidden = true; };
    $('#pf_ok').onclick = async () => {
      const v = id => $('#pf_' + id)?.value.trim();
      const op = { action: m, symbol: sym, name: nameOf(sym), id: Math.random().toString(16).slice(2, 12) };
      if (m !== 'set') { op.qty = +v('qty'); op.price = +v('price'); }
      if (m !== 'sell') { if (v('stop')) op.stop = +v('stop'); if (v('targets')) op.targets = v('targets').split(',').map(x => +x.trim()).filter(Boolean); }
      if (v('stop_long')) op.stop_long = +v('stop_long');
      if (v('memo')) op.memo = v('memo');
      if (m === 'buy' && !op.stop) { msg.innerHTML = '<span class="dn">손절선 없이 매수 없음 — 손절선을 넣어주세요.</span>'; return; }
      if (m !== 'set' && (!op.qty || !op.price)) { msg.innerHTML = '<span class="dn">수량과 가격을 넣어주세요.</span>'; return; }
      const tok = LS.get('ghToken');
      const human = `${nameOf(sym)} ${m === 'buy' ? '매수' : m === 'sell' ? '매도' : '설정 변경'}${op.qty ? ` ${op.qty}주` : ''}${op.price ? ` @ ${op.price}` : ''}${op.stop ? `, 손절 ${op.stop}` : ''}${op.targets ? `, 목표 ${op.targets.join('/')}` : ''}${op.memo ? ` (${op.memo})` : ''}`;
      if (!tok) { msg.innerHTML = `GitHub 토큰이 없어요. 알림·설정에서 넣어두거나, 이 문장을 Claude에게 보내주세요:<br><b>${esc(human)}</b>`; return; }
      msg.textContent = '저장 요청 중…';
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/position.yml/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ ref: 'main', inputs: { op: JSON.stringify(op) } }) }).catch(() => null);
      if (!res || res.status !== 204) { msg.innerHTML = `<span class="dn">실패 (${res ? res.status : '네트워크'})</span> — 토큰 권한(Actions: Read and write) 확인`; return; }
      form.hidden = true; const t0 = Date.now();
      const tick = async () => {
        const sec = Math.round((Date.now() - t0) / 1000);
        try { const T = await (await fetch('trades.json?_=' + Date.now(), { cache: 'no-store' })).json(); if (T.some(x => x.id === op.id)) { msg.innerHTML = '<span class="ok">반영 완료 ✓</span> — 화면을 새로 그려요'; Object.keys(cache).forEach(k => delete cache[k]); setTimeout(() => renderTicker(sym), 800); return; } } catch { }
        if (sec > 300) { msg.textContent = '5분이 지나도 반영이 안 보여요. GitHub Actions → position 기록을 확인해 주세요.'; return; }
        msg.innerHTML = `저장 중… ${sec}초 <span class="mut">(${esc(human)})</span>`; setTimeout(tick, 8000);
      };
      setTimeout(tick, 20000);
    };
  });
}
/* 관심 종목에 추가 (GitHub 토큰 있으면 원탭, 없으면 안내) */
async function addToWatch(sym) {
  const tok = LS.get('ghToken'), m = $('#addMsg');
  if (!tok) { m.innerHTML = `토큰이 없어요. 저한테 "<b>${esc(nameOf(sym))} 관심 종목에 추가</b>"라고 말해주거나, 알림·설정에서 GitHub 토큰을 넣어두면 이 버튼으로 바로 추가돼요.`; return; }
  m.textContent = '추가 요청 중…';
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/analyze.yml/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ ref: 'main', inputs: { q: sym, add: 'true' } }) }).catch(() => null);
  m.textContent = res && res.status === 204 ? '추가 요청 완료 — 2~3분 뒤부터 매일 판단·알림 대상이에요.' : `실패 (${res ? res.status : '네트워크'}) — 토큰 권한(Actions: Read and write) 확인`;
}
/* 시장 날씨 — 거시 카드 (환율·금리·달러·VIX·EWY·나스닥) */
function macroWeather(get) {
  const M = [
    { s: 'KRW=X', n: '원/달러', unit: '원', d: 1, read: (v, c20) => c20 >= 1.5 ? ['off', '원화 약세 — 외국인이 한국 주식을 팔기 쉬운 환경'] : c20 <= -1.5 ? ['on', '원화 강세 — 외국인 매수에 우호적'] : ['mid', '환율 안정'] },
    { s: '^TNX', n: '미 10년물 금리', unit: '%', d: 2, bp: true, read: (v, c20, d20) => d20 >= 0.2 ? ['off', '금리 상승 — 성장주·고PER주 부담'] : d20 <= -0.2 ? ['on', '금리 하락 — 성장주에 우호적'] : ['mid', '금리 보합'] },
    { s: 'DX-Y.NYB', n: '달러 인덱스', unit: '', d: 1, read: (v, c20) => c20 >= 2 ? ['off', '달러 강세 — 신흥국(한국) 자금 이탈 압력'] : c20 <= -2 ? ['on', '달러 약세 — 신흥국에 우호적'] : ['mid', '달러 보합'] },
    { s: '^VIX', n: 'VIX 공포지수', unit: '', d: 1, read: v => v < 15 ? ['on', '시장이 편안함'] : v < 25 ? ['mid', '경계 — 흔들릴 수 있음'] : ['off', '공포 — 변동성 큼, 손절선 우선'] },
    { s: 'EWY', n: 'EWY (해외에서 본 한국)', unit: '$', d: 2, ma: true, read: (v, c20, d20, above, c1) => [above ? 'on' : 'off', (above ? '20일선 위 — 해외 자금 흐름 양호' : '20일선 아래 — 해외 자금 흐름 약함') + (Math.abs(c1) >= 1 ? ` · 밤사이 ${c1 > 0 ? '+' : ''}${c1.toFixed(1)}% → 오늘 코스피 ${c1 > 0 ? '강세' : '약세'} 출발 가능성` : '')] },
    { s: '^IXIC', n: '나스닥', unit: '', d: 0, ma: true, read: (v, c20, d20, above) => [above ? 'on' : 'off', above ? '20일선 위 — 기술주 흐름 양호' : '20일선 아래 — 기술주 약세'] },
  ];
  return Promise.all([...M.map(async m => ({ m, rows: await get(m.s) })), get('^GSPC').then(r => ({ ref: r }))]).then(L0 => {
    const refDate = (L0.find(x => x.ref)?.ref || []).slice(-1)[0]?.time || '';
    const L = L0.filter(x => x.m);
    let on = 0, off = 0;
    const cards = L.filter(x => x.rows && x.rows.length > 21).map(({ m, rows }) => {
      const cl = rows.map(r => r.close), v = cl[cl.length - 1], p1 = cl[cl.length - 2], p20 = cl[cl.length - 21];
      const c1 = (v / p1 - 1) * 100, c20 = (v / p20 - 1) * 100, d20 = v - p20, ma20 = cl.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const stale = m.s === 'EWY' && refDate && rows[rows.length - 1].time < refDate;  // 하루 늦은 데이터면 '오늘 출발' 힌트는 빼기
      let [tone, text] = m.read(v, c20, d20, v > ma20, stale ? 0 : c1);
      if (stale) text += ' · (최신 봉 대기 중)';
      if (tone === 'on') on++; if (tone === 'off') off++;
      const val = m.unit === '%' ? v.toFixed(2) + '%' : (m.unit === '$' ? '$' : '') + v.toLocaleString('en-US', { minimumFractionDigits: m.d, maximumFractionDigits: m.d }) + (m.unit === '원' ? '원' : '');
      const chg20 = m.bp ? `${d20 >= 0 ? '+' : ''}${Math.round(d20 * 100)}bp` : `${c20 >= 0 ? '+' : ''}${c20.toFixed(1)}%`;
      return `<div class="mc ${tone}"><div class="mc-n">${m.n}<small class="mono">${rows[rows.length - 1].time.slice(5)}</small></div>
        <div class="mc-v mono">${val}</div><div class="mc-c mono"><span class="${c1 >= 0 ? 'up' : 'dn'}">${c1 >= 0 ? '+' : ''}${c1.toFixed(1)}%</span><span class="mut">20일 ${chg20}</span></div>
        <div class="mc-s">${sparkline(cl.slice(-30), tone === 'on' ? C.ok : tone === 'off' ? C.dn : C.warn, 120, 26)}</div><div class="mc-t">${esc(text)}</div></div>`;
    });
    if (!cards.length) return '';
    const sc = on - off, wx = sc >= 2 ? ['☀️', '맑음', '돈이 주식으로 들어오기 좋은 환경', 'on'] : sc <= -2 ? ['🌧️', '비', '자금이 빠지기 쉬운 환경 — 신규 매수는 받침 확인 후, 손절선 우선', 'off'] : ['⛅', '구름', '신호가 엇갈림 — 종목별 기준선대로', 'mid'];
    return `<section class="mw" id="mw"><header><span>시장 날씨</span><small>좋음 ${on} · 나쁨 ${off} · 하루 2번 갱신</small></header>
      <div class="mw-sum ${wx[3]}"><span class="mw-i">${wx[0]}</span><div><b>${wx[1]}</b><span>${wx[2]}</span></div></div>
      <div class="mcs">${cards.join('')}</div></section>`;
  });
}
/* 수급 — "내 뒤에 사줄 사람이 있나" */
const FC = { f: '#B8A6FF', o: '#F5A623', i: '#8A8A8A' };
const eok = v => v == null ? '—' : (v >= 0 ? '+' : '−') + (Math.abs(v) >= 10000 ? (Math.abs(v) / 10000).toFixed(Math.abs(v) >= 100000 ? 0 : 1) + '조' : Math.abs(v).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '억');
function flowChart(F) {
  const mob = innerWidth < 700, W = mob ? 400 : Math.max(680, Math.min(1260, innerWidth - 200)), H = mob ? 250 : 260, P = { l: 6, r: mob ? 84 : 92, t: 12, b: 58 }, n = F.daily.length, fz = mob ? 12 : 12;
  const all = [...F.cum.f, ...F.cum.o, ...F.cum.i, 0];
  const lo = Math.min(...all), hi = Math.max(...all), span = (hi - lo) || 1;
  const x = i => P.l + i * (W - P.l - P.r) / Math.max(1, n - 1);
  const y = v => P.t + (hi - v) / span * (H - P.t - P.b);
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const bars = F.daily.map(d => d.f + d.o), bm = Math.max(1, ...bars.map(Math.abs)), by = H - 22, bh = 18;
  const bw = Math.max(2, (W - P.l - P.r) / n - 2);
  const lab = (k, t) => { const v = F.cum[k][n - 1]; return `<text x="${W - P.r + 6}" y="${y(v) + 4}" font-size="${fz}" font-weight="600" fill="${FC[k]}">${t} ${eok(v)}</text>`; };
  return `<svg viewBox="0 0 ${W} ${H}" class="fchart">
    <line x1="${P.l}" x2="${W - P.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ctl)" stroke-dasharray="3 3"/>
    <text x="${P.l}" y="${y(0) - 4}" font-size="${fz - 1}" fill="var(--mut)">0 = 60일 전</text>
    <path d="${path(F.cum.i)}" fill="none" stroke="${FC.i}" stroke-width="1.5" opacity=".8"/>
    <path d="${path(F.cum.o)}" fill="none" stroke="${FC.o}" stroke-width="2"/>
    <path d="${path(F.cum.f)}" fill="none" stroke="${FC.f}" stroke-width="2.4"/>
    ${lab('f', '외')}${lab('o', '기')}${lab('i', '개')}
    <line x1="${P.l}" x2="${W - P.r}" y1="${by}" y2="${by}" stroke="var(--line)"/>
    ${bars.map((v, i) => { const h = Math.abs(v) / bm * bh; return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(v >= 0 ? by - h : by).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" fill="${v >= 0 ? 'var(--up)' : 'var(--dn)'}" opacity=".75"/>`; }).join('')}
    <text x="${P.l}" y="${H - 2}" font-size="${fz - 1}" fill="var(--mut)">${F.daily[0].d.slice(4, 6)}/${F.daily[0].d.slice(6)}</text>
    <text x="${W - P.r}" y="${H - 2}" font-size="${fz - 1}" fill="var(--mut)" text-anchor="end">${F.asof.slice(4, 6)}/${F.asof.slice(6)}</text>
    <text x="${W - P.r + 6}" y="${by + 4}" font-size="${fz - 1}" fill="var(--mut)">외+기 하루</text>
  </svg>`;
}
function flowSection(F) {
  if (!F) return '';
  const cell = (t, v) => `<div class="fs-c"><span>${t}</span><b class="mono ${v >= 0 ? 'up' : 'dn'}">${eok(v)}</b></div>`;
  return `<section class="flow"><header><span>수급 · 내 뒤에 사줄 사람이 있나</span><small>외국인·기관·개인 60일 누적 순매수 · ${F.asof.slice(4, 6)}/${F.asof.slice(6)}</small></header>
    <div class="flow-st ${F.tone}">${esc(F.sentence)}</div>
    <div class="fs">${cell('외+기 5일', F.fo['5'])}${cell('20일', F.fo['20'])}${cell('60일', F.fo['60'])}<div class="fs-c"><span>외국인 보유율</span><b class="mono">${F.hold.now ?? '—'}%</b><small class="${(F.hold.chg60 || 0) >= 0 ? 'up' : 'dn'}">${F.hold.chg60 != null ? (F.hold.chg60 >= 0 ? '+' : '') + F.hold.chg60.toFixed(2) + '%p' : ''}</small></div></div>
    <div style="padding:4px 10px 0">${flowChart(F)}</div>
    <div class="clegend" style="padding:4px 12px 10px"><span><i style="background:${FC.f}"></i>외국인</span><span><i style="background:${FC.o}"></i>기관</span><span><i style="background:${FC.i}"></i>개인</span><span class="mut">선이 오른쪽 위로 = 계속 사는 중 · 아래 막대 = 하루 외+기 합 (빨강 매수 / 파랑 매도)</span></div>
  </section>`;
}
function flowRadar(FL, J) {
  const ents = Object.entries(FL || {}); if (!ents.length) return '';
  ents.sort((a, b) => b[1].fo['5'] - a[1].fo['5']);
  const m = Math.max(1, ...ents.flatMap(([, f]) => [Math.abs(f.fo['5']), Math.abs(f.fo['20'])]));
  const bar = v => `<div class="fr-b"><div class="fr-mid"></div><div class="fr-f" style="${v >= 0 ? 'left:50%' : `right:50%`};width:${Math.abs(v) / m * 50}%;background:${v >= 0 ? 'var(--up)' : 'var(--dn)'}"></div></div>`;
  return `<section><header><span>수급 레이더</span><small>외국인+기관 순매수 · 5일 순 정렬</small></header><div class="fr-l">
    <div class="fr hd"><span></span><span>5일</span><span>20일</span><span></span></div>
    ${ents.map(([s, f]) => `<a class="fr" href="#/t/${encodeURIComponent(s)}"><b class="w lgrow">${logo(s, nameOf(s, J), 20)}<span>${nameOf(s, J)}</span></b><span class="fr-v">${bar(f.fo['5'])}<small class="mono ${f.fo['5'] >= 0 ? 'up' : 'dn'}">${eok(f.fo['5'])}</small></span><span class="fr-v">${bar(f.fo['20'])}<small class="mono ${f.fo['20'] >= 0 ? 'up' : 'dn'}">${eok(f.fo['20'])}</small></span><span class="chip ${f.tone === 'mut' ? '' : f.tone}" style="font-size:10px">${esc(f.state.split(' — ')[0])}</span></a>`).join('')}
  </div></section>`;
}
/* 엔진 성적표 — 엔진이 한 말이 5일 뒤 맞았나 */
function rateBar(pct, ref, col) {
  return `<div class="rb"><div class="rb-t"><div class="rb-f" style="width:${pct ?? 0}%;background:${col}"></div>${ref != null ? `<div class="rb-r" style="left:${ref}%" title="더미 ${ref}%"></div>` : ''}</div><b class="mono">${pct != null ? pct + '%' : '—'}</b></div>`;
}
function trackStrip(TR) {
  if (!TR?.summary) return '';
  const S = TR.summary, d = S['더미 받침']?.pct;
  return `<a class="trk" href="#/track"><header><span>엔진 성적표</span><small>${S['기간'].from} ~ ${S['기간'].to} · ${S.horizon}일 뒤 채점 · 자세히 ›</small></header>
    <div class="trk-g">
      <div><div class="trk-k">★받침에 오면 <b class="ok">튀었나</b></div>${rateBar(S['받침'].pct, d, C.ok)}<div class="trk-s">${S['받침'].n}번 중 ${S['받침'].good} · 아무 가격이면 ${d ?? '—'}%</div></div>
      <div><div class="trk-k">★천장에 오면 <b class="warn">막혔나</b></div>${rateBar(S['천장'].pct, null, C.warn)}<div class="trk-s">${S['천장'].n}번 중 ${S['천장'].good}</div></div>
      <div><div class="trk-k">추세선 넘은 뒤 <b class="up">5일 더 올랐나</b></div>${rateBar(S['추세선'].win, null, C.up)}<div class="trk-s">${S['추세선'].n_ret}번 · 평균 ${sgn(S['추세선'].avg_ret_after)}</div></div>
    </div></a>`;
}
async function renderTrack() {
  setNav('desk'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  const [TR, J] = await Promise.all([j('out/track.json'), j('out/judgement.json')]);
  if (!TR) { main.innerHTML = '<div class="bar"><a href="#/" class="back">‹</a><h1>엔진 성적표</h1><span class="mut">다음 배치 후 생성</span></div>'; return; }
  const S = TR.summary;
  const tone = { 반응: 'ok', 막힘: 'ok', 돌파: 'up', 이탈: 'dn', '못 넘음': 'mut', 애매: 'mut', '안 옴': 'mut', 대기: 'mut', '진행 중': 'warn' };
  const res = (p) => { const r = p.kind === '천장' && p.result === '돌파' ? 'dn' : tone[p.result] || 'mut'; return `<span class="chip ${r}" style="font-size:10px;padding:0 6px">${p.kind} ${p.result || '대기'}</span>`; };
  const rows = TR.rows.filter(r => r.preds.length).slice(0, 120).map(r => `<a class="tkr" href="#/t/${encodeURIComponent(r.sym)}"><span class="mono mut">${r.asof.slice(5)}</span><b class="w">${nameOf(r.sym, J)}</b><span class="mono ${cls(r.ret5 ?? r.ret1)}">${r.ret5 != null ? sgn(r.ret5) : r.ret1 != null ? sgn(r.ret1) + '<small class="mut"> (1일)</small>' : '—'}</span><span class="tkr-p">${r.preds.map(res).join('')}</span>${r.src === '재현' ? '<span class="mut" style="font-size:10px">재현</span>' : '<span class="ok" style="font-size:10px">실시간</span>'}</a>`).join('');
  main.innerHTML = `<div class="bar"><a href="#/" class="back">‹</a><h1>엔진 성적표</h1><span class="mut" style="font-size:12px">엔진이 한 말 → 실제로 맞았나</span></div>
    ${trackStrip(TR).replace('<a class="trk" href="#/track">', '<div class="trk">').replace(' · 자세히 ›', '').replace(/<\/a>$/, '</div>')}
    <section><header><span>읽는 법</span></header><div class="sent">
      <div>· <b class="ok">받침</b>: 엔진이 "여기서 튈 수 있다"고 한 가격에 5일 안에 왔을 때, 5일째 종가가 그 위면 <b class="ok">반응</b>, 2% 넘게 아래면 <b class="dn">이탈</b>.</div>
      <div>· 회색 세로선 = <b>아무 가격</b>(현재가 0.5~3% 아래 무작위)에 같은 규칙을 댄 결과. 받침 막대가 이 선보다 <b>오른쪽</b>이어야 엔진이 쓸모 있다는 뜻.</div>
      <div>· <b>재현</b> = 지난 날짜를 그날 데이터까지만 써서 다시 돌린 기록. <b class="ok">실시간</b> = ${S['기간']['실시간_시작'] || '오늘'}부터 매일 쌓이는 진짜 기록. 2주 뒤 실시간만으로 다시 판단.</div>
      <div class="mut">· 같은 받침이 며칠 연속 잡히면 여러 번 세어져서, 재현 구간 숫자는 실제보다 부풀 수 있음.</div>
    </div></section>
    <section><header><span>기록 ${TR.rows.length}건</span><small>최근 120건</small></header><div class="tkr-l">${rows}</div></section>`;
  bindTerms();
}
/* ------------------------------------------------------------ 종목 페이지 */
async function renderTicker(sym, ov = null) {
  setNav('desk'); if (!ov) main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  let [r, rows, J, A, AL, EV, FL, MT] = await Promise.all([NAMES_READY.then(() => j(`out/${sym}.json`)), loadCsv(sym), j('out/judgement.json'), j('out/attribution.json'), j('out/alerts.json'), j('events.json'), j('out/flows.json'), j('out/mtf.json')]);
  if (!r && !ov) {
    main.innerHTML = `<div class="bar"><a href="#/" class="back">‹</a><h1 class="lgrow">${logo(sym, nameOf(sym, J), 30)}${esc(nameOf(sym, J))}</h1></div><div class="mut" style="padding:20px">데이터 받아서 선 긋는 중… (1~2초)</div>`;
    const b = await lvBundle(sym);
    if (!b) { main.innerHTML = `<div class="bar"><a href="#/" class="back">‹</a><h1>${esc(nameOf(sym, J))}</h1></div><div class="mut" style="padding:20px">데이터를 못 받았어요. 종목 코드를 확인하거나 잠시 뒤 다시 시도해 주세요.</div>`; return; }
    return renderTicker(sym, b);
  }
  const batchR = r;
  if (ov) { r = ov.r; rows = ov.rows; if (ov.F) FL = { ...(FL || {}), [sym]: ov.F }; if (ov.M) MT = { ...(MT || {}), [sym]: ov.M }; }
  const jd = J?.[sym], a = A?.[sym], k = r.krw, c = r.close, f = v => fmtP(v, k);
  const chg = r.rsi_volume.chg_pct, rv = r.rsi_volume;
  const conf = r.confluence || [];
  const above = Object.values(r.ma).filter(v => c > v.value).length, nma = Object.keys(r.ma).length;
  const sup = r.levels.filter(l => l.price < c).sort((x, y) => y.price - x.price)[0];
  const res = r.levels.filter(l => l.price >= c).sort((x, y) => x.price - y.price)[0];
  const tl = r.trend_upper;
  const cb = conf.find(g => g.price < c), ca = conf.find(g => g.price >= c);
  const headline = jd?.status || (cb ? `★ 받침 ${f(cb.price)} 바로 위 — 튀어오를 수 있는 자리, 반등 확인 전` : ca ? `★ 천장 ${f(ca.price)} 바로 아래 — 막힐 수 있는 자리` : '기준선 사이 빈 공간');
  let board = '';
  if (jd?.rows?.length) {
    const nums = jd.rows.map(x => (x.cond.match(/[\d,.]+/g) || []).map(n => +n.replace(/,/g, '')));
    const top = nums[0]?.[0], stop = nums[nums.length - 1]?.[0];
    const short = a => a.split(/[·→—(]/)[0].trim();
    const zb = (top && stop && top > stop) ? zoneBar(stop, top, c, k, [short(jd.rows[jd.rows.length - 1].action), short(jd.rows[1]?.action || '관망'), short(jd.rows[0].action)]) : '';
    const rowsH = jd.rows.map(x => `<div class="jrow ${x.tone}"><span class="mono">${esc(x.cond)}</span><span>${esc(x.action)}</span></div>`).join('');
    const risk = jd.held ? `<div class="kv"><span>보유</span><b class="mono">${jd.qty}주 @ ${f(jd.avg)}</b><span>손익</span><b class="mono ${cls(jd.pnl_pct)}">${sgn(jd.pnl_pct)}</b>${jd.stop ? `<span>${term('손절')}</span><b class="mono">${f(jd.stop)}</b><span>여유</span><b class="mono ${jd.stop_room_pct < 1 ? 'warn' : ''}">${jd.stop_room_pct.toFixed(1)}%</b>` : ''}</div>` : '';
    const flags = (jd.flags || []).map(x => `<div class="flag">! ${esc(x)}</div>`).join('');
    const plan = (jd.plan || []).length ? `<div class="plan">${jd.plan.map(p => `<div class="plan-i ${/체결/.test(p.status) ? 'done' : ''}"><b class="mono">${p.n}차</b><span>${esc(p.cond)}</span><span class="mono">${esc(p.amount)}</span><span class="${/체결/.test(p.status) ? 'ok' : 'mut'}">${esc(p.status)}</span></div>`).join('')}</div>` : '';
    board = `<section><header><span>판단 보드 · 종가 기준</span>${chip(jd)}</header>${zb}<div class="jrows">${rowsH}</div>${risk}${flags}${plan}</section>`;
  }
  const attr = a ? `<section><header><span>왜 움직였나 · ${a.asof}</span><small>하루 ${sgn(a.ret1)} = 지수 + 업종 + 종목 고유</small></header>
    <div style="padding:12px 12px 4px">${contribBar(a)}</div>
    <div class="kv kv3">
      <span>지수</span><b class="mono ${cls(a.index?.contrib)}">${sgn(a.index?.contrib)}</b><span class="mut">${a.index ? `${nameOf(a.index.symbol)} ${sgn(a.index.ret1)}` : ''}</span>
      <span>업종</span><b class="mono ${cls(a.sector?.excess1)}">${sgn(a.sector?.excess1)}</b><span class="mut">${a.sector ? `${a.sector.name} 피어 ${sgn(a.sector.ret1)}` : ''}</span>
      <span>종목 고유</span><b class="mono ${cls(a.idio)}">${sgn(a.idio)}</b><span class="mut">${a.main_driver === '종목 고유' ? '뉴스·공시 확인' : ''}</span>
      <span>${term('거래량')}</span><b class="mono">${a.volume_ratio?.toFixed(1)}×</b><span class="mut">${esc(a.kind)}</span></div>
    <div class="sent"><div>주원인 <b class="w">${esc(a.main_driver)}</b> — ${esc(a.sentence.split('. ').slice(-1)[0])}</div></div></section>` : '';
  const sig = `<div class="sigs">
    <div class="sig"><div class="sig-k">위치</div><div class="sig-v">${term('이평')} <span class="dots">${Object.entries(r.ma).map(([n, v]) => `<i class="${c > v.value ? 'on' : ''}" title="${n.replace('sma', '')}일선"></i>`).join('')}</span> <b class="mono ${above === 0 ? 'dn' : above === nma ? 'up' : 'warn'}">${above}/${nma}</b> 위</div><div class="sig-d">${r.ma_arrangement || ''}${r.ma_crosses?.length ? ` · ${r.ma_crosses[r.ma_crosses.length - 1].pair} ${r.ma_crosses[r.ma_crosses.length - 1].type === 'golden' ? '골든' : '데드'}크로스` : ''}</div></div>
    <div class="sig"><div class="sig-k">아래 받침</div><div class="sig-v mono ok">${sup ? f(sup.price) : f(r.keys.recent_low10)}</div><div class="sig-d">${sup ? `${term('지지')} ${sup.touches}회 · ${sgn(pct(c, sup.price))} 위` : `최근 저가 · ${sgn(pct(c, r.keys.recent_low10))} 위`}</div></div>
    <div class="sig"><div class="sig-k">위 천장</div><div class="sig-v mono warn">${tl ? f(tl.value_today) : res ? f(res.price) : '—'}</div><div class="sig-d">${tl ? `${term('추세선')} · ${sgn(pct(tl.value_today, c))} 위 · 종가로 넘으면 전환 1차` : res ? `${term('저항')} ${res.touches}회` : ''}</div></div>
    <div class="sig"><div class="sig-k">체온</div><div class="sig-v"><span class="mono ${rv.rsi < 30 ? 'ok' : rv.rsi > 70 ? 'warn' : ''}">${term('RSI')} ${rv.rsi.toFixed(0)}</span> <span class="mono mut">· ${rv.vol_ratio.toFixed(1)}×</span></div><div class="sig-d">${rv.rsi < 30 ? '과매도 · ' : rv.rsi > 70 ? '과매수 · ' : ''}${rv.vol_ratio < 0.7 && chg < 0 ? '거래량 없이 하락(매수 부재)' : rv.vol_ratio > 1.8 && chg < -3 ? '거래량 동반 하락(투매)' : '거래량 보통'}${r.pattern?.type ? ` · ${term('쐐기', r.pattern.type)}${r.pattern.bars_to_apex ? ` ${r.pattern.bars_to_apex}봉` : ''}` : ''}</div></div>
  </div>`;
  main.innerHTML = `
    <div class="thead"><div class="bar"><a href="#/" class="back">‹</a><h1 class="lgrow">${logo(sym, nameOf(sym, J), 30)}${nameOf(sym, J)} <span class="mut mono" style="font-size:12px;font-weight:400">${esc(sym)}</span></h1>${jd ? `<span style="margin-left:auto">${chip(jd)}</span>` : ''}</div>
      <div class="bar"><span class="mono ${cls(chg)}" style="font-size:26px;font-weight:600" data-live-p="${esc(sym)}" data-k="${k ? 1 : 0}">${f(c)}</span><span class="mono ${cls(chg)}" style="font-size:14px" data-live-c="${esc(sym)}">${sgn(chg)}</span><span class="live" data-live-t="${esc(sym)}"></span><span class="mut mono" style="font-size:11px">판단 기준: ${r.asof} 종가</span></div></div>
    <div class="livewarn" data-live-stop="${esc(sym)}" data-stop="${jd?.held && jd.stop ? jd.stop : ''}" hidden></div>
    <div class="headline ${jd?.chip === 'exit' ? 'dn' : jd?.chip === 'warn' ? 'warn' : conf.length ? 'ok' : ''}">${esc(headline)}<small>${esc(PLAIN[jd?.chip] || (conf.length ? '유명한 선 여러 개가 겹치는 가격 근처예요. 한 번 튀어오를 수는 있지만 바닥이 확정된 건 아니에요.' : '가까운 기준선이 없어서 다음 기준선까지 미끄러질 수 있어요.'))}</small></div>
    <div class="pos"><div class="pos-k">지금 어디쯤? <span class="mut">← 받침 · 천장 → · 흰 막대 = 현재가</span></div>${levelBar(keyLevels(r, jd), c, k, sym)}</div>
    ${posPanel(sym, r, jd)}
    ${(() => { const items = [...((AL?.alerts || []).filter(x => x.symbol === sym).map(x => ({ t: x.text, lv: x.level, rule: x.rule }))), ...((jd?.watch_today || []).filter(x => !(x.startsWith('★') && (AL?.alerts || []).some(a => a.symbol === sym && a.rule.startsWith('합류')))).map(x => ({ t: x, lv: 'mut' })))];
      if (!items.length) return ''; const key = 'chk:' + sym + ':' + r.asof; let done = {}; try { done = JSON.parse(LS.get(key) || '{}'); } catch {}
      return `<section class="todo"><header><span>오늘 볼 것</span><small>종가 기준 · 체크는 내 기기에만 저장</small></header><div class="todo-list">${items.map((it, i) => `<label class="todo-i ${done[i] ? 'done' : ''}"><input type="checkbox" data-key="${key}" data-i="${i}" ${done[i] ? 'checked' : ''}><span class="box"></span>${it.rule ? `<span class="chip ${it.lv}">${esc(it.rule)}</span>` : '<span></span>'}<span>${esc(it.t)}</span></label>`).join('')}</div></section>`; })()}
    ${sig}
    ${bigPicture(MT?.[sym], r)}
    <div class="grid2">
      <section><header><span class="vt" id="chartTf" style="margin:0">${[["h", "1시간"], ["d", "일"], ["w", "주"], ["m", "월"]].map(([v, t]) => `<button data-tf="${v}" class="${(LS.get('chartTf') || 'd') === v ? 'on' : ''}">${t}</button>`).join('')}</span><span class="vt" id="chartMode" style="margin-left:auto">${[["key", "핵심 선만"], ["all", "선 8종 전부"]].map(([m, t]) => `<button data-m="${m}" class="${(LS.get('chartMode') || 'key') === m ? 'on' : ''}">${t}</button>`).join('')}</span></header><div id="chart"></div>
        <div class="clegend" id="clegend"></div></section>
      <section><header><span>선 사다리</span><small>차트 구간의 선 · 현재가 기준</small></header>${ladder(r, rows)}</section>
    </div>
    ${flowSection(FL?.[sym])}
    <div class="grid2b">${board}${attr}${eventsStrip(EV, J, sym)}</div>
    <section><header><span>★ ${term('합류')} · 반대 근거</span><small>유명한 선이 겹치는 자리</small></header><div class="sent">
      ${conf.length ? conf.map(g => `<div class="conf ${g.price < c ? '' : 'warn'}">★ ${g.price < c ? '받침' : '천장'} ${f(g.price)} (${sgn(pct(g.price, c))}) = ${esc(g.lines.join(' + '))}</div>`).join('') : '<div class="mut">현재가 ±2% 안에 겹치는 선 없음 — 다음 선까지 미끄러질 수 있음</div>'}
      <div class="counter">${esc(r.sentences.find(x => x.startsWith('반대 근거')) || '')}</div></div></section>
    <details class="more"><summary>자세한 해석 ${r.sentences.length}줄 · 정적 이미지</summary>
      <div class="sent">${r.sentences.map(s => `<div>· ${esc(s)}</div>`).join('')}</div>
      <img src="out/${encodeURIComponent(sym)}.png" style="width:100%;display:block;margin-top:8px" alt="배치가 만든 차트"></details>`;
  const UNIT = { h: '시간', d: '일', w: '주', m: '월' };
  const legendHTML = (all, tf) => {
    const u = UNIT[tf], it = (c, t, dash) => `<span><i ${dash ? `class="dash" style="border-color:${c}"` : `style="background:${c}"`}></i>${t}</span>`;
    const note = tf === 'h' ? '<span class="mut">· 선은 일봉 기준 (1시간봉 위에 겹쳐 그림)</span>' : tf !== 'd' ? `<span class="mut">· ${u}봉으로 다시 그은 선 · 마지막 봉은 진행 중</span>` : '';
    return (all ? [it(C.ma20, '20' + u), it(C.ma60, '60' + u), it(C.ma120, '120' + u), it(C.ma200, '200' + u), it(C.ok, term('지지'), 1), it(C.warn, term('저항') + '·' + term('추세선'), 1), it(C.tag, term('피보'), 1), it(C.ok, '★' + term('합류'))].join('')
      : [it(C.ma20, '20' + u + '선'), it(C.ok, '가까운 ' + term('지지'), 1), it(C.warn, '가까운 ' + term('저항') + '·' + term('추세선'), 1), it(C.ok, '★받침/천장'), ...(jd?.held ? [it(C.up, term('손절'), 1)] : [])].join('') + (tf === 'd' ? '<span class="mut">· 나머지 선은 "선 8종 전부"</span>' : '')) + note;
  };
  const TFD = { d: { rows, r } };
  if (ov?.w) TFD.w = ov.w; if (ov?.m) TFD.m = ov.m;
  const redraw = async () => {
    const all = (LS.get('chartMode') || 'key') === 'all', tf = LS.get('chartTf') || 'd';
    if (!TFD[tf]) {
      $('#chart').innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
      let rr = await loadCsv(`${sym}.${tf}`);
      let ra = tf === 'h' ? r : (await j(`out/${sym}.${tf}.json`));
      if ((!rr.length || !ra || tf === 'h') && QURL()) {  // 배치 파일 없거나 1시간봉(항상 최신) → 중계에서 바로
        const L = await lvChart(sym, tf);
        if (L?.rows.length) { rr = L.rows; if (tf !== 'h') { try { ra = Engine.analyze(engRows(rr), sym); } catch { } } }
      }
      TFD[tf] = { rows: rr, r: ra };
    }
    const D = TFD[tf]; const el = $('#chart'); el.innerHTML = '';
    if (!D.rows.length || !D.r) {
      const inWl = (await loadWatchlist()).includes(sym);
      el.innerHTML = `<div class="mut" style="padding:20px;line-height:1.6">${UNIT[tf]}봉 데이터가 아직 없어요.<br>${inWl ? '관심 종목이라 다음 배치(15:43 / 05:13) 때 자동으로 받아요.' : '관심 종목이 아니라서 자동 수집 대상이 아니에요. 데스크 검색창에서 이 종목을 다시 <b>분석</b>하면 주·월·1시간봉까지 같이 받아요.'}</div>`;
      $('#clegend').innerHTML = ''; delete TFD[tf]; return;
    }
    drawChart(D.rows, { ...D.r, close: tf === 'h' ? r.close : D.r.close }, all, jd, tf); $('#clegend').innerHTML = legendHTML(all, tf); bindTerms();
  };
  document.querySelectorAll('#chartTf button').forEach(b => b.onclick = () => { LS.set('chartTf', b.dataset.tf); document.querySelectorAll('#chartTf button').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
  redraw();
  document.querySelectorAll('#chartMode button').forEach(b => b.onclick = () => { LS.set('chartMode', b.dataset.m); document.querySelectorAll('#chartMode button').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
  bindTerms(); bindTodo(); bindPosPanel(sym);
  $('#foot').textContent = `${sym} · ${stamp()}`;
  loadWatchlist().then(wl => { if (!wl.includes(sym)) { const hd = $('.thead'); if (hd && !$('#addWrap')) hd.insertAdjacentHTML('beforeend', `<div id="addWrap" class="addw"><button class="btn" onclick="addToWatch('${esc(sym)}')">＋ 관심 종목에 추가</button><span class="mut" id="addMsg">추가하면 매일 판단·알림·성적표 대상이 돼요</span></div>`); } });
  if (ov) { const hd = $('.headline'); if (hd) hd.insertAdjacentHTML('afterbegin', `<span class="lvtag">${ov.open ? '장중' : '최신'} 데이터로 다시 계산 · ${ov.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${batchR ? ' · 판단 보드는 종가 기준' : ''}</span>`); }
  else lvRefresh(sym, r);
}

/* 기본은 '핵심 선만' — 선 30개 긋는 점액질 차트 금지(워뇨띠). 전부 보기는 토글로 */
function drawChart(rows, r, all = false, jd = null, tf = 'd') {
  const el = $('#chart'); if (!el || !window.LightweightCharts || !rows.length) return; const k = r.krw;
  const chart = LightweightCharts.createChart(el, {
    layout: { background: { color: C.bg }, textColor: C.mut, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 },
    grid: { vertLines: { color: C.line }, horzLines: { color: C.line } },
    rightPriceScale: { borderColor: C.line, scaleMargins: { top: 0.08, bottom: 0.22 } }, timeScale: { borderColor: C.line, rightOffset: 8, timeVisible: tf === 'h', secondsVisible: false },
    handleScroll: { vertTouchDrag: false }, handleScale: { axisPressedMouseMove: { time: true, price: false } }, // 모바일: 세로 드래그는 페이지 스크롤
    crosshair: { mode: 0 }, localization: { locale: 'ko-KR', priceFormatter: v => fmtP(v, k) },
  });
  const cs = chart.addCandlestickSeries({ upColor: C.up, downColor: C.dn, borderVisible: false, wickUpColor: C.up, wickDownColor: C.dn });
  cs.setData(rows);
  const vs = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  vs.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vs.setData(rows.map(x => ({ time: x.time, value: x.volume, color: (x.close >= x.open ? C.up : C.dn) + '66' })));
  (all ? [[20, C.ma20], [60, C.ma60], [120, C.ma120], [200, C.ma200]] : [[20, C.ma20]]).forEach(([w, col]) => {
    if (rows.length >= w) chart.addLineSeries({ color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(sma(rows, w));
  });
  const pl = (price, color, title, style, label = true) => cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: label, title: label ? title : '' });
  const c = r.close;
  const sup = r.levels.filter(l => l.price < c).sort((x, y) => y.price - x.price)[0];
  const res = r.levels.filter(l => l.price >= c).sort((x, y) => x.price - y.price)[0];
  const conf = r.confluence || [];
  const nearConf = p => conf.some(g => Math.abs(g.price / p - 1) < 0.01);
  if (all) {
    r.levels.forEach(l => pl(l.price, l.price < c ? C.ok : C.warn, l.price < c ? '지지' : '저항', 2, l === sup || l === res));
    Object.entries(r.fib.levels).forEach(([n, v]) => pl(v, C.tag, '', 3, false));
    pl(r.keys.w52_low, C.dn, '52주저', 4, !nearConf(r.keys.w52_low));
  } else {
    // 핵심: 가장 가까운 지지·저항 1개씩 (합류와 겹치면 생략)
    if (sup && !nearConf(sup.price)) pl(sup.price, C.ok, '지지', 2, true);
    if (res && !nearConf(res.price)) pl(res.price, C.warn, '저항', 2, true);
  }
  conf.forEach(g => pl(g.price, g.price < c ? C.ok : C.warn, g.price < c ? '★받침' : '★천장', 0, true));
  if (jd?.held && jd.stop) pl(jd.stop, C.up, '손절', 1, true);
  const idx = Object.fromEntries(rows.map((x, i) => [x.time, i]));
  const tl = (t, color, title) => {
    if (!t || idx[t.from] === undefined) return;
    const i0 = idx[t.from], n = rows.length, y0 = t.value_today - t.slope_per_bar * (n - 1 - i0);
    const pts = []; for (let i = i0; i < n; i++) pts.push({ time: rows[i].time, value: y0 + t.slope_per_bar * (i - i0) });
    chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: !!title, crosshairMarkerVisible: false, title }).setData(pts);
  };
  tl(r.trend_upper, C.warn, '추세'); if (all) tl(r.trend_lower, C.warn, '');
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, rows.length - ({ h: 120, d: 80, w: 104, m: 120 }[tf] || 80)), to: rows.length + 6 });
  new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })).observe(el);
}

/* ------------------------------------------------------------ 설정 */
async function renderSettings() {
  setNav('settings');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const ios = /iphone|ipad/i.test(navigator.userAgent); const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const [al, J] = await Promise.all([j('out/alerts.json'), j('out/judgement.json')]);
  main.innerHTML = `
    <div class="bar"><h1>알림 · 설정</h1></div>
    <section><header><span>오늘 알림 ${(al?.alerts || []).length}</span><small>규칙당 하루 1회 · 서버 푸시는 설정 후</small></header><div class="al-list">${(al?.alerts || []).length ? al.alerts.map(x => `<a class="al" href="#/t/${encodeURIComponent(x.symbol)}"><span class="chip ${x.level}">${esc(x.rule)}</span><b class="w lgrow">${logo(x.symbol, nameOf(x.symbol, J), 18)}${nameOf(x.symbol, J)}</b><span class="dim">${esc(x.text)}</span></a>`).join('') : '<div class="sent"><div class="mut">알림 없음</div></div>'}</div></section>
    <section><header><span>앱 알림 (웹 푸시)</span></header><div class="sent">
      <div>· 브라우저 지원: <b class="${supported ? 'ok' : 'dn'}">${supported ? '됨' : '안 됨'}</b> · 권한: <b>${perm}</b></div>
      ${ios && !standalone ? '<div class="warn">· 아이폰은 공유 → "홈 화면에 추가" 후 그 아이콘으로 열어야 알림이 옵니다.</div>' : ''}
      <div style="text-indent:0;padding-left:0"><button class="btn pri" id="btnNotif">알림 켜기</button> <span class="mut" id="notifMsg"></span></div><div id="subBox" hidden style="text-indent:0;padding-left:0;margin-top:8px"><textarea id="subTxt" readonly rows="3" style="width:100%;box-sizing:border-box;font:11px var(--mono,monospace);background:var(--nav);color:var(--txt);border:1px solid var(--ctl);border-radius:4px;padding:6px"></textarea><button class="btn" id="btnCopy" style="margin-top:6px">구독 코드 복사</button> <span class="mut" style="font-size:11px">→ Claude에게 붙여넣기 (또는 저장소 push_subs.json 에 추가)</span></div></div></section>
    <section><header><span>종목 찾기 원탭 실행</span><small>선택 · 이 기기에만 저장</small></header><div class="sent">
      <div>· GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → Repository: investool만 → Permissions: <b>Actions: Read and write</b> → 만든 토큰을 아래에 붙여넣기.</div>
      <div style="text-indent:0;padding-left:0;display:flex;gap:6px;margin-top:6px"><input id="ghTok" type="password" placeholder="github_pat_…" value="${LS.get('ghToken') ? '••••••••' : ''}" style="flex:1;min-width:0;font:12px var(--mono,monospace);background:var(--nav);color:var(--txt);border:1px solid var(--ctl);border-radius:4px;padding:6px"><button class="btn" id="ghSave">저장</button></div>
      <div class="mut" id="ghMsg">${LS.get('ghToken') ? '저장됨 — 데스크 검색창에서 바로 분석 실행' : '없으면 검색 시 GitHub 실행 페이지로 안내'}</div></div></section>
    <section><header><span>화면</span><small>다크가 기본 · 밝은 곳에선 라이트</small></header><div class="sent"><div style="text-indent:0;padding-left:0"><span class="vt" style="margin:0" id="themeSel">${['dark', 'light', 'system'].map(t => `<button data-t="${t}" class="${(LS.get('theme') || 'dark') === t ? 'on' : ''}">${{ dark: '다크', light: '라이트', system: '기기 설정' }[t]}</button>`).join('')}</span></div></div></section>
    <section><header><span>데이터 상태</span><small>종목별 마지막 종가일</small></header><div class="sent">${Object.values(J || {}).map(x => { const d = x.asof ? Math.round((Date.now() - new Date(x.asof)) / 864e5) : null; return `<div><b class="w">${esc(x.name || x.symbol)}</b> <span class="mono ${d > 4 ? 'warn' : 'mut'}">${x.asof || '—'}${d != null ? ` (${d}일 전)` : ''}</span></div>`; }).join('') || '<div class="mut">—</div>'}<div class="mut">야후 파이낸스 일봉 · 15분 지연 · 장중 봉은 제외 · 국내 봉은 야후 반영이 반나절 늦을 때가 있음</div></div></section>
    <section><header><span>관심 종목</span><small>watchlist.txt</small></header><div class="sent"><div>· 저장소의 <span class="mono">watchlist.txt</span>에 야후 심볼 한 줄 추가 → 다음 배치부터 (코스피 .KS / 코스닥 .KQ)</div></div></section>
    <section><header><span>용어</span><small>탭하면 설명</small></header><div class="gl">${Object.keys(G).map(k => `<div class="gl-i">${GI[k] || ''}<div><b>${term(k)}</b><div class="mut">${esc(G[k])}</div></div></div>`).join('')}</div></section>`;
  document.querySelectorAll('#themeSel button').forEach(b => b.onclick = () => { setTheme(b.dataset.t); document.querySelectorAll('#themeSel button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#btnNotif').onclick = async () => {
    const m = $('#notifMsg'); const cfg = window.INVESTOOL_CONFIG || {};
    if (!supported) { m.textContent = '이 브라우저는 푸시를 지원하지 않아요.'; return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { m.textContent = '권한이 거부됐어요.'; return; }
    const reg = await navigator.serviceWorker.ready;
    if (!cfg.VAPID_PUBLIC_KEY) { m.textContent = 'config.js 에 VAPID 공개키가 없어요.'; return; }
    try {
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.VAPID_PUBLIC_KEY) });
      const js = JSON.stringify(sub.toJSON());
      if (cfg.SUPABASE_URL) {
        const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/push_subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ endpoint: sub.endpoint, sub: sub.toJSON() }) });
        m.textContent = res.ok ? '구독 완료 — 다음 배치부터 알림이 와요.' : `구독 저장 실패 (${res.status})`;
      } else {
        // DB 없는 1인용: 이 기기의 구독 정보를 복사 → push_subs.json 에 추가 (Claude에게 붙여넣어도 됨)
        $('#subBox').hidden = false; $('#subTxt').value = js;
        m.textContent = '이 기기 구독 완료. 아래 코드를 복사해서 등록하면 끝.';
      }
      reg.showNotification('investool', { body: '알림 테스트 — 이 기기에서 알림이 보이면 OK', icon: 'icons/icon-192.png' });
    } catch (e) { m.textContent = '구독 실패: ' + e.message; }
  };
  $('#ghSave').onclick = () => { const v = $('#ghTok').value.trim(); if (v && !v.startsWith('••')) { LS.set('ghToken', v); $('#ghMsg').textContent = '저장됨 — 데스크 검색창에서 바로 분석 실행'; } else if (!v) { LS.set('ghToken', ''); $('#ghMsg').textContent = '지웠어요'; } };
  $('#btnCopy').onclick = async () => { const t = $('#subTxt'); try { await navigator.clipboard.writeText(t.value); $('#btnCopy').textContent = '복사됨 ✓'; } catch { t.select(); document.execCommand('copy'); $('#btnCopy').textContent = '복사됨 ✓'; } };
  bindTerms();
}
async function renderScreener() {
  setNav('screener'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  const [SC, J] = await Promise.all([j('out/screener.json'), j('out/judgement.json')]);
  const head = `<div class="bar"><h1>스크리너</h1><span class="mut" style="font-size:12px">이름은 다 아는데, 번 돈에 비해 덜 오른 종목</span></div>
    <section class="axes"><div class="ax"><b>① 잡주 컷</b><span>시총 3천억↑ · 하루 30억↑ 거래</span></div><div class="ax"><b>② 싸다</b><span>PER 업종보다 낮음 (가장 먼저)</span></div><div class="ax"><b>③ 실적 신고점</b><span>주가 말고 매출·영업이익이 최고치</span></div><div class="ax"><b>④ 미반영</b><span>이익 증가 &gt; 1년 주가 상승 (필수)</span></div><div class="ax hl"><b>★ 깨어남</b><span>외국인+기관 사기 시작 = 타이밍</span></div></section>`;
  if (!SC?.rows?.length) { main.innerHTML = head + '<div class="mut" style="padding:12px">첫 스크린은 토요일 아침 자동 실행 (또는 GitHub Actions → screener → Run workflow)</div>'; return; }
  const pctTxt = x => x == null ? '—' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
  const W = x => Math.min(100, Math.abs(x || 0) * 100);  // 100% = 막대 끝
  const row = (r, i) => {
    const g = r.growth, p = r.ret1y;
    const twin = `<div class="tw"><div class="tw-r"><span class="tw-k">이익</span><div class="tw-t"><div class="tw-f ok" style="width:${W(g)}%"></div></div><b class="mono ok">${pctTxt(g)}</b></div>
      <div class="tw-r"><span class="tw-k">주가 1년</span><div class="tw-t"><div class="tw-f ${p >= 0 ? 'upbg' : 'dnbg'}" style="width:${W(p)}%"></div></div><b class="mono ${p >= 0 ? 'up' : 'dn'}">${pctTxt(p)}</b></div></div>`;
    const parts = Object.entries(r.parts).map(([k, v]) => `<span class="pt" title="${k} ${v}"><i style="height:${Math.max(2, Math.round(v * 0.3))}px"></i><em>${k}</em></span>`).join('');
    const analyzed = J?.[r.symbol];
    return `<a class="sc2 ${r.awake ? 'awake' : ''}" href="#/t/${encodeURIComponent(r.symbol)}">
      <div class="sc2-h"><span class="sc2-rk mono">${i + 1}</span><div class="lgrow" style="align-items:flex-start">${logo(r.symbol, r.name, 34)}<div><b class="w">${esc(r.name)}</b>${r.awake ? ' <span class="chip ok" style="font-size:10px">★ 깨어남</span>' : ''}${analyzed ? ' <span class="chip" style="font-size:10px;color:var(--tag)">관심</span>' : ''}${(r.gov_flags || []).length ? ` <span class="chip warn" style="font-size:10px">⚠ ${esc(r.gov_flags[0])}</span>` : ''}<div class="mut mono" style="font-size:11px">${r.market === 'KOSPI' ? '코스피' : '코스닥'} · 시총 ${r.cap >= 10000 ? (r.cap / 10000).toFixed(1) + '조' : Math.round(r.cap).toLocaleString() + '억'} · PER ${r.per?.toFixed(1)}${r.ind_per ? ` <span class="mut">(업종 ${r.ind_per.toFixed(1)})</span>` : ''}</div></div></div><div class="sc2-sc"><b class="mono">${Math.round(r.score)}</b><small>점</small></div></div>
      <div class="sc2-b">${twin}<div class="pts">${parts}</div></div>
      <div class="sc2-w">${r.why.slice(1).map(x => `<span>${esc(x)}</span>`).join('')}</div></a>`;
  };
  let F = { cap: 'all', mkt: 'all', gov: 1, awake: 0, sort: 'score' };
  try { F = { ...F, ...JSON.parse(LS.get('scrF') || '{}') }; } catch { }
  const CAPS = [['all', '전체'], ['s', '3천억~1조'], ['m', '1~5조'], ['l', '5조↑']], MK = [['all', '전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']];
  const SORTS = [['score', '종합'], ['gap', '미반영'], ['val', '싸다'], ['flow', '수급(20일)']];
  const seg = (key, opts) => `<span class="vt" data-k="${key}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(F[key]) === v ? 'on' : ''}">${t}</button>`).join('')}</span>`;
  const tog = (key, t) => `<label class="tg"><input type="checkbox" data-t="${key}" ${F[key] ? 'checked' : ''}> ${t}</label>`;
  main.innerHTML = head + `<div class="flt">
      <div class="flt-r"><span class="flt-k">시총</span>${seg('cap', CAPS)}</div>
      <div class="flt-r"><span class="flt-k">시장</span>${seg('mkt', MK)}<span class="flt-k" style="margin-left:8px">정렬</span>${seg('sort', SORTS)}</div>
      <div class="flt-r">${tog('gov', '지배구조 주의 빼기 (지주사·자회사 몫 30%↑·분할 남발·상장 자회사 2개↑·감사의견)')}${tog('awake', '★ 깨어남만')}</div>
    </div>
    <div class="mut mono" id="scrN" style="font-size:11px"></div>
    <div class="sc2-l" id="scrL"></div>
    <section><header><span>읽는 법</span></header><div class="sent"><div>· <b class="ok">이익</b> 막대가 길고 <b>주가</b> 막대가 짧을수록 "번 만큼 안 오른" 종목.</div><div>· 오른쪽 작은 기둥 4개 = 점수 구성(싸다 30 · 신고점 25 · 미반영 25 · 성장 20).</div><div>· <b class="ok">★ 깨어남</b> = 최근 20일·5일 모두 외국인+기관 순매수. ★ 상위 7개(지배구조 주의 제외, 시총 5천억↑)는 매주 관심 종목에 자동으로 들어가요.</div><div>· <b class="warn">⚠ 지배구조</b> = 이름·업종상 지주사이거나, 최근 4분기 연결 순이익 중 <b>비지배지분(자회사의 다른 주주 몫)</b>이 30% 이상. 상장 자회사가 많을수록 커져서 지주사·중복상장 할인의 신호예요.</div><div>· 기준 출처: 워뇨띠 Q&A — "저평가를 먼저, 그다음 차트" · "매출·영업이익이 신고점을 돌파하는 종목" · "몇 년 안에 주목받을 애들" · "지분구조 난해·분할상장 남발·실적 조작이 아니면".</div><div>· DART(금융감독원) 확인: 최근 3년 회사분할 결정 2번↑ = 남발 ⚠ · 1번 = 참고 표시 · 상장 자회사 2개↑ ⚠ · 감사의견 비적정 ⚠ · 최대주주+특수관계인 지분은 참고로 표시.</div><div class="mut">· 매수 추천이 아니라 볼 종목 목록이에요.</div></div></section>`;
  SC.rows.forEach(r => { if (r.symbol && !NAMES[r.symbol]) NAMES[r.symbol] = r.name; });
  const draw = () => {
    LS.set('scrF', JSON.stringify(F));
    let L = SC.rows.filter(r => (F.cap === 'all' || (F.cap === 's' ? r.cap < 10000 : F.cap === 'm' ? r.cap >= 10000 && r.cap < 50000 : r.cap >= 50000))
      && (F.mkt === 'all' || r.market === F.mkt) && (!F.gov || !(r.gov_flags || []).length) && (!F.awake || r.awake));
    const key = { score: r => r.score, gap: r => r.parts['미반영'], val: r => r.parts['싸다'], flow: r => r.flow20 }[F.sort];
    L = [...L].sort((a, b) => key(b) - key(a));
    $('#scrN').textContent = `${SC.asof} · 시총 3천억↑ ${SC.universe}종목 → 관문 통과 ${SC.passed} → 필터 후 ${L.length}` + (SC.dropped ? ` · 탈락: ${Object.entries(SC.dropped).map(([k, v]) => k + ' ' + v).join(' · ')}` : '');
    $('#scrL').innerHTML = L.length ? L.slice(0, 60).map(row).join('') : '<div class="mut" style="padding:12px">조건에 맞는 종목이 없어요. 필터를 풀어보세요.</div>';
  };
  document.querySelectorAll('.flt .vt').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { F[g.dataset.k] = b.dataset.v; g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  document.querySelectorAll('.flt input[data-t]').forEach(c => c.onchange = () => { F[c.dataset.t] = c.checked ? 1 : 0; draw(); });
  draw();
}
async function renderJournal() {
  setNav('journal'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  const [J, T0] = await Promise.all([j('out/judgement.json'), t('trades.json').then(x => { try { return JSON.parse(x); } catch { return []; } })]);
  const T = [...(T0 || [])].filter(x => x.side === 'buy' || x.side === 'sell');
  const held = Object.values(J || {}).filter(x => x.held);
  const isKrw = s => /\.(KS|KQ)$/.test(s);
  const money = (v, krw) => v == null ? '—' : (v >= 0 ? '+' : '−') + (krw ? Math.abs(Math.round(v)).toLocaleString() + '원' : '$' + Math.abs(v).toFixed(2));
  const sells = T.filter(x => x.side === 'sell');
  const realK = sells.filter(x => isKrw(x.symbol)).reduce((a, x) => a + (x.realized || 0), 0), realU = sells.filter(x => !isKrw(x.symbol)).reduce((a, x) => a + (x.realized || 0), 0);
  const wins = sells.filter(x => (x.realized || 0) > 0).length, rs = sells.filter(x => x.r != null).map(x => x.r);
  // 규칙 채점: 손절선 지정(매수) · 늦은 손절(매도) · 평단 아래 추가 매수(물타기 의심)
  const buys = T.filter(x => x.side === 'buy');
  const water = buys.filter(x => x.avg_before && x.price < x.avg_before);
  const late = sells.filter(x => x.rule === 'late_stop');
  const score = Math.max(0, 100 - late.length * 20 - water.length * 15);
  // 달력: 이번 달
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const ym = `${y}-${String(mo + 1).padStart(2, '0')}`;
  const byDay = {}; T.filter(x => x.date.startsWith(ym)).forEach(x => { const d = +x.date.slice(8); (byDay[d] = byDay[d] || []).push(x); });
  const cal = ['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="cal-h">${d}</div>`).join('') + Array.from({ length: first }, () => '<div></div>').join('') +
    Array.from({ length: days }, (_, i) => { const d = i + 1, L = byDay[d] || [], r = L.filter(x => x.side === 'sell').reduce((a, x) => a + (x.realized || 0), 0), hasB = L.some(x => x.side === 'buy');
      return `<div class="cal-d ${r > 0 ? 'win' : r < 0 ? 'loss' : ''} ${d === now.getDate() ? 'today' : ''}"><span>${d}</span>${hasB ? '<i class="b"></i>' : ''}${r ? `<em class="mono">${r > 0 ? '+' : '−'}${Math.abs(r) >= 1e4 ? (Math.abs(r) / 1e4).toFixed(0) + '만' : Math.abs(Math.round(r))}</em>` : ''}</div>`; }).join('');
  const ruleChip = x => x.side === 'buy' ? (x.avg_before && x.price < x.avg_before ? '<span class="chip warn" style="font-size:10px">평단 아래 추가</span>' : '<span class="chip ok" style="font-size:10px">손절선 지정</span>')
    : x.rule === 'late_stop' ? '<span class="chip dn" style="font-size:10px">늦은 손절</span>' : x.rule === 'stop' ? '<span class="chip ok" style="font-size:10px">손절 지킴</span>' : '';
  const rows = [...T].reverse().map(x => `<a class="jr" href="#/t/${encodeURIComponent(x.symbol)}"><span class="mono mut">${x.date.slice(5)}</span><span class="lgrow">${logo(x.symbol, x.name, 22)}<b class="w">${esc(nameOf(x.symbol) !== x.symbol ? nameOf(x.symbol) : x.name)}</b></span>
      <span class="chip ${x.side === 'buy' ? 'up' : 'dn'}" style="font-size:10px">${x.side === 'buy' ? '매수' : '매도'}</span><span class="mono">${x.qty}주 @ ${fmtP(x.price, isKrw(x.symbol))}</span>
      <span class="mono ${x.realized > 0 ? 'up' : x.realized < 0 ? 'dn' : 'mut'}">${x.side === 'sell' ? money(x.realized, isKrw(x.symbol)) + (x.r != null ? ` · ${x.r > 0 ? '+' : ''}${x.r}R` : '') : x.stop ? `손절 ${fmtP(x.stop, isKrw(x.symbol))}` : ''}</span>${ruleChip(x)}${x.memo ? `<span class="jr-m">${esc(x.memo)}</span>` : ''}</a>`).join('');
  main.innerHTML = `<div class="bar"><h1>일지</h1><span class="mut" style="font-size:12px">종목 페이지 '내 포지션'에서 매수·매도를 기록하면 여기 쌓여요</span></div>
    <div class="jk">
      <div><span>실현 손익</span><b class="mono ${realK >= 0 ? 'up' : 'dn'}">${sells.some(x => isKrw(x.symbol)) ? money(realK, true) : '—'}</b>${sells.some(x => !isKrw(x.symbol)) ? `<small class="mono ${realU >= 0 ? 'up' : 'dn'}">${money(realU, false)}</small>` : ''}</div>
      <div><span>승률</span><b class="mono">${sells.length ? Math.round(wins / sells.length * 100) + '%' : '—'}</b><small class="mut">${sells.length}번 매도</small></div>
      <div><span>평균 R</span><b class="mono ${(rs.reduce((a, b) => a + b, 0) / (rs.length || 1)) >= 0 ? 'up' : 'dn'}">${rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(2) + 'R' : '—'}</b><small class="mut">1R = 손절까지 거리</small></div>
      <div><span>규칙 점수</span><b class="mono ${score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'dn'}">${score}</b><small class="mut">늦은 손절 ${late.length} · 평단 아래 추가 ${water.length}</small></div>
    </div>
    <section><header><span>지금 보유</span><small>판단 보드 기준 (종가)</small></header>${held.length ? held.map(x => `<a class="jr" href="#/t/${encodeURIComponent(x.symbol)}"><span class="lgrow">${logo(x.symbol, x.name, 22)}<b class="w">${esc(x.name)}</b></span>${chip(x)}<span class="mono">${x.qty}주 @ ${fmtP(x.avg, x.krw)}</span><span class="mono ${cls(x.pnl_pct)}">${sgn(x.pnl_pct)}</span><span class="mono mut">손절 ${x.stop ? fmtP(x.stop, x.krw) + ` (${x.stop_room_pct?.toFixed(1)}%)` : '없음'}</span></a>`).join('') : '<div class="sent"><div class="mut">보유 종목 없음</div></div>'}</section>
    <section><header><span>${y}년 ${mo + 1}월</span><small>빨강 = 이익 매도 · 파랑 = 손실 매도 · 점 = 매수</small></header><div class="cal">${cal}</div></section>
    <section><header><span>매매 기록 ${T.length}</span><small>최근 순</small></header><div class="jr-l">${rows || '<div class="sent"><div class="mut">아직 기록이 없어요</div></div>'}</div></section>
    <section><header><span>채점 기준</span></header><div class="sent"><div>· <b>손절선 지정</b>: 매수할 때 손절선이 없으면 저장이 안 돼요 (규칙: 손절선 없이 매수 없음).</div><div>· <b class="dn">늦은 손절</b>: 손절선보다 1% 넘게 아래에서 판 경우 −20점.</div><div>· <b class="warn">평단 아래 추가</b>: 평단보다 낮은 가격에 더 산 경우 −15점. 반등 확인 후였다면 메모에 근거를 남겨두세요.</div><div>· <b>R</b> = (판 가격 − 평단) ÷ (평단 − 손절선). +2R = 감수한 위험의 2배를 벌었다는 뜻.</div></div></section>`;
}
/* ------------------------------------------------------------ 공통 */
function b64ToU8(b) { const p = '='.repeat((4 - b.length % 4) % 4); const s = (b + p).replace(/-/g, '+').replace(/_/g, '/'); const r = atob(s); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); }
function bindTodo() {
  document.querySelectorAll('.todo-i input').forEach(cb => cb.onchange = () => {
    const key = cb.dataset.key; let d = {}; try { d = JSON.parse(LS.get(key) || '{}'); } catch {}
    d[cb.dataset.i] = cb.checked; try { LS.set(key, JSON.stringify(d)); } catch {}
    cb.closest('.todo-i').classList.toggle('done', cb.checked);
  });
}
function bindTerms() {
  document.querySelectorAll('.term').forEach(el => el.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    let tip = $('#tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); tip.onclick = () => tip.classList.remove('on'); }
    tip.innerHTML = `<b>${esc(el.dataset.g)}</b>${GI[el.dataset.g] || ''}<div>${esc(G[el.dataset.g] || '')}</div><div class="mut" style="margin-top:6px;font-size:11px">탭해서 닫기</div>`; tip.classList.add('on');
  });
}
function setNav(name) { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name)); }
function stamp() { return new Date().toLocaleString('ko-KR', { hour12: false }); }
function route() {
  const h = location.hash || '#/'; const m = h.match(/^#\/t\/(.+)$/);
  window.scrollTo(0, 0); clearInterval(liveTimer); liveTimer = null;
  setTimeout(function waitLive(n = 0) { if (document.querySelector('[data-live-p]')) liveStart(); else if (n < 20) setTimeout(() => waitLive(n + 1), 300); }, 300);
  if (m) return renderTicker(decodeURIComponent(m[1]));
  if (h === '#/screener') return renderScreener();
  if (h === '#/journal') return renderJournal();
  if (h === '#/settings') return renderSettings();
  if (h === '#/track') return renderTrack();
  return renderDesk();
}
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  // 새 버전 앱이 설치되면 한 번만 자동 새로고침 (예전 화면이 남지 않게)
  const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
  // 뒤에서 새 데이터가 도착하면 조용히 다시 그림 (스크롤 위치 유지)
  let pend = null;
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'updated') return;
    clearTimeout(pend); pend = setTimeout(() => {
      Object.keys(cache).forEach(k => delete cache[k]);
      const y = window.scrollY; const h = location.hash;
      Promise.resolve(route()).then(() => { if (location.hash === h) window.scrollTo(0, y); });
    }, 600);
  });
}
