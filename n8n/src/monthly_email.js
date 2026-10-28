// Monthly report, step 2: build the email. Numbers come from step 1; the AI only wrote the summary paragraph(s).
// If the AI step failed, the email is still sent, with the numbers and a short note.
const data = $('Monthly numbers').first().json.data;
const ai = $input.first().json || {};
let summary = (ai.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const T = data.totals;
const para = t => t.split(/\n+/).filter(Boolean).map(l => /^[-*•]\s/.test(l) ? `<li>${esc(l.replace(/^[-*•]\s+/, ''))}</li>` : `<p style="margin:0 0 10px">${esc(l)}</p>`).join('').replace(/(<li>.*?<\/li>)+/gs, m => `<ul style="margin:0 0 10px;padding-left:18px">${m}</ul>`);
const table = (head, rows) => rows.length ? `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;margin:4px 0 16px">
  <tr>${head.map(h => `<th align="left" style="border-bottom:2px solid #222;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666">${esc(h)}</th>`).join('')}</tr>
  ${rows.map(r => `<tr>${r.map(c => `<td style="border-bottom:1px solid #e3e3e3;vertical-align:top">${c}</td>`).join('')}</tr>`).join('')}</table>` : '<p style="color:#666;margin:4px 0 16px">None.</p>';
const h2 = t => `<h3 style="font-size:15px;margin:22px 0 6px;color:#A61011">${esc(t)}</h3>`;
const stat = (n, l) => `<td align="center" style="padding:10px;background:#F5F5F5;border-radius:6px"><div style="font-size:22px;font-weight:700;color:#222">${n}</div><div style="font-size:11px;color:#666">${esc(l)}</div></td>`;

const coRows = data.checkOuts.map(c => [
  `<b>${esc(c.villa)}</b><br><span style="color:#666">${esc(c.agreement)} · ${esc(c.checkIn)} – ${esc(c.checkOut)}</span>`,
  c.changes.length ? c.changes.map(x => `${esc(x.room)}: ${esc(x.item)} — <b>${esc(x.result)}</b>${x.movedTo ? ' to ' + esc(x.movedTo) : ''}${x.note ? ` <span style="color:#666">(${esc(x.note)})</span>` : ''}${x.cost !== null ? ' · ' + rp(x.cost) : ''}`).join('<br>') : 'No changes',
  c.cost ? rp(c.cost) : '-',
]);
const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:680px">
  <div style="background:#A61011;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0"><div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.85">GW Realty · Villa Inventory</div><div style="font-size:20px;font-weight:700;margin-top:4px">Monthly report</div><div style="font-size:13px;opacity:.9;margin-top:2px">${esc(data.period)}</div></div>
  <div style="padding:16px 20px;border:1px solid #e3e3e3;border-top:0;border-radius:0 0 6px 6px">
  <table cellspacing="6" style="width:100%;margin:0 -6px 8px"><tr>${stat(T.inventories, 'Inventories')}${stat(T.checkIns, 'Check-ins')}${stat(T.checkOuts, 'Check-outs')}${stat(T.damaged, 'Items damaged')}${stat(rp(T.cost), 'Costs entered')}</tr></table>
  ${h2('Summary')}
  ${summary ? para(summary) + '<p style="font-size:11px;color:#888;margin:0">Summary written by AI from the figures in this email; the tables below are the source.</p>' : '<p style="color:#666">The AI summary could not be generated this month; all figures are below.</p>'}
  ${h2('Check-outs this period')}${table(['Villa', 'Changes', 'Cost'], coRows)}
  ${T.unpriced ? `<p style="margin:-8px 0 16px;color:#9A5A08">${T.unpriced} worn or damaged item${T.unpriced === 1 ? '' : 's'} without a cost yet. Costs can still be added on the check-out page.</p>` : ''}
  ${h2('Check-ins this period')}${table(['Villa', 'Agreement', 'Check-in', 'Check-out'], data.checkIns.map(c => [esc(c.villa), esc(c.agreement), esc(c.checkIn), esc(c.checkOut)]))}
  ${h2('Inventories this period')}${table(['Villa', 'Inventory date'], data.inventories.map(c => [esc(c.villa), esc(c.date)]))}
  ${h2('Needs attention')}
  ${table(['What', 'Villa', 'Detail'], [].concat(
    data.overdue.map(x => ['<b style="color:#B3261E">Check-out overdue</b>', esc(x.villa), esc(x.checkOut)]),
    data.waiting.map(x => ['Waiting for your approval', esc(x.villa), esc(x.what)]),
    data.stale.map(x => ['Draft open for 3+ days', esc(x.villa), esc(x.what)]),
    data.noInventory.map(v => ['No inventory yet', esc(v), '']),
    data.upcoming.map(x => ['Check-out in the next 30 days', esc(x.villa), esc(x.checkOut)])))}
  ${data.repeats.length ? h2('Repeated problems (all check-outs so far)') + table(['Villa', 'Item', 'Check-outs with a problem'], data.repeats.map(x => [esc(x.villa), esc(x.item), String(x.times)])) : ''}
  <p style="font-size:12px;color:#888;margin-top:20px">${T.occupied} of ${T.villas} villas occupied today. Sent automatically on the 30th of each month (last day in February).</p>
  </div></div>`;
return [{ json: { subject: `GW Realty villa inventory · monthly report · ${data.period}`, html } }];
