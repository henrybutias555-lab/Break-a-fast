/* =========================================================
   BUSINESS SETTINGS — edit this file to change contact
   details and payment information. No coding knowledge needed:
   only change the text between the quotes.
   ========================================================= */
window.BAF_CONFIG = {
  businessName: "Break-a-Fast Bistro and Bar",
  tagline: "Traditional Flavour. Modern Spirit.",

  // Main phone / WhatsApp line (orders are sent here on WhatsApp)
  phone: "0201745770",
  whatsappIntl: "233201745770", // same number in international format, no "+" or leading 0
  altPhone: "0534068801",
  instagram: "bistro_bar16",
  snapchat: "ama.serwaa16",

  // ---- PAYMENT METHODS ----
  // Customers choose one of these at checkout and on the events form.
  // "accountName" is the name the payer sees before confirming. Keep it exact.
  paymentMethods: [
    {
      id: "telecel",
      name: "Telecel Cash",
      kind: "momo",
      number: "0201745770",
      accountName: "Break-a-Fast Bistro and Bar",
      ussd: "*110#",
      color: "#e30613"
    },
    {
      id: "mtn",
      name: "MTN MoMo",
      kind: "momo",
      number: "0534068801",
      accountName: "Marvelyn Boakye Yiadom",
      ussd: "*170#",
      color: "#ffcb05",
      textColor: "#1a1a1a"
    },
    {
      id: "bank",
      name: "Bank transfer",
      kind: "bank",
      bank: "FirstBank Ghana",
      number: "0133070116336",
      accountName: "Marvelyn Boakye Yiadom",
      color: "#0b4f8a"
    }
  ],

  // Order server (seals orders so WhatsApp messages can be verified)
  apiBase: (typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    ? "http://localhost:8787"
    : "https://break-a-fast-api.henrybutias555.workers.dev",

  // Events & catering bookings
  eventDepositPercent: 40,

  // Prefix for order reference numbers, e.g. BAF-24K7Q
  orderPrefix: "BAF"
};
