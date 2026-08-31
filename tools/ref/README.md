# Referenzblatt fuer die Gebaeude-Lieferung

`stilblatt-kamera.png` zeigt acht vorhandene Gebaeude nebeneinander auf
neutralem warmem Grau. Es dient als Referenzbild (`REF:`) fuer den
Massenprompt in `docs_massenprompt_gebaeude.txt`.

Warum ein Blatt mit mehreren Bauten und nicht ein einzelnes Gebaeude:
Bei einer Referenz mit nur einem Haus uebernimmt das Modell dessen
Bauform in alle Bloecke - dann sieht die Baeckerei aus wie die
Waffenkammer. Acht verschiedene Formen lesen sich als Konvention.

Warum ueberhaupt eine Referenz: Bodenplatte und Kamerahoehe waren mit
Text nicht steuerbar. Sechs Runden mit sechs Formulierungen brachten
jedes Mal eine Platte zurueck, weil in den Trainingsdaten fast jedes
Gebaeude-Spielobjekt auf einer Kachel sitzt. Gegen diesen Prior gewinnt
kein Negativfeld. Aus einem Referenzbild kommen Winkel und Freisteller
dagegen direkt.

Erzeugung: acht formverschiedene Sprites aus `assets/`, ausgewaehlt nach
"kein Gruen am Fuss" (gemessen im unteren Fuenftel; `bld_well` 2,2 % und
`bld_farm` 8,0 % fielen deshalb raus). Die Farben laufen durch dieselbe
Rechnung wie `palBld()` in `js/render.js`, aber mit Faktor 2,6 statt 1,0
auf der Kaltdrehung - das Blatt soll das ZIEL zeigen, nicht den
Ist-Zustand, deshalb sind die blaugrauen Daecher hier staerker ins Warme
gedreht als im Spiel.

## stilblatt-baeume.png

Sechs Baeume aus der V2-Lieferung (Buche, Birke, Nadelbaum, Eiche, Fichte,
Setzling) als Stilvorlage fuer die sechs noch alten Baumbilder. Gebaut nach
demselben Verfahren wie das Gebaeudeblatt, aber ohne Warmdrehung - die
Baeume sind bereits im Zielton.
