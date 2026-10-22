// Check who is saving, what they may change, and that nobody saved a newer copy in the meantime.
// Output: one item per new photo (binary "data"), or one item with none: true; or ok: false with an HTTP status.
const recs = gwRows($input.all());
const wh = $('Webhook').first().json;
const who = gwWho(gwHeader(wh.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
const b = wh.body || {};
const id = (b.record || {}).id;
const existing = recs.find(r => r.id === id) || null;
const p = gwPrepareSave(b.record, existing, gwSettings(recs, BOOT), who);
if (!p.ok) return [{ json: p }];
const r = p.record;
if (r.id !== '_settings') {
  // Keep Drive file links only for photos the record still uses (removed photos stay in Drive as evidence).
  const used = new Set(); ['inPhotos', 'outPhotos'].forEach(k => Object.values(r[k] || {}).forEach(l => (l || []).forEach(pid => used.add(pid))));
  const all = Object.assign({}, (existing || {}).photoFiles, r.photoFiles);
  r.photoFiles = {}; Object.keys(all).forEach(pid => { if (used.has(pid)) r.photoFiles[pid] = all[pid]; });
}
const photos = r.id === '_settings' ? [] : (Array.isArray(b.photos) ? b.photos : []);
if (!photos.length) return [{ json: { ok: true, none: true, _rec: r } }];
const safe = x => String(x || '').replace(/[^A-Za-z0-9._-]+/g, '-');
return photos.map((ph, i) => Object.assign({
  json: Object.assign({ ok: true, photoId: ph.id, fileName: `${safe(r.agreement || r.id)}_${safe(ph.phase)}_${safe(ph.room)}_${safe(ph.id)}.jpg` }, i === 0 ? { _rec: r } : {}),
  binary: { data: { data: String(ph.data || '').replace(/^data:image\/\w+;base64,/, ''), mimeType: 'image/jpeg', fileName: `${safe(ph.id)}.jpg` } }
}));
