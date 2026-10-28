// Monthly report, step 1: work out every number from the Records sheet (no AI here).
// Runs on the 28th-31st at 08:00 WITA and continues only on the report day: the 30th, or the last day of a shorter month (February).
// Set FORCE = true only for a one-off test run.
const FORCE = false;
const TZ = 'Asia/Makassar';
const ymd = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = ymd(new Date());                                   // e.g. 2026-10-30
const [Y, M, D] = today.split('-').map(Number);
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m = 1..12
const reportDay = (y, m) => Math.min(30, daysIn(y, m));
if (!FORCE && D !== reportDay(Y, M)) return [];

// Period: the day after last month's report day, up to and including today.
const pm = M === 1 ? 12 : M - 1, py = M === 1 ? Y - 1 : Y;
const startD = new Date(Date.UTC(py, pm - 1, reportDay(py, pm) + 1));
const start = startD.toISOString().slice(0, 10), end = today;
const inPeriod = ms => { if (!ms) return false; const d = ymd(new Date(ms)); return d >= start && d <= end; };
const fmt = s => { if (!s) return '-'; const d = new Date(String(s).slice(0, 10) + 'T00:00:00Z'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };

// Read the records (one record may be split over dataJson..dataJson6).
const cols = ['dataJson', 'dataJson2', 'dataJson3', 'dataJson4', 'dataJson5', 'dataJson6'];
const recs = [];
for (const it of $input.all()) { const t = cols.map(k => it.json[k] || '').join(''); if (!t) continue; try { recs.push(JSON.parse(t)); } catch (e) { /* skip broken row */ } }
const st = recs.find(r => r.id === '_settings') || { villas: [] };
const villas = st.villas || [];
const records = recs.filter(r => r.id !== '_settings');
const vName = id => (villas.find(v => v.id === id) || {}).name || id;
const DEF_ROOMS = { bed1: 'Bedroom 1', bed2: 'Bedroom 2', bed3: 'Bedroom 3', living: 'Living room', kitchen: 'Kitchen & dining' };
const roomName = (vid, rid) => { const v = villas.find(x => x.id === vid) || {}; const r = (v.rooms || []).find(x => x.id === rid); return (r && (r.en || r.name)) || DEF_ROOMS[rid] || rid; };

// Same rule as the app: a change = worse condition than at check-in, or moved to another room.
const RANK = { Good: 0, Worn: 1, Damaged: 2 };
const hasCost = c => c !== '' && c !== null && c !== undefined && !isNaN(Number(c));
function changes(r) {
  const out = [];
  Object.keys(r.outItems || {}).forEach(room => (r.outItems[room] || []).forEach(it => {
    if (it.unchecked && !it.touched && !it.movedTo) return;
    const worse = (RANK[it.cond] || 0) > (RANK[it.inCond] || 0);
    if (!worse && !it.movedTo) return;
    out.push({ room: roomName(r.villaId, room), item: it.name, result: worse ? it.cond : 'Moved', movedTo: it.movedTo ? roomName(r.villaId, it.movedTo) : '', note: it.note || '', cost: hasCost(it.cost) ? Number(it.cost) : null });
  }));
  return out;
}

const isInv = r => r.kind === 'inv';
const inventories = records.filter(r => isInv(r) && r.status === 'closed' && inPeriod(r.inApprovedAt));
const checkIns = records.filter(r => !isInv(r) && r.inApprovedAt && inPeriod(r.inApprovedAt));
const checkOuts = records.filter(r => !isInv(r) && r.status === 'closed' && inPeriod(r.outApprovedAt));
const coDetail = checkOuts.map(r => { const ch = changes(r); const priced = ch.filter(c => c.cost !== null);
  return { villa: vName(r.villaId), agreement: r.agreement || '-', checkIn: fmt(r.checkIn), checkOut: fmt(r.checkOut), changes: ch,
    damaged: ch.filter(c => c.result === 'Damaged').length, worn: ch.filter(c => c.result === 'Worn').length, moved: ch.filter(c => c.result === 'Moved').length,
    cost: priced.reduce((a, c) => a + c.cost, 0), unpriced: ch.filter(c => c.cost === null && c.result !== 'Moved').length }; });

// The situation today.
const occupied = records.filter(r => r.status === 'occupied');
const in30 = new Date(Date.parse(today + 'T00:00:00Z') + 30 * 864e5).toISOString().slice(0, 10);
const upcoming = occupied.filter(r => r.checkOut && r.checkOut.slice(0, 10) >= today && r.checkOut.slice(0, 10) <= in30).sort((a, b) => a.checkOut.localeCompare(b.checkOut)).map(r => ({ villa: vName(r.villaId), checkOut: fmt(r.checkOut) }));
const overdue = occupied.filter(r => r.checkOut && r.checkOut.slice(0, 10) < today).map(r => ({ villa: vName(r.villaId), checkOut: fmt(r.checkOut) }));
const waiting = records.filter(r => r.status === 'checkin_pending' || r.status === 'checkout_pending').map(r => ({ villa: vName(r.villaId), what: isInv(r) ? 'Inventory' : r.status === 'checkin_pending' ? 'Check-in' : 'Check-out' }));
const stale = records.filter(r => (r.status === 'in_draft' || r.status === 'out_draft') && r.createdAt && Date.now() - r.createdAt > 3 * 864e5).map(r => ({ villa: vName(r.villaId), what: isInv(r) ? 'Inventory' : r.status === 'in_draft' ? 'Check-in' : 'Check-out' }));
const withBaseline = new Set(records.filter(r => r.inApprovedAt).map(r => r.villaId));
const noInventory = villas.filter(v => !withBaseline.has(v.id)).map(v => v.name);

// Items with problems at two or more check-outs (all time), per villa.
const rep = {};
records.filter(r => r.status === 'closed' && !isInv(r)).forEach(r => changes(r).filter(c => c.result !== 'Moved').forEach(c => { const k = vName(r.villaId) + '|' + c.item.toLowerCase(); (rep[k] = rep[k] || { villa: vName(r.villaId), item: c.item, times: 0 }).times++; }));
const repeats = Object.values(rep).filter(x => x.times >= 2).sort((a, b) => b.times - a.times);

const totals = {
  inventories: inventories.length, checkIns: checkIns.length, checkOuts: checkOuts.length,
  damaged: coDetail.reduce((a, c) => a + c.damaged, 0), worn: coDetail.reduce((a, c) => a + c.worn, 0), moved: coDetail.reduce((a, c) => a + c.moved, 0),
  cost: coDetail.reduce((a, c) => a + c.cost, 0), unpriced: coDetail.reduce((a, c) => a + c.unpriced, 0),
  villas: villas.length, occupied: occupied.length,
};
const data = { period: `${fmt(start)} – ${fmt(end)}`, start, end, totals,
  inventories: inventories.map(r => ({ villa: vName(r.villaId), date: fmt(r.invDate) })),
  checkIns: checkIns.map(r => ({ villa: vName(r.villaId), agreement: r.agreement || '-', checkIn: fmt(r.checkIn), checkOut: fmt(r.checkOut) })),
  checkOuts: coDetail, upcoming, overdue, waiting, stale, noInventory, repeats };

// Ask the AI only for the commentary; every number it may use is in `data`. No tenant names or contact details are sent.
const prompt = `You write the monthly villa inventory summary for GW Realty, a villa rental agency in Bali. The reader is the manager.
Use ONLY the facts in the JSON below. Do not invent, estimate or recalculate any number; quote numbers exactly as given. If something is not in the data, do not mention it.
Write plain English, at most 180 words, as 3 to 5 short paragraphs or bullet points:
1. One-sentence overview of the period.
2. What stood out at check-outs (damage, repeated problems, costs not yet entered).
3. What needs the manager's attention now (overdue check-outs, records waiting for approval, drafts left open, villas with no inventory yet, check-outs coming up).
If the period had no activity, say so in one sentence and only list what needs attention.
No greeting, no sign-off, no headings.

DATA:
${JSON.stringify(data)}`;
return [{ json: { data, body: { model: 'claude-opus-5-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] } } }];
