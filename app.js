/* ===================================================================
   Pai-Pai — app logic (vanilla JS, offline-first, Supabase cloud)
   =================================================================== */
'use strict';

/* ----------------------------- Config ----------------------------- */
// Aap chahein to yahan seedha bhi daal sakte hain, warna app ke andar
// Settings/onboarding se save hoga (localStorage me).
const HARDCODED = { url: '', key: '' };

function getCfg() {
  if (HARDCODED.url && HARDCODED.key) return HARDCODED;
  try { return JSON.parse(localStorage.getItem('gk_cfg') || 'null'); } catch (_) { return null; }
}
function setCfg(url, key) { localStorage.setItem('gk_cfg', JSON.stringify({ url: url.trim(), key: key.trim() })); }
function cfgValid() { const c = getCfg(); return !!(c && c.url && c.key); }

/* --------------------------- Constants ---------------------------- */
const CATEGORIES = ['Material', 'Labour', 'Theka Payment', 'Architect', 'Misc'];
const PAY_MODES = ['Cash', 'UPI', 'Net Banking', 'Online', 'Udhaar'];
const SOURCES = ['Bank Nikasi', 'Salary', 'Loan', 'Udhaar Liya', 'Savings', 'Sale', 'Other'];
const UNITS = ['Sakda', 'Trolley', 'Tractor', 'Truck', 'Bori', 'Kg', 'Quintal', 'Ton', 'Nag', 'Number', 'Hazaar', 'Ft', 'Sq Ft', 'Din', 'Litre', 'Tanker', 'Bundle'];
// Item ke hisaab se sahi default unit (reta/bajri/mitti → Sakda; eint → Hazaar/per-1000; sariya/taar → Kg; kade → Nag)
const ITEM_UNIT = {
  'Reta': 'Sakda', 'Bajri': 'Sakda', 'Mitti': 'Sakda', 'Gitti': 'Sakda', 'Pathar': 'Sakda', 'Coarse Sand': 'Sakda', 'Badarpur': 'Sakda',
  'Cement': 'Bori', 'Cement Normal': 'Bori', 'Cement 43': 'Bori',
  'Sariya': 'Kg', 'Sariya 8mm': 'Kg', 'Sariya 10mm': 'Kg', 'Sariya 12mm': 'Kg', 'Taar': 'Kg',
  'Kade': 'Nag', 'Eint': 'Hazaar', 'Pani': 'Tanker', 'Paint': 'Litre',
  'Mistry': 'Din', 'Mistry 900': 'Din', 'Mistry 950': 'Din',
  'Majdoor': 'Din', 'Majdoor 600': 'Din', 'Majdoor 650': 'Din',
  'Beldaar': 'Din', 'Mazdoor': 'Din', 'Plumber': 'Din', 'Electrician': 'Din',
  'Painter': 'Din', 'Welder': 'Din', 'Carpenter': 'Din', 'Extra Labour': 'Din'
};
const DEFAULT_ITEMS = {
  'Material': ['Cement Normal', 'Cement 43', 'Cement', 'Sariya 8mm', 'Sariya 10mm', 'Sariya 12mm', 'Sariya', 'Reta', 'Bajri', 'Coarse Sand', 'Mitti', 'Kade', 'Taar', 'Eint', 'Gitti', 'Pathar', 'Pani', 'Tiles', 'Paint', 'Pipe', 'Wire', 'Switch', 'Darwaza', 'Khidki', 'Grill'],
  'Labour': ['Majdoor 600', 'Majdoor 650', 'Mistry 900', 'Mistry 950', 'Majdoor', 'Mistry', 'Beldaar', 'Plumber', 'Electrician', 'Painter', 'Welder', 'Carpenter', 'Extra Labour'],
  'Theka Payment': [],
  'Architect': [],
  'Misc': ['Transport / Bhada', 'Chai / Khana', 'Tools', 'Repair', 'JCB', 'Other']
};
const CAT_ICON = { 'Material': '🧱', 'Labour': '👷', 'Theka Payment': '🤝', 'Architect': '📐', 'Misc': '🧾' };

/* ----------------------------- State ------------------------------ */
let SB_LIB = window.supabase;     // CDN global (has createClient)
let sb = null;                    // supabase client
const state = {
  session: null,
  accounts: [], contracts: [], transactions: [],
  online: navigator.onLine,
  view: 'dashboard',
  authStep: 'config',
  authEmail: '',
  filterRange: 'all'   // all | month | lastmonth
};

/* --------------------------- DOM helpers -------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');
const modalRoot = () => document.getElementById('modal-root');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function inr(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;   // pehle round, fir sign (taaki −₹0 na bane)
  const neg = n < 0; n = Math.abs(n);
  const s = n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return (neg ? '−' : '') + '₹' + s;
}
// Local date (UTC nahi) — taaki aadhi raat ke aas-paas IST me bhi sahi mahine me gine
function today() { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-'); const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d, 10)} ${mon[parseInt(m, 10) - 1]} ${y}`;
}
function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
  });
}
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

/* ------------------ Local cache + offline queue ------------------- */
function cacheGet(tbl) { try { return JSON.parse(localStorage.getItem('gk_cache_' + tbl) || '[]'); } catch (_) { return []; } }
function cacheSet(tbl, rows) { localStorage.setItem('gk_cache_' + tbl, JSON.stringify(rows)); }
function queueGet() { try { return JSON.parse(localStorage.getItem('gk_pending') || '[]'); } catch (_) { return []; } }
function queueSet(q) { localStorage.setItem('gk_pending', JSON.stringify(q)); }
function enqueue(op) { const q = queueGet(); q.push(op); queueSet(q); }
function pendingCount() { return queueGet().length; }

