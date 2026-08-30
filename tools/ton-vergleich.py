# Tonwert-Vergleich gegen das Referenzbild. Immer dieselbe Klassifikation,
# damit die Zahlen ueber die Runden vergleichbar bleiben.
import sys, statistics as st
from PIL import Image
def mess(pfad, box, titel):
    im=Image.open(pfad).convert('RGB'); W,H=im.size
    x0,y0,x1,y1=[int(v*s) for v,s in zip(box,(W,H,W,H))]
    gras=[];fels=[]
    for y in range(y0,y1,2):
      for x in range(x0,x1,2):
        r,g,b=im.getpixel((x,y)); mx,mn=max(r,g,b),min(r,g,b); s=(mx-mn)/max(1,mx)
        L=0.299*r+0.587*g+0.114*b
        if g>r and g>b and s>0.22: gras.append(L)
        elif s<0.20 and mx>90: fels.append(L)
    p=lambda L,q: sorted(L)[int(len(L)*q)] if L else 0
    print(titel.ljust(16),
          'Gras p50/p90/Streu', round(p(gras,0.5),1), round(p(gras,0.9),1), round(st.pstdev(gras),1),
          '| Fels p90', round(p(fels,0.9),1),
          '| Fels/Gras p90', round(p(fels,0.9)/max(1,p(gras,0.9)),2))
mess('/root/.claude/uploads/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/c3ec66fc-image.jpg',(0.30,0.10,0.95,0.72),'ZIEL Referenz')
for f in sys.argv[1:]:
    mess('/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/'+f,(0.0,0.0,1.0,1.0),f)
