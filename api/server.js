/* Break-a-Fast order API: Node server (used on Render). Logic lives in core.js. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const createApp = require("./core.js");
const qrcode = require("../assets/vendor/qrcode.js");
const QR = (text) => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createDataURL(4, 2); };

/* Tiny Redis/Key Value client (no dependencies): remembers order status across restarts. */
function makeKV(u) {
  if (!u) return null;
  const net = require("net"), tls = require("tls"), url = new URL(u);
  let sock = null, buf = Buffer.alloc(0), queue = [];
  const enc = (args) => "*" + args.length + "\r\n" + args.map((a) => { a = String(a); return "$" + Buffer.byteLength(a) + "\r\n" + a + "\r\n"; }).join("");
  function parse() {   // simple replies only: +OK, -ERR, :n, $bulk
    while (buf.length && queue.length) {
      const i = buf.indexOf("\r\n"); if (i < 0) return;
      const t = String.fromCharCode(buf[0]), line = buf.slice(1, i).toString();
      let val, used = i + 2;
      if (t === "$") { const n = Number(line); if (n < 0) val = null; else { if (buf.length < used + n + 2) return; val = buf.slice(used, used + n).toString(); used += n + 2; } }
      else if (t === "-") val = new Error(line); else val = line;
      buf = buf.slice(used); const q = queue.shift(); val instanceof Error ? q.no(val) : q.ok(val);
    }
  }
  function conn() {
    if (sock && !sock.destroyed) return sock;
    const opt = { host: url.hostname, port: Number(url.port) || 6379 };
    sock = url.protocol === "rediss:" ? tls.connect({ ...opt, servername: url.hostname }) : net.connect(opt);
    buf = Buffer.alloc(0);
    sock.on("data", (d) => { buf = Buffer.concat([buf, d]); parse(); });
    const fail = (e) => { queue.splice(0).forEach((q) => q.no(e || new Error("closed"))); sock = null; };
    sock.on("error", fail); sock.on("close", () => fail());
    if (url.password) { const pre = url.username ? ["AUTH", decodeURIComponent(url.username), decodeURIComponent(url.password)] : ["AUTH", decodeURIComponent(url.password)]; queue.push({ ok() {}, no() {} }); sock.write(enc(pre)); }
    return sock;
  }
  const cmd = (...args) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error("timeout")), 4000);
    queue.push({ ok: (v) => { clearTimeout(t); ok(v); }, no: (e) => { clearTimeout(t); no(e); } }); conn().write(enc(args)); });
  return { get: (k) => cmd("GET", k), set: (k, v) => cmd("SET", k, v, "EX", 200 * 86400) };
}

const PORT = process.env.PORT || 8787;
const SECRET = process.env.SIGNING_SECRET || "";
if (SECRET.length < 32) { console.error("SIGNING_SECRET must be set (32+ chars)"); process.exit(1); }

const ROOT = path.join(__dirname, "..");
const sandbox = { window: {} };
for (const f of ["js/config.js", "js/products.js", "js/events-data.js"]) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox);

const app = createApp({
  SECRET,
  ALERT_URL: process.env.ALERT_URL || "",
  ALERT_KEY: process.env.ALERT_KEY || "",
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "https://break-a-fast.onrender.com").split(",").map((s) => s.trim()),
  W: sandbox.window, crypto, Buffer, QR, KV: makeKV(process.env.KV_URL || ""),
  LOGOS: Object.fromEntries([["header", "logo-invoice.jpg"], ["watermark", "logo-watermark.jpg"]].map(([k, f]) => {
    try { return [k, "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "assets", "img", f)).toString("base64")]; } catch (e) { return [k, ""]; }
  }))
});

http.createServer((req, res) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size <= 20001) chunks.push(c); });
  req.on("end", async () => {
    const url = new URL(req.url, "http://x");
    const r = await app.handle({
      method: req.method, pathname: url.pathname, search: url.search, origin: req.headers.origin,
      base: `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`,
      ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim(),
      bodyText: size > 20000 ? "x".repeat(20001) : Buffer.concat(chunks).toString("utf8")
    });
    res.writeHead(r.status, { "Content-Type": r.type + "; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...r.headers });
    res.end(r.body);
  });
}).listen(PORT, () => console.log("Break-a-Fast API on " + PORT));