function learnList(key, value) {
  if (!value) return; value = String(value).trim(); if (!value) return;
  let arr; try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { arr = []; }
  if (!arr.some((x) => x.toLowerCase() === value.toLowerCase())) { arr.push(value); localStorage.setItem(key, JSON.stringify(arr)); }
}
function learned(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
function itemSuggestions(cat) {
  const base = DEFAULT_ITEMS[cat] || [];
  const custom = learned('gk_items_' + cat);
  return Array.from(new Set([...base, ...custom]));
}

// Rate-book: item (+ vendor/shop) ke hisaab se pichla rate yaad rakhta hai
function rbKey(item, vendor) { return (item || '').trim().toLowerCase() + '|' + (vendor || '').trim().toLowerCase(); }
function rbAll() { try { return JSON.parse(localStorage.getItem('gk_ratebook') || '{}'); } catch (_) { return {}; } }
function rbGet(item, vendor) {
  if (!item || !String(item).trim()) return null;
  const book = rbAll();
  const v = book[rbKey(item, vendor)];          // pehle item+shop ka exact rate
  if (v != null) return v;
  const w = book[rbKey(item, '')];              // warna sirf item ka aakhri rate
  return w != null ? w : null;
}
function rbSet(item, vendor, rate) {
  if (!item || rate == null || isNaN(rate) || rate <= 0) return;
  const book = rbAll();
  book[rbKey(item, vendor)] = rate; book[rbKey(item, '')] = rate;
  localStorage.setItem('gk_ratebook', JSON.stringify(book));
}

/* --------------------------- Supabase ----------------------------- */
function initClient() {
  const c = getCfg(); if (!c || !c.url || !c.key) return false;
  try {
    sb = SB_LIB.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return true;
  } catch (e) { console.error(e); return false; }
}

async function flushQueue() {
  if (!sb || !state.online) return;
  let q = queueGet(); if (!q.length) return;
  const remaining = [];
  for (const op of q) {
    try {
      if (op.type === 'upsert') {
        const { error } = await sb.from(op.table).upsert(op.row);
        if (error) throw error;
      } else if (op.type === 'delete') {
        const { error } = await sb.from(op.table).delete().eq('id', op.id);
        if (error) throw error;
      }
    } catch (e) { console.warn('sync fail', e); remaining.push(op); }
  }
  queueSet(remaining);
}

async function pushRow(table, row) {
  // optimistic local already done by caller; here we try server or queue
  if (sb && state.online) {
    try { const { error } = await sb.from(table).upsert(row); if (error) throw error; return; }
    catch (e) { console.warn(e); }
  }
  enqueue({ type: 'upsert', table, row });
}
async function deleteRow(table, id) {
  if (sb && state.online) {
    try { const { error } = await sb.from(table).delete().eq('id', id); if (error) throw error; return; }
    catch (e) { console.warn(e); }
  }
  enqueue({ type: 'delete', table, id });
}

/* --------------------------- Data load ---------------------------- */
async function loadAll() {
  // cache first (instant + offline)
  state.accounts = cacheGet('accounts');
  state.contracts = cacheGet('contracts');
  state.transactions = cacheGet('transactions');

  if (sb && state.online) {
    try {
      await flushQueue();
      const [a, c, t] = await Promise.all([
        sb.from('accounts').select('*').order('created_at', { ascending: true }),
        sb.from('contracts').select('*').order('created_at', { ascending: true }),
        sb.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
      ]);
      if (!a.error && a.data) { state.accounts = a.data; cacheSet('accounts', a.data); }
      if (!c.error && c.data) { state.contracts = c.data; cacheSet('contracts', c.data); }
      if (!t.error && t.data) { state.transactions = t.data; cacheSet('transactions', t.data); }
      if (state.accounts.length === 0) { await ensureDefaultAccounts(); }
    } catch (e) { console.warn('load error', e); }
  }
}

async function ensureDefaultAccounts() {
  const uidv = state.session && state.session.user ? state.session.user.id : null;
  const defs = [
    { id: uid(), user_id: uidv, name: 'Cash (haath)', type: 'Cash', opening_balance: 0 },
    { id: uid(), user_id: uidv, name: 'Bank', type: 'Bank', opening_balance: 0 }
  ];
  state.accounts = defs; cacheSet('accounts', defs);
  for (const d of defs) await pushRow('accounts', d);
}

/* ------------------------ Balance / reports ----------------------- */
function accById(id) { return state.accounts.find((a) => a.id === id); }
function accName(id) { const a = accById(id); return a ? a.name : '—'; }

function balanceOf(accId) {
  const a = accById(accId); if (!a) return 0;
  let b = Number(a.opening_balance) || 0;
  for (const t of state.transactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'In' && t.account_id === accId) b += amt;
    else if (t.type === 'Out' && t.account_id === accId && t.payment_mode !== 'Udhaar') b -= amt;
    else if (t.type === 'Transfer') { if (t.account_id === accId) b -= amt; if (t.to_account_id === accId) b += amt; }
  }
  return b;
}
function totalByType(type) { return state.accounts.filter((a) => a.type === type).reduce((s, a) => s + balanceOf(a.id), 0); }

