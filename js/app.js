/* Break-a-Fast: shared site logic (layout, cart, product cards, modal) */
(function () {
  const C = window.BAF_CONFIG;
  const P = window.BAF_PRODUCTS || [];

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "GH₵" + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const waLink = (text) => "https://wa.me/" + C.whatsappIntl + (text ? "?text=" + encodeURIComponent(text) : "");
  const telLink = (n) => "tel:" + n.replace(/\s/g, "");

  const SPRING_SVG =
    '<svg viewBox="0 0 120 80" aria-hidden="true"><g transform="rotate(-18 60 40)">' +
    '<rect x="14" y="22" width="78" height="20" rx="10" fill="#d98a2b"/><rect x="14" y="22" width="78" height="20" rx="10" fill="url(#g)" opacity=".35"/>' +
    '<path d="M24 26c8 4 16-4 24 0s16-4 24 0 12-3 16 0" stroke="#a85d12" stroke-width="2" fill="none"/></g>' +
    '<g transform="rotate(10 64 52)"><rect x="26" y="44" width="78" height="20" rx="10" fill="#e9a043"/>' +
    '<path d="M36 48c8 4 16-4 24 0s16-4 24 0 12-3 16 0" stroke="#b8681a" stroke-width="2" fill="none"/></g>' +
    '<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs></svg>';

  const productMedia = (p, cls = "") =>
    p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" class="${cls}">` : `<div class="art-spring ${cls}" role="img" aria-label="${esc(p.name)}">${SPRING_SVG}</div>`;

  /* ---------- cart ---------- */
  const CART_KEY = "baf_cart_v1";
  const Cart = {
    items() { return store.get(CART_KEY, []); },
    save(items) { store.set(CART_KEY, items); updateCartCount(); document.dispatchEvent(new CustomEvent("cart:change")); },
    add(productId, optionIndex, flavour, qty) {
      const items = this.items();
      const key = [productId, optionIndex, flavour || ""].join("|");
      const found = items.find((i) => i.key === key);
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({ key, productId, optionIndex, flavour: flavour || "", qty });
      this.save(items);
    },
    setQty(key, qty) {
      let items = this.items();
      const it = items.find((i) => i.key === key);
      if (!it) return;
      if (qty <= 0) items = items.filter((i) => i.key !== key);
      else it.qty = Math.min(99, qty);
      this.save(items);
    },
    remove(key) { this.save(this.items().filter((i) => i.key !== key)); },
    clear() { this.save([]); },
    detailed() {
      return this.items()
        .map((i) => {
          const p = P.find((x) => x.id === i.productId);
          if (!p || !p.options[i.optionIndex]) return null;
          const o = p.options[i.optionIndex];
          return { ...i, product: p, option: o, unit: o.price, line: o.price * i.qty };
        })
        .filter(Boolean);
    },
    count() { return this.items().reduce((s, i) => s + i.qty, 0); },
    total() { return this.detailed().reduce((s, i) => s + i.line, 0); }
  };

  function updateCartCount() {
    $$(".cart-count").forEach((el) => (el.textContent = Cart.count()));
  }

  /* ---------- layout (header / footer) ---------- */
  const NAV = [
    ["index.html", "Home"],
    ["menu.html", "Menu"],
    ["events.html", "Events & Catering"],
    ["about.html", "About"],
    ["contact.html", "Contact"]
  ];
  function currentPage() {
    const f = location.pathname.split("/").pop() || "index.html";
    return f.includes(".") ? f : "index.html";
  }
  function renderLayout() {
    const cur = currentPage();
    const links = NAV.map(([h, t]) => `<a href="${h}"${h === cur ? ' aria-current="page"' : ""}>${t}</a>`).join("");
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html" aria-label="${esc(C.businessName)} home">
          <img src="assets/img/logo-sm.jpg" alt="" width="44" height="44">
          <span>Break-a-Fast<small>Bistro &amp; Bar</small></span>
        </a>
        <nav class="nav" aria-label="Main">${links}</nav>
        <div class="header-actions">
          <a class="cart-btn" href="checkout.html" aria-label="View cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.3a2 2 0 0 0 2 1.7h8.2a2 2 0 0 0 2-1.6L22 7H6"/></svg>
            <span class="cart-count">0</span>
          </a>
          <button class="menu-toggle" aria-label="Open menu" aria-expanded="false">
            <svg width="26" height="26" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>
      <nav class="mobile-nav" aria-label="Mobile">${links}<a href="checkout.html">Cart &amp; Checkout</a></nav>`;
    document.body.prepend(header);
    const skip = document.createElement("a");
    skip.className = "skip"; skip.href = "#main"; skip.textContent = "Skip to content";
    document.body.prepend(skip);

    const t = $(".menu-toggle", header), mn = $(".mobile-nav", header);
    t.addEventListener("click", () => {
      const open = mn.classList.toggle("open");
      t.setAttribute("aria-expanded", open);
    });

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="wrap">
        <div class="cols">
          <div>
            <h3>${esc(C.businessName)}</h3>
            <p class="script" style="color:var(--gold);font-size:1.1rem">${esc(C.tagline)}</p>
            <p class="small">Handcrafted cinnamon rolls, frozen spring rolls, breakfast &amp; lunch packs, and event catering, made with love and served with joy.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <ul>${NAV.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}<li><a href="checkout.html">Cart &amp; Checkout</a></li></ul>
          </div>
          <div>
            <h3>Order &amp; Enquiries</h3>
            <ul>
              <li>📞 <a href="${telLink(C.phone)}">${esc(C.phone)}</a> / <a href="${telLink(C.altPhone)}">${esc(C.altPhone)}</a></li>
              <li>💬 <a href="${waLink()}" target="_blank" rel="noopener">WhatsApp ${esc(C.phone)}</a></li>
              <li>📸 <a href="https://instagram.com/${esc(C.instagram)}" target="_blank" rel="noopener">@${esc(C.instagram)}</a></li>
              <li>💳 Telecel Cash · MTN MoMo · Bank transfer</li>
            </ul>
          </div>
        </div>
        <div class="copy-line">© ${new Date().getFullYear()} ${esc(C.businessName)}. Good rolls, good mood.</div>
      </div>`;
    document.body.appendChild(footer);

    if (!document.body.classList.contains("no-float")) {
      const wa = document.createElement("a");
      wa.className = "wa-float";
      wa.href = waLink("Hello Break-a-Fast! I'd like to make an enquiry.");
      wa.target = "_blank"; wa.rel = "noopener";
      wa.setAttribute("aria-label", "Chat with us on WhatsApp");
      wa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>';
      document.body.appendChild(wa);
    }
    updateCartCount();
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(html) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = html;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  /* ---------- product cards ---------- */
  function productCard(p) {
    const chips = p.options.map((o) => `<span class="price-chip">${esc(o.label)} · <b>${money(o.price)}</b></span>`).join("");
    return `
      <article class="card product-card">
        <div class="thumb" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="View ${esc(p.name)}">
          ${productMedia(p)}
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
        </div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.short)}</p>
          ${p.flavours ? `<p class="small"><b>${esc(p.flavourLabel || "Flavours")}:</b> ${p.flavours.map(esc).join(", ")}</p>` : ""}
          <div class="price-row">${chips}</div>
          <div class="card-actions">
            <button class="btn btn-orange btn-sm" data-open="${esc(p.id)}">Choose &amp; add to cart</button>
          </div>
        </div>
      </article>`;
  }
  function bindProductOpeners(root = document) {
    $$("[data-open]", root).forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener("click", () => openProduct(el.dataset.open));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(el.dataset.open); } });
    });
  }

  /* ---------- product detail modal ---------- */
  let lastFocus;
  function openProduct(id) {
    const p = P.find((x) => x.id === id);
    if (!p) return;
    lastFocus = document.activeElement;
    let m = $("#product-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "product-modal"; m.className = "modal";
      m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "pd-title");
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m) closeProduct(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && m.classList.contains("open")) closeProduct(); });
    }
    const gallery = p.gallery || (p.image ? [p.image] : []);
    m.innerHTML = `
      <div class="modal-panel">
        <button class="modal-close" aria-label="Close">×</button>
        <div class="pd">
          <div class="pd-media">
            ${p.image ? `<img class="main" src="${esc(gallery[0])}" alt="${esc(p.name)}">` : productMedia(p)}
            ${gallery.length > 1 ? `<div class="pd-thumbs">${gallery.map((g, i) => `<img src="${esc(g)}" alt="${esc(p.flavours ? p.flavours[i] : "")}" class="${i === 0 ? "active" : ""}" data-i="${i}">`).join("")}</div>` : ""}
          </div>
          <form class="pd-info">
            <h2 id="pd-title">${esc(p.name)}</h2>
            <p class="muted">${esc(p.description)}</p>
            ${p.flavours ? `<fieldset class="opt-group"><legend>Choose ${esc((p.flavourLabel || "flavour").toLowerCase())}</legend><div class="opts">
              ${p.flavours.map((f, i) => `<label><input type="radio" name="flavour" value="${esc(f)}" ${i === 0 ? "checked" : ""}><span>${esc(f)}</span></label>`).join("")}
            </div></fieldset>` : ""}
            <fieldset class="opt-group"><legend>Package</legend><div class="opts">
              ${p.options.map((o, i) => `<label><input type="radio" name="opt" value="${i}" ${i === 0 ? "checked" : ""}><span>${esc(o.label)} · ${money(o.price)}</span></label>`).join("")}
            </div></fieldset>
            <fieldset class="opt-group"><legend>Quantity</legend>
              <div class="qty"><button type="button" data-d="-1" aria-label="Decrease">−</button><input name="qty" type="number" min="1" max="99" value="1" aria-label="Quantity"><button type="button" data-d="1" aria-label="Increase">+</button></div>
            </fieldset>
            <p style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 14px"><span class="muted">Total</span><span class="pd-total">${money(p.options[0].price)}</span></p>
            <button class="btn btn-block" type="submit">Add to cart</button>
          </form>
        </div>
      </div>`;
    const form = $("form", m);
    const qtyIn = $("input[name=qty]", form);
    const recalc = () => {
      const o = p.options[+form.opt.value];
      const q = Math.max(1, Math.min(99, parseInt(qtyIn.value, 10) || 1));
      $(".pd-total", m).textContent = money(o.price * q);
    };
    $$(".qty button", form).forEach((b) => b.addEventListener("click", () => { qtyIn.value = Math.max(1, Math.min(99, (parseInt(qtyIn.value, 10) || 1) + +b.dataset.d)); recalc(); }));
    form.addEventListener("input", recalc);
    // flavour <-> gallery sync
    $$(".pd-thumbs img", m).forEach((t) => t.addEventListener("click", () => {
      $(".main", m).src = t.src;
      $$(".pd-thumbs img", m).forEach((x) => x.classList.toggle("active", x === t));
      if (p.flavours && p.flavours[t.dataset.i]) { const r = form.querySelector(`input[name=flavour][value="${CSS.escape(p.flavours[t.dataset.i])}"]`); if (r) r.checked = true; }
    }));
    if (p.gallery && p.flavours) {
      $$("input[name=flavour]", form).forEach((r, i) => r.addEventListener("change", () => {
        if (p.gallery[i]) { $(".main", m).src = p.gallery[i]; $$(".pd-thumbs img", m).forEach((x, j) => x.classList.toggle("active", i === j)); }
      }));
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = Math.max(1, Math.min(99, parseInt(qtyIn.value, 10) || 1));
      const fl = form.flavour ? form.flavour.value : "";
      Cart.add(p.id, +form.opt.value, fl, q);
      closeProduct();
      toast(`Added to cart ✓ <a href="checkout.html">View cart (${Cart.count()})</a>`);
    });
    $(".modal-close", m).addEventListener("click", closeProduct);
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    $(".modal-close", m).focus();
  }
  function closeProduct() {
    const m = $("#product-modal");
    if (m) m.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- clipboard ---------- */
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      ta.remove();
    }
    if (btn) { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = o), 1600); }
  }

  /* ---------- public API ---------- */
  window.BAF = { $, $$, esc, money, store, waLink, telLink, Cart, productCard, productMedia, bindProductOpeners, openProduct, toast, copyText, config: C, products: P };

  document.addEventListener("DOMContentLoaded", () => {
    renderLayout();
    // Fill any [data-cfg] placeholders with config values (phone numbers, etc.)
    $$("[data-cfg]").forEach((el) => {
      const v = el.dataset.cfg.split(".").reduce((o, k) => (o ? o[k] : ""), C);
      el.textContent = v;
    });
    $$("[data-wa]").forEach((el) => (el.href = waLink(el.dataset.wa)));
    $$("[data-products]").forEach((el) => {
      const filter = el.dataset.products;
      const list = filter === "featured" ? P.filter((p) => p.featured) : P.filter((p) => p.category === filter);
      el.innerHTML = list.map(productCard).join("");
    });
    bindProductOpeners();
    const q = new URLSearchParams(location.search).get("product");
    if (q) openProduct(q);
  });
})();
