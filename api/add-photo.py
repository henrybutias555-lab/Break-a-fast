"""Add a menu photo: python3 api/add-photo.py <image> "<Exact Item Name>"
Crops to a centred square, resizes to 800px, saves to assets/img/menu/<slug>.jpg
and registers it in js/photos.js (BAF_MENU_PHOTOS)."""
import json, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src, name = sys.argv[1], sys.argv[2]
slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
rel = f"assets/img/menu/{slug}.jpg"

im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
w, h = im.size
s = min(w, h)
top = max(0, (h - s) // 2) if len(sys.argv) < 4 else int(sys.argv[3])  # optional crop top offset
im = im.crop(((w - s) // 2, top, (w - s) // 2 + s, top + s)).resize((800, 800), Image.LANCZOS)
im.save(os.path.join(ROOT, rel), quality=84, optimize=True, progressive=True)

p = os.path.join(ROOT, "js", "photos.js")
js = open(p).read()
m = re.search(r"window\.BAF_MENU_PHOTOS = (\{.*?\});", js, re.S)
photos = json.loads(m.group(1))
photos[name] = rel
block = "window.BAF_MENU_PHOTOS = " + json.dumps(photos, indent=2, ensure_ascii=False) + ";"
open(p, "w").write(js[:m.start()] + block + js[m.end():])
print("added", name, "->", rel, os.path.getsize(os.path.join(ROOT, rel)) // 1024, "KB")
