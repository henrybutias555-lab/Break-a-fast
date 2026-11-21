"""Make labelled QR codes for each menu section -> assets/qr/*.png
Run: python3 api/make-qr.py"""
import os, glob
import qrcode
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BASE = "https://break-a-fast.onrender.com/"
SECTIONS = [
    ("local-bar", "Local Bar", "Local drinks & fresh juices", "events.html#local-drinks"),
    ("breakfast", "Breakfast Menu", "Local & continental breakfast", "menu.html#breakfast"),
    ("cinnamon-rolls", "Cinnamon Rolls", "Specialty & classic rolls", "menu.html#cinnamon"),
    ("spring-rolls", "Spring Rolls", "Frozen spring rolls", "menu.html#spring"),
    ("meal-packs", "Breakfast & Lunch Packs", "Ready-to-enjoy spreads", "menu.html#meals"),
    ("kitchen", "More from Our Kitchen", "Doughnuts, pies, pizza & more", "menu.html#more"),
    ("local-snacks", "Local Snacks", "Atsormor, kulikuli, nkate cake & more", "events.html#local-snacks"),
    ("finger-foods", "Finger Foods", "Kebabs, wings, meat pies & more", "events.html#finger-foods"),
    ("desserts", "Desserts", "Tigernut pudding, banana cake, kenkey", "events.html#desserts"),
    ("events", "Events & Catering", "Packages for 20 to 500 guests", "events.html"),
    ("party-packages", "Party & Event Packages", "Snacks, finger foods, drinks & bar set-up", "events.html?group=party#packages"),
    ("breakfast-packages", "Breakfast Event Packages", "Luxury Dine & Lavish Feast, 20-100 guests", "events.html?group=breakfast#packages"),
    ("full-menu", "Full Menu", "Everything we make", "menu.html"),
]
BROWN, CREAM, BERRY = (59, 31, 20), (251, 243, 230), (168, 23, 79)

def font(size, bold=True):
    for p in (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold else []) + ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"] + glob.glob("/usr/share/fonts/**/*.ttf", recursive=True):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

out = os.path.join(ROOT, "assets", "qr"); os.makedirs(out, exist_ok=True)

for slug, title, sub, path in SECTIONS:
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(BASE + path); q.make(fit=True)
    n = q.modules_count; box = 680 // n
    q.box_size = box
    img = q.make_image(fill_color=BROWN, back_color="white").convert("RGB")
    code = Image.new("RGB", (760, 760), "white")
    code.paste(img, ((760 - img.width) // 2, (760 - img.height) // 2))

    W, H = 900, 1180
    card = Image.new("RGB", (W, H), CREAM); d = ImageDraw.Draw(card)
    d.rectangle((0, 0, W, 120), fill=BROWN)
    d.text((W // 2, 60), "BREAK-A-FAST BISTRO & BAR", font=font(40), fill=(242, 181, 58), anchor="mm")
    d.text((W // 2, 185), title, font=font(64), fill=BROWN, anchor="mm")
    d.text((W // 2, 250), sub, font=font(32, False), fill=(111, 85, 71), anchor="mm")
    d.rounded_rectangle((60, 290, W - 60, 1050), radius=30, fill="white")
    card.paste(code, (70, 290))
    d.text((W // 2, 1090), "Scan to view & order", font=font(36), fill=BERRY, anchor="mm")
    d.text((W // 2, 1140), "WhatsApp 0201745770", font=font(28, False), fill=(111, 85, 71), anchor="mm")
    card.save(os.path.join(out, f"qr-{slug}.png"), optimize=True)
    print("made", slug, BASE + path)
