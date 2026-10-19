/* investool PWA v2 — 시각 우선. out/*.json + data/*.csv 만 읽는다 (서버 없음) */
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const C = { up: '#F25C5C', dn: '#4F9CF9', warn: '#F5A623', ok: '#3FBF7F', tag: '#B8A6FF', mut: '#8A8A8A', line: '#2A2A2A', txt: '#DCDDDE', ma20: '#7C9CFF', ma60: '#E8891D', ma120: '#B8A6FF', ma200: '#FFFFFF' };
C.sma20 = C.ma20; C.sma60 = C.ma60; C.sma120 = C.ma120; C.sma200 = C.ma200;

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
const PLAIN = { exit: '미리 정한 손절선 아래에서 하루를 마감했어요. 규칙대로면 파는 날이에요 — 장중 흔들림 말고 종가로만 판단해요.', warn: '손절선 바로 위예요. 오늘 밤 종가가 손절선 아래면 규칙대로 정리, 위면 그대로 보유.', hold: '손절선까지 여유가 있어요. 추가 매수는 반등을 확인한 뒤에만.', target: '1차 목표에 닿았어요. 일부 팔거나 다음 차수를 검토할 때.', enter: '미리 정한 진입 조건을 종가로 만족했어요. 첫 매수는 계획 금액의 1/3만.', wait: '아직 진입 조건이 안 됐어요. 기다리는 게 일이에요.' };
const term = (t, label = t) => `<span class="term" data-g="${t}">${label}</span>`;

