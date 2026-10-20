// investool 실시간 시세 중계 (Cloudflare Worker) — 붙여넣기용 단일 파일
// GET /q?s=005930.KS,000660.KS,INFQ  →  { "005930.KS": { p, chg, pct, t, st, src }, ... }
// 국내(.KS/.KQ): 네이버 증권 · 미국: 야후. 10초 캐시. 정해진 형식의 심볼만, 최대 40개 (열린 프록시 방지)
const OK_SYM = /^(\d{6}\.(KS|KQ)|[A-Z][A-Z0-9.\-]{0,9}|\^[A-Z0-9]{2,8})$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json; charset=utf-8' };
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com/' };
const num = s => { const m = String(s ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };

async function kr(sym) {
  const r = await fetch(`https://m.stock.naver.com/api/stock/${sym.slice(0, 6)}/basic`, { headers: UA });
  if (!r.ok) throw new Error('naver ' + r.status);
  const j = await r.json();
  const sign = ['4', '5'].includes(j.compareToPreviousPrice?.code) ? -1 : 1; // 4 하한 · 5 하락
  return { p: num(j.closePrice), chg: sign * Math.abs(num(j.compareToPreviousClosePrice) || 0), pct: sign * Math.abs(num(j.fluctuationsRatio) || 0),
    t: j.localTradedAt, st: j.marketStatus === 'OPEN' ? 'open' : 'closed', src: 'naver' };
}
async function us(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=true`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const m = (await r.json()).chart.result[0].meta;
  const prev = m.chartPreviousClose ?? m.previousClose, p = m.regularMarketPrice;
  const now = Date.now() / 1000, reg = m.currentTradingPeriod?.regular || {};
  const st = now >= reg.start && now < reg.end ? 'open' : now < reg.start && now >= (m.currentTradingPeriod?.pre?.start || 0) ? 'pre' : 'closed';
  return { p, chg: p - prev, pct: (p / prev - 1) * 100, t: new Date(m.regularMarketTime * 1000).toISOString(), st, src: 'yahoo' };
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (url.pathname !== '/q') return new Response(JSON.stringify({ ok: true, use: '/q?s=005930.KS,INFQ' }), { headers: CORS });
    const syms = [...new Set((url.searchParams.get('s') || '').split(',').map(s => s.trim().toUpperCase()).filter(s => OK_SYM.test(s)))].slice(0, 40);
    if (!syms.length) return new Response('{}', { status: 400, headers: CORS });
    const cache = caches.default, key = new Request('https://cache.investool/q?s=' + syms.sort().join(','));
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: { ...CORS, 'X-Cache': 'HIT' } });
    const out = {};
    await Promise.all(syms.map(async s => { try { out[s] = /\.(KS|KQ)$/.test(s) ? await kr(s) : await us(s); } catch (e) { out[s] = { err: String(e.message || e) }; } }));
    out._at = new Date().toISOString();
    const body = JSON.stringify(out);
    ctx.waitUntil(cache.put(key, new Response(body, { headers: { ...CORS, 'Cache-Control': 'max-age=10' } })));
    return new Response(body, { headers: CORS });
  },
};
