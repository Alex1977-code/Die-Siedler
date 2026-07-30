// Neuland – Einstiegspunkt
import { UI } from './ui.js';

window.addEventListener('DOMContentLoaded', ()=>{
  window.__ui = new UI();
  // PWA-Serviceworker (offline spielen)
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
});
// Fehler sichtbar machen (Debug-Hilfe auf Mobilgeräten)
window.addEventListener('error',(e)=>{
  console.error(e.error||e.message);
});
