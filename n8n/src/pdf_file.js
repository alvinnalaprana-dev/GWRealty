// Manager only (checked against the current account list). Turn the base64 PDF into a file for Google Drive.
const recs = gwRows($input.all());
const wh = $('Webhook').first().json;
const who = gwWho(gwHeader(wh.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
if (who.role !== 'mgr') return deny(403, 'Only the manager can save reports.');
const b = wh.body || {};
if (!b.data || !b.fileName) return deny(400, 'fileName and data are required');
const data = String(b.data).replace(/^data:application\/pdf;(filename=[^;]*;)?base64,/, '').replace(/\s/g, '');
if (!/^JVBER/.test(data)) return deny(400, 'Only PDF files can be saved.');            // "%PDF" in base64
if (data.length > 40 * 1024 * 1024) return deny(413, 'The PDF is too large (limit about 30 MB).');
const name = String(b.fileName).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 150);
return [{ json: { ok: true, fileName: /\.pdf$/i.test(name) ? name : name + '.pdf' }, binary: { data: { data, mimeType: 'application/pdf', fileName: name } } }];
