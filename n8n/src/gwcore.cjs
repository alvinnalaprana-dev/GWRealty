/* GW Inventory server rules, shared by the n8n Code nodes and the Netlify demo backend.
   Plain JavaScript with no imports: n8n Code nodes block the crypto module, so SHA-256 and HMAC are implemented here. */
function gwUtf8(s) { return unescape(encodeURIComponent(String(s))); }
function gwSha256Bytes(bytes) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6, m = new Array(withPad).fill(0);
  for (let i = 0; i < l; i++) m[i] = bytes[i];
  m[l] = 0x80; const bits = l * 8;
  for (let i = 0; i < 8; i++) m[withPad - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
  const w = new Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < withPad; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = []; H.forEach(x => { for (let i = 3; i >= 0; i--) out.push((x >>> (8 * i)) & 0xff); }); return out;
}
const gwStrBytes = s => { const u = gwUtf8(s), a = []; for (let i = 0; i < u.length; i++) a.push(u.charCodeAt(i)); return a; };
const gwHex = a => a.map(x => (x < 16 ? '0' : '') + x.toString(16)).join('');
function gwSha256(s) { return gwHex(gwSha256Bytes(gwStrBytes(s))); }
function gwHmac(key, msg) {
  let k = gwStrBytes(key); if (k.length > 64) k = gwSha256Bytes(k); while (k.length < 64) k.push(0);
  const ip = k.map(x => x ^ 0x36), op = k.map(x => x ^ 0x5c);
  return gwHex(gwSha256Bytes(op.concat(gwSha256Bytes(ip.concat(gwStrBytes(msg))))));
}
const gwToHex = s => gwHex(gwStrBytes(s));
const gwFromHex = h => { let u = ''; for (let i = 0; i < h.length; i += 2) u += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return decodeURIComponent(escape(u)); };
function gwEq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ---------- passwords and tokens ---------- */
const GW_TOKEN_DAYS = 30;
const gwPwHash = (email, pw) => gwSha256(String(email).toLowerCase().trim() + ':' + pw);   // what the browser sends for new passwords

/* Stored passwords: PBKDF2-HMAC-SHA256 with a per-account salt over gwPwHash (slow on purpose).
   Format "p2$<iterations>$<saltHex>$<hashHex>". Older accounts hold the bare 64-hex gwPwHash and are upgraded on save or sign-in. */
