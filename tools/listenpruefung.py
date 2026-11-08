# -*- coding: utf-8 -*-
"""Massenprompt-Listen pruefen, bevor sie rausgehen.

Der Bildgenerator liest Bloecke, die mit NAME: und PROMPT: beginnen und
durch eine Zeile aus DREI BINDESTRICHEN getrennt sind. Ein '---' mitten in
einer Beschreibung zaehlt dort nicht mit, hier auch nicht.

REFERENZBILDER OHNE BINDESTRICH. Nutzerbefund: "das war die letzten beiden
male ohne bindestrich obwohl gefordert im prompt" - auf dem Weg vom Repo
zum Bildgenerator verliert der Dateiname seinen Bindestrich, aus
stilblatt-kamera.png wird stilblattkamera.png. Die REF-Zeile zeigte danach
ins Leere. Statt zu suchen, wo der Strich abhandenkommt, tragen die
Blaetter jetzt einwortige Namen: was keinen Bindestrich hat, kann keinen
verlieren. Diese Pruefung haelt das fest.

    python3 tools/listenpruefung.py
"""
import glob, os, re, sys

REFDIR = 'tools/ref'
fehler = []

for pfad in sorted(glob.glob('docs_massenprompt_*.txt') + glob.glob('docs_grafikliste*.txt')):
    text = open(pfad, encoding='utf-8').read()
    zeilen = text.split('\n')
    trenner = sum(1 for z in zeilen if z.strip() == '---')
    bloecke = [b for b in re.split(r'(?m)^---$', text) if b.strip()]
    namen = []
    for b in bloecke:
        n = re.search(r'(?m)^NAME:\s*(\S+)\s*$', b)
        p = re.search(r'(?m)^PROMPT:\s*\S', b)
        if not n:  fehler.append('%s: Block ohne NAME-Zeile' % pfad); continue
        if not p:  fehler.append('%s: %s ohne PROMPT-Zeile' % (pfad, n.group(1)))
        namen.append(n.group(1))
        for r in re.findall(r'(?m)^REF:\s*(\S+)\s*$', b):
            if '-' in r:
                fehler.append('%s: %s -> REF "%s" traegt einen Bindestrich - '
                              'der geht auf dem Weg zum Bildgenerator verloren' % (pfad, n.group(1), r))
            if not os.path.exists(os.path.join(REFDIR, r)):
                fehler.append('%s: %s -> REF "%s" liegt nicht in %s/' % (pfad, n.group(1), r, REFDIR))
    if trenner != len(bloecke) - 1:
        fehler.append('%s: %d Bloecke, aber %d Trennzeilen (erwartet %d)'
                      % (pfad, len(bloecke), trenner, len(bloecke) - 1))
    doppelt = {x for x in namen if namen.count(x) > 1}
    if doppelt:
        fehler.append('%s: doppelte Namen %s' % (pfad, sorted(doppelt)))
    refs = sorted({r for r in re.findall(r'(?m)^REF:\s*(\S+)\s*$', text)})
    print('%-34s %2d Bloecke, %2d Trennzeilen, REF: %s'
          % (pfad, len(bloecke), trenner, ', '.join(refs) or '-'))

# Blaetter, die niemand nennt, und Namen mit Bindestrich im Ordner selbst
genannt = set()
for pfad in glob.glob('docs_massenprompt_*.txt') + glob.glob('docs_grafikliste*.txt'):
    genannt |= set(re.findall(r'(?m)^REF:\s*(\S+)\s*$', open(pfad, encoding='utf-8').read()))
for p in sorted(glob.glob(REFDIR + '/*.png')):
    n = os.path.basename(p)
    if '-' in n:
        fehler.append('%s: Dateiname traegt einen Bindestrich' % p)
    if n not in genannt:
        print('Hinweis: %s wird von keiner Liste genannt' % p)

if fehler:
    print('\nFEHLER:'); [print(' -', f) for f in fehler]; sys.exit(1)
print('\nAlles in Ordnung.')
