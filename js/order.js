/* Break-a-Fast: payment + confirmation page.
   The order was sealed by the order server; the WhatsApp message carries a Verify link. */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, money, store, waLink, copyText, config: C } = window.BAF;
  const METHODS = C.paymentMethods;
  const ref = new URLSearchParams(location.search).get("ref") || "";
  const orders = store.get("baf_orders_v1", {});
  const order = orders[ref];
  const root = $("#order-root");

  const setStep = (n) => $$("#steps li").forEach((li) => {
    const s = +li.dataset.s;
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });

  if (!order || !order.token) {
    $("#head").innerHTML = `<h1>Order not found</h1>`;
    root.innerHTML = `<div class="panel"><p>We couldn't find this order on this device. If you already placed an order, please message us on WhatsApp with your order reference${ref ? " <b>" + esc(ref) + "</b>" : ""}.</p>
      <div class="step-nav"><a class="btn btn-ghost" href="menu.html">Back to menu</a><a class="btn btn-wa" href="${waLink("Hello Break-a-Fast! I need help with my order " + ref)}" target="_blank" rel="noopener">Chat on WhatsApp</a></div></div>`;
    return;
  }

  const save = () => { orders[order.ref] = order; store.set("baf_orders_v1", orders); };
  let c = order.c;
  let pm = METHODS.find((m) => m.id === order.pm) || METHODS[0];
  const niceDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const amount = String(order.tot);
  BAF.wake();

  function renderHead() {
    const st = order.status === "Awaiting Confirmation" ? "awaiting" : "pending";
    $("#head").innerHTML = `
      <p class="script" style="font-size:1.2rem;margin:0">Thank you, ${esc(c.n.split(" ")[0])}!</p>
      <h1 style="margin-bottom:6px">Order ${esc(order.ref)}</h1>
      <span class="status ${st}">${esc(order.status)}</span>`;
  }

  function summaryPanel() {
    return `
      <aside class="panel summary">
        <h2>Order summary</h2>
        ${order.it.map((i) => `<div class="sum-row small"><span>${esc(i[0])}${i[2] ? " · " + esc(i[2]) : ""}<br><span class="muted">${i[3]} × ${esc(i[1])} at ${money(i[4] / i[3])}</span></span><span>${money(i[4])}</span></div>`).join("")}
        <div class="sum-row sum-total"><span>Total</span><span>${money(order.tot)}</span></div>
        <div class="review-block" style="margin-top:14px">
          <dl>
            <dt>Name</dt><dd>${esc(c.n)}</dd>
            <dt>Phone</dt><dd>${esc(c.p)}</dd>
            <dt>${esc(c.f)}</dt><dd>${c.f === "Delivery" ? esc(c.a) : "Pick-up"}</dd>
            <dt>When</dt><dd>${niceDate(c.d)}, ${esc(c.tm)}</dd>
          </dl>
        </div>
        ${c.f === "Delivery" ? `<p class="small muted" style="margin:0">Delivery fee is not included. We'll agree it with you on WhatsApp.</p>` : ""}
      </aside>`;
  }

  function steps(m) {
    if (m.kind === "bank") return `
      <li><span>Open your bank app or visit your bank, and start a transfer.</span></li>
      <li><span>Bank: <b>${esc(m.bank)}</b>. Account number: <code class="k">${esc(m.number)}</code>.</span></li>
      <li><span>Account name: <b>${esc(m.accountName)}</b>.</span></li>
      <li><span>Amount: <code class="k">${esc(amount)}</code>. In the reference / narration, enter <code class="k">${esc(order.ref)}</code>.</span></li>
`;
    return `
      <li><span>Dial <code class="k">${esc(m.ussd)}</code> on your ${esc(m.name.split(" ")[0])} line.</span></li>
      <li><span>Choose <b>${m.id === "mtn" ? "Transfer Money" : "Send Money"}</b>, then send to a <b>${esc(m.name)}</b> number.</span></li>
      <li><span>Enter <code class="k">${esc(m.number)}</code> and confirm it.</span></li>
      <li><span>Enter the amount <code class="k">${esc(amount)}</code>.</span></li>
      <li><span>For reference, enter <code class="k">${esc(order.ref)}</code>.</span></li>
      <li><span>Check that the name shown is <b>${esc(m.accountName)}</b>, then enter your PIN.</span></li>
`;
  }

  function renderPay() {
    setStep(4);
    const m = pm, fg = m.textColor || "#fff";
    root.innerHTML = `
      <div class="checkout">
        <section class="panel" aria-labelledby="h-pay">
          <h2 id="h-pay">4. Pay with ${esc(m.name)}</h2>
          <div class="pkg-tabs" role="radiogroup" aria-label="Payment method">
            ${METHODS.map((x) => `<button type="button" role="radio" aria-selected="${x.id === m.id}" aria-checked="${x.id === m.id}" data-pm="${esc(x.id)}">${esc(x.name)}</button>`).join("")}
          </div>
          <p class="muted">Send the <b>exact amount</b> below and use your <b>order reference</b> so we can match your payment to your order.</p>
          <div class="pay-card" style="background:${esc(m.color)};color:${esc(fg)}">
            <div class="grid-pay">
              <div class="row"><div><div class="lbl">Amount</div><div class="val">${money(order.tot)}</div></div><button class="copy" data-copy="${esc(amount)}">Copy</button></div>
              ${m.kind === "bank" ? `<div><div class="lbl">Bank</div><div style="font-weight:800">${esc(m.bank)}</div></div>` : ""}
              <div class="row"><div><div class="lbl">${m.kind === "bank" ? "Account number" : esc(m.name) + " number"}</div><div class="val">${esc(m.number)}</div></div><button class="copy" data-copy="${esc(m.number)}">Copy</button></div>
              <div class="row"><div><div class="lbl">Reference</div><div class="val">${esc(order.ref)}</div></div><button class="copy" data-copy="${esc(order.ref)}">Copy</button></div>
              <div><div class="lbl">Account name</div><div style="font-weight:800">${esc(m.accountName)}</div></div>
            </div>
          </div>
          <h3 style="margin-top:22px">How to pay</h3>
          <ol class="ussd-steps">${steps(m)}</ol>
          ${m.kind === "momo" ? `<p class="small muted" style="margin-top:10px">Menu wording can differ slightly on your phone. Paying from another network? Use your network's <i>“Send to other networks”</i> option and choose ${esc(m.name.split(" ")[0])}.</p>` : ""}
          <div class="notice warn" style="margin-top:12px"><b>Stay safe:</b> we will never ask for your PIN. Only pay to the details shown on this page.</div>
          <div class="step-nav">
            <a class="btn btn-ghost" href="${waLink("Hello Break-a-Fast! I have a question about my order " + order.ref + " before paying.")}" target="_blank" rel="noopener">Question before paying?</a>
            <button class="btn" type="button" id="paid">I've sent the money →</button>
          </div>
        </section>
        ${summaryPanel()}
      </div>`;
    $$("[data-copy]", root).forEach((b) => b.addEventListener("click", () => copyText(b.dataset.copy, b)));
    $$("[data-pm]", root).forEach((b) => b.addEventListener("click", () => { pm = METHODS.find((x) => x.id === b.dataset.pm); renderPay(); }));
    $("#paid").addEventListener("click", renderConfirm);
  }

  const PENDING = "Time chosen after payment";
  const OH = Object.assign({ open: 8, close: 19, sameDayLeadHours: 4, sameDayMaxSlots: 3 }, C.orderHours);
  const hr = (h) => (h === 12 ? "12pm" : h > 12 ? h - 12 + "pm" : h + "am");
  function openSlots(iso) {
    const out = [], now = new Date(), today = now.toISOString().slice(0, 10), h = now.getUTCHours() + now.getUTCMinutes() / 60;
    if (iso < today) return out;
    for (let s = OH.open; s < OH.close; s++) if (iso !== today || s >= h + OH.sameDayLeadHours) out.push(`${hr(s)} to ${hr(s + 1)}`);
    return iso === today ? out.slice(0, OH.sameDayMaxSlots) : out;
  }

  function renderConfirm() {
    setStep(5);
    const needTime = c.tm === PENDING, slots = needTime ? openSlots(c.d) : [];
    root.innerHTML = `
      <div class="checkout">
        <section class="panel" aria-labelledby="h-conf">
          <h2 id="h-conf">5. Confirm your payment${needTime ? " &amp; choose your time" : ""}</h2>
          <form class="form" id="pay-form" novalidate>
            <label class="check"><input type="checkbox" name="ok" required> <span>I have sent <b>${money(order.tot)}</b> by <b>${esc(pm.name)}</b> to <b>${esc(pm.number)}</b> with reference <b>${esc(order.ref)}</b>.</span></label>
            ${needTime ? (slots.length ? `
            <div class="field" id="time-field" hidden>
              <label for="p-time">Delivery time on ${niceDate(c.d)}</label>
              <select id="p-time" name="time">${slots.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
              <div class="hint">Now that you've paid, pick the time that suits you.</div>
            </div>` : `<div class="notice warn">There are no time slots left for ${niceDate(c.d)}. Please message us on WhatsApp after confirming and we'll arrange a time.</div>`) : ""}
            <div class="step-nav">
              <button class="btn btn-ghost" type="button" id="back">← Payment details</button>
              <button class="btn btn-wa" type="submit" id="send" disabled>Continue</button>
            </div>
          </form>
        </section>
        ${summaryPanel()}
      </div>`;
    const f = $("#pay-form"), send = $("#send"), tf = $("#time-field");
    f.ok.addEventListener("change", () => { send.disabled = !f.ok.checked; if (tf) tf.hidden = !f.ok.checked; });
    $("#back").addEventListener("click", renderPay);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!f.ok.checked) return;
      send.disabled = true; send.textContent = "Saving…";
      $("#pay-err")?.remove();
      try {
        const r = await BAF.api("/api/pay", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: order.token, payment: pm.id, time: f.time ? f.time.value : "" })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not save your payment confirmation.");
        Object.assign(order, j.order, { token: j.token, verifyUrl: j.verifyUrl, message: j.message, status: "Awaiting Confirmation" });
        c = order.c;
        save();
        renderDone();
      } catch (err) {
        send.insertAdjacentHTML("afterend", `<div id="pay-err" class="notice warn" style="flex-basis:100%"><b>${esc(err.message)}</b> Please check your internet and try again.</div>`);
        send.disabled = false; send.textContent = "Continue";
      }
    });
  }

  function renderDone() {
    renderHead();
    const url = waLink(order.message);
    const m = METHODS.find((x) => x.id === order.pm) || pm;
    root.innerHTML = `
      <div class="checkout">
        <section class="panel" aria-labelledby="h-done">
          <h2 id="h-done">Last step: send it to us</h2>
          <p>Tap the button to open WhatsApp with your order and payment details, then tap <b>Send</b>.</p>
          <a class="btn btn-wa btn-block" href="${url}" target="_blank" rel="noopener">Send on WhatsApp</a>
          <p class="small muted" style="margin-top:10px">The message includes a secure verify link, so we can confirm your order details quickly.</p>
          <h3 style="margin-top:22px">What happens next</h3>
          <ol class="timeline">
            <li><div><b>We verify your payment</b>We check our ${esc(m.name)} account for <b>${money(order.tot)}</b> with reference <code class="k">${esc(order.ref)}</code>.</div></li>
            <li><div><b>We confirm on WhatsApp</b>Your order is marked <i>Paid</i> and we confirm your ${c.f === "Delivery" ? "delivery fee and time" : "pick-up point and time"}.</div></li>
            <li><div><b>Enjoy!</b>Freshly made and ready on ${niceDate(c.d)}, ${esc(c.tm.toLowerCase())}.</div></li>
          </ol>
          <div class="step-nav"><a class="btn btn-ghost" href="menu.html">Back to menu</a></div>
        </section>
        ${summaryPanel()}
      </div>`;
    $$("#steps li").forEach((li) => { li.classList.add("done"); li.classList.remove("active"); });
  }

  renderHead();
  if (order.status === "Awaiting Confirmation" && order.message) renderDone();
  else renderPay();
});
