# Break-a-Fast Bistro and Bar website

Mobile-first static website: menu, cart, checkout, Telecel Cash payment, events & catering, about, contact.
No build step. Open `index.html` or host the folder on any static host (GitHub Pages, Netlify, etc.).

## Order process
1. **Cart**: customer picks flavours, package size and quantity.
2. **Details**: name, phone, delivery or pick-up, date and time.
3. **Review**: customer confirms, then places the order and gets a reference (e.g. `BAF-7K2QX`).
4. **Pay**: only now are the Telecel Cash number, the exact amount and the reference shown, with USSD steps.
5. **Confirm**: customer enters the Transaction ID from their SMS. The full order and payment details open in WhatsApp to 0201745770 for the owner to verify.

Event bookings: enquiry, then confirmation and invoice, then a 40% token by Telecel Cash using the booking reference (`EVT-…`), then the balance 14 working days before the event.

## Updating content (no coding needed)
- `js/config.js`: phone numbers, Telecel number, **account name shown to payers**, deposit %.
- `js/products.js`: menu items, flavours, package sizes and prices.
- `js/events-data.js`: event and breakfast packages, prices by guest count, extras, event menu.
- `assets/img/`: product photos.

## Known limits (v1)
- Orders are sent to the owner via WhatsApp. There is no server or database yet. A payment gateway (Paystack/Hubtel) can be added later.
- Delivery fees are agreed on WhatsApp.

## Deploying on Render
`render.yaml` is a Render Blueprint. In Render: **New → Blueprint**, connect this GitHub repo and pick the branch. The site will be at `https://break-a-fast.onrender.com` (if that name is free). To use your own domain, go to **Settings → Custom Domains** and add the DNS records Render shows at your domain registrar.

## Tamper-proof orders (order server)
`api/server.js` is a small Node service (no dependencies). For every order and event enquiry it:
1. Re-prices everything from `js/products.js` / `js/events-data.js`, so the customer's browser can't change prices.
2. Creates the reference (`BAF-…` / `EVT-…`) and seals the details with an HMAC signature (`SIGNING_SECRET`).
3. Adds a **Verify link** to the WhatsApp message. Opening it shows **GENUINE** with the real details, or **NOT VALID** if anything was changed.

**For the person receiving orders:** always open the Verify link, and trust it over the message text. Then check your own MoMo or bank SMS for the amount and reference before starting the order.

Run locally: `SIGNING_SECRET=<32+ chars> ALLOWED_ORIGINS=http://localhost:8765 node api/server.js`

## Order server hosting (Cloudflare Workers)
The live order server runs on Cloudflare Workers (`orders.break-a-fast.workers.dev`), which never sleeps. The Render service `break-a-fast-api.onrender.com` runs the same code as a backup, and older Verify links still point to it.

Menu and price data is built into the Worker. **After changing `js/products.js`, `js/events-data.js` or `js/config.js`, redeploy the Worker:**
```
node api/build-worker.js
python3 api/deploy_cloudflare.py orders   # needs a Cloudflare token (Workers Scripts: Edit) and a Render API key
```
The deploy script copies `SIGNING_SECRET` and `ALERT_KEY`/`ALERT_URL` from the Render service, so links work on both.
