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

  // ---- PAYMENT (current: Telecel Cash only) ----
  payment: {
    method: "Telecel Cash",
    number: "0201745770",
    // Name the customer will see on their phone before entering their PIN.
    // Update this to the exact registered name on the Telecel Cash wallet.
    accountName: "Break-a-Fast Bistro and Bar",
    ussd: "*110#"
  },

  // Events & catering bookings
  eventDepositPercent: 40,

  // Prefix for order reference numbers, e.g. BAF-24K7Q
  orderPrefix: "BAF"
};