const GW_PW_ITER = 10000;
function gwPbkdf2(keyStr, saltHex, iter) {
  let k = gwStrBytes(keyStr); if (k.length > 64) k = gwSha256Bytes(k); while (k.length < 64) k.push(0);
  const ip = k.map(x => x ^ 0x36), op = k.map(x => x ^ 0x5c);
  const hmac = m => gwSha256Bytes(op.concat(gwSha256Bytes(ip.concat(m))));
  const salt = []; for (let i = 0; i < saltHex.length; i += 2) salt.push(parseInt(saltHex.substr(i, 2), 16));
  let u = hmac(salt.concat([0, 0, 0, 1])); const t = u.slice();
  for (let i = 1; i < iter; i++) { u = hmac(u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
  return gwHex(t);
}
function gwSalt() {
  // Secure random bytes where the runtime offers them (Web Crypto); Math.random only as a last resort.
  let b = null;
  try { if (typeof crypto !== 'undefined' && crypto.getRandomValues) b = crypto.getRandomValues(new Uint8Array(16)); } catch (e) { b = null; }
  if (!b) { b = []; for (let i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256)); }
  return Array.from(b).map(x => ('0' + x.toString(16)).slice(-2)).join('');
}
const gwIsLegacy = stored => /^[0-9a-f]{64}$/.test(String(stored || ''));
function gwStorePw(clientHash) { const salt = gwSalt(); return 'p2$' + GW_PW_ITER + '$' + salt + '$' + gwPbkdf2(clientHash, salt, GW_PW_ITER); }
function gwCheckPw(stored, clientHash) {
  stored = String(stored || '');
  if (gwIsLegacy(stored)) return gwEq(stored, clientHash);
  const m = stored.split('$'); if (m.length !== 4 || m[0] !== 'p2') return false;
  return gwEq(m[3], gwPbkdf2(clientHash, m[2], parseInt(m[1], 10) || GW_PW_ITER));
}
function gwMakeToken(u, secret, now) {
  const p = gwToHex(JSON.stringify({ u: u.id, r: u.role, e: (now || Date.now()) + GW_TOKEN_DAYS * 864e5 }));
  return p + '.' + gwHmac(secret, p);
}
function gwVerifyToken(tok, secret, now) {
  const parts = String(tok || '').split('.');
  if (parts.length !== 2 || !/^[0-9a-f]+$/.test(parts[0]) || !gwEq(gwHmac(secret, parts[0]), parts[1])) return null;
  try { const p = JSON.parse(gwFromHex(parts[0])); if (!p.u || p.e < (now || Date.now())) return null; return { uid: p.u, role: p.r }; } catch (e) { return null; }
}
const gwHeader = (headers, name) => (headers || {})[name] || (headers || {})[name.toLowerCase()] || '';

/* ---------- settings (villas + accounts) ---------- */
function gwSettings(records, bootUsers) {
  const st = records.find(r => r && r.id === '_settings');
  return st ? st : { id: '_settings', status: 'settings', villas: [], users: bootUsers || [], _boot: true };
}
const gwPublicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
// Roles: 'admin' (Support Admin: can do everything; managers cannot remove, demote or reset it), 'mgr' (Manager: everything), 'staff' (inventories only).
const gwIsMgr = role => role === 'mgr' || role === 'admin';

/* Sign-in. `limits` is a small store kept by the server (n8n workflow static data) for the
   wrong-password lock: 5 wrong passwords for one email lock that email for 15 minutes. */
const GW_MAX_FAILS = 5, GW_LOCK_MIN = 15;
function gwLogin(body, records, bootUsers, secret, limits, now) {
  now = now || Date.now();
  const email = String((body || {}).email || '').toLowerCase().trim(), pw = String((body || {}).password || '');
  const L = limits || {}; const rec = L[email] || { n: 0, until: 0 };
  if (rec.until > now) {
    const mins = Math.ceil((rec.until - now) / 60000);
    return { ok: false, status: 429, error: `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
  }
  const st = gwSettings(records, bootUsers);
  const u = (st.users || []).find(x => String(x.email || '').toLowerCase() === email);
  if (!u || !u.pw || !pw || !gwCheckPw(u.pw, gwPwHash(email, pw))) {
    if (email) { rec.n = (rec.n || 0) + 1; rec.until = 0; if (rec.n >= GW_MAX_FAILS) { rec.n = 0; rec.until = now + GW_LOCK_MIN * 60000; } L[email] = rec; }
    return { ok: false, status: 401, error: 'Email or password is not correct.' };
  }
  delete L[email];
  // Upgrade an old-format password to the slow, salted format (settings updatedAt is kept, so nobody's open screen conflicts).
  let upgrade = null;
  if (gwIsLegacy(u.pw) && !st._boot) {
    const st2 = JSON.parse(JSON.stringify(st));
    st2.users.forEach(x => { if (x.id === u.id) x.pw = gwStorePw(u.pw); });
    upgrade = st2;
  }
  return { ok: true, status: 200, token: gwMakeToken(u, secret), user: gwPublicUser(u), _upgrade: upgrade };
}

/* Who is calling: token valid AND the account still exists (removed accounts lose access at once). */
function gwWho(tok, records, bootUsers, secret) {
  const t = gwVerifyToken(tok, secret);
  if (!t) return null;
  const u = (gwSettings(records, bootUsers).users || []).find(x => x.id === t.uid);
  return u ? { uid: u.id, role: u.role, name: u.name } : null;
}

/* ---------- list ---------- */
const GW_PRIVATE = ['phone', 'email', 'idNo', 'notes'];
function gwList(records, who) {
  return records.filter(r => r && r.id).map(r => {
    const c = JSON.parse(JSON.stringify(r));
    if (c.id === '_settings') {
      delete c._boot; c.users = gwIsMgr(who.role) ? (c.users || []).map(gwPublicUser) : [];
      // Staff see a villa's upcoming tenant name and dates, never contact details or notes.
      if (!gwIsMgr(who.role)) c.villas = (c.villas || []).map(v => { if (v && v.lease) GW_PRIVATE.forEach(k => delete v.lease[k]); return v; });
    }
    else if (!gwIsMgr(who.role)) GW_PRIVATE.forEach(k => delete c[k]);
    return c;
  }).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/* ---------- save: permissions, overwrite protection, settings merge ---------- */
const GW_STAFF_STATUS = ['in_draft', 'checkin_pending', 'out_draft', 'checkout_pending'];
const GW_LOCKED_AFTER_CHECKIN = ['inItems', 'inPhotos', 'agreement', 'tenant', 'checkIn', 'checkOut', 'invDate', 'inApprovedAt', 'kind', 'villaId'];
function gwPrepareSave(record, existing, settings, who, nowIso) {
  const r = JSON.parse(JSON.stringify(record || {}));
  if (!r.id) return { ok: false, status: 400, error: 'record.id is required' };
  delete r._dirty;
  if (existing && String(existing.updatedAt || '') !== String(r.updatedAt || '')) {
    return { ok: false, status: 409, error: 'This record was changed on another device. Reload to see the latest version.' };
  }
  if (r.id === '_settings') {
    const base = settings || { villas: [], users: [] };
    if (!gwIsMgr(who.role)) {
      // Staff may only add or hide rooms of existing villas (during an inventory).
      const villas = (base.villas || []).map(v => { const nv = (r.villas || []).find(x => x.id === v.id); return nv ? Object.assign({}, v, { rooms: nv.rooms || v.rooms, hideRooms: nv.hideRooms || v.hideRooms }) : v; });
      r.villas = villas; r.users = base.users || [];
    } else {
      // Keep stored password hashes; a new hash is only sent when a password is set or changed.
      // A Support Admin account can only be changed, demoted or removed by a Support Admin.
      const admin = who.role === 'admin', baseUsers = base.users || [];
      r.users = (r.users || []).map(u => {
        const old = baseUsers.find(x => x.id === u.id);
        if (!admin && old && old.role === 'admin') return old;
        let pw = u.pw || (old && old.pw) || '';
        if (gwIsLegacy(pw)) pw = gwStorePw(pw);   // new password from the browser, or an old-format one
        let role = ['admin', 'mgr', 'staff'].indexOf(u.role) >= 0 ? u.role : 'staff';
        if (role === 'admin' && !admin) role = old ? old.role : 'mgr';
        return { id: u.id, name: u.name, email: String(u.email || '').trim(), role, pw };
      });
      if (!admin) baseUsers.filter(x => x.role === 'admin' && !r.users.some(u => u.id === x.id)).forEach(x => r.users.push(x));
      if (!r.users.some(u => u.id === who.uid && gwIsMgr(u.role))) return { ok: false, status: 400, error: 'You cannot remove your own manager account.' };
    }
    r.status = 'settings';
  } else if (!gwIsMgr(who.role)) {
    // Staff may cancel their own draft: a check-in/inventory draft becomes 'cancelled', a check-out draft goes back to 'occupied'.
    // The server rebuilds the record from the stored copy, so nothing else can be changed this way.
    if (existing && existing.status === 'in_draft' && r.status === 'cancelled') {
      return { ok: true, status: 200, record: Object.assign(JSON.parse(JSON.stringify(existing)), { status: 'cancelled', cancelledAt: r.cancelledAt || Date.now(), updatedAt: nowIso || new Date().toISOString() }) };
    }
    if (existing && existing.status === 'out_draft' && r.status === 'occupied') {
      return { ok: true, status: 200, record: Object.assign(JSON.parse(JSON.stringify(existing)), { status: 'occupied', outItems: null, outPhotos: {}, outInvDate: '', updatedAt: nowIso || new Date().toISOString() }) };
    }
    if (GW_STAFF_STATUS.indexOf(r.status) < 0) return { ok: false, status: 403, error: 'Only the manager can approve.' };
    // Staff may only edit drafts (or start a check-out on an occupied villa). Once sent, the record belongs to the manager.
    const draft = existing && (existing.status === 'in_draft' || existing.status === 'out_draft');
    if (existing && !draft && !(existing.status === 'occupied' && r.status === 'out_draft')) {
      return { ok: false, status: 403, error: 'This record has already been sent to the manager.' };
    }
    if (existing) GW_PRIVATE.forEach(k => { if (existing[k] !== undefined) r[k] = existing[k]; else delete r[k]; });
    // During a check-out, the approved check-in (list, photos, lease details) cannot be changed by staff.
    if (existing && existing.inApprovedAt) GW_LOCKED_AFTER_CHECKIN.forEach(k => { if (existing[k] !== undefined) r[k] = existing[k]; else delete r[k]; });
    else GW_PRIVATE.forEach(k => delete r[k]);
  }
  r.updatedAt = nowIso || new Date().toISOString();
  return { ok: true, status: 200, record: r };
}

/* ---------- sheet storage: one record may be split over several cells (Google Sheets limit: 50,000 characters per cell) ---------- */
const GW_CHUNK = 45000, GW_CHUNKS = ['dataJson', 'dataJson2', 'dataJson3', 'dataJson4', 'dataJson5', 'dataJson6'];
function gwJoinRow(row) { return GW_CHUNKS.map(k => (row && row[k]) || '').join(''); }
function gwSplitJson(json) {
  if (json.length > GW_CHUNK * GW_CHUNKS.length) return null;
  const out = {}; GW_CHUNKS.forEach((k, i) => { out[k] = json.slice(i * GW_CHUNK, (i + 1) * GW_CHUNK); }); return out;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { gwSha256, gwHmac, gwPwHash, gwMakeToken, gwVerifyToken, gwHeader, gwSettings, gwLogin, gwWho, gwList, gwPrepareSave, gwPublicUser, gwJoinRow, gwSplitJson, gwStorePw, gwCheckPw, gwIsLegacy, gwPbkdf2, gwIsMgr };
