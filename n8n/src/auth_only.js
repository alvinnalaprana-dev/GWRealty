// Signed-in users only, and the account must still exist (removed accounts lose access at once).
const recs = gwRows($input.all());
const who = gwWho(gwHeader($('Webhook').first().json.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
