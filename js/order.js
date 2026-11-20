/* Break-a-Fast: payment (Telecel Cash) + confirmation page */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, money, store, waLink, copyText, config: C } = window.BAF;
  const PAY = C.payment;
  const ref = new URLSearchParams(location.search).get("ref") || "";
  const orders = store.get("baf_orders_v1", {});
  const order = orders[ref];
  const root = $("#order-root");

  const setStep = (n) => $$("#steps li").forEach((li) => {
    const s = +li.dataset.s;
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });

  if (!order) {
    $("#head").innerHTML = `<h1>Order not found</h1>`;
    root.innerHTML = `<div class="panel"><p>We couldn't find this order on this device. If you already placed an order, please message us on WhatsApp with your order reference${ref ? " <b>" + esc(ref) + "</b>" : ""}.</p>
      <div class="step-nav"><a class="btn btn-ghost" href="menu.html">Back to menu</a><a class="btn btn-wa" href="${waLink("Hello Break-a-Fast! I need help with my order " + ref)}" target="_blank" rel="noopener">Chat on WhatsApp</a></div></div>`;
    return;
  }

  const save = () => { orders[order.ref] = order; store.set("baf_orders_v1", orders); };
  const d = order.customer;
  const niceDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const amount = order.total.toFixed(2).replace(/\.00$/, "");

  function waMessage(pay) {
    const lines = [
      `*NEW ORDER: ${order.ref}*`,
      ``,
      ...order.items.map((i) => `• ${i.qty} × ${i.name} (${i.option}${i.flavour ? ", " + i.flavour : ""}): ${money(i.line)}`),
      `*Total: ${money(order.total)}*`,
      ``,
      `*Customer*`,
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      `${d.fulfilment}${d.fulfilment === "Delivery" ? ": " + d.address : ""}`,
      `When: ${niceDate(d.date)}, ${d.time}`,
      d.notes ? `Notes: ${d.notes}` : null,
      ``,
      `*Payment: ${PAY.method}*`
    ];
    if (pay) {
      lines.push(
        `Amount sent: ${money(order.total)} to ${PAY.number}`,
        `Transaction ID: ${pay.txn}`,
        `Sent from: ${pay.from}${pay.sender ? " (" + pay.sender + ")" : ""}`,
        `Reference used: ${order.ref}`,
        ``,
        `Please confirm my payment. Thank you!`
      );
    } else {
      lines.push(`Not paid yet. I have a question before paying.`);
    }
    return lines.filter((l) => l !== null).join("\n");
  }

  function renderHead() {
    const st = order.status === "Awaiting Confirmation" ? "awaiting" : "pending";
    $("#head").innerHTML = `
      <p class="script" style="font-size:1.2rem;margin:0">Thank you, ${esc(d.name.split(" ")[0])}!</p>
      <h1 style="margin-bottom:6px">Order ${esc(order.ref)}</h1>
      <span class="status ${st}">${esc(order.status)}</span>`;
  }

  function summaryPanel() {
    return `
      <aside class="panel summary">
        <h2>Order summary</h2>
        ${order.items.map((i) => `<div class="sum-row small"><span>${i.qty} × ${esc(i.name)}<br><span class="muted">${esc(i.option)}${i.flavour ? " · " + esc(i.flavour) : ""}</span></span><span>${money(i.line)}</span></div>`).join("")}
        <div class="sum-row sum-total"><span>Total</span><span>${money(order.total)}</span></div>
        <div class="review-block" style="margin-top:14px">
          <dl>
            <dt>Name</dt><dd>${esc(d.name)}</dd>
            <dt>Phone</dt><dd>${esc(d.phone)}</dd>
            <dt>${esc(d.fulfilment)}</dt><dd>${d.fulfilment === "Delivery" ? esc(d.address) : "Pick-up"}</dd>
            <dt>When</dt><dd>${niceDate(d.date)}, ${esc(d.time)}</dd>
          </dl>
        </div>
        ${d.fulfilment === "Delivery" ? `<p class="small muted" style="margin:0">Delivery fee is not included. We'll agree it with you on WhatsApp.</p>` : ""}
      </aside>`;
  }

  function renderPay() {
    setStep(4);
    root.innerHTML = `
      <div class="checkout">
        <div style="display:grid;gap:20px">
          <section class="panel" aria-labelledby="h-pay">
            <h2 id="h-pay">4. Pay with Telecel Cash</h2>
            <p class="muted">Your order has been created. Send the <b>exact amount</b> below to our Telecel Cash number and use your <b>order reference</b> so we can match your payment.</p>
            <div class="pay-card">
              <div class="grid-pay">
                <div class="row"><div><div class="lbl">Amount</div><div class="val">${money(order.total)}</div></div><button class="copy" data-copy="${esc(amount)}">Copy</button></div>
                <div class="row"><div><div class="lbl">Telecel Cash number</div><div class="val">${esc(PAY.number)}</div></div><button class="copy" data-copy="${esc(PAY.number)}">Copy</button></div>
                <div class="row"><div><div class="lbl">Reference</div><div class="val">${esc(order.ref)}</div></div><button class="copy" data-copy="${esc(order.ref)}">Copy</button></div>
                <div><div class="lbl">Account name</div><div style="font-weight:800">${esc(PAY.accountName)}</div></div>
              </div>
            </div>

            <h3 style="margin-top:22px">How to send with Telecel Cash</h3>
            <ol class="ussd-steps">
              <li><span>Dial <code class="k">${esc(PAY.ussd)}</code> on your Telecel line.</span></li>
              <li><span>Choose <b>Send Money</b>, then send to a <b>Telecel Cash</b> number.</span></li>
              <li><span>Enter <code class="k">${esc(PAY.number)}</code> and confirm it.</span></li>
              <li><span>Enter the amount <code class="k">${esc(amount)}</code>.</span></li>
              <li><span>For reference, enter <code class="k">${esc(order.ref)}</code>.</span></li>
              <li><span>Check that the name shown is <b>${esc(PAY.accountName)}</b>, then enter your PIN.</span></li>
              <li><span>Keep the <b>Transaction ID</b> from your confirmation SMS. You'll need it in the next step.</span></li>
            </ol>
            <p class="small muted" style="margin-top:10px">Menu wording can differ slightly on your phone. Paying from MTN MoMo or AT Money? Use your network's <i>“Send to other networks”</i> option and choose Telecel.</p>
            <div class="notice warn" style="margin-top:12px"><b>Stay safe:</b> we will never ask for your PIN. Only send money to <b>${esc(PAY.number)}</b>.</div>
            <div class="step-nav">
              <a class="btn btn-ghost" href="${waLink(waMessage(null))}" target="_blank" rel="noopener">Question before paying?</a>
              <button class="btn btn-telecel" type="button" id="paid">I've sent the money →</button>
            </div>
          </section>
        </div>
        ${summaryPanel()}
      </div>`;
    $$("[data-copy]", root).forEach((b) => b.addEventListener("click", () => copyText(b.dataset.copy, b)));
    $("#paid").addEventListener("click", renderConfirm);
  }

  function renderConfirm() {
    setStep(5);
    const p = order.payment || {};
    root.innerHTML = `
      <div class="checkout">
        <section class="panel" aria-labelledby="h-conf">
          <h2 id="h-conf">5. Confirm your payment</h2>
          <p class="muted">Enter the details from your Telecel Cash confirmation SMS. We'll send everything to Break-a-Fast on WhatsApp so we can verify it and start on your order.</p>
          <form class="form" id="pay-form" novalidate>
            <div class="field">
              <label for="p-txn">Transaction ID</label>
              <input id="p-txn" name="txn" autocomplete="off" placeholder="From your confirmation SMS" value="${esc(p.txn || "")}" required>
              <div class="err">Please enter the Transaction ID from your SMS.</div>
            </div>
            <div class="row-2">
              <div class="field">
                <label for="p-from">Number you paid from</label>
                <input id="p-from" name="from" type="tel" inputmode="tel" value="${esc(p.from || d.phone)}" required>
                <div class="err">Please enter the number you paid from.</div>
              </div>
              <div class="field">
                <label for="p-sender">Name on that wallet</label>
                <input id="p-sender" name="sender" value="${esc(p.sender || d.name)}">
              </div>
            </div>
            <label class="check"><input type="checkbox" name="ok" required> <span>I have sent <b>${money(order.total)}</b> to <b>${esc(PAY.number)}</b> with reference <b>${esc(order.ref)}</b>.</span></label>
            <div class="step-nav">
              <button class="btn btn-ghost" type="button" id="back">← Payment details</button>
              <button class="btn btn-wa" type="submit" id="send" disabled>Send confirmation on WhatsApp</button>
            </div>
          </form>
        </section>
        ${summaryPanel()}
      </div>`;
    const f = $("#pay-form");
    f.ok.addEventListener("change", () => ($("#send").disabled = !f.ok.checked));
    $("#back").addEventListener("click", renderPay);
    $$("input", f).forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("invalid")));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const txn = f.txn.value.trim(), from = f.from.value.trim();
      f.txn.closest(".field").classList.toggle("invalid", txn.length < 4);
      f.from.closest(".field").classList.toggle("invalid", from.replace(/\D/g, "").length < 9);
      if (txn.length < 4) return f.txn.focus();
      if (from.replace(/\D/g, "").length < 9) return f.from.focus();
      order.payment = { method: PAY.method, txn, from, sender: f.sender.value.trim(), at: new Date().toISOString() };
      order.status = "Awaiting Confirmation";
      save();
      const url = waLink(waMessage(order.payment));
      const w = window.open(url, "_blank");
      if (w) w.opener = null;
      renderDone(url);
    });
  }

  function renderDone(url) {
    setStep(6);
    renderHead();
    root.innerHTML = `
      <div class="checkout">
        <section class="panel" aria-labelledby="h-done">
          <div class="notice ok" style="margin-bottom:16px"><b>Almost done!</b> WhatsApp should have opened with your order and payment details. Just tap <b>Send</b>.</div>
          <h2 id="h-done">What happens next</h2>
          <ol class="timeline">
            <li><div><b>We verify your payment</b>We match transaction <code class="k">${esc(order.payment.txn)}</code> to order <code class="k">${esc(order.ref)}</code>.</div></li>
            <li><div><b>We confirm on WhatsApp</b>Your status changes to <i>Paid</i> and we confirm your ${d.fulfilment === "Delivery" ? "delivery fee and time" : "pick-up point and time"}.</div></li>
            <li><div><b>Enjoy!</b>Freshly made and ready on ${niceDate(d.date)}, ${esc(d.time.toLowerCase())}.</div></li>
          </ol>
          <div class="step-nav">
            <a class="btn btn-ghost" href="menu.html">Back to menu</a>
            <a class="btn btn-wa" href="${url}" target="_blank" rel="noopener">WhatsApp didn't open? Tap here</a>
          </div>
        </section>
        ${summaryPanel()}
      </div>`;
    $$("#steps li").forEach((li) => { li.classList.add("done"); li.classList.remove("active"); });
  }

  renderHead();
  if (order.status === "Awaiting Confirmation" && order.payment) renderDone(waLink(waMessage(order.payment)));
  else renderPay();
});
