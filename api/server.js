/* Break-a-Fast order API
   - Re-prices every order/enquiry from the site's own catalogue (customers cannot change prices)
   - Issues order references and seals the details with an HMAC signature
   - Serves /v/<token>: a verification page the owner opens from the WhatsApp message.
     Any edit to the sealed details makes the page show "NOT VALID".
   No dependencies: Node 18+ built-ins only. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const SECRET = process.env.SIGNING_SECRET || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://break-a-fast.onrender.com").split(",").map((s) => s.trim());
const ALERT_URL = process.env.ALERT_URL || "";
const ALERT_KEY = process.env.ALERT_KEY || "";
if (SECRET.length < 32) { console.error("SIGNING_SECRET must be set (32+ chars)"); process.exit(1); }

/* ---------- load the site's catalogue (single source of truth) ---------- */
const ROOT = path.join(__dirname, "..");
const sandbox = { window: {} };
for (const f of ["js/config.js", "js/products.js", "js/events-data.js"]) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox);
const W = sandbox.window;
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
  w.u8(1); // version
  w.u32(refNum(x.ref));
  w.u8((isE ? 1 : 0) | (pmIdx(x.pm) << 1) | ((!isE && x.c.f === "Pick-up" ? 1 : 0) << 3) | ((isE ? 0 : Math.max(0, TIMES.indexOf(x.c.tm))) << 4) | ((hasPay ? 1 : 0) << 6) | ((fromIsPhone ? 1 : 0) << 7));
  w.u24(Math.round((Date.parse(x.at) - EPOCH) / 60000));
  w.u16(days(isE ? x.d : x.c.d));
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
  if (!buf || buf.length < 20 || buf[0] !== 1) return null;
  const body = buf.subarray(0, buf.length - 9), mac = buf.subarray(buf.length - 9);
  const good = crypto.createHmac("sha256", SECRET).update(body).digest().subarray(0, 9);
  if (!crypto.timingSafeEqual(good, mac)) return null;
  try {
    const r = new Rd(body); r.u8();
    const refN = r.u32(), fl = r.u8(), at = new Date(EPOCH + r.u24() * 60000).toISOString(), d = isoDay(r.u16()), phone = r.phone(), tot = r.u32() / 100;
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
    const n = r.str(), o = { t: "o", ref: C.orderPrefix + "-" + refStr(refN), at, it, tot, c: { n, p: phone, f: fl & 8 ? "Pick-up" : "Delivery", d, tm: TIMES[(fl >> 4) & 3] }, pm };
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
const TIMES = ["Morning (8am to 12pm)", "Afternoon (12pm to 4pm)", "Evening (4pm to 7pm)"];
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
  need(TIMES.includes(c.time), "Please choose a time.");
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
  need(method(b.payment), "Please choose a payment method.");
  const tot = base + addons.reduce((s, a) => s + a[1], 0);
  return {
    t: "e", ref: makeRef("EVT"), at: new Date().toISOString(),
    g: pkg ? g.name : "", pk: pkg ? pkg.name : "Custom / bulk order", gu: guests, ad: addons,
    tot, dep: pkg ? Math.round(tot * C.eventDepositPercent) / 100 : 0,
    ty: str(b.type, 40) || "Other", n: name, p: phone, d: b.date, v: str(b.venue, 120), m: str(b.message, 600),
    pm: b.payment
  };
}

const unitOf = (i) => (i[4] != null && i[3] ? i[4] / i[3] : null);
const itemTitle = (i) => `${i[0]}${i[2] ? " (" + i[2] + ")" : ""}`;
const itemCalc = (i) => unitOf(i) != null ? `${i[3]} × ${i[1]} at ${money(unitOf(i))} = ${money(i[4])}` : `${i[3]} × ${i[1]}`;

/* ---------- WhatsApp text (built server-side; the Verify link is what counts) ---------- */
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
  if (o.py) L.push(`Customer says they sent ${money(o.tot)}`, `Transaction ID: ${o.py.txn}`, `Paid from: ${o.py.from}${o.py.s ? " (" + o.py.s + ")" : ""}`, `Reference: ${o.ref}`);
  else L.push(`Not paid yet.`);
  return L.concat(verifyLine(url)).join("\n");
}
function eventText(e, url) {
  const m = method(e.pm);
  const L = [`*EVENT ENQUIRY: ${e.ref}*`, ``, `Event: ${e.ty}`, `Date: ${niceDate(e.d)}`, `Venue: ${e.v || "To be shared"}`,
    `Package: ${e.g ? e.g + " / " : ""}${e.pk}`, `Guests: ${e.gu}`, ...e.ad.map((a) => `Extra: ${a[0]} (${money(a[1])})`)];
  if (e.tot) L.push(`Estimated total: ${money(e.tot)} (excl. transport)`, `${C.eventDepositPercent}% token: ${money(e.dep)}`);
  L.push(``, `Name: ${e.n}`, `Phone: ${e.p}`);
  if (e.m) L.push(`Message: ${e.m}`);
  L.push(``, `Preferred payment: ${m.name}`, `Please confirm availability and send my invoice. I'll pay the token after your confirmation.`);
  return L.concat(verifyLine(url)).join("\n");
}

