/* =========================================================
   EVENT & CATERING PACKAGES — edit prices here (GH₵).
   "prices" maps number of guests -> total package price.
   ========================================================= */
window.BAF_EVENT_GROUPS = [
  {
    id: "party",
    name: "Party & Event Packages",
    intro: "Local snacks, finger foods, local drinks and a full bar set-up. Ideal for birthdays, weddings, church programmes and corporate events.",
    packages: [
      {
        id: "pkg1",
        name: "Package 1",
        summary: "5 local snacks, 2 finger foods (spring rolls & kelewele), 7 drinks, bar set-up.",
        includes: ["5 local snacks", "2 finger foods: spring rolls & kelewele", "7 drinks", "Bar set-up"],
        picks: [
          { cat: "Local Snacks", n: 5 },
          { cat: "Finger Foods", fixed: ["Spring Rolls", "Kelewele"] },
          { cat: "Drinks", n: 7 }
        ],
        prices: { 50: 5300, 100: 6000, 150: 7300, 200: 8300, 250: 9300, 300: 10300, 350: 11300, 400: 12300, 450: 13300, 500: 13600 }
      },
      {
        id: "pkg2",
        name: "Package 2",
        summary: "5 local snacks, 4 finger foods, 8 drinks, bar set-up and dessert.",
        includes: ["5 local snacks", "4 finger foods", "8 drinks", "Bar set-up", "Dessert: creamy mashed kenkey in customised cups"],
        picks: [
          { cat: "Local Snacks", n: 5 },
          { cat: "Finger Foods", n: 4 },
          { cat: "Drinks", n: 8 },
          { cat: "Dessert", fixed: ["Creamy Mashed Kenkey (in customised cups)"] }
        ],
        prices: { 50: 8000, 100: 10000, 150: 12000, 200: 14000, 250: 16500, 300: 18500, 350: 20000, 400: 23000, 450: 25000, 500: 27000 },
        popular: true
      },
      {
        id: "pkg3",
        name: "Package 3",
        summary: "6 local snacks, 5 finger foods, 10 drinks, bar set-up and dessert.",
        includes: ["6 local snacks", "5 finger foods", "10 drinks", "Bar set-up", "Dessert: mini banana cake or tigernut pudding"],
        picks: [
          { cat: "Local Snacks", n: 6 },
          { cat: "Finger Foods", n: 5 },
          { cat: "Drinks", n: 10 },
          { cat: "Dessert", n: 1, from: ["Mini Banana Cake", "Tigernut Pudding"] }
        ],
        prices: { 50: 8500, 100: 10000, 150: 12500, 200: 14500, 250: 17500, 300: 20000, 350: 23000, 400: 25000, 450: 27000, 500: 29000 }
      }
    ],
    addons: [
      { id: "truss", name: "Truss", price: 1400 },
      { id: "lighting", name: "Lighting", price: 800 },
      { id: "floral", name: "Floral works", price: 1500 },
      { id: "backdrop", name: "Backdrop", price: 1700 }
    ],
    notes: ["Prices may change after 3 months or more due to changes in product prices. Pay in full upfront to lock in your price."]
  },
  {
    id: "breakfast",
    name: "Breakfast Event Packages",
    intro: "Elegant breakfast spreads for meetings, bridal showers, brunches and morning celebrations. All packages include a food set-up station.",
    packages: [
      {
        id: "luxury",
        name: "Luxury Dine",
        summary: "Tea, sandwiches, egg delicacy, potato delight, artisan loaves, French pastry and more.",
        includes: ["Selection of tea", "Sandwiches", "Tropical fruits", "Egg delicacy", "Potato delight", "Morning protein", "Local fruits", "Artisan loaves", "French pastry", "Golden crumble delight", "Seasonal juice atelier"],
        prices: { 20: 8000, 30: 9500, 40: 11300, 50: 14600, 100: 25000 }
      },
      {
        id: "lavish",
        name: "Lavish Feast",
        summary: "Everything for a grand morning, from egg delicacies to a tropical twist mocktail.",
        includes: ["Selection of tea", "Egg delicacies", "French pastries", "Golden crumble delights", "Traditional toppings", "Fruit atelier", "Tropical twist mocktail", "Local & tropical fruits", "Sandwiches", "Morning proteins", "Potato dish", "Selection of salad"],
        prices: { 20: 8700, 30: 10000, 40: 12000, 50: 15300, 100: 27000 },
        popular: true
      }
    ],
    addons: [
      { id: "bar", name: "Mocktail / cocktail / drink bar stand", price: 1500 },
      { id: "backdrop", name: "Backdrop", price: 1500 }
    ],
    notes: [
      "Transportation cost is not included. It is quoted once you share the event location.",
      "All packages include a food set-up station.",
      "Prices may change 2 to 3 months after an invoice is issued without payment. Pay in full upfront to lock in your price."
    ]
  }
];

/* Menu for event packages: names exactly as in the Break-a-Fast menu document.
   "Drinks" in a package are chosen from Local Drinks and Fresh Juices. */
window.BAF_EVENT_MENU = {
  "Local Drinks": ["Coconut Milk Drink", "Sobolo", "Palm Wine", "Asana", "Pito", "Zomkom", "Lamugine", "Brukina"],
  "Fresh Juices": ["Pineapple Juice", "Watermelon Juice", "Pineapple and Coconut Juice", "Mango Juice", "Pineapple and Ginger Juice", "Beetroot and Apple Juice"],
  "Local Snacks": ["Atsormor", "Plantain Chips", "Poloo", "Condensed Milk Toffee", "Kulikuli", "Tigernut", "Nkate Cake", "Egg with Pepper (Kosua ne Mako)", "Coated Groundnut", "Baked Chips", "Bankye Kaklo", "Aburo ne Nkate"],
  "Finger Foods": ["Spring Rolls", "Meat Pie", "Ring Doughnuts", "Sausage Kebab", "Pork", "Gizzard Kebab", "Beef Skewers", "Kelewele", "Spicy Chicken Wings", "Quiche Lorraine"],
  "Desserts": ["Tigernut Pudding", "Mini Banana Cake", "Mashed Kenkey"]
};
/* Which menu lists each package "pick" draws from */
window.BAF_PICK_SOURCES = {
  "Local Snacks": ["Local Snacks"],
  "Finger Foods": ["Finger Foods"],
  "Drinks": ["Local Drinks", "Fresh Juices"],
  "Dessert": ["Desserts"]
};
window.BAF_DESSERT_NOTE = "Desserts can also be ordered separately: GH₵10 each.";
