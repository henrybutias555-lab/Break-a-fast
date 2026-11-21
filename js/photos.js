/* =========================================================
   MENU PHOTOS — item name (exactly as in events-data.js) -> image path.
   Items without a photo show a placeholder tile.
   BAF_PHOTO_CREDITS lists the source and licence of every
   photo that is not Break-a-Fast's own (shown on credits.html).
   ========================================================= */
window.BAF_MENU_PHOTOS = {
  "Spring Rolls": "assets/img/menu/spring-rolls.jpg?v=24d0fd2a",
  "Coconut Milk Drink": "assets/img/menu/coconut-milk-drink.jpg?v=1190b4d9",
  "Sobolo": "assets/img/menu/sobolo.jpg?v=3140ce60",
  "Palm Wine": "assets/img/menu/palm-wine.jpg?v=c461bb1c",
  "Asana": "assets/img/menu/asana.jpg?v=6d1e50a1",
  "Pito": "assets/img/menu/pito.jpg?v=3c9ed663",
  "Zomkom": "assets/img/menu/zomkom.jpg?v=1c1b082e",
  "Lamugine": "assets/img/menu/lamugine.jpg?v=6e0dfaf4",
  "Brukina": "assets/img/menu/brukina.jpg?v=413bb399",
  "Sausages & Eggs": "assets/img/menu/sausages-eggs.jpg?v=43e25fb3",
  "Watermelon Juice": "assets/img/menu/watermelon-juice.jpg?v=4665e54b",
  "Pineapple and Ginger Juice": "assets/img/menu/pineapple-and-ginger-juice.jpg?v=b93c85f7",
  "Beetroot and Apple Juice": "assets/img/menu/beetroot-and-apple-juice.jpg?v=d4399521",
  "Pineapple Juice": "assets/img/menu/pineapple-juice.jpg?v=8c4c21dd",
  "Mango Juice": "assets/img/menu/mango-juice.jpg?v=e5360b69",
  "Pineapple and Coconut Juice": "assets/img/menu/pineapple-and-coconut-juice.jpg?v=49a3cf84",
  "Plantain Chips": "assets/img/menu/plantain-chips.jpg?v=aa6286da",
  "Baked Chips": "assets/img/menu/baked-chips.jpg?v=b2ab006b",
  "Nkate Cake": "assets/img/menu/nkate-cake.jpg?v=5410f871",
  "Condensed Milk Toffee": "assets/img/menu/condensed-milk-toffee.jpg?v=bcb31fe5",
  "Tigernut": "assets/img/menu/tigernut.jpg?v=743d23e0",
  "Egg with Pepper (Kosua ne Mako)": "assets/img/menu/egg-with-pepper-kosua-ne-mako.jpg?v=369f2ca4",
  "Coated Groundnut": "assets/img/menu/coated-groundnut.jpg?v=9b792fd0",
  "Poloo": "assets/img/menu/poloo.jpg?v=92093703",
  "Kulikuli": "assets/img/menu/kulikuli.jpg?v=9db34346",
  "Bankye Kaklo": "assets/img/menu/bankye-kaklo.jpg?v=4f959a32",
  "Aburo ne Nkate": "assets/img/menu/aburo-ne-nkate.jpg?v=72cb5e7d",
  "Meat Pie": "assets/img/menu/meat-pie.jpg?v=f79f7542",
  "Ring Doughnuts": "assets/img/menu/ring-doughnuts.jpg?v=ce47722d",
  "Sausage Kebab": "assets/img/menu/sausage-kebab.jpg?v=6199f1f6",
  "Pork": "assets/img/menu/pork.jpg?v=3b757be0",
  "Gizzard Kebab": "assets/img/menu/gizzard-kebab.jpg?v=e07aee86",
  "Atsormor": "assets/img/menu/atsormor.jpg?v=732112d6",
  "Quiche Lorraine": "assets/img/menu/quiche-lorraine.jpg?v=0512d2b3",
  "Tigernut Pudding": "assets/img/menu/tigernut-pudding.jpg?v=9f61e850",
  "Mini Banana Cake": "assets/img/menu/mini-banana-cake.jpg?v=0673175a",
  "Spicy Chicken Wings": "assets/img/menu/spicy-chicken-wings.jpg?v=cb4173a5",
  "Beef Skewers": "assets/img/menu/beef-skewers.jpg?v=2b44e7e9",
  "Mashed Kenkey": "assets/img/menu/mashed-kenkey.jpg?v=01a7e427",
  "Kelewele": "assets/img/menu/kelewele.jpg?v=4a72fdc9",
  "Toast & Eggs": "assets/img/menu/toast-eggs.jpg?v=a8337d2c"
};
/* Same photo used for matching items on the Menu page */
Object.assign(window.BAF_MENU_PHOTOS, {
  "Doughnuts": window.BAF_MENU_PHOTOS["Ring Doughnuts"],
  "Meat Pies": window.BAF_MENU_PHOTOS["Meat Pie"],
  "Chicken Wings": window.BAF_MENU_PHOTOS["Spicy Chicken Wings"],
  "Dessert Cups": window.BAF_MENU_PHOTOS["Tigernut Pudding"],
  "Beverages": window.BAF_MENU_PHOTOS["Sobolo"]
});
window.BAF_PHOTO_CREDITS = [];
