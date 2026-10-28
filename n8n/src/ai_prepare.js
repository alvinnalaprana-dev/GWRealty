// Build the Claude request for one room. Input (POST JSON body):
// { phase: "in"|"out", villa, room, photos: ["<base64 jpeg>", ...],
//   expected: [["Bed frame",1], ...]            (optional, check-in: villa amenity list for this room)
//   checkin:  [{id, name, qty, cond}, ...]       (check-out: the approved check-in list for this room) }
const MODEL = 'claude-haiku-5-5';   // change to 'claude-sonnet-5-5' if Haiku misses too much
const MAX_PHOTOS = 4;

const MAX_PHOTO_B64 = 8 * 1024 * 1024;   // about 6 MB per photo (the app sends compressed JPEGs well under this)
const raw = $('Webhook').first().json.body || {};
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f`]/g, ' ').slice(0, n);   // short, single-line text for the prompt
const b = {
  phase: raw.phase, villa: txt(raw.villa, 80), room: txt(raw.room, 80),
  expected: (Array.isArray(raw.expected) ? raw.expected : []).slice(0, 150).map(x => [txt((x || [])[0], 80), Math.max(0, Math.min(999, parseInt((x || [])[1], 10) || 1))]),
  checkin: (Array.isArray(raw.checkin) ? raw.checkin : []).slice(0, 300).map(i => ({ id: txt((i || {}).id, 40), name: txt((i || {}).name, 80), qty: Math.max(0, Math.min(999, parseInt((i || {}).qty, 10) || 0)), cond: txt((i || {}).cond, 12) })),
};
const media = [];
const photos = (Array.isArray(raw.photos) ? raw.photos : []).slice(0, MAX_PHOTOS).map(p => {
  const m = String(p).match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/);
  media.push(m ? m[1] : 'image/jpeg');
  return String(p).replace(/^data:image\/\w+;base64,/, '');
});
if (!photos.length) return deny(400, 'No photos sent');
if (photos.some(p => p.length > MAX_PHOTO_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p))) return deny(400, 'A photo is too large or damaged. Retake it.');
const phase = b.phase === 'out' ? 'out' : 'in';

const rules = `You check villa inventory from photos for a property manager in Bali.
Rules:
- List furniture, appliances and fittings you can actually see: beds, sofas, tables, chairs, wardrobes, TVs, AC units (with remote), ceiling fans, lamps, curtains and blinds, safety boxes, kitchen appliances, linen, decor, kitchenware, outdoor furniture, umbrellas.
- Do not list walls, floors, ceilings, doors or windows as items. But if you see damage on them or on bathroom fittings (peeling paint, water damage, ceiling leak, stained toilet, crusted shower head or sink, broken railing), add an entry named after the part, e.g. "Wall" or "Toilet", with qty 1, cond "Damaged" and the problem in "note".
- Count at the level "4 chairs". If you cannot count reliably (cutlery, glasses, small items), give your best count and set "small": true.
- Condition is one of: "Good", "Worn", "Damaged". Use "Damaged" only for visible damage (broken, cracked, torn, large stain) and say what in "note".
- Never guess items you cannot see (inside closed cupboards, under bedding).
- If the photos are too dark, blurry or do not show the room, set "quality" to "retake" and explain briefly in "quality_note".
Reply with JSON only, no other text.`;

let task;
if (phase === 'in') {
  const exp = Array.isArray(b.expected) && b.expected.length
    ? `\nThe villa's amenity list for this room (use these exact names when an item matches; still list other items you see):\n${b.expected.map(([n, q]) => `- ${n} (${q})`).join('\n')}`
    : '';
  task = `Room: ${b.room || 'unknown'} in ${b.villa || 'a villa'}.${exp}
Return: {"quality":"ok"|"retake","quality_note":"","items":[{"name":"","qty":1,"cond":"Good","note":"","small":false}]}`;
} else {
  const list = (b.checkin || []).map(i => `- id ${i.id}: ${i.name}, qty ${i.qty}, ${i.cond}`).join('\n');
  task = `CHECK-OUT. Room: ${b.room || 'unknown'} in ${b.villa || 'a villa'}.
These items were recorded at check-in:
${list}
For each check-in item, report what you see now. If an item is not visible in the photos, set "seen": false and keep the check-in qty and condition.
Return: {"quality":"ok"|"retake","quality_note":"","items":[{"id":"","qty":1,"cond":"Good","note":"","seen":true}],"extra":[{"name":"","qty":1,"cond":"Good","note":""}]}`;
}

const content = photos.map((data, i) => ({ type: 'image', source: { type: 'base64', media_type: media[i], data } }));
content.push({ type: 'text', text: task });

return [{ json: { ok: true, phase, body: { model: MODEL, max_tokens: 6000, system: rules, messages: [{ role: 'user', content }] } } }];
