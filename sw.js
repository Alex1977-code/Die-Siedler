// Neuland – Serviceworker: Offline-Cache
//
// Wichtig für Updates: der Programmcode wird NETZ-ZUERST geladen, die
// Grafiken CACHE-ZUERST. Vorher galt cache-first für alles – dadurch blieb
// nach einer Veröffentlichung die alte Fassung im Bild hängen, obwohl der
// Server längst die neue auslieferte. Beim Installieren wird zusätzlich am
// HTTP-Cache vorbei geladen (cache:'reload'), sonst holt sich der neue
// Serviceworker über die noch gültigen Cache-Header wieder die alten Bytes.
const BUILD = 'v339';
const CACHE = 'neuland-' + BUILD;
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-mask.png',
  './js/main.js', './js/ui.js', './js/sim.js', './js/render.js', './js/map.js',
  './js/core.js', './js/sound.js', './js/input.js', './js/save.js', './js/levels.js',
  './js/terrain-gl.js',
];
// Alles, was Programm oder Layout ist – hier zählt Aktualität, nicht Tempo
const isCode = (url)=> /\.(js|css|html|json|webmanifest)$/i.test(url) || url.endsWith('/');

self.addEventListener('install', (e)=>{
  // NUR den Programmcode vorladen - das sind wenige Dateien und geht in
  // Sekunden. Die ~560 Grafiken hingen frueher MIT in diesem Schritt:
  // auf dem Handy dauerte das so lange, dass der Spieler laengst in der
  // Partie war, bevor die neue Fassung "activated" wurde - der Wechsel
  // schob sich auf den naechsten Start ("v264 nicht am handy"). Die
  // Grafiken laedt jetzt der activate-Schritt NACH der Uebernahme nach;
  // bis dahin faellt Cache-zuerst einfach aufs Netz zurueck.
  e.waitUntil(caches.open(CACHE).then(async (c)=>{
    // am Browser-Cache vorbei: sonst landen die alten Bytes im neuen Cache
    await Promise.all(FILES.map(f=>
      fetch(new Request(f, {cache:'reload'}))
        .then(r=> r.ok? c.put(f, r) : null)
        .catch(()=>null)
    ));
  }).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()).then(async ()=>{
    // Grafik-Assets nachladen, NACHDEM die neue Fassung uebernommen hat -
    // Fehler einzelner Dateien sind egal (prozedurale Sprites als Fallback)
    try{
      const c=await caches.open(CACHE);
      const r=await fetch(new Request('./assets/manifest.json', {cache:'reload'}));
      if(r.ok){
        const list=await r.clone().json();
        await c.put('./assets/manifest.json', r);
        // IN STAPELN UND AM BROWSER-CACHE VORBEI.
        //
        // Zwei Fehler steckten in der einen Zeile, die hier vorher stand
        // (Promise.allSettled(list.map(f=>c.add('./assets/'+f)))):
        //
        // ERSTENS wurden ALLE Grafiken gleichzeitig angefordert - das sind
        // 610 Dateien mit zusammen 84 MB. Ein Browser macht daraus einen
        // Anfragensturm; auf dem Rechner laeuft der Luefter hoch, und das
        // bei jedem Fassungswechsel aufs Neue (Nutzerbefund: "der rechner
        // luefter laeuft hochtourig"). Jetzt gehen sechs auf einmal raus,
        // der Rest wartet. Das dauert laenger, stoert aber niemanden: zu
        // diesem Zeitpunkt laeuft das Spiel laengst, und was noch nicht im
        // Zwischenspeicher liegt, holt der fetch-Zweig vom Netz.
        //
        // ZWEITENS geht cache.add() durch den HTTP-Zwischenspeicher des
        // Browsers - und holt damit genau die alten Bytes, vor denen der
        // Kommentar ganz oben warnt. NACHGEMESSEN mit einem Server, der wie
        // GitHub Pages "max-age=600" sendet: Datei auf dem Server geaendert,
        // Fassung hochgezaehlt, Seite neu geladen - der NEUE Zwischenspeicher
        // (neuland-vB) enthielt die ALTE Datei. Genau so kommt man zu alten
        // Grafiken in einer neuen Fassung (Nutzerbefund: "wieso bekomme ich
        // am rechner so alte grafiken"). Mit cache:'reload' wird am
        // Browser-Zwischenspeicher vorbei geladen, wie beim Programmcode.
        const STAPEL=6;
        for(let i=0;i<list.length;i+=STAPEL){
          await Promise.allSettled(list.slice(i,i+STAPEL).map(async (f)=>{
            const u='./assets/'+f;
            const res=await fetch(new Request(u, {cache:'reload'}));
            if(res.ok) await c.put(u, res);
          }));
        }
      }
    }catch(_){ /* offline/fehlend: Spiel laeuft prozedural weiter */ }
  }));
});

// Die Seite kann die laufende Fassung erfragen – so lässt sich im Spiel
// ablesen, ob wirklich die neue Version aktiv ist.
self.addEventListener('message', (e)=>{
  if(e.data && e.data.type==='version' && e.source) e.source.postMessage({type:'version', build:BUILD});
});

self.addEventListener('fetch', (e)=>{
  if(e.request.method!=='GET') return;
  const url=e.request.url;
  if(isCode(url)){
    // Netz zuerst, Cache nur als Rückfall (offline oder Serverfehler).
    // 'no-cache' heißt: immer beim Server rückfragen. Ohne das säße eine
    // frische Veröffentlichung bis zu zehn Minuten im Browser-Cache fest
    // (GitHub Pages liefert max-age=600) – der Serviceworker bekäme sie
    // gar nicht zu sehen. Navigationsanfragen bleiben unangetastet, deren
    // Modus lässt sich nicht gefahrlos umbauen.
    let req=e.request;
    if(req.mode!=='navigate'){
      try{ req=new Request(e.request, {cache:'no-cache'}); }catch(_){ req=e.request; }
    }
    e.respondWith(
      fetch(req).then(res=>{
        if(res.ok){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy));
        }
        return res;
      }).catch(()=> caches.match(e.request).then(hit=>{
        if(hit) return hit;
        // NIEMALS index.html als Antwort auf eine .js- oder .css-Anfrage.
        // Genau das tat der Rueckfall hier bisher: faellt das Netz aus und
        // liegt die Datei nicht im Zwischenspeicher, bekam der Browser ein
        // HTML-Dokument, wo er ein Modul erwartet - das ergibt einen
        // Syntaxfehler ("Unexpected token '<'") statt einer ehrlichen
        // Fehlermeldung, und der Spieler sieht eine leere Seite ohne Grund.
        // Nur eine Seitennavigation darf index.html bekommen; alles andere
        // meldet sauber einen Netzfehler, den die Seite behandeln kann.
        if(e.request.mode==='navigate') return caches.match('./index.html');
        return Response.error();
      }))
    );
    return;
  }
  // Grafiken und Töne: Cache zuerst, das spart auf dem Handy viel Datenvolumen
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      if(res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
      }
      return res;
    }).catch(()=>
      // Auch hier kein index.html als Ersatz fuer ein fehlendes Bild oder
      // einen fehlenden Ton: das Spiel hat fuer beides prozedurale
      // Rueckfaelle und kommt mit einem Fehler besser zurecht als mit
      // einem HTML-Dokument, das es fuer eine Grafik haelt.
      e.request.mode==='navigate' ? caches.match('./index.html') : Response.error()))
  );
});
