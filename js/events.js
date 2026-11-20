/* Break-a-Fast: events page (package cards, estimator, enquiry -> WhatsApp) */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, money, waLink, config: C } = window.BAF;
  const G = window.BAF_EVENT_GROUPS;
  const DEP = C.eventDepositPercent / 100;
  const f = $("#event-form");
  f.payment.innerHTML = C.paymentMethods.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
  BAF.wake();
  let group = G[0];

  const allPkgs = G.flatMap((g) => g.packages.map((p) => ({ ...p, group: g })));
  const pkgById = (id) => allPkgs.find((p) => p.id === id);
  const fromPrice = (p) => Math.min(...Object.values(p.prices));

  const MENU = window.BAF_EVENT_MENU, SRC = window.BAF_PICK_SOURCES;
  const optionsFor = (pk) => pk.from || (SRC[pk.cat] || []).flatMap((c) => MENU[c] || []);
  function pkgIncludes(p) {
    if (!p.picks) return p.includes.map((i) => `<li>${esc(i)}</li>`).join("");
    return p.picks.map((pk) => {
      if (pk.fixed) return `<li><b>${esc(pk.cat)}:</b> ${pk.fixed.map(esc).join(" &amp; ")}</li>`;
      if (pk.from) return `<li><b>${esc(pk.cat)}:</b> ${pk.from.map(esc).join(" or ")}</li>`;
      return `<li><b>${pk.n} ${esc(pk.cat)}</b>, chosen from:<div class="small" style="color:var(--ink);margin:2px 0 4px">${optionsFor(pk).map(esc).join(" · ")}</div></li>`;
    }).join("") + `<li><b>Bar set-up</b></li>`;
  }

  /* ---------- tabs + cards ---------- */
  $("#group-tabs").innerHTML = G.map((g) => `<button role="tab" type="button" data-g="${g.id}">${esc(g.name)}</button>`).join("");
  $$("#group-tabs button").forEach((b) => b.addEventListener("click", () => showGroup(b.dataset.g)));

  function showGroup(id, keepPkg) {
    group = G.find((g) => g.id === id) || G[0];
    $$("#group-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.g === group.id));
    $("#group-intro").textContent = group.intro;
    $("#group-notes").innerHTML = group.notes.map((n) => `<li>${esc(n)}</li>`).join("");
    $("#menu-section").hidden = !group.packages.some((p) => p.picks);
    $("#pkg-grid").innerHTML = group.packages.map((p) => `
      <article class="card pkg">
        <div class="head">${p.popular ? `<span class="price-chip" style="float:right">Popular</span>` : ""}<h3>${esc(p.name)}</h3><p>From ${money(fromPrice(p))}</p></div>
        <div class="card-body">
          <ul>${pkgIncludes(p)}</ul>
          <details class="more"><summary>Prices by guest count</summary>
            <table class="price-table"><thead><tr><th>Guests</th><th>Price</th></tr></thead><tbody>
            ${Object.entries(p.prices).map(([g, v]) => `<tr><td>${g}</td><td>${money(v)}</td></tr>`).join("")}
            </tbody></table>
          </details>
          <div class="calc">
            <label class="small" style="font-weight:800">Guests
              <select data-calc="${p.id}" style="margin-left:6px;padding:6px;border-radius:8px;border:1px solid var(--line)">${Object.keys(p.prices).map((g) => `<option>${g}</option>`).join("")}</select>
            </label>
            <div class="big" data-price="${p.id}">${money(fromPrice(p))}</div>
            <div class="small muted" data-dep="${p.id}">40% token: ${money(fromPrice(p) * DEP)}</div>
          </div>
          <button class="btn btn-orange btn-sm" type="button" data-choose="${p.id}">Choose ${esc(p.name)}</button>
        </div>
      </article>`).join("");
    $$("[data-calc]").forEach((s) => s.addEventListener("change", () => {
      const p = pkgById(s.dataset.calc), v = p.prices[s.value];
      $(`[data-price="${p.id}"]`).textContent = money(v);
      $(`[data-dep="${p.id}"]`).textContent = `${C.eventDepositPercent}% token: ${money(v * DEP)}`;
    }));
    $$("[data-choose]").forEach((b) => b.addEventListener("click", () => {
      const p = pkgById(b.dataset.choose);
      f.pkg.value = p.id;
      fillGuests(p, $(`[data-calc="${p.id}"]`).value);
      fillAddons(p.group);
      estimate();
      $("#enquiry").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    if (!keepPkg) {
      f.pkg.value = group.packages[0].id;
      fillGuests(group.packages[0]);
      fillAddons(group);
      estimate();
    }
  }

  /* ---------- form ---------- */
  f.pkg.innerHTML = G.map((g) => `<optgroup label="${esc(g.name)}">${g.packages.map((p) => `<option value="${p.id}">${esc(p.name)} (from ${money(fromPrice(p))})</option>`).join("")}</optgroup>`).join("") +
    `<option value="custom">Custom / bulk order (not sure yet)</option>`;

  function fillGuests(p, sel) {
    if (!p) { f.guests.innerHTML = ["Under 50", "50 to 100", "100 to 200", "200 to 500", "500+"].map((x) => `<option>${x}</option>`).join(""); return; }
    f.guests.innerHTML = Object.keys(p.prices).map((g) => `<option${String(g) === String(sel) ? " selected" : ""}>${g}</option>`).join("");
  }
  function fillPicks() {
    const p = currentPkg(), box = $("#e-picks");
    if (!p || !p.picks) { box.innerHTML = ""; return; }
    box.innerHTML = `<p style="margin:0;font-weight:800;color:var(--brown)">Choose your menu <span class="muted small" style="font-weight:400">(optional: skip any and we'll suggest)</span></p>` +
      p.picks.filter((pk) => pk.n).map((pk) => `
      <fieldset class="field" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin:0" data-pick="${esc(pk.cat)}" data-n="${pk.n}">
        <legend style="font-weight:800;color:var(--brown);padding:0 6px">${esc(pk.cat)}: pick ${pk.n} <span class="muted small" data-count>(0 of ${pk.n})</span></legend>
        <div class="tags">${optionsFor(pk).map((o) => `<label style="cursor:pointer"><input type="checkbox" value="${esc(o)}" style="accent-color:var(--berry)"> ${esc(o)}</label>`).join("")}</div>
      </fieldset>`).join("");
    $$("fieldset[data-pick]", box).forEach((fs) => {
      const n = +fs.dataset.n, boxes = $$("input", fs);
      const upd = () => {
        const k = boxes.filter((b) => b.checked).length;
        $("[data-count]", fs).textContent = `(${k} of ${n})`;
        boxes.forEach((b) => { b.disabled = !b.checked && k >= n; b.parentElement.style.opacity = b.disabled ? 0.45 : 1; });
      };
      boxes.forEach((b) => b.addEventListener("change", upd));
    });
  }
  const chosenPicks = () => $$("#e-picks fieldset[data-pick]").map((fs) => [fs.dataset.pick, $$("input:checked", fs).map((b) => b.value)]);

  function fillAddons(g) {
    setTimeout(fillPicks);
    $("#e-addons").innerHTML = g
      ? g.addons.map((a) => `<label class="check" style="font-weight:700"><input type="checkbox" name="addon" value="${a.id}"> <span>${esc(a.name)} <span class="muted">+${money(a.price)}</span></span></label>`).join("")
      : `<p class="small muted" style="margin:0">Tell us what you need in the message.</p>`;
  }
  const currentPkg = () => pkgById(f.pkg.value);
  const chosenAddons = () => {
    const p = currentPkg();
    if (!p) return [];
    const ids = $$("input[name=addon]:checked", f).map((i) => i.value);
    return p.group.addons.filter((a) => ids.includes(a.id));
  };

  function calc() {
    const p = currentPkg();
    if (!p) return null;
    const base = p.prices[f.guests.value];
    const extras = chosenAddons().reduce((s, a) => s + a.price, 0);
    const total = base + extras;
    return { p, base, extras, total, deposit: Math.round(total * DEP * 100) / 100 };
  }
  function estimate() {
    const e = calc();
    $("#estimate").innerHTML = e
      ? `<div class="sum-row"><span>${esc(e.p.name)}, ${esc(f.guests.value)} guests</span><b>${money(e.base)}</b></div>
         ${chosenAddons().map((a) => `<div class="sum-row small"><span>+ ${esc(a.name)}</span><span>${money(a.price)}</span></div>`).join("")}
         <div class="sum-row sum-total"><span>Estimated total</span><span>${money(e.total)}</span></div>
         <div class="sum-row"><span>${C.eventDepositPercent}% token to book</span><b>${money(e.deposit)}</b></div>
         ${e.p.group.id === "breakfast" ? `<p class="small muted" style="margin:6px 0 0">+ transport, quoted for your location.</p>` : `<p class="small muted" style="margin:6px 0 0">Transport quoted separately for your location.</p>`}`
      : `<p style="margin:0" class="muted">We'll prepare a custom quote for you.</p>`;
  }
  f.pkg.addEventListener("change", () => {
    const p = currentPkg();
    fillGuests(p);
    fillAddons(p ? p.group : null);
    if (p && p.group !== group) showGroup(p.group.id, true);
    estimate();
  });
  f.addEventListener("change", (e) => { if (e.target !== f.pkg) estimate(); });

  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  f.date.min = d.toISOString().slice(0, 10);
  $$("input", f).forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("invalid")));

  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const checks = {
      name: f.name.value.trim().length >= 2,
      phone: f.phone.value.replace(/\D/g, "").length >= 9,
      date: !!f.date.value && f.date.value >= f.date.min
    };
    let first = null;
    Object.entries(checks).forEach(([k, ok]) => { f[k].closest(".field").classList.toggle("invalid", !ok); if (!ok && !first) first = f[k]; });
    if (first) return first.focus();

    const btn = $("button[type=submit]", f), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing your enquiry…";
    $("#ev-result")?.remove();
    try {
      const r = await BAF.api("/api/event", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pkg: f.pkg.value, guests: f.guests.value, addons: chosenAddons().map((a) => a.id), picks: chosenPicks(),
          type: f.type.value, name: f.name.value, phone: f.phone.value, date: f.date.value,
          venue: f.venue.value, message: f.message.value, payment: f.payment.value
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not prepare your enquiry.");
      btn.insertAdjacentHTML("afterend", `<div id="ev-result" class="notice ok"><b>Enquiry ${esc(j.enquiry.ref)} is ready.</b> Tap below to send it to us on WhatsApp.<a class="btn btn-wa btn-block" style="margin-top:10px" href="${waLink(j.message)}" target="_blank" rel="noopener">Open WhatsApp &amp; send</a></div>`);
      $("#ev-result").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      btn.insertAdjacentHTML("afterend", `<div id="ev-result" class="notice warn"><b>${esc(err.message)}</b> Please check your internet and try again.</div>`);
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });

  /* ---------- event menu (exact names from the menu document) ---------- */
  $("#event-menu").innerHTML = Object.entries(MENU)
    .map(([k, v]) => `<div class="panel"><h3>${esc(k)}</h3><div class="tags">${v.map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>`).join("");
  $("#dessert-note").textContent = window.BAF_DESSERT_NOTE || "";

  showGroup(new URLSearchParams(location.search).get("group") || G[0].id);
});
