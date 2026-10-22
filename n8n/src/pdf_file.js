// Manager only. Turn the base64 PDF into a file for Google Drive.
const t = gwVerifyToken(gwHeader($input.first().json.headers, 'x-gw-token'), SECRET);
if (!t) return deny(401, 'Please sign in again.');
if (t.role !== 'mgr') return deny(403, 'Only the manager can save reports.');
const b = $input.first().json.body || {};
if (!b.data || !b.fileName) return deny(400, 'fileName and data are required');
return [{ json: { ok: true, fileName: String(b.fileName).replace(/[^A-Za-z0-9._-]+/g, '-') }, binary: { data: { data: String(b.data).replace(/^data:application\/pdf;base64,/, ''), mimeType: 'application/pdf', fileName: String(b.fileName).replace(/[^A-Za-z0-9._-]+/g, '-') } } }];
