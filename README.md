# Neuland – Aufbau-Strategie für Mobilgeräte

Ein Aufbau-Strategiespiel im Geiste der klassischen Siedler-Spiele der 90er –
als **HTML5-PWA**: läuft direkt im Handy-Browser, ist als App installierbar und
funktioniert offline. Alle Grafiken, Sounds und Story-Texte sind Eigenkreationen
dieses Projekts (prozedural erzeugt bzw. neu geschrieben) – es werden keine
Original-Assets fremder Spiele verwendet.

## Features

- **Klassisches Spielprinzip**: Straßen mit Fahnen bauen, Träger transportieren
  Waren, verkettete Wirtschaft (Holzfäller → Sägewerk, Bauernhof → Mühle →
  Bäckerei, Bergwerke → Eisenhütte → Waffenschmiede, Gold → Münzen …)
- **Militär & Eroberung**: Militärgebäude erweitern das Gebiet, Soldaten mit
  5 Rängen, Beförderung per Münzen, Angriffe auf Feindgebäude, Katapulte
- **Kampagne**: 10 Missionen mit eigener Story („Das zerbrochene Königreich"),
  verschiedene Landschaften (Grünland, Winter, Wüste, Moor, Vulkan, Inseln, Gebirge)
- **Freies Spiel**: Zufallskarten mit einstellbarer Größe, Landschaft,
  Rohstoffmenge, Gegneranzahl und -stärke, Seed-Eingabe
- **Mehrspieler**: Echtzeit-Partien gegen 1–3 Computer-Fürsten
  (Online-Multiplayer ist im Menü vorbereitet, benötigt später einen Spielserver)
- **Sound & Musik**: komplett synthetisiert per WebAudio (keine Downloads)
- **Handysteuerung**: Ziehen = scrollen, Kneifen = zoomen, Tippen = bauen,
  langes Drücken = Info; Baumenü als Bottom-Sheet, Minikarte zum Springen
- **Speichern & Laden**: 6 Slots + Autosave (beim Verlassen), Export/Import als Datei
- **Offline & installierbar**: PWA mit Serviceworker

## Spielen

### Lokal starten

```bash
cd Die-Siedler
python3 -m http.server 8080
# dann http://localhost:8080 im Browser öffnen
```

Auf dem Handy: gleiche WLAN-Adresse öffnen (`http://<PC-IP>:8080`) oder das
Verzeichnis auf einen beliebigen statischen Webspace legen (GitHub Pages,
Netlify, …). Im Browser-Menü **„Zum Startbildschirm hinzufügen"** wählen –
dann startet das Spiel im Vollbild wie eine native App und läuft offline.

### GitHub Pages (empfohlen)

Repository-Einstellungen → Pages → Branch wählen → fertig. Das Spiel liegt
komplett im Repo-Wurzelverzeichnis, es ist kein Build-Schritt nötig.

### Als Store-App (Android/iOS)

Das Spiel ist Capacitor-kompatibel (reines statisches HTML/JS ohne Build):

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init Neuland de.example.neuland --web-dir .
npx cap add android
npx cap open android   # in Android Studio bauen & signieren
```

## Kurzanleitung

1. **Holz & Stein**: Holzfäller + Sägewerk + Steinmetz bauen und **per Straße
   mit dem Hauptquartier verbinden** (ohne Straße kein Warentransport!).
2. **Nahrung**: Fischer/Jäger oder Bauernhof → Mühle → Bäckerei (+ Brunnen).
   Bergwerke arbeiten nur mit Essen.
3. **Militär**: Brauerei + Waffenschmiede liefern Bier/Schwert/Schild → im HQ
   entstehen Rekruten. Militärgebäude an der Grenze erweitern das Gebiet.
4. **Angriff**: Feindliches Militärgebäude antippen, Truppenstärke wählen.
   Fällt das gegnerische Hauptquartier, ist der Feind besiegt.

## Technik

- Vanilla JS (ES-Module), kein Framework, kein Build-Schritt
- `js/sim.js` – Simulation (Wirtschaft, Logistik/Träger, Militär, KI)
- `js/map.js` – Kartengenerator (Hex-Punktgitter, Biome, Erz, Startplätze)
- `js/render.js` – Canvas-Renderer (Chunk-Cache, prozedurale Sprites)
- `js/ui.js` – Bildschirme, HUD, Baumenü, Spielschleife
- `js/sound.js` – WebAudio-Synthese (Effekte + generative Musik)
- `js/levels.js` – Kampagnen-Missionen und Story
- `js/save.js` – Spielstände (localStorage + Datei-Export)

## Roadmap

- Online-Multiplayer (Lockstep über WebRTC/Spielserver)
- Häfen & Schiffe, Geologen/Späher, Werkzeug-Wirtschaft
- Weitere Kampagnenkapitel
