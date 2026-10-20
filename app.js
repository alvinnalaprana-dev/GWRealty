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
  const KEY = 'gwinv-demo-v6';
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
  const allRooms = () => ROOMS.concat(...((S && S.villas) || []).map(v => v.rooms || []));
  const roomName = (id, lang) => { const r = allRooms().find(x => x.id === id); return r ? (lang === 'id' ? r.id_ : r.en) : id; };
  const roomsFor = vid => { const v = (S.villas || []).find(x => x.id === vid); return ROOMS.concat((v && v.rooms) || []); };
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
      v: 6, role: null, user: null,
      users: [
        { id: 'u-mgr', name: 'Manager', email: 'manno.realtor@gmail.com', role: 'mgr' },
        { id: 'u-wayan', name: 'Wayan', email: 'wayan@gwrealtyglobal.com', role: 'staff' }
      ],
      villas: [
        { id: 'madya1', name: 'Villa Madya 1', area: '' },
        { id: 'bromo', name: 'Villa Bromo', area: 'Petitenget' },
        { id: 'sore', name: 'Villa Sore', area: 'Tumbak Bayuh' },
        { id: 'asmara', name: 'Villa Asmara', area: 'Tumbak Bayuh' }
      ],
      records: [{
        id: 'demo01', villaId: 'bromo', tenant: 'Demo Tenant', agreement: 'GWR-AG-2026-019', seeded: true,
        invDate: iso(addDays(t, -90)), checkIn: iso(addDays(t, -88)), checkOut: iso(addDays(t, 3)),
        status: 'occupied', inPhotos: {}, inItems: bromoItems, inApprovedAt: Date.now() - 88 * 864e5,
        outPhotos: {}, outItems: null, createdAt: Date.now() - 88 * 864e5
      }]
    };
  }
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 6) S = seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* demo still works in memory */ } }
  const L = () => (S.role === 'mgr' ? 'en' : 'id');
  const T = (id, en) => (L() === 'id' ? id : en);
  const villa = id => S.villas.find(v => v.id === id);
  const curUser = () => (S.users || []).find(u => u.id === S.user);
  const rec = id => S.records.find(r => r.id === id);
  const activeRec = vid => S.records.find(r => r.villaId === vid && r.status !== 'closed');

  /* ---------- n8n connection (live mode) ---------- */
  const API = window.GW_API || {};
  const LIVE = !!(API.base && API.key);
  const b64 = dataUrl => String(dataUrl).split(',')[1] || '';
  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(API.base.replace(/\/$/, '') + '/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'X-GW-Key': API.key }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return opts.blob ? res.blob() : res.json();
  }
  async function pushRecord(r) {
    if (!LIVE) return;
    r.photoFiles = r.photoFiles || {};
    const pending = [];
    for (const ph of ['in', 'out']) for (const [room, ids] of Object.entries(r[ph + 'Photos'] || {})) for (const id of ids) {
      if (r.photoFiles[id]) continue;
      const p = await getPhoto(id);
      if (p && !p.dark) pending.push({ id, phase: ph, room, data: b64(p.data) });
    }
    const send = async photos => {
      const rec = Object.assign({}, r, { villaName: (villa(r.villaId) || {}).name || '' });
      const res = await api('gw-save-record', { method: 'POST', body: { record: rec, photos } });
      if (res && res.photoFiles) { r.photoFiles = Object.assign(r.photoFiles, res.photoFiles); save(); }
    };
    if (!pending.length) { await send([]); return; }
    for (let i = 0; i < pending.length; i += 5) await send(pending.slice(i, i + 5));
  }
  async function pushSettings() {
    if (!LIVE) return;
    try { await api('gw-save-record', { method: 'POST', body: { record: { id: '_settings', status: 'settings', villas: S.villas, users: S.users }, photos: [] } }); }
    catch (e) { toast('Could not save settings to the server. Check the connection.'); }
  }
  let lastPull = 0, pulling = false;
  async function pullAll(force) {
    if (!LIVE || pulling || (!force && Date.now() - lastPull < 5000)) return false;
    pulling = true;
    try {
      const res = await api('gw-records');
      const recs = (res && res.records) || [];
      const st = recs.find(x => x.id === '_settings');
      if (st) { if (Array.isArray(st.villas) && st.villas.length) S.villas = st.villas; if (Array.isArray(st.users) && st.users.length) S.users = st.users; }
      else {
        // Fresh shared storage: seed it with this device's villas, users and sample lease.
        await pushSettings();
        for (const r of S.records) await pushRecord(r);
        lastPull = Date.now(); save(); return true;
      }
      const server = recs.filter(x => x.id !== '_settings');
      const local = S.records;
      S.records = server.map(sr => { const lr = local.find(x => x.id === sr.id); return lr && (lr.status === 'in_draft' || lr.status === 'out_draft') && sr.status !== 'checkin_pending' && sr.status !== 'checkout_pending' && sr.status !== 'closed' ? lr : sr; })
        .concat(local.filter(lr => !server.some(sr => sr.id === lr.id) && (lr.status === 'in_draft' || lr.status === 'out_draft')));
      lastPull = Date.now(); save();
      return true;
    } catch (e) { toast('Server not reachable. Showing data saved on this device.'); lastPull = Date.now(); return false; }
    finally { pulling = false; }
  }
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
  const INFLIGHT = new Map();
  function getPhoto(id) {
    if (PC.has(id)) return Promise.resolve(PC.get(id));
    if (!INFLIGHT.has(id)) INFLIGHT.set(id, loadPhoto(id).finally(() => INFLIGHT.delete(id)));
    return INFLIGHT.get(id);
  }
  async function loadPhoto(id) {
    let p = await IDB.get(id);
    if (!p && LIVE) {
      const r = S.records.find(x => x.photoFiles && x.photoFiles[id]);
      if (r) {
        try {
          const blob = await api('gw-photo?id=' + encodeURIComponent(r.photoFiles[id]), { blob: true });
          const data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
          const dim = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([4, 3]); im.src = data; });
          p = { data, w: dim[0], h: dim[1], dark: false, remote: true };
          IDB.put(id, p);
        } catch (e) { p = null; }
      }
    }
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
    const sc2 = document.createElement('canvas'); sc2.width = 24; sc2.height = 24; const x2 = sc2.getContext('2d'); x2.drawImage(c, 0, 0, 24, 24);
    const px = x2.getImageData(0, 0, 24, 24).data; let lum = 0; for (let i = 0; i < px.length; i += 4) lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    lum /= px.length / 4;
    return { data: c.toDataURL('image/jpeg', 0.72), w, h, lum: Math.round(lum), dark: lum < 55, old: !!(file.lastModified && Date.now() - file.lastModified > 864e5), size: file.size };
  }
  function labelTables() {
    app.querySelectorAll('table').forEach(t => {
      const first = t.querySelector('tr'); if (!first) return;
      const hs = Array.from(first.children).map(th => th.tagName === 'TH' ? th.textContent.trim() : '');
      t.querySelectorAll('tr').forEach(tr => Array.from(tr.children).forEach((td, i) => { if (td.tagName === 'TD' && hs[i] && !td.hasAttribute('colspan')) td.dataset.label = hs[i]; }));
    });
  }
  function hydrate() {
    labelTables();
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
    const u = curUser();
    const role = S.role === 'mgr' ? (u ? u.name : 'Manager') : S.role === 'staff' ? `Staf · ${u ? u.name : ''}` : '';
    barEl.innerHTML = `<div class="bar-in">
      <a class="brand" href="#/"><img src="logo-white.png" alt="GW Realty"><span>${S.role === 'mgr' ? 'Inventory' : 'Inventaris'}</span></a>
      <div class="bar-r"><span class="demo">${esc(API.label || (LIVE ? 'TEST' : 'DEMO'))}</span>${role ? `<span class="role">${esc(role)}</span><button class="linkbtn" data-act="switch">${S.role === 'mgr' ? 'Sign out' : 'Keluar'}</button>` : ''}</div>
    </div>`;
  }

  /* ---------- router ---------- */
  let viewToken = 0;
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function render(keepScroll) {
    const y = window.scrollY;
    viewToken++;
    const p = location.hash.replace(/^#\/?/, '').split('/');
    const u = curUser();
    if ((p[0] === 'staff' || p[0] === 'mgr') && (!u || u.role !== p[0])) { location.hash = '#/login'; return; }
    if (p[0] === 'staff') S.role = 'staff';
    if (p[0] === 'mgr') S.role = 'mgr';
    if (p[0] === '' && S.role) { go(S.role === 'mgr' ? '#/mgr' : '#/staff'); return; }
    renderBar();
    if (p[0] === 'staff' && p[1] === 'capture') viewCapture(p[2]);
    else if (p[0] === 'staff') { viewStaffHome(); pullAll().then(ch => { if (ch && location.hash.replace(/^#\/?/, '') === 'staff') render(true); }); }
    else if (p[0] === 'mgr' && p[1] === 'rec') viewRecord(p[2]);
    else if (p[0] === 'mgr' && p[1] === 'new') viewNew();
    else if (p[0] === 'mgr' && p[1] === 'team') viewTeam();
    else if (p[0] === 'mgr') { viewMgrHome(); pullAll().then(ch => { if (ch && location.hash.replace(/^#\/?/, '') === 'mgr') render(true); }); }
    else viewLogin();
    save();
    hydrate();
    if (keepScroll === true) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => render());

  /* ---------- login ---------- */
  function viewLogin() {
    S.role = null; S.user = null; renderBar();
    const mgr = S.users.filter(u => u.role === 'mgr'), staff = S.users.filter(u => u.role === 'staff');
    const btn = u => `<button data-act="login" data-u="${u.id}"><b>${esc(u.name)}</b><span>${esc(u.email)} · ${u.role === 'mgr' ? 'Manager: checks the AI list, approves, makes the PDF.' : 'Staff: takes photos at the villa (screens in Indonesian).'}</span></button>`;
    app.innerHTML = `<div class="login">
      <p class="eyebrow">GW Realty · Demo</p>
      <h1>Villa Inventory</h1>
      <p class="sub">Photos at check-in and check-out. AI makes the list, the manager approves, the system makes the report. Sign in to try it.</p>
      <div class="pick">${mgr.concat(staff).map(btn).join('')}</div>
      <p class="note">In the live system each person signs in with their email and password. The manager creates staff accounts on the Team page. ${LIVE ? 'This is a demo: AI results are simulated. Data is shared between devices, so staff can work on a phone and the manager on a laptop.' : 'This is a demo: AI results are simulated and all data stays in this browser.'}</p>
    </div>`;
  }

  /* ---------- team (manager creates accounts) ---------- */
  function viewTeam() {
    const rows = S.users.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${u.role === 'mgr' ? chip('ok', 'Manager') : chip('', 'Staff')}</td>
      <td style="text-align:right">${u.role === 'staff' ? `<button class="btn ghost sm" data-act="delUser" data-u="${u.id}">Remove</button>` : ''}</td></tr>`).join('');
    app.innerHTML = `<div class="page narrow">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">Accounts</p><h1>Team</h1></div></div>
      <p class="sub">One manager approves everything. Create an account for each staff member who takes photos.</p>
      <div class="tbl"><table class="vt"><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>${rows}</table></div>
      <div class="card">
        <h3>Create staff account</h3>
        <div class="form">
          <div class="fld"><label for="nuName">Name</label><input id="nuName" placeholder="e.g. Komang"></div>
          <div class="fld"><label for="nuEmail">Email</label><input id="nuEmail" type="email" placeholder="komang@gwrealtyglobal.com"></div>
        </div>
        <p class="err" id="nuErr" hidden></p>
        <button class="btn" data-act="addUser">Create account</button>
        <p class="note">In the live system the new staff member gets an email to set their password.</p>
      </div>
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
      <div class="head"><div><p class="eyebrow">Halo, ${esc((curUser() || {}).name || '')}</p><h1>Villa</h1></div></div>
      <p class="sub">Pilih villa untuk check-in atau check-out. Cukup ambil foto, daftar barang dibuat otomatis.</p>
      <div class="vlist">${cards}</div>
      <p class="note">${LIVE ? 'Demo: data tersambung ke manajer.' : 'Demo: data hanya tersimpan di browser ini.'}</p>
    </div>`;
  }

  /* ---------- capture (staff): photos per room, AI lists items, staff checks them ---------- */
  let confirmMissing = false;
  const BUSY = new Set();
  const CONDS_ID = { Good: 'Baik', Worn: 'Aus', Damaged: 'Rusak' };
  const ROOM_SUGGEST = [['Miscellaneous', 'Lain-lain'], ['Terrace', 'Teras'], ['Bathroom', 'Kamar mandi'], ['Pool area', 'Area kolam'], ['Garden', 'Taman']];
  const phaseOf = r => (r.status === 'in_draft' || r.status === 'checkin_pending' ? 'in' : 'out');
  const capRooms = (r, phase) => phase === 'in' ? roomsFor(r.villaId) : roomsFor(r.villaId).filter(x => (r.inItems || {})[x.id]);
  const goodPhotos = async ids => { const out = []; for (const id of ids || []) { const p = await getPhoto(id); if (p && !p.dark) out.push(id); } return out; };

  function staffInTable(r, k) {
    const list = r.inItems[k] || [];
    const rows = list.map(it => `<tr data-iid="${it.id}"><td><div class="nmw"><input class="nm" data-k="name" data-room="${k}" data-iid="${it.id}" value="${esc(it.name)}" placeholder="Nama barang" aria-label="Nama barang">${it.flag === 'small' ? '<span class="warnico" title="Barang kecil: cek jumlahnya">⚠</span>' : ''}</div></td>
      <td><input class="q" type="number" min="0" inputmode="numeric" data-k="qty" data-room="${k}" data-iid="${it.id}" value="${it.qty}" aria-label="Jumlah"></td>
      <td><select data-k="cond" data-room="${k}" data-iid="${it.id}" aria-label="Kondisi">${CONDS.map(c => `<option value="${c}"${c === it.cond ? ' selected' : ''}>${CONDS_ID[c]}</option>`).join('')}</select></td>
      <td><input data-k="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Catatan" aria-label="Catatan"></td>
      <td><span class="src ${it.src}" data-src="${it.id}">${it.src === 'ai' ? 'AI' : it.src === 'added' ? 'Ditambah' : 'Diubah'}</span></td>
      <td><button class="del" data-act="delItem" data-room="${k}" data-iid="${it.id}" aria-label="Hapus barang">✕</button></td></tr>`).join('');
    return `<div class="ailist"><p class="note"><b>Daftar dari AI: ${list.length} barang.</b> Cek nama, jumlah dan kondisi. Barang ⚠ kecil: hitung ulang.</p>
      <div style="overflow-x:auto"><table class="itbl"><tr><th>Barang</th><th>Jml</th><th>Kondisi</th><th>Catatan</th><th>Sumber</th><th></th></tr>${rows || '<tr><td colspan="6" class="note">Belum ada barang.</td></tr>'}</table></div>
      <button class="add" data-act="addItem" data-room="${k}">+ Tambah barang</button></div>`;
  }
  function staffOutTable(r, k) {
    const list = (r.outItems || {})[k] || [];
    const checked = list.length && !list[0].unchecked;
    if (!checked) return `<p class="note">${list.length} barang dari check-in. Ambil foto, AI akan mencocokkan.</p>`;
    const label = res => ({ ok: 'Sama', wr: 'Aus', rd: 'Rusak', gy: 'Belum difoto' }[res.k] || res.t);
    const row = it => { const res = result(it); return `<tr class="${isChange(res) ? 'chg' : ''}"><td><b>${esc(it.name)}</b>${it.note ? `<br><span class="note">${esc(it.note)}</span>` : ''}</td><td>${it.inQty} · ${CONDS_ID[it.inCond]}</td>
      <td><select data-ok="cond" data-room="${k}" data-iid="${it.id}" aria-label="Hasil check-out">${CONDS.map(c => `<option value="${c}"${c === it.cond ? ' selected' : ''}>${CONDS_ID[c]}</option>`).join('')}</select></td>
      <td>${chip(res.k, label(res))}</td></tr>`; };
    const head = '<tr><th>Barang</th><th>Check-in</th><th>Hasil</th><th></th></tr>';
    const ch = list.filter(it => isChange(result(it)));
    return `<div class="ailist"><p class="note"><b>AI: ${ch.length ? `${ch.length} perubahan` : 'tidak ada perubahan'}.</b> Pilih hasil untuk tiap barang: Baik, Aus atau Rusak.</p>
      ${ch.length ? `<div style="overflow-x:auto"><table class="itbl">${head}${ch.map(row).join('')}</table></div>` : ''}
      <details class="all"><summary>Lihat semua ${list.length} barang</summary><div style="overflow-x:auto"><table class="itbl">${head}${list.map(row).join('')}</table></div></details></div>`;
  }

  function viewCapture(id) {
    const r = rec(id);
    if (!r) { go('#/'); return; }
    const v = villa(r.villaId);
    const phase = phaseOf(r);
    const home = '#/staff';
    if (r.status !== 'in_draft' && r.status !== 'out_draft') {
      app.innerHTML = `<div class="page narrow"><a href="${home}">← Kembali</a><div class="card"><p>Sudah dikirim ke manajer.</p></div></div>`;
      return;
    }
    const photos = r[phase + 'Photos'] || (r[phase + 'Photos'] = {});
    const rooms = capRooms(r, phase).map(room => {
      const list = photos[room.id] || [];
      const busy = BUSY.has(`${r.id}:${phase}:${room.id}`);
      const ref = phase === 'out' ? (r.inPhotos[room.id] || []) : [];
      const refHtml = phase === 'out' ? `<div class="note">Foto check-in</div><div class="refstrip">${ref.length ? ref.map(pid => phImg(pid, 'Check-in')).join('') : phEmpty('contoh')}</div>` : '';
      const body = busy
        ? `<div class="aibusy"><div class="spin sm" aria-hidden="true"></div><span>AI sedang membaca foto ${esc(roomName(room.id, 'id'))}…</span></div>`
        : phase === 'in' ? ((r.inItems || {})[room.id] ? staffInTable(r, room.id) : `<button class="add" data-act="addItem" data-room="${room.id}">+ Tambah barang manual (tanpa foto)</button>`) : staffOutTable(r, room.id);
      return `<section class="room" id="room-${room.id}">
        <h3>${esc(roomName(room.id, 'id'))} ${list.length ? chip('ok', `${list.length} foto`) : chip('', 'belum ada foto')}</h3>
        ${refHtml}
        <div class="pick2">
          <label class="btn filebtn">📷 Ambil foto<input type="file" accept="image/*" capture="environment" data-room="${room.id}" aria-label="Ambil foto ${esc(roomName(room.id, 'id'))}"></label>
          <label class="btn ghost filebtn">Pilih dari galeri<input type="file" accept="image/*" multiple data-room="${room.id}" aria-label="Pilih dari galeri ${esc(roomName(room.id, 'id'))}"></label>
        </div>
        ${list.length ? `<div class="thumbs">${list.map(pid => `<div class="th">${phImg(pid, roomName(room.id, 'id'))}<span class="old" data-old="${pid}" hidden>Foto lama</span><span class="dark" data-dark="${pid}" hidden>Terlalu gelap</span><button class="x" data-act="rmPhoto" data-room="${room.id}" data-pid="${pid}" aria-label="Hapus foto">×</button></div>`).join('')}</div>` : ''}
        ${(r.aiNote || {})[phase + ':' + room.id] ? `<div class="banner rd">AI: ${esc(r.aiNote[phase + ':' + room.id])} Ambil ulang foto ruangan ini.</div>` : ''}
        <div class="banner rd" data-darkmsg="${room.id}" hidden>Foto terlalu gelap, AI tidak bisa membacanya. Nyalakan lampu atau buka tirai, lalu ambil ulang. Hapus foto yang gelap.</div>
        ${body}
      </section>`;
    }).join('');
    const total = count(photos);
    const dKey = phase === 'in' ? 'invDate' : 'outInvDate';
    app.innerHTML = `<div class="page narrow">
      <a href="${home}">← Kembali</a>
      <div class="head"><div><p class="eyebrow">${phase === 'in' ? 'Inventaris check-in' : 'Check-out'}</p><h1>${esc(v.name)}</h1></div></div>
      <div class="card"><div class="fld"><label for="f-inv">Tanggal inventaris</label><input id="f-inv" type="date" data-f="${dKey}" value="${esc(r[dKey] || '')}"></div>
        <p class="note">${phase === 'in' ? 'Boleh berbeda dengan tanggal check-in penyewa.' : 'Tanggal pengecekan saat check-out.'}</p></div>
      <p class="sub">Ambil foto setiap ruangan. AI langsung membuat daftar barang di ruangan itu, lalu kamu cek dan perbaiki sebelum dikirim ke manajer.</p>
      ${phase === 'out' ? `<div class="banner">Ambil foto dari sudut yang sama dengan foto check-in.</div>` : ''}
      <p class="note" id="busy" hidden></p>
      ${rooms}
      ${phase === 'in' ? `<div class="card addroom">
        <h3>Tambah ruangan atau barang lain-lain</h3>
        <div class="sugg">${ROOM_SUGGEST.filter(([en]) => !roomsFor(r.villaId).some(x => x.en === en)).map(([en, idn]) => `<button class="chipbtn" data-act="addRoom" data-v="${r.villaId}" data-name="${en}" data-name-id="${idn}">+ ${idn}</button>`).join('')}</div>
        <div class="row"><input id="newRoom" placeholder="Nama ruangan lain, mis. Kamar 4" aria-label="Nama ruangan"><button class="btn ghost" data-act="addRoom" data-v="${r.villaId}">+ Tambah</button></div>
        <p class="note">Ruangan baru tersimpan untuk villa ini dan muncul lagi di check-in dan check-out berikutnya.</p>
      </div>` : ''}
      <div class="sticky">
        <p class="err" id="sendErr" hidden></p>
        <button class="btn block" data-act="send" data-r="${r.id}">Kirim ke manajer (${total} foto)</button>
      </div>
    </div>`;
    confirmMissing = false;
    Object.entries(photos).forEach(([room, ids]) => ids.forEach(async pid => {
      const p = await getPhoto(pid); if (!p) return;
      if (p.old) { const el = app.querySelector(`[data-old="${pid}"]`); if (el) el.hidden = false; }
      if (p.dark) { const el = app.querySelector(`[data-dark="${pid}"]`); if (el) el.hidden = false; const m = app.querySelector(`[data-darkmsg="${room}"]`); if (m) m.hidden = false; }
    }));
  }

  async function addPhotos(input) {
    const r = rec(location.hash.split('/')[3]);
    if (!r) return;
    const phase = phaseOf(r);
    const room = input.dataset.room;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const busy = document.getElementById('busy');
    let oldN = 0, darkN = 0;
    for (let i = 0; i < files.length; i++) {
      if (busy) { busy.hidden = false; busy.textContent = `Memproses foto ${i + 1} dari ${files.length}…`; }
      try {
        const p = await compress(files[i]);
        if (p.old) oldN++;
        if (p.dark) darkN++;
        const id = uid();
        PC.set(id, p); await IDB.put(id, p);
        (r[phase + 'Photos'][room] = r[phase + 'Photos'][room] || []).push(id);
        save();
      } catch (e) { toast('Satu foto tidak bisa dibaca. Coba foto JPG atau PNG.'); }
    }
    if (darkN) toast(`${darkN} foto terlalu gelap. Ambil ulang dengan cahaya lebih terang.`);
    else if (oldN) toast(`${oldN} foto diambil lebih dari 24 jam lalu. Ditandai "Foto lama".`);
    const good = await goodPhotos(r[phase + 'Photos'][room]);
    const needAi = good.length && (phase === 'in' ? !(r.inItems || {})[room] : ((r.outItems || {})[room] || [{}])[0].unchecked);
    if (!needAi) { render(true); return; }
    const key = `${r.id}:${phase}:${room}`;
    BUSY.add(key); render(true);
    const sec = document.getElementById('room-' + room); if (sec) sec.scrollIntoView({ block: 'nearest' });
    const finish = msg => { BUSY.delete(key); save(); if (location.hash.endsWith('/capture/' + r.id)) { render(true); toast(msg); } };
    const okMsg = phase === 'in' ? `AI selesai: ${roomName(room, 'id')}. Cek daftarnya.` : `AI selesai mencocokkan ${roomName(room, 'id')}.`;
    if (!LIVE) { setTimeout(() => { if (phase === 'in') simInRoom(r, room); else simOutRoom(r, room); finish(okMsg); }, 1600); return; }
    try {
      const photosB64 = [];
      for (const pid of good.slice(-4)) { const p = await getPhoto(pid); if (p) photosB64.push(b64(p.data)); }
      const body = { phase, villa: villa(r.villaId).name, room: roomName(room, 'en'), photos: photosB64 };
      if (phase === 'in' && CAT[room]) body.expected = CAT[room];
      if (phase === 'out') body.checkin = r.outItems[room].map(i => ({ id: i.id, name: i.name, qty: i.inQty, cond: i.inCond }));
      const res = await api('gw-ai-room', { method: 'POST', body });
      if (!res || !res.ok) throw new Error((res && res.error) || 'AI error');
      r.aiNote = r.aiNote || {};
      if (res.quality === 'retake') r.aiNote[phase + ':' + room] = res.quality_note || 'Foto kurang jelas.'; else delete r.aiNote[phase + ':' + room];
      if (phase === 'in') {
        r.inItems[room] = (res.items || []).map(i => ({ id: uid(), name: i.name, qty: i.qty, cond: i.cond, note: i.note || '', src: 'ai', flag: i.small ? 'small' : '' }));
      } else {
        const list = r.outItems[room];
        (res.items || []).forEach(x => { const it = list.find(i => i.id === x.id); if (!it) return; it.unchecked = false;
          it.cond = x.cond; it.note = x.seen ? (x.note || '') : 'Not visible in photo';
          if (x.seen && x.qty < it.inQty) { it.cond = 'Damaged'; it.note = `${it.inQty - x.qty} missing${x.note ? '; ' + x.note : ''}`; } });
        list.forEach(it => { if (it.unchecked) { it.unchecked = false; it.note = 'Not visible in photo'; } });
        (res.extra || []).forEach(e => list.push({ id: uid(), name: e.name, inQty: 0, inCond: 'Good', inNote: '', qty: parseInt(e.qty, 10) || 1, cond: e.cond || 'Good', note: e.note || 'Not on check-in list', unchecked: false, touched: false }));
      }
      finish(res.quality === 'retake' ? 'AI: foto kurang jelas. Cek catatan di ruangan itu.' : okMsg);
    } catch (e) {
      if (phase === 'in') r.inItems[room] = r.inItems[room] || [];
      finish('AI tidak bisa dihubungi. Isi barang manual, atau tambah foto untuk mencoba lagi.');
    }
  }

  async function sendPhotos(r) {
    const phase = phaseOf(r);
    const photos = r[phase + 'Photos'];
    const err = document.getElementById('sendErr');
    const total = count(photos);
    if (!total) { err.hidden = false; err.textContent = 'Tambahkan minimal satu foto.'; return; }
    for (const ids of Object.values(photos)) { for (const pid of ids) { const p = await getPhoto(pid); if (p && p.dark) { err.hidden = false; err.textContent = 'Masih ada foto yang terlalu gelap. Hapus foto itu (tanda merah) atau ambil ulang dulu.'; return; } } }
    if (phase === 'in') {
      const blank = Object.values(r.inItems || {}).some(l => l.some(i => !i.name.trim()));
      if (blank) { err.hidden = false; err.textContent = 'Ada barang tanpa nama. Isi atau hapus.'; return; }
      if (!Object.values(r.inItems || {}).some(l => l.length)) { err.hidden = false; err.textContent = 'Daftar barang masih kosong. Tunggu AI selesai atau tambah barang.'; return; }
    }
    const missing = capRooms(r, phase).filter(x => !(photos[x.id] || []).length).map(x => roomName(x.id, 'id'));
    if (missing.length && !confirmMissing) {
      confirmMissing = true;
      err.hidden = false;
      err.textContent = `Belum ada foto: ${missing.join(', ')}. Tekan sekali lagi untuk tetap kirim.`;
      return;
    }
    const done = overlay(LIVE ? 'Mengunggah foto dan data…' : 'Mengirim ke manajer…');
    const prev = r.status;
    r.status = phase === 'in' ? 'checkin_pending' : 'checkout_pending';
    r[phase + 'SentAt'] = Date.now();
    try {
      if (LIVE) await pushRecord(r); else await new Promise(res => setTimeout(res, 1000));
    } catch (e) {
      r.status = prev; save(); done();
      err.hidden = false; err.textContent = 'Gagal mengirim. Cek koneksi internet, lalu tekan Kirim lagi.';
      return;
    }
    done();
    save();
    toast('Terkirim. Manajer tinggal memeriksa dan menyetujui.');
    go('#/staff');
  }

  /* ---------- manager home ---------- */
  function statusMgr(r) {
    if (!r) return { chip: chip('', 'Empty'), act: '' };
    switch (r.status) {
      case 'in_draft': return { chip: chip('', 'Staff checking inventory'), act: '' };
      case 'checkin_pending': return { chip: chip('am', 'Check-in to review'), act: `<a class="btn sm" href="#/mgr/rec/${r.id}">Review</a>` };
      case 'occupied': {
        const d = daysUntil(r.checkOut);
        const due = d <= 7 ? ' ' + chip('am', d < 0 ? 'Check-out overdue' : d === 0 ? 'Check-out today' : `Check-out in ${d} days`) : '';
        return { chip: chip('ok', 'Occupied') + due, act: `<a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a>` };
      }
      case 'out_draft': return { chip: chip('', 'Staff checking check-out'), act: '' };
      case 'checkout_pending': return { chip: chip('am', 'Check-out to review'), act: `<a class="btn sm" href="#/mgr/rec/${r.id}">Review</a>` };
    }
    return { chip: '', act: '' };
  }
  function remindersFor(r) {
    const co = parse(r.checkOut); if (!co) return [];
    return [7].map(n => { const d = addDays(co, -n); return { d: iso(d), n, sent: d <= today() }; });
  }
  function viewMgrHome() {
    const rows = S.villas.map(v => {
      const r = activeRec(v.id); const s = statusMgr(r);
      return `<tr><td><b>${esc(v.name)}</b>${v.area ? `<br><span class="note">${esc(v.area)}</span>` : ''}</td>
        <td>${r && r.tenant ? esc(r.tenant) : '—'}${r && r.agreement ? `<br><span class="note">${esc(r.agreement)}</span>` : ''}</td>
        <td class="num">${r && r.checkIn && r.status !== 'in_draft' && r.status !== 'checkin_pending' ? fmt(r.checkIn) : '—'}</td>
        <td class="num">${r && r.checkOut ? fmt(r.checkOut) : '—'}</td>
        <td>${s.chip}</td><td style="text-align:right">${s.act}</td></tr>`;
    }).join('');
    const upcoming = S.records.filter(r => (r.status === 'occupied' || r.status === 'out_draft') && r.checkOut).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
    const rem = upcoming.length ? upcoming.map(r => {
      const d = daysUntil(r.checkOut);
      const rs = remindersFor(r).map(x => `${fmt(x.d)} (7 days before${x.sent ? ', sent' : ''})`).join(' · ');
      return `<div class="tg"><b>⏰ ${esc(villa(r.villaId).name)}</b>Check-out ${fmt(r.checkOut)}${d >= 0 ? ` · in ${d} day${d === 1 ? '' : 's'}` : ' · overdue'}<br><small>Email to manager: ${rs}</small></div>`;
    }).join('') : '<p class="note">No upcoming check-outs.</p>';
    const closed = S.records.filter(r => r.status === 'closed').sort((a, b) => (b.outApprovedAt || 0) - (a.outApprovedAt || 0));
    const hist = closed.length ? `<div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Changes</th><th></th></tr>
      ${closed.map(r => { const c = changes(r).length; return `<tr><td><b>${esc(villa(r.villaId).name)}</b></td><td>${esc(r.tenant || '—')}</td><td class="num">${fmt(r.checkIn)}</td><td class="num">${fmt(r.checkOut)}</td><td>${c ? chip('am', `${c} change${c === 1 ? '' : 's'}`) : chip('ok', 'None')}</td>
      <td style="text-align:right"><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="in">Check-in PDF</button><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="out">Check-out PDF</button><a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a></div></td></tr>`; }).join('')}
      </table></div>` : '<p class="note">Completed check-outs will appear here.</p>';
    app.innerHTML = `<div class="page">
      <div class="head"><div><p class="eyebrow">GW Realty</p><h1>Villas</h1></div><div class="row"><a class="btn ghost" href="#/mgr/team">Team</a><a class="btn" href="#/mgr/new">+ Add villa</a></div></div>
      <div class="grid2">
        <div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Status</th><th></th></tr>${rows}</table></div>
        <div class="card"><h3>Check-out reminders</h3><div class="rem">${rem}</div><p class="note">In the live system an email goes to the manager 7 days before each check-out.</p></div>
      </div>
      <div class="card"><h3>Completed</h3>${hist}</div>
      <div class="row" style="justify-content:space-between">
        <p class="note">${LIVE ? 'Demo: data is shared with staff phones. Reset clears it for everyone and starts again with the sample villas.' : 'Demo: data stays in this browser. Reset to start again with the sample villas.'}</p>
        <button class="btn danger sm" data-act="reset">Reset demo</button>
      </div>
    </div>`;
  }

  function viewNew() {
    app.innerHTML = `<div class="page narrow">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">Setup</p><h1>Add a villa</h1></div></div>
      <p class="sub">Staff start each inventory on their phone at the villa. Rooms are added by staff during the first inventory.</p>
      <div class="card">
        <div class="fld"><label for="newVilla">Villa name</label><input id="newVilla" placeholder="e.g. Villa Matahari"></div>
        <p class="err" id="nvErr" hidden></p>
        <button class="btn" data-act="addVilla">Add villa</button>
      </div>
    </div>`;
  }

  /* ---------- simulated AI (per room) ---------- */
  function simInRoom(r, roomId) {
    r.inItems = r.inItems || {};
    if (!CAT[roomId]) { r.inItems[roomId] = [{ id: uid(), name: 'Item seen in photo', qty: 1, cond: 'Good', note: 'Demo: rename or remove', src: 'ai', flag: '' }]; return; }
    r.inItems[roomId] = CAT[roomId].filter(([n]) => !HIDDEN.has(n)).map(([name, qty]) => ({
      id: uid(), name, qty, cond: name === 'Wine glasses' ? 'Damaged' : 'Good', note: name === 'Wine glasses' ? '1 cracked' : '',
      src: 'ai', flag: SMALL.has(name) ? 'small' : ''
    }));
  }
  function initOut(r) {
    const out = {};
    Object.keys(r.inItems || {}).forEach(roomId => {
      out[roomId] = r.inItems[roomId].map(i => ({
        id: uid(), name: i.name, inQty: i.qty, inCond: i.cond, inNote: i.note || '',
        qty: i.qty, cond: i.cond, note: 'No check-out photo', unchecked: true, touched: false
      }));
    });
    r.outItems = out;
  }
  function simOutRoom(r, roomId) {
    const list = (r.outItems || {})[roomId]; if (!list) return;
    list.forEach(it => { it.unchecked = false; if (it.note === 'No check-out photo') it.note = ''; });
    const tweak = (room, name, fn) => { if (room !== roomId) return; const it = list.find(x => x.name === name); if (it) fn(it); };
    tweak('bed1', 'Pillows with cover', it => { it.cond = 'Damaged'; it.note = '1 pillow cover torn'; });
    tweak('bed1', 'Bed runner', it => { it.cond = 'Damaged'; it.note = 'Stain'; });
    tweak('bed2', 'White towels', it => { it.cond = 'Worn'; });
  }
  // Check-out result = the condition chosen at check-out (Good / Worn / Damaged). No "missing" status.
  function result(it) {
    if (it.unchecked && !it.touched) return { k: 'gy', t: 'Not photographed' };
    if (RANK[it.cond] > RANK[it.inCond]) return it.cond === 'Damaged' ? { k: 'rd', t: 'Damaged' } : { k: 'wr', t: 'Worn' };
    return { k: 'ok', t: it.cond === 'Good' ? 'Good' : it.cond + ' (as at check-in)' };
  }
  const isChange = res => res.k === 'wr' || res.k === 'rd';
  const fmtIDR = n => (n || n === 0) && n !== '' ? 'Rp ' + Number(n).toLocaleString('id-ID') : '';
  function changes(r) {
    const list = [];
    Object.keys(r.outItems || {}).forEach(room => r.outItems[room].forEach(it => {
      const res = result(it); if (isChange(res)) list.push({ room, it, res });
    }));
    return list;
  }

  /* ---------- record views ---------- */
  function viewRecord(id) {
    const r = rec(id);
    if (!r) { go('#/mgr'); return; }
    if (r.status === 'in_draft' || r.status === 'out_draft') { toast('Staff are still checking this villa.'); go('#/mgr'); return; }
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
    const roomIds = roomsFor(r.villaId).map(x => x.id).filter(k => items[k] || (r.inPhotos[k] || []).length);
    const nItems = Object.values(items).reduce((a, l) => a + l.length, 0);
    const nPh = count(r.inPhotos);
    const noPhotoRooms = roomsFor(r.villaId).filter(x => !(r.inPhotos[x.id] || []).length && !items[x.id]).map(x => x.en);
    const blocks = roomIds.map(k => {
      const list = items[k] || [];
      const rowsHtml = list.map(it => edit
        ? `<tr data-iid="${it.id}"><td><div class="nmw"><input class="nm" data-k="name" data-room="${k}" data-iid="${it.id}" value="${esc(it.name)}" aria-label="Item name">${it.flag === 'small' ? '<span class="warnico" title="Small item: please check the count">⚠</span>' : ''}</div></td>
            <td><input class="q" type="number" min="0" data-k="qty" data-room="${k}" data-iid="${it.id}" value="${it.qty}" aria-label="Quantity"></td>
            <td><select data-k="cond" data-room="${k}" data-iid="${it.id}" aria-label="Condition">${CONDS.map(c => `<option${c === it.cond ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td><input data-k="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note"></td>
            <td><span class="src ${it.src}" data-src="${it.id}">${it.src === 'ai' ? 'AI' : it.src === 'added' ? 'Added by staff' : 'Edited'}</span></td></tr>`
        : `<tr><td>${esc(it.name)}</td><td class="num">${it.qty}</td><td>${it.cond === 'Good' ? it.cond : chip(it.cond === 'Damaged' ? 'rd' : 'wr', it.cond)}</td><td class="note">${esc(it.note)}</td></tr>`).join('');
      return `<div class="rblock">
        <div class="ph">${photoCol(r.inPhotos[k], 'Check-in', 6)}</div>
        <div style="min-width:0;display:flex;flex-direction:column">
          <h3>${esc(roomName(k, 'en'))} ${chip('', `${list.length} items`)}</h3>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Note</th>${edit ? '<th>Source</th>' : ''}</tr>${rowsHtml || `<tr><td colspan="6" class="note">No items.</td></tr>`}</table></div>
        </div>
      </div>`;
    }).join('');
    const rem = remindersFor(r).map(x => `email on ${fmt(x.d)} (7 days before${x.sent ? ', sent' : ''})`).join(' · ');
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${edit ? 'Check-in review' : 'Check-in · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <div class="card"><div class="form">
        <div class="fld"><label for="f-villa">Villa</label><input id="f-villa" value="${esc(v.name)}" readonly></div>
        <div class="fld"><label for="f-ag">Agreement code</label><input id="f-ag" data-f="agreement" value="${esc(r.agreement)}" placeholder="e.g. GWR-AG-2026-031" autocomplete="off" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-tenant">Tenant name <span class="opt">optional</span></label><input id="f-tenant" data-f="tenant" value="${esc(r.tenant)}" placeholder="Tenant name" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-phone">Phone <span class="opt">optional</span></label><input id="f-phone" data-f="phone" value="${esc(r.phone)}" placeholder="+62…" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-email">Email <span class="opt">optional</span></label><input id="f-email" type="email" data-f="email" value="${esc(r.email)}" placeholder="tenant@email.com" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-idno">Passport / ID no. <span class="opt">optional</span></label><input id="f-idno" data-f="idNo" value="${esc(r.idNo)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-notes">Notes <span class="opt">optional</span></label><input id="f-notes" data-f="notes" value="${esc(r.notes)}" placeholder="e.g. deposit amount, agent" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-inv">Inventory date</label><input id="f-inv" type="date" data-f="invDate" value="${esc(r.invDate)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-in">Check-in date</label><input id="f-in" type="date" data-f="checkIn" value="${esc(r.checkIn)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-out">Check-out date</label><input id="f-out" type="date" data-f="checkOut" value="${esc(r.checkOut)}" ${edit ? '' : 'readonly'}></div>
      </div></div>
      ${edit ? `<p class="note">Type the agreement code exactly as it is on the signed agreement.</p>` : ''}
      ${edit ? `<div class="banner ai"><b>${nItems} items in ${roomIds.length} room${roomIds.length === 1 ? '' : 's'}, listed by AI from ${nPh} photo${nPh === 1 ? '' : 's'} and checked by staff.</b> Correct anything that is wrong, then approve. Items marked <span class="warnico">⚠</span> are small items.</div>` : ''}
      ${edit && noPhotoRooms.length ? `<div class="banner am">No photos for: ${esc(noPhotoRooms.join(', '))}.</div>` : ''}
      ${!edit && r.seeded ? `<div class="banner">Sample lease: this check-in was prepared as demo data, so it has no photos.</div>` : ''}
      ${blocks}
      <div class="actions">
        <div>${edit ? '<p class="note">Check the list, add the check-in and check-out dates (tenant details are optional), then approve.</p>' : `<p class="note">Approved. Check-out reminders: ${rem}</p>`}<p class="err" id="apErr" hidden></p></div>
        <div class="row">
          ${edit ? `<button class="btn" data-act="approveIn" data-r="${r.id}">✓ Approve check-in</button>` : ''}
          <button class="btn ${edit ? 'ghost' : ''}" data-act="pdf" data-r="${r.id}" data-ph="in" ${edit ? 'disabled title="Available after approval"' : ''}>📄 Generate PDF</button>
        </div>
      </div>
    </div>`;
  }

  function viewCheckOut(r) {
    const v = villa(r.villaId);
    const edit = r.status === 'checkout_pending';
    const costEdit = r.status === 'checkout_pending' || r.status === 'closed';
    const ch = changes(r);
    const unchecked = Object.keys(r.outItems || {}).filter(k => !(r.outPhotos[k] || []).length).map(k => roomName(k, 'en'));
    const nItems = Object.values(r.outItems || {}).reduce((a, l) => a + l.length, 0);
    const nPh = count(r.outPhotos);
    const condCell = (k, it) => edit ? `<select data-ok="cond" data-room="${k}" data-iid="${it.id}" aria-label="Check-out result">${CONDS.map(c => `<option${c === it.cond ? ' selected' : ''}>${c}</option>`).join('')}</select>` : it.cond;
    const noteCell = (k, it) => edit ? `<input data-ok="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note">` : `<span class="note">${esc(it.note)}</span>`;
    const costCell = (k, it) => costEdit ? `<input class="cost" inputmode="numeric" data-ok="cost" data-room="${k}" data-iid="${it.id}" value="${it.cost ? Number(it.cost).toLocaleString('id-ID') : ''}" placeholder="Optional" aria-label="Cost in rupiah">` : fmtIDR(it.cost);
    const total = ch.reduce((a, x) => a + (Number(x.it.cost) || 0), 0);
    const chRows = ch.length ? ch.map(({ room, it, res }) => `<tr class="chg"><td><b>${esc(it.name)}</b></td><td>${esc(roomName(room, 'en'))}</td><td>${it.inQty} · ${it.inCond}${it.inNote ? ` (${esc(it.inNote)})` : ''}</td><td>${condCell(room, it)}</td><td>${noteCell(room, it)}</td><td>${costCell(room, it)}</td></tr>`).join('')
      : `<tr><td colspan="6" class="note">No changes. Everything is in the same condition as at check-in.</td></tr>`;
    const blocks = Object.keys(r.outItems || {}).map(k => {
      const list = r.outItems[k];
      const nCh = list.filter(it => isChange(result(it))).length;
      return `<div class="rblock">
        <div style="display:flex;flex-direction:column;gap:8px">
          <span class="note">Check-in</span><div class="ph">${photoCol(r.inPhotos[k], 'Check-in', 2)}</div>
          <span class="note">Check-out</span><div class="ph">${photoCol(r.outPhotos[k], 'Check-out', 2)}</div>
        </div>
        <div style="min-width:0">
          <h3>${esc(roomName(k, 'en'))} ${chip('', `${list.length} items`)}</h3>
          <details class="all"><summary>Show all ${list.length} items</summary>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Check-in</th><th>Result</th></tr>
          ${list.map(it => { const res = result(it); return `<tr class="${isChange(res) ? 'chg' : ''}"><td>${esc(it.name)}</td><td>${it.inQty} · ${it.inCond}${it.inNote ? ` (${esc(it.inNote)})` : ''}</td><td>${condCell(k, it)}</td></tr>`; }).join('')}
          </table></div></details>
          <p class="note">${nCh ? `${nCh} change${nCh === 1 ? '' : 's'} in this room` : 'No changes in this room'}</p>
        </div>
      </div>`;
    }).join('');
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${edit ? 'Check-out review' : 'Check-out · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <p class="sub">Agreement <b>${esc(r.agreement || '—')}</b> · Tenant: <b>${esc(r.tenant || '—')}</b> · ${fmt(r.checkIn)} to ${fmt(r.checkOut)} · Check-out inventory ${fmt(r.outInvDate)}</p>
      ${edit ? `<div class="banner ai"><b>AI compared ${nPh} new photo${nPh === 1 ? '' : 's'} with the check-in list (${nItems} items) and staff checked the result.</b> ${ch.length} change${ch.length === 1 ? '' : 's'}. Correct if needed, then approve. Items already worn or damaged at check-in are not counted again.</div>` : ''}
      ${unchecked.length ? `<div class="banner am">No check-out photos for: ${esc(unchecked.join(', '))}. Those items are marked "Not photographed".</div>` : ''}
      <div class="card"><h3>Changes since check-in</h3>
        <div class="tbl"><table class="vt itbl"><tr><th>Item</th><th>Room</th><th>Check-in</th><th>Result</th><th>Note</th><th>Cost (IDR)</th></tr>${chRows}</table></div>
        ${ch.length ? `<p class="note"><b>Total cost: <span id="costTotal">${total ? fmtIDR(total) : '—'}</span></b>. Cost is optional: type it here, or leave it blank and write it on the printed PDF.${!edit ? ' You can still change it after approval; generate the PDF again afterwards.' : ''}</p>` : ''}
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
      const repNo = `${r.agreement || 'GWR-' + r.id.slice(0, 6).toUpperCase()}-${phase === 'in' ? 'IN' : 'OUT'}`;
      const title = phase === 'in' ? 'Check-in Report' : 'Check-out Report';
      const RED = [166, 16, 17], GREEN = RED, DARK = [33, 28, 28], MUTED = [110, 100, 100];
      let y;
      const drawHeader = () => {
        const L = window.GW_LOGO;
        if (L) { const h = 17, w = h * L.w / L.h; doc.addImage(L.data, 'PNG', M, 4, w, h); }
        else { doc.setTextColor(...RED); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('GW Realty', M, 14); }
        doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(title.toUpperCase(), W - M, 10, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text(`Villa Inventory · ${repNo}`, W - M, 15.5, { align: 'right' }); doc.text(`Generated ${fmt(iso(new Date()))}`, W - M, 20.5, { align: 'right' });
        doc.setDrawColor(...RED); doc.setLineWidth(0.6); doc.line(M, 24.5, W - M, 24.5); doc.setLineWidth(0.2);
        doc.setTextColor(...DARK);
      };
      const header = () => { drawHeader(); y = 32; };
      const need = h => { if (y + h > BOTTOM) { doc.addPage(); header(); } };
      header();
      // meta
      doc.setFontSize(10);
      const meta = [['Agreement', r.agreement || '-'], ['Villa', v.name], ['Tenant', r.tenant || '-'], ['Check-in', fmt(r.checkIn)], ['Check-out', fmt(r.checkOut)],
      ];
      const invD = phase === 'in' ? r.invDate : r.outInvDate, refD = phase === 'in' ? r.checkIn : r.checkOut;
      if (invD && invD !== refD) meta.push([phase === 'in' ? 'Inventory date' : 'Check-out inventory', fmt(invD)]);
      if (r.phone) meta.push(['Phone', r.phone]);
      if (r.email) meta.push(['Email', r.email]);
      if (r.idNo) meta.push(['ID no.', r.idNo]);
      meta.forEach((m, i) => {
        const x = i % 2 === 0 ? M : W / 2; const yy = y + Math.floor(i / 2) * 6;
        doc.setFont('helvetica', 'bold'); doc.text(`${m[0]}:`, x, yy); const lw = doc.getTextWidth(`${m[0]}:`); doc.setFont('helvetica', 'normal'); doc.text(String(m[1]), x + Math.max(24, lw + 3), yy);
      });
      y += Math.ceil(meta.length / 2) * 6 + 4;
      const photoRow = async (ids0, label, maxN) => {
        const ids = await goodPhotos(ids0);
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
      // check-in (left) vs check-out (right), up to 2 photos each, same row
      const photoPair = async (inIds0, outIds0) => {
        const inIds = await goodPhotos(inIds0), outIds = await goodPhotos(outIds0);
        const gap = 3, mid = 6, half = (W - 2 * M - mid) / 2, bw = (half - gap) / 2, bh = bw * 0.75;
        need(bh + 9);
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('Check-in', M, y); doc.text('Check-out', M + half + mid, y); doc.setTextColor(...DARK); y += 2;
        const draw = async (ids, x0) => {
          for (let i = 0; i < 2; i++) {
            const x = x0 + i * (bw + gap);
            doc.setFillColor(238, 242, 240); doc.rect(x, y, bw, bh, 'F');
            const p = ids[i] ? await getPhoto(ids[i]) : null;
            if (p) { const ratio = p.w / p.h; let dw = bw, dh = bw / ratio; if (dh > bh) { dh = bh; dw = bh * ratio; } doc.addImage(p.data, 'JPEG', x + (bw - dw) / 2, y + (bh - dh) / 2, dw, dh); }
            else if (i === 0) { doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text('No photo', x + bw / 2, y + bh / 2, { align: 'center' }); doc.setTextColor(...DARK); }
          }
        };
        await draw(inIds, M); await draw(outIds, M + half + mid);
        doc.setDrawColor(217, 224, 221); doc.line(M + half + mid / 2, y, M + half + mid / 2, y + bh);
        y += bh + 5;
      };
      const roomTitle = (name, extra) => {
        need(14);
        doc.setFillColor(250, 236, 236); doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(name, M + 3, y + 5.5);
        if (extra) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(extra, W - M - 3, y + 5.5, { align: 'right' }); doc.setTextColor(...DARK); }
        y += 12;
      };
      const table = (head, body, colStyles, foot) => {
        doc.autoTable({ startY: y, head: [head], body, foot: foot ? [foot] : undefined, showFoot: 'lastPage', theme: 'grid', margin: { left: M, right: M, top: 30 },
          footStyles: { fillColor: [250, 236, 236], textColor: DARK, fontStyle: 'bold' },
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
        if (ch.length) {
          const total = ch.reduce((a, x) => a + (Number(x.it.cost) || 0), 0);
          table(['Item', 'Room', 'Check-in', 'Result', 'Note', 'Cost (IDR)'],
            ch.map(({ room, it, res }) => [it.name, roomName(room, 'en'), `${it.inQty} ${it.inCond}`, res.t, it.note || '', it.cost ? Number(it.cost).toLocaleString('id-ID') : '']),
            { 5: { cellWidth: 30, halign: 'right', minCellHeight: 8 } },
            ['', '', '', '', 'Total', total ? total.toLocaleString('id-ID') : '']);
          doc.setFontSize(8); doc.setTextColor(...MUTED);
          doc.text('Cost of repair or compensation in rupiah. If blank, to be filled in by the owner or agent.', M, y - 4); doc.setTextColor(...DARK); y += 2;
        }
        else { doc.setFontSize(10); doc.text('No changes. Everything is in the same condition as at check-in.', M, y); y += 10; }
        for (const k of Object.keys(r.outItems || {})) {
          roomTitle(roomName(k, 'en'), `${r.outItems[k].length} items`);
          await photoPair(r.inPhotos[k] || [], r.outPhotos[k] || []);
          table(['Item', 'Check-in', 'Result'], r.outItems[k].map(it => [it.name, `${it.inQty} ${it.inCond}`, result(it).t]), { 1: { cellWidth: 34 }, 2: { cellWidth: 44 } });
        }
      }
      // tenant acknowledgement + signatures
      need(68); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Tenant acknowledgement', M, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const ack = phase === 'in'
        ? 'I confirm that I have checked the villa and that the items, quantities and conditions listed in this report are correct at check-in. I agree to return them in the same condition, except for normal wear.'
        : 'I confirm that I have reviewed this check-out report, including the comparison with the check-in report, and that the items, quantities and conditions listed are correct at check-out.';
      const lines = doc.splitTextToSize(ack, W - 2 * M); doc.text(lines, M, y); y += lines.length * 4.5 + 16;
      doc.setDrawColor(...DARK); doc.line(M, y, M + 75, y); doc.line(W - M - 75, y, W - M, y);
      doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text("Owner / Villa / Listing", M, y + 5); doc.text('Tenant', W - M - 75, y + 5);
      doc.text("Owner's Representative", M, y + 10);
      doc.text('Name:', M, y + 16); doc.text(`Name: ${r.tenant || ''}`, W - M - 75, y + 16);
      doc.text('Date:', M, y + 22); doc.text('Date:', W - M - 75, y + 22);
      doc.setTextColor(...DARK); y += 27;
      // headers on pages added by autoTable + footers
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, 26, 'F'); drawHeader();
        }
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(`${v.name} · ${title} · GW Realty`, M, 291);
        doc.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' });
      }
      const fname = `${r.agreement ? r.agreement + '-' : ''}${v.name.replace(/[^A-Za-z0-9]+/g, '-')}-${phase === 'in' ? 'check-in' : 'check-out'}-${iso(new Date())}.pdf`;
      doc.save(fname);
      toast('PDF generated: ' + fname);
      if (LIVE) api('gw-save-pdf', { method: 'POST', body: { fileName: fname, data: b64(doc.output('datauristring')) } })
        .then(() => toast('PDF saved to Google Drive.')).catch(() => toast('PDF downloaded, but saving to Google Drive failed.'));
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
    if (t.dataset.f) {
      const r = rec(location.hash.split('/')[3]); if (!r) return;
      r[t.dataset.f] = t.value; save();
      if (t.dataset.f === 'agreement') { r.agreement = t.value.trim().toUpperCase(); t.value = r.agreement; save(); }
    }
  });
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.k && t.tagName === 'INPUT') inEdit(t);
    else if (t.dataset.ok === 'note') outEdit(t, false);
    else if (t.dataset.f) { const r = rec(location.hash.split('/')[3]); if (r) { r[t.dataset.f] = t.value; save(); } }
  });
  function findItem(list, iid) { return (list || []).find(i => i.id === iid); }
  function inEdit(t) {
    const r = rec(location.hash.split('/')[3]); if (!r || (r.status !== 'checkin_pending' && r.status !== 'in_draft')) return;
    const it = findItem(r.inItems[t.dataset.room], t.dataset.iid); if (!it) return;
    const k = t.dataset.k;
    it[k] = k === 'qty' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
    if (it.src === 'ai') { it.src = 'edited'; const b = app.querySelector(`[data-src="${it.id}"]`); if (b) { b.textContent = 'Edited'; b.className = 'src edited'; } }
    save();
  }
  function outEdit(t, rerender) {
    const r = rec(location.hash.split('/')[3]); if (!r) return;
    const k = t.dataset.ok;
    const open = r.status === 'checkout_pending' || r.status === 'out_draft';
    if (!open && !(k === 'cost' && r.status === 'closed')) return;
    const it = findItem(r.outItems[t.dataset.room], t.dataset.iid); if (!it) return;
    if (k === 'cost') { const d = String(t.value).replace(/\D/g, ''); it.cost = d ? parseInt(d, 10) : ''; }
    else it[k] = k === 'qty' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
    if (k === 'cond') { it.touched = true; if (it.note === 'No check-out photo') it.note = ''; }
    save();
    if (k === 'cost') {
      if (r.status === 'closed') pushRecord(r).catch(() => {});
      t.value = it.cost ? Number(it.cost).toLocaleString('id-ID') : '';
      const tot = changes(r).reduce((a, x) => a + (Number(x.it.cost) || 0), 0);
      const el = document.getElementById('costTotal'); if (el) el.textContent = tot ? fmtIDR(tot) : '—';
      return;
    }
    if (rerender) render(true);
  }


  app.addEventListener('click', e => {
    const img = e.target.closest('img.zoom');
    if (img && img.src) { lightbox(img.src); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'login') { const u = S.users.find(x => x.id === b.dataset.u); if (!u) return; S.user = u.id; S.role = u.role; save(); go(u.role === 'mgr' ? '#/mgr' : '#/staff'); }
    else if (act === 'addUser') {
      const n = document.getElementById('nuName').value.trim(), em = document.getElementById('nuEmail').value.trim(), err = document.getElementById('nuErr');
      if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.hidden = false; err.textContent = 'Add a name and a valid email.'; return; }
      if (S.users.some(u => u.email.toLowerCase() === em.toLowerCase())) { err.hidden = false; err.textContent = 'An account with this email already exists.'; return; }
      S.users.push({ id: uid(), name: n, email: em, role: 'staff' }); save(); pushSettings(); toast(`Account created for ${n}.`); render();
    }
    else if (act === 'delUser') { S.users = S.users.filter(u => u.id !== b.dataset.u); save(); pushSettings(); render(true); }
    else if (act === 'addRoom') {
      const inp = document.getElementById('newRoom'); const name = b.dataset.name || (inp ? inp.value.trim() : '');
      if (!name) { toast(T('Ketik nama ruangan dulu.', 'Type the room name first.')); return; }
      const v = villa(b.dataset.v); v.rooms = v.rooms || [];
      if (roomsFor(v.id).some(x => x.en.toLowerCase() === name.toLowerCase())) { toast(T('Ruangan ini sudah ada.', 'This room already exists.')); return; }
      const room = { id: 'rm-' + uid(), en: name, id_: b.dataset.nameId || name }; v.rooms.push(room); pushSettings();
      if (b.dataset.r) { const r = rec(b.dataset.r); if (r && r.inItems) r.inItems[room.id] = []; }
      save(); toast(T(`${room.id_} ditambahkan. Ambil foto atau tambah barang.`, `${name} added.`)); render(true);
    }
    else if (act === 'startIn') {
      const r = { id: uid(), villaId: b.dataset.v, tenant: '', invDate: iso(today()), checkIn: '', checkOut: '', status: 'in_draft', inPhotos: {}, inItems: {}, outPhotos: {}, outItems: null, createdAt: Date.now() };
      S.records.push(r); save(); pushRecord(r).catch(() => {}); go(`#/${S.role === 'mgr' ? 'mgr' : 'staff'}/capture/${r.id}`);
    }
    else if (act === 'startOut') { const r = rec(b.dataset.r); r.status = 'out_draft'; r.outPhotos = {}; r.outInvDate = iso(today()); initOut(r); save(); pushRecord(r).catch(() => {}); go(`#/staff/capture/${r.id}`); }
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
      const r = rec(location.hash.split('/')[3]); r.inItems = r.inItems || {}; const it = { id: uid(), name: '', qty: 1, cond: 'Good', note: '', src: 'added', flag: '' };
      (r.inItems[b.dataset.room] = r.inItems[b.dataset.room] || []).push(it); save(); render(true);
      const inp = app.querySelector(`input[data-iid="${it.id}"][data-k="name"]`); if (inp) inp.focus();
    }
    else if (act === 'approveIn') {
      const r = rec(b.dataset.r); const err = document.getElementById('apErr'); const probs = [];
      if (!r.agreement) probs.push('Add the agreement code.');
      else if (S.records.some(x => x.id !== r.id && x.agreement === r.agreement && x.status !== 'closed')) probs.push(`Agreement ${r.agreement} is already used on another open lease. Check the code.`);
      if (!r.checkIn) probs.push('Add the check-in date.');
      if (!r.checkOut) probs.push('Add the check-out date.');
      if (r.checkIn && r.checkOut && r.checkOut <= r.checkIn) probs.push('The check-out date must be after the check-in date.');
      const blank = Object.values(r.inItems || {}).some(l => l.some(i => !i.name.trim()));
      if (blank) probs.push('Some items have no name. Fill them in or remove them.');
      if (!Object.values(r.inItems || {}).some(l => l.length)) probs.push('The list is empty.');
      if (probs.length) { err.hidden = false; err.textContent = probs.join(' '); return; }
      r.status = 'occupied'; r.inApprovedAt = Date.now(); save();
      toast('Check-in approved. Check-out reminder email is scheduled.'); render();
      pushRecord(r).catch(() => toast('Approved on this device, but saving to the server failed. Open the record again to retry.'));
    }
    else if (act === 'approveOut') {
      const r = rec(b.dataset.r); r.status = 'closed'; r.outApprovedAt = Date.now(); save();
      toast('Check-out approved. The villa is empty again.'); render();
      pushRecord(r).catch(() => toast('Approved on this device, but saving to the server failed.'));
    }
    else if (act === 'pdf') { if (!b.disabled) makePdf(rec(b.dataset.r), b.dataset.ph); }
    else if (act === 'addVilla') {
      const inp = document.getElementById('newVilla'); const name = inp.value.trim(); const err = document.getElementById('nvErr');
      if (!name) { err.hidden = false; err.textContent = 'Type the villa name first.'; return; }
      S.villas.push({ id: uid(), name, area: '' }); save(); pushSettings(); toast(`${name} added.`); render();
    }
    else if (act === 'reset') {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Press again to reset everything'; return; }
      (async () => {
        if (LIVE) { try { await api('gw-reset', { method: 'POST', body: {} }); } catch (e3) { toast('Could not reset the shared data. Check the connection.'); return; } }
        try { localStorage.removeItem(KEY); } catch (e2) { /* ignore */ }
        IDB.clear(); PC.clear(); S = seed(); S.role = 'mgr'; S.user = 'u-mgr'; save();
        if (LIVE) await pullAll(true);
        toast('Demo reset.'); go('#/mgr'); render(true);
      })();
    }
  });
  barEl.addEventListener('click', e => { if (e.target.closest('[data-act="switch"]')) { S.user = null; S.role = null; save(); go('#/login'); } });

  load();
  render();
  if (LIVE) pullAll(true).then(ch => { if (ch) render(true); });
  // Keep the villa lists fresh on both devices (only on the home screens, never while editing).
  if (LIVE) setInterval(() => {
    const h = location.hash.replace(/^#\/?/, '');
    if ((h === 'mgr' || h === 'staff') && document.visibilityState === 'visible') pullAll().then(ch => { if (ch && location.hash.replace(/^#\/?/, '') === h) render(true); });
  }, 8000);
})();
