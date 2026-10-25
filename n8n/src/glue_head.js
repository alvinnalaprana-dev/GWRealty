const SECRET = '__GW_SECRET__';
const BOOT = [{ id: 'u-mgr', name: 'Manager', email: 'manno.realtor@gmail.com', role: 'mgr', pw: '__GW_BOOT_HASH__' }];
const gwRows = items => { const out = []; for (const it of items) { const t = gwJoinRow(it.json || {}); if (!t) continue; try { out.push(JSON.parse(t)); } catch (e) { /* skip broken row */ } } return out; };
const deny = (status, error) => [{ json: { ok: false, status, error } }];
