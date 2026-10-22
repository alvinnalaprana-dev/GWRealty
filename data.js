/* Demo data: rooms and the Villa Madya 1 item list (from GW Realty's paper inventory). */
window.GW_ROOMS = [
  { id: 'bed1',    en: 'Bedroom 1',          id_: 'Kamar 1' },
  { id: 'bed2',    en: 'Bedroom 2',          id_: 'Kamar 2' },
  { id: 'bed3',    en: 'Bedroom 3',          id_: 'Kamar 3' },
  { id: 'living',  en: 'Living room',        id_: 'Ruang tamu' },
  { id: 'kitchen', en: 'Kitchen & dining',   id_: 'Dapur & ruang makan' }
];

/* [item name, quantity] per room */
window.GW_CATALOG = {
  bed1: [
    ['Bed frame', 1], ['Mattress', 1], ['Mattress protector', 1], ['White bed sheet', 1],
    ['White duvet', 1], ['Bed runner', 1], ['Pillows with cover', 4], ['Small pillows with cover', 2],
    ['Bedside table', 2], ['Reading lamp', 2], ['Blinds', 2], ['Glass table', 1],
    ['LG TV with remote', 1], ['Grey curtains', 2], ['Soap box', 3], ['Soap bottle', 1],
    ['Drinking glass', 1], ['Rattan mat', 1], ['Trash bin', 1], ['Towels', 2], ['Bath mat', 1]
  ],
  bed2: [
    ['Bed frame', 1], ['Mattress', 1], ['Mattress protector', 1], ['White bed sheet', 1],
    ['White duvet', 1], ['Bed runner', 1], ['Pillows with cover', 4], ['Small pillows with cover', 2],
    ['Bedside table', 2], ['Reading lamp', 2], ['Painting (Balinese dancer)', 1], ['Ashtray', 1],
    ['Blind', 1], ['Grey curtains', 2], ['Wardrobe', 1], ['Glass table', 1], ['Rattan mat', 1],
    ['Drinking glass', 1], ['Soap box', 3], ['White towels', 2], ['Bath mat', 1], ['Trash bin', 1]
  ],
  bed3: [
    ['Bed frame', 1], ['Mattress', 1], ['Mattress protector', 1], ['White bed sheet', 1],
    ['White duvet', 1], ['Bed runner', 1], ['Pillows with cover', 4], ['Small pillows with cover', 2],
    ['Bedside table', 2], ['Reading lamp', 2], ['Blinds', 2], ['Ashtray', 1], ['Wardrobe', 1],
    ['Glass table', 1], ['Wooden decoration', 2], ['Grey curtains', 2], ['Soap box', 3],
    ['White towels', 2], ['Bath mat', 1], ['Trash bin', 1], ['Soap bottle', 1], ['Drinking glass', 1], ['Rattan mat', 1]
  ],
  living: [
    ['Sofa set (1 long + 2 single)', 1], ['Sofa cushions with cover', 5], ['Coffee table', 2],
    ['Rattan carpet', 1], ['Ashtray', 1], ['Tissue box', 1], ['Door mat', 2], ['Pool towels', 3],
    ['Painting', 1], ['Standing fan', 1]
  ],
  kitchen: [
    ['Dining table', 1], ['Dining chairs', 6], ['Flower vase', 1], ['Water dispenser', 1],
    ['Trash bin', 1], ['Microwave', 1], ['Electric kettle', 1], ['Gas tank 3 kg', 1], ['Refrigerator', 1],
    ['Frying pan', 2], ['Pot', 1], ['Cutting board', 1], ['Plastic bowl', 1], ['Black spatula', 5],
    ['Wine opener', 1], ['Scissors', 1], ['Kitchen knife', 1], ['Measuring cup', 1], ['Jars', 3],
    ['Oven gloves', 2], ['Forks', 5], ['Table knives', 5], ['Teaspoons', 6], ['Dinner plates', 6],
    ['Bowls', 6], ['Side plates', 6], ['Fruit plate', 1], ['Large bowl', 1], ['Mugs', 6],
    ['Wine glasses', 6], ['Tall glasses', 4], ['Black glasses', 5], ['Teapots', 2], ['Placemats', 6], ['Coasters', 6]
  ]
};

/* Small items that AI counts less reliably: flagged for the manager to check */
window.GW_SMALL = ['Forks', 'Table knives', 'Teaspoons', 'Wine glasses', 'Tall glasses', 'Black glasses',
  'Black spatula', 'Coasters', 'Placemats', 'Soap box', 'Jars', 'Mugs', 'Bowls', 'Side plates', 'Dinner plates'];

/* Items AI typically cannot see in photos (hidden under other things) */
window.GW_HIDDEN = ['Mattress protector'];

