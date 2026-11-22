/* Break-a-Fast order logic, shared by the Node server (Render) and the Cloudflare Worker.
   createApp(cfg) -> { handle(req) }. No platform APIs here: crypto/Buffer are passed in. */
function createApp(cfg) {
  const { SECRET, ALERT_URL, ALERT_KEY, ALLOWED_ORIGINS, W, crypto, Buffer } = cfg;
  const LOGOS = cfg.LOGOS || {};
  // Owner key: an HMAC of the order code, added only to links in the owner's emails.
  const ownerKey = (code) => crypto.createHmac("sha256", SECRET).update("owner:" + code).digest("base64url").slice(0, 22);
  const docSig = (body) => crypto.createHmac("sha256", SECRET).update("doc:" + body).digest("base64url").slice(0, 14);
  const trackSig = (code, st) => crypto.createHmac("sha256", SECRET).update("track:" + st + ":" + code).digest("base64url").slice(0, 12);
  const trackUrl = (base, code, st) => `${base}/t/${code}` + (st && st !== "p" ? `?s=${st}&g=${trackSig(code, st)}` : "");
  const QR = cfg.QR || null;   // (text) => data URL, for the QR on receipts
  const okOwner = (code, k) => { const a = Buffer.from(String(k || "")), g = Buffer.from(ownerKey(code)); return a.length === g.length && crypto.timingSafeEqual(a, g); };  // lets the owner confirm payments from the verify page          // data: URIs for the invoice (no cross-site image loading)
  const C = W.BAF_CONFIG, PRODUCTS = W.BAF_PRODUCTS, GROUPS = W.BAF_EVENT_GROUPS;
  const METHODS = C.paymentMethods;
  const method = (id) => METHODS.find((m) => m.id === id);

  /* ---------- signing ---------- */
  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  const sign = (data) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  function seal(obj) { const d = b64(JSON.stringify(obj)); return d + "." + sign(d); }
  function open(token) {
    if (typeof token !== "string" || token.length > 8000) return null;
    const [d, s] = token.split(".");
    if (!d || !s) return null;
    const good = Buffer.from(sign(d)), got = Buffer.from(s);
    if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
    try { return JSON.parse(Buffer.from(d, "base64url").toString("utf8")); } catch (e) { return null; }
  }
  /* ---------- short verify codes ----------
     The verify link carries the key facts packed into bytes, plus a 72-bit HMAC,
     encoded in base62 (letters and digits only) so WhatsApp links the whole URL. */
  const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const REF_A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const EPOCH = Date.UTC(2026, 0, 1);
  const EVENT_TYPES = ["Birthday", "Wedding", "Corporate event", "Bridal shower", "Family gathering", "Church programme", "Other"];
  const FLAT_PKGS = GROUPS.flatMap((g) => g.packages.map((p) => ({ g, p })));
  function toB62(buf) { let n = BigInt("0x" + buf.toString("hex")), o = ""; while (n > 0n) { o = B62[Number(n % 62n)] + o; n /= 62n; } return o; }
  function fromB62(s) {
    if (!/^[0-9A-Za-z]{10,400}$/.test(s)) return null;
    let n = 0n; for (const ch of s) n = n * 62n + BigInt(B62.indexOf(ch));
    let h = n.toString(16); if (h.length % 2) h = "0" + h; return Buffer.from(h, "hex");
  }
  class Wr { constructor() { this.b = []; }
    u8(v) { this.b.push(v & 255); } u16(v) { this.u8(v >> 8); this.u8(v); } u24(v) { this.u8(v >> 16); this.u16(v & 0xffff); } u32(v) { this.u16(Math.floor(v / 65536)); this.u16(v % 65536); }
    str(v, max) { const x = Buffer.from(String(v || ""), "utf8").subarray(0, max); this.u8(x.length); this.b.push(...x); }
    phone(p) { const d = (p || "0000000000").padEnd(10, "0").slice(0, 10); for (let i = 0; i < 10; i += 2) this.u8((+d[i] << 4) | +d[i + 1]); } }
  class Rd { constructor(b) { this.b = b; this.i = 0; }
    u8() { if (this.i >= this.b.length) throw new Error("short"); return this.b[this.i++]; } u16() { return (this.u8() << 8) | this.u8(); } u24() { return (this.u8() << 16) | this.u16(); } u32() { return this.u16() * 65536 + this.u16(); }
    str() { const n = this.u8(); if (this.i + n > this.b.length) throw new Error("short"); const s = this.b.subarray(this.i, this.i + n).toString("utf8"); this.i += n; return s; }
    phone() { let s = ""; for (let i = 0; i < 5; i++) { const x = this.u8(); s += (x >> 4) + "" + (x & 15); } return s; } }
  const refNum = (ref) => ref.split("-")[1].split("").reduce((n, ch) => n * 31 + REF_A.indexOf(ch), 0);
  const refStr = (n) => { let s = ""; for (let i = 0; i < 6; i++) { s = REF_A[n % 31] + s; n = Math.floor(n / 31); } return s; };
  const days = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - EPOCH) / 864e5);
  const isoDay = (d) => new Date(EPOCH + d * 864e5).toISOString().slice(0, 10);
  const pmIdx = (id) => Math.max(0, METHODS.findIndex((m) => m.id === id));
  function shortCode(x) {
    const w = new Wr();
    const isE = x.t === "e", hasPay = !!x.py, phone = isE ? x.p : x.c.p;
    const fromIsPhone = hasPay && x.py.from.replace(/\D/g, "") === phone;
    w.u8(2); // version (2 = time slot stored in its own byte)
    w.u32(refNum(x.ref));
    w.u8((isE ? 1 : 0) | (pmIdx(x.pm) << 1) | ((!isE && x.c.f === "Pick-up" ? 1 : 0) << 3) | ((hasPay ? 1 : 0) << 6) | ((fromIsPhone ? 1 : 0) << 7));
    w.u24(Math.round((Date.parse(x.at) - EPOCH) / 60000));
    w.u16(days(isE ? x.d : x.c.d));
    w.u8(isE ? 0 : Math.max(0, ALL_SLOTS.findIndex((t) => t.label === x.c.tm)));
    w.phone(phone);
    w.u32(Math.round(x.tot * 100));
    if (isE) {
      const fi = FLAT_PKGS.findIndex((f) => f.p.name === x.pk && f.g.name === x.g);
      w.u8(fi < 0 ? 255 : fi);
      w.u16(parseInt(x.gu, 10) || 0);
      w.u8(fi < 0 ? 0 : FLAT_PKGS[fi].g.addons.reduce((m, a, i) => (x.ad.some((d) => d[0] === a.name) ? m | (1 << i) : m), 0));
      w.u8(Math.max(0, EVENT_TYPES.indexOf(x.ty) < 0 ? EVENT_TYPES.length - 1 : EVENT_TYPES.indexOf(x.ty)));
      w.str(x.n, 30); w.str(x.v, 30);
    } else {
      w.u8(x.it.length);
      for (const it of x.it) {
        const pi = PRODUCTS.findIndex((p) => p.name === it[0]), p = PRODUCTS[pi];
        w.u8(pi); w.u8((p.options.findIndex((o) => o.label === it[1]) << 4) | (it[2] ? p.flavours.indexOf(it[2]) + 1 : 0)); w.u8(it[3]);
      }
      w.str(x.c.n, 30);
      if (hasPay) { w.str(x.py.txn, 30); if (!fromIsPhone) w.str(x.py.from, 30); }
    }
    const body = Buffer.from(w.b);
    const mac = crypto.createHmac("sha256", SECRET).update(body).digest().subarray(0, 9);
    return toB62(Buffer.concat([body, mac]));
  }
  function openShort(code) {
    const buf = fromB62(code);
    if (!buf || buf.length < 20 || (buf[0] !== 1 && buf[0] !== 2)) return null;
    const body = buf.subarray(0, buf.length - 9), mac = buf.subarray(buf.length - 9);
    const good = crypto.createHmac("sha256", SECRET).update(body).digest().subarray(0, 9);
    if (!crypto.timingSafeEqual(good, mac)) return null;
    try {
      const r = new Rd(body); const ver = r.u8();
      const refN = r.u32(), fl = r.u8(), at = new Date(EPOCH + r.u24() * 60000).toISOString(), d = isoDay(r.u16());
      const tmLabel = ver >= 2 ? (ALL_SLOTS[r.u8()] || {}).label || "" : TIMES[(fl >> 4) & 3];
      const phone = r.phone(), tot = r.u32() / 100;
      const isE = fl & 1, pm = (METHODS[(fl >> 1) & 3] || METHODS[0]).id;
      if (isE) {
        const fi = r.u8(), f = FLAT_PKGS[fi], gu = String(r.u16()), mask = r.u8(), ty = EVENT_TYPES[r.u8()] || "Other", n = r.str(), v = r.str();
        const ad = f ? f.g.addons.filter((a, i) => mask & (1 << i)).map((a) => [a.name, a.price]) : [];
        return { t: "e", ref: "EVT-" + refStr(refN), at, g: f ? f.g.name : "", pk: f ? f.p.name : "Custom / bulk order", gu: f ? gu : "", ad, tot, dep: f ? Math.round(tot * C.eventDepositPercent) / 100 : 0, ty, n, p: phone, d, v, pm };
      }
      const it = [], k = r.u8();
      for (let i = 0; i < k; i++) {
        const p = PRODUCTS[r.u8()], of = r.u8(), q = r.u8(), o = p && p.options[of >> 4], fv = p && (of & 15) ? (p.flavours || [])[(of & 15) - 1] : "";
        it.push([p ? p.name : "Item no longer on menu", o ? o.label : "", fv || "", q, o ? o.price * q : null]);
      }
      const n = r.str(), o = { t: "o", ref: C.orderPrefix + "-" + refStr(refN), at, it, tot, c: { n, p: phone, f: fl & 8 ? "Pick-up" : "Delivery", d, tm: tmLabel }, pm };
      if (fl & 64) { const txn = r.str(); o.py = { txn, from: fl & 128 ? phone : r.str() }; }
      return o;
    } catch (e) { return null; }
  }

  function makeRef(prefix) {
    const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return prefix + "-" + Array.from(crypto.randomBytes(6), (n) => A[n % A.length]).join("");
  }

  /* ---------- helpers ---------- */
  const money = (n) => "GH₵" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  function normPhone(v) {
    let d = String(v || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+233")) d = "0" + d.slice(4);
    else if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
    return /^0\d{9}$/.test(d) ? d : null;
  }
  function ghanaToday() { return new Date().toISOString().slice(0, 10); } // Ghana is UTC+0
  const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= ghanaToday() && d <= "2100-01-01";
  const niceDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  class Bad extends Error {}
  const need = (cond, msg) => { if (!cond) throw new Bad(msg); };

  /* ---------- builders ---------- */
  // One-hour slots (Ghana time = GMT). Legacy 3-slot labels kept so old links/orders still read.
  const OH = Object.assign({ open: 8, close: 19, sameDayLeadHours: 4, sameDayMaxSlots: 3 }, C.orderHours);
  const hr = (h) => (h === 12 ? "12pm" : h > 12 ? h - 12 + "pm" : h + "am");
  const HOURLY = []; for (let h = OH.open; h < OH.close; h++) HOURLY.push({ label: `${hr(h)} to ${hr(h + 1)}`, start: h });
  const LEGACY = [{ label: "Morning (8am to 12pm)", start: 8 }, { label: "Afternoon (12pm to 4pm)", start: 12 }, { label: "Evening (4pm to 7pm)", start: 16 }];
  const TIMES = LEGACY.map((t) => t.label);              // v1 short-code table (do not change)
  const PENDING = "Time chosen after payment";       // future-date orders pick their slot after paying
  const ALL_SLOTS = [...HOURLY, ...LEGACY, { label: PENDING, start: -1 }];
  const slotOpen = (iso, label) => {
    const s = HOURLY.find((t) => t.label === label);
    if (!s) return false;                                 // new orders must use hourly slots
    if (iso < ghanaToday()) return false;
    if (iso !== ghanaToday()) return true;
    const now = new Date(); const h = now.getUTCHours() + now.getUTCMinutes() / 60;
    return HOURLY.filter((t) => t.start >= h + OH.sameDayLeadHours).slice(0, OH.sameDayMaxSlots).includes(s);
  };
  function buildOrder(b) {
    need(Array.isArray(b.items) && b.items.length >= 1 && b.items.length <= 30, "Your cart is empty.");
    const items = b.items.map((i) => {
      const p = PRODUCTS.find((x) => x.id === i.productId);
      need(p, "An item in your cart is no longer available. Please refresh the menu.");
      const o = p.options[i.optionIndex];
      need(o, "A package size in your cart is no longer available.");
      const qty = Number(i.qty);
      need(Number.isInteger(qty) && qty >= 1 && qty <= 99, "Invalid quantity.");
      let fl = "";
      if (p.flavours) { fl = str(i.flavour, 40); need(p.flavours.includes(fl), "Please choose a valid flavour."); }
      return [p.name, o.label, fl, qty, o.price * qty];
    });
    const c = b.customer || {};
    const name = str(c.name, 80), phone = normPhone(c.phone), ful = c.fulfilment === "Pick-up" ? "Pick-up" : "Delivery";
    const address = ful === "Delivery" ? str(c.address, 300) : "";
    need(name.length >= 2, "Please enter your name.");
    need(phone, "Please enter a valid Ghana phone number.");
    need(ful === "Pick-up" || address.length >= 5, "Please enter your delivery address.");
    need(validDate(c.date), "Please choose a valid date.");
    const notice = (C.orderHours && C.orderHours.minNoticeDays) || 0;
    need(c.date >= new Date(Date.now() + notice * 864e5).toISOString().slice(0, 10), `Orders need at least ${notice} days' notice. For urgent orders, please message us on WhatsApp.`);
    if (c.date === ghanaToday() || c.time !== PENDING) {
      need(HOURLY.some((t) => t.label === c.time), "Please choose a time.");
      need(slotOpen(c.date, c.time), "That time is not available for same-day orders. Please choose one of the times shown, or another day.");
    }
    need(method(b.payment), "Please choose a payment method.");
    return {
      t: "o", ref: makeRef(C.orderPrefix), at: new Date().toISOString(),
      it: items, tot: items.reduce((s, i) => s + i[4], 0),
      c: { n: name, p: phone, f: ful, a: address, d: c.date, tm: c.time, no: str(c.notes, 500) },
      pm: b.payment
    };
  }
  function buildEvent(b) {
    const g = GROUPS.find((x) => x.packages.some((p) => p.id === b.pkg));
    const pkg = g && g.packages.find((p) => p.id === b.pkg);
    const custom = b.pkg === "custom";
    need(pkg || custom, "Please choose a package.");
    let base = 0, addons = [], guests = str(String(b.guests || ""), 20);
    if (pkg) {
      need(Object.prototype.hasOwnProperty.call(pkg.prices, guests), "Please choose the number of guests.");
      base = pkg.prices[guests];
      const ids = Array.isArray(b.addons) ? b.addons : [];
      addons = g.addons.filter((a) => ids.includes(a.id)).map((a) => [a.name, a.price]);
    }
    const name = str(b.name, 80), phone = normPhone(b.phone);
    need(name.length >= 2, "Please enter your name.");
    need(phone, "Please enter a valid Ghana phone number.");
    need(validDate(b.date), "Please choose a valid event date.");
    const evNotice = C.eventNoticeDays || 0;
    need(b.date >= new Date(Date.now() + evNotice * 864e5).toISOString().slice(0, 10), `Events must be booked at least ${evNotice} days (2 weeks) before the event date.`);
    need(method(b.payment), "Please choose a payment method.");
    const tot = base + addons.reduce((s, a) => s + a[1], 0);
    const MENU = W.BAF_EVENT_MENU, SRC = W.BAF_PICK_SOURCES;
    const picks = [];
    if (pkg && pkg.picks) {
      const want = Array.isArray(b.picks) ? b.picks : [];
      for (const pk of pkg.picks) {
        if (pk.fixed) { picks.push([pk.cat, pk.fixed, true]); continue; }
        const opts = pk.from || (SRC[pk.cat] || []).flatMap((c) => MENU[c] || []);
        const got = (want.find((w) => Array.isArray(w) && w[0] === pk.cat) || [])[1];
        const chosen = [...new Set((Array.isArray(got) ? got : []).filter((x) => opts.includes(x)))].slice(0, pk.n);
        picks.push([pk.cat, chosen, false, pk.n]);
      }
    }
    return {
      t: "e", ref: makeRef("EVT"), at: new Date().toISOString(),
      g: pkg ? g.name : "", pk: pkg ? pkg.name : "Custom / bulk order", gu: guests, ad: addons,
      tot, dep: pkg ? Math.round(tot * C.eventDepositPercent) / 100 : 0,
      pi: picks, ty: str(b.type, 40) || "Other", n: name, p: phone, d: b.date, v: str(b.venue, 120), m: str(b.message, 600),
      pm: b.payment
    };
  }

  const unitOf = (i) => (i[4] != null && i[3] ? i[4] / i[3] : null);
  const itemTitle = (i) => `${i[0]}${i[2] ? " (" + i[2] + ")" : ""}`;
  const itemCalc = (i) => unitOf(i) != null ? `${i[3]} × ${i[1]} at ${money(unitOf(i))} = ${money(i[4])}` : `${i[3]} × ${i[1]}`;

  const pickLine = (p) => p[2] ? `${p[0]}: ${p[1].join(", ")}` : `${p[0]} (${p[1].length} of ${p[3]}): ${p[1].length ? p[1].join(", ") : "not chosen yet, please suggest"}${p[1].length && p[1].length < p[3] ? " + please suggest the rest" : ""}`;

  /* ---------- WhatsApp text (built server-side; the Verify link is what counts) ---------- */
  // Customer-facing WhatsApp text no longer carries the verify link (owner gets it by email only).
  const o_ref = (L) => (L[0].match(/(BAF|EVT)-[A-Z0-9]+/) || [""])[0];
  function verifyLine(url) {
    return [``, `🔒 Verify this order (tap):`, url, ``, `If anything in this message differs from the verify page, the verify page is correct.`];
  }
  function orderText(o, url) {
    const m = method(o.pm);
    const L = [`*NEW ORDER: ${o.ref}*`, ``,
      ...o.it.map((i) => `• ${itemTitle(i)}: ${itemCalc(i)}`),
      `*Total: ${money(o.tot)}*`, ``, `*Customer*`, `Name: ${o.c.n}`, `Phone: ${o.c.p}`,
      `${o.c.f}${o.c.f === "Delivery" ? ": " + o.c.a : ""}`, `When: ${niceDate(o.c.d)}, ${o.c.tm}`];
    if (o.c.no) L.push(`Notes: ${o.c.no}`);
    L.push(``, `*Payment: ${m.name}*`);
    if (o.py) { L.push(`Customer says they have sent ${money(o.tot)}`); if (o.py.txn) L.push(`Transaction ID: ${o.py.txn}`); if (o.py.from) L.push(`Paid from: ${o.py.from}${o.py.s ? " (" + o.py.s + ")" : ""}`); L.push(`Reference: ${o.ref}`); }
    else L.push(`Awaiting invoice with payment details.`);
    return L.concat([``, `Reference: ${o_ref(L)}`]).join("\n");
  }
  function eventText(e, url) {
    const m = method(e.pm);
    const L = [`*EVENT ENQUIRY: ${e.ref}*`, ``, `Event: ${e.ty}`, `Date: ${niceDate(e.d)}`, `Venue: ${e.v || "To be shared"}`,
      `Package: ${e.g ? e.g + " / " : ""}${e.pk}`, `Guests: ${e.gu}`, ...e.ad.map((a) => `Extra: ${a[0]} (${money(a[1])})`)];
    if (e.pi && e.pi.length) { L.push(``, `*Menu choices*`); for (const p of e.pi) L.push(pickLine(p)); L.push(`Bar set-up`); }
    if (e.tot) L.push(`Estimated total: ${money(e.tot)} (excl. transport)`, `${C.eventDepositPercent}% token: ${money(e.dep)}`);
    L.push(``, `Name: ${e.n}`, `Phone: ${e.p}`);
    if (e.m) L.push(`Message: ${e.m}`);
    L.push(``, `Preferred payment: ${m.name}`, `Please confirm availability and send my invoice. I'll pay the token after your confirmation.`);
    return L.concat([``, `Reference: ${o_ref(L)}`]).join("\n");
  }

  /* ---------- verify page ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function progressBox(x, code, base) {
    if (!x || !code || !base) return "";
    const first = (x.t === "e" ? x.n : x.c.n).split(" ")[0], phone = x.t === "e" ? x.p : x.c.p, isE = x.t === "e", pick = !isE && x.c.f !== "Delivery";
    const when = niceDate(isE ? x.d : x.c.d);
    const msgs = {
      pr: isE ? `Hello ${first}, we're now preparing for your ${x.ty} on ${when} (booking ${x.ref}).` : `Hello ${first}, good news! We're now preparing your order ${x.ref} for ${when}.`,
      od: isE ? `Hello ${first}, our team is on the way to set up for your event (booking ${x.ref}).` : pick ? `Hello ${first}, your order ${x.ref} is ready for pick-up!` : `Hello ${first}, your order ${x.ref} is on its way to you! Please keep your phone close.`,
      dn: isE ? `Hello ${first}, thank you for celebrating with Break-a-Fast! We hope you and your guests enjoyed everything (booking ${x.ref}).` : `Hello ${first}, your order ${x.ref} has been ${pick ? "picked up" : "delivered"}. Enjoy, and thank you for choosing Break-a-Fast!`
    };
    const btn = (id, icon) => { const t = trackUrl(base, code, id), m = msgs[id] + "\n\n📍 Track your " + (isE ? "booking" : "order") + ":\n" + t;
      return `<a class="pg" data-s="${id}" target="_blank" rel="noopener" href="https://wa.me/233${esc(phone.slice(1))}?text=${encodeURIComponent(m)}">${icon} ${esc(progLabel(x, id))}</a>`; };
    return `<details class="owner" open><summary>Owner: update order progress</summary>
      <p style="margin:6px 0 10px;font-size:.9rem">Tap a step when it happens. It turns green on the customer's tracker and opens their WhatsApp chat with an update to send.</p>
      <div class="pgs">${btn("pr", "👩‍🍳")}${btn("od", isE ? "🎪" : pick ? "🛍️" : "🚚")}${btn("dn", "✅")}</div><div id="pg-msg" style="font-size:.85rem;color:#2f7d4a;margin-top:6px"></div></details>
      <script>document.querySelectorAll(".pg").forEach(function(a){a.addEventListener("click",async function(ev){ev.preventDefault();var m=document.getElementById("pg-msg"),w=window.open("about:blank","_blank");
      try{var r=await fetch("/api/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:${JSON.stringify(code)},k:${JSON.stringify(ownerKey(code))},s:a.dataset.s})});var j=await r.json();if(!r.ok)throw new Error(j.error||"Could not save");
      a.classList.add("done");m.style.color="#2f7d4a";m.textContent="✓ "+a.textContent.trim()+" saved. Send the WhatsApp message so the customer gets the update.";if(w)w.location.href=a.href;else location.href=a.href;}
      catch(e){if(w)w.close();m.style.color="#b3261e";m.textContent="✗ "+e.message+(/cancel/i.test(e.message)?" Refresh this page.":"");}});});</script>`;
  }
  function verifyPage(x, codeForInvoice = "", owner = false, base = "") {
    const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
    let body;
    if (!x) {
      body = `<div class="bad">✖ NOT VALID</div><p>This link has been changed or is incomplete. <b>Do not trust the order details in the message.</b> Ask the customer to place the order again on the website.</p>`;
    } else if (x.t === "o") {
      const m = method(x.pm);
      body = `<div class="ok">✔ GENUINE ORDER</div><p class="sub">Created by the website on ${esc(new Date(x.at).toLocaleString("en-GB", { timeZone: "UTC" }))} GMT</p>
        <h2>${esc(x.ref)}</h2><table>
        ${x.it.map((i) => `<tr><td colspan="2"><div class="item">${esc(itemTitle(i))}</div><div class="calc">${unitOf(i) != null ? `${i[3]} × ${esc(i[1])} at ${money(unitOf(i))} = <b>${money(i[4])}</b>` : `${i[3]} × ${esc(i[1])}`}</div></td></tr>`).join("")}
        ${row("TOTAL", `<b class="big">${money(x.tot)}</b>`)}
        ${row("Name", esc(x.c.n))}${row("Phone", esc(x.c.p))}${row(x.c.f, x.c.f === "Delivery" ? (x.c.a ? esc(x.c.a) : "Address is in the WhatsApp message") : "Pick-up")}
        ${row("When", esc(niceDate(x.c.d) + ", " + x.c.tm))}${x.c.no ? row("Notes", esc(x.c.no)) : ""}
        ${row("Payment method", esc(m ? m.name : x.pm))}
        ${x.py ? row("Payment", "Customer says they have paid") + (x.py.txn ? row("Customer's Transaction ID", esc(x.py.txn)) : "") + (x.py.from ? row("Paid from", esc(x.py.from + (x.py.s ? " (" + x.py.s + ")" : ""))) : "") : row("Payment", "Not reported yet")}
        </table>
        <div class="todo"><b>Before you start this order:</b> check your ${esc(m ? m.name : "")} SMS/statement shows <b>${money(x.tot)}</b> received${x.py && x.py.txn ? ` with Transaction ID <b>${esc(x.py.txn)}</b>` : ""} and reference <b>${esc(x.ref)}</b>. The website cannot see your account, so only your own SMS/statement proves the money arrived.</div>
        <p><a class="inv" href="../i/${esc(codeForInvoice)}">📄 Open invoice</a></p>
        ${owner ? `<details class="owner" open><summary>Owner: confirm payment</summary>
          <form id="cf" autocomplete="off">
            <p style="margin:6px 0 10px;font-size:.9rem">First check your MoMo/bank SMS shows the money with reference <b>${esc(x.ref)}</b>.</p>
            ${x.t === "e" ? `<label>Amount received (GH₵)<input name="amt" type="number" min="1" step="1" inputmode="decimal" value="${esc(x.pr ? x.pr.amt : x.dep || "")}"></label>
            <label>Paid with<select name="pm">${METHODS.map((m) => `<option value="${esc(m.id)}"${m.id === x.pm ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>` : ""}
            <button type="submit">✅ Yes, I've received the payment</button>
            <div id="cf-msg"></div>
          </form></details>
          <script>
          document.getElementById("cf").addEventListener("submit",async(e)=>{e.preventDefault();const f=e.target,m=document.getElementById("cf-msg");m.textContent="Checking…";
            try{const r=await fetch("/api/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:${JSON.stringify(codeForInvoice)},k:${JSON.stringify(owner ? ownerKey(codeForInvoice) : "")},amt:f.amt?f.amt.value:"",pm:f.pm?f.pm.value:""})});
            const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not confirm");location.href=j.receipt;}catch(err){m.textContent=err.message;}});
          </script>${progressBox(x, codeForInvoice.includes(".") ? shortCode(x) : codeForInvoice, base)}` : ""}`;
    } else {
      const m = method(x.pm);
      body = `<div class="ok">✔ GENUINE EVENT ENQUIRY</div><p class="sub">Created by the website on ${esc(new Date(x.at).toLocaleString("en-GB", { timeZone: "UTC" }))} GMT</p>
        <h2>${esc(x.ref)}</h2><table>
        ${row("Event", esc(x.ty))}${row("Date", esc(niceDate(x.d)))}${row("Venue", esc(x.v || "To be shared"))}
        ${row("Package", esc((x.g ? x.g + " / " : "") + x.pk))}${row("Guests", esc(x.gu))}
        ${x.ad.map((a) => row("Extra", `${esc(a[0])} · ${money(a[1])}`)).join("")}
        ${x.tot ? row("Estimated total", `<b class="big">${money(x.tot)}</b> (excl. transport)`) + row(`${C.eventDepositPercent}% token`, `<b>${money(x.dep)}</b>`) : row("Price", "Custom quote needed")}
        ${row("Name", esc(x.n))}${row("Phone", esc(x.p))}${x.m ? row("Message", esc(x.m)) : ""}
        ${row("Preferred payment", esc(m ? m.name : x.pm))}
        </table>
        <div class="todo">When the token arrives, check your SMS/statement shows the right amount with reference <b>${esc(x.ref)}</b>.</div>
        <p><a class="inv" href="../i/${esc(codeForInvoice)}">📄 Open invoice</a></p>
        ${owner ? `<details class="owner" open><summary>Owner: confirm payment</summary>
          <form id="cf" autocomplete="off">
            <p style="margin:6px 0 10px;font-size:.9rem">First check your MoMo/bank SMS shows the money with reference <b>${esc(x.ref)}</b>.</p>
            ${x.t === "e" ? `<label>Amount received (GH₵)<input name="amt" type="number" min="1" step="1" inputmode="decimal" value="${esc(x.pr ? x.pr.amt : x.dep || "")}"></label>
            <label>Paid with<select name="pm">${METHODS.map((m) => `<option value="${esc(m.id)}"${m.id === x.pm ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>` : ""}
            <button type="submit">✅ Yes, I've received the payment</button>
            <div id="cf-msg"></div>
          </form></details>
          <script>
          document.getElementById("cf").addEventListener("submit",async(e)=>{e.preventDefault();const f=e.target,m=document.getElementById("cf-msg");m.textContent="Checking…";
            try{const r=await fetch("/api/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:${JSON.stringify(codeForInvoice)},k:${JSON.stringify(owner ? ownerKey(codeForInvoice) : "")},amt:f.amt?f.amt.value:"",pm:f.pm?f.pm.value:""})});
            const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not confirm");location.href=j.receipt;}catch(err){m.textContent=err.message;}});
          </script>${progressBox(x, codeForInvoice.includes(".") ? shortCode(x) : codeForInvoice, base)}` : ""}`;
    }
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
  <title>Verify order | Break-a-Fast</title>
  <meta property="og:title" content="${x ? esc((x.t === "e" ? "Event enquiry " : "Order ") + x.ref) : "Order verification"} · Break-a-Fast">
  <meta property="og:description" content="Tap to check this order is genuine.">
  <meta property="og:image" content="${esc((ALLOWED_ORIGINS[0] || "") + "/assets/img/share.jpg")}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image"><style>
  body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#fbf3e6;color:#2a1710}
  main{max-width:640px;margin:0 auto;padding:20px 16px 40px}h1{font-size:1rem;color:#3b1f14;margin:0 0 14px}
  .ok,.bad{font-weight:800;font-size:1.4rem;padding:16px;border-radius:14px;text-align:center;color:#fff}.ok{background:#2f7d4a}.bad{background:#c0392b}
  .sub{color:#6f5547;font-size:.9rem;text-align:center}h2{margin:16px 0 8px;color:#3b1f14}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e8d6bd;vertical-align:top}
  th{color:#6f5547;font-weight:600;width:38%}th,td{overflow-wrap:anywhere}.item{font-weight:700;color:#3b1f14}.calc{color:#6f5547;margin-top:2px}.calc b{color:#2a1710}.big{font-size:1.2rem;color:#a8174f}.todo{margin-top:16px;background:#fff7e6;border:1px solid #f1d39a;border-radius:12px;padding:12px 14px}.owner{margin-top:18px;background:#fff;border:1px solid #e8d6bd;border-radius:12px;padding:12px 14px}.owner summary{font-weight:800;color:#3b1f14;cursor:pointer}
  .owner label{display:grid;gap:4px;font-size:.85rem;font-weight:700;color:#6f5547;margin-bottom:10px}.owner input,.owner select{font:inherit;padding:10px;border:2px solid #e8d6bd;border-radius:10px}
  .owner button{font:700 1rem system-ui;padding:12px 16px;border:0;border-radius:999px;background:#2f7d4a;color:#fff;width:100%;cursor:pointer}#cf-msg{margin-top:8px;font-weight:700;color:#c0392b}
  .pgs{display:grid;gap:8px}.pg{display:block;text-align:center;font-weight:800;padding:12px 14px;border-radius:999px;border:2px solid #2f7d4a;color:#2f7d4a;text-decoration:none;background:#fff}.pg.done{background:#2f7d4a;color:#fff}
  .inv{display:inline-block;margin-top:6px;background:#a8174f;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700}
  </style></head><body><main><h1>Break-a-Fast · Order verification</h1>${body}</main></body></html>`;
  }

  /* ---------- live order status (kept in the owner's Google Apps Script, cached here) ---------- */
  const RANK = { p: 1, i: 2, pd: 3, c: 4, pr: 5, od: 6, dn: 7 };
  // owner-controlled progress steps: [id, order label, pick-up label, event label]
  const PROG = [["pr", "Preparing your order", "Preparing your order", "Preparing your event"],
    ["od", "Out for delivery", "Ready for pick-up", "Setting up your event"],
    ["dn", "Delivered", "Picked up", "Event completed"]];
  const progLabel = (x, id) => { const r = PROG.find((q) => q[0] === id); return x.t === "e" ? r[3] : x.c.f === "Delivery" ? r[1] : r[2]; };
  const statusCache = new Map();
  let storeOk = null, storeChecked = 0;
  async function storeReady() {
    if (!ALERT_URL || !ALERT_KEY) return false;
    if (storeOk === true || Date.now() - storeChecked < 5 * 60 * 1000) return !!storeOk;
    storeChecked = Date.now();
    try { const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
      const t = await (await fetch(ALERT_URL, { redirect: "follow", signal: ctrl.signal })).text(); storeOk = /status v2/.test(t);
    } catch (e) { storeOk = false; }
    if (!storeOk) console.error("status store: Apps Script not updated yet (tracking links show their own stage only)");
    return storeOk;
  }
  async function storeCall(body) {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
    return (await fetch(ALERT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: ALERT_KEY, ...body }), redirect: "follow", signal: ctrl.signal })).text();
  }
  const KV = cfg.KV || null;
  async function getStatus(ref) {
    if (statusCache.has(ref)) return statusCache.get(ref);
    let s = "";
    if (KV) { try { s = (await KV.get("st:" + ref)) || ""; } catch (e) { console.error("status read failed:", e.message); return ""; } }
    else try { if (await storeReady()) { s = (await storeCall({ action: "get", ref })).trim(); if (!/^(i|pd|c|pr|od|dn|x)$/.test(s)) s = ""; } } catch (e) { return ""; }
    if (statusCache.size > 5000) statusCache.clear();
    statusCache.set(ref, s); return s;
  }
  async function setStatus(ref, s) {
    const cur = await getStatus(ref);
    if (cur === "x" || (s !== "x" && (RANK[cur] || 0) >= RANK[s])) return;   // never go backwards
    statusCache.set(ref, s);
    if (KV) { try { await KV.set("st:" + ref, s); } catch (e) { console.error("status save failed:", e.message); } return; }
    try { if (await storeReady()) await storeCall({ action: "set", ref, s }); } catch (e) { console.error("status save failed:", e.message); }
  }
  const CX_BANNER = `<div style="background:#b3261e;color:#fff;padding:14px 16px;font:800 1.05rem system-ui,sans-serif;text-align:center;position:relative;z-index:50">❌ CANCELLED · This order was cancelled by the customer. Nothing will be prepared and no payment should be made.</div>`;
  const markCx = async (html, x) => (x && (await getStatus(x.ref)) === "x")
    ? html.replace("<body>", "<body>" + CX_BANNER + `<style>.tools,.bar,.owner,.pgs,a.inv{display:none!important}</style>`) : html;
  // small extra memory (same store as the status): used to stop repeated "I've paid" reports
  const memo = new Map();
  async function kvGet(k) { if (memo.has(k)) return memo.get(k); let v = ""; if (KV) { try { v = (await KV.get(k)) || ""; } catch (e) { return ""; } } memo.set(k, v); return v; }
  function kvSet(k, v) { memo.set(k, v); if (memo.size > 5000) memo.clear(); return KV ? KV.set(k, v).catch((e) => console.error("save failed:", e.message)) : Promise.resolve(); }
  const ALREADY = "You've already told us about this payment. We're checking it and will send your receipt on WhatsApp. No need to tap again.";
  const bestStage = (a, b) => (a === "x" || b === "x") ? "x" : ((RANK[a] || 0) >= (RANK[b] || 0) ? a : b);

  /* ---------- customer tracking page ---------- */
  function trackPage(x, stage) {
    const site = ALLOWED_ORIGINS[0] || "";
    const head = (t, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(t)} | Break-a-Fast</title><meta property="og:title" content="${esc(t)} · Break-a-Fast"><meta property="og:description" content="Track your Break-a-Fast order."><meta property="og:image" content="${esc(site)}/assets/img/share.jpg">
<style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#fbf3e6;color:#2a1710}
header{background:#3b1f14;color:#f2b53a;padding:14px 16px;display:flex;gap:10px;align-items:center;font-weight:800}header img{width:40px;height:40px;border-radius:50%}
main{max-width:640px;margin:0 auto;padding:18px 16px 40px}.card{background:#fff;border:1px solid #e8d6bd;border-radius:16px;padding:16px;margin-bottom:14px}
h1{margin:0 0 4px;color:#3b1f14;font-size:1.5rem}.ref{color:#6f5547}.big{font-size:2rem;font-weight:800;color:#a8174f;line-height:1.1}.when{font-weight:700;color:#3b1f14}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:12px}.tl li{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;color:#9a8577}
.tl li::before{content:"";width:22px;height:22px;border-radius:50%;border:3px solid #e8d6bd;background:#fff;margin-top:2px}
.tl li.done{color:#2a1710}.tl li.done::before{background:#2f7d4a;border-color:#2f7d4a}.tl li.now{color:#a8174f;font-weight:800}.tl li.now::before{border-color:#a8174f;background:#fde8f0}
.cx summary{cursor:pointer;font-weight:800;color:#a8174f}.cx select,.cx textarea{width:100%;font:inherit;padding:10px;border:1px solid #e8d6bd;border-radius:10px;margin:6px 0 10px}.warn{background:#fdecec;border-radius:10px;padding:10px;color:#7a1d1d}.cxb{width:100%;background:#b3261e;color:#fff;border:0;font:inherit;font-weight:800;padding:13px;border-radius:999px;cursor:pointer}.cxb:disabled{opacity:.6}
.tl b{display:block}.items{margin:0;padding-left:18px}.muted{color:#6f5547;font-size:.9rem}a.btn{display:block;text-align:center;background:#1fa855;color:#fff;font-weight:800;padding:13px;border-radius:999px;text-decoration:none;margin-top:10px}
</style></head><body><header><img src="${LOGOS.header || esc(site) + "/assets/img/logo-invoice.jpg"}" alt="">Break-a-Fast · Order tracker</header><main>${body}</main></body></html>`;
    if (!x) return head("Order not found", `<div class="card"><h1>Link not valid</h1><p>This tracking link is incomplete. Please message us on WhatsApp with your order reference.</p><a class="btn" href="https://wa.me/${esc(C.whatsappIntl)}">Chat on WhatsApp</a></div>`);
    const isE = x.t === "e", date = isE ? x.d : x.c.d, today = ghanaToday();
    const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
    const r0p = RANK[stage] || 1;
    const tm = isE ? "" : (x.c.tm === PENDING ? (r0p >= 3 || stage === "x" ? "at the time you chose" : "time chosen after payment") : x.c.tm);
    const r0 = RANK[stage] || 1, rank = r0 >= 4 ? 3 : r0 === 3 ? 2 : r0;   // pd shows as "invoice sent, payment being checked"
    const steps = [
      ["Order placed", isE ? "We received your event enquiry." : "We received your order.", true],
      ["Invoice sent", "Your invoice with payment details was sent on WhatsApp.", rank >= 2],
      [isE ? "Deposit confirmed" : "Payment confirmed", r0 === 3 ? "We've got your payment report and are checking it. Your receipt follows once it's confirmed." : rank >= 3 ? (isE ? "Your booking is secured." : "Thank you! Your payment was received.") : "Waiting for your payment.", rank >= 3],
      [progLabel(x, "pr"), isE ? "We're getting everything ready." : "Freshly made for you.", r0 >= 5],
      [progLabel(x, "od"), isE ? "Our team is setting up for you." : x.c.f === "Delivery" ? "Your order is on its way to you." : "Your order is ready. Come and collect it.", r0 >= 6],
      [progLabel(x, "dn"), (r0 >= 7 ? (isE ? "Thank you for celebrating with us!" : "Enjoy! Thank you for choosing us.") : (isE ? "Event day: " : x.c.f === "Delivery" ? "Delivery day: " : "Pick-up day: ") + niceDate(date) + (tm ? ", " + tm : "")), r0 >= 7]
    ];
    const word = isE ? "booking" : "order";
    if (stage === "x") return head(`Cancelled ${x.ref}`, `
      <div class="card"><h1>${isE ? "Booking" : "Order"} cancelled</h1><div class="ref">Reference <b>${esc(x.ref)}</b></div>
        <p style="margin:12px 0 4px"><span class="big" style="color:#9a8577">Cancelled</span></p>
        <div class="when">Was for ${esc(niceDate(date))}${tm ? " · " + esc(tm) : ""}</div>
        <p class="muted" style="margin-bottom:0">You cancelled this ${word} and Break-a-Fast has been notified. Nothing more will be prepared.</p></div>
      <div class="card"><b>${isE ? "Booking" : "Items"}</b>${isE ? `<p>${esc(x.ty)} · ${esc((x.g ? x.g + " / " : "") + x.pk)}</p>` : `<ul class="items">${x.it.map((i) => `<li>${i[3]} × ${esc(itemTitle(i))}</li>`).join("")}</ul>`}</div>
      <a class="btn" href="https://wa.me/${esc(C.whatsappIntl)}?text=${encodeURIComponent("Hello Break-a-Fast! I cancelled my " + word + " " + x.ref + ".")}">Message us on WhatsApp</a>
      <p class="muted" style="text-align:center;margin-top:14px">Changed your mind? Place a new ${word} on our website.</p>`);
    const canCancel = days >= 1 && r0 < 5;
    const policy = r0 >= 3
      ? `<p class="warn">You have already paid. Under our <a href="${esc(site)}/terms.html#orders">Terms</a>, payments are <b>not refunded</b> when an ${word} is cancelled, except for force majeure (40% refunded).</p>`
      : `<p class="muted">You haven't paid yet, so cancelling costs nothing.</p>`;
    const cancelBox = !canCancel ? `<p class="muted" style="text-align:center">Need to cancel or change this ${word}? Please call or WhatsApp us.</p>`
      : `<details class="card cx"><summary>Cancel this ${word}</summary>${policy}
        <label for="cx-r"><b>Reason</b> (optional)</label>
        <select id="cx-r"><option>Plans changed</option><option>Ordered by mistake</option><option>Wrong date or details</option><option>Found another option</option><option>Other</option></select>
        <textarea id="cx-n" maxlength="300" placeholder="Anything else you'd like us to know (optional)"></textarea>
        <button type="button" id="cx-go" class="cxb">Yes, cancel my ${word}</button><p id="cx-m" class="muted" role="status"></p></details>
      <script>document.getElementById("cx-go").onclick=async function(){var b=this,m=document.getElementById("cx-m");if(!confirm("Cancel ${word} ${esc(x.ref)}? This can't be undone."))return;b.disabled=true;m.textContent="Cancelling…";
      try{var q=new URLSearchParams(location.search);var r=await fetch("/api/cancel",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({code:${JSON.stringify(shortCode(x))},s:q.get("s")||"",g:q.get("g")||"",reason:document.getElementById("cx-r").value,note:document.getElementById("cx-n").value})});var j=await r.json();if(!r.ok)throw new Error(j.error||"Could not cancel.");
      location.href=j.site?j.site+"/track.html?cx="+encodeURIComponent(j.ref)+"&u="+encodeURIComponent(j.track):j.track;}catch(e){m.textContent=e.message+" Please message us on WhatsApp.";b.disabled=false;}};</script>`;
    const nowIdx = steps.findIndex((s) => !s[2]);
    const countdown = r0 >= 7 ? `<span class="big" style="color:#2f7d4a">${esc(progLabel(x, "dn"))} ✓</span>` : r0 === 6 ? `<span class="big">${esc(progLabel(x, "od"))}!</span>` : days > 1 ? `Coming in <span class="big">${days} days</span>` : days === 1 ? `<span class="big">Tomorrow</span>` : days === 0 ? `<span class="big">Today!</span>` : `<span class="big">Completed</span>`;
    const what = isE ? `<p><b>${esc(x.ty)}</b> · ${esc((x.g ? x.g + " / " : "") + x.pk)}${x.gu ? ", " + esc(x.gu) + " guests" : ""}</p>${x.v ? `<p class="muted">Venue: ${esc(x.v)}</p>` : ""}`
      : `<ul class="items">${x.it.map((i) => `<li>${i[3]} × ${esc(itemTitle(i))} · ${esc(i[1])}</li>`).join("")}</ul>`;
    const nextTip = r0 >= 7 ? (isE ? "Thank you for celebrating with Break-a-Fast!" : "Thank you for choosing Break-a-Fast. Enjoy!") : r0 === 6 ? (isE ? "We're setting up now." : x.c.f === "Delivery" ? "Your order is on its way. Please keep your phone close." : "Your order is ready for pick-up.") : r0 === 5 ? "We're preparing it now." : rank === 1 ? "Next: we'll send your invoice on WhatsApp." : r0 === 3 ? "Payment reported. We're checking it now and will send your receipt." : rank === 2 ? `Next: pay using reference ${esc(x.ref)}, then tap "I've paid" on your invoice link.` : days > 0 ? "All set. We'll be in touch before the day." : "";
    return head(`Order ${x.ref}`, `
      <div class="card"><h1>${isE ? "Your event" : "Your order"}</h1><div class="ref">Reference <b>${esc(x.ref)}</b></div>
        <p style="margin:12px 0 4px">${countdown}</p><div class="when">${esc(niceDate(date))}${tm ? " · " + esc(tm) : ""}${isE ? "" : " · " + esc(x.c.f)}</div>
        ${nextTip ? `<p class="muted" style="margin-bottom:0">${nextTip}</p>` : ""}</div>
      <div class="card"><ol class="tl">${steps.map((s, i) => `<li class="${s[2] ? "done" : i === nowIdx ? "now" : ""}"><span><b>${esc(s[0])}</b>${esc(s[1])}</span></li>`).join("")}</ol></div>
      <div class="card"><b>${isE ? "Booking" : "Items"}</b>${what}</div>
      <a class="btn" href="https://wa.me/${esc(C.whatsappIntl)}?text=${encodeURIComponent("Hello Break-a-Fast! About my order " + x.ref + ":")}">Questions? Chat on WhatsApp</a>
      <p class="muted" style="text-align:center;margin-top:14px">Save this link: it always shows your latest progress.</p>${cancelBox}`);
  }

  /* ---------- printable invoice (owner opens it from the email alert) ---------- */
  function minusWorkingDays(iso, n) {
    const d = new Date(iso + "T12:00:00Z");
    while (n > 0) { d.setUTCDate(d.getUTCDate() - 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; }
    return d.toISOString().slice(0, 10);
  }
  function invoicePage(x, asReceipt = false, code = "", opts = {}) {
    const trackC = opts.base && code && QR ? trackUrl(opts.base, code, asReceipt ? "c" : "i") : "";
    const qrBox = trackC ? `<div style="display:flex;gap:12px;align-items:center;margin-top:10px;background:#fbf3e6;border-radius:10px;padding:10px 12px"><img src="${QR(trackC)}" alt="" style="width:92px;height:92px;image-rendering:pixelated;background:#fff;padding:4px;border-radius:6px"><div style="font-size:.88rem"><b style="color:#3b1f14">Track your ${x && x.t === "e" ? "booking" : "order"}</b><br>Scan any time to see your payment status, ${x && x.t === "e" ? "event" : "delivery"} date and progress.</div></div>` : "";
    const RO = opts.preset || null;           // read-only view for the customer
    if (!x) return verifyPage(null).replace("Order verification", asReceipt ? "Receipt" : "Invoice");
    const R = asReceipt && (x.t === "o" || !!x.pr);  // shop orders after payment, or events with a reported payment
    const DOC = R ? "Receipt" : "Invoice";
    const site = ALLOWED_ORIGINS[0] || "";
    const isE = x.t === "e";
    const today = ghanaToday();
    const name = isE ? x.n : x.c.n, phone = isE ? x.p : x.c.p;
    const lines = isE
      ? [[`${x.pk}${x.g ? " (" + x.g + ")" : ""}${x.gu ? ", " + x.gu + " guests" : ""}`, 1, x.tot - x.ad.reduce((s, a) => s + a[1], 0)], ...x.ad.map((a) => [a[0], 1, a[1]])]
      : x.it.map((i) => [itemTitle(i) + " · " + i[1], i[3], unitOf(i) || 0]);
    const balDue = isE ? minusWorkingDays(x.d, 14) : "";
    const data = {
      ref: x.ref, isE, name, phone, lines, pct: C.eventDepositPercent,
      balDue: isE ? (balDue > today ? niceDate(balDue) : "On confirmation of booking") : "",
      paid: !isE && !!x.py, delivery: !isE && x.c.f === "Delivery", custom: isE && !x.tot,
      biz: C.businessName, payRef: x.ref, site, receipt: R, doc: DOC,
      method: R ? method((isE && x.pr ? x.pr.pm : x.pm) || x.pm).name : (!isE ? method(x.pm).name : ""),
      paidOn: R && x.py && x.py.at ? niceDate(x.py.at.slice(0, 10)) : R && x.pr && x.pr.at ? niceDate(x.pr.at.slice(0, 10)) : niceDate(today),
      pendDate: !isE && x.c.tm === PENDING ? x.c.d : "",
      ro: RO, ownerKey: opts.owner && code ? ownerKey(code) : "", api: "",
      trackI: opts.base && code ? trackUrl(opts.base, code, "i") : "",
      trackC: opts.base && code ? trackUrl(opts.base, code, "c") : "",
      confirmed: !!x.cf, reported: isE && x.pr ? x.pr.amt : 0, prKind: isE && x.pr ? x.pr.k : "", code
    };
    const pay = METHODS.map((m) => `<tr><td>${esc(m.name)}${m.kind === "bank" ? " · " + esc(m.bank) : ""}</td><td><b>${esc(m.number)}</b></td><td>${esc(m.accountName)}</td></tr>`).join("");
    const when = isE ? `${esc(x.ty)} · ${esc(niceDate(x.d))}` : `${esc(x.c.f)} · ${esc(niceDate(x.c.d))}, ${esc(x.c.tm === PENDING ? "time to be confirmed" : x.c.tm)}`;
    const where = isE ? (x.v ? esc(x.v) : "Venue to be shared") : (x.c.f === "Delivery" ? esc(x.c.a || "Address to be confirmed") : "Pick-up");
    const menu = isE && (x.pi || []).length ? `<h3>Menu choices</h3><ul class="menu">${x.pi.map((p) => `<li><b>${esc(p[0])}:</b> ${esc(p[1].length ? p[1].join(", ") : "to be suggested")}</li>`).join("")}<li><b>Bar set-up</b></li></ul>` : "";
    const terms = R && isE
      ? `This receipt confirms payment received for booking ${x.ref}. Full payment is due at least 14 working days before the event. No refund on cancellation except force majeure (40% of the amount paid refunded).`
      : isE
      ? `Booking is valid once ${C.eventDepositPercent}% is paid. Full payment is due at least 14 working days before the event (or on confirmation for later bookings). Transport is not included in package prices. No refund on cancellation except force majeure (40% of the amount paid refunded). Prices may change after 2–3 months.`
      : R ? `This receipt confirms payment for order ${x.ref}. For questions, call or WhatsApp ${C.phone} quoting your reference.`
      : `Orders are prepared once full payment is confirmed. Delivery fee depends on location. Please quote the reference when paying.`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${DOC} ${esc(x.ref)} | Break-a-Fast</title><style>
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#efe6d8;color:#2a1710}
.tools{max-width:820px;margin:16px auto 0;padding:14px 16px;background:#fff;border-radius:14px;display:grid;gap:10px}
.btn2{display:inline-block;margin-top:8px;background:#1fa855;color:#fff!important;padding:9px 14px;border-radius:999px;font-weight:800;text-decoration:none}
.tools h2{margin:0;font-size:1rem;color:#3b1f14}.tools .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tools label{font-size:.85rem;font-weight:700;color:#6f5547;display:grid;gap:4px}
.tools input,.tools textarea{font:inherit;padding:10px;border:2px solid #e8d6bd;border-radius:10px;width:100%}
.req .rq{display:none;color:#c0392b;font-size:.8rem}.req.bad input{border-color:#c0392b;background:#fff5f5}.req.bad .rq{display:block}
.btns{display:flex;flex-wrap:wrap;gap:8px}.btns button,.btns a{font:700 .95rem system-ui;padding:11px 16px;border-radius:999px;border:0;cursor:pointer;text-decoration:none;color:#fff;background:#3b1f14}.btns .wa{background:#1fa855}
.sheet{position:relative;max-width:820px;margin:16px auto 40px;background:#fff;padding:36px 40px;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.08);overflow:hidden}
.sheet>*{position:relative;z-index:1}.sheet .wm{position:absolute;z-index:0;left:50%;top:50%;width:62%;max-width:460px;transform:translate(-50%,-50%);opacity:.07;pointer-events:none;border-radius:50%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #3b1f14;padding-bottom:16px}
.brand{display:flex;gap:12px;align-items:center}.brand img{width:64px;height:64px;border-radius:50%}
.brand b{display:block;font-size:1.15rem;color:#3b1f14}.brand span{font-size:.85rem;color:#6f5547}
.inv{text-align:right}.inv h1{margin:0;font-size:1.8rem;letter-spacing:2px;color:#a8174f}.inv div{font-size:.9rem}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.cols h3,h3{margin:0 0 4px;font-size:.8rem;letter-spacing:1px;text-transform:uppercase;color:#6f5547}
table.items{width:100%;border-collapse:collapse;margin-top:6px}table.items th{text-align:left;font-size:.8rem;text-transform:uppercase;color:#6f5547;border-bottom:2px solid #e8d6bd;padding:8px 6px}
table.items td{padding:9px 6px;border-bottom:1px solid #f0e4d2;vertical-align:top}table.items td.n,table.items th.n{text-align:right;white-space:nowrap}
.sum{margin-left:auto;width:min(100%,320px);margin-top:10px}.sum div{display:flex;justify-content:space-between;padding:5px 0}
.sum .tot{border-top:2px solid #3b1f14;font-weight:800;font-size:1.15rem;margin-top:4px;padding-top:8px}.sum .dep{color:#a8174f;font-weight:800}
.menu{margin:6px 0 0;padding-left:18px;font-size:.92rem}.pay{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:6px}.pay td{padding:6px;border-bottom:1px solid #f0e4d2}
.box{margin-top:18px}.note{background:#fbf3e6;border-radius:10px;padding:10px 12px;font-size:.88rem;white-space:pre-wrap}.terms{font-size:.8rem;color:#6f5547;margin-top:18px}
.stamp{display:inline-block;border:2px solid #2f7d4a;color:#2f7d4a;font-weight:800;padding:2px 10px;border-radius:6px;font-size:.85rem;margin-top:6px}
@media (max-width:600px){table.items{font-size:.82rem}table.items th,table.items td{padding:7px 3px}table.items th{font-size:.68rem}.sheet{padding:20px 14px}.top,.cols{grid-template-columns:1fr;display:grid}.inv{text-align:left}.tools .row{grid-template-columns:1fr}}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:20;background:#3b1f14;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:flex;gap:8px;box-shadow:0 -4px 16px rgba(0,0,0,.2)}
.bar a,.bar button{flex:1;font:800 .95rem system-ui;padding:13px 10px;border-radius:999px;border:0;text-align:center;text-decoration:none;color:#fff;cursor:pointer}
.bar .wa{background:#1fa855}.bar .pdfb{background:#a8174f}body{padding-bottom:84px}
body.pdfmode .sheet{width:794px;max-width:none;margin:0;box-shadow:none;border-radius:0;padding:36px 40px}
body.pdfmode .top,body.pdfmode .cols{display:flex}body.pdfmode .cols{display:grid;grid-template-columns:1fr 1fr}body.pdfmode .inv{text-align:right}
@media print{body{background:#fff;padding-bottom:0}.bar{display:none}.tools{display:none}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}@page{margin:14mm}}
</style>
<script src="${esc(site)}/assets/vendor/html2pdf.bundle.min.js" defer></script>
</head><body>
<div class="tools"${RO ? ' style="display:none"' : ""}>
  <h2>Prepare ${DOC.toLowerCase()} ${esc(x.ref)}</h2>
  ${R && x.cf ? `<div style="background:#ecf7ef;border:1px solid #b7dfc3;border-radius:10px;padding:8px 10px;font-size:.85rem;color:#2f7d4a"><b>✅ Payment confirmed by you.</b> Now send the receipt link to the customer.</div>` : ""}
  ${R && !x.cf ? `<div style="background:#fff7e6;border:1px solid #f1d39a;border-radius:10px;padding:8px 10px;font-size:.85rem"><b>Before sending:</b> check your ${esc(data.method)} SMS shows the money with reference <b>${esc(x.ref)}</b>. Only send a receipt once the payment has arrived.</div>` : ""}
  <div class="row">
    <label class="req">${isE ? "Transport (GH₵)" : data.delivery ? "Delivery fee (GH₵)" : "Extra charge (GH₵)"} *<input id="fee" autocomplete="off" type="number" min="0" step="1" inputmode="decimal" placeholder="Required: type 0 if none" required><span class="rq">Required: enter an amount, or 0 if none.</span></label>
    <label class="req">Discount (GH₵) *<input id="disc" autocomplete="off" type="number" min="0" step="1" inputmode="decimal" placeholder="Required: type 0 if none" required><span class="rq">Required: enter an amount, or 0 if none.</span></label>
  </div>
  ${R && isE ? `<label>Amount received now (GH₵)<input id="recv" autocomplete="off" type="number" min="0" step="1" inputmode="decimal" value="${esc(x.pr.amt)}"></label>
  <label>Paid earlier (GH₵)<input id="prev" autocomplete="off" type="number" min="0" step="1" inputmode="decimal" placeholder="0"></label>` : ""}
  ${data.custom ? `<label>Quoted price (GH₵)<input id="quote" autocomplete="off" type="number" min="0" step="1" inputmode="decimal" placeholder="Custom quote"></label>` : ""}
  <label>Note on invoice (optional)<textarea id="noteIn" autocomplete="off" rows="2" placeholder="e.g. Delivery to East Legon, set-up from 2pm"></textarea></label>
  <div class="btns">${R
    ? `<a class="wa" id="wa" target="_blank" rel="noopener" style="background:#1fa855">💬 Send receipt link to ${esc(name.split(" ")[0])} (opens their chat)</a><button id="share" type="button" style="background:#6f5547">📤 Share PDF file</button><button id="pdf" type="button">⬇ Download PDF</button>`
    : `<button id="share" type="button" style="background:#6f5547">📤 Share PDF file</button><button id="pdf" type="button">⬇ Download PDF</button><a class="wa" id="wa" target="_blank" rel="noopener" style="background:#1fa855">💳 Send invoice + payment link (opens their chat)</a>`}<button id="print" type="button" style="background:#6f5547">Print</button></div>
  ${R && opts.owner && code && opts.base ? `<a href="${esc(opts.base)}/v/${esc(code)}?k=${esc(ownerKey(code))}" style="display:block;text-align:center;font-weight:800;color:#2f7d4a;border:2px solid #2f7d4a;border-radius:999px;padding:10px;text-decoration:none">👩‍🍳 Update order progress (Preparing, ${x.t === "e" ? "Event day" : x.c.f === "Delivery" ? "Delivery" : "Pick-up"}) →</a>` : ""}
  <div style="font-size:.8rem;color:#6f5547" id="tip">${R ? `Tap <b>Send receipt link</b>: WhatsApp opens in ${esc(name.split(" ")[0])}'s chat with a thank-you message, the tracking link and a link to view or download this receipt as a PDF. Want the PDF file in the chat too? Tap <b>Share PDF file</b> after.` : `Tap <b>Send invoice + payment link</b>: WhatsApp opens in the customer's chat with a message that has the <b>payment link</b> (payment numbers, amount and an "I've paid" button), the tracking link, and a link to view or download this ${DOC.toLowerCase()} as a PDF. Want the PDF file too? Tap <b>Share PDF file</b> after.`}</div>
</div>
<div class="sheet">
  <img class="wm" src="${LOGOS.watermark || esc(site) + "/assets/img/logo-watermark.jpg"}" alt="">
  <div class="top">
    <div class="brand"><img src="${LOGOS.header || esc(site) + "/assets/img/logo-invoice.jpg"}" alt=""><div><b>${esc(C.businessName)}</b><span>${esc(C.tagline)}<br>${esc(C.phone)} / ${esc(C.altPhone)}</span></div></div>
    <div class="inv"><h1>${DOC.toUpperCase()}</h1><div>${R ? (isE ? "For booking" : "For order") : "No."} <b>${esc(x.ref)}</b></div><div>${R ? "Paid on" : "Date"}: ${esc(R ? data.paidOn : niceDate(today))}</div>${R ? `<div class="stamp" id="stamp">${x.cf ? "PAYMENT CONFIRMED" : "PAID"}</div>` : ""}</div>
  </div>
  <div class="cols">
    <div><h3>Bill to</h3><b>${esc(name)}</b><br>${esc(phone)}<br>${where}</div>
    <div><h3>${isE ? "Event" : "Order"}</h3>${when}${isE ? "" : `<br>Payment method: ${esc(method(x.pm).name)}`}</div>
  </div>
  <table class="items"><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody id="lines"></tbody></table>
  <div class="sum" id="sum"></div>
  ${menu}
  <div class="box" id="noteBox" hidden><h3>Note</h3><div class="note" id="noteOut"></div></div>
  ${R ? `<div class="box"><h3>Payment received</h3><table class="pay"><tr><td>Method</td><td><b>${esc(data.method)}</b></td></tr><tr><td>Reference</td><td><b>${esc(x.ref)}</b></td></tr><tr><td>Paid to</td><td>${esc(METHODS[0].accountName)}</td></tr></table></div><p style="margin-top:14px;font-weight:700;color:#3b1f14">${isE ? "Thank you for booking with us!" : "Thank you for your order!"}</p>${qrBox}` : `<div class="box"><h3>How to pay · use reference <b style="color:#a8174f">${esc(x.ref)}</b></h3><table class="pay">${pay}</table></div>${qrBox}`}
  <p class="terms">${esc(terms)}</p>
</div>
${RO ? `<div class="bar"><button class="pdfb" type="button" id="pdf2" style="flex:1">⬇ Download ${R ? "receipt" : "invoice"} PDF</button><button id="share2" hidden></button><a id="wa2" hidden></a></div>`
      : R ? `<div class="bar"><button class="pdfb" type="button" id="pdf2">⬇ PDF</button><a class="wa" id="wa2" target="_blank" rel="noopener">💬 Send receipt link</a><button id="share2" hidden></button></div>`
      : `<div class="bar"><button class="pdfb" type="button" id="pdf2">⬇ PDF</button><a class="wa" id="wa2" target="_blank" rel="noopener">💳 Send payment link</a><button id="share2" hidden></button></div>`}
<script>
const D=${JSON.stringify(data).replace(/</g, "\\u003c")};
const $=(i)=>document.getElementById(i), fmt=(n)=>"GH₵"+Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
const key="baf_inv_"+D.ref; let saved={}; try{saved=JSON.parse(localStorage.getItem(key)||"{}")}catch(e){}
if(D.ro){ const m={fee:"f",disc:"d",quote:"q",noteIn:"n",recv:"r",prev:"p"}; Object.keys(m).forEach(k=>{ if($(k)) $(k).value = D.ro[m[k]] ?? ""; }); saved={}; }
else ["fee","disc","quote","noteIn","prev"].forEach(k=>{if($(k)&&saved[k]!=null)$(k).value=saved[k]});
function e(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function draw(){
  const fee=+($("fee").value||0), disc=+($("disc").value||0), quote=$("quote")?+($("quote").value||0):0;
  let lines=D.lines.slice(); if(D.custom) lines=[[lines[0][0]||"Custom catering",1,quote]];
  const rows=lines.map(l=>[l[0],l[1],l[2],l[1]*l[2]]);
  if(fee) rows.push([D.isE?"Transport":D.delivery?"Delivery fee":"Extra charge",1,fee,fee]);
  $("lines").innerHTML=rows.map(r=>"<tr><td>"+e(r[0])+"</td><td class=n>"+r[1]+"</td><td class=n>"+fmt(r[2])+"</td><td class=n>"+fmt(r[3])+"</td></tr>").join("");
  const sub=rows.reduce((s,r)=>s+r[3],0), tot=Math.max(0,sub-disc);
  let h="<div><span>Subtotal</span><span>"+fmt(sub)+"</span></div>"+(disc?"<div><span>Discount</span><span>−"+fmt(disc)+"</span></div>":"")+"<div class=tot><span>Total</span><span>"+fmt(tot)+"</span></div>";
  if(D.isE&&D.receipt){const recv=+($("recv").value||0), prev=+($("prev").value||0), paid=recv+prev, bal=Math.max(0,tot-paid);
    h+="<div class=dep><span>Amount received</span><span>"+fmt(recv)+"</span></div>"+(prev?"<div><span>Paid earlier</span><span>"+fmt(prev)+"</span></div>":"")+"<div><span>Total paid</span><span>"+fmt(paid)+"</span></div><div><span>Balance remaining</span><span>"+fmt(bal)+"</span></div>"+(bal>0?"<div><span>Balance due</span><span>"+e(D.balDue)+"</span></div>":"");
    if($("stamp")) $("stamp").textContent = (bal<=0 ? "PAID IN FULL" : (paid>=Math.round(tot*D.pct)/100 ? "DEPOSIT PAID" : "PART PAYMENT")) + (D.confirmed ? " ✓" : "");
    D._paid=recv; D._bal=bal; D._total=paid;}
  else if(D.isE){const dep=Math.round(tot*D.pct)/100; h+="<div class=dep><span>"+D.pct+"% deposit to book</span><span>"+fmt(dep)+"</span></div><div><span>Balance</span><span>"+fmt(tot-dep)+"</span></div><div><span>Balance due</span><span>"+e(D.balDue)+"</span></div>"; if(!fee) h+="<div style='font-size:.8rem;color:#6f5547'><span>Transport to be added</span></div>";}
  else if(D.receipt) h+="<div class=dep><span>Amount paid</span><span>"+fmt(tot)+"</span></div><div><span>Paid by</span><span>"+e(D.method)+"</span></div><div><span>Balance</span><span>"+fmt(0)+"</span></div>";
  else h+="<div><span>Status</span><span>"+(D.paid?"Customer reports paid":"Payment due before preparation")+"</span></div>";
  $("sum").innerHTML=h;
  const n=$("noteIn").value.trim(); $("noteBox").hidden=!n; $("noteOut").textContent=n;
  const ph="233"+String(D.phone).replace(/^0/,"");
  const due=D.isE?Math.round(tot*D.pct)/100:tot, link=D.site+"/pay.html?ref="+encodeURIComponent(D.payRef)+"&amt="+due+(D.isE?"&for=deposit&full="+tot:"")+(D.code?"&t="+encodeURIComponent(D.code):"")+(D.pendDate?"&d="+D.pendDate:"");
  const msg=(D.receipt&&D.isE) ? "Hello "+D.name.split(" ")[0]+", thank you! Here is your receipt for booking "+D.ref+" from "+D.biz+".\\nAmount received: "+fmt(D._paid)+" by "+D.method+".\\nBalance remaining: "+fmt(D._bal)+(D._bal>0?" (due "+D.balDue+")":"")+(D.trackC?"\\n\\n📍 Track your booking:\\n"+D.trackC:"")+"\\n\\nThank you for booking with us!" : D.receipt ? "Hello "+D.name.split(" ")[0]+", thank you! Here is your receipt for order "+D.ref+" from "+D.biz+".\\nAmount paid: "+fmt(tot)+" by "+D.method+".\\nPaid on: "+D.paidOn+"\\n\\nWe'll be in touch about your "+(D.delivery?"delivery":"pick-up")+". Thank you for choosing us!"+(D.trackC?"\\n\\n📍 Track your order:\\n"+D.trackC:"") : "Hello "+D.name.split(" ")[0]+", here is your invoice "+D.ref+" from "+D.biz+".\\nTotal: "+fmt(tot)+(D.isE?"\\n"+D.pct+"% deposit to book: "+fmt(due)+"\\nBalance due: "+D.balDue:"")+"\\n\\nReference:\\n"+D.payRef+"\\n\\n💳 Tap this link to pay (it has the payment numbers, the amount and an \\"I've paid\\" button):\\n"+link+(D.trackI?"\\n\\n📍 Track your "+(D.isE?"booking":"order")+":\\n"+D.trackI:"")+"\\n\\nThank you!";
  $("wa").href="https://wa.me/"+ph+"?text="+encodeURIComponent(msg); $("wa2").href=$("wa").href;
  try{localStorage.setItem(key,JSON.stringify({recv:$("recv")?$("recv").value:"",prev:$("prev")?$("prev").value:"",fee:$("fee").value,disc:$("disc").value,quote:$("quote")?$("quote").value:"",noteIn:$("noteIn").value}))}catch(e){}
}
document.querySelectorAll(".tools input,.tools textarea").forEach(i=>["input","change","keyup","blur"].forEach(ev=>i.addEventListener(ev,draw)));
["pageshow","load","focus"].forEach(ev=>window.addEventListener(ev,draw));
window.addEventListener("beforeprint",draw);
async function sendLink(e){
  e.preventDefault(); if(!ready()) return; draw();
  const win=window.open("about:blank","_blank");   // open now (phones block pop-ups opened after waiting)
  try{
    const r=await fetch("/api/doc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:D.code,k:D.ownerKey,kind:D.receipt?"r":"i",
      f:$("fee").value,d:$("disc").value,q:$("quote")?$("quote").value:"",n:$("noteIn").value,r:$("recv")?$("recv").value:"",p:$("prev")?$("prev").value:""})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||"Could not create the link");
    const base=decodeURIComponent(($("wa").getAttribute("href")||"").split("?text=")[1]||"");
    const msg=base+"\\n\\n📄 View or download your "+(D.receipt?"receipt":"invoice")+" (PDF):\\n"+j.url;
    const url="https://wa.me/233"+String(D.phone).replace(/^0/,"")+"?text="+encodeURIComponent(msg);
    if(win) win.location.href=url; else location.href=url;
  }catch(err){ if(win) win.close(); $("tip").textContent="Could not send: "+err.message; window.scrollTo({top:0,behavior:"smooth"}); }
}
$("wa").addEventListener("click",(e)=>{ if(D.ownerKey&&D.code){ sendLink(e); return; } if(!ready()){e.preventDefault();return;} draw(); });
$("wa2").addEventListener("click",(e)=>{ if(D.ownerKey&&D.code){ sendLink(e); return; } draw(); }); $("pdf2").addEventListener("click",()=>$("pdf").click());            // runs before the link opens, so the message is always current
$("print").addEventListener("click",()=>{ if(!ready()) return; draw();window.print()});
function ready(){
  if(D.ro) return true;
  const miss=["fee","disc"].map(id=>$(id)).filter(i=>i.value.trim()===""||Number(i.value)<0);
  ["fee","disc"].forEach(id=>$(id).closest("label").classList.toggle("bad",miss.includes($(id))));
  if(miss.length){ window.scrollTo({top:0,behavior:"smooth"}); setTimeout(()=>miss[0].focus(),300); $("tip").textContent="Please fill in the delivery/transport fee and the discount first (type 0 if none)."; return false; }
  return true;
}
["fee","disc"].forEach(id=>$(id).addEventListener("input",()=>{ if($(id).value.trim()!=="") $(id).closest("label").classList.remove("bad"); }));
async function makePdf(kind){
  draw(); if(!window.html2pdf) throw new Error("PDF tool not loaded");
  const sheet=document.querySelector(".sheet"), y=window.scrollY;
  window.scrollTo(0,0); document.body.classList.add("pdfmode"); document.querySelector('meta[name=viewport]').setAttribute("content","width=1000");
  await new Promise(r=>setTimeout(r,60));
  const w=sheet.offsetWidth, h=sheet.scrollHeight;
  try{
    const w2=html2pdf().set({margin:0,filename:D.doc+"-"+D.ref+".pdf",image:{type:"jpeg",quality:0.95},
      html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",scrollX:0,scrollY:0,windowWidth:1000},pagebreak:{mode:[]}}).from(sheet);
    const cv=await w2.toCanvas().get("canvas");
    const PW=595.28, PH=Math.ceil(PW*cv.height/cv.width)+1;   // one page, exactly the receipt's shape
    const w3=html2pdf().set({margin:0,filename:D.doc+"-"+D.ref+".pdf",image:{type:"jpeg",quality:0.95},
      jsPDF:{unit:"pt",format:[PW,PH],orientation:PH>=PW?"portrait":"landscape"},pagebreak:{mode:[]}}).from(cv,"canvas");
    if(kind==="blob") return await w3.outputPdf("blob");
    await w3.save(); return null;
  } finally { document.body.classList.remove("pdfmode"); document.querySelector('meta[name=viewport]').setAttribute("content","width=device-width,initial-scale=1"); window.scrollTo(0,y); }
}
function busy(btn,txt){const old=btn.textContent;btn.disabled=true;btn.textContent=txt;return()=>{btn.disabled=false;btn.textContent=old;};}
$("pdf").addEventListener("click",async()=>{
  if(!ready()) return;
  const done=busy($("pdf"),"Making PDF…");
  try{ await makePdf("save"); $("tip").textContent="PDF downloaded ("+D.doc+"-"+D.ref+".pdf)."; }
  catch(e){ window.print(); }
  done();
});
async function sharePdf(btn){
  if(!ready()) return;
  try{ navigator.clipboard && navigator.clipboard.writeText(String(D.phone)).catch(()=>{}); }catch(e){}
  const done=busy(btn,"Preparing…");
  try{
    const docLink=(D.ownerKey&&D.code) ? fetch("/api/doc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:D.code,k:D.ownerKey,kind:D.receipt?"r":"i",
      f:$("fee").value,d:$("disc").value,q:$("quote")?$("quote").value:"",n:$("noteIn").value,r:$("recv")?$("recv").value:"",p:$("prev")?$("prev").value:""})}).then(r=>r.json()).then(j=>(j.error&&/cancel/i.test(j.error))?Promise.reject(new Error(j.error+" Refresh this page.")):(j.url||""),()=>"") : Promise.resolve("");
    const blob=await makePdf("blob"), dl=await docLink;
    const file=new File([blob],D.doc+"-"+D.ref+".pdf",{type:"application/pdf"});
    const text=decodeURIComponent(($("wa").getAttribute("href")||"").split("?text=")[1]||"")+(dl?"\\n\\nView or download your "+(D.receipt?"receipt":"invoice")+":\\n"+dl:"");
    const chat="https://wa.me/233"+String(D.phone).replace(/^0/,"")+"?text="+encodeURIComponent(text);
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],text,title:D.doc+" "+D.ref});
      $("tip").innerHTML="Sent to the share screen. Customer's number "+D.phone+" was copied: paste it in WhatsApp's search if they're not in recent chats.<br>If the message with the links didn't go with the PDF: <a class=btn2 href='"+e(chat)+"' target=_blank rel=noopener>Send the links on WhatsApp</a>";
    } else {
      const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
      $("tip").textContent="Your phone can't share files directly here, so the PDF was downloaded. WhatsApp is opening: attach the PDF in the chat.";
      setTimeout(()=>window.open($("wa").href,"_blank"),600);
    }
  }catch(e){ if(e&&e.name!=="AbortError") $("tip").textContent="Could not share: "+e.message; }
  done();
}
$("share").addEventListener("click",()=>sharePdf($("share")));
$("share2").addEventListener("click",()=>sharePdf($("share2")));
draw(); setTimeout(draw,300);
</script></body></html>`;
  }

  /* ---------- owner email alerts (via the owner's Google Apps Script) ---------- */
  function alertHtml(title, color, x, url, inv) {
    const row = (k, v) => `<tr><td style="padding:6px 10px;color:#6f5547;border-bottom:1px solid #eee;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${v}</td></tr>`;
    let rows = "";
    if (x.t === "o") {
      rows = x.it.map((i) => row(itemTitle(i), esc(itemCalc(i)))).join("") + row("TOTAL", `<b style="font-size:18px;color:#a8174f">${money(x.tot)}</b>`) +
        row("Name", esc(x.c.n)) + row("Phone", `<a href="tel:${esc(x.c.p)}">${esc(x.c.p)}</a> · <a href="https://wa.me/233${esc(x.c.p.slice(1))}">WhatsApp</a>`) +
        row(x.c.f, x.c.f === "Delivery" ? esc(x.c.a) : "Pick-up") + row("When", esc(niceDate(x.c.d) + ", " + x.c.tm)) + (x.c.no ? row("Notes", esc(x.c.no)) : "") +
        row("Payment method", esc(method(x.pm).name)) +
        (x.py ? row("Payment", "Customer says they have paid") + (x.py.txn ? row("Transaction ID", `<b>${esc(x.py.txn)}</b>`) : "") + (x.py.from ? row("Paid from", esc(x.py.from + (x.py.s ? " (" + x.py.s + ")" : ""))) : "") : row("Payment", "Not reported yet"));
    } else {
      rows = row("Event", esc(x.ty)) + row("Date", esc(niceDate(x.d))) + row("Venue", esc(x.v || "To be shared")) + row("Package", esc((x.g ? x.g + " / " : "") + x.pk)) + row("Guests", esc(x.gu)) +
        x.ad.map((a) => row("Extra", `${esc(a[0])} · ${money(a[1])}`)).join("") +
        (x.pi || []).map((p) => row(p[0] + (p[2] ? "" : ` (${p[1].length} of ${p[3]})`), esc(p[1].length ? p[1].join(", ") : "Not chosen yet, please suggest"))).join("") +
        (x.pr ? row("Payment reported", `<b>${money(x.pr.amt)}</b> by ${esc(method(x.pr.pm).name)} (${esc(x.pr.k)})`) : "") +
      (x.tot ? row("Estimated total", `<b>${money(x.tot)}</b> (excl. transport)`) + row(`${C.eventDepositPercent}% token`, `<b>${money(x.dep)}</b>`) : row("Price", "Custom quote needed")) +
        row("Name", esc(x.n)) + row("Phone", `<a href="tel:${esc(x.p)}">${esc(x.p)}</a> · <a href="https://wa.me/233${esc(x.p.slice(1))}">WhatsApp</a>`) + (x.m ? row("Message", esc(x.m)) : "") + row("Preferred payment", esc(method(x.pm).name));
    }
    if (x.cx) rows = row("Cancelled", `<b style="color:#b3261e">Yes, by the customer on the website</b>`) + row("Reason", esc(x.cx.r || "Not given")) + (x.cx.n ? row("Customer note", esc(x.cx.n)) : "") +
      row("Paid?", x.cx.paid ? "You had confirmed payment (no refund per Terms, except force majeure 40%)" : "Payment had not been confirmed") + rows;
    return `<div style="font-family:Arial,sans-serif;max-width:560px">
      <div style="background:${color};color:#fff;padding:14px 16px;border-radius:10px;font-size:18px;font-weight:bold">${esc(title)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px">${rows}</table>
      <p style="margin-top:14px">${inv ? `<a href="${esc(inv)}" style="background:#a8174f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;margin-right:8px">${inv.includes("/r/") ? "🧾 Create receipt" : "📄 Create invoice"}</a>` : ""}<a href="${esc(url)}" style="background:#3b1f14;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open verify page</a></p>
      <p style="color:#888;font-size:12px">This alert comes from the Break-a-Fast order server, not from the customer, so the details above are exactly what was placed on the website.</p></div>`;
  }
  function sendAlert(kind, x, url, inv) {
    if (!ALERT_URL || !ALERT_KEY) return Promise.resolve();
    { const code = (url.split("/v/")[1] || "").split("?")[0]; if (code) url = url.split("?")[0] + "?k=" + ownerKey(code); }
    let subject, title, color;
    if (kind === "order") { subject = `🟡 New order ${x.ref} · ${money(x.tot)} · send invoice`; title = `New order ${x.ref}: create and send the invoice`; color = "#c27a12"; }
    else if (kind === "paid") { subject = `🟢 Payment reported ${x.ref} · ${money(x.tot)} · ${method(x.pm).name}${x.py.txn ? " · TXN " + x.py.txn : ""} · ${x.c.tm}`; title = `Customer reported payment for ${x.ref}. Check your ${method(x.pm).name} SMS.`; color = "#2f7d4a"; }
    else if (kind === "cancelled") { subject = `🔴 CANCELLED ${x.ref} · ${x.t === "e" ? x.ty + " · " + niceDate(x.d) : money(x.tot) + " · " + niceDate(x.c.d)}`; title = `The customer cancelled ${x.ref}. Do not prepare it.`; color = "#b3261e"; }
    else if (kind === "confirmed") { const amt = x.t === "e" ? x.pr.amt : x.tot; subject = `✅ Payment confirmed ${x.ref} · ${money(amt)}`; title = `You confirmed ${money(amt)} received for ${x.ref}.`; color = "#2f7d4a"; }
    else if (kind === "eventpaid") { const k = { deposit: "Deposit", full: "Full payment", other: "Payment" }[x.pr.k] || "Payment"; subject = `🟢 ${k} reported ${x.ref} · ${money(x.pr.amt)} · ${method(x.pr.pm).name} · ${x.ty} ${niceDate(x.d)}`; title = `${k} of ${money(x.pr.amt)} reported for ${x.ref}. Check your ${method(x.pr.pm).name} SMS.`; color = "#2f7d4a"; }
    else { subject = `🎉 Event enquiry ${x.ref} · ${x.ty} · ${niceDate(x.d)}`; title = `New event enquiry ${x.ref}`; color = "#a8174f"; }
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 20000);
    return fetch(ALERT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: ALERT_KEY, subject, html: alertHtml(title, color, x, url, inv) }), redirect: "follow", signal: ctrl.signal })
      .then((r) => r.text()).then((t) => { if (t.trim() !== "ok") console.error("alert not sent:", /<html/i.test(t) ? "Google returned a sign-in page: set the Apps Script web app access to Anyone" : t.slice(0, 200)); })
      .catch((e) => console.error("alert failed:", e.message));
  }

  /* ---------- tiny rate limiter ---------- */
  const hits = new Map();
  function limited(ip) {
    const now = Date.now(), w = hits.get(ip) || [];
    const recent = w.filter((t) => now - t < 10 * 60 * 1000);
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > 40;
  }

  /* ---------- request handler (platform-neutral) ----------
     req: { method, pathname, origin, base, ip, bodyText }
     returns { status, type, body, headers, waits } */
  async function handle(req) {
    const cors = req.origin && ALLOWED_ORIGINS.includes(req.origin)
      ? { "Access-Control-Allow-Origin": req.origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } : {};
    const waits = [];
    const out = (status, body, type = "application/json") => ({ status, type, body: type === "application/json" ? JSON.stringify(body) : body, headers: cors, waits });
    const base = req.base, p = req.pathname;
    try {
      if (req.method === "OPTIONS") return out(204, "", "text/plain");
      if (req.method === "GET" && p === "/health") return out(200, { ok: true });
      if (req.method === "GET" && p.startsWith("/v/")) {
        const t = decodeURIComponent(p.slice(3)).replace(/[^0-9A-Za-z._-]/g, "");
        const k = new URLSearchParams(req.search || "").get("k");
        const xv = t.includes(".") ? open(t) : openShort(t), cx = xv && (await getStatus(xv.ref)) === "x";
        return { ...out(200, await markCx(verifyPage(xv, t, okOwner(t, k) && !cx, base), xv), "text/html"), headers: {} };
      }
      if (req.method === "GET" && p.startsWith("/t/")) {
        const t = decodeURIComponent(p.slice(3)).replace(/[^0-9A-Za-z._-]/g, "");
        const q = new URLSearchParams(req.search || ""), st = q.get("s"), g = q.get("g") || "";
        const x = t.includes(".") ? open(t) : openShort(t);
        const code = x ? shortCode(x) : "";
        let stage = "p";
        if (x && st && ["i", "c", "x", "pr", "od", "dn"].includes(st)) { const a = Buffer.from(g), b2 = Buffer.from(trackSig(code, st)); if (a.length === b2.length && crypto.timingSafeEqual(a, b2)) stage = st; }
        if (x && x.cf && (RANK[stage] || 0) < 4) stage = "c";
        if (x) stage = bestStage(stage, await getStatus(x.ref));
        return { ...out(200, trackPage(x, stage), "text/html"), headers: { "Cache-Control": "no-store" } };
      }
      if (req.method === "GET" && p.startsWith("/d/")) {
        const t = decodeURIComponent(p.slice(3)).replace(/[^0-9A-Za-z._~-]/g, "");
        const i = t.lastIndexOf("~"), body = t.slice(0, i), sig = t.slice(i + 1);
        const g = Buffer.from(docSig(body)), a = Buffer.from(sig || "");
        let x = null, pre = null, kind = "i";
        if (i > 0 && a.length === g.length && crypto.timingSafeEqual(a, g)) {
          const [k, code, f, d, q, r, pp, n] = body.split("~");
          x = openShort(code); kind = k;
          pre = { f, d, q, r, p: pp, n: n ? Buffer.from(n, "base64url").toString("utf8") : "" };
          if (x && kind === "r" && x.t === "e" && !x.pr) x = { ...x, pr: { amt: Number(r) || 0, k: "other", pm: x.pm, at: new Date().toISOString() } };
          if (x && kind === "r" && x.t === "o" && !x.py) x = { ...x, py: { txn: "", from: "", s: "", at: new Date().toISOString() } };
        }
        return { ...out(200, await markCx(invoicePage(x, kind === "r", x ? shortCode(x) : "", { preset: pre || {}, base }), x), "text/html"), headers: {} };
      }
      if (req.method === "GET" && p.startsWith("/r/")) {
        const t = decodeURIComponent(p.slice(3)).replace(/[^0-9A-Za-z._-]/g, "");
        const xr = t.includes(".") ? open(t) : openShort(t);
        return { ...out(200, await markCx(invoicePage(xr, true, xr ? shortCode(xr) : "", { owner: t.includes("."), base }), xr), "text/html"), headers: {} };
      }
      if (req.method === "GET" && p.startsWith("/i/")) {
        const t = decodeURIComponent(p.slice(3)).replace(/[^0-9A-Za-z._-]/g, "");
        const xi = t.includes(".") ? open(t) : openShort(t);
        return { ...out(200, await markCx(invoicePage(xi, false, xi ? shortCode(xi) : "", { owner: t.includes("."), base }), xi), "text/html"), headers: {} };
      }
      if (req.method === "POST" && p.startsWith("/api/")) {
        if (limited(req.ip || "?")) return out(429, { error: "Too many requests. Please wait a few minutes." });
        need((req.bodyText || "").length <= 20000, "Request too large.");
        let b;
        try { b = JSON.parse(req.bodyText || "{}"); } catch (e) { throw new Bad("Invalid request."); }
        need(b && typeof b === "object", "Invalid request.");
        if (p === "/api/order") {
          const o = buildOrder(b), token = seal(o), v = `${base}/v/${shortCode(o)}`;
          waits.push(sendAlert("order", o, v, `${base}/i/${token}`));
          return out(200, { order: o, token, verifyUrl: v, message: orderText(o, v), trackUrl: trackUrl(base, shortCode(o), "p") });
        }
        if (p === "/api/pay") {
          const tk = String(b.t || "").replace(/[^0-9A-Za-z._-]/g, "");
          const o = b.token ? open(b.token) : tk ? (tk.includes(".") ? open(tk) : openShort(tk)) : null;
          need(o && o.t === "o", "This order could not be verified. Please message us on WhatsApp.");
          const st0 = await getStatus(o.ref);
          need(st0 !== "x", "This order was cancelled. Please place a new order or message us on WhatsApp.");
          if ((RANK[st0] || 0) >= 3 || (await kvGet("paid:" + o.ref))) return out(409, { error: ALREADY, already: true, ref: o.ref });
          kvSet("paid:" + o.ref, "1");
          const txn = str(b.txn, 40), from = str(b.from, 40);   // optional (no longer asked on the site)
          if (o.c.tm === PENDING) {
            const tm = str(b.time, 40);
            need(HOURLY.some((t) => t.label === tm), "Please choose your delivery time.");
            need(slotOpen(o.c.d, tm), "That time is no longer available. Please choose a later time.");
            o.c.tm = tm;
          }
          if (b.payment && method(b.payment)) o.pm = b.payment;
          o.py = { txn, from, s: str(b.sender, 80), at: new Date().toISOString() };
          const token = seal(o), v = `${base}/v/${shortCode(o)}`;
          waits.push(sendAlert("paid", o, v, `${base}/r/${token}`), setStatus(o.ref, "pd"));
          return out(200, { order: o, token, verifyUrl: v, message: orderText(o, v) });
        }
        if (p === "/api/doc") {
          const code = String(b.code || "").replace(/[^0-9A-Za-z]/g, "");
          need(okOwner(code, b.k), "Please open this page from the link in your email.");
          need(openShort(code), "This order link is not valid.");
          need((await getStatus(openShort(code).ref)) !== "x", "The customer cancelled this order.");
          const num = (v) => { const n = Math.max(0, Math.round(Number(v) * 100) / 100); return Number.isFinite(n) && n < 1e7 ? String(n) : "0"; };
          const note = Buffer.from(str(b.n, 120)).toString("base64url");
          const body = [b.kind === "r" ? "r" : "i", code, num(b.f), num(b.d), num(b.q), num(b.r), num(b.p), note].join("~");
          waits.push(setStatus(openShort(code).ref, b.kind === "r" ? "c" : "i"));
          return out(200, { ok: true, url: `${base}/d/${body}~${docSig(body)}` });
        }
        if (p === "/api/progress") {
          const code = String(b.code || "").replace(/[^0-9A-Za-z]/g, "");
          need(okOwner(code, b.k), "Please open this page from the link in your email.");
          const x = openShort(code); need(x, "This order link is not valid.");
          need(["pr", "od", "dn"].includes(b.s), "Unknown step.");
          need((await getStatus(x.ref)) !== "x", "The customer cancelled this order.");
          waits.push(setStatus(x.ref, b.s));
          return out(200, { ok: true });
        }
        if (p === "/api/cancel") {
          const t = String(b.code || "").replace(/[^0-9A-Za-z._-]/g, "");
          const x = t.includes(".") ? open(t) : openShort(t);
          need(x, "This order link is not valid.");
          const code = shortCode(x), date = x.t === "e" ? x.d : x.c.d;
          need(Date.parse(date) - Date.parse(ghanaToday()) >= 864e5, "It's too close to the day to cancel online.");
          const st = ["i", "c"].includes(b.s) ? b.s : "", g = Buffer.from(String(b.g || "")), w = st ? Buffer.from(trackSig(code, st)) : null;
          const paid = !!(st === "c" && w && g.length === w.length && crypto.timingSafeEqual(g, w));
          const reason = String(b.reason || "").slice(0, 60), note = String(b.note || "").replace(/\s+/g, " ").trim().slice(0, 300);
          const y = { ...x, cx: { r: reason, n: note, paid } };
          waits.push(sendAlert("cancelled", y, `${base}/v/${code}`, ""), setStatus(x.ref, "x"));
          return out(200, { ok: true, ref: x.ref, track: trackUrl(base, code, "x"), site: ALLOWED_ORIGINS[0] || "" });
        }
        if (p === "/api/confirm") {
          const t = String(b.code || "").replace(/[^0-9A-Za-z._-]/g, "");
          need(okOwner(t, b.k), "Please open this page from the link in your email.");
          const x = t.includes(".") ? open(t) : openShort(t);
          need(x, "This order link is not valid.");
          need((await getStatus(x.ref)) !== "x", "The customer cancelled this order, so it can't be confirmed.");
          let y;
          if (x.t === "e") {
            const amt = Math.round(Number(b.amt) * 100) / 100;
            need(amt > 0 && amt <= 1000000, "Please enter the amount received.");
            y = { ...x, pr: { amt, k: "other", pm: method(b.pm) ? b.pm : x.pm, at: new Date().toISOString() }, cf: 1 };
          } else {
            y = { ...x, py: x.py || { txn: "", from: "", s: "", at: new Date().toISOString() }, cf: 1 };
          }
          const rUrl = `${base}/r/${seal(y)}`;
          waits.push(sendAlert("confirmed", y, `${base}/v/${t}`, rUrl), setStatus(x.ref, "c"));
          return out(200, { ok: true, receipt: rUrl });
        }
        if (p === "/api/event-paid") {
          const t = String(b.t || "").replace(/[^0-9A-Za-z._-]/g, "");
          const e = t.includes(".") ? open(t) : openShort(t);
          need(e && e.t === "e", "This booking link is not valid. Please message us on WhatsApp.");
          const st0 = await getStatus(e.ref);
          need(st0 !== "x", "This booking was cancelled. Please message us on WhatsApp.");
          const k = ["deposit", "full", "other"].includes(b.kind) ? b.kind : "other";
          const amt = Math.round(Number(b.amount) * 100) / 100;
          need(amt > 0 && amt <= 1000000, "Please enter the amount you paid.");
          const pm = method(b.payment) ? b.payment : e.pm;
          // one report per payment: blocked while the last one is unconfirmed, or if it's the same payment again
          const last = await kvGet("paid:" + e.ref), sig = k + ":" + amt;
          if (st0 === "pd" || last === sig || (last && !KV && st0 !== "c")) return out(409, { error: ALREADY, already: true, ref: e.ref });
          kvSet("paid:" + e.ref, sig);
          const e2 = { ...e, pr: { amt, k, pm, at: new Date().toISOString() } };
          const v = `${base}/v/${shortCode(e)}`;
          waits.push(sendAlert("eventpaid", e2, v, `${base}/r/${seal(e2)}`), setStatus(e.ref, "pd"));
          return out(200, { ok: true, ref: e.ref });
        }
        if (p === "/api/event") {
          const e = buildEvent(b), v = `${base}/v/${shortCode(e)}`;
          waits.push(sendAlert("event", e, v, `${base}/i/${seal(e)}`));
          return out(200, { enquiry: e, verifyUrl: v, message: eventText(e, v), trackUrl: trackUrl(base, shortCode(e), "p") });
        }
      }
      return out(404, { error: "Not found" });
    } catch (e) {
      if (e instanceof Bad) return out(400, { error: e.message });
      console.error(e);
      return out(500, { error: "Something went wrong. Please try again." });
    }
  }
  return { handle };
}
if (typeof module !== "undefined" && module.exports) module.exports = createApp;