function inRange(iso) {
  if (state.filterRange === 'all') return true;
  const d = new Date(iso + 'T00:00:00'); const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  if (state.filterRange === 'lastmonth') { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return d.getFullYear() === y && d.getMonth() === m;
}
function thisMonth(iso) { const d = new Date(iso + 'T00:00:00'); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }

function sumOut(filterFn) {
  return state.transactions.filter((t) => t.type === 'Out' && (!filterFn || filterFn(t)))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}
function groupSum(type, keyFn, rangeFilter) {
  const map = {};
  for (const t of state.transactions) {
    if (t.type !== type) continue;
    if (rangeFilter && !inRange(t.date)) continue;
    const k = keyFn(t) || '—';
    if (!map[k]) map[k] = { amount: 0, qty: 0, count: 0, unit: '', units: {} };
    map[k].amount += Number(t.amount) || 0;
    map[k].qty += Number(t.qty) || 0;
    map[k].count++;
    if (t.qty && t.unit) map[k].units[t.unit] = (map[k].units[t.unit] || 0) + (Number(t.qty) || 0);
    if (!map[k].unit && t.unit) map[k].unit = t.unit;
  }
  return Object.entries(map).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.amount - a.amount);
}
// "5 Trolley · 2 Truck" — har unit ki qty alag (jodti nahi)
function fmtUnits(units) {
  const e = Object.entries(units || {}).filter(([, q]) => q);
  if (!e.length) return '';
  return e.map(([u, q]) => `${+Number(q).toFixed(2)} ${u}`).join(' · ');
}
function contractPaid(cid) {
  return state.transactions.filter((t) => t.type === 'Out' && t.category === 'Theka Payment' && t.contract_id === cid && t.payment_mode !== 'Udhaar')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

/* ============================ UI: SHELL =========================== */
function refresh() { renderHeader(); renderScreen(); }

function buildShell() {
  app().innerHTML = `
    <header class="app-header">
      <div>
        <h1>Pai-Pai</h1>
        <div class="sub" id="hdr-sub">Hisaab kitaab</div>
      </div>
      <div id="sync-badge"></div>
    </header>
    <main id="screen"></main>
    <nav class="bottom-nav" id="nav"></nav>
  `;
  $('#nav').innerHTML = [
    ['dashboard', '🏠', 'Home'], ['entries', '📒', 'Entries'], ['reports', '📊', 'Reports'],
    ['theka', '🤝', 'Theka'], ['settings', '⚙️', 'Settings']
  ].map(([v, i, l]) => `<button class="nav-item" data-view="${v}"><span class="ico">${i}</span>${l}</button>`).join('');
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-item'); if (b) show(b.dataset.view); });
}

function renderHeader() {
  const badge = $('#sync-badge'); if (!badge) return;
  const pc = pendingCount();
  if (!state.online) badge.innerHTML = `<span class="sync-badge offline"><span class="dot"></span>Offline${pc ? ' · ' + pc : ''}</span>`;
  else if (pc) badge.innerHTML = `<span class="sync-badge pending"><span class="dot"></span>Sync ${pc}</span>`;
  else badge.innerHTML = `<span class="sync-badge"><span class="dot"></span>Synced</span>`;
  badge.onclick = async () => { if (state.online) { toast('Sync ho raha hai…'); await flushQueue(); await loadAll(); refresh(); toast('Sync ho gaya'); } };
}

function show(view) { state.view = view; renderScreen(); }
function renderScreen() {
  const navs = document.querySelectorAll('.nav-item');
  navs.forEach((n) => n.classList.toggle('active', n.dataset.view === state.view));
  const screen = $('#screen'); if (!screen) return;
  let r;
  if (state.view === 'dashboard') r = screenDashboard();
  else if (state.view === 'entries') r = screenEntries();
  else if (state.view === 'reports') r = screenReports();
  else if (state.view === 'theka') r = screenTheka();
  else r = screenSettings();
  screen.innerHTML = r.html; if (r.bind) r.bind();
  screen.scrollTop = 0;
}

/* ========================= SCREEN: DASHBOARD ====================== */
function screenDashboard() {
  const cash = totalByType('Cash'), bank = totalByType('Bank');
  const kul = sumOut(); const isMah = sumOut((t) => thisMonth(t.date));
  const udhaar = sumOut((t) => t.payment_mode === 'Udhaar');
  const recent = state.transactions.slice(0, 8);

  const html = `
    <div class="screen">
      <div class="balance-row">
        <div class="bal-card cash"><div class="label">💵 Cash haath me</div><div class="amt">${inr(cash)}</div></div>
        <div class="bal-card bank"><div class="label">🏦 Bank me</div><div class="amt">${inr(bank)}</div></div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="label">Kul kharcha</div><div class="amt spend">${inr(kul)}</div></div>
        <div class="stat"><div class="label">Is mahine</div><div class="amt spend">${inr(isMah)}</div></div>
      </div>
      ${udhaar > 0 ? `<div class="stat-row"><div class="stat" style="grid-column:1/-1"><div class="label">⚠️ Udhaar baaki (dena hai)</div><div class="amt" style="color:#8a6100">${inr(udhaar)}</div></div></div>` : ''}

      <div class="actions">
        <button class="action-btn out" data-act="out"><span class="ico">💸</span>Kharcha (Paisa Gaya)</button>
        <button class="action-btn in" data-act="in"><span class="ico">➕</span>Paisa Aaya</button>
        <button class="action-btn transfer" data-act="transfer"><span class="ico">🔁</span>Transfer</button>
      </div>

      <div class="section-label">Recent</div>
      <div class="list">${recent.length ? recent.map(entryRow).join('') : emptyState('Abhi koi entry nahi. Upar se shuru karein 👆')}</div>
    </div>`;

  const bind = () => {
    $('#screen').querySelectorAll('.action-btn').forEach((b) => b.onclick = () => {
      const a = b.dataset.act; if (a === 'out') openOutForm(); else if (a === 'in') openInForm(); else openTransferForm();
    });
    bindEntryRows();
  };
  return { html, bind };
}

function emptyState(msg) { return `<div class="empty"><div class="big">📭</div>${esc(msg)}</div>`; }

function entryRow(t) {
  let title, meta, cls, ico, amtCls, sign;
  if (t.type === 'Out') {
    cls = 'out'; amtCls = 'out'; sign = '−';
    ico = CAT_ICON[t.category] || '🧾';
    title = t.category === 'Theka Payment' ? ('Theka' + (t.vendor ? ' — ' + t.vendor : '')) : (t.item || t.category || 'Kharcha');
    const bits = [];
    if (t.qty) bits.push(`${t.qty} ${t.unit || ''}${t.rate ? ' @' + inr(t.rate) : ''}`);
    if (t.vendor && t.category !== 'Theka Payment') bits.push(t.vendor);
    bits.push(accName(t.account_id));
    meta = bits.filter(Boolean).join(' · ');
  } else if (t.type === 'In') {
    cls = 'in'; amtCls = 'in'; sign = '+'; ico = '💰';
    title = t.source || 'Paisa Aaya';
    meta = [t.from_party, accName(t.account_id)].filter(Boolean).join(' · ');
  } else {
    cls = 'transfer'; amtCls = 'transfer'; sign = ''; ico = '🔁';
    title = 'Transfer';
    meta = `${accName(t.account_id)} → ${accName(t.to_account_id)}`;
  }
  const modeTag = t.payment_mode === 'Udhaar' ? '<span class="tag udhaar">Udhaar</span>' : '';
  return `<div class="entry ${cls}" data-id="${t.id}">
    <div class="ic">${ico}</div>
    <div class="body">
      <div class="ttl">${modeTag}${esc(title)}</div>
      <div class="meta">${fmtDate(t.date)} · ${esc(meta)}</div>
    </div>
    <div class="amt ${amtCls}">${sign}${inr(t.amount)}</div>
  </div>`;
}
function bindEntryRows(root) {
  (root || $('#screen')).querySelectorAll('.entry').forEach((el) => {
    el.onclick = () => { const t = state.transactions.find((x) => x.id === el.dataset.id); if (t) openEntryDetail(t); };
  });
}

/* ========================= SCREEN: ENTRIES ======================== */
const entryFilter = { type: 'all', q: '' };
function screenEntries() {
  const html = `
    <div class="screen">
      <h2 class="title">Saari Entries</h2>
      <div class="toolbar">
        <input id="ef-q" placeholder="🔍 Item, vendor, note…" value="${esc(entryFilter.q)}" />
      </div>
      <div class="filter-chips" id="ef-chips">
        ${['all', 'Out', 'In', 'Transfer'].map((t) => `<button class="chip sm ${entryFilter.type === t ? 'active' : ''}" data-t="${t}">${({ all: 'Sab', Out: 'Kharcha', In: 'Aaya', Transfer: 'Transfer' })[t]}</button>`).join('')}
      </div>
      <div class="list" id="ef-list"></div>
    </div>`;
  const bind = () => {
    const renderList = () => {
      let rows = state.transactions.slice();
      if (entryFilter.type !== 'all') rows = rows.filter((t) => t.type === entryFilter.type);
      const q = entryFilter.q.trim().toLowerCase();
      if (q) rows = rows.filter((t) => [t.item, t.vendor, t.notes, t.source, t.from_party, t.category].some((x) => (x || '').toLowerCase().includes(q)));
      $('#ef-list').innerHTML = rows.length ? rows.map(entryRow).join('') : emptyState('Kuch nahi mila');
      bindEntryRows();
    };
    $('#ef-q').oninput = (e) => { entryFilter.q = e.target.value; renderList(); };
    $('#ef-chips').querySelectorAll('.chip').forEach((c) => c.onclick = () => {
      entryFilter.type = c.dataset.t; $('#ef-chips').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c)); renderList();
    });
    renderList();
  };
  return { html, bind };
}

