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
    image: "assets/img/menu/roll-biscoff-new.jpg",
    gallery: [
      "assets/img/roll-strawberry.jpg",
      "assets/img/roll-oreo.jpg",
      "assets/img/menu/roll-biscoff-new.jpg",
      "assets/img/roll-blueberry.jpg"
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
    image: "assets/img/menu/roll-classic-new.jpg",
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
    image: "assets/img/menu/spring-rolls.jpg",
    options: [{ label: "10 pieces", price: 40 }]
  },
  {
    id: "spring-meat",
    category: "spring",
    name: "Vegetable & Meat Spring Rolls (Frozen)",
    short: "Vegetables with minced meat or chicken. Your choice.",
    description:
      "Our hearty spring rolls with vegetables and your choice of minced meat or chicken. Frozen and ready to fry or bake.",
    image: "assets/img/menu/spring-roll-meat.jpg",
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
    image: "assets/img/meal-breakfast.jpg",
    options: [{ label: "1 pack", price: 400 }]
  },
  {
    id: "lunch-1",
    category: "meals",
    name: "Lunch Pack: Option 1",
    short: "Jollof, chicken drumsticks, spaghetti, salad, ice cream, fruit & drinks.",
    description:
      "Includes: jollof, chicken drumsticks, spaghetti, salad, ice cream, fruit, juice, fruit drink and water.",
    image: "assets/img/menu/jollof-chicken.jpg",
    gallery: ["assets/img/menu/jollof-chicken.jpg", "assets/img/meal-lunch1.jpg"],
    options: [{ label: "1 pack", price: 400 }]
  },
  {
    id: "lunch-2",
    category: "meals",
    name: "Lunch Pack: Option 2",
    short: "Fried rice and jollof, drumsticks, beef sauce, spaghetti, salad, ice cream & drinks.",
    description:
      "Includes: fried rice, jollof rice, chicken drumsticks, beef sauce, spaghetti, salad, fruits, ice cream, natural juice, fruit drink and water.",
    image: "assets/img/meal-lunch2.jpg",
    options: [{ label: "1 pack", price: 550 }]
  }
];

/* Breakfast items available on request (price confirmed on WhatsApp) */
window.BAF_BREAKFAST_MENU = {
  local: ["Tea & Bread", "Coffee & Pastries", "Waakye", "Hausa Koko", "Rice Water", "Porridge", "Local Breakfast Combos"],
  continental: ["Toast & Eggs", "Pancakes", "Sausages & Eggs", "Breakfast Sandwiches", "Coffee Specials"]
};