/* ------------------------------------------------------------ 데이터 */
const cache = {};
async function j(url) { if (url in cache) return cache[url]; try { const res = await fetch(url, { cache: 'no-store' }); cache[url] = res.ok ? await res.json() : null; } catch { cache[url] = null; } return cache[url]; }
async function t(url) { try { const res = await fetch(url, { cache: 'no-store' }); return res.ok ? await res.text() : ''; } catch { return ''; } }
async function loadWatchlist() { return (await t('watchlist.txt')).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')); }
async function loadCsv(sym) {
  const txt = await t(`data/${sym}.csv`); if (!txt) return [];
  return txt.trim().split('\n').slice(1).map(l => { const [d, o, h, lo, c, v] = l.split(','); return { time: d, open: +o, high: +h, low: +lo, close: +c, volume: +v }; });
}
const sma = (rows, w) => rows.map((r, i) => i < w - 1 ? null : { time: r.time, value: rows.slice(i - w + 1, i + 1).reduce((a, b) => a + b.close, 0) / w }).filter(Boolean);
const NAMES = { 'INFQ': '인플렉션', '005930.KS': '삼성전자', '000660.KS': 'SK하이닉스', '013030.KQ': '하이록코리아', '054950.KQ': '제이브이엠', '236200.KQ': '슈프리마', '036800.KQ': '나이스정보통신', '200670.KQ': '휴메딕스', '015230.KS': '대창단조', '044960.KQ': '이글벳', '^KS11': '코스피', '^KQ11': '코스닥', '^GSPC': 'S&P 500', '^VIX': 'VIX', 'SOXX': '반도체 ETF', 'IONQ': '아이온큐', 'RGTI': '리게티', 'QBTS': '디웨이브' };
const nameOf = (s, J) => (J && J[s] && J[s].name) || NAMES[s] || s;

/* ------------------------------------------------------------ 시각 컴포넌트 */
function sparkline(vals, color, w = 90, h = 28) {
  if (!vals || vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / rg * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;max-width:${w}px;height:${h}px;display:block" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/></svg>`;
}
/* 가로 레벨 바: 손절/지지 ← 현재 → 추세선/목표 */
function levelBar(items, close, krw) {
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
  return `<div class="lb"><div class="lb-track"></div>${marks}<div class="lb-now" style="left:${x(close).toFixed(1)}%"><i></i></div></div>`;
}
/* 3구간 바 (판단 보드) */
function zoneBar(stop, top, close, krw) {
  const lo = Math.min(stop, close) * 0.97, hi = Math.max(top, close) * 1.03;
  const x = p => ((p - lo) / (hi - lo) * 100);
  const seg = (cl, l, w, txt) => `<div class="zb-seg ${cl}" style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%">${w > 14 ? `<span>${txt}</span>` : ''}</div>`;
  return `<div class="zb">
    ${seg('dn', 0, x(stop), '정리')}${seg('warn', x(stop), x(top) - x(stop), '보유 · 추가 매수 금지')}${seg('up', x(top), 100 - x(top), '돌파 → 다음 차수')}
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
  L.push({ n: '현재가', p: c, col: '#FFFFFF', t: '', now: true });
  const sorted = L.filter(l => l.p >= lo0 && l.p <= hi0).sort((a, b) => b.p - a.p);
  const merged = []; sorted.forEach(l => { const m = merged[merged.length - 1]; if (m && !m.now && !l.now && Math.abs(m.p / l.p - 1) < 0.006) { m.n += ' · ' + l.n; } else merged.push({ ...l }); });
  const H = Math.max(360, merged.length * 28 + 60);
  const hi = hi0 * 1.01, lo = lo0 * 0.99;
  const y = p => (hi - p) / (hi - lo) * H;
  let lastY = -100; const placed = merged.map(l => { let yy = y(l.p); if (yy - lastY < 24) yy = lastY + 24; lastY = yy; return { ...l, yy, y0: y(l.p) }; });
  const Hfin = Math.max(H, lastY + 30);
  const rowsH = placed.map(l => {
    const isConf = conf.some(cp => Math.abs(cp / l.p - 1) < 0.012);
    const d = pct(l.p, c);
    if (l.now) return `<div class="ld-row now" style="top:${l.yy.toFixed(1)}px"><span class="ld-dot" style="transform:translateY(${(l.y0 - l.yy).toFixed(1)}px)"></span><span class="ld-n">현재가</span><span class="ld-p mono">${fmtP(l.p, k)}</span><span class="ld-d mono"></span></div>`;
    return `<div class="ld-row ${isConf ? 'conf' : ''} ${d >= 0 ? 'above' : 'below'}" style="top:${l.yy.toFixed(1)}px;--c:${l.col}"><span class="ld-dot" style="transform:translateY(${(l.y0 - l.yy).toFixed(1)}px)"></span><span class="ld-n">${term(l.t, l.n)}</span><span class="ld-p mono">${fmtP(l.p, k)}</span><span class="ld-d mono ${cls(d)}">${sgn(d)}</span></div>`;
  }).join('');
  return `<div class="ladder" style="height:${Hfin}px"><div class="ld-axis"></div>${rowsH}<div class="ld-now" style="top:${y(c).toFixed(1)}px"></div></div>`;
}
/* 기여도 바 */
function contribBar(a) {
  const parts = [['지수', a.index ? a.index.contrib : 0, '#7C9CFF'], ['업종', a.sector ? a.sector.excess1 : 0, C.tag], ['종목 고유', a.idio, C.warn]];
  const tot = Math.max(1e-6, parts.reduce((s, p) => s + Math.abs(p[1]), 0));
  return `<div class="cb">${parts.map(([n, v, col]) => `<div class="cb-seg" style="width:${(Math.abs(v) / tot * 100).toFixed(1)}%;background:${col};opacity:${v < 0 ? .95 : .55}">${Math.abs(v) / tot > 0.14 ? `<span>${n} ${sgn(v)}</span>` : ''}</div>`).join('')}</div>`;
}
function chip(jd) {
  const M = { exit: ['정리', 'dn'], warn: ['주의', 'warn'], hold: ['보유', 'ok'], target: ['목표', 'ok'], enter: ['진입', 'ok'], wait: ['관망', 'mut'], none: ['—', 'mut'] };
  const [tx, c] = M[jd?.chip] || M.none; return `<span class="chip ${c}">${tx}</span>`;
}

/* ------------------------------------------------------------ 데스크 */
async function renderDesk() {
  setNav('desk'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  const [syms, J, A, AL] = await Promise.all([loadWatchlist(), j('out/judgement.json'), j('out/attribution.json'), j('out/alerts.json')]);
  const items = (await Promise.all(syms.map(async s => ({ s, r: await j(`out/${s}.json`), rows: await loadCsv(s) })))).filter(x => x.r);
  const ctx = [['^KS11', '코스피'], ['^KQ11', '코스닥'], ['^GSPC', 'S&P 500'], ['^VIX', 'VIX 공포지수']];
  const mk = await Promise.all(ctx.map(async ([s, n]) => ({ s, n, rows: await loadCsv(s) })));
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
  const cards = items.map(({ s, r, rows }) => {
    const jd = J?.[s], a = A?.[s], k = r.krw, c = r.close;
    const lv = [];
    if (jd?.held && jd.stop) lv.push({ label: '손절', price: jd.stop, color: C.dn });
    else { const sup = r.levels.filter(l => l.price < c).sort((x, y) => y.price - x.price)[0]; lv.push(sup ? { label: '지지', price: sup.price, color: C.ok } : { label: '최근저가', price: r.keys.recent_low10, color: C.dn }); }
    r.confluence?.slice(0, 2).forEach(g => lv.push({ label: g.price < c ? '★받침' : '★천장', price: g.price, color: g.price < c ? C.ok : C.warn }));
    if (r.trend_upper) lv.push({ label: '추세선', price: r.trend_upper.value_today, color: C.warn });
    const t1 = (jd?.rows?.[0]?.cond || '').match(/≥ ([\d,.]+)/); if (t1) lv.push({ label: jd.held ? '목표' : '진입', price: +t1[1].replace(/,/g, ''), color: C.up });
    const uniq = []; lv.forEach(x => { if (!uniq.some(u => Math.abs(u.price / x.price - 1) < 0.006)) uniq.push(x); });
    const chg = r.rsi_volume.chg_pct, rsi = r.rsi_volume.rsi;
    const why = a ? `${a.main_driver} 영향` : '';
    const one = jd?.status || (r.sentences.find(x => x.startsWith('★')) || '').replace(/ —.*$/, '');
    return `<a class="card" href="#/t/${encodeURIComponent(s)}">
      <div class="card-h"><div><div class="card-n w">${nameOf(s, J)} <span class="mut mono" style="font-size:11px">${esc(s)}</span></div><div class="mut mono" style="font-size:11px">${r.asof} 종가</div></div>${chip(jd)}</div>
      <div class="card-p"><span class="mono ${cls(chg)}" style="font-size:24px;font-weight:600">${fmtP(c, k)}</span><span class="mono ${cls(chg)}">${sgn(chg)}</span>${why ? `<span class="mut" style="font-size:11px">${why}</span>` : ''}<span class="card-sp">${sparkline(rows.slice(-30).map(x => x.close), rows.length > 30 && rows[rows.length - 1].close >= rows[rows.length - 30].close ? C.up : C.dn, 80, 24)}</span></div>
      ${levelBar(uniq, c, k)}
      <div class="card-f"><span class="${rsi < 30 ? 'ok' : rsi > 70 ? 'warn' : 'mut'}">${term('RSI')} ${rsi.toFixed(0)}${rsi < 30 ? ' 과매도' : rsi > 70 ? ' 과매수' : ''}</span><span class="mut">·</span><span class="mut">${term('거래량')} ${r.rsi_volume.vol_ratio.toFixed(1)}×</span>${r.pattern?.type ? `<span class="mut">·</span><span class="warn">${term('쐐기', r.pattern.type)}</span>` : ''}</div>
      <div class="card-one">${esc(one)}</div>
    </a>`;
  }).join('');
  main.innerHTML = `
    <div class="bar"><h1>데스크</h1><span class="mut mono" style="font-size:12px">종가 기준 · 평일 15:40 / 05:10 KST 자동</span><span class="legend" style="margin-left:auto"><i style="background:${C.up}"></i>상승 <i style="background:${C.dn}"></i>하락 <i style="background:${C.ok}"></i>받침·충족 <i style="background:${C.warn}"></i>주의·선</span></div>
    ${(() => { const al = (AL?.alerts || []); if (!al.length) return '';
      const pr = { '손절 이탈': 0, '손절 근접': 1, '진입 조건': 2, '추세선 돌파': 3, '하단선 이탈': 4, '합류 받침': 5, 'RSI 과매도': 6, '합류 천장': 7 };
      const sorted = [...al].sort((a, b) => (pr[a.rule] ?? 9) - (pr[b.rule] ?? 9));
      const row = x => `<a class="al" href="#/t/${encodeURIComponent(x.symbol)}"><span class="chip ${x.level}">${esc(x.rule)}</span><b class="w">${nameOf(x.symbol, J)}</b><span class="dim">${esc(x.text)}</span></a>`;
      const head = sorted.slice(0, 4).map(row).join(''), rest = sorted.slice(4).map(row).join('');
      return `<section class="alerts"><header><span>오늘 알림 ${al.length}</span><small>규칙당 하루 1회 · ${AL.asof}</small></header><div class="al-list">${head}${rest ? `<details class="al-more"><summary>${sorted.length - 4}개 더</summary>${rest}</details>` : ''}</div></section>`; })()}
    <div class="sumrow">${sum || '<span class="mut">판단 결과 없음</span>'}<span class="mut" style="margin-left:auto;font-size:11px">카드 탭 → 종목 페이지</span></div>
    <div class="cards">${cards}</div>
    <div class="mut" style="font-size:12px;padding:2px 2px 0">시장 맥락</div>
    <div class="mkts">${mkt || '<div class="mut" style="padding:8px 12px">시장 지표는 다음 배치 후 표시</div>'}</div>
    <details class="rules"><summary>규칙 3줄</summary><div class="sent"><div>· 모든 판단은 종가 기준. 장중 흔들림은 무시.</div><div>· 손절선 없이 매수 없음. 반등 확인 전 물타기 금지.</div><div>· 문장은 가능성 표현. 확률 숫자 없음. 반대 근거 1줄 필수.</div></div></details>`;
  bindTerms();
  $('#foot').textContent = `읽음 ${stamp()}`;
}

/* ------------------------------------------------------------ 종목 페이지 */
async function renderTicker(sym) {
  setNav('desk'); main.innerHTML = '<div class="mut" style="padding:20px">불러오는 중…</div>';
  const [r, rows, J, A, AL] = await Promise.all([j(`out/${sym}.json`), loadCsv(sym), j('out/judgement.json'), j('out/attribution.json'), j('out/alerts.json')]);
  if (!r) { main.innerHTML = `<div class="bar"><a href="#/" class="back">‹</a><h1>${esc(sym)}</h1><span class="mut">분석 결과 없음 — 다음 배치 후 생성</span></div>`; return; }
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
    const zb = (top && stop && top > stop) ? zoneBar(stop, top, c, k) : '';
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
    <div class="bar"><a href="#/" class="back">‹</a><h1>${nameOf(sym, J)} <span class="mut mono" style="font-size:12px;font-weight:400">${esc(sym)}</span></h1>
      <span class="mono ${cls(chg)}" style="font-size:22px;font-weight:600">${f(c)}</span><span class="mono ${cls(chg)}">${sgn(chg)}</span>
      <span class="mut mono" style="font-size:11px">${r.asof} 종가</span>${jd ? `<span style="margin-left:auto">${chip(jd)}</span>` : ''}</div>
    <div class="headline ${jd?.chip === 'exit' ? 'dn' : jd?.chip === 'warn' ? 'warn' : conf.length ? 'ok' : ''}">${esc(headline)}<small>${esc(PLAIN[jd?.chip] || (conf.length ? '유명한 선 여러 개가 겹치는 가격 근처예요. 한 번 튀어오를 수는 있지만 바닥이 확정된 건 아니에요.' : '가까운 기준선이 없어서 다음 기준선까지 미끄러질 수 있어요.'))}</small></div>
    ${(() => { const items = [...((AL?.alerts || []).filter(x => x.symbol === sym).map(x => ({ t: x.text, lv: x.level, rule: x.rule }))), ...((jd?.watch_today || []).filter(x => !(x.startsWith('★') && (AL?.alerts || []).some(a => a.symbol === sym && a.rule.startsWith('합류')))).map(x => ({ t: x, lv: 'mut' })))];
      if (!items.length) return ''; const key = 'chk:' + sym + ':' + r.asof; let done = {}; try { done = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
      return `<section class="todo"><header><span>오늘 볼 것</span><small>종가 기준 · 체크는 내 기기에만 저장</small></header><div class="todo-list">${items.map((it, i) => `<label class="todo-i ${done[i] ? 'done' : ''}"><input type="checkbox" data-key="${key}" data-i="${i}" ${done[i] ? 'checked' : ''}><span class="box"></span>${it.rule ? `<span class="chip ${it.lv}">${esc(it.rule)}</span>` : '<span></span>'}<span>${esc(it.t)}</span></label>`).join('')}</div></section>`; })()}
    ${sig}
    <div class="grid2">
      <section><header><span>일봉 · 선 8종</span><small>확대·이동 가능 · 상승 빨강 / 하락 파랑</small></header><div id="chart"></div></section>
      <section><header><span>선 사다리</span><small>차트 구간의 선 · 현재가 기준</small></header>${ladder(r, rows)}</section>
    </div>
    <div class="grid2b">${board}${attr}</div>
    <section><header><span>★ ${term('합류')} · 반대 근거</span><small>유명한 선이 겹치는 자리</small></header><div class="sent">
      ${conf.length ? conf.map(g => `<div class="conf ${g.price < c ? '' : 'warn'}">★ ${g.price < c ? '받침' : '천장'} ${f(g.price)} (${sgn(pct(g.price, c))}) = ${esc(g.lines.join(' + '))}</div>`).join('') : '<div class="mut">현재가 ±2% 안에 겹치는 선 없음 — 다음 선까지 미끄러질 수 있음</div>'}
      <div class="counter">${esc(r.sentences.find(x => x.startsWith('반대 근거')) || '')}</div></div></section>
    <details class="more"><summary>자세한 해석 ${r.sentences.length}줄 · 정적 이미지</summary>
      <div class="sent">${r.sentences.map(s => `<div>· ${esc(s)}</div>`).join('')}</div>
      <img src="out/${encodeURIComponent(sym)}.png" style="width:100%;display:block;margin-top:8px" alt="배치가 만든 차트"></details>`;
  drawChart(rows, r);
  bindTerms(); bindTodo();
  $('#foot').textContent = `${sym} · ${stamp()}`;
}

function drawChart(rows, r) {
  const el = $('#chart'); if (!el || !window.LightweightCharts || !rows.length) return; const k = r.krw;
  const chart = LightweightCharts.createChart(el, {
    layout: { background: { color: '#1E1E1E' }, textColor: C.mut, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 },
    grid: { vertLines: { color: C.line }, horzLines: { color: C.line } },
    rightPriceScale: { borderColor: C.line, scaleMargins: { top: 0.08, bottom: 0.22 } }, timeScale: { borderColor: C.line, rightOffset: 8 },
    crosshair: { mode: 0 }, localization: { locale: 'ko-KR', priceFormatter: v => fmtP(v, k) },
  });
  const cs = chart.addCandlestickSeries({ upColor: C.up, downColor: C.dn, borderVisible: false, wickUpColor: C.up, wickDownColor: C.dn });
  cs.setData(rows);
  const vs = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  vs.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vs.setData(rows.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(242,92,92,.4)' : 'rgba(79,156,249,.4)' })));
  [[20, C.ma20], [60, C.ma60], [120, C.ma120], [200, C.ma200]].forEach(([w, col]) => {
    if (rows.length >= w) chart.addLineSeries({ color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(sma(rows, w));
  });
  const pl = (price, color, title, style, label = true) => cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: label, title: label ? title : '' });
  const c = r.close;
  const sup = r.levels.filter(l => l.price < c).sort((x, y) => y.price - x.price)[0];
  const res = r.levels.filter(l => l.price >= c).sort((x, y) => x.price - y.price)[0];
  r.levels.forEach(l => pl(l.price, l.price < c ? C.ok : C.warn, l.price < c ? '지지' : '저항', 2, l === sup || l === res));
  Object.entries(r.fib.levels).forEach(([n, v]) => pl(v, C.tag, '', 3, false));
  const confNear52 = (r.confluence || []).some(g => Math.abs(g.price / r.keys.w52_low - 1) < 0.006);
  pl(r.keys.w52_low, C.dn, '52주저', 4, !confNear52);
  (r.confluence || []).forEach(g => pl(g.price, C.ok, '★합류', 0, true));
  const idx = Object.fromEntries(rows.map((x, i) => [x.time, i]));
  const tl = (t, color, title) => {
    if (!t || idx[t.from] === undefined) return;
    const i0 = idx[t.from], n = rows.length, y0 = t.value_today - t.slope_per_bar * (n - 1 - i0);
    const pts = []; for (let i = i0; i < n; i++) pts.push({ time: rows[i].time, value: y0 + t.slope_per_bar * (i - i0) });
    chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: !!title, crosshairMarkerVisible: false, title }).setData(pts);
  };
  tl(r.trend_upper, C.warn, '추세'); tl(r.trend_lower, C.warn, '');
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, rows.length - 80), to: rows.length + 6 });
  new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })).observe(el);
}

