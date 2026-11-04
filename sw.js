const C = 'betslip-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.includes('/api/')) return;
  e.respondWith(fetch(r).then((x) => { const c = x.clone(); caches.open(C).then((k) => k.put(r, c)); return x; }).catch(() => caches.match(r)));
});
