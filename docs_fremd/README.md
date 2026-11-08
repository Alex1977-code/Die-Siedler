# Patches fuer andere Repositorien

Hier liegen Aenderungen, die in dieser Sitzung entstanden sind, aber NICHT
zu Neuland gehoeren. Sie liegen hier, damit sie nicht verlorengehen - die
Sitzung konnte das Zielrepository nur lesen, nicht beschreiben.

## massenprompt-drag-and-drop.patch

Ziel: `Alex1977-code/Bildgenerator`, Datei `lib/screens/generator_screen.dart`.

Nimmt Text- und Markdown-Dateien per Ziehen und Fallenlassen in das
Massenprompt-Feld auf (.txt, .md, .markdown, .text, .prompt). Ist das Feld
leer, wird gesetzt; steht schon etwas darin, wird mit einer Trennzeile
angehaengt, damit Getipptes nicht verlorengeht. BOM und Windows-Zeilenenden
werden abgefangen, die Dekodierung laeuft mit allowMalformed.

Anwenden im Bildgenerator-Verzeichnis:

    git apply massenprompt-drag-and-drop.patch

NICHT kompiliert: in der Sitzungsumgebung gibt es kein Dart und kein
Flutter. Geprueft wurde die Klammerbilanz ohne Texte und Kommentare
(vorher 1153/1153 runde und 158/158 geschweifte, nachher 1200/1200 und
166/166). Nach dem Anwenden `flutter analyze` laufen lassen.
