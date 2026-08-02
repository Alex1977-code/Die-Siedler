// Neuland – Speichern & Laden (localStorage-Slots + Datei-Export/Import).
const PREFIX='neuland.save.';
const PROG_KEY='neuland.progress';
const OPT_KEY='neuland.options';

export const SLOTS=['auto','1','2','3','4','5','6'];

export function saveSlot(slot, game, label){
  try{
    const data=game.serialize();
    const meta={ label, date:Date.now(), t:game.t,
      mission:game.setup.level? game.setup.level.title : null,
      mode:game.setup.mode||'frei' };
    localStorage.setItem(PREFIX+slot, JSON.stringify({meta,data}));
    return true;
  }catch(e){ console.warn('Speichern fehlgeschlagen', e); return false; }
}
export function loadSlot(slot){
  try{
    const raw=localStorage.getItem(PREFIX+slot);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
export function deleteSlot(slot){ localStorage.removeItem(PREFIX+slot); }
export function listSlots(){
  return SLOTS.map(s=>{
    const d=loadSlot(s);
    return { slot:s, meta:d?d.meta:null };
  });
}
export function exportSave(game){
  const blob=new Blob([JSON.stringify({meta:{date:Date.now()},data:game.serialize()})],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='neuland-spielstand.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
export function importSave(file){
  return file.text().then(t=>JSON.parse(t));
}

export function getProgress(){
  try{ return JSON.parse(localStorage.getItem(PROG_KEY))||{unlocked:1}; }
  catch(e){ return {unlocked:1}; }
}
export function setProgress(p){ localStorage.setItem(PROG_KEY, JSON.stringify(p)); }

// Standardbelegung der Warenleiste: Baustoffe, Nahrung und Werkzeug
export const HUD_DEFAULT=['trunk','board','stone','fish','meat','grain','water','shovel','hammer','axe','saw'];
export function getOptions(){
  try{ return Object.assign({sfx:true,music:true,speed:1,hudGoods:HUD_DEFAULT}, JSON.parse(localStorage.getItem(OPT_KEY))||{}); }
  catch(e){ return {sfx:true,music:true,speed:1,hudGoods:HUD_DEFAULT}; }
}
export function setOptions(o){ localStorage.setItem(OPT_KEY, JSON.stringify(o)); }
