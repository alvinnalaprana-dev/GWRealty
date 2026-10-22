// Turn Claude's reply into clean JSON for the page.
const res = $input.first().json;
const phase = $('Prepare request').first().json.phase;
const text = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
let out;
try {
  const m = text.match(/\{[\s\S]*\}/);
  out = JSON.parse(m ? m[0] : text);
} catch (e) {
  return [{ json: { ok: false, error: 'AI reply was not valid JSON', raw: text.slice(0, 500) } }];
}
const CONDS = ['Good', 'Worn', 'Damaged'];
const cond = c => CONDS.find(x => x.toLowerCase() === String(c || '').trim().toLowerCase()) || 'Good';
const items = (out.items || []).map(i => phase === 'in'
  ? { name: String(i.name || '').slice(0, 80), qty: Math.max(0, parseInt(i.qty, 10) || 0), cond: cond(i.cond), note: String(i.note || '').slice(0, 120), small: !!i.small }
  : { id: String(i.id || ''), qty: Math.max(0, parseInt(i.qty, 10) || 0), cond: cond(i.cond), note: String(i.note || '').slice(0, 120), seen: i.seen !== false });
const usage = res.usage || {};
return [{ json: {
  ok: true, phase,
  quality: out.quality === 'retake' ? 'retake' : 'ok', quality_note: out.quality_note || '',
  items, extra: phase === 'out' ? (out.extra || []) : undefined,
  usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, model: res.model }
} }];
