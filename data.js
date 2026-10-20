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
