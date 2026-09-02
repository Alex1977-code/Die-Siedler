import sys, glob
from PIL import Image, ImageDraw
m=sys.argv[1]; Z='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/'
ims=[Image.open(Z+'pb_%s_%d.png'%(m,k)).convert('RGBA') for k in range(8)]
W,H=ims[0].size
bl=Image.new('RGB',(W*4,H*2+30),(96,110,100)); d=ImageDraw.Draw(bl)
for k,im in enumerate(ims):
    x,y=(k%4)*W,(k//4)*(H+15)
    bg=Image.new('RGB',(W,H),(96,110,100)); bg.paste(im,(0,0),im)
    bl.paste(bg,(x,y)); d.text((x+4,y+H+1),str(k)+(' KONTAKT' if k==3 else ''),fill=(255,255,0))
bl.save(Z+'pb_%s.png'%m); print(Z+'pb_%s.png'%m, bl.size)
