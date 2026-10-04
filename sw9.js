// مالي V9 — يعمل بدون إنترنت؛ الشبكة أولًا حتى تظهر التحديثات مباشرة.
const CACHE = 'mali9-9.9.0';
const ASSETS = ['./', './index.html', './mali9.css?v=9.9.0', './mali9-core.js?v=9.9.0', './mali9.js?v=9.9.0', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && /^mali/.test(k) && !k.startsWith('mali-v')).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/old.html') || url.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy))); }
    return r;
  }).catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
