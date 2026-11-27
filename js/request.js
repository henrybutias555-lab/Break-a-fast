/* Custom bake request: anything baked that isn't on the menu */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, waLink } = BAF, C = BAF.config;
  const f = $("#req-form");
  const IDEAS = ["Croissants", "Birthday cake", "Cupcakes", "Doughnuts", "Bread loaves", "Meat pies", "Banana bread", "Muffins", "Cookies", "Brownies", "Chin chin", "Tea bread", "Pizza", "Wedding cake", "Tarts"];
  $("#ideas").innerHTML = IDEAS.map((x) => `<button type="button" class="chip">${esc(x)}</button>`).join("");
  $$("#ideas .chip").forEach((b) => b.addEventListener("click", () => {
    f.what.value = b.textContent; f.what.closest(".field").classList.remove("invalid");
    f.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => f.qty.focus(), 400);
  }));
  const pre = new URLSearchParams(location.search).get("item");
  if (pre) f.what.value = pre.slice(0, 120);

  const notice = (C.orderHours && C.orderHours.minNoticeDays) || 3;
  f.date.min = new Date(Date.now() + notice * 864e5).toISOString().slice(0, 10);
  BAF.dayMonthYear(f.date);
  const addr = () => ($("#r-addr-field").hidden = f.fulfilment.value !== "Delivery");
  $$("input[name=fulfilment]", f).forEach((r) => r.addEventListener("change", addr)); addr();
  $$("input,textarea", f).forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("invalid")));

  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const checks = {
      what: f.what.value.trim().length >= 2,
      qty: f.qty.value.trim().length >= 1,
      date: !!f.date.value && f.date.value >= f.date.min,
      name: f.name.value.trim().length >= 2,
      phone: f.phone.value.replace(/\D/g, "").length >= 9
    };
    let first = null;
    Object.entries(checks).forEach(([k, ok]) => { f[k].closest(".field").classList.toggle("invalid", !ok); if (!ok && !first) first = f[k]; });
    if (first) return BAF.focusField(first);
    const btn = $("button[type=submit]", f), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Sending…";
    $("#req-result").innerHTML = "";
    try {
      const r = await BAF.api("/api/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          what: f.what.value, qty: f.qty.value, budget: f.budget.value, details: f.details.value, date: f.date.value,
          fulfilment: f.fulfilment.value, address: f.address.value, name: f.name.value, phone: f.phone.value
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not send your request.");
      f.hidden = true;
      $("#req-result").innerHTML = `<div class="notice ok"><b>Request ${esc(j.ref)} sent!</b> We've been notified and will reply on WhatsApp with a price and availability.
        <a class="btn btn-wa btn-block" style="margin-top:12px" href="${waLink(j.message)}" target="_blank" rel="noopener">Also send it on WhatsApp (optional)</a>
        <p class="small" style="margin:8px 0 0">Have a picture of what you want? Send it in the WhatsApp chat.</p></div>
        <a class="btn btn-ghost" style="margin-top:12px" href="request.html">Request something else</a>`;
      $("#req-result").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      btn.disabled = false; btn.textContent = label;
      $("#req-result").innerHTML = `<div class="notice warn" style="margin-top:12px"><b>${esc(err.message)}</b> Please check your internet and try again.</div>`;
    }
  });
});
