// Check email + password against the accounts in the _settings row. Returns a signed 30-day token.
// Wrong-password lock (5 tries, then 15 minutes) is kept in this workflow's static data on the server.
const recs = gwRows($input.all());
const store = $getWorkflowStaticData('global');
store.fails = store.fails || {};
const now = Date.now();
Object.keys(store.fails).forEach(k => { const f = store.fails[k]; if (!f.until && !f.n) delete store.fails[k]; else if (f.until && f.until < now - 864e5) delete store.fails[k]; });
const res = gwLogin($('Webhook').first().json.body || {}, recs, BOOT, SECRET, store.fails, now);
const up = res._upgrade; delete res._upgrade;
const out = { json: res };
if (up) {
  // Save the upgraded (slow, salted) password format back to the sheet.
  const j = JSON.stringify(up), C = 45000, cols = ['dataJson', 'dataJson2', 'dataJson3', 'dataJson4', 'dataJson5', 'dataJson6'];
  const parts = {}; cols.forEach((k, i) => { parts[k] = j.slice(i * C, (i + 1) * C); });
  out.json._row = Object.assign({ recordId: '_settings', agreement: '', villa: '', tenant: '', status: 'settings', invDate: '', checkIn: '', checkOut: '', outInvDate: '', updatedAt: up.updatedAt || '' }, parts);
}
return [out];
