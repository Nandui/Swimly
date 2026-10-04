import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
per = int(sys.argv[2]) if len(sys.argv) > 2 else 4
W = 720
out = []
for i in range(0, len(files), per):
    group = files[i:i + per]
    thumbs = []
    for f in group:
        im = Image.open(f).convert('RGB')
        im = im.crop((0, 0, im.width, min(im.height, int(im.width * 0.9))))
        im = im.resize((W, int(im.height * W / im.width)))
        d = ImageDraw.Draw(im); d.rectangle((0, 0, W, 18), fill=(0, 0, 0)); d.text((6, 3), os.path.basename(f), fill=(255, 255, 255))
        thumbs.append(im)
    cols = 2
    rows = (len(thumbs) + 1) // 2
    h = max(t.height for t in thumbs)
    sheet = Image.new('RGB', (cols * W + 10, rows * (h + 10)), (60, 60, 60))
    for j, t in enumerate(thumbs):
        sheet.paste(t, ((j % 2) * (W + 10), (j // 2) * (h + 10)))
    name = os.path.join(os.path.dirname(files[0]), f'sheet_{i // per}.jpg')
    sheet.save(name, quality=80)
    out.append(name)
print('\n'.join(out))
