import sys, json
from PIL import Image, ImageDraw
m=sys.argv[1]; Z='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/ww-'+m+'/'
L=json.load(open(Z+'labels.json')); W,SP=L['W'],L['SP']
C=200
bl=Image.new('RGB',(len(SP)*C+130, len(W)*(C+12)),(96,110,100)); d=ImageDraw.Draw(bl)
for i,w in enumerate(W):
    for j,k in enumerate(SP):
        im=Image.open('%s%d_%d.png'%(Z,i,k)).convert('RGBA').resize((C,C),Image.LANCZOS)
        bg=Image.new('RGB',(C,C),(96,110,100)); bg.paste(im,(0,0),im)
        bl.paste(bg,(130+j*C,i*(C+12)))
        if i==0: d.text((130+j*C+4,2),'Spalte %d'%k,fill=(255,255,0))
    d.text((4,i*(C+12)+C//2),w,fill=(255,255,0))
bl.save(Z+'../ww_%s.png'%m); print(Z+'../ww_%s.png'%m, bl.size)
