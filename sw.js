// Neuland – Serviceworker: Offline-Cache
const CACHE = 'neuland-v3';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest', './icon.svg',
  './js/main.js', './js/ui.js', './js/sim.js', './js/render.js', './js/map.js',
  './js/core.js', './js/sound.js', './js/input.js', './js/save.js', './js/levels.js',
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e)=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy));
      return res;
    }).catch(()=>caches.match('./index.html')))
  );
});