/* ========================= SCREEN: REPORTS ======================== */
function rangeLabel() { return { all: 'Sab', month: 'Is Mahina', lastmonth: 'Pichla Mahina' }[state.filterRange]; }
function screenReports() {
  const rf = state.filterRange === 'all' ? null : true;
  const aaya = groupSum('In', (t) => t.source, rf);
  const byCat = groupSum('Out', (t) => t.category, rf);
  const byItem = groupSum('Out', (t) => t.item || (t.category === 'Theka Payment' ? 'Theka' : '—'), rf).filter((x) => x.key !== '—').slice(0, 12);
  const byVendor = groupSum('Out', (t) => t.vendor, rf).filter((x) => x.key !== '—').slice(0, 12);
  const byMode = groupSum('Out', (t) => t.payment_mode, rf);
  const totalIn = aaya.reduce((s, x) => s + x.amount, 0);
  const totalOut = byCat.reduce((s, x) => s + x.amount, 0);
  const udhaarByVendor = (() => {
    const m = {}; state.transactions.filter((t) => t.type === 'Out' && t.payment_mode === 'Udhaar').forEach((t) => { const k = t.vendor || '—'; m[k] = (m[k] || 0) + (Number(t.amount) || 0); });
    return Object.entries(m).map(([k, v]) => ({ key: k, amount: v })).sort((a, b) => b.amount - a.amount);
  })();

  const card = (title, rows, opts = {}) => {
    if (!rows.length) return '';
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
    return `<div class="report-card"><h4>${title}</h4>${rows.map((r) => {
      const sub = opts.showQty && r.units && Object.keys(r.units).length ? `<small>${esc(fmtUnits(r.units))}</small>` : `<small>${r.count} entries</small>`;
      const w = Math.min(100, Math.max(0, Math.round(Math.abs(r.amount) / max * 100)));
      return `<div class="rrow"><div class="k">${esc(r.key)}${sub}</div><div class="v">${inr(r.amount)}</div></div>
      ${opts.bar ? `<div class="bar ${opts.red ? 'red' : ''}"><span style="width:${w}%"></span></div>` : ''}`;
    }).join('')}</div>`;
  };

  const thekaRows = state.contracts.map((c) => {
    const paid = contractPaid(c.id); const amt = Number(c.theka_amount) || 0; const baaki = amt - paid;
    return `<div class="rrow"><div class="k">${esc(c.thekedar_name || c.kaam || 'Theka')}<small>${esc(c.kaam || '')}</small></div>
      <div class="v">${inr(paid)} / ${inr(amt)}<br><small style="color:${baaki > 0 ? '#c0392b' : '#1f7a4d'}">${baaki > 0 ? 'Baaki ' + inr(baaki) : 'Pura'}</small></div></div>
      <div class="bar"><span style="width:${amt ? Math.min(100, Math.round(paid / amt * 100)) : 0}%"></span></div>`;
  }).join('');

  const html = `
    <div class="screen">
      <h2 class="title">Reports — ${rangeLabel()}</h2>
      <div class="filter-chips" id="rf-chips">
        ${['all', 'month', 'lastmonth'].map((r) => `<button class="chip sm ${state.filterRange === r ? 'active' : ''}" data-r="${r}">${({ all: 'Sab', month: 'Is Mahina', lastmonth: 'Pichla Mahina' })[r]}</button>`).join('')}
      </div>

      <div class="report-card">
        <h4>💼 Account Balances (abhi)</h4>
        ${state.accounts.map((a) => `<div class="rrow"><div class="k">${a.type === 'Cash' ? '💵' : '🏦'} ${esc(a.name)}</div><div class="v">${inr(balanceOf(a.id))}</div></div>`).join('') || '<div class="muted">Koi account nahi</div>'}
      </div>

      <div class="report-card">
        <h4>🔁 ${rangeLabel()} — Aaya vs Gaya</h4>
        <div class="rrow"><div class="k">Total Aaya (In)</div><div class="v" style="color:#1f7a4d">${inr(totalIn)}</div></div>
        <div class="rrow"><div class="k">Total Gaya (Kharcha)</div><div class="v" style="color:#c0392b">${inr(totalOut)}</div></div>
        <div class="total-line"><span>Bachat / Antar</span><span>${inr(totalIn - totalOut)}</span></div>
      </div>

      ${card('💰 Paisa kahan se aaya', aaya, { bar: true })}
      ${card('📦 Category-wise kharcha', byCat, { bar: true, red: true })}
      ${card('🧱 Item-wise (material/labour)', byItem, { showQty: true })}
      ${card('🏪 Vendor / kise gaya', byVendor)}
      ${card('💳 Payment mode wise', byMode)}

      ${state.contracts.length ? `<div class="report-card"><h4>🤝 Theka tracking</h4>${thekaRows}</div>` : ''}
      ${udhaarByVendor.length ? `<div class="report-card"><h4>⚠️ Udhaar baaki — total dena hai (sab waqt ka)</h4>${udhaarByVendor.map((r) => `<div class="rrow"><div class="k">${esc(r.key)}</div><div class="v" style="color:#8a6100">${inr(r.amount)}</div></div>`).join('')}</div>` : ''}

      <button class="btn-secondary" id="csv-btn" style="width:100%;margin-top:6px">⬇️ CSV / Excel export</button>
    </div>`;

  const bind = () => {
    $('#rf-chips').querySelectorAll('.chip').forEach((c) => c.onclick = () => { state.filterRange = c.dataset.r; renderScreen(); });
    $('#csv-btn').onclick = exportCSV;
  };
  return { html, bind };
}

/* ========================== SCREEN: THEKA ========================= */
function screenTheka() {
  const html = `
    <div class="screen">
      <h2 class="title">Theka (Contract)</h2>
      <button class="btn-secondary" id="add-theka" style="width:100%;margin-bottom:12px">➕ Naya Theka</button>
      <div class="list">
        ${state.contracts.length ? state.contracts.map((c) => {
          const paid = contractPaid(c.id), amt = Number(c.theka_amount) || 0, baaki = amt - paid;
          const pct = amt ? Math.min(100, Math.round(paid / amt * 100)) : 0;
          return `<div class="report-card" data-id="${c.id}" style="cursor:pointer">
            <h4>🤝 ${esc(c.thekedar_name || 'Thekedar')}</h4>
            ${c.kaam ? `<div class="muted" style="margin:-4px 0 8px">${esc(c.kaam)}</div>` : ''}
            <div class="rrow"><div class="k">Theka amount</div><div class="v">${inr(amt)}</div></div>
            <div class="rrow"><div class="k">Diya</div><div class="v" style="color:#1f7a4d">${inr(paid)}</div></div>
            <div class="rrow"><div class="k">Baaki</div><div class="v" style="color:${baaki > 0 ? '#c0392b' : '#1f7a4d'}">${inr(baaki)}</div></div>
            <div class="bar"><span style="width:${pct}%"></span></div>
          </div>`;
        }).join('') : emptyState('Abhi koi theka nahi. "Naya Theka" se add karein.')}
      </div>
    </div>`;
  const bind = () => {
    $('#add-theka').onclick = () => openThekaForm();
    $('#screen').querySelectorAll('.report-card[data-id]').forEach((el) => el.onclick = () => {
      const c = state.contracts.find((x) => x.id === el.dataset.id); if (c) openThekaForm(c);
    });
  };
  return { html, bind };
}

