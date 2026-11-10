// Neuland – Einstiegspunkt
import { UI } from './ui.js';

window.addEventListener('DOMContentLoaded', ()=>{
  window.__ui = new UI();
  // PWA-Serviceworker (offline spielen)
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    // Beim allerersten Besuch übernimmt der Worker die Seite ohnehin – dann
    // wäre ein Neuladen nur ein überflüssiges Flackern. Gemerkt wird deshalb,
    // ob vorher schon einer die Regie hatte.
    const hatteWorker = !!navigator.serviceWorker.controller;
    const uebernehmen = ()=>{
      // Mitten in einer Partie nicht einfach neu laden: erst sichern, und
      // wenn gespielt wird, nur Bescheid geben statt den Spielfluss zu kappen.
      const ui=window.__ui;
      if(ui && ui.game && !ui.game.over){
        window.__update=true;
        const el=document.getElementById('gm-build');
        if(el) el.textContent='Neue Fassung bereit – beim nächsten Start aktiv';
        return;
      }
      // HOECHSTENS EIN SELBSTTAETIGES NEULADEN JE MINUTE.
      //
      // Hier stand ein ungebremstes location.reload(). Meldet der Browser
      // den Worker wiederholt als neu - etwa weil er wegen der Cache-Header
      // von GitHub Pages mal die alte, mal die neue sw.js sieht -, laedt die
      // Seite in einer Schleife neu. Ein Dauerlauf, der den Rechner heiss
      // werden laesst. Der Merker liegt im sessionStorage und traegt die
      // UHRZEIT: v338 merkte sich nur "schon einmal", und ein Fenster, das
      // tagelang offen blieb, uebernahm danach nie wieder eine neue Fassung
      // von selbst. Eine Minute Abstand bricht jede Schleife und laesst das
      // Update von heute Nachmittag trotzdem durch.
      try{
        const zuletzt=+sessionStorage.getItem('neuland.neugeladen')||0;
        if(Date.now()-zuletzt<60000) return;
        sessionStorage.setItem('neuland.neugeladen', String(Date.now()));
      }catch(_){ /* privater Modus: dann eben ohne Bremse */ }
      location.reload();
    };
    navigator.serviceWorker.register('./sw.js').then(reg=>{
      // Bei jedem Start nach einer neuen Fassung sehen und sie sofort
      // übernehmen – sonst bleibt der alte Stand bis zum nächsten Neustart.
      reg.update().catch(()=>{});
      const beobachten=(nw)=>{
        if(!nw || nw._beobachtet) return;
        nw._beobachtet=true;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='activated' && hatteWorker) uebernehmen();
        });
      };
      reg.addEventListener('updatefound',()=> beobachten(reg.installing));
      // Der Browser sucht bei jeder Navigation selbst nach einer neuen
      // sw.js. War er damit schneller als diese Zeile, ist 'updatefound'
      // schon vorbei und kaeme nie hier an (nachgemessen beim Umstieg von
      // v339: die Seite blieb ohne Neuladen unter dem neuen Worker stehen).
      beobachten(reg.installing); beobachten(reg.waiting);
      // EIN WARTENDER WORKER, DER NICHT UEBERNIMMT.
      //
      // Gemessen (v339 wie v340, Chromium): in etwa jedem dritten Wechsel
      // blieb der neue Worker trotz skipWaiting() im Zustand "waiting"
      // haengen - nach 100 Sekunden noch, und ohne dass im alten Worker ein
      // Ereignis offen war. Die Seite lief so lange unter dem alten Worker
      // weiter; ein Neuladen loeste es sofort. Das ist ein moeglicher Grund
      // fuer "am rechner wurde eine alte version geladen".
      // Deshalb sieht die Seite selbst nach: wartet nach acht Sekunden noch
      // ein Worker, wird er erst gebeten zu uebernehmen, und wenn auch das
      // nichts bewegt, laedt die Seite neu (uebernehmen() schont eine
      // laufende Partie und bremst Schleifen).
      const nachsehen=(stufe)=>{
        if(!reg.waiting) return;
        if(stufe===0){
          try{ reg.waiting.postMessage({type:'uebernimm'}); }catch(_){}
          setTimeout(()=>nachsehen(1), 5000);
        } else uebernehmen();
      };
      setTimeout(()=>nachsehen(0), 8000);
      // Als Heimbildschirm-App wird auf dem Handy meist nur in den
      // Hintergrund gewechselt, nie neu gestartet - ohne diesen Anstoß
      // sucht der Browser dann NIE nach einer neuen Fassung ("v264 nicht
      // am handy"). Bei jeder Rückkehr in den Vordergrund nachsehen; die
      // updatefound-Kette oben übernimmt den Rest.
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible') reg.update().catch(()=>{});
      });
    }).catch(()=>{});
    // laufende Fassung erfragen und im Pausemenü anzeigen
    navigator.serviceWorker.addEventListener('message',(ev)=>{
      if(!ev.data) return;
      if(ev.data.type==='version'){
        window.__build=ev.data.build;
        const el=document.getElementById('gm-build');
        if(el && !window.__update) el.textContent='Fassung '+ev.data.build;
      }
      // Der Worker hat geaenderte Grafiken geholt: im laufenden Spiel tauschen
      if(ev.data.type==='grafik' && ev.data.neu && ev.data.neu.length){
        const r=window.__ui && window.__ui.renderer;
        if(r && r.grafikNeu) r.grafikNeu(ev.data.neu);
      }
    });
    const fragen=()=>{
      const w=navigator.serviceWorker.controller;
      if(w) w.postMessage({type:'version'});
    };
    navigator.serviceWorker.ready.then(reg=>{
      if(reg.active) reg.active.postMessage({type:'version'});
    }).catch(()=>{});
    // Wechselt der Worker, waehrend die Seite offen bleibt (mitten in einer
    // Partie wird nicht neu geladen), stand im Pausemenue weiter die alte
    // Fassung. Beim Wechsel neu erfragen.
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{ fragen(); pflegen(); });
    // GRAFIKPFLEGE ANSTOSSEN - erst, wenn die Seite selbst mit dem Laden
    // durch ist. So holt der Worker nichts, was gerade ohnehin unterwegs
    // ist (bis v339 luden Seite und Worker dieselben 84 MB gleichzeitig).
    // Der Anstoss geht an den Worker, der GERADE die Regie hat. Ist das
    // noch einer von vor v340, antwortet er nicht - deshalb wird beim
    // Wechsel des Workers (controllerchange, s. oben) erneut angestossen.
    // Doppelte Anstoesse sind harmlos: der Worker laesst nur eine Pflege
    // gleichzeitig laufen und ist nach der ersten mit einem Blick fertig.
    function pflegen(){
      const r=window.__ui && window.__ui.renderer, L=r && r.ladeStand;
      if(!L || !L.soll || L.offen>0){ setTimeout(pflegen, 3000); return; }
      navigator.serviceWorker.ready.then(reg=>{
        const w=navigator.serviceWorker.controller || reg.active;
        if(w) w.postMessage({type:'pflege'});
      }).catch(()=>{});
    }
    setTimeout(pflegen, 3000);
  }
});
// Fehler sichtbar machen (Debug-Hilfe auf Mobilgeräten)
window.addEventListener('error',(e)=>{
  console.error(e.error||e.message);
});
