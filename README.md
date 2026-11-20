# Break-a-Fast Bistro and Bar website

Mobile-first static website: menu, cart, checkout, Telecel Cash payment, events & catering, about, contact.
No build step. Open `index.html` or host the folder on any static host (GitHub Pages, Netlify, etc.).

## Order process (Telecel Cash)
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