/* ========================= SCREEN: SETTINGS ======================= */
function screenSettings() {
  const c = getCfg() || { url: '', key: '' };
  const email = state.session && state.session.user ? state.session.user.email : '';
  const html = `
    <div class="screen">
      <h2 class="title">Settings</h2>

      <div class="section-label">Accounts (paisa kahan hai)</div>
      <div class="list">
        ${state.accounts.map((a) => `<div class="entry" data-acc="${a.id}">
          <div class="ic">${a.type === 'Cash' ? '💵' : '🏦'}</div>
          <div class="body"><div class="ttl">${esc(a.name)}</div><div class="meta">${a.type} · Balance ${inr(balanceOf(a.id))}</div></div>
          <div class="amt">›</div></div>`).join('')}
      </div>
      <button class="btn-secondary" id="add-acc" style="width:100%;margin-top:10px">➕ Naya Account</button>

      <div class="section-label">Backup</div>
      <div class="small-actions">
        <button class="btn-secondary" id="exp-json">⬇️ Backup (JSON)</button>
        <button class="btn-secondary" id="exp-csv">⬇️ CSV</button>
      </div>
      <button class="btn-secondary" id="sync-now" style="width:100%;margin-top:8px">🔄 Abhi Sync karo</button>

      <div class="section-label">Cloud (Supabase)</div>
      <div class="field"><label>Project URL</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" /></div>
      <div class="field"><label>Anon public key</label><input id="cfg-key" value="${esc(c.key)}" placeholder="eyJ..." autocapitalize="off" autocorrect="off" /></div>
      <button class="btn-secondary" id="save-cfg" style="width:100%">💾 Cloud config save</button>

      <div class="section-label">Account</div>
      <div class="muted" style="margin:0 2px 8px">Logged in: ${esc(email || '—')}</div>
      <button class="btn-ghost" id="logout">🚪 Logout</button>
      <div class="center muted mt16">Pai-Pai · v1</div>
    </div>`;

  const bind = () => {
    $('#add-acc').onclick = () => openAccountForm();
    $('#screen').querySelectorAll('.entry[data-acc]').forEach((el) => el.onclick = () => {
      const a = state.accounts.find((x) => x.id === el.dataset.acc); if (a) openAccountForm(a);
    });
    $('#exp-json').onclick = exportJSON;
    $('#exp-csv').onclick = exportCSV;
    $('#sync-now').onclick = async () => { toast('Sync…'); await flushQueue(); await loadAll(); refresh(); toast('Ho gaya'); };
    $('#save-cfg').onclick = () => {
      const url = $('#cfg-url').value, key = $('#cfg-key').value;
      if (!url || !key) return toast('URL aur key dono daalein', true);
      setCfg(url, key); toast('Save ho gaya — app reload ho raha hai'); setTimeout(() => location.reload(), 800);
    };
    $('#logout').onclick = async () => { if (sb) await sb.auth.signOut(); localStorage.removeItem('gk_pending'); location.reload(); };
  };
  return { html, bind };
}