/* ---------- verify page ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function verifyPage(x) {
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
      ${x.py ? row("Customer's Transaction ID", esc(x.py.txn)) + row("Paid from", esc(x.py.from + (x.py.s ? " (" + x.py.s + ")" : ""))) : row("Payment", "Not reported yet")}
      </table>
      <div class="todo"><b>Before you start this order:</b> check your ${esc(m ? m.name : "")} SMS/statement shows <b>${money(x.tot)}</b> received${x.py ? ` with Transaction ID <b>${esc(x.py.txn)}</b>` : ""} and reference <b>${esc(x.ref)}</b>. The website cannot see your account, so only your own SMS/statement proves the money arrived.</div>`;
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
      <div class="todo">When the token arrives, check your SMS/statement shows the right amount with reference <b>${esc(x.ref)}</b>.</div>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Verify | Break-a-Fast</title><style>
body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#fbf3e6;color:#2a1710}
main{max-width:640px;margin:0 auto;padding:20px 16px 40px}h1{font-size:1rem;color:#3b1f14;margin:0 0 14px}
.ok,.bad{font-weight:800;font-size:1.4rem;padding:16px;border-radius:14px;text-align:center;color:#fff}.ok{background:#2f7d4a}.bad{background:#c0392b}
.sub{color:#6f5547;font-size:.9rem;text-align:center}h2{margin:16px 0 8px;color:#3b1f14}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e8d6bd;vertical-align:top}
th{color:#6f5547;font-weight:600;width:38%}th,td{overflow-wrap:anywhere}.item{font-weight:700;color:#3b1f14}.calc{color:#6f5547;margin-top:2px}.calc b{color:#2a1710}.big{font-size:1.2rem;color:#a8174f}.todo{margin-top:16px;background:#fff7e6;border:1px solid #f1d39a;border-radius:12px;padding:12px 14px}
</style></head><body><main><h1>Break-a-Fast · Order verification</h1>${body}</main></body></html>`;
}

/* ---------- owner email alerts (via the owner's Google Apps Script) ---------- */
function alertHtml(title, color, x, url) {
  const row = (k, v) => `<tr><td style="padding:6px 10px;color:#6f5547;border-bottom:1px solid #eee;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${v}</td></tr>`;
  let rows = "";
  if (x.t === "o") {
    rows = x.it.map((i) => row(itemTitle(i), esc(itemCalc(i)))).join("") + row("TOTAL", `<b style="font-size:18px;color:#a8174f">${money(x.tot)}</b>`) +
      row("Name", esc(x.c.n)) + row("Phone", `<a href="tel:${esc(x.c.p)}">${esc(x.c.p)}</a> · <a href="https://wa.me/233${esc(x.c.p.slice(1))}">WhatsApp</a>`) +
      row(x.c.f, x.c.f === "Delivery" ? esc(x.c.a) : "Pick-up") + row("When", esc(niceDate(x.c.d) + ", " + x.c.tm)) + (x.c.no ? row("Notes", esc(x.c.no)) : "") +
      row("Payment method", esc(method(x.pm).name)) +
      (x.py ? row("Transaction ID", `<b>${esc(x.py.txn)}</b>`) + row("Paid from", esc(x.py.from + (x.py.s ? " (" + x.py.s + ")" : ""))) : row("Payment", "Not reported yet"));
  } else {
    rows = row("Event", esc(x.ty)) + row("Date", esc(niceDate(x.d))) + row("Venue", esc(x.v || "To be shared")) + row("Package", esc((x.g ? x.g + " / " : "") + x.pk)) + row("Guests", esc(x.gu)) +
      x.ad.map((a) => row("Extra", `${esc(a[0])} · ${money(a[1])}`)).join("") +
      (x.tot ? row("Estimated total", `<b>${money(x.tot)}</b> (excl. transport)`) + row(`${C.eventDepositPercent}% token`, `<b>${money(x.dep)}</b>`) : row("Price", "Custom quote needed")) +
      row("Name", esc(x.n)) + row("Phone", `<a href="tel:${esc(x.p)}">${esc(x.p)}</a> · <a href="https://wa.me/233${esc(x.p.slice(1))}">WhatsApp</a>`) + (x.m ? row("Message", esc(x.m)) : "") + row("Preferred payment", esc(method(x.pm).name));
  }
  return `<div style="font-family:Arial,sans-serif;max-width:560px">
    <div style="background:${color};color:#fff;padding:14px 16px;border-radius:10px;font-size:18px;font-weight:bold">${esc(title)}</div>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px">${rows}</table>
    <p style="margin-top:14px"><a href="${esc(url)}" style="background:#3b1f14;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open verify page</a></p>
    <p style="color:#888;font-size:12px">This alert comes from the Break-a-Fast order server, not from the customer, so the details above are exactly what was placed on the website.</p></div>`;
}
function sendAlert(kind, x, url) {
  if (!ALERT_URL || !ALERT_KEY) return;
  let subject, title, color;
  if (kind === "order") { subject = `🟡 New order ${x.ref} · ${money(x.tot)} · awaiting payment`; title = `New order ${x.ref}: awaiting payment`; color = "#c27a12"; }
  else if (kind === "paid") { subject = `🟢 Payment reported ${x.ref} · ${money(x.tot)} · ${method(x.pm).name} · TXN ${x.py.txn}`; title = `Customer reported payment for ${x.ref}. Check your ${method(x.pm).name} SMS.`; color = "#2f7d4a"; }
  else { subject = `🎉 Event enquiry ${x.ref} · ${x.ty} · ${niceDate(x.d)}`; title = `New event enquiry ${x.ref}`; color = "#a8174f"; }
  const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 20000);
  fetch(ALERT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: ALERT_KEY, subject, html: alertHtml(title, color, x, url) }), redirect: "follow", signal: ctrl.signal })
    .then((r) => r.text()).then((t) => { if (!/ok/.test(t)) console.error("alert not sent:", t.slice(0, 200)); })
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

