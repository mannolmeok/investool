// investool 중계 (Cloudflare Worker) — 붙여넣기용 단일 파일
//  /q?s=005930.KS,INFQ          실시간 시세
//  /c?s=005930.KS&tf=d|w|m|h    차트 데이터 (일 1년 · 주 5년 · 월 전체 · 1시간 60일)  → [[날짜|유닉스초, 시, 고, 저, 종, 거래량], ...]
//  /f?s=005930.KS               수급 60일 (외국인·기관·개인 순매수, 국내만)
//  /s?q=한화에어로              종목 검색 (국내 이름·코드 → 야후 심볼)
const OK_SYM = /^(\d{6}\.(KS|KQ)|[A-Z][A-Z0-9.\-]{0,9}|\^[A-Z0-9]{2,8})$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json; charset=utf-8' };
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com/' };
const YUA = { 'User-Agent': 'Mozilla/5.0' };
const num = s => { const m = String(s ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
const json = (o, st = 200, extra = {}) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, ...extra } });

async function kr(sym) {
  const r = await fetch(`https://m.stock.naver.com/api/stock/${sym.slice(0, 6)}/basic`, { headers: UA });
  if (!r.ok) throw new Error('naver ' + r.status);
  const j = await r.json();
  const sign = ['4', '5'].includes(j.compareToPreviousPrice?.code) ? -1 : 1;
  return { p: num(j.closePrice), chg: sign * Math.abs(num(j.compareToPreviousClosePrice) || 0), pct: sign * Math.abs(num(j.fluctuationsRatio) || 0),
    t: j.localTradedAt, st: j.marketStatus === 'OPEN' ? 'open' : 'closed', src: 'naver' };
}
async function us(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=true`, { headers: YUA });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const m = (await r.json()).chart.result[0].meta;
  const prev = m.chartPreviousClose ?? m.previousClose, p = m.regularMarketPrice;
  const now = Date.now() / 1000, reg = m.currentTradingPeriod?.regular || {};
  const st = now >= reg.start && now < reg.end ? 'open' : now < reg.start && now >= (m.currentTradingPeriod?.pre?.start || 0) ? 'pre' : 'closed';
  return { p, chg: p - prev, pct: (p / prev - 1) * 100, t: new Date(m.regularMarketTime * 1000).toISOString(), st, src: 'yahoo' };
}

const TF = { d: ['1d', '1y'], w: ['1wk', '5y'], m: ['1mo', 'max'], h: ['60m', '60d'] };
async function chart(sym, tf) {
  const [iv, rg] = TF[tf];
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${iv}&range=${rg}`, { headers: YUA });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const res = (await r.json()).chart.result[0], q = res.indicators.quote[0], ts = res.timestamp || [];
  const krw = /\.(KS|KQ)$/.test(sym), rd = v => krw ? Math.round(v) : Math.round(v * 100) / 100;
  const day = t => new Date((t + (krw ? 9 : -4) * 3600) * 1000).toISOString().slice(0, 10);  // 거래소 현지 날짜
  let rows = [];
  ts.forEach((t, i) => { if (q.close[i] == null || q.open[i] == null) return; rows.push([tf === 'h' ? t : day(t), rd(q.open[i]), rd(q.high[i]), rd(q.low[i]), rd(q.close[i]), q.volume[i] || 0]); });
  if (tf !== 'h') { const m = new Map(); rows.forEach(r => m.set(r[0], r)); rows = [...m.values()]; }  // 같은 날 중복 제거(마지막 값)
  if (tf === 'w' || tf === 'm') {  // 신규 상장 종목은 야후가 일봉을 주는 경우 → 직접 묶기
    const B = new Map();
    for (const r of rows) {
      const d = new Date(r[0] + 'T00:00:00Z');
      const k = tf === 'm' ? r[0].slice(0, 8) + '01' : new Date(d - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
      const b = B.get(k);
      if (!b) B.set(k, [k, r[1], r[2], r[3], r[4], r[5]]); else { b[2] = Math.max(b[2], r[2]); b[3] = Math.min(b[3], r[3]); b[4] = r[4]; b[5] += r[5]; }
    }
    rows = [...B.values()];
  }
  const meta = res.meta || {}, reg = meta.currentTradingPeriod?.regular || {}, now = Date.now() / 1000;
  return { sym, tf, rows, open: now >= reg.start && now < reg.end };
}

