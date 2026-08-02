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
      location.reload();
    };
    navigator.serviceWorker.register('./sw.js').then(reg=>{
      // Bei jedem Start nach einer neuen Fassung sehen und sie sofort
      // übernehmen – sonst bleibt der alte Stand bis zum nächsten Neustart.
      reg.update().catch(()=>{});
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='activated' && hatteWorker) uebernehmen();
        });
      });
    }).catch(()=>{});
    // laufende Fassung erfragen und im Pausemenü anzeigen
    navigator.serviceWorker.addEventListener('message',(ev)=>{
      if(ev.data && ev.data.type==='version'){
        window.__build=ev.data.build;
        const el=document.getElementById('gm-build');
        if(el && !window.__update) el.textContent='Fassung '+ev.data.build;
      }
    });
    navigator.serviceWorker.ready.then(reg=>{
      if(reg.active) reg.active.postMessage({type:'version'});
    }).catch(()=>{});
  }
});
// Fehler sichtbar machen (Debug-Hilfe auf Mobilgeräten)
window.addEventListener('error',(e)=>{
  console.error(e.error||e.message);
});
