# Neuland — Arbeitsregeln

## Zwei Zweige: Arbeitsstand und Live-Stand

- **`claude/siedler-2-mobile-clone-0rc5db`** ist der Arbeitszweig. Hier wird
  entwickelt, gemessen und gepusht — auch mehrmals am Tag, auch unfertige
  Zwischenstände.
- **`live`** ist der Stand, den GitHub Pages ausliefert. Er wird **nur auf
  ausdrückliche Freigabe** vorgezogen, nie beiläufig und nie als Teil eines
  normalen Arbeitsschritts.
- **`main`** ist ein alter, getrennt gewachsener Stand (Uploads über die
  GitHub-Weboberfläche). Er wird nicht angefasst.

Ein Stand geht also erst live, wenn er ausprobiert und für gut befunden
wurde — vorher ist er über den Arbeitszweig jederzeit einsehbar, aber nicht
veröffentlicht.

## Auslieferung eines Arbeitsstands (unverändert)

Jeder Ship auf den Arbeitszweig: `tools/kd5-test.mjs` grün, `BUILD` in
`sw.js` hochzählen, Commit auf Deutsch, Push.

## Messdisziplin

Erwartung vor der Messung festhalten, gescheiterte Varianten ehrlich
verwerfen und den Fehlschlag mit Zahlen im Code dokumentieren — die
Kommentare in `js/sim.js` sind das Gedächtnis des Projekts.

`ctx.filter` ist im Canvas tabu (iOS).
