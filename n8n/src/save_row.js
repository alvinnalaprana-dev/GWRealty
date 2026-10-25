// Build the Records sheet row. Drive file IDs of uploaded photos are added to record.photoFiles.
const items = $('Check and prepare').all();
const r = items[0].json._rec;
r.photoFiles = Object.assign({}, r.photoFiles || {});
if ($('Upload photo').isExecuted) {
  $('Upload photo').all().forEach((it, i) => { const m = (items[i] || {}).json; if (m && m.photoId && it.json.id) r.photoFiles[m.photoId] = it.json.id; });
}
// The full record is split over dataJson..dataJson6 (Google Sheets allows 50,000 characters per cell).
const json = JSON.stringify(r), C = 45000, cols = ['dataJson', 'dataJson2', 'dataJson3', 'dataJson4', 'dataJson5', 'dataJson6'];
if (json.length > C * cols.length) throw new Error('Record too large to store (' + json.length + ' characters)');
const parts = {}; cols.forEach((k, i) => { parts[k] = json.slice(i * C, (i + 1) * C); });
return [{ json: Object.assign({
  recordId: r.id, agreement: r.agreement || '', villa: r.villaName || r.villaId || '', tenant: r.tenant || '',
  status: r.status || '', invDate: r.invDate || '', checkIn: r.checkIn || '', checkOut: r.checkOut || '',
  outInvDate: r.outInvDate || '', updatedAt: r.updatedAt, _photoFiles: r.photoFiles
}, parts) }];