/* Demo: keep 10 items per room so the demo is quick to walk through.
   The full Villa Madya 1 list stays above for reference. */
(function () {
  const KEEP = {
    bed1: ['Bed frame', 'Mattress', 'White bed sheet', 'White duvet', 'Bed runner', 'Pillows with cover', 'Bedside table', 'Reading lamp', 'LG TV with remote', 'Towels'],
    bed2: ['Bed frame', 'Mattress', 'White duvet', 'Pillows with cover', 'Bedside table', 'Reading lamp', 'Painting (Balinese dancer)', 'Wardrobe', 'Grey curtains', 'White towels'],
    bed3: ['Bed frame', 'Mattress', 'White duvet', 'Pillows with cover', 'Bedside table', 'Reading lamp', 'Wardrobe', 'Wooden decoration', 'Grey curtains', 'White towels'],
    living: ['Sofa set (1 long + 2 single)', 'Sofa cushions with cover', 'Coffee table', 'Rattan carpet', 'Ashtray', 'Tissue box', 'Door mat', 'Pool towels', 'Painting', 'Standing fan'],
    kitchen: ['Dining table', 'Dining chairs', 'Refrigerator', 'Microwave', 'Electric kettle', 'Gas tank 3 kg', 'Frying pan', 'Dinner plates', 'Wine glasses', 'Mugs']
  };
  window.GW_CATALOG_FULL = window.GW_CATALOG;
  const out = {};
  Object.keys(window.GW_CATALOG).forEach(room => { out[room] = window.GW_CATALOG[room].filter(([n]) => KEEP[room].includes(n)); });
  window.GW_CATALOG = out;
})();

/* Real villas for the live system, from GW Realty's own inventory documents (Blu, Zala, Karisma).
   Each room carries its amenity list (cat), which the AI uses as the expected items for that room. */