async function flows(sym) {
  const r = await fetch(`https://m.stock.naver.com/api/stock/${sym.slice(0, 6)}/trend?pageSize=60`, { headers: UA });
  if (!r.ok) throw new Error('naver ' + r.status);
  return (await r.json()).map(x => ({ date: x.bizdate, foreign: num(x.foreignerPureBuyQuant), organ: num(x.organPureBuyQuant), indiv: num(x.individualPureBuyQuant),
    close: num(x.closePrice), vol: num(x.accumulatedTradingVolume), foreign_ratio: num(x.foreignerHoldRatio) }));
}

async function search(q) {
  const r = await fetch(`https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock`, { headers: UA });
  if (!r.ok) throw new Error('naver ' + r.status);
  const items = ((await r.json()).result?.items || []).filter(i => i.nationCode === 'KOR' && i.category === 'stock' && !i.isEtf);
  return items.slice(0, 8).map(i => ({ symbol: i.code + (i.typeCode === 'KOSPI' ? '.KS' : '.KQ'), name: i.name, market: i.typeCode }));
}

async function cached(ctx, key, ttl, fn) {
  const cache = caches.default, k = new Request('https://cache.investool/' + key);
  const hit = await cache.match(k);
  if (hit) return new Response(hit.body, { headers: { ...CORS, 'X-Cache': 'HIT' } });
  const body = JSON.stringify(await fn());
  ctx.waitUntil(cache.put(k, new Response(body, { headers: { ...CORS, 'Cache-Control': `max-age=${ttl}` } })));
  return new Response(body, { headers: CORS });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), P = url.pathname, sp = url.searchParams;
    try {
      if (P === '/q') {
        const syms = [...new Set((sp.get('s') || '').split(',').map(s => s.trim().toUpperCase()).filter(s => OK_SYM.test(s)))].slice(0, 40).sort();
        if (!syms.length) return json({}, 400);
        return cached(ctx, 'q?' + syms.join(','), 10, async () => {
          const out = {};
          await Promise.all(syms.map(async s => { try { out[s] = /\.(KS|KQ)$/.test(s) ? await kr(s) : await us(s); } catch (e) { out[s] = { err: String(e.message || e) }; } }));
          out._at = new Date().toISOString(); return out;
        });
      }
      if (P === '/c') {
        const s = (sp.get('s') || '').toUpperCase(), tf = sp.get('tf') || 'd';
        if (!OK_SYM.test(s) || !TF[tf]) return json({ err: 'bad' }, 400);
        return cached(ctx, `c?${s}&${tf}`, tf === 'w' || tf === 'm' ? 600 : 60, () => chart(s, tf));
      }
      if (P === '/f') {
        const s = (sp.get('s') || '').toUpperCase();
        if (!/^\d{6}\.(KS|KQ)$/.test(s)) return json({ err: 'domestic only' }, 400);
        return cached(ctx, 'f?' + s, 300, () => flows(s));
      }
      if (P === '/s') {
        const q = (sp.get('q') || '').trim().slice(0, 30);
        if (!q) return json([], 400);
        return cached(ctx, 's?' + q, 3600, () => search(q));
      }
      return json({ ok: true, v: 2, use: ['/q?s=005930.KS,INFQ', '/c?s=005930.KS&tf=d', '/f?s=005930.KS', '/s?q=삼성'] });
    } catch (e) {
      return json({ err: String(e.message || e) }, 502);
    }
  },
};
