// Neuland – Kampagne „Das zerbrochene Königreich" (eigene Story & Texte).
export const CAMPAIGN = [
  {
    id:1, title:'Gestrandet', theme:'gruen', size:'S', seed:11071, ais:[],
    story:'Die große Flut hat unser Königreich verschlungen. Nach Wochen auf See erreichen '
      +'die letzten Schiffe von Königin Maras Volk eine grüne, unbekannte Küste. '
      +'\n\nBaumeister Ansgar tritt vor: „Wir haben Hände, Werkzeug und Hoffnung. Mehr braucht es nicht." '
      +'\n\nErrichte die erste Siedlung: Wir brauchen Holz und Stein für alles Weitere.',
    objectives:[
      {type:'build', bld:'woodcutter', count:1, desc:'Baue einen Holzfäller'},
      {type:'build', bld:'sawmill', count:1, desc:'Baue ein Sägewerk'},
      {type:'build', bld:'quarry', count:1, desc:'Baue einen Steinmetz'},
      {type:'good', good:'board', count:25, desc:'Lagere 25 Bretter'},
    ],
    tips:'Tippe auf einen freien Punkt in deinem Gebiet, um zu bauen. Verbinde jedes Gebäude '
      +'mit einer Straße zum Hauptquartier – sonst werden keine Waren transportiert!',
  },
  {
    id:2, title:'Brot und Erz', theme:'gruen', size:'S', seed:22083, ais:[],
    story:'Die Siedlung wächst, doch die Wintervorräte schwinden. Kundschafter melden Erzadern '
      +'in den Bergen im Landesinneren. „Bergleute arbeiten nicht mit leerem Magen", warnt Ansgar. '
      +'\n\nBaue eine Nahrungskette auf und beginne mit dem Bergbau.',
    objectives:[
      {type:'build', bld:'farm', count:1, desc:'Baue einen Bauernhof'},
      {type:'build', bld:'bakery', count:1, desc:'Baue eine Bäckerei'},
      {type:'good', good:'coal', count:8, desc:'Fördere 8 Kohle'},
      {type:'good', good:'iron', count:4, desc:'Schmilz 4 Eisen'},
    ],
    tips:'Bauernhof → Mühle → Bäckerei (mit Brunnen). Bergwerke stehen im Gebirge und brauchen Essen. '
      +'Die Eisenhütte macht aus Erz und Kohle Eisen.',
  },
  {
    id:3, title:'Die Aschehand', theme:'gruen', size:'M', seed:33091, ais:[{name:'Aschehand', lvl:1}],
    story:'Wir sind nicht allein. Der Clan der Aschehand brandschatzt unsere Außenposten und '
      +'verhöhnt die Königin. Diplomatie ist gescheitert. '
      +'\n\n„Dann sprechen jetzt die Schwerter", sagt Hauptmann Rurik leise. '
      +'\n\nRüste Soldaten aus und vertreibe die Aschehand von dieser Insel.',
    objectives:[
      {type:'soldiers', count:6, desc:'Stelle 6 Soldaten auf'},
      {type:'destroyEnemies', desc:'Besiege die Aschehand'},
    ],
    tips:'Soldaten entstehen im Hauptquartier aus Bier, Schwert und Schild. Militärgebäude erweitern '
      +'dein Gebiet. Tippe auf ein feindliches Militärgebäude, um anzugreifen.',
  },
  {
    id:4, title:'Frostiges Land', theme:'winter', size:'M', seed:44117, ais:[{name:'Salzwölfe', lvl:1}],
    story:'Die Suche nach den verstreuten Schiffen unseres Volkes führt uns in den eisigen Norden. '
      +'Hier herrschen die Salzwölfe – Plünderer, die Gefangene aus unseren Reihen halten. '
      +'\n\nDer Boden ist hart, Holz ist knapp. Befreie unsere Leute!',
    objectives:[
      {type:'build', bld:'forester', count:1, desc:'Baue einen Förster (Holz ist knapp!)'},
      {type:'destroyEnemies', desc:'Besiege die Salzwölfe'},
    ],
    tips:'Im Winterland wachsen Bäume langsam – ein Förster sichert den Nachschub. Steinbergwerke '
      +'liefern Steine, wenn Felsbrocken fehlen.',
  },
  {
    id:5, title:'Durst der Wüste', theme:'wueste', size:'M', seed:55129, ais:[{name:'Dornenbund', lvl:2}],
    story:'Alte Karten zeigen eine Handelsstraße durch die große Wüste – und ein Tor aus der Zeit '
      +'vor der Flut. Doch der Dornenbund kontrolliert die einzige Oase. '
      +'\n\n„Wasser ist hier mehr wert als Gold", flüstert die Kartographin. „Und sie wissen das."',
    objectives:[
      {type:'build', bld:'well', count:2, desc:'Sichere die Wasserversorgung (2 Brunnen)'},
      {type:'destroyEnemies', desc:'Besiege den Dornenbund'},
    ],
    tips:'In der Wüste zählt jede Straße doppelt: Halte Wege kurz, baue früh ein zweites Lagerhaus.',
  },
  {
    id:6, title:'Zwei Feuer', theme:'gruen', size:'M', seed:66143, ais:[{name:'Aschehand', lvl:2},{name:'Salzwölfe', lvl:2}],
    story:'Die Reste der Aschehand haben sich mit den Salzwölfen verbündet. Ihre Boten reiten '
      +'zwischen zwei Lagern hin und her – noch. '
      +'\n\n„Wenn zwei Feuer brennen", sagt Rurik, „löscht man erst das nähere." '
      +'\n\nBehaupte dich gegen beide Clans.',
    objectives:[
      {type:'destroyEnemies', desc:'Besiege beide Clans'},
    ],
    tips:'Sichere deine Grenzen mit Wachtürmen, bevor du angreifst. Münzen befördern Soldaten – '
      +'Veteranen kämpfen deutlich besser.',
  },
  {
    id:7, title:'Das Goldtal', theme:'gebirge', size:'M', seed:77157, ais:[{name:'Eisenkrone', lvl:2}],
    story:'Tief in den Bergen liegt das Goldtal, einst Schatzkammer des alten Königreichs. '
      +'Der Clan der Eisenkrone schürft dort mit tausend Sklavenhänden. '
      +'\n\nMara: „Nicht das Gold treibt mich. Es ist das, was sie mit Menschen tun." '
      +'\n\nErobere das Tal und präge eigene Münzen.',
    objectives:[
      {type:'good', good:'coin', count:10, desc:'Präge 10 Münzen'},
      {type:'destroyEnemies', desc:'Besiege die Eisenkrone'},
    ],
    tips:'Goldbergwerk + Kohle + Münzprägerei. Verteile Münzen an Festungen nahe der Front.',
  },
  {
    id:8, title:'Nebelmoor', theme:'sumpf', size:'M', seed:88171, ais:[{name:'Moorschatten', lvl:2}],
    story:'Das Nebelmoor verschluckt Wege und Wanderer. Irgendwo dort draußen liegt der letzte '
      +'Zufluchtsort der Flüchtlinge des Ostens – belagert von den Moorschatten. '
      +'\n\nSchmale Pfade, wenig Baugrund: Hier entscheidet kluge Planung, nicht Masse.',
    objectives:[
      {type:'build', bld:'catapult', count:1, desc:'Baue ein Katapult'},
      {type:'destroyEnemies', desc:'Besiege die Moorschatten'},
    ],
    tips:'Katapulte beschießen feindliche Militärgebäude in Reichweite – perfekt für Engstellen im Moor.',
  },
  {
    id:9, title:'Der Feuerberg', theme:'vulkan', size:'L', seed:99187, ais:[{name:'Eisenkrone', lvl:3},{name:'Dornenbund', lvl:2}],
    story:'Am Fuß des Feuerbergs schmieden die Reste der Eisenkrone neue Waffen – mit der Glut '
      +'des Vulkans selbst. Asche verdunkelt den Himmel, Lava frisst das Land. '
      +'\n\n„Wer hier siegt", sagt Rurik, „dem gehört der Weg zur alten Hauptstadt."',
    objectives:[
      {type:'territory', count:900, desc:'Kontrolliere 900 Felder Land'},
      {type:'destroyEnemies', desc:'Besiege beide Clans'},
    ],
    tips:'Lava blockiert Wege und Bauplätze. Granitminen ersetzen fehlende Felsbrocken.',
  },
  {
    id:10, title:'Das Tor der Ahnen', theme:'inseln', size:'L', seed:101199, gate:true,
    ais:[{name:'Aschehand', lvl:3},{name:'Salzwölfe', lvl:3},{name:'Eisenkrone', lvl:3}],
    story:'Alle Spuren führten hierher: Auf dem größten der Inselreiche steht das Tor der Ahnen, '
      +'erbaut vor der Flut, Schlüssel zur versunkenen Hauptstadt. Drei Clans lagern davor – '
      +'vereint nur in ihrem Hass auf uns. '
      +'\n\nMara zieht das Schwert ihrer Mutter: „Heute endet die Flucht. Heute beginnt Neuland." '
      +'\n\nBesetze das Tor der Ahnen!',
    objectives:[
      {type:'occupy', desc:'Bringe das Tor der Ahnen in dein Gebiet'},
      {type:'destroyEnemies', desc:'Besiege alle drei Clans'},
    ],
    tips:'Das große Finale: Sichere früh Gold und Münzen, halte deine Front schmal und nutze Katapulte.',
  },
];

export const EPILOG =
  'Das Tor der Ahnen erstrahlt, und mit ihm hebt sich die versunkene Hauptstadt aus dem Meer der '
  +'Erinnerung. Königin Mara steht auf den alten Mauern, hinter ihr ein Volk, das alles verlor – '
  +'und alles neu erbaute.\n\n„Nennt dieses Land nicht Ersatz", sagt sie. „Nennt es, was es ist: Neuland."\n\n'
  +'Danke fürs Spielen! Im Freien Spiel und im Mehrspielermodus warten unendlich viele weitere Karten.';
