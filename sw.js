const CACHE='mali-v7.1-compact-20261004';
const ASSETS=['./index.html','./app.js?v=7.1','./styles.css?v=7.1','./manifest.json','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^mali-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){let copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return r}).catch(async()=>{let found=await caches.match(e.request);if(found)return found;if(e.request.mode==='navigate')return caches.match('./index.html');return Response.error()}))});
