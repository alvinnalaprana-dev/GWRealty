// Build the Records sheet row. Drive file IDs of uploaded photos are added to record.photoFiles.
const items = $('Check and prepare').all();
const r = items[0].json._rec;
r.photoFiles = Object.assign({}, r.photoFiles || {});
if ($('Upload photo').isExecuted) {
  $('Upload photo').all().forEach((it, i) => { const m = (items[i] || {}).json; if (m && m.photoId && it.json.id) r.photoFiles[m.photoId] = it.json.id; });
}
return [{ json: {
  recordId: r.id, agreement: r.agreement || '', villa: r.villaName || r.villaId || '', tenant: r.tenant || '',
  status: r.status || '', invDate: r.invDate || '', checkIn: r.checkIn || '', checkOut: r.checkOut || '',
  outInvDate: r.outInvDate || '', updatedAt: r.updatedAt, dataJson: JSON.stringify(r),
  _photoFiles: r.photoFiles
} }];
