/* ===================================================================
   Pai-Pai — app logic (vanilla JS, offline-first, Supabase cloud)
   =================================================================== */
'use strict';

/* ----------------------------- Config ----------------------------- */
// Aap chahein to yahan seedha bhi daal sakte hain, warna app ke andar
// Settings/onboarding se save hoga (localStorage me).
const HARDCODED = {
  url: 'https://qqkjimcmthguobzfvvtd.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa2ppbWNtdGhndW9iemZ2dnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MjA3NjAsImV4cCI6MjA5ODE5Njc2MH0.Indd6lZ0TU_jhJ3VUZRwvhAvt06vEfGw0302Vh1St4g'
};

function getCfg() {
  if (HARDCODED.url && HARDCODED.key) return HARDCODED;
  try { return JSON.parse(localStorage.getItem('gk_cfg') || 'null'); } catch (_) { return null; }
}
function setCfg(url, key) { localStorage.setItem('gk_cfg', JSON.stringify({ url: url.trim(), key: key.trim() })); }
function cfgValid() { const c = getCfg(); return !!(c && c.url && c.key); }

/* --------------------------- Language (i18n) ---------------------- */
// Default English; Hinglish optional. t(en, hi) — domain words (Cash, Material, Sakda, Theka, Udhaar) stay same.
let lang = (function () { try { return localStorage.getItem('gk_lang') || 'en'; } catch (_) { return 'en'; } })();
function setLang(l) { lang = l; try { localStorage.setItem('gk_lang', l); } catch (_) { } }
function tr(en, hi) { return lang === 'hi' ? (hi != null ? hi : en) : en; }

/* --------------------------- Constants ---------------------------- */
const CATEGORIES = ['Material', 'Labour', 'Theka Payment', 'Architect', 'Misc'];
const PAY_MODES = ['Cash', 'UPI', 'Net Banking', 'Online', 'Udhaar'];
const SOURCES = ['Bank Withdrawal', 'Salary', 'Loan', 'Borrowed', 'Savings', 'Sale', 'Other'];
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
// Base categories + user ki banayi hui custom categories (naya person/service)
function allCats() { return Array.from(new Set([...CATEGORIES, ...learned('gk_categories')])); }

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
// Account ka balance track karna hai ya nahi (Bank ke liye user OFF kar sakta)
function accTracked(a) { return !(((a && a.notes) || '').includes('[[notrack]]')); }
function anyTracked(type) { return state.accounts.some((a) => a.type === type && accTracked(a)); }
function balByType(type) { return state.accounts.filter((a) => a.type === type && accTracked(a)).reduce((s, a) => s + balanceOf(a.id), 0); }
function spentViaAccount(id) { return state.transactions.filter((t) => t.type === 'Out' && t.account_id === id && t.payment_mode !== 'Udhaar').reduce((s, t) => s + (Number(t.amount) || 0), 0); }
function spentByType(type) { const ids = state.accounts.filter((a) => a.type === type).map((a) => a.id); return state.transactions.filter((t) => t.type === 'Out' && ids.includes(t.account_id) && t.payment_mode !== 'Udhaar').reduce((s, t) => s + (Number(t.amount) || 0), 0); }

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
      <div class="brand">
        <img class="brand-logo" src="icons/icon-192.png" alt="" />
        <div class="brand-text">
          <h1>Pai-Pai</h1>
          <div class="sub" id="hdr-sub">${tr('Construction ledger', 'Hisaab kitaab')}</div>
        </div>
      </div>
      <div id="sync-badge"></div>
    </header>
    <main id="screen"></main>
    <nav class="bottom-nav" id="nav"></nav>
  `;
  $('#nav').innerHTML = [
    ['dashboard', '🏠', tr('Home', 'Home')], ['entries', '📒', tr('Entries', 'Entries')], ['reports', '📊', tr('Reports', 'Reports')],
    ['theka', '🤝', tr('Theka', 'Theka')], ['settings', '⚙️', tr('Settings', 'Settings')]
  ].map(([v, i, l]) => `<button class="nav-item" data-view="${v}"><span class="ico">${i}</span>${l}</button>`).join('');
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-item'); if (b) show(b.dataset.view); });
}

function renderHeader() {
  const sub = $('#hdr-sub'); if (sub) sub.textContent = tr('Construction ledger', 'Hisaab kitaab');
  const badge = $('#sync-badge'); if (!badge) return;
  const pc = pendingCount();
  if (!state.online) badge.innerHTML = `<span class="sync-badge offline"><span class="dot"></span>${tr('Offline', 'Offline')}${pc ? ' · ' + pc : ''}</span>`;
  else if (pc) badge.innerHTML = `<span class="sync-badge pending"><span class="dot"></span>${tr('Sync', 'Sync')} ${pc}</span>`;
  else badge.innerHTML = `<span class="sync-badge"><span class="dot"></span>${tr('Synced', 'Synced')}</span>`;
  badge.onclick = async () => { if (state.online) { toast(tr('Syncing…', 'Sync ho raha hai…')); await flushQueue(); await loadAll(); refresh(); toast(tr('Synced', 'Sync ho gaya')); } };
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

/* ====================== Charts (SVG, no deps) ===================== */
const CAT_COLOR = { 'Material': '#1c7a49', 'Labour': '#1d6fd0', 'Theka Payment': '#e3a008', 'Architect': '#8b5cf6', 'Misc': '#94a3b8' };
let dashRange = 'month';   // dashboard donut range: month | all

function inrShort(n) {
  n = Number(n) || 0; const neg = n < 0; const a = Math.abs(n); let s;
  if (a >= 1e7) s = (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
  else if (a >= 1e5) s = (a / 1e5).toFixed(2).replace(/\.?0+$/, '') + 'L';
  else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  else s = String(Math.round(a));
  return (neg ? '−' : '') + '₹' + s;
}
function monthShort(m) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]; }

function catSegments(monthOnly) {
  const map = {};
  for (const t of state.transactions) {
    if (t.type !== 'Out') continue;
    if (monthOnly && !thisMonth(t.date)) continue;
    const k = t.category || 'Misc';
    map[k] = (map[k] || 0) + (Number(t.amount) || 0);
  }
  return Object.entries(map).map(([k, v]) => ({ label: k, value: v, color: CAT_COLOR[k] || '#94a3b8' }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
}
function last6MonthsSpend() {
  const now = new Date(); const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth(); let total = 0;
    for (const t of state.transactions) {
      if (t.type !== 'Out') continue;
      const td = new Date(t.date + 'T00:00:00');
      if (td.getFullYear() === y && td.getMonth() === m) total += Number(t.amount) || 0;
    }
    out.push({ label: monthShort(m), value: total });
  }
  return out;
}
function donutSVG(segs, total) {
  const r = 54, c = 2 * Math.PI * r, cx = 70, cy = 70, sw = 20; let acc = 0;
  const arcs = segs.map((s) => {
    const f = total ? s.value / total : 0;
    const dash = `${(f * c).toFixed(2)} ${(c - f * c).toFixed(2)}`;
    const off = (-acc * c).toFixed(2); acc += f;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cy})"/>`;
  }).join('');
  return `<svg viewBox="0 0 140 140" class="donut">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2f0" stroke-width="${sw}"/>${arcs}
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="10" fill="#6b7785" font-weight="600">${tr('Total', 'Total gaya')}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="17" fill="#0f1a14" font-weight="800">${inrShort(total)}</text>
  </svg>`;
}
function donutLegend(segs, total) {
  return `<div class="legend">${segs.map((s) => {
    const pct = total ? Math.round(s.value / total * 100) : 0;
    return `<div class="legend-item"><span class="dot-c" style="background:${s.color}"></span><span class="lg-k">${esc(s.label)}</span><span class="lg-v">${inr(s.value)} · ${pct}%</span></div>`;
  }).join('')}</div>`;
}
function barSVG(bars) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const W = 320, n = bars.length, gap = 12, bw = (W - gap * (n - 1)) / n, top = 18, base = 96;
  const body = bars.map((b, i) => {
    const bh = Math.round((b.value / max) * (base - top));
    const x = i * (bw + gap), y = base - bh;
    const lbl = b.value > 0 ? `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="9.5" fill="#6b7785" font-weight="700">${inrShort(b.value)}</text>` : '';
    return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 2)}" rx="5" fill="url(#barg)"/>${lbl}<text x="${x + bw / 2}" y="113" text-anchor="middle" font-size="10.5" fill="#6b7785" font-weight="600">${esc(b.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} 120" class="barchart"><defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2aa866"/><stop offset="1" stop-color="#0f5132"/></linearGradient></defs>${body}</svg>`;
}

