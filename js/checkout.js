/* Break-a-Fast: checkout flow (Cart -> Details -> Review -> place order) */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, money, store, Cart, productMedia, config: C } = window.BAF;
  const form = $("#details-form");
  const METHODS = C.paymentMethods;
  const methodName = (id) => (METHODS.find((m) => m.id === id) || {}).name || id;
  $("#pay-methods").innerHTML = METHODS.map((m, i) => `<label><input type="radio" name="payment" value="${esc(m.id)}"${i === 0 ? " checked" : ""}> <span>${esc(m.name)}<small>${m.kind === "bank" ? esc(m.bank) : "Mobile money"}</small></span></label>`).join("");
  // Wake the order server early (free hosting sleeps when idle)
  fetch(C.apiBase + "/health").catch(() => {});
  const DRAFT_KEY = "baf_details_v1";

  /* ---------- steps ---------- */
  let step = 1;
  function go(n) {
    if (n > 1 && Cart.count() === 0) n = 1;
    step = n;
    $$(".step-pane").forEach((p) => (p.hidden = +p.dataset.pane !== n));
    $$("#steps li").forEach((li) => {
      const s = +li.dataset.s;
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
      if (s === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    if (n === 3) renderReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("[data-next]").forEach((b) => b.addEventListener("click", () => go(+b.dataset.next)));

  /* ---------- cart ---------- */
  function renderCart() {
    const items = Cart.detailed();
    const box = $("#cart-lines");
    $("#cart-nav [data-next]").disabled = items.length === 0;
    if (!items.length) {
      box.innerHTML = `<div class="empty"><div class="big">🧺</div><p><b>Your cart is empty.</b></p><p class="muted">Browse the menu and add some treats.</p><a class="btn" href="menu.html">Go to menu</a></div>`;
    } else {
      box.innerHTML = items.map((i) => `
        <div class="line-item" data-key="${esc(i.key)}">
          ${productMedia(i.product)}
          <div>
            <div class="li-top"><b>${esc(i.product.name)}</b><span>${money(i.line)}</span></div>
            <div class="li-meta">${esc(i.option.label)}${i.flavour ? " · " + esc(i.flavour) : ""} · ${money(i.unit)} each</div>
            <div class="li-actions">
              <div class="qty"><button type="button" data-d="-1" aria-label="Decrease quantity">−</button><input type="number" min="1" max="99" value="${i.qty}" aria-label="Quantity"><button type="button" data-d="1" aria-label="Increase quantity">+</button></div>
              <button class="link-btn" type="button" data-remove>Remove</button>
            </div>
          </div>
        </div>`).join("");
      $$(".line-item", box).forEach((row) => {
        const key = row.dataset.key, input = $("input", row);
        $$("[data-d]", row).forEach((b) => b.addEventListener("click", () => Cart.setQty(key, (parseInt(input.value, 10) || 1) + +b.dataset.d)));
        input.addEventListener("change", () => Cart.setQty(key, Math.max(1, parseInt(input.value, 10) || 1)));
        $("[data-remove]", row).addEventListener("click", () => Cart.remove(key));
      });
    }
    renderSummary();
  }
  function renderSummary() {
    const items = Cart.detailed();
    const total = Cart.total();
    $("#summary").innerHTML = items.length
      ? items.map((i) => `<div class="sum-row small"><span>${esc(i.product.name)}${i.flavour ? " · " + esc(i.flavour) : ""}<br><span class="muted">${i.qty} × ${esc(i.option.label)} at ${money(i.unit)}</span></span><span>${money(i.line)}</span></div>`).join("") +
        `<div class="sum-row sum-total"><span>Total to pay</span><span>${money(total)}</span></div>
         <p class="small muted" style="margin:6px 0 0">${isDelivery() ? "+ delivery fee, agreed on WhatsApp based on your location." : "Pick-up: no delivery fee."}</p>`
      : `<p class="muted">No items yet.</p>`;
  }
  document.addEventListener("cart:change", renderCart);

  /* ---------- details ---------- */
  const isDelivery = () => (form.fulfilment ? form.fulfilment.value === "Delivery" : true);
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.date.min = today.toISOString().slice(0, 10);
  if (!form.date.value) form.date.value = form.date.min;

  // restore saved details (handy for repeat customers)
  const draft = store.get(DRAFT_KEY, null);
  if (draft) ["name", "phone", "address"].forEach((k) => { if (draft[k]) form[k].value = draft[k]; });
  if (draft && draft.fulfilment) form.fulfilment.value = draft.fulfilment;
  if (draft && draft.payment && METHODS.some((m) => m.id === draft.payment)) form.payment.value = draft.payment;

  function toggleAddress() { $("#addr-field").hidden = !isDelivery(); renderSummary(); }
  $$("input[name=fulfilment]", form).forEach((r) => r.addEventListener("change", toggleAddress));

  const normPhone = (v) => {
    let d = String(v).replace(/[^\d+]/g, "");
    if (d.startsWith("+233")) d = "0" + d.slice(4);
    else if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
    return d;
  };
  function validate() {
    const checks = {
      name: form.name.value.trim().length >= 2,
      phone: /^0\d{9}$/.test(normPhone(form.phone.value)),
      address: !isDelivery() || form.address.value.trim().length >= 5,
      date: !!form.date.value && form.date.value >= form.date.min
    };
    let first = null;
    Object.entries(checks).forEach(([k, ok]) => {
      const f = form[k].closest(".field");
      f.classList.toggle("invalid", !ok);
      if (!ok && !first) first = form[k];
    });
    if (first) first.focus();
    return !first;
  }
  $$("input, textarea", form).forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("invalid")));

  function details() {
    return {
      name: form.name.value.trim(),
      phone: normPhone(form.phone.value),
      fulfilment: form.fulfilment.value,
      address: isDelivery() ? form.address.value.trim() : "",
      date: form.date.value,
      time: form.time.value,
      notes: form.notes.value.trim(),
      payment: form.payment.value
    };
  }
  $("#to-review").addEventListener("click", () => {
    if (!validate()) return;
    const d = details();
    store.set(DRAFT_KEY, { name: d.name, phone: d.phone, address: d.address, fulfilment: d.fulfilment, payment: d.payment });
    go(3);
  });

  /* ---------- review ---------- */
  const niceDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  function renderReview() {
    const d = details(), items = Cart.detailed();
    $("#review").innerHTML = `
      <div class="review-block">
        <h3>Items <button class="link-btn small" type="button" data-goto="1">Edit</button></h3>
        ${items.map((i) => `<div class="sum-row"><span>${esc(i.product.name)}${i.flavour ? " · " + esc(i.flavour) : ""}<br><span class="muted small">${i.qty} × ${esc(i.option.label)} at ${money(i.unit)}</span></span><b>${money(i.line)}</b></div>`).join("")}
        <div class="sum-row sum-total"><span>Total to pay</span><span>${money(Cart.total())}</span></div>
      </div>
      <div class="review-block">
        <h3>Your details <button class="link-btn small" type="button" data-goto="2">Edit</button></h3>
        <dl>
          <dt>Name</dt><dd>${esc(d.name)}</dd>
          <dt>Phone</dt><dd>${esc(d.phone)}</dd>
          <dt>${esc(d.fulfilment)}</dt><dd>${d.fulfilment === "Delivery" ? esc(d.address) : "Pick-up point shared on WhatsApp"}</dd>
          <dt>When</dt><dd>${niceDate(d.date)}, ${esc(d.time)}</dd>
          ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ""}
          <dt>Payment</dt><dd>${esc(methodName(d.payment))}</dd>
        </dl>
      </div>
      <div class="notice"><b>What happens next:</b> when you place your order you'll get an <b>order reference</b>. Then you'll send <b>${money(Cart.total())}</b> by ${esc(methodName(d.payment))} using that reference, and confirm your payment with us on WhatsApp.</div>`;
    $$("[data-goto]", $("#review")).forEach((b) => b.addEventListener("click", () => go(+b.dataset.goto)));
  }
  const agree = $("#agree"), place = $("#place");
  agree.addEventListener("change", () => (place.disabled = !agree.checked));

  /* ---------- place order (sealed by the order server) ---------- */
  place.addEventListener("click", async () => {
    if (!Cart.count() || !agree.checked || place.dataset.busy) return;
    place.dataset.busy = "1";
    const label = place.textContent;
    place.disabled = true;
    place.textContent = "Placing your order…";
    const slow = setTimeout(() => (place.textContent = "Still working… (up to a minute)"), 6000);
    $("#place-err")?.remove();
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 90000);
      const r = await fetch(C.apiBase + "/api/order", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ items: Cart.items().map(({ productId, optionIndex, flavour, qty }) => ({ productId, optionIndex, flavour, qty })), customer: details(), payment: details().payment })
      });
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not place your order.");
      const orders = store.get("baf_orders_v1", {});
      orders[j.order.ref] = { ...j.order, token: j.token, verifyUrl: j.verifyUrl, status: "Pending Payment" };
      store.set("baf_orders_v1", orders);
      Cart.clear();
      location.href = "order.html?ref=" + encodeURIComponent(j.order.ref);
    } catch (e) {
      const msg = e.name === "AbortError" ? "The connection timed out." : e.message;
      place.insertAdjacentHTML("afterend", `<div id="place-err" class="notice warn" style="margin-top:12px;flex-basis:100%"><b>${esc(msg)}</b> Please check your internet and try again. Your cart is still saved.</div>`);
      place.disabled = !agree.checked;
      place.textContent = label;
    } finally {
      clearTimeout(slow);
      delete place.dataset.busy;
    }
  });

  toggleAddress();
  renderCart();
  go(1);
});
