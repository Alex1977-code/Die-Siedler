// Neuland – Einstiegspunkt
import { UI } from './ui.js';

window.addEventListener('DOMContentLoaded', ()=>{
  window.__ui = new UI();
  // PWA-Serviceworker (offline spielen)
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('./sw.js').then(reg=>{
      // Bei jedem Start nach einer neuen Fassung sehen und sie sofort
      // übernehmen – sonst bleibt der alte Stand bis zum nächsten Neustart.
      reg.update().catch(()=>{});
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='activated' && navigator.serviceWorker.controller) location.reload();
        });
      });
    }).catch(()=>{});
    // laufende Fassung erfragen und im Pausemenü anzeigen
    navigator.serviceWorker.addEventListener('message',(ev)=>{
      if(ev.data && ev.data.type==='version'){
        window.__build=ev.data.build;
        const el=document.getElementById('gm-build');
        if(el) el.textContent='Fassung '+ev.data.build;
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
