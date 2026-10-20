// Temporary shared demo backend (Netlify Function + Netlify Blobs).
// Same endpoints as the n8n workflows, so the page works across devices before n8n is connected.
// AI is simulated. Replace config.js base with the n8n URL to go live.
import { getStore } from '@netlify/blobs';

const KEY = 'gw-demo-2026';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.headers.get('x-gw-key') !== KEY) return json({ error: 'bad key' }, 403);
  const url = new URL(req.url);
  const ep = url.pathname.replace(/^\/api\//, '');
  const store = getStore({ name: 'gw-demo', consistency: 'strong' });
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const readAll = async () => (await store.get('records', { type: 'json' })) || {};

  if (ep === 'gw-records') return json({ ok: true, records: Object.values(await readAll()) });

  if (ep === 'gw-save-record') {
    const r = body.record || {};
    if (!r.id) return json({ error: 'record.id required' }, 400);
    const all = await readAll();
    r.photoFiles = Object.assign({}, (all[r.id] || {}).photoFiles, r.photoFiles);
    for (const p of body.photos || []) {
      const fid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await store.set('photo:' + fid, String(p.data || ''));
      r.photoFiles[p.id] = fid;
    }
    r.updatedAt = new Date().toISOString();
    all[r.id] = r;
    await store.setJSON('records', all);
    return json({ ok: true, recordId: r.id, photoFiles: r.photoFiles });
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

  if (ep === 'gw-reset') {
    const { blobs } = await store.list();
    for (const b of blobs) await store.delete(b.key);
    return json({ ok: true });
  }

  return json({ error: 'unknown endpoint' }, 404);
};

export const config = { path: '/api/*' };
