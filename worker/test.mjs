const store = new Map();
globalThis.caches = { default: { match: async k => store.get(k.url)?.clone(), put: async (k, r) => store.set(k.url, r) } };
const { default: w } = await import('./quote.js');
const ctx = { waitUntil: p => p };
const call = async p => { const r = await w.fetch(new Request('https://x.workers.dev' + p), {}, ctx); return [r.status, await r.json()]; };
const out = {};
for (const p of ['/q?s=005930.KS,INFQ', '/c?s=005930.KS&tf=d', '/c?s=INFQ&tf=w', '/c?s=483650.KS&tf=m', '/c?s=000660.KS&tf=h', '/f?s=036460.KS', '/s?q=' + encodeURIComponent('한화에어로'), '/c?s=bad;x&tf=d']) {
  const t0 = Date.now(); const [st, j] = await call(p);
  out[p] = { st, ms: Date.now() - t0, n: Array.isArray(j) ? j.length : j.rows ? j.rows.length : Object.keys(j).length,
    head: JSON.stringify(Array.isArray(j) ? j.slice(0, 2) : j.rows ? { open: j.open, first: j.rows[0], last: j.rows.at(-1) } : j).slice(0, 300) };
}
console.log(JSON.stringify(out, null, 1));
