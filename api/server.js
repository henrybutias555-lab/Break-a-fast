/* Break-a-Fast order API: Node server (used on Render). Logic lives in core.js. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const createApp = require("./core.js");

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
  W: sandbox.window, crypto, Buffer,
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
      method: req.method, pathname: url.pathname, origin: req.headers.origin,
      base: `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`,
      ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim(),
      bodyText: size > 20000 ? "x".repeat(20001) : Buffer.concat(chunks).toString("utf8")
    });
    res.writeHead(r.status, { "Content-Type": r.type + "; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...r.headers });
    res.end(r.body);
  });
}).listen(PORT, () => console.log("Break-a-Fast API on " + PORT));
