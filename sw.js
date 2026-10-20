/* investool service worker — 먼저 보여주고 뒤에서 갱신(stale-while-revalidate) + 푸시 수신
   - 같은 사이트 파일: 캐시에 있으면 즉시 응답, 동시에 네트워크로 새 버전 받아 캐시 교체
   - 새 버전이 실제로 달라졌으면(out/·data/·config) 열린 화면에 'updated' 알림 → 앱이 조용히 다시 그림
   - 처음 여는 파일은 네트워크에서 받음 */
const V = 'investool-v26';
const SHELL = ['./', './index.html', './app.js', './engine.js', './config.js', './manifest.webmanifest', './vendor/lightweight-charts.standalone.production.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

async function notify(url) {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ type: 'updated', url }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.cache === 'no-store') return;  // 폴링(종목 찾기 등)은 항상 네트워크
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  const key = u.origin + u.pathname;  // 쿼리(?_=) 무시
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(key);
    const net = fetch(req).then(async res => {
      if (res.ok) {
        const watch = /\/(out|data)\/|config\.js$|watchlist\.txt$/.test(u.pathname);
        if (hit && watch) {
          const [a, b] = await Promise.all([hit.clone().text(), res.clone().text()]);
          await c.put(key, res.clone());
          if (a !== b) notify(u.pathname);
        } else {
          await c.put(key, res.clone());
        }
      }
      return res;
    }).catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  })());
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'investool', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'investool', { body: d.body || '', icon: './icons/icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data?.url || './')); });
