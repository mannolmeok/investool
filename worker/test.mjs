// Actions 에서 실제 네이버·야후로 worker 를 시험 (caches 는 메모리 흉내)
const store = new Map();
globalThis.caches = { default: { match: async k => store.get(k.url)?.clone(), put: async (k, r) => store.set(k.url, r) } };
const { default: w } = await import('./quote.js');
const ctx = { waitUntil: p => p };
const t0 = Date.now();
const r = await w.fetch(new Request('https://x.workers.dev/q?s=005930.KS,000660.KS,102710.KQ,INFQ,IONQ,^KS11,bad;rm'), {}, ctx);
const j = await r.json();
console.log(r.status, r.headers.get('access-control-allow-origin'), Date.now() - t0, 'ms');
console.log(JSON.stringify(j, null, 1));
const r2 = await w.fetch(new Request('https://x.workers.dev/q?s=005930.KS,000660.KS,102710.KQ,INFQ,IONQ,^KS11'), {}, ctx);
console.log('second', r2.headers.get('X-Cache'));
const bad = Object.entries(j).filter(([k, v]) => k !== '_at' && (v.err || v.p == null));
if (bad.length > 1) { console.log('FAIL', bad); process.exit(1); }
