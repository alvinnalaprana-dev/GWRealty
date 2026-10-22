// Only photos that belong to a record can be fetched, and only by a signed-in user.
const recs = gwRows($input.all());
const wh = $('Webhook').first().json;
const who = gwWho(gwHeader(wh.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
const fid = String((wh.query || {}).id || '');
const known = recs.some(r => r.photoFiles && Object.values(r.photoFiles).indexOf(fid) >= 0);
if (!fid || !known) return deny(404, 'Photo not found.');
return [{ json: { ok: true, fileId: fid } }];
