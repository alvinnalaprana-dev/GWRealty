// Manager only (checked against the current account list). Turn the base64 PDF into a file for Google Drive.
const recs = gwRows($input.all());
const wh = $('Webhook').first().json;
const who = gwWho(gwHeader(wh.headers, 'x-gw-token'), recs, BOOT, SECRET);
if (!who) return deny(401, 'Please sign in again.');
if (!gwIsMgr(who.role)) return deny(403, 'Only the manager can save reports.');
const b = wh.body || {};
if (!b.data || !b.fileName) return deny(400, 'fileName and data are required');
const data = String(b.data).replace(/^data:application\/pdf;(filename=[^;]*;)?base64,/, '').replace(/\s/g, '');
if (!/^JVBER/.test(data)) return deny(400, 'Only PDF files can be saved.');            // "%PDF" in base64
if (data.length > 40 * 1024 * 1024) return deny(413, 'The PDF is too large (limit about 30 MB).');
// A complete PDF ends with "%%EOF" (checked on the decoded last bytes; base64 length is a multiple of 4).
if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return deny(400, 'The PDF data is damaged. Please generate it again.');
let tail = null;   // null = this runtime cannot decode; then the check is skipped rather than refusing every PDF
try { if (typeof Buffer !== 'undefined') tail = Buffer.from(data.slice(-2048), 'base64').toString('latin1'); else if (typeof atob === 'function') tail = atob(data.slice(-2048)); } catch (e) { tail = null; }
if (tail !== null && tail.indexOf('%%EOF') < 0) return deny(400, 'The PDF looks incomplete. Please generate it again.');
let name = String(b.fileName).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 150);
if (!/\.pdf$/i.test(name)) name += '.pdf';
return [{ json: { ok: true, fileName: name }, binary: { data: { data, mimeType: 'application/pdf', fileName: name } } }];