/* ------------------------------------------------------------ 설정 */
async function renderSettings() {
  setNav('settings');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const ios = /iphone|ipad/i.test(navigator.userAgent); const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const al = await j('out/alerts.json');
  main.innerHTML = `
    <div class="bar"><h1>알림 · 설정</h1></div>
    <section><header><span>오늘 알림</span><small>규칙당 하루 1회 · 서버 푸시는 다음 단계</small></header><div class="sent">${(al?.alerts || []).length ? al.alerts.map(x => `<div><span class="chip ${x.level}">${esc(x.rule)}</span> <b class="w">${esc(x.symbol)}</b> ${esc(x.text)}</div>`).join('') : '<div class="mut">알림 없음</div>'}</div></section>
    <section><header><span>앱 알림 (웹 푸시)</span></header><div class="sent">
      <div>· 브라우저 지원: <b class="${supported ? 'ok' : 'dn'}">${supported ? '됨' : '안 됨'}</b> · 권한: <b>${perm}</b></div>
      ${ios && !standalone ? '<div class="warn">· 아이폰은 공유 → "홈 화면에 추가" 후 그 아이콘으로 열어야 알림이 옵니다.</div>' : ''}
      <div style="text-indent:0;padding-left:0"><button class="btn pri" id="btnNotif">알림 켜기</button> <span class="mut" id="notifMsg"></span></div></div></section>
    <section><header><span>관심 종목</span><small>watchlist.txt</small></header><div class="sent"><div>· 저장소의 <span class="mono">watchlist.txt</span>에 야후 심볼 한 줄 추가 → 다음 배치부터 (코스피 .KS / 코스닥 .KQ)</div></div></section>
    <section><header><span>용어</span><small>탭하면 설명</small></header><div class="sent">${Object.keys(G).map(k => `<div>${term(k)} <span class="mut">${esc(G[k])}</span></div>`).join('')}</div></section>`;
  $('#btnNotif').onclick = async () => {
    const m = $('#notifMsg'); const cfg = window.INVESTOOL_CONFIG || {};
    if (!supported) { m.textContent = '이 브라우저는 푸시를 지원하지 않아요.'; return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { m.textContent = '권한이 거부됐어요.'; return; }
    const reg = await navigator.serviceWorker.ready;
    if (!cfg.SUPABASE_URL || !cfg.VAPID_PUBLIC_KEY) {
      reg.showNotification('investool', { body: '알림 권한 OK. 서버 연결(Supabase)은 아직 — 연결되면 자동으로 구독돼요.', icon: 'icons/icon-192.png' });
      m.textContent = '권한은 켜졌어요. 서버 구독은 설정 후.'; return;
    }
    try {
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.VAPID_PUBLIC_KEY) });
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/push_subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ endpoint: sub.endpoint, sub: sub.toJSON() }) });
      m.textContent = res.ok ? '구독 완료 — 다음 배치부터 알림이 와요.' : `구독 저장 실패 (${res.status})`;
      reg.showNotification('investool', { body: '알림 구독 완료', icon: 'icons/icon-192.png' });
    } catch (e) { m.textContent = '구독 실패: ' + e.message; }
  };
  bindTerms();
}
function renderStub(name, phase) { setNav(name); main.innerHTML = `<div class="bar"><h1>${name === 'screener' ? '스크리너' : '일지'}</h1><span class="tag">${phase}</span></div><section><div class="sent"><div class="mut">로드맵 ${phase}에서 구현.</div></div></section>`; }

