// مالي V9 — يعمل بدون إنترنت؛ الشبكة أولًا حتى تظهر التحديثات مباشرة.
const CACHE = 'mali9-11.0.2';
const ASSETS = ['./', './index.html', './mali9.css?v=11.0.2', './mali9-core.js?v=11.0.2', './mali9.js?v=11.0.2', './fonts/cairo-ar-400.woff2', './fonts/cairo-ar-600.woff2', './fonts/cairo-ar-700.woff2', './fonts/cairo-lat-400.woff2', './fonts/cairo-lat-600.woff2', './fonts/cairo-lat-700.woff2', './fonts/lexend-500.woff2', './fonts/lexend-700.woff2', './icon-180.png?v=11.0.2', './icon-192.png?v=11.0.2', './icon-512.png?v=11.0.2'];
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