/* ---------- server ---------- */
function send(res, code, body, type = "application/json", extra = {}) {
  res.writeHead(code, { "Content-Type": type + "; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...extra });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 20000) { reject(new Bad("Request too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Bad("Invalid request.")); } });
    req.on("error", reject);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const origin = req.headers.origin;
  const cors = origin && ALLOWED_ORIGINS.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } : {};
  const base = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  try {
    if (req.method === "OPTIONS") return send(res, 204, "", "text/plain", cors);
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true }, "application/json", cors);
    if (req.method === "GET" && url.pathname.startsWith("/v/")) { const t = decodeURIComponent(url.pathname.slice(3)).replace(/[^0-9A-Za-z._-]/g, ""); return send(res, 200, verifyPage(t.includes(".") ? open(t) : openShort(t)), "text/html"); }
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim();
      if (limited(ip)) return send(res, 429, { error: "Too many requests. Please wait a few minutes." }, "application/json", cors);
      const b = await readJson(req);
      if (url.pathname === "/api/order") {
        const o = buildOrder(b), token = seal(o), v = `${base}/v/${shortCode(o)}`;
        sendAlert("order", o, v);
        return send(res, 200, { order: o, token, verifyUrl: v, message: orderText(o, v) }, "application/json", cors);
      }
      if (url.pathname === "/api/pay") {
        const o = open(b.token);
        need(o && o.t === "o", "This order could not be verified. Please place it again.");
        const txn = str(b.txn, 40), from = str(b.from, 40);
        need(txn.length >= 4, "Please enter the Transaction ID.");
        need(from.replace(/\D/g, "").length >= 6, "Please enter the number or account you paid from.");
        if (b.payment && method(b.payment)) o.pm = b.payment;
        o.py = { txn, from, s: str(b.sender, 80), at: new Date().toISOString() };
        const token = seal(o), v = `${base}/v/${shortCode(o)}`;
        sendAlert("paid", o, v);
        return send(res, 200, { order: o, token, verifyUrl: v, message: orderText(o, v) }, "application/json", cors);
      }
      if (url.pathname === "/api/event") {
        const e = buildEvent(b), v = `${base}/v/${shortCode(e)}`;
        sendAlert("event", e, v);
        return send(res, 200, { enquiry: e, verifyUrl: v, message: eventText(e, v) }, "application/json", cors);
      }
    }
    send(res, 404, { error: "Not found" }, "application/json", cors);
  } catch (e) {
    if (e instanceof Bad) return send(res, 400, { error: e.message }, "application/json", cors);
    console.error(e);
    send(res, 500, { error: "Something went wrong. Please try again." }, "application/json", cors);
  }
}).listen(PORT, () => console.log("Break-a-Fast API on " + PORT));