/* ------------------------------------------------------------ 공통 */
function b64ToU8(b) { const p = '='.repeat((4 - b.length % 4) % 4); const s = (b + p).replace(/-/g, '+').replace(/_/g, '/'); const r = atob(s); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); }
function bindTodo() {
  document.querySelectorAll('.todo-i input').forEach(cb => cb.onchange = () => {
    const key = cb.dataset.key; let d = {}; try { d = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    d[cb.dataset.i] = cb.checked; try { localStorage.setItem(key, JSON.stringify(d)); } catch {}
    cb.closest('.todo-i').classList.toggle('done', cb.checked);
  });
}
function bindTerms() {
  document.querySelectorAll('.term').forEach(el => el.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    let tip = $('#tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); tip.onclick = () => tip.classList.remove('on'); }
    tip.innerHTML = `<b>${esc(el.dataset.g)}</b><div>${esc(G[el.dataset.g] || '')}</div><div class="mut" style="margin-top:6px;font-size:11px">탭해서 닫기</div>`; tip.classList.add('on');
  });
}
function setNav(name) { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name)); }
function stamp() { return new Date().toLocaleString('ko-KR', { hour12: false }); }
function route() {
  const h = location.hash || '#/'; const m = h.match(/^#\/t\/(.+)$/);
  window.scrollTo(0, 0);
  if (m) return renderTicker(decodeURIComponent(m[1]));
  if (h === '#/screener') return renderStub('screener', 'P3');
  if (h === '#/journal') return renderStub('journal', 'P3');
  if (h === '#/settings') return renderSettings();
  return renderDesk();
}
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
