// Gemeinsamer Start für alle Messwerkzeuge - und der Grund, warum es ihn
// gibt.
//
// Die Werkzeuge starteten bisher ein Spiel und warteten pauschal 2200 ms,
// bevor sie die Simulation selbst weiterschalteten. In dieser Wartezeit
// laeuft das Spiel aber in ECHTZEIT mit: die Bedienschleife ruft
// game.update() bei jedem Bild. Wie viele Takte dabei zusammenkommen,
// haengt an der Rechnerlast - und damit war jede Messung ein Stueck weit
// Zufall. Zwei Laeufe derselben Datei auf denselben Saaten lieferten
// nachweislich 198 gegen 202 Soldaten.
//
// Hier wird die Bedienschleife deshalb stillgelegt, BEVOR das Spiel
// beginnt: ui.paused wird auf einen Getter umgebogen, der immer wahr
// liefert. Das Spiel startet damit bei Takt 0 und bewegt sich nur noch,
// wenn das Messwerkzeug selbst g.step() ruft. Der Setter im Startpfad
// (ui.paused=false) laeuft ins Leere.
//
// Gezeichnet wird weiterhin - das kostet zwar Zeit, haelt die Messung
// aber nah am echten Spiel und faengt Renderfehler mit ab.

export const SERVER='http://127.0.0.1:8901/';

// Startet ein freies Spiel und gibt garantiert bei Takt 0 zurueck.
export async function starteSpiel(page, {saat, groesse='M', gegner='1'}={}){
  await page.goto(SERVER, {waitUntil:'load'});
  // Riegel VOR dem Start setzen: ui existiert schon, das Spiel noch nicht.
  await page.evaluate(()=>{
    const ui=window.__ui;
    if(!ui || ui.__messRiegel) return;
    ui.__messRiegel=true;
    Object.defineProperty(ui, 'paused', {
      configurable:true,
      get(){ return true; },
      set(){ /* der Startpfad setzt hier false - wird verworfen */ },
    });
  });
  await page.click('#bt-free');
  await page.selectOption('#f-size', groesse);
  await page.selectOption('#f-ais', String(gegner));
  await page.fill('#f-seed', String(saat));
  await page.click('#f-start');
  await page.waitForFunction(()=> !!(window.__ui && window.__ui.game), null, {timeout:15000});
  // Beweis mitliefern: wer hier nicht bei 0 steht, misst nicht das, was er glaubt
  return await page.evaluate(()=> window.__ui.game.t);
}
