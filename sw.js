const CACHE='mali-v4-20261004';
const ASSETS=['./','./index.html','./manifest.json?v=4'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{let c=r.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return r}).catch(()=>caches.match('./index.html')));return}e.respondWith(fetch(e.request).then(r=>{let c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
