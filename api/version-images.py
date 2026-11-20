"""Add/refresh ?v=<hash> on every image path in js/photos.js and js/products.js,
so phones load a replaced photo straight away instead of a cached copy.
Run after changing any photo: python3 api/version-images.py"""
import hashlib, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
pat = re.compile(r'"(assets/img/[^"?]+\.(?:jpg|jpeg|png|webp))(?:\?v=[0-9a-f]+)?"')

def ver(m):
    path = m.group(1)
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return m.group(0)
    h = hashlib.md5(open(full, "rb").read()).hexdigest()[:8]
    return f'"{path}?v={h}"'

for f in ["js/photos.js", "js/products.js"]:
    p = os.path.join(ROOT, f)
    s = open(p).read()
    open(p, "w").write(pat.sub(ver, s))
print("versioned")
