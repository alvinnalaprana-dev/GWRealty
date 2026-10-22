// Shared demo backend (Netlify Function + Netlify Blobs).
// Same endpoints and the same server rules as the n8n workflows (login, token check, staff limits,
// overwrite protection), so the demo behaves like the real system. AI is simulated.
import { getStore } from '@netlify/blobs';
import core from '../../n8n/src/gwcore.cjs';

const KEY = 'gw-demo-2026';                 // public demo key: the demo holds sample data only
const SECRET = 'gw-demo-token-secret';      // demo only; the real secret lives in n8n
const BOOT = [
  { id: 'u-mgr', name: 'Manager', email: 'manno.realtor@gmail.com', role: 'mgr', pw: core.gwPwHash('manno.realtor@gmail.com', 'gwrealty2026') },
  { id: 'u-wayan', name: 'Wayan', email: 'wayan@gwrealtyglobal.com', role: 'staff', pw: core.gwPwHash('wayan@gwrealtyglobal.com', 'wayan2026') }
];
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.headers.get('x-gw-key') !== KEY) return json({ error: 'bad key' }, 403);
  const url = new URL(req.url);
  const ep = url.pathname.replace(/^\/api\//, '');
  const store = getStore({ name: 'gw-demo', consistency: 'strong' });
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const readAll = async () => (await store.get('records', { type: 'json' })) || {};
  const all = await readAll();
  const recs = Object.values(all);

  if (ep === 'gw-login') { const r = core.gwLogin(body, recs, BOOT, SECRET); return json(r, r.status); }
  const who = core.gwWho(req.headers.get('x-gw-token'), recs, BOOT, SECRET);
  if (!who) return json({ ok: false, error: 'Please sign in again.' }, 401);

  if (ep === 'gw-reset') {
    if (who.role !== 'mgr') return json({ ok: false, error: 'Only the manager can reset the demo.' }, 403);
    const { blobs } = await store.list();
    for (const b of blobs) await store.delete(b.key);
    return json({ ok: true });
  }

  if (ep === 'gw-records') return json({ ok: true, records: core.gwList(recs, who) });

  if (ep === 'gw-save-record') {
    const id = (body.record || {}).id;
    const settings = core.gwSettings(recs, BOOT);
    const p = core.gwPrepareSave(body.record, all[id], settings, who);
    if (!p.ok) return json(p, p.status);
    const r = p.record;
    r.photoFiles = Object.assign({}, (all[r.id] || {}).photoFiles, r.photoFiles);
    for (const ph of body.photos || []) {
      const fid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await store.set('photo:' + fid, String(ph.data || ''));
      r.photoFiles[ph.id] = fid;
    }
    all[r.id] = r;
    await store.setJSON('records', all);
    return json({ ok: true, recordId: r.id, photoFiles: r.photoFiles, updatedAt: r.updatedAt });
  }

  if (ep === 'gw-photo') {
    const b64 = await store.get('photo:' + (url.searchParams.get('id') || ''));
    if (!b64) return json({ error: 'not found' }, 404);
    return new Response(Buffer.from(b64, 'base64'), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
  }

  if (ep === 'gw-ai-room') {
    if (body.phase === 'out') {
      const items = (body.checkin || []).map(i => ({ id: i.id, qty: i.qty, cond: i.cond, note: '', seen: true }));
      const tweak = (room, name, fn) => { if (body.room !== room) return; const it = items.find((x, k) => (body.checkin[k] || {}).name === name); if (it) fn(it); };
      tweak('Bedroom 1', 'Pillows with cover', it => { it.cond = 'Damaged'; it.note = '1 pillow cover torn'; });
      tweak('Bedroom 1', 'Bed runner', it => { it.cond = 'Damaged'; it.note = 'Stain'; });
      tweak('Bedroom 2', 'White towels', it => { it.cond = 'Worn'; });
      return json({ ok: true, phase: 'out', quality: 'ok', items, extra: [] });
    }
    const exp = Array.isArray(body.expected) && body.expected.length ? body.expected : [['Item seen in photo', 1]];
    const items = exp.filter(([n]) => n !== 'Mattress protector').map(([name, qty]) => ({
      name, qty, cond: name === 'Wine glasses' ? 'Damaged' : 'Good', note: name === 'Wine glasses' ? '1 cracked' : (exp.length === 1 ? 'Demo: rename or remove' : ''),
      small: /fork|knife|knives|spoon|glass|spatula|coaster|placemat|soap|jar|mug|bowl|plate/i.test(name)
    }));
    return json({ ok: true, phase: 'in', quality: 'ok', items });
  }

  if (ep === 'gw-save-pdf') return json({ ok: true, demo: true });

  return json({ error: 'unknown endpoint' }, 404);
};

export const config = { path: '/api/*' };
