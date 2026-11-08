# Referenzblaetter fuer die Massenprompts

## Warum die Namen keinen Bindestrich haben

Sie hiessen `stilblatt-kamera.png`, `stilblatt-baeume.png` und
`stilblatt-gui.png`. Nutzerbefund nach zwei Lieferungen: "das war die
letzten beiden male ohne bindestrich obwohl gefordert im prompt" - auf dem
Weg vom Repo in den Bildgenerator verliert der Dateiname seinen
Bindestrich, aus `stilblatt-kamera.png` wird `stilblattkamera.png`, und
die `REF:`-Zeile zeigt danach ins Leere.

Statt zu suchen, wo der Strich abhandenkommt, ist er weg: die Blaetter
heissen jetzt genau so, wie sie drueben ankommen. Was keinen Bindestrich
hat, kann keinen verlieren - und auf der Gegenseite muss nichts umbenannt
werden, die heruntergeladenen Dateien passen sofort.

`tools/listenpruefung.py` haelt das fest: sie meldet jede REF-Zeile mit
Bindestrich, jede, die auf kein Blatt in diesem Ordner zeigt, und jedes
Blatt, dessen Dateiname wieder einen bekaeme.

## stilblattkamera.png

`stilblattkamera.png` zeigt acht vorhandene Gebaeude nebeneinander auf
neutralem warmem Grau. Es ist das Referenzbild (`REF:`) in
`docs_massenprompt_baustufen.txt`, `docs_grafikliste.txt` und - fuer die
vier Geologenschilder - in `docs_grafikliste_gui.txt`.
`docs_massenprompt_gebaeude.txt` kommt ohne aus: das ist die Fassung fuer
SDXL Base, und SDXL Base nimmt keine Referenzbilder.

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

## stilblattbaeume.png

Sechs Baeume aus der V2-Lieferung (Buche, Birke, Nadelbaum, Eiche, Fichte,
Setzling) als Stilvorlage fuer die sechs noch alten Baumbilder. Gebaut nach
demselben Verfahren wie das Gebaeudeblatt, aber ohne Warmdrehung - die
Baeume sind bereits im Zielton.

## stilblattgui.png

Zehn Werkstoffausschnitte aus den fertigen Sprites der Lieferung v302
(Dachschindel, Rundholz, Balken, Eisen, Bruchstein, Holzschindel,
Fachwerk, Grundmauer, Dunkelholz, Quaderstein) auf demselben neutralen
Grau. Stilvorlage fuer `docs_grafikliste_gui.txt`.

Warum KEINE Gebaeude auf diesem Blatt: Eine Schaltflaeche wird flach und
frontal gezeichnet. Gaebe man das Kamerablatt als Vorlage, uebernaehme
das Modell die 35-Grad-Aufsicht mit ins Bedienelement - genau der Fehler,
den das Kamerablatt bei den Gebaeuden verhindern soll, nur andersherum.
Gebraucht wird von der GUI nur Werkstoff und Farbe, und die zeigt ein
Ausschnittblatt schaerfer als ein ganzes Haus.

Die vier Geologenschilder in derselben Liste stehen dagegen IN der Welt,
auf zwei Pfosten im Gras. Sie laufen deshalb weiter ueber
`stilblattkamera.png` und den 35-Grad-Satz.

## stilblattfiguren.png

Sechs Figuren aus `assets/` (Holzfaeller, Bauer, Foerster, Baecker,
Zimmermann, Spaeher) als Stilvorlage fuer die Figurenbloecke in
`docs_grafikliste_offen.txt`. Gebaut von `tools/stilblattfiguren.py` nach
demselben Verfahren wie das Baumblatt: frontale Zeile des idle-Blattes,
freigestellt, auf gemeinsame Hoehe, dasselbe neutrale Grau. Ohne
Farbdrehung - die Figurenblaetter laufen seit v308 durch
`tools/figurenpalette.py` und zeigen den Zielton bereits.

Warum sechs verschieden gekleidete: dasselbe Argument wie beim
Gebaeudeblatt. Sechs gleich gekleidete Siedler lesen sich als Vorlage zum
Abmalen, sechs verschiedene als Konvention - Kittel, Schuerze, Hose,
Stiefel, Hut in klar getrennten Farben.

Warum Schmied, Geologe und Traeger NICHT drauf sind: der Kontaktabzug
aller 35 Figuren zeigt genau diese drei als die misslungenen. Der Schmied
war ein grauschwarzer Fleck ohne lesbare Silhouette, der Geologe
malvenfarben, der Traeger trug gar keine Kleidung - eine einfarbig
terrakottafarbene Gestalt mit einem schwarzen Riss vom Bauch bis ins
Bein. Sie waren der Grund fuer das Blatt und durften nicht seine Vorlage
sein.

NACHTRAG v313: die drei sind repariert, ohne neue Grafik - die Ursache
lag nicht am Modell, sondern an drei Rezepten in `tools/tunika.mjs`, die
eine Kennfarbe ueber die ganze Figur legten. Sie sind raus, die Blaetter
neu gebacken, die Modelltexturen ueber `tools/modelltextur.py`
aufgehellt. Ihre Bloecke sind aus `docs_grafikliste_offen.txt` gestrichen;
das Blatt bleibt als Vorlage fuer die naechste Figurenbestellung liegen.
`tools/listenpruefung.py` meldet es bis dahin als "von keiner Liste
genannt" - das ist der Hinweis, nicht der Fehler.
