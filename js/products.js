/* =========================================================
   MENU & PRICES — edit this file to change products.
   - price values are in Ghana cedis (GH₵), numbers only
   - "options" are the package sizes a customer can choose
   - "flavours" (optional) lets the customer pick a flavour
   ========================================================= */
window.BAF_CATEGORIES = [
  { id: "cinnamon", name: "Cinnamon Rolls", blurb: "Soft, gooey & made to crave. Our signature." },
  { id: "spring", name: "Frozen Spring Rolls", blurb: "Fry from frozen. Great for home, office lunches and parties." },
  { id: "meals", name: "Breakfast & Lunch Packs", blurb: "Generous ready-to-enjoy spreads, from breakfast to lunch." }
];

window.BAF_PRODUCTS = [
  {
    id: "specialty-rolls",
    category: "cinnamon",
    name: "Specialty Cinnamon Rolls",
    short: "Handcrafted rolls finished with Strawberry, Oreo, Biscoff or Blueberry toppings.",
    description:
      "Our best-loved rolls, baked fresh and loaded with your favourite topping: juicy strawberry glaze, crushed Oreo and cream, Biscoff spread with cookie crumb, or rich blueberry compote. Perfect for sharing, gifting and celebrations.",
    image: "assets/img/menu/roll-biscoff-new.jpg?v=1a4635e6",
    gallery: [
      "assets/img/roll-strawberry.jpg?v=d638dc77",
      "assets/img/roll-oreo.jpg?v=8d7a02ac",
      "assets/img/menu/roll-biscoff-new.jpg?v=1a4635e6",
      "assets/img/roll-blueberry.jpg?v=a210d7b8"
    ],
    flavours: ["Strawberry", "Oreo", "Biscoff", "Blueberry"],
    options: [
      { label: "6 pieces", price: 200 },
      { label: "12 pieces", price: 400 }
    ],
    badge: "Signature",
    featured: true
  },
  {
    id: "classic-rolls",
    category: "cinnamon",
    name: "Classic Cinnamon Rolls",
    short: "The timeless favourite. Warm, soft and perfectly cinnamon-y, with smooth icing.",
    description:
      "Traditional cinnamon rolls with a buttery swirl and smooth vanilla icing. Simple, comforting and great with tea or coffee.",
    image: "assets/img/menu/roll-classic-new.jpg?v=2328c818",
    options: [
      { label: "6 pieces", price: 150 },
      { label: "12 pieces", price: 250 }
    ],
    featured: true
  },
  {
    id: "spring-veg",
    category: "spring",
    name: "Vegetable Spring Rolls (Frozen)",
    short: "Crisp, golden spring rolls packed with seasoned vegetables.",
    description:
      "Frozen and ready to fry or bake (photo shows them cooked). Ideal for home snacks, office lunches, family gatherings and events. Keep frozen until ready to cook.",
    image: "assets/img/menu/spring-rolls.jpg?v=24d0fd2a",
    options: [{ label: "10 pieces", price: 40 }]
  },
  {
    id: "spring-meat",
    category: "spring",
    name: "Vegetable & Meat Spring Rolls (Frozen)",
    short: "Vegetables with minced meat or chicken. Your choice.",
    description:
      "Our hearty spring rolls with vegetables and your choice of minced meat or chicken. Frozen and ready to fry or bake.",
    image: "assets/img/menu/spring-roll-meat.jpg?v=74312cc0",
    flavours: ["Minced Meat", "Chicken"],
    flavourLabel: "Filling",
    options: [{ label: "10 pieces", price: 50 }],
    featured: true
  },
  {
    id: "breakfast-pack",
    category: "meals",
    name: "Breakfast Pack",
    short: "Sandwich, French toast, sausages, scrambled eggs, spring rolls, fruit & drinks.",
    description:
      "Includes: sandwich, French toast, toasted bread, sausages, scrambled eggs, spring rolls, fresh fruits, juice, milk, a collection of tea and water.",
    image: "assets/img/menu/toast-eggs.jpg?v=a8337d2c",
    gallery: ["assets/img/menu/toast-eggs.jpg?v=a8337d2c", "assets/img/meal-breakfast.jpg?v=77ef18a8"],
    options: [{ label: "1 pack", price: 400 }]
  },
  {
    id: "lunch-1",
    category: "meals",
    name: "Lunch Pack: Option 1",
    short: "Jollof, chicken drumsticks, spaghetti, salad, ice cream, fruit & drinks.",
    description:
      "Includes: jollof, chicken drumsticks, spaghetti, salad, ice cream, fruit, juice, fruit drink and water.",
    image: "assets/img/menu/jollof-chicken.jpg?v=4629cf56",
    gallery: ["assets/img/menu/jollof-chicken.jpg?v=4629cf56", "assets/img/meal-lunch1.jpg?v=e1d7af3a"],
    options: [{ label: "1 pack", price: 400 }]
  },
  {
    id: "lunch-2",
    category: "meals",
    name: "Lunch Pack: Option 2",
    short: "Fried rice and jollof, drumsticks, beef sauce, spaghetti, salad, ice cream & drinks.",
    description:
      "Includes: fried rice, jollof rice, chicken drumsticks, beef sauce, spaghetti, salad, fruits, ice cream, natural juice, fruit drink and water.",
    image: "assets/img/meal-lunch2.jpg?v=ebb104e9",
    options: [{ label: "1 pack", price: 550 }]
  }
];

/* More from our kitchen (prices confirmed on WhatsApp) */
window.BAF_MORE_MENU = ["Doughnuts", "Meat Pies", "Sausage Rolls", "Mini Pizza", "Frozen Samosas", "Chicken Wings", "Dessert Cups", "Cheesecakes", "Cookies", "Beverages"];

/* Breakfast items available on request (price confirmed on WhatsApp) */
window.BAF_BREAKFAST_MENU = {
  local: ["Tea & Bread", "Coffee & Pastries", "Waakye", "Hausa Koko", "Rice Water", "Porridge", "Local Breakfast Combos"],
  continental: ["Toast & Eggs", "Pancakes", "Sausages & Eggs", "Breakfast Sandwiches", "Coffee Specials"]
};
