/* investool service worker — 앱 셸 캐시 + 푸시 수신 */
const V = 'investool-v4';
const SHELL = ['./', './index.html', './app.js', './config.js', './manifest.webmanifest', './vendor/lightweight-charts.standalone.production.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  // 데이터(out/, data/, watchlist)는 항상 네트워크 우선
  if (/\/(out|data)\/|watchlist\.txt$/.test(u.pathname)) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'investool', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'investool', { body: d.body || '', icon: './icons/icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data?.url || './')); });
