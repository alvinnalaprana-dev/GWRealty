// Signed-in users only (token check; no sheet read needed).
const t = gwVerifyToken(gwHeader($input.first().json.headers, 'x-gw-token'), SECRET);
if (!t) return deny(401, 'Please sign in again.');
