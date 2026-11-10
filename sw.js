// Neuland – Serviceworker: Offline-Cache
//
// Wichtig für Updates: der Programmcode wird NETZ-ZUERST geladen, die
// Grafiken CACHE-ZUERST. Vorher galt cache-first für alles – dadurch blieb
// nach einer Veröffentlichung die alte Fassung im Bild hängen, obwohl der
// Server längst die neue auslieferte. Beim Installieren wird zusätzlich am
// HTTP-Cache vorbei geladen (cache:'reload'), sonst holt sich der neue
// Serviceworker über die noch gültigen Cache-Header wieder die alten Bytes.
const BUILD = 'v340';
const CACHE = 'neuland-' + BUILD;
// DIE GRAFIKEN HABEN EINEN EIGENEN SPEICHER, DER FASSUNGEN UEBERLEBT.
//
// Bis v339 lagen Programm und Grafiken gemeinsam in 'neuland-<BUILD>', und
// activate loeschte bei jeder neuen Fassung alles andere. Jede Fassung -
// auch eine, die nur eine Zeile in sim.js aendert - lud damit alle 610
// Grafiken (84 MB) neu, ohne Rueckfrage beim Server, ob sich ueberhaupt eine
// geaendert hat. Beim Erstbesuch und nach jedem ?neu sogar doppelt: einmal
// die Seite, einmal der Worker, zusammen rund 167 MB (von den Pruefern
// nachgemessen). Auf dem Handy kostet das Datenvolumen, auf dem Rechner
// lief dabei der Luefter hoch, und solange die Dateien unterwegs waren,
// zeigte das Spiel seine prozeduralen Ersatzgrafiken ("alte Grafiken").
// Jetzt bleibt der Grafikspeicher liegen; pflege() fragt einmal je Fassung
// bedingt nach (ETag/Last-Modified) und holt nur, was sich geaendert hat.
const GRAFIK = 'neuland-grafik-1';
const MARKE = './__grafik-pflege';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-mask.png',
  './js/main.js', './js/ui.js', './js/sim.js', './js/render.js', './js/map.js',
  './js/core.js', './js/sound.js', './js/input.js', './js/save.js', './js/levels.js',
  './js/terrain-gl.js',
];
// Alles, was Programm oder Layout ist – hier zählt Aktualität, nicht Tempo.
// Geprueft wird der PFAD: mit der ganzen Adresse galt 'sw.js?x=1' oder
// 'index.html?info' als Grafik und lief cache-zuerst.
const isCode = (pfad)=> /\.(js|css|html|json|webmanifest)$/i.test(pfad) || pfad.endsWith('/');
const istGrafik = (pfad)=> pfad.indexOf('/assets/')>=0;

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
  // NUR UEBERNEHMEN - KEIN NACHLADEN MEHR IN DIESEM SCHRITT.
  //
  // Hier hing bis v339 das Nachladen aller Grafiken mit in e.waitUntil.
  // Solange das lief, blieb der Worker im Zustand "activating", und der
  // Browser haelt in diesem Zustand JEDE Seitennavigation an: ein Neuladen
  // waehrend des Nachladens zeigte eine weisse Seite, bis alle 610 Dateien
  // durch waren ("nun laedt er es garnicht mehr"). Auch main.js wartete auf
  // "activated", bevor es die neue Fassung uebernahm. Das Aufraeumen alter
  // Speicher und das Pflegen der Grafiken macht jetzt pflege(), angestossen
  // von der Seite, wenn sie mit dem eigenen Laden fertig ist.
  e.waitUntil(self.clients.claim());
});

// GRAFIKPFLEGE: einmal je Fassung, angestossen von der Seite.
//  1. Grafiken aus den alten Fassungsspeichern uebernehmen, dann diese
//     Speicher loeschen (so kostet der Umstieg auf v340 kein Datenvolumen).
//  2. Was nicht mehr im Manifest steht, fliegt raus.
//  3. Jede vorhandene Grafik wird BEDINGT nachgefragt: der Server antwortet
//     mit 304 und ohne Inhalt, wenn sie unveraendert ist. Nur geaenderte und
//     fehlende Dateien werden wirklich uebertragen. Die Liste der geaenderten
//     geht an die Seite, die sie ohne Neuladen austauscht.
// Scheitert etwas, wird die Marke nicht gesetzt und der naechste Start
// macht dort weiter - das Vorhandene bleibt in jedem Fall benutzbar.
let pflegeLauf=null;
async function pflege(){
  const g=await caches.open(GRAFIK);
  const marke=await g.match(MARKE);
  if(marke && (await marke.text())===BUILD) return {neu:[], geholt:0, fehl:0, schon:true};
  for(const k of await caches.keys()){
    if(k===CACHE || k===GRAFIK || !k.startsWith('neuland-')) continue;
    try{
      const alt=await caches.open(k);
      for(const req of await alt.keys()){
        if(!istGrafik(new URL(req.url).pathname)) continue;
        if(await g.match(req)) continue;
        const res=await alt.match(req);
        if(res && res.ok) await g.put(req, res);
      }
    }catch(_){ /* Speicher voll o.ae.: dann eben ohne Umzug */ }
    await caches.delete(k);
  }
  const r=await fetch(new Request('./assets/manifest.json', {cache:'no-cache'}));
  if(!r.ok) throw new Error('manifest');
  const list=await r.json();
  const soll=new Set(list.map(f=> new URL('./assets/'+f, self.registration.scope).href));
  for(const req of await g.keys()){
    if(istGrafik(new URL(req.url).pathname) && !soll.has(req.url)) await g.delete(req);
  }
  const neu=[]; let geholt=0, fehl=0;
  const STAPEL=6;
  for(let i=0;i<list.length;i+=STAPEL){
    await Promise.all(list.slice(i,i+STAPEL).map(async (f)=>{
      const u='./assets/'+f;
      try{
        const hit=await g.match(u);
        const et=hit && hit.headers.get('etag'), lm=hit && hit.headers.get('last-modified');
        if(hit && (et||lm)){
          // eigene Bedingung im Kopf: der Browser reicht das 304 dann durch
          const res=await fetch(u, {headers: et? {'If-None-Match':et} : {'If-Modified-Since':lm}});
          if(res.status===304) return;
          if(res.ok){ await g.put(u, res); neu.push(f); geholt++; }
          // 404 ist eine Antwort, kein Ausfall: die Datei gibt es nicht
          // (mehr). Zaehlte das als Fehler, wuerde die Marke nie gesetzt
          // und die Pflege liefe bei jedem Start von vorn.
          else if(res.status===404) await g.delete(u);
          else fehl++;
        } else {
          // fehlt (oder ohne Pruefmerkmal): ueber den Browserspeicher holen,
          // aber mit Rueckfrage - was die Seite eben erst geladen hat,
          // kommt so ohne zweite Uebertragung hier an
          const res=await fetch(new Request(u, {cache:'no-cache'}));
          if(res.ok){ await g.put(u, res); geholt++; }
          else if(res.status!==404) fehl++;
        }
      }catch(_){ fehl++; }
    }));
  }
  if(!fehl) await g.put(MARKE, new Response(BUILD));
  return {neu, geholt, fehl, schon:false};
}

