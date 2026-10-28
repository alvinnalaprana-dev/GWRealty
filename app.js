/* GW Realty Inventory.
   Records are kept on the device (localStorage, photos in IndexedDB) and synced with the server:
   the n8n workflows on GW Realty's server (live system).
   Sign-in, permissions and overwrite protection are checked on the server. */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const barEl = document.getElementById('bar');
  const ROOMS = window.GW_ROOMS;
  const CAT = window.GW_CATALOG;
  const SMALL = new Set(window.GW_SMALL);
  const HIDDEN = new Set(window.GW_HIDDEN);
  // Live (n8n) keeps its own copy on the device, so demo data never leaks into the real records.
  const REAL = !!(window.GW_API && window.GW_API.base && window.GW_API.base !== '/api');
  const KEY = REAL ? 'gwinv-live-v1' : 'gwinv-demo-v7';
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
  const roomName = (id) => { const r = allRooms().find(x => x.id === id); return r ? r.en : id; };   // all screens are in English (22 Oct 2026)
  const roomsFor = vid => { const v = (S.villas || []).find(x => x.id === vid) || {}; const hide = v.hideRooms || []; return ROOMS.filter(x => hide.indexOf(x.id) < 0).concat(v.rooms || []); };
  const roomObj = id => allRooms().find(x => x.id === id);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const hasCost = c => c !== '' && c !== null && c !== undefined && !isNaN(Number(c));
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
      v: 7, role: null, user: null,
      users: [
        { id: 'u-mgr', name: 'Manager', email: 'manno.realtor@gmail.com', role: 'mgr', pw: 'fc3faa9bd06be49cc0cb0a59f8fdff6a3b35f3a8ddd82b4b4acc9dcb4f157868' },
        { id: 'u-wayan', name: 'Wayan', email: 'wayan@gwrealtyglobal.com', role: 'staff', pw: 'b9d5a90c1253cdffed78c96fe6235c6a1ed447013a57ad60c5907b1aa1b7fe2d' }
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
    if (!S || S.v !== 7) S = seed();
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { if (!saveWarned) { saveWarned = true; toast(T('Memori perangkat penuh: data belum tersimpan di perangkat. Kirim sekarang atau kosongkan memori.', 'This device could not store the data (storage full or blocked). Save to the server now.')); } return false; }
  }
  const L = () => 'en';
  const T = (id, en) => (L() === 'id' ? id : en);
  const villa = id => S.villas.find(v => v.id === id);
  const pwHash = async (email, pw) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email).toLowerCase().trim() + ':' + pw)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); };
  const curUser = () => (S.users || []).find(u => u.id === S.user);
  const rec = id => S.records.find(r => r.id === id);
  const activeRec = vid => S.records.find(r => r.villaId === vid && r.status !== 'closed' && r.status !== 'cancelled');
  // Inventory listing: a villa inventory without a tenant (kind 'inv'). It uses the check-in screens and ends 'closed' when approved.
  const isInv = r => !!r && r.kind === 'inv';

  /* ---------- n8n connection (live mode) ---------- */
  const API = window.GW_API || {};
  const LIVE = !!API.base;
  const b64 = dataUrl => String(dataUrl).split(',')[1] || '';
  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, API.key ? { 'X-GW-Key': API.key } : {}, S.token ? { 'X-GW-Token': S.token } : {}, opts.body ? { 'Content-Type': 'application/json' } : {});
    const res = await fetch(API.base.replace(/\/$/, '') + '/' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok) {
      let msg = ''; try { msg = (await res.json()).error || ''; } catch (e) { /* not json */ }
      const err = new Error(msg || 'HTTP ' + res.status); err.status = res.status;
      if (res.status === 401 && path !== 'gw-login' && S.user) { S.user = null; S.role = null; S.token = null; save(); toast('Please sign in again.'); go('#/login'); }
      throw err;
    }
    return opts.blob ? res.blob() : res.json();
  }
  // A save was refused because another device changed the record first: take the server copy.
  function onSaveError(r, e, msg) {
    if (e && e.status === 409) {
      S.records = S.records.filter(x => x.id !== r.id); save();
      toast(T('Data ini sudah diubah di perangkat lain. Menampilkan versi terbaru.', 'This record was changed on another device. Showing the latest version.'));
      pullAll(true).then(() => render(true));
      return;
    }
    if (e && e.status === 401) return;
    toast((e && e.status === 403 && e.message) ? e.message : msg);
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
      const rec = Object.assign({}, r, { villaName: (villa(r.villaId) || {}).name || '' }); delete rec._dirty;
      const res = await api('gw-save-record', { method: 'POST', body: { record: rec, photos } });
      if (res && res.photoFiles) r.photoFiles = Object.assign(r.photoFiles, res.photoFiles);
      if (res && res.updatedAt) r.updatedAt = res.updatedAt;
      save();
    };
    r._dirty = true; save();
    if (!pending.length) await send([]);
    else for (let i = 0; i < pending.length; i += 5) await send(pending.slice(i, i + 5));
    delete r._dirty; save();
  }
  async function pushSettings() {
    if (!LIVE) return;
    const users = (S.users || []).map(u => Object.assign({ id: u.id, name: u.name, email: u.email, role: u.role }, u.pwNew ? { pw: u.pwNew } : {}));
    try {
      const res = await api('gw-save-record', { method: 'POST', body: { record: { id: '_settings', status: 'settings', villas: S.villas, users, updatedAt: S.settingsAt || '' }, photos: [] } });
      if (res && res.updatedAt) S.settingsAt = res.updatedAt;
      (S.users || []).forEach(u => delete u.pwNew); save();
    } catch (e) {
      if (e.status === 409) { toast(T('Pengaturan diubah di perangkat lain. Memuat versi terbaru.', 'Settings were changed on another device. Loading the latest version; please repeat your change.')); pullAll(true).then(() => render(true)); }
      else if (e.status !== 401) toast(T('Gagal menyimpan ke server. Cek koneksi.', e.message && e.status === 400 ? e.message : 'Could not save settings to the server. Check the connection.'));
    }
  }
  let lastPull = 0, pulling = false;
  async function pullAll(force) {
    if (!LIVE || !S.token || pulling || (!force && Date.now() - lastPull < 5000)) return false;
    pulling = true;
    try {
      const res = await api('gw-records');
      const recs = (res && res.records) || [];
      const st = recs.find(x => x.id === '_settings');
      if (st) {
        S.settingsAt = st.updatedAt || '';
        if (Array.isArray(st.villas)) S.villas = st.villas;
        if (S.role === 'mgr' && Array.isArray(st.users) && st.users.length) S.users = st.users.map(u => { const old = (S.users || []).find(x => x.id === u.id); return old && old.pwNew ? Object.assign({}, u, { pwNew: old.pwNew }) : u; });
      } else if (S.role === 'mgr') {
        // Fresh storage: the manager seeds it. Real system: GW Realty's villas and only the manager's own account, no sample leases.
        if (REAL) { S.records = []; S.villas = JSON.parse(JSON.stringify(window.GW_REAL_VILLAS || [])); S.users = (S.users || []).filter(u => u.id === S.user); }
        S.settingsAt = '';
        await pushSettings();
        for (const r of S.records) { delete r.updatedAt; await pushRecord(r).catch(() => {}); }
        lastPull = Date.now(); save(); return true;
      }
      const server = recs.filter(x => x.id !== '_settings');
      const local = S.records;
      const keepLocal = (lr, sr) => lr && (lr._dirty || ((lr.status === 'in_draft' || lr.status === 'out_draft') && sr.status === lr.status));
      S.records = server.map(sr => { const lr = local.find(x => x.id === sr.id); if (!keepLocal(lr, sr)) return sr; if (!lr._dirty) lr.updatedAt = sr.updatedAt; return lr; })
        .concat(local.filter(lr => !server.some(sr => sr.id === lr.id) && (lr._dirty || lr.status === 'in_draft' || lr.status === 'out_draft')));
      lastPull = Date.now(); save();
      return true;
    } catch (e) { if (e.status !== 401) toast(T('Server tidak dapat dihubungi. Menampilkan data yang tersimpan di perangkat ini.', 'Server not reachable. Showing data saved on this device.')); lastPull = Date.now(); return false; }
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
    put(id, v) { return this.tx('readwrite', s => s.put(v, id)); },
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
          IDB.put(id, p).catch(() => {});
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
    const o = document.createElement('div'); o.className = 'overlay'; o.setAttribute('role', 'status'); o.setAttribute('aria-live', 'polite');
    o.innerHTML = `<div class="card"><div class="spin"></div><p>${esc(msg)}</p></div>`;
    document.body.appendChild(o); return () => o.remove();
  }
  function lightbox(src) {
    const o = document.createElement('div'); o.className = 'overlay lb';
    const im = document.createElement('img'); im.alt = 'Photo'; if (/^(data:image\/|blob:|https:)/.test(src)) im.src = src; o.appendChild(im);
    o.addEventListener('click', () => o.remove());
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { o.remove(); document.removeEventListener('keydown', k); } });
    document.body.appendChild(o);
  }
  const EYE = id => `<button type="button" class="eye" data-act="eye" data-for="${id}" aria-label="Show password" title="Show password"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>`;
  const chip = (cls, txt) => `<span class="chip ${cls}">${esc(txt)}</span>`;
  const phImg = (pid, alt) => `<img data-pid="${esc(pid)}" alt="${esc(alt)}" class="zoom">`;
  const phEmpty = label => `<div class="ph-empty"><span>${esc(label)}</span></div>`;

  function renderBar() {
    const u = curUser();
    const role = S.role === 'mgr' ? (u ? u.name : 'Manager') : S.role === 'staff' ? `Staff · ${u ? u.name : ''}` : '';
    barEl.innerHTML = `<div class="bar-in">
      <a class="brand" href="#/"><img src="logo-white.png" alt="GW Realty"><span>Inventory</span></a>
      <div class="bar-r">${API.label ? `<span class="demo">${esc(API.label)}</span>` : ''}${role ? `<span class="role">${esc(role)}</span><button class="linkbtn" data-act="switch">Sign out</button>` : ''}</div>
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
    if ((p[0] === 'staff' || p[0] === 'mgr') && (!u || u.role !== p[0])) { location.hash = u ? '#/' + u.role : '#/login'; return; }
    if (p[0] === 'staff') S.role = 'staff';
    if (p[0] === 'mgr') S.role = 'mgr';
    if (p[0] === '' && S.role) { go(S.role === 'mgr' ? '#/mgr' : '#/staff'); return; }
    document.documentElement.lang = 'en';
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
    S.role = null; S.user = null; S.token = null; document.documentElement.lang = 'en'; renderBar();
    const demo = !LIVE;
    app.innerHTML = `<div class="login">
      <p class="eyebrow">GW Realty</p>
      <h1>Villa Inventory</h1>
      <p class="sub">Sign in with the email and password your manager gave you.</p>
      <form class="card" id="loginForm" autocomplete="on">
        <div class="fld"><label for="lgEmail">Email</label><input id="lgEmail" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="lgPw">Password</label><div class="pwwrap"><input id="lgPw" type="password" autocomplete="current-password" required>${EYE('lgPw')}</div></div>
        <p class="err" role="alert" id="lgErr" hidden></p>
        <button class="btn block" type="submit">Sign in</button>
      </form>
      ${demo ? `<div class="card"><h3>Demo accounts</h3>
        <p class="note"><b>Manager</b> (laptop): manno.realtor@gmail.com · password <b>gwrealty2026</b><br><b>Staff</b> (phone): wayan@gwrealtyglobal.com · password <b>wayan2026</b></p>
        <p class="note">AI results are simulated in the demo.${LIVE ? ' Data is shared between devices.' : ' Data stays in this browser.'}</p></div>` : ''}
      <p class="note"><a href="privacy.html">Privacy policy</a></p>
    </div>`;
  }

  /* ---------- team (manager creates accounts) ---------- */
  function viewTeam() {
    const rows = S.users.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${u.role === 'mgr' ? chip('ok', 'Manager') : chip('', 'Staff')}</td>
      <td style="text-align:right">${u.id !== S.user ? `<button class="btn ghost sm" data-act="delUser" data-u="${u.id}">Remove</button>` : '<span class="note">You</span>'}</td></tr>`).join('');
    app.innerHTML = `<div class="page narrow">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">Accounts</p><h1>Team</h1></div></div>
      <p class="sub">Managers add villas, review every inventory and manage accounts. Staff only do the inventory on their phone. Create an account for each person and tell them their password. Keep a second manager account (e.g. a backup) so a forgotten manager password can always be reset here.</p>
      <div class="tbl"><table class="vt"><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>${rows}</table></div>
      <div class="card">
        <h3>Create an account</h3>
        <div class="form">
          <div class="fld"><label for="nuName">Name</label><input id="nuName" placeholder="e.g. Komang"></div>
          <div class="fld"><label for="nuEmail">Email</label><input id="nuEmail" type="email" placeholder="komang@gwrealtyglobal.com"></div>
          <div class="fld"><label for="nuPw">Password</label><div class="pwwrap"><input id="nuPw" type="password" autocomplete="new-password" placeholder="At least 8 characters">${EYE('nuPw')}</div></div>
          <div class="fld"><label for="nuRole">Role</label><select id="nuRole"><option value="staff">Staff (inventory on phone)</option><option value="mgr">Manager (review, villas, accounts)</option></select></div>
        </div>
        <p class="err" role="alert" id="nuErr" hidden></p>
        <button class="btn" data-act="addUser">Create account</button>
      </div>
      <div class="card">
        <h3>Change a password</h3>
        <div class="form">
          <div class="fld"><label for="cpUser">Account</label><select id="cpUser">${S.users.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)})</option>`).join('')}</select></div>
          <div class="fld"><label for="cpPw">New password</label><div class="pwwrap"><input id="cpPw" type="password" autocomplete="new-password" placeholder="At least 8 characters">${EYE('cpPw')}</div></div>
        </div>
        <p class="err" role="alert" id="cpErr" hidden></p>
        <button class="btn ghost" data-act="setPw">Save new password</button>
        <p class="note">Use this when staff forget their password, or to change the manager's own password.</p>
      </div>
    </div>`;
  }

  /* ---------- staff home ---------- */
  function viewStaffHome() {
    const cards = S.villas.map(v => {
      const r = activeRec(v.id);
      let status, info = '', btn = '';
      if (!r) { status = chip('', 'Empty'); info = 'Ready for inventory or check-in'; btn = `<div class="row2"><button class="btn block ghost" data-act="startInv" data-v="${v.id}">Start inventory</button><button class="btn block" data-act="startIn" data-v="${v.id}">Start check-in</button></div>`; }
      else if (r.status === 'in_draft') { const w = isInv(r) ? 'inventory' : 'check-in'; status = chip('am', `${isInv(r) ? 'Inventory' : 'Check-in'} photos not sent yet`); btn = `<a class="btn block" href="#/staff/capture/${r.id}">Continue ${w}</a>`; }
      else if (r.status === 'checkin_pending') { status = chip('am', 'Waiting for manager approval'); info = isInv(r) ? 'Inventory photos sent' : 'Check-in photos sent'; }
      else if (r.status === 'occupied') {
        const d = daysUntil(r.checkOut);
        status = chip('ok', 'Occupied');
        info = `Tenant: ${esc(r.tenant || '—')} · check-out ${fmt(r.checkOut)}`;
        if (d <= 7) status += ' ' + chip('am', d < 0 ? 'Check-out overdue' : d === 0 ? 'Check-out today' : `Check-out in ${d} day${d === 1 ? '' : 's'}`);
        btn = `<button class="btn block ${d <= 7 ? '' : 'ghost'}" data-act="startOut" data-r="${r.id}">Start check-out</button>`;
      }
      else if (r.status === 'out_draft') { status = chip('am', 'Check-out photos not sent yet'); btn = `<a class="btn block" href="#/staff/capture/${r.id}">Continue check-out</a>`; }
      else if (r.status === 'checkout_pending') { status = chip('am', 'Waiting for manager approval'); info = 'Check-out photos sent'; }
      return `<div class="villa"><div class="top"><b>${esc(v.name)}</b><span>${status}</span></div>${info ? `<small>${info}</small>` : ''}${btn}</div>`;
    }).join('');
    app.innerHTML = `<div class="page narrow">
      <div class="head"><div><p class="eyebrow">Hello, ${esc((curUser() || {}).name || '')}</p><h1>Villas</h1></div></div>
      <p class="sub">Choose a villa for an inventory, check-in or check-out. Just take photos; the item list is made automatically.</p>
      <div class="vlist">${cards}</div>
      ${REAL ? '' : `<p class="note">${LIVE ? 'Demo: data is shared with the manager.' : 'Demo: data stays in this browser.'}</p>`}
    </div>`;
  }

  /* ---------- capture (staff): photos per room, AI lists items, staff checks them ---------- */
  let confirmMissing = false;
  const BUSY = new Set();
  const CONDS_ID = { Good: 'Good', Worn: 'Worn', Damaged: 'Damaged' };
  const ROOM_SUGGEST = [['Miscellaneous', 'Miscellaneous'], ['Terrace', 'Terrace'], ['Bathroom', 'Bathroom'], ['Pool area', 'Pool area'], ['Garden', 'Garden']];
  const phaseOf = r => (r.status === 'in_draft' || r.status === 'checkin_pending' ? 'in' : 'out');
  const capRooms = (r, phase) => phase === 'in' ? roomsFor(r.villaId) : roomsFor(r.villaId).filter(x => (r.inItems || {})[x.id]);
  const goodPhotos = async ids => { const out = []; for (const id of ids || []) { const p = await getPhoto(id); if (p && !p.dark) out.push(id); } return out; };

  function staffInTable(r, k) {
    const list = r.inItems[k] || [];
    const rows = list.map(it => `<tr data-iid="${it.id}"><td><div class="nmw"><input class="nm" data-k="name" data-room="${k}" data-iid="${it.id}" value="${esc(it.name)}" placeholder="Item name" aria-label="Item name">${it.flag === 'small' ? '<span class="warnico" title="Small item: check the count">⚠</span>' : ''}</div></td>
      <td><input class="q" type="number" min="0" inputmode="numeric" data-k="qty" data-room="${k}" data-iid="${it.id}" value="${it.qty}" aria-label="Quantity"></td>
      <td><select data-k="cond" data-room="${k}" data-iid="${it.id}" aria-label="Condition">${CONDS.map(c => `<option value="${c}"${c === it.cond ? ' selected' : ''}>${CONDS_ID[c]}</option>`).join('')}</select></td>
      <td><input data-k="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note"></td>
      <td><span class="src ${it.src}" data-src="${it.id}">${it.src === 'ai' ? 'AI' : it.src === 'added' ? 'Added' : 'Edited'}</span></td>
      <td><button class="del" data-act="delItem" data-room="${k}" data-iid="${it.id}" aria-label="Remove item">✕</button></td></tr>`).join('');
    return `<div class="ailist"><p class="note"><b>AI list: ${list.length} item${list.length === 1 ? '' : 's'}.</b> Check names, quantities and condition. ⚠ = small item: count again.</p>
      <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Note</th><th>Source</th><th></th></tr>${rows || '<tr><td colspan="6" class="note">No items yet.</td></tr>'}</table></div>
      <button class="add" data-act="addItem" data-room="${k}">+ Add item</button></div>`;
  }
  function staffOutTable(r, k) {
    const list = (r.outItems || {})[k] || [];
    const checked = list.length && !list[0].unchecked;
    if (!checked) return `<p class="note">${list.length} items from check-in. Take photos and the AI will compare them.</p>`;
    const label = res => ({ ok: 'Same', wr: 'Worn', rd: 'Damaged', gy: 'Not photographed' }[res.k] || res.t);
    const others = capRooms(r, 'out').filter(x => x.id !== k);
    const row = it => { const res = result(it); return `<tr class="${isChange(res) ? 'chg' : ''}"><td><b>${esc(it.name)}</b>${it.note ? `<br><span class="note">${esc(it.note)}</span>` : ''}</td><td>${it.inQty > 0 ? `${it.inQty} · ${CONDS_ID[it.inCond]}` : 'Not at check-in'}</td>
      <td><select data-ok="cond" data-room="${k}" data-iid="${it.id}" aria-label="Check-out result">${CONDS.map(c => `<option value="${c}"${c === it.cond ? ' selected' : ''}>${CONDS_ID[c]}</option>`).join('')}</select>
      <select class="mvsel" data-ok="movedTo" data-room="${k}" data-iid="${it.id}" aria-label="Item location"><option value="">In this room</option>${others.map(o => `<option value="${o.id}"${it.movedTo === o.id ? ' selected' : ''}>Moved to ${esc(o.en)}</option>`).join('')}</select></td>
      <td>${chip(res.k, res.k === 'mv' ? `Moved to ${roomName(it.movedTo)}` : label(res))}</td></tr>`; };
    const head = '<tr><th>Item</th><th>Check-in</th><th>Result / location</th><th></th></tr>';
    const ch = list.filter(it => isChange(result(it)));
    return `<div class="ailist"><p class="note"><b>AI: ${ch.length ? `${ch.length} change${ch.length === 1 ? '' : 's'}` : 'no changes'}.</b> Choose a result for each item: Good, Worn or Damaged. If an item was moved to another room (e.g. the sofa bed is in Bedroom 3), choose "Moved to" and photograph it in that room.</p>
      ${ch.length ? `<div style="overflow-x:auto"><table class="itbl">${head}${ch.map(row).join('')}</table></div>` : ''}
      <details class="all"><summary>Show all ${list.length} items</summary><div style="overflow-x:auto"><table class="itbl">${head}${list.map(row).join('')}</table></div></details></div>`;
  }

  function viewCapture(id) {
    const r = rec(id);
    if (!r) { go('#/'); return; }
    const v = villa(r.villaId);
    const phase = phaseOf(r);
    const home = '#/staff';
    if (r.status !== 'in_draft' && r.status !== 'out_draft') {
      app.innerHTML = `<div class="page narrow"><a href="${home}">← Back</a><div class="card"><p>Already sent to the manager.</p></div></div>`;
      return;
    }
    const photos = r[phase + 'Photos'] || (r[phase + 'Photos'] = {});
    const rooms = capRooms(r, phase).map(room => {
      const list = photos[room.id] || [];
      const busy = BUSY.has(`${r.id}:${phase}:${room.id}`);
      const ref = phase === 'out' ? (r.inPhotos[room.id] || []) : [];
      const refHtml = phase === 'out' ? `<div class="note">Check-in photos</div><div class="refstrip">${ref.length ? ref.map(pid => phImg(pid, 'Check-in')).join('') : phEmpty('none')}</div>` : '';
      const body = busy
        ? `<div class="aibusy"><div class="spin sm" aria-hidden="true"></div><span>AI is reading the ${esc(roomName(room.id))} photos…</span></div>`
        : phase === 'in' ? ((r.inItems || {})[room.id] ? staffInTable(r, room.id) : `<button class="add" data-act="addItem" data-room="${room.id}">+ Add items by hand (no photo)</button>`) : staffOutTable(r, room.id);
      return `<section class="room" id="room-${room.id}">
        <div class="roomhead"><h3>${esc(roomName(room.id))} ${list.length ? chip('ok', `${list.length} photo${list.length === 1 ? '' : 's'}`) : chip('', 'no photo yet')}</h3>${phase === 'in' ? `<button class="linkbtn rmroom" data-act="hideRoom" data-v="${r.villaId}" data-room="${room.id}">Remove room</button>` : ''}</div>
        ${refHtml}
        <div class="pick2">
          <label class="btn filebtn">📷 Take photo<input type="file" accept="image/*" capture="environment" data-room="${room.id}" aria-label="Take photo ${esc(roomName(room.id))}"></label>
          <label class="btn ghost filebtn">Choose from gallery<input type="file" accept="image/*" multiple data-room="${room.id}" aria-label="Choose from gallery ${esc(roomName(room.id))}"></label>
        </div>
        ${list.length ? `<div class="thumbs">${list.map(pid => `<div class="th">${phImg(pid, roomName(room.id, 'id'))}<span class="old" data-old="${pid}" hidden>Old photo</span><span class="dark" data-dark="${pid}" hidden>Too dark</span><button class="x" data-act="rmPhoto" data-room="${room.id}" data-pid="${pid}" aria-label="Remove photo">×</button></div>`).join('')}</div>` : ''}
        ${(r.aiNote || {})[phase + ':' + room.id] ? `<div class="banner rd">AI: ${esc(r.aiNote[phase + ':' + room.id])} Retake the photos of this room.</div>` : ''}
        ${!busy && ((r.aiState || {})[phase + ':' + room.id] === 'fail' || (r.aiState || {})[phase + ':' + room.id] === 'retake') && list.length ? `<button class="btn ghost sm" data-act="retryAi" data-room="${room.id}">↻ Try AI again</button>` : ''}
        ${''}
        <div class="banner rd" data-darkmsg="${room.id}" hidden>Photo too dark for the AI. Turn on the lights or open the curtains, then retake. Remove the dark photo.</div>
        ${body}
      </section>`;
    }).join('');
    const total = count(photos);
    const dKey = phase === 'in' ? 'invDate' : 'outInvDate';
    app.innerHTML = `<div class="page narrow">
      <a href="${home}">← Back</a>
      <div class="head"><div><p class="eyebrow">${isInv(r) ? 'Inventory' : phase === 'in' ? 'Check-in inventory' : 'Check-out'}</p><h1>${esc(v.name)}</h1></div></div>
      <div class="card"><div class="fld"><label for="f-inv">Inventory date</label><input id="f-inv" type="date" data-f="${dKey}" value="${esc(r[dKey] || '')}"></div>
        <p class="note">${isInv(r) ? 'The date of this inventory.' : phase === 'in' ? 'Can differ from the tenant\'s check-in date.' : 'The date of the check-out inspection.'}</p></div>
      <p class="sub">Photograph every room. The AI lists the items in each room; check and correct the list before sending it to the manager.</p>
      ${phase === 'out' ? `<div class="banner">Take the photos from the same angles as the check-in photos.</div>` : ''}
      <p class="note" id="busy" aria-live="polite" hidden></p>
      ${rooms}
      ${phase === 'in' ? `<div class="card addroom">
        <h3>Add a room or miscellaneous items</h3>
        <div class="sugg">${ROOM_SUGGEST.filter(([en]) => !roomsFor(r.villaId).some(x => x.en === en)).map(([en, idn]) => `<button class="chipbtn" data-act="addRoom" data-v="${r.villaId}" data-name="${en}" data-name-id="${idn}">+ ${idn}</button>`).join('')}</div>
        <div class="row"><input id="newRoom" placeholder="Other room name, e.g. Bedroom 4" aria-label="Room name"><button class="btn ghost" data-act="addRoom" data-v="${r.villaId}">+ Add</button></div>
        <p class="note">New rooms are saved for this villa and appear again at the next check-in and check-out.</p>
      </div>` : ''}
      <p style="text-align:center;margin:14px 0 4px"><button class="linkbtn cancelDraft" data-act="cancelDraft" data-r="${r.id}">Cancel this ${isInv(r) ? 'inventory' : phase === 'in' ? 'check-in' : 'check-out'}</button></p>
      <div class="sticky">
        <p class="err" role="alert" id="sendErr" hidden></p>
        <button class="btn block" data-act="send" data-r="${r.id}">Send to manager (${total} photo${total === 1 ? '' : 's'})</button>
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
      if (busy) { busy.hidden = false; busy.textContent = `Processing photo ${i + 1} of ${files.length}…`; }
      try {
        const p = await compress(files[i]);
        if (p.old) oldN++;
        if (p.dark) darkN++;
        const id = uid();
        try { await IDB.put(id, p); } catch (e2) { if (window.indexedDB) { toast('Phone storage is full: the photo could not be saved. Free up space and retake.'); continue; } }
        PC.set(id, p);
        (r[phase + 'Photos'][room] = r[phase + 'Photos'][room] || []).push(id);
        save();
      } catch (e) { toast('One photo could not be read. Try a JPG or PNG photo.'); }
    }
    if (darkN) toast(`${darkN} photo${darkN === 1 ? ' is' : 's are'} too dark. Retake with more light.`);
    else if (oldN) toast(`${oldN} photo${oldN === 1 ? ' was' : 's were'} taken more than 24 hours ago, marked "Old photo".`);
    const st = (r.aiState || {})[phase + ':' + room];
    const good = await goodPhotos(r[phase + 'Photos'][room]);
    const needAi = good.length && (st === 'fail' || st === 'retake' || (phase === 'in' ? !((r.inItems || {})[room] || []).length : ((r.outItems || {})[room] || [{}])[0].unchecked));
    if (!needAi) { render(true); return; }
    runAi(r, phase, room, good);
  }
  // Merge AI items into a list staff may already have edited: keep their rows, add only new names.
  function mergeInItems(cur, fresh) {
    if (!cur || !cur.length) return fresh;
    const have = new Set(cur.map(i => i.name.trim().toLowerCase()));
    return cur.concat(fresh.filter(i => !have.has(i.name.trim().toLowerCase())));
  }
  // strong = use the stronger AI model (Sonnet): for "Try AI again", and automatically once when the normal model fails.
  async function runAi(r, phase, room, good, strong) {
    r.aiState = r.aiState || {};
    const key = `${r.id}:${phase}:${room}`;
    BUSY.add(key); render(true);
    const sec = document.getElementById('room-' + room); if (sec) sec.scrollIntoView({ block: 'nearest' });
    const finish = msg => { BUSY.delete(key); save(); if (location.hash.endsWith('/capture/' + r.id)) { render(true); toast(msg); } };
    const okMsg = phase === 'in' ? `AI done: ${roomName(room)}. Check the list.` : `AI finished comparing ${roomName(room)}.`;
    if (!LIVE) { setTimeout(() => { if (phase === 'in') simInRoom(r, room); else simOutRoom(r, room); r.aiState[phase + ':' + room] = 'ok'; finish(okMsg); }, 1600); return; }
    try {
      const photosB64 = [];
      for (const pid of good.slice(-4)) { const p = await getPhoto(pid); if (p) photosB64.push(b64(p.data)); }
      const body = { phase, villa: villa(r.villaId).name, room: roomName(room, 'en'), photos: photosB64, strong: !!strong };
      const ro = roomObj(room);
      if (phase === 'in' && ro && Array.isArray(ro.cat) && ro.cat.length) body.expected = ro.cat;
      else if (phase === 'in' && CAT[room] && !REAL) body.expected = CAT[room];
      if (phase === 'out') body.checkin = r.outItems[room].map(i => ({ id: i.id, name: i.name, qty: i.inQty, cond: i.inCond }));
      const res = await api('gw-ai-room', { method: 'POST', body });
      if (!res || !res.ok) throw new Error((res && res.error) || 'AI error');
      r.aiNote = r.aiNote || {};
      if (res.quality === 'retake') r.aiNote[phase + ':' + room] = res.quality_note || 'Photo not clear enough.'; else delete r.aiNote[phase + ':' + room];
      r.aiState[phase + ':' + room] = res.quality === 'retake' ? 'retake' : 'ok';
      if (phase === 'in') {
        r.inItems = r.inItems || {};
        r.inItems[room] = mergeInItems(r.inItems[room], (res.items || []).map(i => ({ id: uid(), name: i.name, qty: i.qty, cond: i.cond, note: i.note || '', src: 'ai', flag: i.small ? 'small' : '' })));
      } else {
        const list = r.outItems[room];
        (res.items || []).forEach(x => { const it = list.find(i => i.id === x.id); if (!it || it.movedTo) return; it.unchecked = false;
          it.cond = x.cond; it.note = x.seen ? (x.note || '') : 'Not visible in photo';
          if (x.seen && x.qty < it.inQty) { it.cond = 'Damaged'; it.note = `${it.inQty - x.qty} missing${x.note ? '; ' + x.note : ''}`; } });
        list.forEach(it => { if (it.unchecked && !it.movedTo) { it.unchecked = false; it.note = 'Not visible in photo'; } });
        (res.extra || []).forEach(e => {
          // An "extra" item that matches a check-in item from another room was moved here (e.g. sofa bed from the living room to Bedroom 3).
          const nm = String(e.name || '').trim().toLowerCase();
          let src = null;
          Object.keys(r.outItems).forEach(k2 => { if (k2 === room || src) return; const it2 = r.outItems[k2].find(i => !i.movedTo && i.inQty > 0 && i.name.trim().toLowerCase() === nm && (i.unchecked || i.note === 'Not visible in photo')); if (it2) src = it2; });
          if (src) { src.movedTo = room; src.unchecked = false; src.cond = CONDS.indexOf(e.cond) >= 0 ? e.cond : src.cond; src.note = e.note || ''; return; }
          list.push({ id: uid(), name: e.name, inQty: 0, inCond: 'Good', inNote: '', qty: parseInt(e.qty, 10) || 1, cond: e.cond || 'Good', note: e.note || 'Not on check-in list', unchecked: false, touched: false });
        });
      }
      finish(res.quality === 'retake' ? 'AI: photo not clear enough. See the note in that room.' : okMsg);
    } catch (e) {
      if (phase === 'in') { r.inItems = r.inItems || {}; r.inItems[room] = r.inItems[room] || []; }
      r.aiState[phase + ':' + room] = 'fail';
      if (e && e.status === 401) { BUSY.delete(key); return; }
      // The normal model failed (bad or cut-off reply, server error): try once with the stronger model before asking staff.
      if (!strong && (!e || !e.status || e.status >= 500)) { BUSY.delete(key); return runAi(r, phase, room, good, true); }
      finish('AI could not be reached. Tap "Try AI again", or add the items by hand.');
    }
  }

  async function sendPhotos(r) {
    const phase = phaseOf(r);
    const photos = r[phase + 'Photos'];
    const err = document.getElementById('sendErr');
    const total = count(photos);
    if (!total) { err.hidden = false; err.textContent = 'Add at least one photo.'; return; }
    for (const ids of Object.values(photos)) { for (const pid of ids) {
      const p = await getPhoto(pid);
      if (!p && !(r.photoFiles || {})[pid]) { err.hidden = false; err.textContent = 'A photo is missing from this phone (storage full?). Remove the empty photo and retake it.'; return; }
      if (p && p.dark) { err.hidden = false; err.textContent = 'A photo is still too dark. Remove it (marked red) or retake it first.'; return; }
    } }
    if (phase === 'in') {
      const z = dropZeroQty(r);
      if (z) toast(`${z} item${z === 1 ? '' : 's'} with quantity 0 removed from the list.`);
      const blank = Object.values(r.inItems || {}).some(l => l.some(i => !i.name.trim()));
      if (blank) {
        const rooms = Object.keys(r.inItems || {}).filter(k => r.inItems[k].some(i => !i.name.trim())).map(k => roomName(k));
        err.hidden = false; err.textContent = `Some items have no name, in: ${rooms.join(', ')}. They are marked red: type a name or tap ✕ to remove.`;
        const bad = Array.from(app.querySelectorAll('input.nm')).filter(x => !x.value.trim());
        bad.forEach(x => x.classList.add('missing'));
        if (bad[0]) { bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); bad[0].focus(); }
        return;
      }
      if (!Object.values(r.inItems || {}).some(l => l.length)) { err.hidden = false; err.textContent = 'The item list is empty. Wait for the AI or add items.'; return; }
    }
    const missing = capRooms(r, phase).filter(x => !(photos[x.id] || []).length).map(x => roomName(x.id));
    if (missing.length) {
      err.hidden = false;
      err.textContent = `Every room needs a photo. No photo yet: ${missing.join(', ')}.${phase === 'in' ? ' If a room does not exist in this villa, tap "Remove room" next to its name.' : ''}`;
      return;
    }
    const done = overlay(LIVE ? 'Uploading photos and data…' : 'Sending to the manager…');
    const prev = r.status;
    try {
      // Upload every photo first while the record is still a draft; only then mark it as sent in one last small save.
      // (A manager must never see it as "to review" while photos are still uploading: the late upload would overwrite the approval.)
      if (LIVE) {
        await pushRecord(r);
        // Every usable photo must now have its Drive copy; otherwise stay a draft so staff can send again.
        const ids = []; Object.values(photos).forEach(l => l.forEach(pid => ids.push(pid)));
        const good = await goodPhotos(ids);
        const missingUp = good.filter(pid => !(r.photoFiles || {})[pid]);
        if (missingUp.length) { const e2 = new Error('upload'); e2.status = 0; e2.missing = missingUp.length; throw e2; }
      }
      r.status = phase === 'in' ? 'checkin_pending' : 'checkout_pending';
      r[phase + 'SentAt'] = Date.now();
      if (LIVE) await pushRecord(r); else await new Promise(res => setTimeout(res, 1000));
    } catch (e) {
      r.status = prev; delete r._dirty; save(); done();
      if (e.status === 409 || e.status === 401) { onSaveError(r, e, ''); return; }
      err.hidden = false; err.textContent = e.missing ? `${e.missing} photo${e.missing === 1 ? '' : 's'} did not upload. Check the internet connection, then tap Send again.` : e.status === 403 && e.message ? e.message : 'Sending failed. Check the internet connection, then tap Send again.';
      return;
    }
    done();
    save();
    toast('Sent. The manager will review and approve.');
    go('#/staff');
  }

  /* ---------- manager home ---------- */
  function statusMgr(r) {
    if (!r) return { chip: chip('', 'Empty'), act: '' };
    switch (r.status) {
      case 'in_draft': return { chip: chip('', isInv(r) ? 'Staff doing inventory' : 'Staff checking inventory'), act: `<button class="btn ghost sm" data-act="cancelDraft" data-r="${r.id}">Discard</button>` };
      case 'checkin_pending': return { chip: chip('am', isInv(r) ? 'Inventory to review' : 'Check-in to review'), act: `<a class="btn sm" href="#/mgr/rec/${r.id}">Review</a>` };
      case 'occupied': {
        const d = daysUntil(r.checkOut);
        const due = d <= 7 ? ' ' + chip('am', d < 0 ? 'Check-out overdue' : d === 0 ? 'Check-out today' : `Check-out in ${d} days`) : '';
        return { chip: chip('ok', 'Occupied') + due, act: `<a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a>` };
      }
      case 'out_draft': return { chip: chip('', 'Staff checking check-out'), act: `<button class="btn ghost sm" data-act="cancelDraft" data-r="${r.id}">Discard</button>` };
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
      const rs = remindersFor(r).map(x => `${fmt(x.d)} (7 days before${x.sent ? (REAL ? ', date passed' : ', simulated') : ''})`).join(' · ');
      return `<div class="tg"><b>⏰ ${esc(villa(r.villaId).name)}</b>Check-out ${fmt(r.checkOut)}${d >= 0 ? ` · in ${d} day${d === 1 ? '' : 's'}` : ' · overdue'}<br><small>Email to manager: ${rs}</small></div>`;
    }).join('') : '<p class="note">No upcoming check-outs.</p>';
    const closed = S.records.filter(r => r.status === 'closed' && !isInv(r)).sort((a, b) => (b.outApprovedAt || 0) - (a.outApprovedAt || 0));
    const invs = S.records.filter(r => r.status === 'closed' && isInv(r)).sort((a, b) => (b.inApprovedAt || 0) - (a.inApprovedAt || 0));
    const invHist = invs.length ? `<div class="tbl"><table class="vt"><tr><th>Villa</th><th>Inventory date</th><th>Items</th><th></th></tr>
      ${invs.map(r => `<tr><td><b>${esc(villa(r.villaId).name)}</b></td><td class="num">${fmt(r.invDate)}</td><td>${plural(Object.values(r.inItems || {}).reduce((a, l) => a + l.length, 0), 'item')}</td>
      <td style="text-align:right"><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="in">Inventory PDF</button><a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a></div></td></tr>`).join('')}
      </table></div>` : '<p class="note">Approved inventories will appear here.</p>';
    const hist = closed.length ? `<div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Changes</th><th></th></tr>
      ${closed.map(r => { const c = changes(r).length; return `<tr><td><b>${esc(villa(r.villaId).name)}</b></td><td>${esc(r.tenant || '—')}</td><td class="num">${fmt(r.checkIn)}</td><td class="num">${fmt(r.checkOut)}</td><td>${c ? chip('am', `${c} change${c === 1 ? '' : 's'}`) : chip('ok', 'None')}</td>
      <td style="text-align:right"><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="in">Check-in PDF</button><button class="btn ghost sm" data-act="pdf" data-r="${r.id}" data-ph="out">Check-out PDF</button><a class="btn ghost sm" href="#/mgr/rec/${r.id}">Open</a></div></td></tr>`; }).join('')}
      </table></div>` : '<p class="note">Completed check-outs will appear here.</p>';
    app.innerHTML = `<div class="page">
      <div class="head"><div><p class="eyebrow">GW Realty</p><h1>Villas</h1></div><div class="row"><a class="btn ghost" href="#/mgr/team">Team</a><a class="btn" href="#/mgr/new">+ Add villa</a></div></div>
      <div class="grid2">
        <div class="tbl"><table class="vt"><tr><th>Villa</th><th>Tenant</th><th>Check-in</th><th>Check-out</th><th>Status</th><th></th></tr>${rows}</table></div>
        <div class="card"><h3>Check-out reminders</h3><div class="rem">${rem}</div><p class="note">${REAL ? 'The server emails the manager at 08:00 WITA, 7 days before each check-out. Check the inbox to confirm delivery.' : 'In the live system an email goes to the manager 7 days before each check-out.'}</p></div>
      </div>
      <div class="card"><h3>Completed</h3>${hist}</div>
      <div class="card"><h3>Inventories</h3>${invHist}</div>
      ${REAL ? '' : `<div class="row" style="justify-content:space-between">
        <p class="note">${LIVE ? 'Demo: data is shared with staff phones. Reset clears it for everyone and starts again with the sample villas.' : 'Demo: data stays in this browser. Reset to start again with the sample villas.'}</p>
        <button class="btn danger sm" data-act="reset">Reset demo</button>
      </div>`}
    </div>`;
  }

  function viewNew() {
    app.innerHTML = `<div class="page narrow">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">Setup</p><h1>Add a villa</h1></div></div>
      <p class="sub">Staff start each inventory on their phone at the villa. Rooms are added by staff during the first inventory.</p>
      <div class="card">
        <div class="fld"><label for="newVilla">Villa name</label><input id="newVilla" placeholder="e.g. Villa Matahari"></div>
        <p class="err" role="alert" id="nvErr" hidden></p>
        <button class="btn" data-act="addVilla">Add villa</button>
      </div>
    </div>`;
  }

  /* ---------- simulated AI (per room) ---------- */
  function simInRoom(r, roomId) {
    r.inItems = r.inItems || {};
    if (!CAT[roomId]) { r.inItems[roomId] = [{ id: uid(), name: 'Item seen in photo', qty: 1, cond: 'Good', note: 'Demo: rename or remove this item', src: 'ai', flag: '' }]; return; }
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
    if (it.unchecked && !it.touched && !it.movedTo) return { k: 'gy', t: 'Not photographed' };
    const mv = it.movedTo ? ` · moved to ${roomName(it.movedTo, 'en')}` : '';
    if (RANK[it.cond] > RANK[it.inCond]) return it.cond === 'Damaged' ? { k: 'rd', t: 'Damaged' + mv } : { k: 'wr', t: 'Worn' + mv };
    if (it.movedTo) return { k: 'mv', t: `Moved to ${roomName(it.movedTo, 'en')}` };
    return { k: 'ok', t: it.cond === 'Good' ? 'Good' : it.cond + ' (as at check-in)' };
  }
  const inCol = it => it.inQty > 0 ? `${it.inQty} · ${it.inCond}${it.inNote ? ` (${esc(it.inNote)})` : ''}` : '<span class="note">Not at check-in</span>';
  const isChange = res => res.k === 'wr' || res.k === 'rd' || res.k === 'mv';
  const fmtIDR = n => hasCost(n) ? 'Rp ' + Number(n).toLocaleString('id-ID') : '';
  const costTotal = ch => { const w = ch.filter(x => hasCost(x.it.cost)); return w.length ? w.reduce((a, x) => a + Number(x.it.cost), 0) : null; };
  function dropZeroQty(r) {
    let n = 0;
    Object.keys(r.inItems || {}).forEach(k => { const before = r.inItems[k].length; r.inItems[k] = r.inItems[k].filter(i => Number(i.qty) > 0); n += before - r.inItems[k].length; });
    if (n) save();
    return n;
  }
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
    if (r.status === 'checkin_pending' || r.status === 'occupied' || isInv(r)) viewCheckIn(r);
    else viewCheckOut(r);
  }

  function photoCol(list, label, max) {
    const ids = (list || []).slice(0, max || 4);
    return ids.length ? ids.map(pid => phImg(pid, label)).join('') : phEmpty(label === 'Check-in' ? 'No photo' : 'No photo');
  }

  function viewCheckIn(r) {
    const v = villa(r.villaId);
    const edit = r.status === 'checkin_pending';
    const items = r.inItems || {};
    const roomIds = roomsFor(r.villaId).map(x => x.id).filter(k => items[k] || (r.inPhotos[k] || []).length);
    const nItems = Object.values(items).reduce((a, l) => a + l.length, 0);
    const nPh = count(r.inPhotos);
    const noPhotoRooms = r.seeded ? [] : roomsFor(r.villaId).filter(x => !(r.inPhotos[x.id] || []).length).map(x => x.en);
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
          <h3>${esc(roomName(k, 'en'))} ${chip('', plural(list.length, 'item'))}</h3>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Note</th>${edit ? '<th>Source</th>' : ''}</tr>${rowsHtml || `<tr><td colspan="6" class="note">No items.</td></tr>`}</table></div>
        </div>
      </div>`;
    }).join('');
    const rem = remindersFor(r).map(x => `email on ${fmt(x.d)} (7 days before${x.sent ? (REAL ? ', date passed' : ', simulated') : ''})`).join(' · ');
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${isInv(r) ? (edit ? 'Inventory review' : 'Inventory · approved') : edit ? 'Check-in review' : 'Check-in · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <div class="card"><div class="form">
        <div class="fld"><label for="f-villa">Villa</label><input id="f-villa" value="${esc(v.name)}" readonly></div>
${isInv(r) ? `
        <div class="fld"><label for="f-inv">Inventory date</label><input id="f-inv" type="date" data-f="invDate" value="${esc(r.invDate)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-notes">Notes <span class="opt">optional</span></label><input id="f-notes" data-f="notes" value="${esc(r.notes)}" placeholder="e.g. reason for the inventory" ${edit ? '' : 'readonly'}></div>` : `
        <div class="fld"><label for="f-ag">Agreement code</label><input id="f-ag" data-f="agreement" value="${esc(r.agreement)}" placeholder="e.g. GWR-AG-2026-031" autocomplete="off" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-tenant">Tenant name <span class="opt">optional</span></label><input id="f-tenant" data-f="tenant" value="${esc(r.tenant)}" placeholder="Tenant name" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-phone">Phone <span class="opt">optional</span></label><input id="f-phone" data-f="phone" value="${esc(r.phone)}" placeholder="+62…" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-email">Email <span class="opt">optional</span></label><input id="f-email" type="email" data-f="email" value="${esc(r.email)}" placeholder="tenant@email.com" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-idno">Passport / ID no. <span class="opt">optional</span></label><input id="f-idno" data-f="idNo" value="${esc(r.idNo)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-notes">Notes <span class="opt">optional</span></label><input id="f-notes" data-f="notes" value="${esc(r.notes)}" placeholder="e.g. deposit amount, agent" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-inv">Inventory date</label><input id="f-inv" type="date" data-f="invDate" value="${esc(r.invDate)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-in">Check-in date</label><input id="f-in" type="date" data-f="checkIn" value="${esc(r.checkIn)}" ${edit ? '' : 'readonly'}></div>
        <div class="fld"><label for="f-out">Check-out date</label><input id="f-out" type="date" data-f="checkOut" value="${esc(r.checkOut)}" ${edit ? '' : 'readonly'}></div>`}
      </div></div>
      ${edit && !isInv(r) ? `<p class="note">Type the agreement code exactly as it is on the signed agreement.</p>` : ''}
      ${edit ? `<div class="banner ai"><b>${nItems} items in ${roomIds.length} room${roomIds.length === 1 ? '' : 's'}, listed by AI from ${nPh} photo${nPh === 1 ? '' : 's'} and checked by staff.</b> Correct anything that is wrong, then approve. Items marked <span class="warnico">⚠</span> are small items.</div>` : ''}
      ${edit && noPhotoRooms.length ? `<div class="banner am">No photos for: ${esc(noPhotoRooms.join(', '))}. Every room needs a photo; ask staff to add them before approving.</div>` : ''}
      ${edit ? '<p class="note">Items with quantity 0 are removed when you approve.</p>' : ''}
      ${!edit && r.seeded ? `<div class="banner">Sample lease: this check-in was prepared as demo data, so it has no photos.</div>` : ''}
      ${blocks}
      <div class="actions">
        <div>${edit ? (isInv(r) ? '<p class="note">Check the list and the inventory date, then approve. The villa stays empty.</p>' : '<p class="note">Check the list, add the check-in and check-out dates (tenant details are optional), then approve.</p>') : isInv(r) ? '<p class="note">Inventory approved.</p>' : `<p class="note">Approved. Check-out reminders: ${rem}</p>`}<p class="err" role="alert" id="apErr" hidden></p></div>
        <div class="row">
          ${edit ? `<button class="btn" data-act="approveIn" data-r="${r.id}">✓ Approve ${isInv(r) ? 'inventory' : 'check-in'}</button>` : ''}
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
    const allOut = Object.values(r.outItems || {}).reduce((a, l) => a.concat(l), []);
    const nItems = allOut.filter(it => it.inQty > 0).length, nNew = allOut.length - nItems;   // check-in baseline vs items found only at check-out
    const nPh = count(r.outPhotos);
    const condCell = (k, it) => edit ? `<select data-ok="cond" data-room="${k}" data-iid="${it.id}" aria-label="Check-out result">${CONDS.map(c => `<option${c === it.cond ? ' selected' : ''}>${c}</option>`).join('')}</select>` : it.cond;
    const noteCell = (k, it) => edit ? `<input data-ok="note" data-room="${k}" data-iid="${it.id}" value="${esc(it.note)}" placeholder="Note" aria-label="Note">` : `<span class="note">${esc(it.note)}</span>`;
    const costCell = (k, it) => costEdit ? `<input class="cost" inputmode="numeric" data-ok="cost" data-room="${k}" data-iid="${it.id}" value="${hasCost(it.cost) ? Number(it.cost).toLocaleString('id-ID') : ''}" placeholder="Optional" aria-label="Cost in rupiah">` : fmtIDR(it.cost);
    const total = costTotal(ch);
    const chRows = ch.length ? ch.map(({ room, it, res }) => `<tr class="chg"><td><b>${esc(it.name)}</b></td><td>${esc(roomName(room, 'en'))}</td><td>${inCol(it)}</td><td>${condCell(room, it)}${it.movedTo ? `<br><span class="note">Moved to ${esc(roomName(it.movedTo, 'en'))}</span>` : ''}</td><td>${noteCell(room, it)}</td><td>${costCell(room, it)}</td></tr>`).join('')
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
          <h3>${esc(roomName(k, 'en'))} ${chip('', plural(list.length, 'item'))}</h3>
          <details class="all"><summary>Show all ${list.length} items</summary>
          <div style="overflow-x:auto"><table class="itbl"><tr><th>Item</th><th>Check-in</th><th>Result</th></tr>
          ${list.map(it => { const res = result(it); return `<tr class="${isChange(res) ? 'chg' : ''}"><td>${esc(it.name)}</td><td>${inCol(it)}</td><td>${condCell(k, it)}${it.movedTo ? ` <span class="note">→ ${esc(roomName(it.movedTo, 'en'))}</span>` : ''}</td></tr>`; }).join('')}
          </table></div></details>
          <p class="note">${nCh ? `${nCh} change${nCh === 1 ? '' : 's'} in this room` : 'No changes in this room'}</p>
        </div>
      </div>`;
    }).join('');
    app.innerHTML = `<div class="page">
      <a href="#/mgr">← Villas</a>
      <div class="head"><div><p class="eyebrow">${edit ? 'Check-out review' : 'Check-out · approved'}</p><h1>${esc(v.name)}</h1></div>${edit ? chip('am', 'Waiting for approval') : chip('ok', 'Approved')}</div>
      <p class="sub">Agreement <b>${esc(r.agreement || '—')}</b> · Tenant: <b>${esc(r.tenant || '—')}</b> · ${fmt(r.checkIn)} to ${fmt(r.checkOut)} · Check-out inventory ${fmt(r.outInvDate)}</p>
      ${edit ? `<div class="banner ai"><b>AI compared ${nPh} new photo${nPh === 1 ? '' : 's'} with the check-in list (${nItems} items${nNew ? `, plus ${nNew} item${nNew === 1 ? '' : 's'} not at check-in` : ''}) and staff checked the result.</b> ${ch.length} change${ch.length === 1 ? '' : 's'}. Correct if needed, then approve. Items already worn or damaged at check-in are not counted again.</div>` : ''}
      ${unchecked.length ? `<div class="banner am">No check-out photos for: ${esc(unchecked.join(', '))}. Those items are marked "Not photographed".</div>` : ''}
      <div class="card"><h3>Changes since check-in</h3>
        <div class="tbl"><table class="vt itbl"><tr><th>Item</th><th>Room</th><th>Check-in</th><th>Result</th><th>Note</th><th>Cost (IDR)</th></tr>${chRows}</table></div>
        ${ch.length ? `<p class="note"><b>Total cost: <span id="costTotal">${total === null ? '—' : fmtIDR(total)}</span></b>. Cost is optional: type it here, or leave it blank and write it on the printed PDF.${!edit ? ' You can still change it after approval; generate the PDF again afterwards.' : ''}</p>` : ''}
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
      const inv = isInv(r);
      const repNo = `${r.agreement || 'GWR-' + r.id.slice(0, 6).toUpperCase()}-${inv ? 'INV' : phase === 'in' ? 'IN' : 'OUT'}`;
      const title = inv ? 'Inventory Report' : phase === 'in' ? 'Check-in Report' : 'Check-out Report';
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
      const meta = inv ? [['Villa', v.name], ['Inventory date', fmt(r.invDate)]] : [['Agreement', r.agreement || '-'], ['Villa', v.name], ['Tenant', r.tenant || '-'], ['Check-in', fmt(r.checkIn)], ['Check-out', fmt(r.checkOut)],
      ];
      const invD = phase === 'in' ? r.invDate : r.outInvDate, refD = phase === 'in' ? r.checkIn : r.checkOut;
      if (!inv && invD && invD !== refD) meta.push([phase === 'in' ? 'Inventory date' : 'Check-out inventory', fmt(invD)]);
      if (inv && r.notes) meta.push(['Notes', r.notes]);
      if (r.phone) meta.push(['Phone', r.phone]);
      if (r.email) meta.push(['Email', r.email]);
      if (r.idNo) meta.push(['ID no.', r.idNo]);
      meta.forEach((m, i) => {
        const x = i % 2 === 0 ? M : W / 2; const yy = y + Math.floor(i / 2) * 6;
        doc.setFont('helvetica', 'bold'); doc.text(`${m[0]}:`, x, yy); const lw = doc.getTextWidth(`${m[0]}:`); doc.setFont('helvetica', 'normal');
        const vx = x + Math.max(24, lw + 3), maxW = (i % 2 === 0 ? W / 2 - 4 : W - M) - vx;
        let val = String(m[1]); if (doc.getTextWidth(val) > maxW) { while (val.length > 1 && doc.getTextWidth(val + '…') > maxW) val = val.slice(0, -1); val += '…'; }
        doc.text(val, vx, yy);
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
      // Keep the room heading on the same page as its first photos and table rows.
      const roomTitle = (name, extra, keep) => {
        need(12 + (keep === undefined ? 62 : keep));
        doc.setFillColor(250, 236, 236); doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(doc.splitTextToSize(String(name), W - 2 * M - 40)[0], M + 3, y + 5.5);
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
          roomTitle(roomName(k, 'en'), plural(items[k].length, 'item'));
          await photoRow(r.inPhotos[k] || [], 'Photos', 4);
          table(['Item', 'Qty', 'Condition', 'Note'], items[k].map(i => [i.name, String(i.qty), i.cond, i.note || '']), { 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 26 } });
        }
      } else {
        const ch = changes(r);
        roomTitle('Changes since check-in', `${ch.length} found`, 24);
        if (ch.length) {
          const total = costTotal(ch);
          table(['Item', 'Room', 'Check-in', 'Result', 'Note', 'Cost (IDR)'],
            ch.map(({ room, it, res }) => [it.name, roomName(room, 'en'), it.inQty > 0 ? `${it.inQty} ${it.inCond}` : 'Not at check-in', res.t, it.note || '', hasCost(it.cost) ? Number(it.cost).toLocaleString('id-ID') : '']),
            { 5: { cellWidth: 30, halign: 'right', minCellHeight: 8 } },
            ['', '', '', '', 'Total', total === null ? '' : total.toLocaleString('id-ID')]);
          doc.setFontSize(8); doc.setTextColor(...MUTED);
          doc.text('Cost of repair or compensation in rupiah. If blank, to be filled in by the owner or agent.', M, y - 4); doc.setTextColor(...DARK); y += 2;
        }
        else { doc.setFontSize(10); doc.text('No changes. Everything is in the same condition as at check-in.', M, y); y += 10; }
        for (const k of Object.keys(r.outItems || {})) {
          roomTitle(roomName(k, 'en'), plural(r.outItems[k].length, 'item'));
          await photoPair(r.inPhotos[k] || [], r.outPhotos[k] || []);
          table(['Item', 'Check-in', 'Result'], r.outItems[k].map(it => [it.name, it.inQty > 0 ? `${it.inQty} ${it.inCond}` : 'Not at check-in', result(it).t]), { 1: { cellWidth: 34 }, 2: { cellWidth: 44 } });
        }
      }
      // tenant acknowledgement + signatures (inventory: confirmation by GW Realty, no tenant)
      need(68); y += 6;
      if (inv) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Confirmation', M, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        const l2 = doc.splitTextToSize('This report records the items, quantities and conditions found in the villa on the inventory date above.', W - 2 * M); doc.text(l2, M, y); y += l2.length * 4.5 + 16;
        doc.setDrawColor(...DARK); doc.line(M, y, M + 75, y); doc.line(W - M - 75, y, W - M, y);
        doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text('Owner / Villa / Listing', M, y + 5); doc.text('Inventory by (GW Realty)', W - M - 75, y + 5);
        doc.text("Owner's Representative", M, y + 10);
        doc.text('Name:', M, y + 16); doc.text('Name:', W - M - 75, y + 16);
        doc.text('Date:', M, y + 22); doc.text('Date:', W - M - 75, y + 22);
        doc.setTextColor(...DARK); y += 27;
      } else {
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
      doc.text('Name:', M, y + 16); doc.text(doc.splitTextToSize(`Name: ${r.tenant || ''}`, 75)[0], W - M - 75, y + 16);
      doc.text('Date:', M, y + 22); doc.text('Date:', W - M - 75, y + 22);
      doc.setTextColor(...DARK); y += 27;
      }
      // headers on pages added by autoTable + footers
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, 26, 'F'); drawHeader();
        }
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(`${v.name} · ${title} · GW Realty`, 140)[0], M, 291);
        doc.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' });
      }
      const safe = x => String(x).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
      const fname = `${r.agreement ? safe(r.agreement) + '-' : ''}${safe(v.name)}-${inv ? 'inventory' : phase === 'in' ? 'check-in' : 'check-out'}-${iso(new Date())}.pdf`;
      doc.save(fname);
      toast('PDF generated: ' + fname);
      // Status stays next to the button (a toast disappears after 3 seconds).
      const pdfSt = msg => { const pb = document.querySelector(`[data-act="pdf"][data-ph="${phase}"]`); if (!pb) return; let st = pb.parentNode.querySelector('.pdfst'); if (!st) { st = document.createElement('p'); st.className = 'note pdfst'; pb.parentNode.appendChild(st); } st.textContent = msg; };
      if (LIVE) {
        pdfSt('Saving ' + fname + ' to Google Drive…');
        api('gw-save-pdf', { method: 'POST', body: { fileName: fname, data: b64(doc.output('datauristring')) } })
          .then(() => { toast('PDF saved to Google Drive.'); pdfSt('✓ Saved to Google Drive: ' + fname); })
          .catch(() => { toast('PDF downloaded, but saving to Google Drive failed.'); pdfSt('✕ Not saved to Google Drive. Check the connection and tap Generate PDF again.'); });
      }
    } catch (e) {
      console.error(e);
      toast('The PDF could not be generated. Please try again.');
    } finally { done(); }
  }

  /* ---------- events ---------- */
  app.addEventListener('submit', async e => {
    if (e.target.id !== 'loginForm') return;
    e.preventDefault();
    const em = document.getElementById('lgEmail').value.trim(), pw = document.getElementById('lgPw').value, err = document.getElementById('lgErr');
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (LIVE) {
        // The server checks the password and returns a signed token; nothing about passwords is kept on the device.
        let res;
        try { res = await api('gw-login', { method: 'POST', body: { email: em, password: pw } }); }
        catch (e2) { err.hidden = false; err.textContent = e2.status === 401 ? 'Email or password is not correct.' : e2.status === 429 ? (e2.message || 'Too many wrong passwords. Try again later.') : 'Server not reachable. Check the internet connection.'; return; }
        const u = res.user;
        S.token = res.token; S.user = u.id; S.role = u.role;
        S.users = (S.users || []).filter(x => x.id !== u.id).concat([u]);
        save();
        await pullAll(true);
        go(u.role === 'mgr' ? '#/mgr' : '#/staff');
        return;
      }
      const u = S.users.find(x => x.email.toLowerCase() === em.toLowerCase());
      if (!u || !u.pw || u.pw !== await pwHash(em, pw)) { err.hidden = false; err.textContent = 'Email or password is not correct.'; return; }
      S.user = u.id; S.role = u.role; save(); go(u.role === 'mgr' ? '#/mgr' : '#/staff');
    } finally { btn.disabled = false; }
  });
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[type=file][data-room]')) { addPhotos(t); return; }
    if (t.dataset.act === 'showPw') { ['nuPw', 'cpPw'].forEach(id => { const el = document.getElementById(id); if (el) el.type = t.checked ? 'text' : 'password'; }); return; }
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
    if (t.classList && t.classList.contains('missing') && t.value.trim()) t.classList.remove('missing');
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
    else if (k === 'movedTo') { it.movedTo = t.value || ''; if (!it.movedTo) delete it.movedTo; else { it.unchecked = false; it.touched = true; if (it.note === 'Not visible in photo' || it.note === 'No check-out photo') it.note = ''; } }
    else it[k] = k === 'qty' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
    if (k === 'cond') { it.touched = true; if (it.note === 'No check-out photo') it.note = ''; }
    save();
    if (k === 'cost') {
      t.value = hasCost(it.cost) ? Number(it.cost).toLocaleString('id-ID') : '';
      const tot = costTotal(changes(r));
      const el = document.getElementById('costTotal'); if (el) el.textContent = tot === null ? '—' : fmtIDR(tot);
      if (r.status === 'closed' && LIVE) {
        pushRecord(r).then(() => toast('Cost saved.')).catch(e => onSaveError(r, e, 'Cost NOT saved to the server. Check the connection and change it again.'));
      }
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
    if (act === 'eye') { const inp = document.getElementById(b.dataset.for); if (inp) { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.classList.toggle('on', show); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.title = show ? 'Hide password' : 'Show password'; } return; }
    if (act === 'setPw') {
      const u = S.users.find(x => x.id === document.getElementById('cpUser').value), pw = document.getElementById('cpPw').value, err = document.getElementById('cpErr');
      if (!u || pw.length < 8) { err.hidden = false; err.textContent = 'The password needs at least 8 characters.'; return; }
      pwHash(u.email, pw).then(async h => { if (LIVE) u.pwNew = h; else u.pw = h; save(); await pushSettings(); toast(`Password changed for ${u.name}.`); render(true); });
    }
    else if (act === 'addUser') {
      const n = document.getElementById('nuName').value.trim(), em = document.getElementById('nuEmail').value.trim(), err = document.getElementById('nuErr');
      if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.hidden = false; err.textContent = 'Add a name and a valid email.'; return; }
      if (S.users.some(u => u.email.toLowerCase() === em.toLowerCase())) { err.hidden = false; err.textContent = 'An account with this email already exists.'; return; }
      const pw = document.getElementById('nuPw').value;
      if (pw.length < 8) { err.hidden = false; err.textContent = 'The password needs at least 8 characters.'; return; }
      const role = (document.getElementById('nuRole') || {}).value === 'mgr' ? 'mgr' : 'staff';
      pwHash(em, pw).then(async h => { S.users.push(Object.assign({ id: uid(), name: n, email: em, role }, LIVE ? { pwNew: h } : { pw: h })); save(); await pushSettings(); toast(`${role === 'mgr' ? 'Manager' : 'Staff'} account created for ${n}. Tell them their password.`); render(); });
    }
    else if (act === 'delUser') {
      if (b.dataset.u === S.user) { toast('You cannot remove your own account.'); return; }
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Press again to remove'; return; }
      S.users = S.users.filter(u => u.id !== b.dataset.u); save(); pushSettings(); render(true);
    }
    else if (act === 'addRoom') {
      const inp = document.getElementById('newRoom'); const name = b.dataset.name || (inp ? inp.value.trim() : '');
      if (!name) { toast(T('Ketik nama ruangan dulu.', 'Type the room name first.')); return; }
      const v = villa(b.dataset.v); v.rooms = v.rooms || [];
      if (roomsFor(v.id).some(x => x.en.toLowerCase() === name.toLowerCase())) { toast('This room already exists.'); return; }
      const hidden = ROOMS.find(x => x.en.toLowerCase() === name.toLowerCase() && (v.hideRooms || []).indexOf(x.id) >= 0);
      if (hidden) { v.hideRooms = v.hideRooms.filter(x => x !== hidden.id); pushSettings(); save(); toast(`${hidden.en} added back.`); render(true); return; }
      const room = { id: 'rm-' + uid(), en: name, id_: b.dataset.nameId || name }; v.rooms.push(room); pushSettings();
      if (b.dataset.r) { const r = rec(b.dataset.r); if (r && r.inItems) r.inItems[room.id] = []; }
      save(); toast(T(`${room.id_} ditambahkan. Ambil foto atau tambah barang.`, `${name} added.`)); render(true);
    }
    else if (act === 'startIn' || act === 'startInv') {
      const r = Object.assign({ id: uid(), villaId: b.dataset.v, tenant: '', invDate: iso(today()), checkIn: '', checkOut: '', status: 'in_draft', inPhotos: {}, inItems: {}, outPhotos: {}, outItems: null, createdAt: Date.now() }, act === 'startInv' ? { kind: 'inv' } : {});
      S.records.push(r); save(); pushRecord(r).catch(e2 => onSaveError(r, e2, 'Not saved to the server yet. It will be retried when you send.')); go(`#/${S.role === 'mgr' ? 'mgr' : 'staff'}/capture/${r.id}`);
    }
    else if (act === 'cancelDraft') {
      // Two taps. A check-in or inventory draft is cancelled (the villa is empty again); a check-out draft goes back to occupied.
      // Photos already uploaded stay in Google Drive as evidence.
      const r = rec(b.dataset.r); if (!r || (r.status !== 'in_draft' && r.status !== 'out_draft')) return;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to cancel'; return; }
      const prev = JSON.parse(JSON.stringify(r)), what = isInv(r) ? 'Inventory' : r.status === 'in_draft' ? 'Check-in' : 'Check-out';
      if (r.status === 'in_draft') r.status = 'cancelled';
      else { r.status = 'occupied'; r.outItems = null; r.outPhotos = {}; r.outInvDate = ''; }
      r.cancelledAt = Date.now(); save();
      toast(`${what} cancelled.`); go(S.role === 'mgr' ? '#/mgr' : '#/staff'); render();
      pushRecord(r).catch(e2 => { if (e2.status !== 409) { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, prev); save(); render(); } onSaveError(r, e2, 'Not cancelled: saving to the server failed. Check the connection and try again.'); });
    }
    else if (act === 'startOut') { const r = rec(b.dataset.r); r.status = 'out_draft'; r.outPhotos = {}; r.outInvDate = iso(today()); initOut(r); save(); pushRecord(r).catch(e2 => onSaveError(r, e2, 'Not saved to the server yet. It will be retried when you send.')); go(`#/staff/capture/${r.id}`); }
    else if (act === 'retryAi') {
      const r = rec(location.hash.split('/')[3]); if (!r) return; const phase = phaseOf(r);
      goodPhotos((r[phase + 'Photos'] || {})[b.dataset.room]).then(good => { if (good.length) runAi(r, phase, b.dataset.room, good, true); else toast('Add a bright photo first.'); });
    }
    else if (act === 'hideRoom') {
      const v = villa(b.dataset.v); if (!v) return;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to remove this room (its photos and items too)'; return; }
      const room = b.dataset.room;
      if (ROOMS.some(x => x.id === room)) v.hideRooms = (v.hideRooms || []).concat([room]);
      else v.rooms = (v.rooms || []).filter(x => x.id !== room);
      const r = rec(location.hash.split('/')[3]);
      if (r) { if (r.inItems) delete r.inItems[room]; if (r.inPhotos) delete r.inPhotos[room]; }
      save(); pushSettings(); toast(`${roomName(room)} removed from this villa. Add it again under "Add a room" if needed.`); render(true);
    }
    else if (act === 'rmPhoto') {
      const r = rec(location.hash.split('/')[3]); const phase = r.status === 'in_draft' ? 'in' : 'out';
      const l = r[phase + 'Photos'][b.dataset.room] || []; const i = l.indexOf(b.dataset.pid);
      // The copy already uploaded stays in Google Drive as evidence (only the folder owner deletes it); the record just stops using it.
      if (i >= 0) { l.splice(i, 1); IDB.del(b.dataset.pid); PC.delete(b.dataset.pid); if (r.photoFiles) delete r.photoFiles[b.dataset.pid]; }
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
      if (isInv(r)) { if (!r.invDate) probs.push('Add the inventory date.'); }
      else {
      if (!r.agreement) probs.push('Add the agreement code.');
      else if (S.records.some(x => x.id !== r.id && x.agreement === r.agreement && x.status !== 'closed')) probs.push(`Agreement ${r.agreement} is already used on another open lease. Check the code.`);
      if (!r.checkIn) probs.push('Add the check-in date.');
      if (!r.checkOut) probs.push('Add the check-out date.');
      if (r.checkIn && r.checkOut && r.checkOut <= r.checkIn) probs.push('The check-out date must be after the check-in date.');
      if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) probs.push('Enter a valid tenant email address, or leave it blank.');
      }
      const noPh = r.seeded ? [] : roomsFor(r.villaId).filter(x => !(r.inPhotos[x.id] || []).length).map(x => x.en);
      if (noPh.length) probs.push(`Every room needs a photo. Missing: ${noPh.join(', ')}.`);
      const blank = Object.values(r.inItems || {}).some(l => l.some(i => !i.name.trim()));
      if (blank) probs.push('Some items have no name. Fill them in or remove them.');
      if (!Object.values(r.inItems || {}).some(l => l.length)) probs.push('The list is empty.');
      if (probs.length) { err.hidden = false; err.textContent = probs.join(' '); return; }
      const z = dropZeroQty(r);
      if (!Object.values(r.inItems || {}).some(l => l.length)) { err.hidden = false; err.textContent = 'The list is empty.'; return; }
      r.status = isInv(r) ? 'closed' : 'occupied'; r.inApprovedAt = Date.now(); save();
      toast(`${isInv(r) ? 'Inventory approved. The villa stays empty.' : 'Check-in approved.'}${z ? ` ${plural(z, 'item')} with quantity 0 removed.` : ''}`); render();
      pushRecord(r).catch(e2 => { if (e2.status !== 409) { r.status = 'checkin_pending'; delete r.inApprovedAt; delete r._dirty; save(); render(); } onSaveError(r, e2, 'Not approved: saving to the server failed. Check the connection and approve again.'); });
    }
    else if (act === 'approveOut') {
      const r = rec(b.dataset.r); r.status = 'closed'; r.outApprovedAt = Date.now(); save();
      toast('Check-out approved. The villa is empty again.'); render();
      pushRecord(r).catch(e2 => { if (e2.status !== 409) { r.status = 'checkout_pending'; delete r.outApprovedAt; delete r._dirty; save(); render(); } onSaveError(r, e2, 'Not approved: saving to the server failed. Check the connection and approve again.'); });
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
        const tok = S.token; IDB.clear(); PC.clear(); S = seed(); S.role = 'mgr'; S.user = 'u-mgr'; S.token = tok; save();
        if (LIVE) await pullAll(true);
        toast('Demo reset.'); go('#/mgr'); render(true);
      })();
    }
  });
  barEl.addEventListener('click', e => { if (e.target.closest('[data-act="switch"]')) { S.user = null; S.role = null; save(); go('#/login'); } });

  // Another tab signed in or out: follow it, so two tabs never act as different people.
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { const n = JSON.parse(e.newValue); if (n && (n.user !== S.user || n.token !== S.token)) { S = n; render(); } } catch (e2) { /* ignore */ }
  });
  load();
  render();
  if (LIVE) pullAll(true).then(ch => { if (ch) render(true); });
  // Keep the villa lists fresh on both devices (only on the home screens, never while editing).
  if (LIVE) setInterval(() => {
    const h = location.hash.replace(/^#\/?/, '');
    if ((h === 'mgr' || h === 'staff') && document.visibilityState === 'visible') pullAll().then(ch => { if (ch && location.hash.replace(/^#\/?/, '') === h) render(true); });
  }, 8000);
})();