window.GW_REAL_VILLAS = [{"id": "blu", "name": "Villa Blu", "area": "", "hideRooms": ["bed1", "bed2", "bed3", "living", "kitchen"], "rooms": [{"id": "blu-1", "en": "Bedroom 1", "id_": "Kamar 1", "cat": [["White Console", 1], ["Wooden Bedside table", 2], ["Curtain", 2], ["AC", 1], ["White wooden display rack", 1], ["Safety Box", 1]]}, {"id": "blu-2", "en": "Bedroom 2", "id_": "Kamar 2", "cat": [["Polished Cement Wardrobe", 1], ["TV", 1], ["AC", 1], ["Curtain", 1]]}, {"id": "blu-3", "en": "Bedroom 3", "id_": "Kamar 3", "cat": [["White Cabinet", 1], ["White Cupboard", 1], ["Curtain", 2], ["Single Bed + Mattress", 1], ["Stepped Display Rack", 1], ["AC", 1], ["Ceiling Fan", 1]]}, {"id": "blu-4", "en": "Bedroom 4", "id_": "Kamar 4", "cat": [["Bedside Table", 2], ["Curtain", 2], ["AC", 1], ["Laundry Basket", 1], ["White Blinds", 1]]}, {"id": "blu-5", "en": "Living Room + Kitchen", "id_": "Ruang tamu + dapur", "cat": [["Ceiling Fan", 3], ["Wooden Decoration", 1], ["Sofa Set + Mattress", 1], ["Sofa pillow + cover", 2], ["White coffee table", 1], ["", 1], ["", 1], ["Large Wooden Fruit Plate", 1], ["Standing Lamp", 1], ["Wooden console Table", 1], ["Rattan Box", 1], ["Dining Table", 1], ["Dining Chairs", 8], ["Cupboard", 1], ["Kitchen Island", 1], ["Bar Chair", 3], ["", 1], ["Gas Stove", 1], ["Gas Tank 12 Kg", 1], ["Water Dispenser", 1], ["Trash Bin", 1], ["Wooden Rack", 1], ["Refrigerator", 1], ["Oven", 1], ["Jar", 7], ["Dessert plate", 8], ["Jar glass", 2], ["Espresso cup", 1], ["Small bowl", 1], ["Water glass", 7], ["Tea/ Coffee Cup", 13], ["Dinner Plate", 17], ["Dessert bowl", 2], ["Bowl", 10], ["Blue plate (large)", 4], ["Blue plate (small)", 4], ["Coaster", 4], ["Dinner Knife", 8], ["Dinner Spoon", 9], ["Tea Spoon", 4], ["Long small spoon", 2], ["Dinner fork", 13], ["Cutting Board", 1], ["Round plastic container", 2], ["Kitchen knife", 1], ["Can opener", 1], ["Cheese grater", 1], ["Peeler", 1], ["Soup ladle", 1], ["Rice cooker’s steam tray", 1], ["Mix plastic container", 1]]}, {"id": "blu-6", "en": "Outdoor + Storage Room", "id_": "Luar + gudang", "cat": [["Rattan Sunbed", 1], ["Pool Cleaning Equipment", 1], ["Wooden Single Bed + Mattress", 1], ["", 1], ["Wooden Cupboard", 1], ["Washing Machine", 1], ["Clothlines", 3], ["Wooden table", 1], ["Cleaning Tools", 1]]}]}, {"id": "zala", "name": "Villa Zala", "area": "", "hideRooms": ["bed1", "bed2", "bed3", "living", "kitchen"], "rooms": [{"id": "zala-1", "en": "Living Room (TV Area)", "id_": "Ruang tamu (area TV)", "cat": [["Wooden TV cabinet", 1], ["LED TV", 1], ["LG Speaker SET (5.1)", 1], ["Painting", 1], ["Sofa SET (5 Pillow)", 1], ["Rattan Synthetic Table", 1], ["Ashtray", 1], ["Gucci Set", 1], ["LG DVD Player", 1]]}, {"id": "zala-2", "en": "Living Room (In Front Room 2)", "id_": "Ruang tamu (depan Kamar 2)", "cat": [["Wooden Chair", 1], ["Pillow + Cover", 5], ["Congklak", 1], ["Painting (Room 2 entrance)", 2], ["Wooden classic table", 1], ["Wooden Decoration", 3], ["Ashtray", 1], ["Marble Accessories", 1], ["Wooden Rack", 1], ["Gucci Set", 3], ["Brass Statue", 4], ["Small Accessories", 2], ["Balinese Girl Head Statue", 1], ["Ceiling fan", 2], ["Standing lamp", 1]]}, {"id": "zala-3", "en": "Dining Area", "id_": "Ruang makan", "cat": [["Wooden dining table", 1], ["Dining chair", 6], ["Glass Fruit placement", 1], ["Tissue Box", 1]]}, {"id": "zala-4", "en": "Kitchen Area", "id_": "Dapur", "cat": [["Refrigerator", 1], ["Stove + Oven", 1], ["Pan", 1], ["Water Dispenser + Aqua Gallon", 1], ["Juicer", 1], ["Electric Water Boiler", 1], ["Gas Tank 12 kg", 1], ["Wall Decoration", 1], ["Trashcan", 1], ["Small Chair", 2], ["Coffee table", 1], ["Big mirror with frame", 1], ["Wooden long table", 1], ["Jar accessories", 2], ["Wooden rack", 1], ["Blue and gold tea pot", 1], ["Blue and gold glass", 4], ["Blue Jar", 1], ["Batik bowl", 2], ["Green bowl", 1], ["Brass teapot", 3], ["Brass tray", 1], ["Drinking Glass", 8], ["Red Wine Glass", 2], ["Shot glass", 6], ["Tea Glass", 5], ["Green Plastic Bowl", 4], ["White Bowl", 3], ["White Batik Bowl", 1], ["White Plate", 23], ["White Tray Plate", 3], ["Soup Glasses", 7], ["Egg Cup", 2], ["Brown Glasses", 1], ["Water jug", 1], ["", 1], ["Fruit Plate", 2], ["Small table mat", 2], ["Ceramic table mat", 8], ["Rattan table mat", 8], ["Aluminium food container", 4], ["Plastic food container", 2], ["Fruit plate glass", 2], ["Plastic Bowl", 1]]}, {"id": "zala-5", "en": "Room 1", "id_": "Kamar 1", "cat": [["Wooden bed frame", 1], ["Mattress", 1], ["Mattress protector", 1], ["White bed linen", 5], ["Brown bed cover", 2], ["Pillow + cover", 4], ["Bed side table", 2], ["Reading lamp", 2], ["AC + Remote", 1], ["Wardrobe", 2], ["Curtain", 1], ["Mirror", 2], ["Washbasin", 1], ["Toilet", 1], ["Cloth hanger stand", 1], ["Face towel", 3], ["Floor mat", 1], ["Pool towel", 6], ["White Bedcover", 5], ["Pillow cover", 22], ["Pillow", 2], ["Bolster", 1]]}, {"id": "zala-6", "en": "Room 2", "id_": "Kamar 2", "cat": [["Wooden bed frame", 1], ["Mattress", 1], ["Mattress protector", 1], ["White bed linen", 1], ["Pillow + cover", 4], ["Brown bed cover", 1], ["Wardrobe", 1], ["AC + Remote", 1], ["Chair", 1], ["Coffee table", 1], ["Chair", 1], ["Curtain", 1], ["Washbasin", 1], ["Mirror", 2], ["Toilet", 1], ["Safety Box", 1]]}, {"id": "zala-7", "en": "Storage", "id_": "Gudang", "cat": [["Washing machine", 1], ["Grill", 1], ["Standing lamp", 1], ["Bamboo Blind", 2], ["Water Heater", 1]]}, {"id": "zala-8", "en": "Pool Area", "id_": "Area kolam", "cat": [["Bamboo Blind", 6], ["Rattan Synthetic Sun bed", 1], ["Rattan Synthetic Table", 1]]}]}, {"id": "karisma", "name": "Villa Karisma (SS Chang)", "area": "", "hideRooms": ["bed1", "bed2", "bed3", "living", "kitchen"], "rooms": [{"id": "karisma-1", "en": "Living Room", "id_": "Ruang tamu", "cat": [["Small vase", 1], ["LED TV", 1], ["Standing Lamp", 1], ["Painting", 1], ["AC", 1], ["Ceiling fan", 1]]}, {"id": "karisma-2", "en": "Kitchen", "id_": "Dapur", "cat": [["Vase", 2], ["Wooden decoration", 1], ["AC", 1], ["Hanging lamp", 1], ["Trash can", 1], ["Refrigerator", 1], ["Oven", 1], ["Microwave", 1], ["Stove", 1], ["Exhaust hood", 1], ["Electric water heater", 1], ["Coffee maker", 1], ["Water dispenser", 1], ["Water gallon", 1], ["Bowl", 2], ["Plate", 18], ["Saucer", 17], ["14,9 Kg gas tank", 1], ["Toaster", 1], ["Spatula", 11], ["Scissors", 2], ["Fruit peeler", 1], ["Knife", 8], ["Plastic cutting board", 2], ["Wine glasses", 6], ["Mugs", 6], ["Beer glasses", 5], ["Cocktail glasses", 8], ["Tea spoons", 10], ["Forks", 9], ["Dining knives", 13], ["Spoons", 12], ["Grater", 1], ["Bottle opener", 1], ["Meat forks", 1], ["Meat stick", 4], ["Frying pan", 4], ["Pan", 2], ["Pot lid", 2], ["Plastic filter", 1]]}, {"id": "karisma-3", "en": "Back Kitchen", "id_": "Dapur belakang", "cat": [["Washbasin", 1], ["Stove", 1], ["Exhaust hood", 1]]}, {"id": "karisma-4", "en": "Laundry Area", "id_": "Area cuci", "cat": [["Washing machine", 1], ["Trash can", 4], ["Iron board", 1], ["Cloth hanger", 1]]}, {"id": "karisma-5", "en": "Room 1 (Upstairs)", "id_": "Kamar 1 (atas)", "cat": [["Rattan table", 1], ["Double seater sofa + mattress", 1], ["Single sofa + mattress", 2], ["AC", 1], ["Bed frame", 1], ["Mattress", 1], ["White bed linen", 1], ["Pillow + cover", 3], ["White bed cover", 1], ["Curtain", 1], ["Single chair + mattress", 2], ["Table", 1], ["Wardrobe", 1], ["Mirror", 1], ["Washbasin", 1], ["Towel", 3], ["Pool towel", 1], ["Trashcan", 1], ["Painting", 1], ["Toilet", 1]]}, {"id": "karisma-6", "en": "Room 2", "id_": "Kamar 2", "cat": [["Bed frame", 1], ["Mattress", 3], ["Mattress protector", 1], ["White bed linen", 2], ["White bed cover", 3], ["Pillow + cover", 4], ["Vase", 1], ["Curtain", 1], ["AC", 1], ["Mirror", 2], ["Statue", 1], ["Washbasin", 1], ["Trashcan", 1], ["Toilet", 1], ["Console rack", 1], ["Wardrobe", 1], ["Console table", 1]]}, {"id": "karisma-7", "en": "Room 3", "id_": "Kamar 3", "cat": [["Curtain", 1], ["LED TV", 1], ["Console table", 1], ["Pillow", 4], ["Wall decoration", 2], ["Picture frame", 2], ["Console rack", 1], ["Wardrobe", 1], ["AC", 1], ["Safety Box", 1], ["Mirror", 2], ["Bathtub", 1], ["Painting", 1], ["Washbasin", 1], ["Trash can", 1], ["Toilet", 1]]}, {"id": "karisma-8", "en": "Pool Area", "id_": "Area kolam", "cat": [["Sun bed", 2], ["Wooden decoration", 1], ["Rattan basket", 1], ["Towel hanger", 1], ["Wall decoration", 1]]}, {"id": "karisma-9", "en": "Parking Area", "id_": "Area parkir", "cat": [["Genset", 1], ["Long table", 1]]}]}];