/* ====================== MODAL / SHEET helpers ===================== */
function openSheet(innerHtml, bind) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="sheet"><div class="sheet-grip"></div>${innerHtml}</div>`;
  m.addEventListener('click', (e) => { if (e.target === m) closeSheet(); });
  modalRoot().appendChild(m);
  if (bind) bind(m);
  return m;
}
function closeSheet() { modalRoot().innerHTML = ''; }

function chipsHtml(name, options, selected) {
  return `<div class="chips" data-chips="${name}">${options.map((o) =>
    `<button type="button" class="chip ${o === selected ? 'active' : ''}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}
function bindChips(root, name, onPick) {
  const wrap = root.querySelector(`[data-chips="${name}"]`); if (!wrap) return;
  wrap.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
    wrap.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c));
    if (onPick) onPick(c.dataset.val);
  });
}
function chipVal(root, name) { const a = root.querySelector(`[data-chips="${name}"] .chip.active`); return a ? a.dataset.val : null; }
function accOptions(selId) { return state.accounts.map((a) => `<option value="${a.id}" ${a.id === selId ? 'selected' : ''}>${esc(a.name)}</option>`).join(''); }

/* ====================== FORM: Kharcha (Out) ====================== */
function openOutForm(existing) {
  const t = existing || { id: uid(), type: 'Out', date: today(), category: 'Material', payment_mode: 'Cash', account_id: (state.accounts[0] || {}).id };
  const itemsDL = 'dl-items';
  // Purani entry ka unit agar list me na ho to bhi use option me rakho (warna save par chup-chaap badal jata)
  const unitOpts = (t.unit && !UNITS.includes(t.unit)) ? [t.unit, ...UNITS] : UNITS;
  const inner = `
    <h3>${existing ? '✏️ Kharcha edit' : '➖ Naya Kharcha'}</h3>
    <div class="field"><label>Category</label>${chipsHtml('cat', CATEGORIES, t.category)}</div>

    <div id="item-block">
      <div class="field"><label>Item / Kaam</label>
        <input id="f-item" list="${itemsDL}" value="${esc(t.item || '')}" placeholder="jaise Cement, Sariya, Kade, Taar…" />
        <datalist id="${itemsDL}"></datalist>
      </div>
      <div class="row3">
        <div class="field"><label>Qty</label><input id="f-qty" type="number" inputmode="decimal" step="any" value="${t.qty ?? ''}" placeholder="0" /></div>
        <div class="field"><label>Unit</label><select id="f-unit">${unitOpts.map((u) => `<option ${u === t.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
        <div class="field"><label>Rate ₹</label><input id="f-rate" type="number" inputmode="decimal" step="any" value="${t.rate ?? ''}" placeholder="0" /></div>
      </div>
    </div>

    <div id="theka-block" class="field hidden"><label>Kis theke ka payment</label>
      <select id="f-contract"><option value="">— Theka chuno —</option>${state.contracts.map((c) => `<option value="${c.id}" ${c.id === t.contract_id ? 'selected' : ''}>${esc(c.thekedar_name || c.kaam || 'Theka')}</option>`).join('')}</select>
    </div>

    <div class="field"><label>Amount ₹ (kul)</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /><div class="amt-preview" id="amt-prev"></div></div>

    <div class="field"><label>Kisse aaya / kise diya (vendor)</label><input id="f-vendor" list="dl-vendor" value="${esc(t.vendor || '')}" placeholder="dukaan / aadmi ka naam" />
      <datalist id="dl-vendor">${learned('gk_vendors').map((v) => `<option>${esc(v)}</option>`).join('')}</datalist></div>

    <div class="field"><label>Paisa kahan se gaya (account)</label><select id="f-account">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>Payment mode</label>${chipsHtml('mode', PAY_MODES, t.payment_mode)}</div>

    <div class="row2">
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${t.date}" /></div>
    </div>
    <div class="field"><label>Note (optional)</label><textarea id="f-notes" placeholder="koi detail…">${esc(t.notes || '')}</textarea></div>

    <button class="btn-primary" id="save">💾 Save</button>
    ${existing ? '<button class="btn-primary danger" id="del">🗑️ Delete</button>' : ''}
    <button class="btn-ghost" id="cancel">Cancel</button>
  `;
  openSheet(inner, (root) => {
    const updItems = (cat) => { root.querySelector('#' + itemsDL).innerHTML = itemSuggestions(cat).map((i) => `<option>${esc(i)}</option>`).join(''); };
    const toggleBlocks = (cat) => {
      const isTheka = cat === 'Theka Payment';
      const isPayment = isTheka || cat === 'Architect';   // Architect bhi seedha payment (item/qty/rate nahi)
      root.querySelector('#item-block').classList.toggle('hidden', isPayment);
      root.querySelector('#theka-block').classList.toggle('hidden', !isTheka);
    };
    updItems(t.category); toggleBlocks(t.category);
    bindChips(root, 'cat', (v) => { updItems(v); toggleBlocks(v); });
    bindChips(root, 'mode');

    const qty = root.querySelector('#f-qty'), rate = root.querySelector('#f-rate'), amount = root.querySelector('#f-amount'), prev = root.querySelector('#amt-prev');
    const itemEl = root.querySelector('#f-item'), unitEl = root.querySelector('#f-unit');
    // "manual" tabhi jab stored amount sach me qty×rate se alag ho (ya qty/rate hai hi nahi).
    // Sirf "edit hai" isliye manual nahi — warna qty/rate badalne par amount purana reh jata tha.
    let manual = !!(existing && existing.amount != null && (existing.qty == null || existing.rate == null ||
      Number(existing.amount).toFixed(2) !== (Number(existing.qty) * Number(existing.rate)).toFixed(2)));
    const calc = () => {
      const q = parseFloat(qty.value), r = parseFloat(rate.value);
      if (!isNaN(q) && !isNaN(r)) { prev.innerHTML = `${q} × ${inr(r)} = <b>${inr(q * r)}</b>`; if (!manual) amount.value = (q * r).toFixed(2).replace(/\.00$/, ''); }
      else prev.textContent = '';
    };
    qty.oninput = calc; rate.oninput = calc; amount.oninput = () => { manual = true; }; calc();

    // Item ke hisaab se unit auto-set (reta/bajri/mitti → Sakda), jab tak user khud unit na badle
    let unitTouched = !!(existing && existing.unit);
    unitEl.onchange = () => { unitTouched = true; };
    const applyItemUnit = () => {
      if (unitTouched) return;
      const k = Object.keys(ITEM_UNIT).find((x) => x.toLowerCase() === itemEl.value.trim().toLowerCase());
      if (k) unitEl.value = ITEM_UNIT[k];
    };

    // Rate-book: item (+ shop/vendor) ka pichla rate auto-bhar. User khud rate type kare to app nahi chhedta.
    const vendorEl = root.querySelector('#f-vendor');
    let rateNoticed = false, rateAuto = false;
    const maybeFillRate = () => {
      if (rate.value.trim() !== '' && !rateAuto) return;          // user ka type kiya rate na badlo
      const rb = rbGet(itemEl.value, vendorEl.value);
      if (rb != null && String(rb) !== rate.value) {
        rate.value = rb; rateAuto = true; calc();
        if (!rateNoticed) { rateNoticed = true; toast('Pichli baar ka rate bhar diya — badal sakte ho'); }
      }
    };
    rate.addEventListener('input', () => { rateAuto = false; });  // user ne rate chheda → ab manual
    itemEl.oninput = () => { applyItemUnit(); maybeFillRate(); };
    vendorEl.oninput = maybeFillRate;
    applyItemUnit();
    if (!existing) maybeFillRate();

    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#save').onclick = async () => {
      const cat = chipVal(root, 'cat');
      const rec = {
        id: t.id, type: 'Out', date: root.querySelector('#f-date').value || today(),
        category: cat, amount: parseFloat(amount.value) || 0,
        account_id: root.querySelector('#f-account').value || null,
        payment_mode: chipVal(root, 'mode'),
        vendor: root.querySelector('#f-vendor').value.trim() || null,
        notes: root.querySelector('#f-notes').value.trim() || null,
        item: null, qty: null, unit: null, rate: null, contract_id: null
      };
      if (cat === 'Theka Payment') { rec.contract_id = root.querySelector('#f-contract').value || null; }
      else if (cat === 'Architect') { /* seedha payment — sirf amount + vendor + note */ }
      else {
        rec.item = itemEl.value.trim() || null;
        const q = parseFloat(qty.value), r = parseFloat(rate.value);
        rec.qty = isNaN(q) ? null : q; rec.unit = unitEl.value; rec.rate = isNaN(r) ? null : r;
        // amount hamesha qty×rate ke barabar rahe (jab tak user ne khud amount na badla ho)
        if (!manual && !isNaN(q) && !isNaN(r)) rec.amount = q * r;
        rbSet(rec.item, rec.vendor, rec.rate);   // is item (+ shop) ka rate yaad rakho
      }
      if (!(rec.amount > 0)) return toast('Amount sahi daalein', true);
      learnList('gk_items_' + cat, rec.item); learnList('gk_vendors', rec.vendor);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* ====================== FORM: Paisa Aaya (In) ==================== */
function openInForm(existing) {
  const t = existing || { id: uid(), type: 'In', date: today(), source: 'Bank Nikasi', account_id: (state.accounts[0] || {}).id };
  const inner = `
    <h3>${existing ? '✏️ Aaya edit' : '➕ Paisa Aaya'}</h3>
    <div class="field"><label>Kahan aaya (account)</label><select id="f-account">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>Amount ₹</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>Kahan se aaya (source)</label>${chipsHtml('src', SOURCES, t.source)}</div>
    <div class="field"><label>Kisse (naam, optional)</label><input id="f-from" value="${esc(t.from_party || '')}" placeholder="aadmi / bank" /></div>
    <div class="field"><label>Date</label><input id="f-date" type="date" value="${t.date}" /></div>
    <div class="field"><label>Note</label><textarea id="f-notes">${esc(t.notes || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 Save</button>
    ${existing ? '<button class="btn-primary danger" id="del">🗑️ Delete</button>' : ''}
    <button class="btn-ghost" id="cancel">Cancel</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'src');
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#save').onclick = async () => {
      const acc = accById(root.querySelector('#f-account').value);
      const rec = {
        id: t.id, type: 'In', date: root.querySelector('#f-date').value || today(),
        amount: parseFloat(root.querySelector('#f-amount').value) || 0,
        account_id: root.querySelector('#f-account').value || null,
        source: chipVal(root, 'src'), from_party: root.querySelector('#f-from').value.trim() || null,
        payment_mode: acc && acc.type === 'Cash' ? 'Cash' : 'Net Banking',
        notes: root.querySelector('#f-notes').value.trim() || null
      };
      if (!(rec.amount > 0)) return toast('Amount sahi daalein', true);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* ========================= FORM: Transfer ======================= */
function openTransferForm(existing) {
  const t = existing || { id: uid(), type: 'Transfer', date: today(), account_id: (state.accounts.find((a) => a.type === 'Bank') || state.accounts[0] || {}).id, to_account_id: (state.accounts.find((a) => a.type === 'Cash') || state.accounts[0] || {}).id };
  const inner = `
    <h3>${existing ? '✏️ Transfer edit' : '🔁 Transfer'}</h3>
    <p class="muted" style="margin:0 2px 6px">Jaise: Bank se cash nikala, ya ek account se dusre me.</p>
    <div class="field"><label>Kahan se (from)</label><select id="f-from">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>Kahan (to)</label><select id="f-to">${accOptions(t.to_account_id)}</select></div>
    <div class="field"><label>Amount ₹</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>Date</label><input id="f-date" type="date" value="${t.date}" /></div>
    <div class="field"><label>Note</label><textarea id="f-notes">${esc(t.notes || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 Save</button>
    ${existing ? '<button class="btn-primary danger" id="del">🗑️ Delete</button>' : ''}
    <button class="btn-ghost" id="cancel">Cancel</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#save').onclick = async () => {
      const from = root.querySelector('#f-from').value, to = root.querySelector('#f-to').value;
      if (from === to) return toast('From aur To alag account chuno', true);
      const rec = {
        id: t.id, type: 'Transfer', date: root.querySelector('#f-date').value || today(),
        amount: parseFloat(root.querySelector('#f-amount').value) || 0,
        account_id: from, to_account_id: to, payment_mode: 'Transfer',
        notes: root.querySelector('#f-notes').value.trim() || null
      };
      if (!(rec.amount > 0)) return toast('Amount sahi daalein', true);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* =================== Entry detail (view/edit) =================== */
function openEntryDetail(t) {
  const lines = [];
  lines.push(['Type', { In: 'Paisa Aaya', Out: 'Kharcha', Transfer: 'Transfer' }[t.type]]);
  lines.push(['Amount', inr(t.amount)]);
  lines.push(['Date', fmtDate(t.date)]);
  if (t.category) lines.push(['Category', t.category]);
  if (t.item) lines.push(['Item', t.item]);
  if (t.qty) lines.push(['Qty', `${t.qty} ${t.unit || ''}${t.rate ? ' @ ' + inr(t.rate) : ''}`]);
  if (t.vendor) lines.push(['Vendor', t.vendor]);
  if (t.source) lines.push(['Source', t.source]);
  if (t.from_party) lines.push(['Kisse', t.from_party]);
  if (t.type === 'Transfer') lines.push(['', `${accName(t.account_id)} → ${accName(t.to_account_id)}`]);
  else if (t.account_id) lines.push(['Account', accName(t.account_id)]);
  if (t.payment_mode) lines.push(['Mode', t.payment_mode]);
  if (t.contract_id) lines.push(['Theka', (state.contracts.find((c) => c.id === t.contract_id) || {}).thekedar_name || '—']);
  if (t.notes) lines.push(['Note', t.notes]);

  const isUdhaar = t.type === 'Out' && t.payment_mode === 'Udhaar';
  const inner = `
    <h3>${CAT_ICON[t.category] || (t.type === 'In' ? '💰' : '🔁')} Detail</h3>
    <div class="report-card">${lines.map(([k, v]) => `<div class="rrow"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    ${isUdhaar ? '<button class="btn-primary" id="settle">✅ Udhaar chukaya (paid mark)</button>' : ''}
    <button class="btn-secondary" id="edit" style="width:100%;margin-top:8px">✏️ Edit</button>
    <button class="btn-primary danger" id="del">🗑️ Delete</button>
    <button class="btn-ghost" id="cancel">Band karo</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#edit').onclick = () => { closeSheet(); if (t.type === 'Out') openOutForm(t); else if (t.type === 'In') openInForm(t); else openTransferForm(t); };
    if (isUdhaar) root.querySelector('#settle').onclick = () => { closeSheet(); openSettleForm(t); };
  });
}

function openSettleForm(t) {
  const inner = `
    <h3>✅ Udhaar chukaya</h3>
    <p class="muted" style="margin:0 2px 8px">${esc(t.vendor || 'Vendor')} ka ${inr(t.amount)} — ab kis account se aur kis mode se diya?</p>
    <div class="field"><label>Account</label><select id="s-acc">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>Mode</label>${chipsHtml('smode', PAY_MODES.filter((m) => m !== 'Udhaar'), 'Cash')}</div>
    <div class="field"><label>Date</label><input id="s-date" type="date" value="${today()}" /></div>
    <button class="btn-primary" id="save">💾 Paid mark karo</button>
    <button class="btn-ghost" id="cancel">Cancel</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'smode');
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#save').onclick = async () => {
      const rec = Object.assign({}, t, { payment_mode: chipVal(root, 'smode'), account_id: root.querySelector('#s-acc').value, date: root.querySelector('#s-date').value || t.date });
      await saveTx(rec, false); closeSheet(); toast('Udhaar paid mark ho gaya');
    };
  });
}

/* ===================== FORM: Theka / Account ==================== */
function openThekaForm(existing) {
  const c = existing || { id: uid(), theka_amount: 0, start_date: today() };
  const inner = `
    <h3>${existing ? '✏️ Theka edit' : '➕ Naya Theka'}</h3>
    <div class="field"><label>Thekedar ka naam</label><input id="t-name" value="${esc(c.thekedar_name || '')}" placeholder="jaise Ram Mistry" /></div>
    <div class="field"><label>Kaam (kis cheez ka theka)</label><input id="t-kaam" value="${esc(c.kaam || '')}" placeholder="jaise Civil / Chhat / Plaster" /></div>
    <div class="field"><label>Theka amount ₹</label><input id="t-amt" type="number" inputmode="decimal" step="any" value="${c.theka_amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>Shuru date</label><input id="t-date" type="date" value="${c.start_date || today()}" /></div>
    <div class="field"><label>Note</label><textarea id="t-notes">${esc(c.notes || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 Save</button>
    ${existing ? '<button class="btn-primary danger" id="del">🗑️ Delete</button>' : ''}
    <button class="btn-ghost" id="cancel">Cancel</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = async () => {
      state.contracts = state.contracts.filter((x) => x.id !== c.id); cacheSet('contracts', state.contracts);
      await deleteRow('contracts', c.id); closeSheet(); refresh(); toast('Theka delete');
    };
    root.querySelector('#save').onclick = async () => {
      const rec = {
        id: c.id, user_id: userId(), thekedar_name: root.querySelector('#t-name').value.trim() || null,
        kaam: root.querySelector('#t-kaam').value.trim() || null, theka_amount: parseFloat(root.querySelector('#t-amt').value) || 0,
        start_date: root.querySelector('#t-date').value || null, notes: root.querySelector('#t-notes').value.trim() || null
      };
      const i = state.contracts.findIndex((x) => x.id === c.id);
      if (i >= 0) state.contracts[i] = rec; else state.contracts.push(rec);
      cacheSet('contracts', state.contracts);
      await pushRow('contracts', rec); closeSheet(); refresh(); toast('Theka save');
    };
  });
}

function openAccountForm(existing) {
  const a = existing || { id: uid(), type: 'Cash', opening_balance: 0 };
  const inner = `
    <h3>${existing ? '✏️ Account edit' : '➕ Naya Account'}</h3>
    <div class="field"><label>Naam</label><input id="a-name" value="${esc(a.name || '')}" placeholder="jaise HDFC Bank / Cash" /></div>
    <div class="field"><label>Type</label>${chipsHtml('atype', ['Cash', 'Bank'], a.type)}</div>
    <div class="field"><label>Opening balance ₹ (shuru me kitna tha)</label><input id="a-open" type="number" inputmode="decimal" step="any" value="${a.opening_balance ?? 0}" /></div>
    <button class="btn-primary" id="save">💾 Save</button>
    ${existing ? '<button class="btn-primary danger" id="del">🗑️ Delete</button>' : ''}
    <button class="btn-ghost" id="cancel">Cancel</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'atype');
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = async () => {
      if (state.transactions.some((t) => t.account_id === a.id || t.to_account_id === a.id)) return toast('Is account me entries hain, pehle hatao', true);
      state.accounts = state.accounts.filter((x) => x.id !== a.id); cacheSet('accounts', state.accounts);
      await deleteRow('accounts', a.id); closeSheet(); refresh(); toast('Account delete');
    };
    root.querySelector('#save').onclick = async () => {
      const rec = { id: a.id, user_id: userId(), name: root.querySelector('#a-name').value.trim() || 'Account', type: chipVal(root, 'atype'), opening_balance: parseFloat(root.querySelector('#a-open').value) || 0 };
      const i = state.accounts.findIndex((x) => x.id === a.id);
      if (i >= 0) state.accounts[i] = rec; else state.accounts.push(rec);
      cacheSet('accounts', state.accounts);
      await pushRow('accounts', rec); closeSheet(); refresh(); toast('Account save');
    };
  });
}

/* =========================== Save / Delete ====================== */
function userId() { return state.session && state.session.user ? state.session.user.id : null; }
async function saveTx(rec, isNew) {
  rec.user_id = userId();
  const i = state.transactions.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.transactions[i] = Object.assign({}, state.transactions[i], rec);
  else state.transactions.unshift(rec);
  // keep sorted by date desc
  state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  cacheSet('transactions', state.transactions);
  refresh();
  await pushRow('transactions', rec);
  renderHeader();
  toast(isNew ? 'Entry save ho gayi ✅' : 'Update ho gaya ✅');
}
function confirmDelete(t) {
  if (!confirm('Ye entry delete karein?')) return;
  state.transactions = state.transactions.filter((x) => x.id !== t.id);
  cacheSet('transactions', state.transactions);
  deleteRow('transactions', t.id);
  closeSheet(); refresh(); toast('Delete ho gaya');
}

/* ============================ Export ============================ */
function download(name, text, mime) {
  const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function exportCSV() {
  const cols = ['date', 'type', 'category', 'item', 'qty', 'unit', 'rate', 'amount', 'account', 'to_account', 'payment_mode', 'vendor', 'source', 'from_party', 'notes'];
  const head = cols.join(',');
  const rows = state.transactions.map((t) => cols.map((c) => {
    let v;
    if (c === 'account') v = accName(t.account_id);
    else if (c === 'to_account') v = t.to_account_id ? accName(t.to_account_id) : '';
    else v = t[c];
    v = v == null ? '' : String(v);
    return '"' + v.replace(/"/g, '""') + '"';
  }).join(','));
  download('pai-pai-' + today() + '.csv', '﻿' + head + '\n' + rows.join('\n'), 'text/csv;charset=utf-8');
  toast('CSV download ho gaya');
}
function exportJSON() {
  download('pai-pai-backup-' + today() + '.json', JSON.stringify({ accounts: state.accounts, contracts: state.contracts, transactions: state.transactions, exported: today() }, null, 2), 'application/json');
  toast('Backup download ho gaya');
}

/* ============================== AUTH ============================ */
function renderAuth() {
  if (!cfgValid()) state.authStep = 'config';
  else if (state.authStep === 'config') state.authStep = 'email';

  let body = '';
  if (state.authStep === 'config') {
    body = `
      <div class="auth-card">
        <p class="muted">Pehli baar setup: apna Supabase <b>Project URL</b> aur <b>anon key</b> daalein. (README me steps hain.)</p>
        <div class="field"><label>Project URL</label><input id="cfg-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" /></div>
        <div class="field"><label>Anon public key</label><input id="cfg-key" placeholder="eyJhbGci..." autocapitalize="off" autocorrect="off" /></div>
        <button class="btn-primary" id="cfg-save">Aage badho →</button>
      </div>`;
  } else if (state.authStep === 'email') {
    body = `
      <div class="auth-card">
        <p class="muted">Apni email daalein — 6-digit code aayega.</p>
        <div class="field"><label>Email</label><input id="au-email" type="email" inputmode="email" autocapitalize="off" autocorrect="off" placeholder="aap@example.com" value="${esc(state.authEmail)}" /></div>
        <button class="btn-primary" id="au-send">Code bhejo</button>
        <button class="btn-ghost" id="au-recfg">Cloud config badlo</button>
      </div>`;
  } else {
    body = `
      <div class="auth-card">
        <p class="muted"><b>${esc(state.authEmail)}</b> par bheja 6-digit code daalein.</p>
        <div class="field"><label>Code</label><input id="au-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" /></div>
        <button class="btn-primary" id="au-verify">Login</button>
        <button class="btn-ghost" id="au-back">← Email badlo</button>
      </div>`;
  }

  app().innerHTML = `
    <div class="auth-wrap">
      <img class="auth-logo" src="icons/icon-192.png" alt="logo" />
      <h1>Pai-Pai</h1>
      <p class="lead">Ghar banane ka pura hisaab — pai-pai ka, ek jagah safe cloud me.</p>
      ${body}
      <p class="muted mt16">Aapka data sirf aapko dikhega.</p>
    </div>`;

  if (state.authStep === 'config') {
    $('#cfg-save').onclick = () => {
      const url = $('#cfg-url').value, key = $('#cfg-key').value;
      if (!url || !key) return toast('Dono daalein', true);
      setCfg(url, key); if (!initClient()) return toast('Config galat lagti hai', true);
      state.authStep = 'email'; renderAuth();
    };
  } else if (state.authStep === 'email') {
    $('#au-recfg').onclick = () => { state.authStep = 'config'; renderAuth(); };
    $('#au-send').onclick = async () => {
      const email = $('#au-email').value.trim(); if (!email) return toast('Email daalein', true);
      state.authEmail = email; const btn = $('#au-send'); btn.textContent = 'Bhej rahe…'; btn.disabled = true;
      try {
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw error;
        state.authStep = 'otp'; renderAuth(); toast('Code email par bhej diya');
      } catch (e) { console.error(e); toast(e.message || 'Code bhejne me dikkat', true); btn.textContent = 'Code bhejo'; btn.disabled = false; }
    };
  } else {
    $('#au-back').onclick = () => { state.authStep = 'email'; renderAuth(); };
    $('#au-verify').onclick = async () => {
      const token = $('#au-otp').value.trim(); if (token.length < 6) return toast('6-digit code daalein', true);
      const btn = $('#au-verify'); btn.textContent = 'Check…'; btn.disabled = true;
      try {
        const { data, error } = await sb.auth.verifyOtp({ email: state.authEmail, token, type: 'email' });
        if (error) throw error;
        state.session = data.session; // onAuthStateChange bhi chalega
        await enterApp();
      } catch (e) { console.error(e); toast(e.message || 'Code galat', true); btn.textContent = 'Login'; btn.disabled = false; }
    };
  }
}

/* ============================ Bootstrap ========================= */
async function enterApp() {
  buildShell();
  app().querySelector('#screen').innerHTML = `<div class="full-loader"><div class="spinner"></div>Data load ho raha hai…</div>`;
  renderHeader();
  await loadAll();
  show('dashboard');
  renderHeader();
}

function bindConnectivity() {
  window.addEventListener('online', async () => { state.online = true; renderHeader(); await flushQueue(); await loadAll(); refresh(); });
  window.addEventListener('offline', () => { state.online = false; renderHeader(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.online && sb && state.session) { await flushQueue(); renderHeader(); }
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}

async function start() {
  registerSW();
  bindConnectivity();
  if (!initClient()) { renderAuth(); return; }
  try {
    const { data } = await sb.auth.getSession();
    state.session = data ? data.session : null;
  } catch (e) { console.warn(e); }
  sb.auth.onAuthStateChange((_ev, session) => {
    state.session = session;
    if (!session) { state.authStep = cfgValid() ? 'email' : 'config'; renderAuth(); }
  });
  if (state.session) await enterApp(); else renderAuth();
}

window.addEventListener('load', start);