// Die Seite kann die laufende Fassung erfragen – so lässt sich im Spiel
// ablesen, ob wirklich die neue Version aktiv ist.
self.addEventListener('message', (e)=>{
  if(!e.data) return;
  if(e.data.type==='version' && e.source) e.source.postMessage({type:'version', build:BUILD});
  // Die Seite bittet einen WARTENDEN Worker, endlich zu uebernehmen (s. main.js)
  if(e.data.type==='uebernimm') self.skipWaiting();
  if(e.data.type==='pflege'){
    if(!pflegeLauf) pflegeLauf=pflege().finally(()=>{ pflegeLauf=null; });
    const quelle=e.source;
    e.waitUntil(pflegeLauf.then(erg=>{
      if(quelle) quelle.postMessage(Object.assign({type:'grafik'}, erg));
    }).catch(()=>{}));
  }
});

self.addEventListener('fetch', (e)=>{
  if(e.request.method!=='GET') return;
  let adr;
  try{ adr=new URL(e.request.url); }catch(_){ return; }
  // Fremde Herkunft geht den Worker nichts an (und gehoert nicht in den Speicher)
  if(adr.origin!==self.location.origin) return;
  if(isCode(adr.pathname)){
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
    // Rueckfall NUR aus dem Speicher DIESER Fassung (ignoreSearch: '?info'
    // und '?neu' sind dieselbe Seite). caches.match() ueber alle Speicher
    // konnte eine Datei aus einer aelteren Fassung liefern - ein gemischter
    // Stand aus neuem und altem Code ist schlimmer als ein ehrlicher Fehler.
    const ausSpeicher=(r)=> caches.open(CACHE).then(c=>c.match(r, {ignoreSearch:true}));
    e.respondWith(
      fetch(req).then(res=>{
        if(res.ok){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=> ausSpeicher(e.request).then(hit=>{
        if(hit) return hit;
        // NIEMALS index.html als Antwort auf eine .js- oder .css-Anfrage.
        // Genau das tat der Rueckfall hier bisher: faellt das Netz aus und
        // liegt die Datei nicht im Zwischenspeicher, bekam der Browser ein
        // HTML-Dokument, wo er ein Modul erwartet - das ergibt einen
        // Syntaxfehler ("Unexpected token '<'") statt einer ehrlichen
        // Fehlermeldung, und der Spieler sieht eine leere Seite ohne Grund.
        // Nur eine Seitennavigation darf index.html bekommen; alles andere
        // meldet sauber einen Netzfehler, den die Seite behandeln kann.
        if(e.request.mode==='navigate') return ausSpeicher('./index.html').then(h=> h || Response.error());
        return Response.error();
      }))
    );
    return;
  }
  // Grafiken: Speicher zuerst, das spart auf dem Handy viel Datenvolumen.
  // Spielgrafiken (assets/) liegen im fassungsuebergreifenden Speicher, der
  // Rest (App-Symbole) bei der Fassung. Solange pflege() die alten
  // Fassungsspeicher noch nicht uebernommen hat, wird auch dort gesucht.
  const ziel=istGrafik(adr.pathname)? GRAFIK : CACHE;
  e.respondWith(
    caches.open(ziel).then(c=>c.match(e.request))
      .then(hit=> hit || (ziel===GRAFIK? caches.match(e.request) : undefined))
      .then(hit=>{
        if(hit) return hit;
        // Fehlt die Datei, wird MIT Rueckfrage geholt: was hier landet,
        // bleibt ueber Fassungen liegen und soll nicht zehn Minuten alt sein.
        let req=e.request;
        if(req.mode!=='navigate'){
          try{ req=new Request(e.request, {cache:'no-cache'}); }catch(_){ req=e.request; }
        }
        return fetch(req).then(res=>{
          if(res.ok){
            const copy=res.clone();
            caches.open(ziel).then(c=>c.put(e.request, copy)).catch(()=>{});
          }
          return res;
        });
      }).catch(()=>
        // Auch hier kein index.html als Ersatz fuer ein fehlendes Bild oder
        // einen fehlenden Ton: das Spiel hat fuer beides prozedurale
        // Rueckfaelle und kommt mit einem Fehler besser zurecht als mit
        // einem HTML-Dokument, das es fuer eine Grafik haelt.
        Response.error())
  );
});
