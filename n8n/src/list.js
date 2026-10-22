// Return all records for a signed-in user. Password hashes are never sent; staff get no tenant contact details.
const recs = gwRows($input.all());
const who = gwWho(gwHeader($('Webhook').first().json.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
return [{ json: { ok: true, status: 200, records: gwList(recs, who) } }];
