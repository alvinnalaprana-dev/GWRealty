// Find leases whose check-out is exactly 7 days from today (Bali time) and build one email.
const TZ = 'Asia/Makassar';
const fmt = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const target = fmt(new Date(Date.now() + 7 * 864e5));
const due = $input.all().map(i => i.json).filter(r => r.status === 'occupied' && String(r.checkOut).slice(0, 10) === target);
if (!due.length) return [];
const lines = due.map(r => `- ${r.villa} · agreement ${r.agreement || '-'} · tenant ${r.tenant || '-'} · check-out ${r.checkOut}`).join('\n');
return [{ json: {
  subject: `Check-out in 7 days: ${due.length} villa${due.length > 1 ? 's' : ''} (${target})`,
  text: `These leases check out on ${target}:\n\n${lines}\n\nPlease schedule the check-out inventory with staff.\n\nGW Realty Inventory`
} }];
