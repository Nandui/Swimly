# peek.py <dir> <out-prefix> name1 name2 ...  -> <out>-light.png (1280 tops) and <out>-dark.png (375 tops)
import sys,os
from PIL import Image
d,out,sel=sys.argv[1],sys.argv[2],sys.argv[3:]
def pick(suf): return [f"{n}{suf}" for n in sel if os.path.exists(os.path.join(d,f"{n}{suf}"))]
fs=pick('-1280-light.png'); ims=[Image.open(os.path.join(d,f)).convert('RGB').crop((0,0,1280,800)).resize((640,400)) for f in fs]
if ims:
  H=(len(ims)+1)//2; s=Image.new('RGB',(1280,400*H),'white')
  for i,im in enumerate(ims): s.paste(im,((i%2)*640,(i//2)*400))
  s.save(out+'-light.png')
fs2=pick('-375-dark.png'); ims=[Image.open(os.path.join(d,f)).convert('RGB').crop((0,0,375,760)) for f in fs2]
if ims:
  s=Image.new('RGB',(375*len(ims),760),'white')
  for i,im in enumerate(ims): s.paste(im,(i*375,0))
  s.save(out+'-dark.png')
print(fs, fs2)