/* ========================= SCREEN: DASHBOARD ====================== */
function screenDashboard() {
  const cashTracked = anyTracked('Cash'), bankTracked = anyTracked('Bank');
  const cashVal = cashTracked ? balByType('Cash') : spentByType('Cash');
  const bankVal = bankTracked ? balByType('Bank') : spentByType('Bank');
  const kul = sumOut(); const isMah = sumOut((t) => thisMonth(t.date));
  const udhaar = sumOut((t) => t.payment_mode === 'Udhaar');
  const recent = state.transactions.slice(0, 6);
  const segs = catSegments(dashRange === 'month');
  const segTotal = segs.reduce((s, x) => s + x.value, 0);
  const months = last6MonthsSpend();
  const hasMonthData = months.some((m) => m.value > 0);

  const html = `
    <div class="screen">
      <div class="balance-row">
        <div class="bal-card cash"><div class="label">💵 ${cashTracked ? tr('Cash in hand', 'Cash haath me') : tr('Cash spent', 'Cash se gaya')}</div><div class="amt">${inr(cashVal)}</div></div>
        <div class="bal-card bank"><div class="label">🏦 ${bankTracked ? tr('In bank', 'Bank me') : tr('Bank spent', 'Bank se gaya')}</div><div class="amt">${inr(bankVal)}</div></div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="label">${tr('Total spent', 'Kul kharcha')}</div><div class="amt spend">${inr(kul)}</div></div>
        <div class="stat"><div class="label">${tr('This month', 'Is mahine')}</div><div class="amt spend">${inr(isMah)}</div></div>
      </div>
      ${udhaar > 0 ? `<div class="stat-row"><div class="stat" style="grid-column:1/-1"><div class="label">⚠️ ${tr('Udhaar pending (to pay)', 'Udhaar baaki (dena hai)')}</div><div class="amt" style="color:#8a6100">${inr(udhaar)}</div></div></div>` : ''}

      <div class="actions">
        <button class="action-btn out" data-act="out"><span class="ico">💸</span>${tr('Expense (Money Out)', 'Kharcha (Paisa Gaya)')}</button>
        <button class="action-btn in" data-act="in"><span class="ico">➕</span>${tr('Money In', 'Paisa Aaya')}</button>
        <button class="action-btn transfer" data-act="transfer"><span class="ico">🔁</span>${tr('Transfer', 'Transfer')}</button>
      </div>

      <div class="report-card chart-card">
        <div class="chart-head">
          <h4>📊 ${tr('Where money went', 'Kharcha kahan gaya')}</h4>
          <div class="seg-toggle" id="dash-range">
            <button class="${dashRange === 'month' ? 'on' : ''}" data-r="month">${tr('This month', 'Is Mahina')}</button>
            <button class="${dashRange === 'all' ? 'on' : ''}" data-r="all">${tr('All', 'Sab')}</button>
          </div>
        </div>
        ${segs.length ? `<div class="donut-wrap">${donutSVG(segs, segTotal)}${donutLegend(segs, segTotal)}</div>`
          : `<div class="empty" style="padding:22px 8px"><div class="big">📊</div>${dashRange === 'month' ? tr('No expense this month yet', 'Is mahine abhi koi kharcha nahi') : tr('No expense yet', 'Abhi koi kharcha nahi')}</div>`}
      </div>

      ${hasMonthData ? `<div class="report-card chart-card"><h4>📅 ${tr('Monthly spend (6 months)', 'Mahine-wise kharcha (6 mahine)')}</h4>${barSVG(months)}</div>` : ''}

      <div class="section-label">${tr('Recent', 'Recent')}</div>
      <div class="list">${recent.length ? recent.map(entryRow).join('') : emptyState(tr('No entries yet. Start from the buttons above 👆', 'Abhi koi entry nahi. Upar se shuru karein 👆'))}</div>
    </div>`;

  const bind = () => {
    $('#screen').querySelectorAll('.action-btn').forEach((b) => b.onclick = () => {
      const a = b.dataset.act; if (a === 'out') openOutForm(); else if (a === 'in') openInForm(); else openTransferForm();
    });
    const rt = $('#dash-range');
    if (rt) rt.querySelectorAll('button').forEach((b) => b.onclick = () => { dashRange = b.dataset.r; renderScreen(); });
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
    title = t.category === 'Theka Payment' ? (tr('Theka', 'Theka') + (t.vendor ? ' — ' + t.vendor : '')) : (t.item || t.category || tr('Expense', 'Kharcha'));
    const bits = [];
    if (t.qty) bits.push(`${t.qty} ${t.unit || ''}${t.rate ? ' @' + inr(t.rate) : ''}`);
    if (t.vendor && t.category !== 'Theka Payment') bits.push(t.vendor);
    if (t.account_id) bits.push(accName(t.account_id));
    meta = bits.filter(Boolean).join(' · ');
  } else if (t.type === 'In') {
    cls = 'in'; amtCls = 'in'; sign = '+'; ico = '💰';
    title = t.source || tr('Money In', 'Paisa Aaya');
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
      <h2 class="title">${tr('All Entries', 'Saari Entries')}</h2>
      <div class="toolbar">
        <input id="ef-q" placeholder="🔍 ${tr('Item, vendor, note…', 'Item, vendor, note…')}" value="${esc(entryFilter.q)}" />
      </div>
      <div class="filter-chips" id="ef-chips">
        ${['all', 'Out', 'In', 'Transfer'].map((ty) => `<button class="chip sm ${entryFilter.type === ty ? 'active' : ''}" data-t="${ty}">${({ all: tr('All', 'Sab'), Out: tr('Expense', 'Kharcha'), In: tr('In', 'Aaya'), Transfer: tr('Transfer', 'Transfer') })[ty]}</button>`).join('')}
      </div>
      <div id="ef-sum" class="ef-sum"></div>
      <div class="list" id="ef-list"></div>
    </div>`;
  const bind = () => {
    const renderList = () => {
      let rows = state.transactions.slice();
      if (entryFilter.type !== 'all') rows = rows.filter((t) => t.type === entryFilter.type);
      const q = entryFilter.q.trim().toLowerCase();
      if (q) rows = rows.filter((t) => [t.item, t.vendor, t.notes, t.source, t.from_party, t.category].some((x) => (x || '').toLowerCase().includes(q)));
      const out = rows.filter((t) => t.type === 'Out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const inn = rows.filter((t) => t.type === 'In').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const bits = [`${rows.length} ${tr('entries', 'entries')}`];
      if (out) bits.push(`<b style="color:var(--red)">${tr('Gaya', 'Gaya')} ${inr(out)}</b>`);
      if (inn) bits.push(`<b style="color:var(--green)">${tr('Aaya', 'Aaya')} ${inr(inn)}</b>`);
      $('#ef-sum').innerHTML = rows.length ? bits.join(' · ') : '';
      $('#ef-list').innerHTML = rows.length ? rows.map(entryRow).join('') : emptyState(tr('Nothing found', 'Kuch nahi mila'));
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
function rangeLabel() { return { all: tr('All', 'Sab'), month: tr('This Month', 'Is Mahina'), lastmonth: tr('Last Month', 'Pichla Mahina') }[state.filterRange]; }
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
    return `<div class="rrow"><div class="k">${esc(c.thekedar_name || c.kaam || tr('Theka', 'Theka'))}<small>${esc(c.kaam || '')}</small></div>
      <div class="v">${inr(paid)} / ${inr(amt)}<br><small style="color:${baaki > 0 ? '#c0392b' : '#1f7a4d'}">${baaki > 0 ? tr('Left ', 'Baaki ') + inr(baaki) : tr('Paid', 'Pura')}</small></div></div>
      <div class="bar"><span style="width:${amt ? Math.min(100, Math.round(paid / amt * 100)) : 0}%"></span></div>`;
  }).join('');

  const html = `
    <div class="screen">
      <h2 class="title">${tr('Reports', 'Reports')} — ${rangeLabel()}</h2>
      <div class="filter-chips" id="rf-chips">
        ${['all', 'month', 'lastmonth'].map((r) => `<button class="chip sm ${state.filterRange === r ? 'active' : ''}" data-r="${r}">${({ all: tr('All', 'Sab'), month: tr('This Month', 'Is Mahina'), lastmonth: tr('Last Month', 'Pichla Mahina') })[r]}</button>`).join('')}
      </div>

      <div class="report-card">
        <h4>💼 ${tr('Account Balances (now)', 'Account Balances (abhi)')}</h4>
        ${state.accounts.map((a) => { const tk = accTracked(a); const v = tk ? inr(balanceOf(a.id)) : `<span class="muted" style="font-weight:600">${tr('Spent', 'Gaya')} ${inr(spentViaAccount(a.id))}</span>`; return `<div class="rrow"><div class="k">${a.type === 'Cash' ? '💵' : '🏦'} ${esc(a.name)}</div><div class="v">${v}</div></div>`; }).join('') || `<div class="muted">${tr('No account', 'Koi account nahi')}</div>`}
      </div>

      <div class="report-card">
        <h4>🔁 ${rangeLabel()} — ${tr('In vs Out', 'Aaya vs Gaya')}</h4>
        <div class="rrow"><div class="k">${tr('Total In', 'Total Aaya (In)')}</div><div class="v" style="color:#1f7a4d">${inr(totalIn)}</div></div>
        <div class="rrow"><div class="k">${tr('Total Out (spent)', 'Total Gaya (Kharcha)')}</div><div class="v" style="color:#c0392b">${inr(totalOut)}</div></div>
        <div class="total-line"><span>${tr('Savings / Difference', 'Bachat / Antar')}</span><span>${inr(totalIn - totalOut)}</span></div>
      </div>

      ${card('💰 ' + tr('Where money came from', 'Paisa kahan se aaya'), aaya, { bar: true })}
      ${card('📦 ' + tr('Category-wise spend', 'Category-wise kharcha'), byCat, { bar: true, red: true })}
      ${card('🧱 ' + tr('Item-wise (material/labour)', 'Item-wise (material/labour)'), byItem, { showQty: true })}
      ${card('🏪 ' + tr('Vendor / where it went', 'Vendor / kise gaya'), byVendor)}
      ${card('💳 ' + tr('Payment mode wise', 'Payment mode wise'), byMode)}

      ${state.contracts.length ? `<div class="report-card"><h4>🤝 ${tr('Theka tracking', 'Theka tracking')}</h4>${thekaRows}</div>` : ''}
      ${udhaarByVendor.length ? `<div class="report-card"><h4>⚠️ ${tr('Udhaar pending — total to pay (all-time)', 'Udhaar baaki — total dena hai (sab waqt ka)')}</h4>${udhaarByVendor.map((r) => `<div class="rrow"><div class="k">${esc(r.key)}</div><div class="v" style="color:#8a6100">${inr(r.amount)}</div></div>`).join('')}</div>` : ''}

      <button class="btn-secondary" id="csv-btn" style="width:100%;margin-top:6px">⬇️ ${tr('CSV / Excel export', 'CSV / Excel export')}</button>
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
      <h2 class="title">${tr('Theka (Contract)', 'Theka (Contract)')}</h2>
      <button class="btn-secondary" id="add-theka" style="width:100%;margin-bottom:12px">➕ ${tr('New Theka', 'Naya Theka')}</button>
      <div class="list">
        ${state.contracts.length ? state.contracts.map((c) => {
          const paid = contractPaid(c.id), amt = Number(c.theka_amount) || 0, baaki = amt - paid;
          const pct = amt ? Math.min(100, Math.round(paid / amt * 100)) : 0;
          return `<div class="report-card" data-id="${c.id}" style="cursor:pointer">
            <h4>🤝 ${esc(c.thekedar_name || tr('Thekedar', 'Thekedar'))}</h4>
            ${c.kaam ? `<div class="muted" style="margin:-4px 0 4px">${esc(c.kaam)}</div>` : ''}
            ${sqftLabel(c.notes) ? `<div class="muted" style="margin:0 0 8px">📐 ${esc(sqftLabel(c.notes))}</div>` : ''}
            <div class="rrow"><div class="k">${tr('Theka amount', 'Theka amount')}</div><div class="v">${inr(amt)}</div></div>
            <div class="rrow"><div class="k">${tr('Paid', 'Diya')}</div><div class="v" style="color:#1f7a4d">${inr(paid)}</div></div>
            <div class="rrow"><div class="k">${tr('Left', 'Baaki')}</div><div class="v" style="color:${baaki > 0 ? '#c0392b' : '#1f7a4d'}">${inr(baaki)}</div></div>
            <div class="bar"><span style="width:${pct}%"></span></div>
          </div>`;
        }).join('') : emptyState(tr('No theka yet. Add one with "New Theka".', 'Abhi koi theka nahi. "Naya Theka" se add karein.'))}
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
      <h2 class="title">${tr('Settings', 'Settings')}</h2>

      <div class="section-label">${tr('Language', 'Language')}</div>
      <div class="seg-toggle" id="lang-toggle" style="width:100%">
        <button class="${lang === 'en' ? 'on' : ''}" data-l="en" style="flex:1">English</button>
        <button class="${lang === 'hi' ? 'on' : ''}" data-l="hi" style="flex:1">Hinglish</button>
      </div>

      <div class="section-label">${tr('Accounts (where money is)', 'Accounts (paisa kahan hai)')}</div>
      <div class="list">
        ${state.accounts.map((a) => `<div class="entry" data-acc="${a.id}">
          <div class="ic">${a.type === 'Cash' ? '💵' : '🏦'}</div>
          <div class="body"><div class="ttl">${esc(a.name)}</div><div class="meta">${a.type} · ${tr('Balance', 'Balance')} ${inr(balanceOf(a.id))}</div></div>
          <div class="amt">›</div></div>`).join('')}
      </div>
      <button class="btn-secondary" id="add-acc" style="width:100%;margin-top:10px">➕ ${tr('New Account', 'Naya Account')}</button>

      <div class="section-label">${tr('Backup', 'Backup')}</div>
      <div class="small-actions">
        <button class="btn-secondary" id="exp-json">⬇️ ${tr('Backup (JSON)', 'Backup (JSON)')}</button>
        <button class="btn-secondary" id="exp-csv">⬇️ CSV</button>
      </div>
      <button class="btn-secondary" id="sync-now" style="width:100%;margin-top:8px">🔄 ${tr('Sync now', 'Abhi Sync karo')}</button>
      <button class="btn-secondary" id="import-btn" style="width:100%;margin-top:8px">📥 ${tr('Import entries (JSON)', 'Entries import (JSON)')}</button>
      <button class="btn-ghost" id="clear-all" style="width:100%;margin-top:8px;color:var(--red);border-color:#f3c9c4">🗑️ ${tr('Clear all data', 'Sab data clear karo')}</button>

      <div class="section-label">${tr('Cloud (Supabase)', 'Cloud (Supabase)')}</div>
      <div class="field"><label>${tr('Project URL', 'Project URL')}</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" /></div>
      <div class="field"><label>${tr('Anon public key', 'Anon public key')}</label><input id="cfg-key" value="${esc(c.key)}" placeholder="eyJ..." autocapitalize="off" autocorrect="off" /></div>
      <button class="btn-secondary" id="save-cfg" style="width:100%">💾 ${tr('Save cloud config', 'Cloud config save')}</button>

      <div class="section-label">${tr('Account', 'Account')}</div>
      <div class="muted" style="margin:0 2px 8px">${tr('Logged in', 'Logged in')}: ${esc(email || '—')}</div>
      <button class="btn-ghost" id="logout">🚪 ${tr('Logout', 'Logout')}</button>
      <div class="center muted mt16">Pai-Pai · v1</div>
    </div>`;

  const bind = () => {
    $('#lang-toggle').querySelectorAll('button').forEach((b) => b.onclick = () => { if (b.dataset.l !== lang) { setLang(b.dataset.l); refresh(); } });
    $('#add-acc').onclick = () => openAccountForm();
    $('#screen').querySelectorAll('.entry[data-acc]').forEach((el) => el.onclick = () => {
      const a = state.accounts.find((x) => x.id === el.dataset.acc); if (a) openAccountForm(a);
    });
    $('#exp-json').onclick = exportJSON;
    $('#exp-csv').onclick = exportCSV;
    $('#sync-now').onclick = async () => { toast(tr('Syncing…', 'Sync…')); await flushQueue(); await loadAll(); refresh(); toast(tr('Done', 'Ho gaya')); };
    $('#import-btn').onclick = openImportForm;
    $('#clear-all').onclick = clearAllData;
    $('#save-cfg').onclick = () => {
      const url = $('#cfg-url').value, key = $('#cfg-key').value;
      if (!url || !key) return toast(tr('Enter both URL and key', 'URL aur key dono daalein'), true);
      setCfg(url, key); toast(tr('Saved — reloading app', 'Save ho gaya — app reload ho raha hai')); setTimeout(() => location.reload(), 800);
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
    <h3>${existing ? tr('✏️ Edit expense', '✏️ Kharcha edit') : tr('➖ New Expense', '➖ Naya Kharcha')}</h3>
    <div class="field"><label>${tr('Category', 'Category')}</label>
      <div class="chips" data-chips="cat" id="cat-chips"></div>
      <div id="cat-new" class="hidden" style="display:flex;gap:8px;margin-top:8px">
        <input id="cat-new-input" placeholder="${tr('New category name', 'Nayi category ka naam')}" style="flex:1" autocapitalize="words" />
        <button type="button" class="btn-secondary" id="cat-new-add">${tr('Add', 'Add')}</button>
      </div>
    </div>

    <div id="item-block">
      <div class="field"><label>${tr('Item / Work', 'Item / Kaam')}</label>
        <input id="f-item" list="${itemsDL}" value="${esc(t.item || '')}" placeholder="${tr('e.g. Cement, Sariya, Kade, Taar…', 'jaise Cement, Sariya, Kade, Taar…')}" />
        <datalist id="${itemsDL}"></datalist>
      </div>
      <div class="row3">
        <div class="field"><label>${tr('Qty', 'Qty')}</label><input id="f-qty" type="number" inputmode="decimal" step="any" value="${t.qty ?? ''}" placeholder="0" /></div>
        <div class="field"><label>${tr('Unit', 'Unit')}</label><select id="f-unit">${unitOpts.map((u) => `<option ${u === t.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
        <div class="field"><label>${tr('Rate ₹', 'Rate ₹')}</label><input id="f-rate" type="number" inputmode="decimal" step="any" value="${t.rate ?? ''}" placeholder="0" /></div>
      </div>
    </div>

    <div id="theka-block" class="field hidden"><label>${tr('Which theka payment', 'Kis theke ka payment')}</label>
      <select id="f-contract"><option value="">${tr('— Choose theka —', '— Theka chuno —')}</option>${state.contracts.map((c) => `<option value="${c.id}" ${c.id === t.contract_id ? 'selected' : ''}>${esc(c.thekedar_name || c.kaam || tr('Theka', 'Theka'))}</option>`).join('')}</select>
    </div>

    <div class="field"><label>${tr('Amount ₹ (total)', 'Amount ₹ (kul)')}</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /><div class="amt-preview" id="amt-prev"></div></div>

    <div class="field"><label>${tr('From / to whom (vendor)', 'Kisse aaya / kise diya (vendor)')}</label><input id="f-vendor" list="dl-vendor" value="${esc(t.vendor || '')}" placeholder="${tr('shop / person name', 'dukaan / aadmi ka naam')}" />
      <datalist id="dl-vendor">${learned('gk_vendors').map((v) => `<option>${esc(v)}</option>`).join('')}</datalist></div>

    <div class="field"><label>${tr('Payment mode', 'Payment mode')}</label>${chipsHtml('mode', PAY_MODES, t.payment_mode)}</div>
    <div class="field" id="account-field"><label>${tr('Paid from (account)', 'Paisa kahan se gaya (account)')}</label><select id="f-account">${accOptions(t.account_id)}</select></div>

    <div class="row2">
      <div class="field"><label>${tr('Date', 'Date')}</label><input id="f-date" type="date" value="${t.date}" /></div>
    </div>
    <div class="field"><label>${tr('Note (optional)', 'Note (optional)')}</label><textarea id="f-notes" placeholder="${tr('any detail…', 'koi detail…')}">${esc(t.notes || '')}</textarea></div>

    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>
  `;
  openSheet(inner, (root) => {
    const updItems = (cat) => { root.querySelector('#' + itemsDL).innerHTML = itemSuggestions(cat).map((i) => `<option>${esc(i)}</option>`).join(''); };
    const toggleBlocks = (cat) => {
      const isTheka = cat === 'Theka Payment';
      const isPayment = isTheka || cat === 'Architect';   // Architect bhi seedha payment (item/qty/rate nahi)
      root.querySelector('#item-block').classList.toggle('hidden', isPayment);
      root.querySelector('#theka-block').classList.toggle('hidden', !isTheka);
    };
    // Custom categories: chips + "Naya" inline add (naya person/service)
    const catNew = root.querySelector('#cat-new'), catNewIn = root.querySelector('#cat-new-input');
    const renderCatChips = (selected) => {
      const wrap = root.querySelector('#cat-chips');
      wrap.innerHTML = allCats().map((c) => `<button type="button" class="chip ${c === selected ? 'active' : ''}" data-val="${esc(c)}">${esc(c)}</button>`).join('')
        + `<button type="button" class="chip cat-add" id="cat-add">+ ${tr('New', 'Naya')}</button>`;
      wrap.querySelectorAll('.chip[data-val]').forEach((c) => c.onclick = () => { catNew.classList.add('hidden'); renderCatChips(c.dataset.val); updItems(c.dataset.val); toggleBlocks(c.dataset.val); });
      root.querySelector('#cat-add').onclick = () => { catNew.classList.remove('hidden'); catNewIn.value = ''; catNewIn.focus(); };
    };
    const addCat = () => {
      const name = catNewIn.value.trim(); if (!name) return;
      learnList('gk_categories', name); catNew.classList.add('hidden');
      renderCatChips(name); updItems(name); toggleBlocks(name);
    };
    root.querySelector('#cat-new-add').onclick = addCat;
    catNewIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });

    // Udhaar par "Paid from (account)" chhupao — abhi kisi account se paisa nahi gaya
    const toggleAccount = (mode) => { root.querySelector('#account-field').classList.toggle('hidden', mode === 'Udhaar'); };

    renderCatChips(t.category);
    updItems(t.category); toggleBlocks(t.category);
    bindChips(root, 'mode', (m) => toggleAccount(m));
    toggleAccount(t.payment_mode);

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
        if (!rateNoticed) { rateNoticed = true; toast(tr('Filled last used rate — you can change it', 'Pichli baar ka rate bhar diya — badal sakte ho')); }
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
      const mode = chipVal(root, 'mode');
      const rec = {
        id: t.id, type: 'Out', date: root.querySelector('#f-date').value || today(),
        category: cat, amount: parseFloat(amount.value) || 0,
        account_id: mode === 'Udhaar' ? null : (root.querySelector('#f-account').value || null),
        payment_mode: mode,
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
      if (!(rec.amount > 0)) return toast(tr('Enter a valid amount', 'Amount sahi daalein'), true);
      learnList('gk_items_' + cat, rec.item); learnList('gk_vendors', rec.vendor);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* ====================== FORM: Paisa Aaya (In) ==================== */
function openInForm(existing) {
  const t = existing || { id: uid(), type: 'In', date: today(), source: 'Bank Nikasi', account_id: (state.accounts[0] || {}).id };
  const inner = `
    <h3>${existing ? tr('✏️ Edit money in', '✏️ Aaya edit') : tr('➕ Money In', '➕ Paisa Aaya')}</h3>
    <div class="field"><label>${tr('Received in (account)', 'Kahan aaya (account)')}</label><select id="f-account">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>${tr('Amount ₹', 'Amount ₹')}</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('Source (where from)', 'Kahan se aaya (source)')}</label>${chipsHtml('src', SOURCES, t.source)}</div>
    <div class="field"><label>${tr('From whom (name, optional)', 'Kisse (naam, optional)')}</label><input id="f-from" list="dl-from" value="${esc(t.from_party || '')}" placeholder="${tr('person / bank', 'aadmi / bank')}" />
      <datalist id="dl-from">${learned('gk_from').map((v) => `<option>${esc(v)}</option>`).join('')}</datalist></div>
    <div class="field"><label>${tr('Date', 'Date')}</label><input id="f-date" type="date" value="${t.date}" /></div>
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="f-notes">${esc(t.notes || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
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
      if (!(rec.amount > 0)) return toast(tr('Enter a valid amount', 'Amount sahi daalein'), true);
      learnList('gk_from', rec.from_party);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* ========================= FORM: Transfer ======================= */
function openTransferForm(existing) {
  const t = existing || { id: uid(), type: 'Transfer', date: today(), account_id: (state.accounts.find((a) => a.type === 'Bank') || state.accounts[0] || {}).id, to_account_id: (state.accounts.find((a) => a.type === 'Cash') || state.accounts[0] || {}).id };
  const inner = `
    <h3>${existing ? tr('✏️ Edit transfer', '✏️ Transfer edit') : '🔁 ' + tr('Transfer', 'Transfer')}</h3>
    <p class="muted" style="margin:0 2px 6px">${tr('E.g. cash withdrawn from bank, or one account to another.', 'Jaise: Bank se cash nikala, ya ek account se dusre me.')}</p>
    <div class="field"><label>${tr('From', 'Kahan se (from)')}</label><select id="f-from">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>${tr('To', 'Kahan (to)')}</label><select id="f-to">${accOptions(t.to_account_id)}</select></div>
    <div class="field"><label>${tr('Amount ₹', 'Amount ₹')}</label><input id="f-amount" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('Date', 'Date')}</label><input id="f-date" type="date" value="${t.date}" /></div>
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="f-notes">${esc(t.notes || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#save').onclick = async () => {
      const from = root.querySelector('#f-from').value, to = root.querySelector('#f-to').value;
      if (from === to) return toast(tr('Choose different From and To accounts', 'From aur To alag account chuno'), true);
      const rec = {
        id: t.id, type: 'Transfer', date: root.querySelector('#f-date').value || today(),
        amount: parseFloat(root.querySelector('#f-amount').value) || 0,
        account_id: from, to_account_id: to, payment_mode: 'Transfer',
        notes: root.querySelector('#f-notes').value.trim() || null
      };
      if (!(rec.amount > 0)) return toast(tr('Enter a valid amount', 'Amount sahi daalein'), true);
      await saveTx(rec, !existing); closeSheet();
    };
  });
}

/* =================== Entry detail (view/edit) =================== */
function openEntryDetail(t) {
  const lines = [];
  lines.push([tr('Type', 'Type'), { In: tr('Money In', 'Paisa Aaya'), Out: tr('Expense', 'Kharcha'), Transfer: tr('Transfer', 'Transfer') }[t.type]]);
  lines.push([tr('Amount', 'Amount'), inr(t.amount)]);
  lines.push([tr('Date', 'Date'), fmtDate(t.date)]);
  if (t.category) lines.push([tr('Category', 'Category'), t.category]);
  if (t.item) lines.push([tr('Item', 'Item'), t.item]);
  if (t.qty) lines.push([tr('Qty', 'Qty'), `${t.qty} ${t.unit || ''}${t.rate ? ' @ ' + inr(t.rate) : ''}`]);
  if (t.vendor) lines.push([tr('Vendor', 'Vendor'), t.vendor]);
  if (t.source) lines.push([tr('Source', 'Source'), t.source]);
  if (t.from_party) lines.push([tr('From', 'Kisse'), t.from_party]);
  if (t.type === 'Transfer') lines.push(['', `${accName(t.account_id)} → ${accName(t.to_account_id)}`]);
  else if (t.account_id) lines.push([tr('Account', 'Account'), accName(t.account_id)]);
  if (t.payment_mode) lines.push([tr('Mode', 'Mode'), t.payment_mode]);
  if (t.contract_id) lines.push([tr('Theka', 'Theka'), (state.contracts.find((c) => c.id === t.contract_id) || {}).thekedar_name || '—']);
  if (t.notes) lines.push([tr('Note', 'Note'), t.notes]);

  const isUdhaar = t.type === 'Out' && t.payment_mode === 'Udhaar';
  const inner = `
    <h3>${CAT_ICON[t.category] || (t.type === 'In' ? '💰' : '🔁')} ${tr('Detail', 'Detail')}</h3>
    <div class="report-card">${lines.map(([k, v]) => `<div class="rrow"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    ${isUdhaar ? `<button class="btn-primary" id="settle">✅ ${tr('Udhaar paid (mark)', 'Udhaar chukaya (paid mark)')}</button>` : ''}
    <button class="btn-secondary" id="edit" style="width:100%;margin-top:8px">✏️ ${tr('Edit', 'Edit')}</button>
    <button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>
    <button class="btn-ghost" id="cancel">${tr('Close', 'Band karo')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#edit').onclick = () => { closeSheet(); if (t.type === 'Out') openOutForm(t); else if (t.type === 'In') openInForm(t); else openTransferForm(t); };
    if (isUdhaar) root.querySelector('#settle').onclick = () => { closeSheet(); openSettleForm(t); };
  });
}

function openSettleForm(t) {
  const inner = `
    <h3>✅ ${tr('Udhaar paid', 'Udhaar chukaya')}</h3>
    <p class="muted" style="margin:0 2px 8px">${esc(t.vendor || tr('Vendor', 'Vendor'))} — ${inr(t.amount)}. ${tr('From which account and mode did you pay?', 'Ab kis account se aur kis mode se diya?')}</p>
    <div class="field"><label>${tr('Account', 'Account')}</label><select id="s-acc">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>${tr('Mode', 'Mode')}</label>${chipsHtml('smode', PAY_MODES.filter((m) => m !== 'Udhaar'), 'Cash')}</div>
    <div class="field"><label>${tr('Date', 'Date')}</label><input id="s-date" type="date" value="${today()}" /></div>
    <button class="btn-primary" id="save">💾 ${tr('Mark paid', 'Paid mark karo')}</button>
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'smode');
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#save').onclick = async () => {
      const rec = Object.assign({}, t, { payment_mode: chipVal(root, 'smode'), account_id: root.querySelector('#s-acc').value, date: root.querySelector('#s-date').value || t.date });
      await saveTx(rec, false); closeSheet(); toast(tr('Udhaar marked paid', 'Udhaar paid mark ho gaya'));
    };
  });
}

/* ===================== FORM: Theka / Account ==================== */
// Theka notes me sq-ft breakdown chhupa ke store/parse (bina nayi DB column ke)
function parseSqft(notes) {
  const m = (notes || '').match(/\[\[sqft:(\{.*?\})\]\]/);
  let sqft = null, text = notes || '';
  if (m) { try { sqft = JSON.parse(m[1]); } catch (_) { } text = (notes || '').replace(/\s*\[\[sqft:\{.*?\}\]\]/, '').trim(); }
  return { text, sqft };
}
function buildNote(text, sqft) {
  let n = (text || '').trim();
  if (sqft && (Number(sqft.ga) || Number(sqft.fa))) n = (n ? n + ' ' : '') + '[[sqft:' + JSON.stringify(sqft) + ']]';
  return n || null;
}
function sqftLabel(notes) {
  const s = parseSqft(notes).sqft; if (!s) return '';
  const g = Number(s.ga) || 0, gr = Number(s.gr) || 0, f = Number(s.fa) || 0, fr = Number(s.fr) || 0;
  const parts = [];
  if (g) parts.push(`G ${g}×₹${gr}`);
  if (f) parts.push(`1st ${f}×₹${fr}`);
  return parts.join(' + ');
}
function openThekaForm(existing) {
  const c = existing || { id: uid(), theka_amount: 0, start_date: today() };
  const sp = parseSqft(c.notes);
  const inner = `
    <h3>${existing ? tr('✏️ Edit theka', '✏️ Theka edit') : tr('➕ New Theka', '➕ Naya Theka')}</h3>
    <div class="field"><label>${tr('Thekedar name', 'Thekedar ka naam')}</label><input id="t-name" value="${esc(c.thekedar_name || '')}" placeholder="${tr('e.g. Ram Mistry', 'jaise Ram Mistry')}" /></div>
    <div class="field"><label>${tr('Work (theka for what)', 'Kaam (kis cheez ka theka)')}</label><input id="t-kaam" value="${esc(c.kaam || '')}" placeholder="${tr('e.g. Civil / Roof / Plaster', 'jaise Civil / Chhat / Plaster')}" /></div>

    <div class="section-label" style="margin-top:8px">${tr('Amount from sq-ft (optional)', 'Sq-ft se amount (optional)')}</div>
    <div class="row2"><div class="field"><label>${tr('Ground sqft', 'Ground sqft')}</label><input id="t-g-area" type="number" inputmode="decimal" placeholder="0" /></div><div class="field"><label>${tr('₹ / sqft', '₹ / sqft')}</label><input id="t-g-rate" type="number" inputmode="decimal" value="160" /></div></div>
    <div class="row2"><div class="field"><label>${tr('1st floor sqft', '1st floor sqft')}</label><input id="t-f-area" type="number" inputmode="decimal" placeholder="0" /></div><div class="field"><label>${tr('₹ / sqft', '₹ / sqft')}</label><input id="t-f-rate" type="number" inputmode="decimal" value="180" /></div></div>
    <div class="amt-preview" id="t-sqft-prev"></div>

    <div class="field"><label>${tr('Theka amount ₹', 'Theka amount ₹')}</label><input id="t-amt" type="number" inputmode="decimal" step="any" value="${c.theka_amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('Start date', 'Shuru date')}</label><input id="t-date" type="date" value="${c.start_date || today()}" /></div>
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="t-notes">${esc(sp.text || '')}</textarea></div>
    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    // Sq-ft calculator: ground × rate + 1st × rate → theka amount auto
    const gArea = root.querySelector('#t-g-area'), gRate = root.querySelector('#t-g-rate'), fArea = root.querySelector('#t-f-area'), fRate = root.querySelector('#t-f-rate'), amtEl = root.querySelector('#t-amt'), sqPrev = root.querySelector('#t-sqft-prev');
    const calcSqft = () => {
      const ga = parseFloat(gArea.value) || 0, gr = parseFloat(gRate.value) || 0, fa = parseFloat(fArea.value) || 0, fr = parseFloat(fRate.value) || 0;
      if (!ga && !fa) { sqPrev.textContent = ''; return; }
      const total = ga * gr + fa * fr; amtEl.value = total;
      sqPrev.innerHTML = `${ga ? ga + '×₹' + gr : ''}${ga && fa ? ' + ' : ''}${fa ? fa + '×₹' + fr : ''} = <b>${inr(total)}</b>`;
    };
    gArea.oninput = calcSqft; gRate.oninput = calcSqft; fArea.oninput = calcSqft; fRate.oninput = calcSqft;
    // pehle save ki hui sqft details wapas bhar do
    if (sp.sqft) {
      if (sp.sqft.ga != null) gArea.value = sp.sqft.ga;
      if (sp.sqft.gr != null) gRate.value = sp.sqft.gr;
      if (sp.sqft.fa != null) fArea.value = sp.sqft.fa;
      if (sp.sqft.fr != null) fRate.value = sp.sqft.fr;
      calcSqft();
    }

    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = async () => {
      state.contracts = state.contracts.filter((x) => x.id !== c.id); cacheSet('contracts', state.contracts);
      await deleteRow('contracts', c.id); closeSheet(); refresh(); toast(tr('Theka deleted', 'Theka delete'));
    };
    root.querySelector('#save').onclick = async () => {
      const rec = {
        id: c.id, user_id: userId(), thekedar_name: root.querySelector('#t-name').value.trim() || null,
        kaam: root.querySelector('#t-kaam').value.trim() || null, theka_amount: parseFloat(root.querySelector('#t-amt').value) || 0,
        start_date: root.querySelector('#t-date').value || null,
        notes: buildNote(root.querySelector('#t-notes').value, { ga: parseFloat(gArea.value) || 0, gr: parseFloat(gRate.value) || 0, fa: parseFloat(fArea.value) || 0, fr: parseFloat(fRate.value) || 0 })
      };
      const i = state.contracts.findIndex((x) => x.id === c.id);
      if (i >= 0) state.contracts[i] = rec; else state.contracts.push(rec);
      cacheSet('contracts', state.contracts);
      await pushRow('contracts', rec); closeSheet(); refresh(); toast(tr('Theka saved', 'Theka save'));
    };
  });
}

function openAccountForm(existing) {
  const a = existing || { id: uid(), type: 'Cash', opening_balance: 0 };
  const inner = `
    <h3>${existing ? tr('✏️ Edit account', '✏️ Account edit') : tr('➕ New Account', '➕ Naya Account')}</h3>
    <div class="field"><label>${tr('Name', 'Naam')}</label><input id="a-name" value="${esc(a.name || '')}" placeholder="${tr('e.g. HDFC Bank / Cash', 'jaise HDFC Bank / Cash')}" /></div>
    <div class="field"><label>${tr('Type', 'Type')}</label>${chipsHtml('atype', ['Cash', 'Bank'], a.type)}</div>
    <div class="field"><label>${tr('Opening balance ₹ (initial amount)', 'Opening balance ₹ (shuru me kitna tha)')}</label><input id="a-open" type="number" inputmode="decimal" step="any" value="${a.opening_balance ?? 0}" /></div>
    <div class="field"><label>${tr('Track running balance?', 'Iska balance track karu?')}</label>${chipsHtml('track', ['Yes', 'No'], accTracked(a) ? 'Yes' : 'No')}
      <div class="muted" style="margin-top:6px">${tr('Turn OFF for bank if you only log payments — no balance is shown, just total spent.', 'Bank ke liye OFF rakho agar sirf payment log karne hain — balance nahi dikhega, sirf total gaya.')}</div></div>
    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'atype'); bindChips(root, 'track');
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = async () => {
      if (state.transactions.some((t) => t.account_id === a.id || t.to_account_id === a.id)) return toast(tr('This account has entries — remove them first', 'Is account me entries hain, pehle hatao'), true);
      state.accounts = state.accounts.filter((x) => x.id !== a.id); cacheSet('accounts', state.accounts);
      await deleteRow('accounts', a.id); closeSheet(); refresh(); toast(tr('Account deleted', 'Account delete'));
    };
    root.querySelector('#save').onclick = async () => {
      const rec = { id: a.id, user_id: userId(), name: root.querySelector('#a-name').value.trim() || 'Account', type: chipVal(root, 'atype'), opening_balance: parseFloat(root.querySelector('#a-open').value) || 0, notes: chipVal(root, 'track') === 'No' ? '[[notrack]]' : null };
      const i = state.accounts.findIndex((x) => x.id === a.id);
      if (i >= 0) state.accounts[i] = rec; else state.accounts.push(rec);
      cacheSet('accounts', state.accounts);
      await pushRow('accounts', rec); closeSheet(); refresh(); toast(tr('Account saved', 'Account save'));
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
  toast(isNew ? tr('Entry saved ✅', 'Entry save ho gayi ✅') : tr('Updated ✅', 'Update ho gaya ✅'));
}
function confirmDelete(t) {
  if (!confirm(tr('Delete this entry?', 'Ye entry delete karein?'))) return;
  state.transactions = state.transactions.filter((x) => x.id !== t.id);
  cacheSet('transactions', state.transactions);
  deleteRow('transactions', t.id);
  closeSheet(); refresh(); toast(tr('Deleted', 'Delete ho gaya'));
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
  toast(tr('CSV downloaded', 'CSV download ho gaya'));
}
function exportJSON() {
  download('pai-pai-backup-' + today() + '.json', JSON.stringify({ accounts: state.accounts, contracts: state.contracts, transactions: state.transactions, exported: today() }, null, 2), 'application/json');
  toast(tr('Backup downloaded', 'Backup download ho gaya'));
}

/* ============================== Import ========================== */
// account ko type ('Cash'/'Bank') se resolve karo (na ho to bana do)
async function resolveAccount(type) {
  if (!type) return null;
  let a = state.accounts.find((x) => x.type === type);
  if (!a) { a = { id: uid(), user_id: userId(), name: type === 'Bank' ? 'Bank' : 'Cash (haath)', type: type, opening_balance: 0 }; state.accounts.push(a); cacheSet('accounts', state.accounts); await pushRow('accounts', a); }
  return a.id;
}
async function resolveTheka(name, startDate, kaam, amount, note) {
  if (!name) return null;
  let c = state.contracts.find((x) => (x.thekedar_name || '').toLowerCase() === name.toLowerCase());
  if (!c) { c = { id: uid(), user_id: userId(), thekedar_name: name, kaam: kaam || 'Mistry / Theka', theka_amount: Number(amount) || 0, start_date: startDate || today(), notes: note || null }; state.contracts.push(c); cacheSet('contracts', state.contracts); await pushRow('contracts', c); }
  return c.id;
}
function openImportForm() {
  const inner = `
    <h3>📥 ${tr('Import entries', 'Entries import')}</h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Paste the JSON I gave you and tap Import. Run only once.', 'Mera diya JSON paste karke Import dabao. Sirf ek baar chalao.')}</p>
    <div class="field"><textarea id="imp-json" style="min-height:170px" placeholder='[ {"date":"2026-04-20","category":"Material","vendor":"...","amount":38000,"mode":"Cash","acc":"Cash","note":"..."} ]'></textarea></div>
    <button class="btn-primary" id="imp-go">📥 ${tr('Import', 'Import')}</button>
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#imp-go').onclick = async () => {
      let arr;
      try { arr = JSON.parse(root.querySelector('#imp-json').value); } catch (e) { return toast(tr('Invalid JSON', 'JSON galat hai'), true); }
      if (!Array.isArray(arr) || !arr.length) return toast(tr('No entries found', 'Koi entry nahi mili'), true);
      const btn = root.querySelector('#imp-go'); btn.disabled = true; btn.textContent = tr('Importing…', 'Import ho raha…');
      let n = 0;
      for (const it of arr) {
        const amt = Number(it.amount) || 0; if (!(amt > 0)) continue;
        const accId = it.mode === 'Udhaar' ? null : await resolveAccount(it.acc);
        const cid = await resolveTheka(it.theka, it.date, it.theka_kaam, it.theka_amount, it.theka_note);
        const rec = {
          id: uid(), user_id: userId(), type: it.type || 'Out', date: it.date || today(), amount: amt,
          category: it.category || null, item: it.item || null,
          qty: it.qty != null ? Number(it.qty) : null, unit: it.unit || null, rate: it.rate != null ? Number(it.rate) : null,
          vendor: it.vendor || null, payment_mode: it.mode || null, account_id: accId, contract_id: cid,
          source: it.source || null, from_party: it.from || null, notes: it.note || null
        };
        state.transactions.push(rec); await pushRow('transactions', rec);
        if (it.vendor) learnList('gk_vendors', it.vendor);
        if (it.category && !CATEGORIES.includes(it.category)) learnList('gk_categories', it.category);
        n++;
      }
      state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));
      cacheSet('transactions', state.transactions);
      closeSheet(); refresh(); toast(tr(n + ' entries imported ✅', n + ' entries import ho gayi ✅'));
    };
  });
}

// Saari entries + thekas delete (accounts rehne do). Cloud se bhi hata do.
async function clearAllData() {
  if (!confirm(tr('Delete ALL entries and thekas? This cannot be undone.', 'Saari entries aur thekas delete kar du? Wapas nahi aayenge.'))) return;
  state.transactions = []; state.contracts = [];
  cacheSet('transactions', []); cacheSet('contracts', []);
  localStorage.removeItem('gk_pending');
  refresh();
  if (sb && state.online) {
    try {
      await sb.from('transactions').delete().eq('user_id', userId());
      await sb.from('contracts').delete().eq('user_id', userId());
    } catch (e) { console.warn('clear', e); }
  }
  toast(tr('All data cleared', 'Sab data clear ho gaya'));
}

/* ============================== AUTH ============================ */
function renderAuth() {
  if (!cfgValid()) state.authStep = 'config';
  else if (state.authStep === 'config') state.authStep = 'login';

  let body = '';
  if (state.authStep === 'config') {
    body = `
      <div class="auth-card">
        <p class="muted">${tr('First-time setup: enter your Supabase <b>Project URL</b> and <b>anon key</b>. (Steps in README.)', 'Pehli baar setup: apna Supabase <b>Project URL</b> aur <b>anon key</b> daalein. (README me steps hain.)')}</p>
        <div class="field"><label>${tr('Project URL', 'Project URL')}</label><input id="cfg-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" /></div>
        <div class="field"><label>${tr('Anon public key', 'Anon public key')}</label><input id="cfg-key" placeholder="eyJhbGci..." autocapitalize="off" autocorrect="off" /></div>
        <button class="btn-primary" id="cfg-save">${tr('Continue →', 'Aage badho →')}</button>
      </div>`;
  } else {
    body = `
      <div class="auth-card">
        <p class="muted">${tr('Log in with email and password. First time? Tap <b>"Create account"</b> below.', 'Email aur password se login karein. Pehli baar? Niche <b>"Naya account banao"</b>.')}</p>
        <div class="field"><label>${tr('Email', 'Email')}</label><input id="au-email" type="email" inputmode="email" autocapitalize="off" autocorrect="off" placeholder="you@example.com" value="${esc(state.authEmail)}" /></div>
        <div class="field"><label>${tr('Password', 'Password')}</label><input id="au-pass" type="password" autocapitalize="off" autocorrect="off" autocomplete="current-password" placeholder="${tr('at least 6 characters', 'kam se kam 6 character')}" /></div>
        <button class="btn-primary" id="au-login">${tr('Log in', 'Login')}</button>
        <button class="btn-secondary" id="au-signup" style="width:100%;margin-top:8px">${tr('Create account', 'Naya account banao')}</button>
        <button class="btn-ghost" id="au-recfg">${tr('Change cloud config', 'Cloud config badlo')}</button>
      </div>`;
  }

  app().innerHTML = `
    <div class="auth-wrap">
      <div class="seg-toggle" id="auth-lang" style="margin:0 auto 18px">
        <button class="${lang === 'en' ? 'on' : ''}" data-l="en">English</button>
        <button class="${lang === 'hi' ? 'on' : ''}" data-l="hi">Hinglish</button>
      </div>
      <img class="auth-logo" src="icons/icon-192.png" alt="logo" />
      <h1>Pai-Pai</h1>
      <p class="lead">${tr('The complete record of building your home — every rupee, in one safe place.', 'Ghar banane ka pura hisaab — har pai ka, ek surakshit jagah.')}</p>
      ${body}
      <p class="muted mt16">🔒 ${tr('Your data is secure — visible only to you.', 'Aapka data surakshit — sirf aapko dikhega.')}</p>
    </div>`;

  $('#auth-lang').querySelectorAll('button').forEach((b) => b.onclick = () => { if (b.dataset.l !== lang) { setLang(b.dataset.l); renderAuth(); } });

  if (state.authStep === 'config') {
    $('#cfg-save').onclick = () => {
      const url = $('#cfg-url').value, key = $('#cfg-key').value;
      if (!url || !key) return toast(tr('Enter both', 'Dono daalein'), true);
      setCfg(url, key); if (!initClient()) return toast(tr('Config looks invalid', 'Config galat lagti hai'), true);
      state.authStep = 'login'; renderAuth();
    };
  } else {
    $('#au-recfg').onclick = () => { state.authStep = 'config'; renderAuth(); };
    const creds = () => ({ email: $('#au-email').value.trim(), password: $('#au-pass').value });
    $('#au-login').onclick = async () => {
      const { email, password } = creds();
      if (!email || !password) return toast(tr('Enter email and password', 'Email aur password daalein'), true);
      state.authEmail = email; const btn = $('#au-login'); btn.textContent = tr('Logging in…', 'Login ho raha…'); btn.disabled = true;
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.session = data.session; await enterApp();
      } catch (e) { console.error(e); toast(e.message || tr('Login failed — check email/password', 'Login fail — email/password check karein'), true); btn.textContent = tr('Log in', 'Login'); btn.disabled = false; }
    };
    $('#au-signup').onclick = async () => {
      const { email, password } = creds();
      if (!email || password.length < 6) return toast(tr('Enter email + password (6+ characters)', 'Email + password (6+ character) daalein'), true);
      state.authEmail = email; const btn = $('#au-signup'); btn.textContent = tr('Creating…', 'Ban raha…'); btn.disabled = true;
      try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) { state.session = data.session; await enterApp(); }
        else { toast(tr('Account created — now tap "Log in"', 'Account ban gaya — ab "Login" dabao'), false); btn.textContent = tr('Create account', 'Naya account banao'); btn.disabled = false; }
      } catch (e) { console.error(e); toast(e.message || tr('Sign-up failed', 'Account banane me dikkat'), true); btn.textContent = tr('Create account', 'Naya account banao'); btn.disabled = false; }
    };
  }
}

/* ============================ Bootstrap ========================= */
async function enterApp() {
  buildShell();
  app().querySelector('#screen').innerHTML = `<div class="full-loader"><div class="spinner"></div>${tr('Loading data…', 'Data load ho raha hai…')}</div>`;
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

// Keyboard khulne par body.kb-open laga do → bottom-nav chhup jaye (iOS float fix)
function setupKeyboardNav() {
  const vv = window.visualViewport;
  if (vv) {
    const onR = () => document.body.classList.toggle('kb-open', (window.innerHeight - vv.height) > 140);
    vv.addEventListener('resize', onR); vv.addEventListener('scroll', onR);
  } else {
    document.addEventListener('focusin', (e) => { if (e.target.matches('input,textarea,select')) document.body.classList.add('kb-open'); });
    document.addEventListener('focusout', () => setTimeout(() => {
      const a = document.activeElement;
      if (!a || !a.matches('input,textarea,select')) document.body.classList.remove('kb-open');
    }, 120));
  }
}

async function start() {
  registerSW();
  bindConnectivity();
  setupKeyboardNav();
  if (!initClient()) { renderAuth(); return; }
  try {
    const { data } = await sb.auth.getSession();
    state.session = data ? data.session : null;
  } catch (e) { console.warn(e); }
  sb.auth.onAuthStateChange((_ev, session) => {
    state.session = session;
    if (!session) { state.authStep = cfgValid() ? 'login' : 'config'; renderAuth(); }
  });
  if (state.session) await enterApp(); else renderAuth();
}

window.addEventListener('load', start);
