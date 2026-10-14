/* GW Realty Inventory — client demo.
   Everything runs in the browser: records in localStorage, photos in IndexedDB.
   The "AI" step is simulated with the Villa Madya 1 item list. Nothing is sent anywhere. */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const barEl = document.getElementById('bar');
  const ROOMS = window.GW_ROOMS;
  const CAT = window.GW_CATALOG;
  const SMALL = new Set(window.GW_SMALL);
  const HIDDEN = new Set(window.GW_HIDDEN);
  const KEY = 'gwinv-demo-v1';
  const CONDS = ['Good', 'Worn', 'Damaged'];
  const RANK = { Good: 0, Worn: 1, Damaged: 2 };

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fmt = (s, lang) => { const d = parse(s); if (!d) return '—'; const m = (lang === 'id' ? MON_ID : MON_EN)[d.getMonth()]; return `${d.getDate()} ${m} ${d.getFullYear()}`; };
  const daysUntil = s => Math.round((parse(s) - today()) / 864e5);
  const roomName = (id, lang) => { const r = ROOMS.find(x => x.id === id); return r ? (lang === 'id' ? r.id_ : r.en) : id; };
  const count = obj => Object.values(obj || {}).reduce((a, v) => a + (v ? v.length : 0), 0);

  /* ---------- state ---------- */
  let S;
  function seed() {
    const t = today();
    const bromoItems = {};
    ROOMS.forEach(r => {
      bromoItems[r.id] = CAT[r.id].map(([name, qty]) => ({ id: uid(), name, qty, cond: 'Good', note: '', src: 'ai', flag: SMALL.has(name) ? 'small' : '' }));
    });
    const wg = bromoItems.kitchen.find(i => i.name === 'Wine glasses');
    if (wg) { wg.cond = 'Damaged'; wg.note = '1 cracked'; }
    return {
      v: 1, role: null,
      villas: [
        { id: 'madya1', name: 'Villa Madya 1', area: '' },
        { id: 'bromo', name: 'Villa Bromo', area: 'Petitenget' },
        { id: 'sore', name: 'Villa Sore', area: 'Tumbak Bayuh' },
        { id: 'asmara', name: 'Villa Asmara', area: 'Tumbak Bayuh' }
      ],
      records: [{
        id: 'demo01', villaId: 'bromo', tenant: 'Demo Tenant', seeded: true,
        checkIn: iso(addDays(t, -88)), checkOut: iso(addDays(t, 3)),
        status: 'occupied', inPhotos: {}, inItems: bromoItems, inApprovedAt: Date.now() - 88 * 864e5,
        outPhotos: {}, outItems: null, createdAt: Date.now() - 88 * 864e5
      }]
    };
  }
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* demo still works in memory */ } }
  const L = () => (S.role === 'mgr' ? 'en' : 'id');
  const T = (id, en) => (L() === 'id' ? id : en);
  const villa = id => S.villas.find(v => v.id === id);
  const rec = id => S.records.find(r => r.id === id);
  const activeRec = vid => S.records.find(r => r.villaId === vid && r.status !== 'closed');

  /* ---------- photos (IndexedDB + memory cache) ---------- */
  const PC = new Map();
  const IDB = {
    db: null,
    open() {
      return new Promise((res, rej) => {
        if (this.db) return res(this.db);
        if (!window.indexedDB) return rej(new Error('no idb'));
        const r = indexedDB.open('gwinv-demo', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('p');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction('p', mode); const st = t.objectStore('p');
        const out = fn(st);
        t.oncomplete = () => res(out && out.result);
        t.onerror = () => rej(t.error);
      });
    },
    put(id, v) { return this.tx('readwrite', s => s.put(v, id)).catch(() => {}); },
    get(id) { return this.tx('readonly', s => s.get(id)).catch(() => null); },
    del(id) { return this.tx('readwrite', s => s.delete(id)).catch(() => {}); },
    clear() { return this.tx('readwrite', s => s.clear()).catch(() => {}); }
  };
  async function getPhoto(id) {
    if (PC.has(id)) return PC.get(id);
    const p = await IDB.get(id);
    if (p) PC.set(id, p);
    return p || null;
  }
  async function compress(file) {
    let src, w0, h0;
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w0 = src.width; h0 = src.height;
    } catch (e) {
      src = await new Promise((res, rej) => {
        const u = URL.createObjectURL(file); const im = new Image();
        im.onload = () => res(im); im.onerror = () => rej(new Error('unsupported')); im.src = u;
      });
      w0 = src.naturalWidth; h0 = src.naturalHeight;
    }
    const sc = Math.min(1, 1280 / Math.max(w0, h0));
    const w = Math.round(w0 * sc), h = Math.round(h0 * sc);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
    return { data: c.toDataURL('image/jpeg', 0.72), w, h, old: !!(file.lastModified && Date.now() - file.lastModified > 864e5), size: file.size };
  }
  function hydrate() {
    app.querySelectorAll('img[data-pid]').forEach(async im => {
      const p = await getPhoto(im.dataset.pid);
      if (p) im.src = p.data; else im.replaceWith(Object.assign(document.createElement('div'), { className: 'ph-empty', innerHTML: '<span>—</span>' }));
    });
  }

  /* ---------- ui bits ---------- */
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function overlay(msg) {
    const o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = `<div class="card"><div class="spin"></div><p>${esc(msg)}</p></div>`;
    document.body.appendChild(o); return () => o.remove();
  }
  function lightbox(src) {
    const o = document.createElement('div'); o.className = 'overlay lb';
    o.innerHTML = `<img alt="Photo" src="${src}">`;
    o.addEventListener('click', () => o.remove());
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { o.remove(); document.removeEventListener('keydown', k); } });
    document.body.appendChild(o);
  }
  const chip = (cls, txt) => `<span class="chip ${cls}">${esc(txt)}</span>`;
  const phImg = (pid, alt) => `<img data-pid="${esc(pid)}" alt="${esc(alt)}" class="zoom">`;
  const phEmpty = label => `<div class="ph-empty"><span>${esc(label)}</span></div>`;

  function renderBar() {
    const role = S.role === 'mgr' ? 'Manager' : S.role === 'staff' ? 'Staf · Wayan' : '';
    barEl.innerHTML = `<div class="bar-in">
      <a class="brand" href="#/"><i aria-hidden="true"></i>${S.role === 'mgr' ? 'GW Inventory' : 'GW Inventaris'}</a>
      <div class="bar-r"><span class="demo">DEMO</span>${role ? `<span class="role">${esc(role)}</span><button class="linkbtn" data-act="switch">${S.role === 'mgr' ? 'Switch role' : 'Ganti peran'}</button>` : ''}</div>
    </div>`;
  }

  /* ---------- router ---------- */
  let viewToken = 0;
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function render(keepScroll) {
    const y = window.scrollY;
    viewToken++;
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'staff') S.role = 'staff';
    if (p[0] === 'mgr') S.role = 'mgr';
    if (p[0] === '' && S.role) { go(S.role === 'mgr' ? '#/mgr' : '#/staff'); return; }
    renderBar();
    if (p[0] === 'staff' && p[1] === 'capture') viewCapture(p[2]);
    else if (p[0] === 'staff') viewStaffHome();
    else if (p[0] === 'mgr' && p[1] === 'rec') viewRecord(p[2]);
    else if (p[0] === 'mgr' && p[1] === 'capture') viewCapture(p[2]);
    else if (p[0] === 'mgr' && p[1] === 'new') viewNew();
    else if (p[0] === 'mgr') viewMgrHome();
    else viewLogin();
    save();
    hydrate();
    if (keepScroll === true) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => render());

  /* ---------- login ---------- */
  function viewLogin() {
    S.role = null; renderBar();
    app.innerHTML = `<div class="login">
      <p class="eyebrow">GW Realty · Demo</p>
      <h1>Villa Inventory</h1>
      <p class="sub">Photos at check-in and check-out. AI makes the list, the manager approves, the system makes the report. Choose a role to try it.</p>
      <div class="pick">
        <button data-act="role" data-role="staff"><b>Staff</b><span>On the phone. Takes photos at the villa. Screens in Indonesian.</span></button>
        <button data-act="role" data-role="mgr"><b>Manager</b><span>On the computer. Checks the AI list, approves, makes the PDF.</span></button>
      </div>
      <p class="note">This is a demo. AI results are simulated and all data stays in this browser. Nothing is sent anywhere.</p>
    </div>`;
  }

  /* ---------- staff home ---------- */
  function viewStaffHome() {
    const cards = S.villas.map(v => {
      const r = activeRec(v.id);
      let status, info = '', btn = '';
      if (!r) { status = chip('', 'Kosong'); info = 'Siap untuk check-in'; btn = `<button class="btn block" data-act="startIn" data-v="${v.id}">Mulai check-in</button>`; }
      else if (r.status === 'in_draft') { status = chip('am', 'Foto check-in belum dikirim'); btn = `<a class="btn block" href="#/staff/capture/${r.id}">Lanjutkan check-in</a>`; }
      else if (r.status === 'checkin_pending') { status = chip('am', 'Menunggu persetujuan manajer'); info = 'Foto check-in sudah dikirim'; }
      else if (r.status === 'occupied') {
        const d = daysUntil(r.checkOut);
        status = chip('ok', 'Disewa');
        info = `Penyewa: ${esc(r.tenant)} · check-out ${fmt(r.checkOut, 'id')}`;
        if (d <= 7) status += ' ' + chip('am', d < 0 ? 'Lewat tanggal check-out' : d === 0 ? 'Check-out hari ini' : `Check-out ${d} hari lagi`);
        btn = `<button class="btn block ${d <= 7 ? '' : 'ghost'}" data-act="startOut" data-r="${r.id}">Mulai check-out</button>`;
      }
      else if (r.status === 'out_draft') { status = chip('am', 'Foto check-out belum dikirim'); btn = `<a class="btn block" href="#/staff/capture/${r.id}">Lanjutkan check-out</a>`; }
      else if (r.status === 'checkout_pending') { status = chip('am', 'Menunggu persetujuan manajer'); info = 'Foto check-out sudah dikirim'; }
      return `<div class="villa"><div class="top"><b>${esc(v.name)}</b><span>${status}</span></div>${info ? `<small>${info}</small>` : ''}${btn}</div>`;
    }).join('');
    app.innerHTML = `<div class="page narrow">
      <div class="head"><div><p class="eyebrow">Halo, Wayan</p><h1>Villa</h1></div></div>
      <p class="sub">Pilih villa untuk check-in atau check-out. Cukup ambil foto, daftar barang dibuat otomatis.</p>
      <div class="vlist">${cards}</div>
      <p class="note">Demo: data hanya tersimpan di browser ini.</p>
    </div>`;
  }

  /* ---------- capture (staff, or manager uploading from the office) ---------- */
  let confirmMissing = false;
  function viewCapture(id) {
    const r = rec(id);
    if (!r) { go('#/'); return; }
    const v = villa(r.villaId);
    const phase = r.status.startsWith('in') || r.status === 'checkin_pending' ? 'in' : 'out';
    const home = S.role === 'mgr' ? '#/mgr' : '#/staff';
    if (r.status !== 'in_draft' && r.status !== 'out_draft') {
      app.innerHTML = `<div class="page narrow"><a href="${home}">← ${T('Kembali', 'Back')}</a><div class="card"><p>${T('Foto sudah dikirim ke manajer.', 'Photos have already been sent for review.')}</p></div></div>`;
      return;
    }
    const photos = r[phase + 'Photos'] || (r[phase + 'Photos'] = {});
    const rooms = ROOMS.map(room => {
      const list = photos[room.id] || [];
      const ref = phase === 'out' ? (r.inPhotos[room.id] || []) : [];
      const refHtml = phase === 'out'
        ? `<div class="note">${T('Foto check-in', 'Check-in photos')}</div><div class="refstrip">${ref.length ? ref.map(pid => phImg(pid, 'Check-in')).join('') : phEmpty(T('contoh', 'sample'))}</div>`
        : '';
      return `<section class="room">
        <h3>${esc(roomName(room.id, L()))} ${list.length ? chip('ok', `${list.length} ${T('foto', 'photos')}`) : chip('', T('belum ada foto', 'no photos yet'))}</h3>
        ${refHtml}
        <div class="pick2">
          <label class="btn filebtn">📷 ${T('Ambil foto', 'Take photo')}<input type="file" accept="image/*" capture="environment" data-room="${room.id}" aria-label="${T('Ambil foto', 'Take photo')} ${esc(roomName(room.id, L()))}"></label>
          <label class="btn ghost filebtn">${T('Pilih dari galeri', 'Choose files')}<input type="file" accept="image/*" multiple data-room="${room.id}" aria-label="${T('Pilih dari galeri', 'Choose files')} ${esc(roomName(room.id, L()))}"></label>
        </div>
        ${list.length ? `<div class="thumbs">${list.map(pid => `<div class="th">${phImg(pid, roomName(room.id, L()))}<span class="old" data-old="${pid}" hidden>${T('Foto lama', 'Old photo')}</span><button class="x" data-act="rmPhoto" data-room="${room.id}" data-pid="${pid}" aria-label="${T('Hapus foto', 'Remove photo')}">×</button></div>`).join('')}</div>` : ''}
      </section>`;
    }).join('');
    const total = count(photos);
    app.innerHTML = `<div class="page narrow">
      <a href="${home}">← ${T('Kembali', 'Back')}</a>
      <div class="head"><div><p class="eyebrow">${phase === 'in' ? 'Check-in' : 'Check-out'}</p><h1>${esc(v.name)}</h1></div></div>
      <p class="sub">${T('Ambil foto setiap ruangan. Bisa langsung di villa, atau nanti dari kantor lewat galeri.', 'Photograph each room. Live at the villa, or later from the office by choosing files.')}</p>
      ${phase === 'out' ? `<div class="banner">${T('Ambil foto dari sudut yang sama dengan foto check-in.', 'Take each photo from the same angle as the check-in photo.')}</div>` : ''}
      <p class="note" id="busy" hidden></p>
      ${rooms}
      <div class="sticky">
        <p class="err" id="sendErr" hidden></p>
        <button class="btn block" data-act="send" data-r="${r.id}">${T(`Kirim ${total} foto`, `Send ${total} photos`)}</button>
      </div>
    </div>`;
    confirmMissing = false;
    // mark old photos once loaded
    Object.values(photos).flat().forEach(async pid => { const p = await getPhoto(pid); if (p && p.old) { const el = app.querySelector(`[data-old="${pid}"]`); if (el) el.hidden = false; } });
  }

  async function addPhotos(input) {
    const r = rec(location.hash.split('/')[3]);
    if (!r) return;
    const phase = r.status === 'in_draft' ? 'in' : 'out';
    const room = input.dataset.room;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const busy = document.getElementById('busy');
    let oldN = 0;
    for (let i = 0; i < files.length; i++) {
      if (busy) { busy.hidden = false; busy.textContent = T(`Memproses foto ${i + 1} dari ${files.length}…`, `Processing photo ${i + 1} of ${files.length}…`); }
      try {
        const p = await compress(files[i]);
        if (p.old) oldN++;
        const id = uid();
        PC.set(id, p); await IDB.put(id, p);
        (r[phase + 'Photos'][room] = r[phase + 'Photos'][room] || []).push(id);
        save();
      } catch (e) { toast(T('Satu foto tidak bisa dibaca. Coba foto JPG atau PNG.', 'One photo could not be read. Try a JPG or PNG.')); }
    }
    render(true);
    if (oldN) toast(T(`${oldN} foto diambil lebih dari 24 jam lalu. Ditandai "Foto lama".`, `${oldN} photo(s) taken more than 24 hours ago. Marked "Old photo".`));
  }

  async function sendPhotos(r) {
    const phase = r.status === 'in_draft' ? 'in' : 'out';
    const photos = r[phase + 'Photos'];
    const err = document.getElementById('sendErr');
    const total = count(photos);
    if (!total) { err.hidden = false; err.textContent = T('Tambahkan minimal satu foto.', 'Add at least one photo.'); return; }
    const missing = ROOMS.filter(x => !(photos[x.id] || []).length).map(x => roomName(x.id, L()));
    if (missing.length && !confirmMissing) {
      confirmMissing = true;
      err.hidden = false;
      err.textContent = T(`Belum ada foto: ${missing.join(', ')}. Tekan sekali lagi untuk tetap kirim.`, `No photos yet for: ${missing.join(', ')}. Press again to send anyway.`);
      return;
    }
    const done = overlay(T(`Mengirim ${total} foto…`, `Sending ${total} photos…`));
    await new Promise(res => setTimeout(res, 1200));
    done();
    r.status = phase === 'in' ? 'checkin_pending' : 'checkout_pending';
    r[phase + 'SentAt'] = Date.now();
    save();
    toast(T('Terkirim. Manajer akan memeriksa daftar dari AI.', 'Sent. The AI list is ready for review.'));
    go(S.role === 'mgr' ? `#/mgr/rec/${r.id}` : '#/staff');
  }

  /* ---------- manager home ---------- */
  function statusMgr(r) {
    if (!r) return { chip: chip('', 'Empty'), act: '' };
    switch (r.status) {
      case 'in_draft': return { chip: chip('', 'Check-in photos in progress'), act: `<a class="btn ghost sm" href="#/mgr/capture/${r.id}">Open photos</a>` };
      case 'checkin_pending': return { chip: chip('am', 'Check-in to review'), act: `<a class="btn sm" href="#/mgr/rec/${r.id}">Review</a>` };
      case 'occupied': {
        const d = daysUntil(r.checkOut);
        const due = d <= 7 ? ' ' + chip('am', d < 0 ? 'Check-out overdue' : d === 0 ? 'Check-out today' : `Check-out in ${d} days`) : '';
        return { chip: chip('ok', 'Occupied') + due, act: `<a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a>` };
      }
      case 'out_draft': return { chip: chip('', 'Check-out photos in progress'), act: `<a class="btn ghost sm" href="#/mgr/capture/${r.id}">Open photos</a>` };
      case 'checkout_pending': return { chip: chip('am', 'Check-out to review'), act: `<a class="btn sm" href="#/mgr/rec/${r.id}">Review</a>` };
    }
    return { chip: '', act: '' };
  }
  function remindersFor(r) {
    const co = parse(r.checkOut); if (!co) return [];
    return [7, 1].map(n => { const d = addDays(co, -n); return { d: iso(d), n, sent: d <= today() }; });
  }
  function viewMgrHome() {
    const rows = S.villas.map(v => {
      const r = activeRec(v.id); const s = statusMgr(r);
      return `<tr><td><b>${esc(v.name)}</b>${v.area ? `<br><span class="note">${esc(v.area)}</span>` : ''}</td>
        <td>${r && r.tenant ? esc(r.tenant) : '—'}</td>
        <td class="num">${r && r.checkIn && r.status !== 'in_draft' && r.status !== 'checkin_pending' ? fmt(r.checkIn) : '—'}</td>
        <td class="num">${r && r.checkOut ? fmt(r.checkOut) : '—'}</td>
        <td>${s.chip}</td><td style="text-align:right">${s.act}</td></tr>`;
    }).join('');
    const upcoming = S.records.filter(r => (r.status === 'occupied' || r.status === 'out_draft') && r.checkOut).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
    const rem = upcoming.length ? upcoming.map(r => {
      const d = daysUntil(r.checkOut);
      const rs = remindersFor(r).map(x => `${fmt(x.d)} (${x.n === 7 ? '7 days before' : '1 day before'}${x.sent ? ', sent' : ''})`).join(' · ');
      return `<div class="tg"><b>⏰ ${esc(villa(r.villaId).name)}</b>Check-out ${fmt(r.checkOut)}${d >= 0 ? ` · in ${d} day${d === 1 ? '' : 's'}` : ' · overdue'}<br><small>Telegram: ${rs}</small></div>`;
    }).join('') : '<p class="note">No upcoming check-outs.</p>';
    const closed = S.records.filter(r => r.status === 'closed').sort((a, b) => (b.outApprovedAt || 0) - (a.outApprovedAt || 0));
    const hist = closed.length ? `<div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Changes</th><th></th></tr>
      ${closed.map(r => { const c = changes(r).filter(x => x.res.k !== 'wr' && x.res.k !== 'gy').length; return `<tr><td><b>${esc(villa(r.villaId).name)}</b></td><td>${esc(r.tenant)}</td><td class="num">${fmt(r.checkIn)}</td><td class="num">${fmt(r.checkOut)}</td><td>${c ? chip('am', `${c} to settle`) : chip('ok', 'None')}</td>
      <td style="text-align:right"><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="in">Check-in PDF</button><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="out">Check-out PDF</button><a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a></div></td></tr>`; }).join('')}
      </table></div>` : '<p class="note">Completed check-outs will appear here.</p>';
    app.innerHTML = `<div class="page">
      <div class="head"><div><p class="eyebrow">GW Realty</p><h1>Villas</h1></div><a class="btn" href="#/mgr/new">+ New check-in</a></div>
      <div class="grid2">
        <div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Status</th><th></th></tr>${rows}</table></div>
        <div class="card"><h3>Check-out reminders</h3><div class="rem">${rem}</div><p class="note">In the live system these go to the GW Realty Telegram group.</p></div>
      </div>
      <div class="card"><h3>Completed</h3>${hist}</div>
      <div class="row" style="justify-content:space-between">
        <p class="note">Demo: data stays in this browser. Reset to start again with the sample villas.</p>
        <button class="btn danger sm" data-act="reset">Reset demo</button>
      </div>
    </div>`;
  }

  function viewNew() {
    const empty = S.villas.filter(v => !activeRec(v.id));
    app.innerHTML = `<div class="page narrow">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">New check-in</p><h1>Choose the villa</h1></div></div>
      <p class="sub">Usually staff start the check-in on their phone at the villa. You can also start it here and upload photos from the office.</p>
      <div class="vlist">${empty.length ? empty.map(v => `<div class="villa"><div class="top"><b>${esc(v.name)}</b>${chip('', 'Empty')}</div><button class="btn block" data-act="startIn" data-v="${v.id}">Start check-in</button></div>`).join('') : '<p class="note">Every villa already has a lease in progress.</p>'}</div>
      <div class="card">
        <h3>Add a villa</h3>
        <div class="fld"><label for="newVilla">Villa name</label><input id="newVilla" placeholder="e.g. Villa Matahari"></div>
        <p class="err" id="nvErr" hidden></p>
        <button class="btn ghost" data-act="addVilla">Add villa</button>
      </div>
    </div>`;
  }

  /* ---------- simulated AI ---------- */
  function simIn(r) {
    const items = {};
    ROOMS.forEach(room => {
      if (!(r.inPhotos[room.id] || []).length) return;
      items[room.id] = CAT[room.id].filter(([n]) => !HIDDEN.has(n)).map(([name, qty]) => ({
        id: uid(), name, qty, cond: name === 'Wine glasses' ? 'Damaged' : 'Good', note: name === 'Wine glasses' ? '1 cracked' : '',
        src: 'ai', flag: SMALL.has(name) ? 'small' : ''
      }));
    });
    r.inItems = items;
  }
  function simOut(r) {
    const out = {};
    Object.keys(r.inItems || {}).forEach(roomId => {
      const has = (r.outPhotos[roomId] || []).length > 0;
      out[roomId] = r.inItems[roomId].map(i => ({
        id: uid(), name: i.name, inQty: i.qty, inCond: i.cond, inNote: i.note || '',
        qty: i.qty, cond: i.cond, note: has ? '' : 'No check-out photo', unchecked: !has, touched: false
      }));
    });
    let applied = 0;
    const tweak = (room, name, fn) => {
      if (!(r.outPhotos[room] || []).length || !out[room]) return;
      const it = out[room].find(x => x.name === name); if (!it) return;
      fn(it); applied++;
    };
    tweak('bed1', 'Pillows with cover', it => { it.qty = Math.max(0, it.inQty - 1); });
    tweak('bed1', 'Bed runner', it => { it.cond = 'Damaged'; it.note = 'Stain'; });
    tweak('bed2', 'White towels', it => { it.cond = 'Worn'; });
    if (!applied) {
      const room = Object.keys(out).find(k => (r.outPhotos[k] || []).length);
      if (room) { const it = out[room].find(x => x.inQty > 1) || out[room][0]; if (it.inQty > 0) it.qty = it.inQty - 1; }
    }
    r.outItems = out;
  }
  function result(it) {
    if (it.unchecked && !it.touched) return { k: 'gy', t: 'Not photographed' };
    if (it.qty < it.inQty) return { k: 'am', t: `Missing ${it.inQty - it.qty}` };
    if (RANK[it.cond] > RANK[it.inCond]) return it.cond === 'Damaged' ? { k: 'rd', t: 'Damaged' } : { k: 'wr', t: 'Normal wear' };
    if (it.qty > it.inQty) return { k: '', t: 'More than check-in' };
    return { k: 'ok', t: 'Same' };
  }
  function changes(r) {
    const list = [];
    Object.keys(r.outItems || {}).forEach(room => r.outItems[room].forEach(it => {
      const res = result(it); if (res.t !== 'Same' && res.t !== 'Not photographed') list.push({ room, it, res });
    }));
    return list;
  }

  function aiLoad(r, phase) {
    const tok = viewToken;
    const n = count(r[phase + 'Photos']);
    const steps = phase === 'in'
      ? ['Finding the rooms…', 'Listing the items…', 'Counting…', 'Checking condition…']
      : ['Matching rooms with check-in…', 'Checking each item on the list…', 'Looking for missing items…', 'Checking condition…'];
    app.innerHTML = `<div class="page narrow"><div class="card loader">
      <div class="spin" aria-hidden="true"></div>
      <h2 style="font-family:var(--display);font-size:22px">${phase === 'in' ? `AI is reading ${n} photo${n === 1 ? '' : 's'}` : `AI is comparing ${n} new photo${n === 1 ? '' : 's'} with the check-in list`}</h2>
      <div class="pbar"><i id="pb"></i></div><p class="note" id="ps">${steps[0]}</p>
      <p class="note">Demo: results are simulated from the Villa Madya 1 list.</p>
    </div></div>`;
    let i = 0;
    const iv = setInterval(() => {
      if (tok !== viewToken) { clearInterval(iv); return; }
      i++;
      const pb = document.getElementById('pb'); const ps = document.getElementById('ps');
      if (pb) pb.style.width = Math.min(100, i * 9) + '%';
      if (ps) ps.textContent = steps[Math.min(steps.length - 1, Math.floor(i / 3))];
      if (i >= 12) {
        clearInterval(iv);
        if (phase === 'in') simIn(r); else simOut(r);
        save();
        render();
      }
    }, 220);
  }

  /* ---------- record views ---------- */
  function viewRecord(id) {
    const r = rec(id);
    if (!r) { go('#/mgr'); return; }
    if (r.status === 'in_draft' || r.status === 'out_draft') { go(`#/mgr/capture/${r.id}`); return; }
    if (r.status === 'checkin_pending' && !r.inItems) { aiLoad(r, 'in'); return; }
    if (r.status === 'checkout_pending' && !r.outItems) { aiLoad(r, 'out'); return; }
    if (r.status === 'checkin_pending' || r.status === 'occupied') viewCheckIn(r);
    else viewCheckOut(r);
  }

  function photoCol(list, label, max) {
    const ids = (list || []).slice(0, max || 4);
    return ids.length ? ids.map(pid => phImg(pid, label)).join('') : phEmpty(label === 'Check-in' ? 'No photo (sample data)' : 'No photo');
  }

  function viewCheckIn(r) {
    const v = villa(r.villaId);
    const edit = r.status === 'checkin_pending';
    const items = r.inItems || {};
    const roomIds = ROOMS.map(x => x.id).filter(k => items[k] || (r.inPhotos[k] || []).length);
    const nItems = Object.values(items).reduce((a, l) => a + l.length, 0);
    const nPh = count(r.inPhotos);
    const noPhotoRooms = ROOMS.filter(x => !(r.inPhotos[x.id] || []).length).map(x => x.en);
    const blocks = roomIds.map(k => {
      const list = items[k] || [];
      const rowsHtml = list.map(it => edit
        ? `<tr data-iid="${it.id}"><td><div class="nmw"><input class="nm" data-k="name" data-room="${k}" data-iid="${it.id}" value="${esc(it.name)}" aria-label="Item name">${it.flag === 'small' ? '<span class="warnico" title="Small item: please check the count">⚠</span>' : ''}</div></td>
            <td><input class="q" type="number" min="0" data-k="qty" data-room="${k}" data-iid="${it.id}" value="${it.qty}" aria-label="Quantity"></td>
            <td><select data-k="cond" data-room="${k}" data-iid="${it.id}" aria-label="Condition">${CONDS.map(c => `<option${c === it.cond ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td><input data-k="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note"></td>
            <td><span class="src ${it.src}" data-src="${it.id}">${it.src === 'ai' ? 'AI' : it.src === 'added' ? 'Added' : 'Edited'}</span></td>
            <td><button class="del" data-act="delItem" data-room="${k}" data-iid="${it.id}" aria-label="Remove item">✕</button></td></tr>`
        : `<tr><td>${esc(it.name)}</td><td class="num">${it.qty}</td><td>${it.cond === 'Good' ? it.cond : chip(it.cond === 'Damaged' ? 'rd' : 'wr', it.cond)}</td><td class="note">${esc(it.note)}</td></tr>`).join('');
      return `<div class="rblock">
        <div class="ph">${photoCol(r.inPhotos[k], 'Check-in', 6)}</div>
        <div style="min-width:0;display:flex;flex-direction:column">
          <h3>${esc(roomName(k, 'en'))} ${chip('', `${list.length} items`)}</h3>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Note</th>${edit ? '<th>Source</th><th></th>' : ''}</tr>${rowsHtml || `<tr><td colspan="6" class="note">No items.</td></tr>`}</table></div>
          ${edit ? `<button class="add" data-act="addItem" data-room="${k}">+ Add item</button>` : ''}
        </div>
      </div>`;
    }).join('');
    const rem = remindersFor(r).map(x => `${fmt(x.d)} (${x.n === 7 ? '7 days before' : '1 day before'}${x.sent ? ', sent' : ''})`).join(' · ');
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${edit ? 'Check-in review' : 'Check-in · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <div class="card"><div class="form">
        <div class="fld"><label for="f-villa">Villa</label><input id="f-villa" value="${esc(v.name)}" readonly></div>
        <div class="fld"><label for="f-tenant">Tenant</label><input id="f-tenant" data-f="tenant" value="${esc(r.tenant)}" placeholder="Tenant name" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-in">Check-in date</label><input id="f-in" type="date" data-f="checkIn" value="${esc(r.checkIn)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-out">Check-out date</label><input id="f-out" type="date" data-f="checkOut" value="${esc(r.checkOut)}" ${edit ? '' : 'readonly'}></div>
      </div></div>
      ${edit ? `<div class="banner ai"><b>AI listed ${nItems} items in ${roomIds.length} room${roomIds.length === 1 ? '' : 's'} from ${nPh} photo${nPh === 1 ? '' : 's'}.</b> Items marked <span class="warnico">⚠</span> are small items: please check the count. AI cannot see hidden things, such as a mattress protector under the sheet. Add them with "+ Add item".</div>` : ''}
      ${edit && noPhotoRooms.length ? `<div class="banner am">No photos for: ${esc(noPhotoRooms.join(', '))}.</div>` : ''}
      ${!edit && r.seeded ? `<div class="banner">Sample lease: this check-in was prepared as demo data, so it has no photos.</div>` : ''}
      ${blocks}
      <div class="actions">
        <div>${edit ? '<p class="note">Check the list, fill in the tenant and dates, then approve.</p>' : `<p class="note">Approved. Check-out reminders: ${rem}</p>`}<p class="err" id="apErr" hidden></p></div>
        <div class="row">
          ${edit ? `<button class="btn" data-act="approveIn" data-r="${r.id}">✓ Approve check-in</button>` : ''}
          <button class="btn ${edit ? 'ghost' : ''}" data-act="pdf" data-r="${r.id}" data-ph="in" ${edit ? 'disabled title="Available after approval"' : ''}>📄 Generate PDF</button>
          ${r.status === 'occupied' ? `<button class="btn ghost" data-act="startOut" data-r="${r.id}">Start check-out</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  function viewCheckOut(r) {
    const v = villa(r.villaId);
    const edit = r.status === 'checkout_pending';
    const ch = changes(r);
    const unchecked = Object.keys(r.outItems || {}).filter(k => !(r.outPhotos[k] || []).length).map(k => roomName(k, 'en'));
    const nItems = Object.values(r.outItems || {}).reduce((a, l) => a + l.length, 0);
    const nPh = count(r.outPhotos);
    const qtyCell = (k, it) => edit ? `<input class="q" type="number" min="0" data-ok="qty" data-room="${k}" data-iid="${it.id}" value="${it.qty}" aria-label="Check-out quantity">` : it.qty;
    const condCell = (k, it) => edit ? `<select data-ok="cond" data-room="${k}" data-iid="${it.id}" aria-label="Check-out condition">${CONDS.map(c => `<option${c === it.cond ? ' selected' : ''}>${c}</option>`).join('')}</select>` : it.cond;
    const noteCell = (k, it) => edit ? `<input data-ok="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note">` : `<span class="note">${esc(it.note)}</span>`;
    const chRows = ch.length ? ch.map(({ room, it, res }) => `<tr class="chg"><td><b>${esc(it.name)}</b></td><td>${esc(roomName(room, 'en'))}</td><td>${it.inQty} · ${it.inCond}${it.inNote ? ` (${esc(it.inNote)})` : ''}</td><td>${qtyCell(room, it)}</td><td>${condCell(room, it)}</td><td>${chip(res.k, res.t)}</td><td>${noteCell(room, it)}</td></tr>`).join('')
      : `<tr><td colspan="7" class="note">No changes. Everything is the same as at check-in.</td></tr>`;
    const blocks = Object.keys(r.outItems || {}).map(k => {
      const list = r.outItems[k];
      return `<div class="rblock">
        <div style="display:flex;flex-direction:column;gap:8px">
          <span class="note">Check-in</span><div class="ph">${photoCol(r.inPhotos[k], 'Check-in', 2)}</div>
          <span class="note">Check-out</span><div class="ph">${photoCol(r.outPhotos[k], 'Check-out', 2)}</div>
        </div>
        <div style="min-width:0">
          <h3>${esc(roomName(k, 'en'))} ${chip('', `${list.length} items`)}</h3>
          <details class="all"><summary>Show all ${list.length} items</summary>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Check-in</th><th>Qty</th><th>Condition</th><th>Result</th></tr>
          ${list.map(it => { const res = result(it); return `<tr class="${res.t !== 'Same' ? 'chg' : ''}"><td>${esc(it.name)}</td><td>${it.inQty} · ${it.inCond}${it.inNote ? ` (${esc(it.inNote)})` : ''}</td><td>${qtyCell(k, it)}</td><td>${condCell(k, it)}</td><td>${chip(res.k, res.t)}</td></tr>`; }).join('')}
          </table></div></details>
          <p class="note">${(() => { const c = list.filter(it => result(it).t !== 'Same').length; return c ? `${c} change${c === 1 ? '' : 's'} in this room` : 'No changes in this room'; })()}</p>
        </div>
      </div>`;
    }).join('');
    const settle = ch.filter(x => x.res.k === 'am' || x.res.k === 'rd').length;
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${edit ? 'Check-out review' : 'Check-out · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <p class="sub">Tenant: <b>${esc(r.tenant)}</b> · ${fmt(r.checkIn)} to ${fmt(r.checkOut)}</p>
      ${edit ? `<div class="banner ai"><b>AI compared ${nPh} new photo${nPh === 1 ? '' : 's'} with the approved check-in list (${nItems} items).</b> ${ch.length} change${ch.length === 1 ? '' : 's'} found. Confirm or correct each one. Items already damaged at check-in are not counted again.</div>` : ''}
      ${unchecked.length ? `<div class="banner am">No check-out photos for: ${esc(unchecked.join(', '))}. Those items are marked "Not photographed".</div>` : ''}
      <div class="card"><h3>Changes since check-in</h3>
        <div class="tbl"><table class="vt itbl"><tr><th>Item</th><th>Room</th><th>Check-in</th><th>Qty</th><th>Condition</th><th>Result</th><th>Note</th></tr>${chRows}</table></div>
        <p class="note">${settle ? `${settle} item${settle === 1 ? '' : 's'} to settle with the tenant (missing or damaged). Normal wear is not charged.` : 'Nothing to settle with the tenant.'}</p>
      </div>
      ${blocks}
      <div class="actions">
        <div><p class="note">${edit ? 'Check the changes, then approve the check-out.' : 'Approved. Use the PDF to settle the deposit with the tenant.'}</p></div>
        <div class="row">
          ${edit ? `<button class="btn" data-act="approveOut" data-r="${r.id}">✓ Approve check-out</button>` : ''}
          <button class="btn ${edit ? 'ghost' : ''}" data-act="pdf" data-r="${r.id}" data-ph="out" ${edit ? 'disabled title="Available after approval"' : ''}>📄 Generate PDF</button>
          ${!edit ? `<button class="btn ghost" data-act="pdf" data-r="${r.id}" data-ph="in">Check-in PDF</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ---------- PDF ---------- */
  async function makePdf(r, phase) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('The PDF tool did not load. Check the internet connection and reload.'); return; }
    const done = overlay('Generating PDF…');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const v = villa(r.villaId);
      const W = 210, M = 14, BOTTOM = 282;
      const repNo = `GWR-${r.id.slice(0, 6).toUpperCase()}-${phase === 'in' ? 'IN' : 'OUT'}`;
      const title = phase === 'in' ? 'Check-in Report' : 'Check-out Report';
      const GREEN = [14, 124, 102], DARK = [21, 32, 28], MUTED = [91, 107, 101];
      let y;
      const header = () => {
        doc.setFillColor(...DARK); doc.rect(0, 0, W, 24, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('GW Realty', M, 11);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Villa Inventory · ${title}`, M, 17.5);
        doc.text(repNo, W - M, 11, { align: 'right' }); doc.text(`Generated ${fmt(iso(new Date()))}`, W - M, 17.5, { align: 'right' });
        doc.setTextColor(...DARK);
        y = 32;
      };
      const need = h => { if (y + h > BOTTOM) { doc.addPage(); header(); } };
      header();
      // meta
      doc.setFontSize(10);
      const meta = [['Villa', v.name], ['Tenant', r.tenant || '-'], ['Check-in', fmt(r.checkIn)], ['Check-out', fmt(r.checkOut)],
        ['Approved', fmt(iso(new Date(phase === 'in' ? r.inApprovedAt : r.outApprovedAt || Date.now())))], ['Approved by', 'Manager (demo)']];
      meta.forEach((m, i) => {
        const x = i % 2 === 0 ? M : W / 2; const yy = y + Math.floor(i / 2) * 6;
        doc.setFont('helvetica', 'bold'); doc.text(`${m[0]}:`, x, yy); doc.setFont('helvetica', 'normal'); doc.text(String(m[1]), x + 24, yy);
      });
      y += 22;
      const photoRow = async (ids, label, maxN) => {
        const n = Math.max(1, Math.min(maxN, ids.length || 1)); const gap = 3;
        const bw = (W - 2 * M - gap * (maxN - 1)) / maxN, bh = bw * 0.75;
        need(bh + 8);
        doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(label, M, y); doc.setTextColor(...DARK); y += 2;
        if (!ids.length) {
          doc.setFillColor(238, 242, 240); doc.rect(M, y, bw, bh, 'F');
          doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text('No photo', M + bw / 2, y + bh / 2, { align: 'center' }); doc.setTextColor(...DARK);
        }
        for (let i = 0; i < Math.min(n, ids.length); i++) {
          const p = await getPhoto(ids[i]); const x = M + i * (bw + gap);
          doc.setFillColor(238, 242, 240); doc.rect(x, y, bw, bh, 'F');
          if (p) {
            const ratio = p.w / p.h; let dw = bw, dh = bw / ratio;
            if (dh > bh) { dh = bh; dw = bh * ratio; }
            doc.addImage(p.data, 'JPEG', x + (bw - dw) / 2, y + (bh - dh) / 2, dw, dh);
          }
        }
        y += bh + 5;
      };
      const roomTitle = (name, extra) => {
        need(14);
        doc.setFillColor(226, 242, 238); doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(name, M + 3, y + 5.5);
        if (extra) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(extra, W - M - 3, y + 5.5, { align: 'right' }); doc.setTextColor(...DARK); }
        y += 12;
      };
      const table = (head, body, colStyles) => {
        doc.autoTable({ startY: y, head: [head], body, theme: 'grid', margin: { left: M, right: M, top: 30 },
          styles: { fontSize: 9, cellPadding: 1.8, textColor: DARK, lineColor: [217, 224, 221] },
          headStyles: { fillColor: GREEN, textColor: 255 }, columnStyles: colStyles || {},
          didDrawPage: d => { if (d.pageNumber > 1 && d.cursor && d.cursor.y < 32) { /* header drawn below */ } } });
        y = doc.lastAutoTable.finalY + 8;
      };

      if (phase === 'in') {
        const items = r.inItems || {};
        for (const k of Object.keys(items)) {
          roomTitle(roomName(k, 'en'), `${items[k].length} items`);
          await photoRow(r.inPhotos[k] || [], 'Photos', 4);
          table(['Item', 'Qty', 'Condition', 'Note'], items[k].map(i => [i.name, String(i.qty), i.cond, i.note || '']), { 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 26 } });
        }
      } else {
        const ch = changes(r);
        roomTitle('Changes since check-in', `${ch.length} found`);
        if (ch.length) table(['Item', 'Room', 'Check-in', 'Check-out', 'Result'], ch.map(({ room, it, res }) => [it.name, roomName(room, 'en'), `${it.inQty} ${it.inCond}`, `${it.qty} ${it.cond}`, res.t + (it.note ? ` (${it.note})` : '')]));
        else { doc.setFontSize(10); doc.text('No changes. Everything is the same as at check-in.', M, y); y += 10; }
        for (const k of Object.keys(r.outItems || {})) {
          roomTitle(roomName(k, 'en'), `${r.outItems[k].length} items`);
          await photoRow(r.inPhotos[k] || [], 'Check-in', 3);
          await photoRow(r.outPhotos[k] || [], 'Check-out', 3);
          table(['Item', 'Check-in', 'Check-out', 'Result'], r.outItems[k].map(it => [it.name, `${it.inQty} ${it.inCond}`, `${it.qty} ${it.cond}`, result(it).t]), { 1: { cellWidth: 30 }, 2: { cellWidth: 30 }, 3: { cellWidth: 34 } });
        }
      }
      // signatures
      need(28); y += 10;
      doc.setDrawColor(...DARK); doc.line(M, y, M + 70, y); doc.line(W - M - 70, y, W - M, y);
      doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text('Manager', M, y + 5); doc.text('Tenant', W - M - 70, y + 5);
      // headers on pages added by autoTable + footers
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFillColor(...DARK); doc.rect(0, 0, W, 24, 'F');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('GW Realty', M, 11);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Villa Inventory · ${title}`, M, 17.5); doc.text(repNo, W - M, 11, { align: 'right' });
        }
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(`${v.name} · ${title} · Demo report`, M, 291);
        doc.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' });
      }
      const fname = `${v.name.replace(/[^A-Za-z0-9]+/g, '-')}-${phase === 'in' ? 'check-in' : 'check-out'}-${iso(new Date())}.pdf`;
      doc.save(fname);
      toast('PDF generated: ' + fname);
    } catch (e) {
      console.error(e);
      toast('The PDF could not be generated. Please try again.');
    } finally { done(); }
  }

  /* ---------- events ---------- */
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[type=file][data-room]')) { addPhotos(t); return; }
    if (t.dataset.ok) { outEdit(t, true); return; }
    if (t.dataset.k) { inEdit(t); return; }
    if (t.dataset.f) { const r = rec(location.hash.split('/')[3]); if (r) { r[t.dataset.f] = t.value; save(); } }
  });
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.k && t.tagName === 'INPUT') inEdit(t);
    else if (t.dataset.ok === 'note') outEdit(t, false);
    else if (t.dataset.f) { const r = rec(location.hash.split('/')[3]); if (r) { r[t.dataset.f] = t.value; save(); } }
  });
  function findItem(list, iid) { return (list || []).find(i => i.id === iid); }
  function inEdit(t) {
    const r = rec(location.hash.split('/')[3]); if (!r || r.status !== 'checkin_pending') return;
    const it = findItem(r.inItems[t.dataset.room], t.dataset.iid); if (!it) return;
    const k = t.dataset.k;
    it[k] = k === 'qty' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
    if (it.src === 'ai') { it.src = 'edited'; const b = app.querySelector(`[data-src="${it.id}"]`); if (b) { b.textContent = 'Edited'; b.className = 'src edited'; } }
    save();
  }
  function outEdit(t, rerender) {
    const r = rec(location.hash.split('/')[3]); if (!r || r.status !== 'checkout_pending') return;
    const it = findItem(r.outItems[t.dataset.room], t.dataset.iid); if (!it) return;
    const k = t.dataset.ok;
    it[k] = k === 'qty' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
    if (k !== 'note') { it.touched = true; if (it.unchecked && it.note === 'No check-out photo') it.note = ''; }
    save();
    if (rerender) render(true);
  }

  app.addEventListener('click', e => {
    const img = e.target.closest('img.zoom');
    if (img && img.src) { lightbox(img.src); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'role') { S.role = b.dataset.role; save(); go(S.role === 'mgr' ? '#/mgr' : '#/staff'); }
    else if (act === 'startIn') {
      const r = { id: uid(), villaId: b.dataset.v, tenant: '', checkIn: iso(today()), checkOut: '', status: 'in_draft', inPhotos: {}, inItems: null, outPhotos: {}, outItems: null, createdAt: Date.now() };
      S.records.push(r); save(); go(`#/${S.role === 'mgr' ? 'mgr' : 'staff'}/capture/${r.id}`);
    }
    else if (act === 'startOut') { const r = rec(b.dataset.r); r.status = 'out_draft'; r.outPhotos = {}; r.outItems = null; save(); go(`#/${S.role === 'mgr' ? 'mgr' : 'staff'}/capture/${r.id}`); }
    else if (act === 'rmPhoto') {
      const r = rec(location.hash.split('/')[3]); const phase = r.status === 'in_draft' ? 'in' : 'out';
      const l = r[phase + 'Photos'][b.dataset.room] || []; const i = l.indexOf(b.dataset.pid);
      if (i >= 0) { l.splice(i, 1); IDB.del(b.dataset.pid); PC.delete(b.dataset.pid); }
      save(); render(true);
    }
    else if (act === 'send') sendPhotos(rec(b.dataset.r));
    else if (act === 'delItem') {
      const r = rec(location.hash.split('/')[3]); const l = r.inItems[b.dataset.room];
      const i = l.findIndex(x => x.id === b.dataset.iid); if (i >= 0) l.splice(i, 1);
      save(); render(true);
    }
    else if (act === 'addItem') {
      const r = rec(location.hash.split('/')[3]); const it = { id: uid(), name: '', qty: 1, cond: 'Good', note: '', src: 'added', flag: '' };
      (r.inItems[b.dataset.room] = r.inItems[b.dataset.room] || []).push(it); save(); render(true);
      const inp = app.querySelector(`input[data-iid="${it.id}"][data-k="name"]`); if (inp) inp.focus();
    }
    else if (act === 'approveIn') {
      const r = rec(b.dataset.r); const err = document.getElementById('apErr'); const probs = [];
      if (!r.tenant || !r.tenant.trim()) probs.push('Add the tenant name.');
      if (!r.checkIn) probs.push('Add the check-in date.');
      if (!r.checkOut) probs.push('Add the check-out date.');
      if (r.checkIn && r.checkOut && r.checkOut <= r.checkIn) probs.push('The check-out date must be after the check-in date.');
      const blank = Object.values(r.inItems || {}).some(l => l.some(i => !i.name.trim()));
      if (blank) probs.push('Some items have no name. Fill them in or remove them.');
      if (!Object.values(r.inItems || {}).some(l => l.length)) probs.push('The list is empty.');
      if (probs.length) { err.hidden = false; err.textContent = probs.join(' '); return; }
      r.status = 'occupied'; r.inApprovedAt = Date.now(); save();
      toast('Check-in approved. Check-out reminders are scheduled.'); render();
    }
    else if (act === 'approveOut') {
      const r = rec(b.dataset.r); r.status = 'closed'; r.outApprovedAt = Date.now(); save();
      toast('Check-out approved. The villa is empty again.'); render();
    }
    else if (act === 'pdf') { if (!b.disabled) makePdf(rec(b.dataset.r), b.dataset.ph); }
    else if (act === 'addVilla') {
      const inp = document.getElementById('newVilla'); const name = inp.value.trim(); const err = document.getElementById('nvErr');
      if (!name) { err.hidden = false; err.textContent = 'Type the villa name first.'; return; }
      S.villas.push({ id: uid(), name, area: '' }); save(); toast(`${name} added.`); render();
    }
    else if (act === 'reset') {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Press again to reset everything'; return; }
      try { localStorage.removeItem(KEY); } catch (e2) { /* ignore */ }
      IDB.clear(); PC.clear(); S = seed(); S.role = 'mgr'; save(); toast('Demo reset.'); go('#/mgr');
    }
  });
  barEl.addEventListener('click', e => { if (e.target.closest('[data-act="switch"]')) go('#/login'); });

  load();
  render();
})();
