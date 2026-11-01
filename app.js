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
const CATEGORIES = ['Material', 'Labour', 'Theka Payment', 'Architect', 'Misc', 'Personal'];
// Personal = ghar banane se alag kharcha (jaise jewellery, hospital). Cash/bank balance se katta hai,
// par "ghar ka kharcha" (kul kharcha, donut, mahine-wise, budget) me nahi gina jaata.
const NON_BUILD_CATS = ['Personal'];
function isBuildOut(t) { return t.type === 'Out' && !NON_BUILD_CATS.includes(t.category); }
const PAY_MODES = ['Cash', 'UPI', 'Net Banking', 'Online', 'Udhaar'];
const BANK_MODES = ['UPI', 'Net Banking', 'Online'];   // ye modes Bank account se jaate hain
const SOURCES = ['Bank Withdrawal', 'Salary', 'Loan', 'Borrowed', 'Savings', 'Sale', 'Other'];
const UNITS = ['Sakda', 'Trolley', 'Tractor', 'Truck', 'Bori', 'Kg', 'Quintal', 'Ton', 'Nag', 'Number', 'Hazaar', 'Ft', 'Sq Ft', 'Din', 'Litre', 'Tanker', 'Bundle'];
// Per-1000 pricing: in units me rate 1000 units ka hota hai (eint → Hazaar). Amount = qty × rate ÷ 1000.
// Qty hamesha POORI GINTI (pieces) me — jaise 5000 eint, rate ₹7600 per hazaar → ₹38,000.
const PER_1000_UNITS = ['Hazaar'];
// "3000 pcs @ ₹8,700/1000" — per-1000 unit ko saaf dikhao (warna "3000 Hazaar" = 30 lakh eint lagta tha)
function fmtQtyRate(t) {
  if (!t.qty) return '';
  if (PER_1000_UNITS.includes(t.unit)) return `${Number(t.qty).toLocaleString('en-IN')} pcs${t.rate ? ' @' + inr(t.rate) + '/1000' : ''}`;
  return `${t.qty} ${t.unit || ''}${t.rate ? ' @' + inr(t.rate) : ''}`;
}
// qty × rate — magar Hazaar jaise per-1000 unit pe rate 1000 ka hai, isliye 1000 se divide.
function lineAmount(q, r, unit) {
  q = Number(q); r = Number(r);
  if (isNaN(q) || isNaN(r)) return NaN;
  return PER_1000_UNITS.includes(unit) ? q * r / 1000 : q * r;
}
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
// Category ka default unit (jab item-specific match na ho) — Labour → Din, Misc → Number
const CAT_UNIT = { 'Material': 'Sakda', 'Labour': 'Din', 'Misc': 'Number' };
const DEFAULT_ITEMS = {
  'Material': ['Cement Normal', 'Cement 43', 'Cement', 'Sariya 8mm', 'Sariya 10mm', 'Sariya 12mm', 'Sariya', 'Reta', 'Bajri', 'Coarse Sand', 'Mitti', 'Kade', 'Taar', 'Eint', 'Gitti', 'Pathar', 'Pani', 'Tiles', 'Paint', 'Pipe', 'Wire', 'Switch', 'Darwaza', 'Khidki', 'Grill'],
  'Labour': ['Majdoor 600', 'Majdoor 650', 'Mistry 900', 'Mistry 950', 'Majdoor', 'Mistry', 'Beldaar', 'Plumber', 'Electrician', 'Painter', 'Welder', 'Carpenter', 'Extra Labour'],
  'Theka Payment': [],
  'Architect': [],
  'Misc': ['Transport / Bhada', 'Chai / Khana', 'Tools', 'Repair', 'JCB', 'Other'],
  'Personal': []
};
const CAT_ICON = { 'Material': '🧱', 'Labour': '👷', 'Theka Payment': '🤝', 'Architect': '📐', 'Misc': '🧾', 'Personal': '👤' };

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
  f: null,              // global filter (blankFilter) — Entries + Reports date range + tap-to-filter
  reportTab: 'summary', // summary | category | party | item | month
  khataTab: 'all', khataQ: '',
  entriesFrom: null     // kis tab se tap karke Entries aaye ("‹ Wapas" ke liye)
};
state.f = blankFilter();

/* --------------------------- DOM helpers -------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');
const modalRoot = () => document.getElementById('modal-root');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Paise tak round — store karne se pehle (warna 2.2×3000 = 6600.000000000001 jaisa float ban jaata)
function money(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function inr(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;   // pehle round, fir sign (taaki −₹0 na bane)
  const neg = n < 0; n = Math.abs(n);
  const s = n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return (neg ? '−' : '') + '₹' + s;
}
// "38,000" / " 8600 " / "₹5000" jaise input ko number me — comma/space/₹ hata ke (type=text fields)
function num(v) {
  if (v == null) return NaN;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return NaN;
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/* ---- Naam (vendor/item) ek jaisa rakhna: "Tinku biana" = "Tinku Biana" ---- */
// Comparison key: chhote akshar, sirf a-z/0-9/Hindi, space hata ke
function nameKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ''); }
// Har shabd bade akshar se? ("Tinku Biana" haan, "Tinku biana" nahi)
function titledName(x) { return String(x).split(/\s+/).every((w) => !/^[a-z]/.test(w)); }
// Kisi field ke saare naam data se: key → Title Case wali spelling, warna sabse zyada use hui
function spellingMap(values) {
  const cnt = {};
  for (const v of values) { const s = String(v || '').trim(); if (!s) continue; const k = nameKey(s); if (!k) continue; (cnt[k] = cnt[k] || {})[s] = (cnt[k][s] || 0) + 1; }
  const out = {};
  for (const k in cnt) {
    out[k] = Object.entries(cnt[k]).sort((a, b) => titledName(b[0]) - titledName(a[0]) || b[1] - a[1] || (b[0] > a[0] ? -1 : 1))[0][0];
  }
  return out;
}
function vendorMap() { return spellingMap([...state.transactions.map((t) => t.vendor), ...state.contracts.map((c) => c.thekedar_name), ...learned('gk_vendors')]); }
function itemMap() { return spellingMap([...state.transactions.map((t) => t.item), ...Object.values(DEFAULT_ITEMS).flat()]); }
// Type kiya naam agar pehle se kisi aur spelling me hai to wahi purani spelling use karo (naya variant na bane)
function canonName(v, map) { const s = String(v || '').trim(); if (!s) return null; return map[nameKey(s)] || s; }
function allVendors() { return Object.values(vendorMap()).sort((a, b) => a.localeCompare(b)); }

/* ---- Notes ke andar chhupe markers: [[notrack]], [[sqft:{..}]], [[paid:YYYY-MM-DD]] ---- */
function cleanNote(n) { return String(n || '').replace(/\s*\[\[[^\]]*\]\]/g, '').trim(); }
function paidOn(n) { const m = String(n || '').match(/\[\[paid:(\d{4}-\d{2}-\d{2})\]\]/); return m ? m[1] : null; }
function noteMarkers(n) { return (String(n || '').match(/\[\[[^\]]*\]\]/g) || []).join(' '); }
// Form me user sirf apna text dekhta hai; save par chhupe markers wapas jod do (sqft/notrack/paid na mitein)
function joinNote(text, markers) { const s = [String(text || '').trim(), markers || ''].filter(Boolean).join(' ').trim(); return s || null; }
function withPaidMark(n, d) { const base = String(n || '').replace(/\s*\[\[paid:[^\]]*\]\]/g, '').trim(); return (base ? base + ' ' : '') + '[[paid:' + d + ']]'; }

/* ---- Activity log — kya-kya hua + errors. Apni alag localStorage key; transactions/data ko haath nahi lagta ---- */
function logEvent(kind, msg, level) {
  try {
    const log = JSON.parse(localStorage.getItem('gk_activity') || '[]');
    log.unshift({ ts: new Date().toISOString(), kind: kind || 'info', msg: String(msg || ''), level: level === 'error' ? 'error' : 'info' });
    localStorage.setItem('gk_activity', JSON.stringify(log.slice(0, 200)));
  } catch (_) { }
}
function activityLog() { try { return JSON.parse(localStorage.getItem('gk_activity') || '[]'); } catch (_) { return []; } }
function markActSeen() { try { localStorage.setItem('gk_act_seen', new Date().toISOString()); } catch (_) { } }
function newErrorCount() { const s = localStorage.getItem('gk_act_seen') || ''; return activityLog().filter((e) => e.level === 'error' && e.ts > s).length; }
function msgOf(e) { return (e && (e.message || e.error_description || e.details)) || String(e || 'unknown'); }
function fmtLogTime(iso) { try { return new Date(iso).toLocaleString(); } catch (_) { return iso; } }
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
// Ek row ki pehchaan (table + id). Queue me har row ka sirf AAKHRI op rakhte hain — warna purana
// version baad me sync hokar naye wale ke upar likh deta tha.
function opKey(op) { return op.table + ':' + (op.type === 'delete' ? op.id : (op.row && op.row.id)); }
function enqueue(op) {
  if (!op._qid) op._qid = uid();
  const k = opKey(op);
  const q = queueGet().filter((x) => opKey(x) !== k);
  q.push(op); queueSet(q);
}
function hasPending(key) { return queueGet().some((op) => opKey(op) === key); }
function pendingCount() { return queueGet().length; }
// Server fetch ke baad bhi jo writes sync nahi hui (queue me padi hain) unhe rows me wapas mila do,
// warna user ki abhi-ki entry server-data se mit jaati thi (dikhna band ho jaati thi).
function mergePending(table, rows) {
  const q = queueGet().filter((op) => op.table === table);
  if (!q.length) return rows;
  let out = rows.slice();
  for (const op of q) {
    if (op.type === 'upsert' && op.row) {
      const i = out.findIndex((r) => r.id === op.row.id);
      if (i >= 0) out[i] = op.row; else out.unshift(op.row);
    } else if (op.type === 'delete') {
      out = out.filter((r) => r.id !== op.id);
    }
  }
  return out;
}

function learnList(key, value) {
  if (!value) return; value = String(value).trim(); if (!value) return;
  let arr; try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { arr = []; }
  if (!arr.some((x) => x.toLowerCase() === value.toLowerCase())) { arr.push(value); localStorage.setItem(key, JSON.stringify(arr)); }
}
function learned(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
function itemSuggestions(cat) {
  const base = DEFAULT_ITEMS[cat] || [];
  const custom = learned('gk_items_' + cat);
  const fromData = state.transactions.filter((t) => t.category === cat).map((t) => t.item).filter(Boolean);
  const map = spellingMap([...base, ...custom, ...fromData]);
  return Object.values(map);
}
// Base categories + user ki banayi hui custom categories (naya person/service)
// Data me jo category hai wo bhi (dusre phone pe banayi custom category yahan bhi dikhe)
function allCats() { return Array.from(new Set([...CATEGORIES, ...learned('gk_categories'), ...state.transactions.map((t) => t.category).filter(Boolean)])); }

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
// Sirf exact item+vendor ka rate (koi item-only guess nahi) — auto-fill isi se hota hai
function rbGetExact(item, vendor) {
  if (!item || !String(item).trim() || !vendor || !String(vendor).trim()) return null;
  const v = rbAll()[rbKey(item, vendor)];
  return v != null ? v : null;
}
function rbSet(item, vendor, rate) {
  if (!item || rate == null || isNaN(rate) || rate <= 0) return;
  const book = rbAll();
  book[rbKey(item, vendor)] = rate; book[rbKey(item, '')] = rate;
  localStorage.setItem('gk_ratebook', JSON.stringify(book));
}

// Smart defaults: har category ka last-used account + mode (sirf pre-fill, editable)
function catDefault(cat) { try { return (JSON.parse(localStorage.getItem('gk_def') || '{}'))[cat] || null; } catch (_) { return null; } }
function setCatDefault(cat, acc, mode) { if (!cat) return; let d; try { d = JSON.parse(localStorage.getItem('gk_def') || '{}'); } catch (_) { d = {}; } d[cat] = { acc: acc || null, mode: mode || null }; localStorage.setItem('gk_def', JSON.stringify(d)); }
// Recent (MRU) items/vendors for quick-pick chips
function bumpRecent(key, val) { if (!val) return; let a; try { a = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { a = []; } val = String(val); a = a.filter((x) => x.toLowerCase() !== val.toLowerCase()); a.unshift(val); localStorage.setItem(key, JSON.stringify(a.slice(0, 15))); }
// MRU (is phone ka) + data se recent (taaki naye phone par bhi purane naam aayein) — spelling data wali
function recentFromData(field, filterFn) {
  const seen = new Set(), out = [];
  for (const t of state.transactions) {   // transactions date-desc sorted hain
    if (filterFn && !filterFn(t)) continue;
    const v = (t[field] || '').trim(); const k = nameKey(v); if (!k || seen.has(k)) continue; seen.add(k); out.push(v);
  }
  return out;
}
function mergeRecent(mru, fromData, map) {
  const seen = new Set(), out = [];
  for (const v of [...mru, ...fromData]) { const c = canonName(v, map); const k = nameKey(c); if (!k || seen.has(k)) continue; seen.add(k); out.push(c); }
  return out.slice(0, 6);
}
function recentItems(cat) { const im = itemMap(); const r = mergeRecent(learned('gk_ri_' + cat), recentFromData('item', (t) => t.category === cat), im); return r.length ? r : itemSuggestions(cat).slice(0, 6); }
function recentVendors() { return mergeRecent(learned('gk_rv'), recentFromData('vendor', (t) => t.type === 'Out'), vendorMap()); }

/* --------------------------- Supabase ----------------------------- */
function initClient() {
  const c = getCfg(); if (!c || !c.url || !c.key) return false;
  try {
    sb = SB_LIB.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return true;
  } catch (e) { console.error(e); return false; }
}

// Cloud par likhna tabhi jab asli login session ho (offline-mode wala cached session nahi)
function canWrite() { return !!(sb && state.online && state.session && !state.session.offline); }
let flushing = false, flushAgain = false;
async function flushQueue() {
  if (!canWrite()) return;
  if (flushing) { flushAgain = true; return; }   // ek hi flush ek baar; beech me aaya kaam baad me
  flushing = true;
  try {
    let q = queueGet(); if (!q.length) return;
    let mutated = false;                // purani (bina id) ops ko bhi id do taaki theek se hat sakein
    for (const op of q) { if (!op._qid) { op._qid = uid(); mutated = true; } }
    if (mutated) queueSet(q);
    const doneIds = new Set();          // sirf jo sach me sync ho gaye, sirf unhe queue se hatao
    const blocked = new Set();          // jis row ka op fail hua, uske baad wale ops bhi ruko (order bana rahe)
    for (const op of q) {
      if (blocked.has(opKey(op))) continue;
      try {
        if (op.type === 'upsert') {
          const { error } = await sb.from(op.table).upsert(op.row);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await sb.from(op.table).delete().eq('id', op.id);
          if (error) throw error;
        }
        if (op._qid) doneIds.add(op._qid);
      } catch (e) { blocked.add(opKey(op)); console.warn('sync fail', e); logEvent('sync', tr('Sync failed for one item — will retry', 'Ek item sync fail — retry hoga') + ': ' + msgOf(e), 'error'); }
    }
    // queue dobara padho (flush ke beech jo nayi entry aayi wo bhi safe rahe) — sirf done ops hatao
    queueSet(queueGet().filter((op) => !(op._qid && doneIds.has(op._qid))));
  } finally {
    flushing = false;
    if (flushAgain) { flushAgain = false; if (pendingCount()) setTimeout(flushQueue, 0); }
    try { renderHeader(); } catch (_) { }
  }
}

async function pushRow(table, row) {
  // optimistic local already done by caller; here we try server or queue
  const op = { type: 'upsert', table, row };
  // Isi row ka koi purana op queue me pada hai? To seedha mat likho — queue me naya rakho (purana hat jayega)
  // aur flush karo, taaki order sahi rahe aur purana version naye ke upar na aaye.
  if (hasPending(opKey(op))) { enqueue(op); flushQueue(); return; }
  if (canWrite()) {
    try { const { error } = await sb.from(table).upsert(row); if (error) throw error; return; }
    catch (e) {
      console.warn(e);
      logEvent('sync', tr('Cloud save failed — kept for retry', 'Cloud pe save fail — retry me rakha') + ' (' + table + '): ' + msgOf(e), 'error');
      renderHeader(); toast(tr('Save failed — kept for retry (see Activity log)', 'Save fail — retry me rakha (Activity log dekho)'), true);
    }
  }
  enqueue(op);
}
async function deleteRow(table, id) {
  const op = { type: 'delete', table, id };
  if (hasPending(opKey(op))) { enqueue(op); flushQueue(); return; }
  if (canWrite()) {
    try { const { error } = await sb.from(table).delete().eq('id', id); if (error) throw error; return; }
    catch (e) {
      console.warn(e);
      logEvent('sync', tr('Cloud delete failed — kept for retry', 'Cloud delete fail — retry me rakha') + ' (' + table + '): ' + msgOf(e), 'error');
      renderHeader();
    }
  }
  enqueue(op);
}

/* --------------------------- Data load ---------------------------- */
// Cache se state turant bharo (sync, offline-first) — network ka wait nahi
function loadCache() {
  state.accounts = cacheGet('accounts');
  state.contracts = cacheGet('contracts');
  state.transactions = cacheGet('transactions');
}
// Cloud se latest le kar cache update karo (network) — background me chalta hai
// Supabase ek request me max 1000 rows deta hai — isliye pages me sab le aao (warna purani entries
// chup-chaap gayab ho jaati aur balance galat dikhta). Order me id bhi taaki pages stable rahein.
async function fetchAll(table, ordered) {
  const PAGE = 1000; let out = [];
  for (let from = 0; ; from += PAGE) {
    const r = await ordered(sb.from(table).select('*')).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (r.error) return { error: r.error };
    const rows = r.data || []; out = out.concat(rows);
    if (rows.length < PAGE) break;
  }
  return { data: out, error: null };
}
async function loadFromCloud() {
  if (!canWrite()) return;
  try {
    await flushQueue();
    const [a, c, t] = await Promise.all([
      fetchAll('accounts', (q) => q.order('created_at', { ascending: true })),
      fetchAll('contracts', (q) => q.order('created_at', { ascending: true })),
      fetchAll('transactions', (q) => q.order('date', { ascending: false }).order('created_at', { ascending: false }))
    ]);
    if (!a.error && a.data) {
      state.accounts = mergePending('accounts', a.data); cacheSet('accounts', state.accounts);
      // Default accounts SIRF tab banao jab fetch sach me chala aur 0 rows aaye — fetch error par
      // nahi (warna purane user ko duplicate phantom accounts mil jaate the).
      if (state.accounts.length === 0) { await ensureDefaultAccounts(); }
    }
    if (!c.error && c.data) { state.contracts = mergePending('contracts', c.data); cacheSet('contracts', state.contracts); }
    if (!t.error && t.data) { state.transactions = mergePending('transactions', t.data); cacheSet('transactions', state.transactions); }
  } catch (e) { console.warn('load error', e); logEvent('sync', tr('Load from cloud failed', 'Cloud se load fail') + ': ' + msgOf(e), 'error'); }
}
async function loadAll() { loadCache(); await loadFromCloud(); }

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
// Mode ke hisaab se sahi account: Cash -> Cash-type account, UPI/Net Banking/Online -> Bank-type.
// Current account pehle se sahi type ka ho to wahi rakho; warna us type ka pehla account.
function accountForMode(mode, curId) {
  if (mode === 'Udhaar') return null;
  const wantType = mode === 'Cash' ? 'Cash' : (BANK_MODES.includes(mode) ? 'Bank' : null);
  if (!wantType) return curId || null;
  const cur = accById(curId);
  if (cur && cur.type === wantType) return curId;
  const match = state.accounts.find((a) => a.type === wantType);
  return match ? match.id : (curId || null);
}

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
// Account ka balance track karna hai ya nahi (Bank ke liye user OFF kar sakta)
function accTracked(a) { return !(((a && a.notes) || '').includes('[[notrack]]')); }
function anyTracked(type) { return state.accounts.some((a) => a.type === type && accTracked(a)); }
function balByType(type) { return state.accounts.filter((a) => a.type === type && accTracked(a)).reduce((s, a) => s + balanceOf(a.id), 0); }
function spentViaAccount(id) { return state.transactions.filter((t) => t.type === 'Out' && t.account_id === id && t.payment_mode !== 'Udhaar').reduce((s, t) => s + (Number(t.amount) || 0), 0); }
function spentByType(type) { const ids = state.accounts.filter((a) => a.type === type).map((a) => a.id); return state.transactions.filter((t) => t.type === 'Out' && ids.includes(t.account_id) && t.payment_mode !== 'Udhaar').reduce((s, t) => s + (Number(t.amount) || 0), 0); }
// Ledger order: date (naya pehle), fir created_at. (loadAll ki server .order() bhi isi se match honi chahiye.)
function sortTxns() { state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')); }

// Global filter ki date range (Sab / Is mahina / Pichla / Custom)
function inRange(iso) { return inDates(iso, state.f); }
function thisMonth(iso) { const d = new Date(iso + 'T00:00:00'); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }

function sumOut(filterFn) {
  return state.transactions.filter((t) => t.type === 'Out' && (!filterFn || filterFn(t)))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}
// Naam ko chhote/bade akshar ya space ke fark se alag-alag mat gino ("Tinku biana" + "Tinku Biana" = ek row).
// Row ka naam = sabse zyada use hui spelling. Data nahi badalta, sirf report me jodta hai.
// rangeFilter: function(t) → shamil karo? (ya true = global date range)
function groupSum(type, keyFn, rangeFilter) {
  const map = {}, labels = {};
  for (const t of state.transactions) {
    if (t.type !== type) continue;
    if (typeof rangeFilter === 'function') { if (!rangeFilter(t)) continue; }
    else if (rangeFilter && !inRange(t.date)) continue;
    const raw = (keyFn(t) || '').toString().trim() || '—';
    const k = nameKey(raw) || raw;
    (labels[k] = labels[k] || {})[raw] = (labels[k][raw] || 0) + 1;
    if (!map[k]) map[k] = { amount: 0, qty: 0, count: 0, unit: '', units: {} };
    map[k].amount += Number(t.amount) || 0;
    map[k].qty += Number(t.qty) || 0;
    map[k].count++;
    if (t.qty && t.unit) map[k].units[t.unit] = (map[k].units[t.unit] || 0) + (Number(t.qty) || 0);
    if (!map[k].unit && t.unit) map[k].unit = t.unit;
  }
  const label = (k) => Object.entries(labels[k]).sort((a, b) => titledName(b[0]) - titledName(a[0]) || b[1] - a[1])[0][0];
  return Object.entries(map).map(([k, v]) => ({ key: label(k), ...v })).sort((a, b) => b.amount - a.amount);
}
// "5 Trolley · 2 Truck" — har unit ki qty alag (jodti nahi). Per-1000 unit (Hazaar) ki qty pieces me hai.
function fmtUnits(units) {
  const e = Object.entries(units || {}).filter(([, q]) => q);
  if (!e.length) return '';
  return e.map(([u, q]) => PER_1000_UNITS.includes(u) ? `${Number(q).toLocaleString('en-IN')} pcs` : `${+Number(q).toFixed(2)} ${u}`).join(' · ');
}
function contractPaid(cid) {
  return state.transactions.filter((t) => t.type === 'Out' && t.category === 'Theka Payment' && t.contract_id === cid && t.payment_mode !== 'Udhaar')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}
// Theka ki halat. Diya > amount = "advance" (kaam/measurement abhi baaki) — galti nahi, isliye laal nahi.
function thekaStatus(c) {
  const paid = contractPaid(c.id), amt = Number(c.theka_amount) || 0;
  if (!amt) return { paid, amt, kind: parseRates(c.notes).length ? 'ratewise' : 'noamount', diff: 0, measured: ratesTotal(parseRates(c.notes)) };
  if (paid > amt + 0.5) return { paid, amt, kind: 'advance', diff: paid - amt };
  if (amt - paid < 0.5) return { paid, amt, kind: 'done', diff: 0 };
  return { paid, amt, kind: 'baaki', diff: amt - paid };
}
function thekaStatusLine(s) {
  if (s.kind === 'noamount') return { k: tr('Theka amount', 'Theka amount'), v: tr('Not set — tap to add', 'Set nahi — daalo'), color: '#8a6100' };
  if (s.kind === 'ratewise') return { k: tr('Rate-wise theka', 'Rate-wise theka'), v: s.measured ? tr('measured ', 'measurement ') + inr(s.measured) : tr('measurement pending', 'measurement baaki'), color: '#1d6fd0' };
  if (s.kind === 'advance') return { k: tr('Advance (measurement pending)', 'Advance (measurement baaki)'), v: inr(s.diff), color: '#1d6fd0' };
  if (s.kind === 'done') return { k: tr('Left', 'Baaki'), v: tr('Fully paid', 'Pura'), color: '#1f7a4d' };
  return { k: tr('Left', 'Baaki'), v: inr(s.diff), color: '#c0392b' };
}

/* ---- Khata (party-wise hisaab): theka + side kaam ka udhaar ek jagah ---- */
function sortOldFirst(a, b) { return (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || ''); }
function pendingUdhaar(key) {
  return state.transactions.filter((t) => t.type === 'Out' && t.payment_mode === 'Udhaar' && (!key || nameKey(t.vendor) === key)).sort(sortOldFirst);
}
function parties() {
  const vm = vendorMap(), map = {};
  const get = (name) => { const k = nameKey(name); if (!k) return null; return map[k] || (map[k] = { key: k, name: canonName(name, vm), contracts: [], udhaar: 0, udhaarN: 0, paidTotal: 0, settled: 0, last: '' }); };
  for (const c of state.contracts) { const p = get(c.thekedar_name || c.kaam); if (p) p.contracts.push(c); }
  for (const t of state.transactions) {
    if (t.type !== 'Out' || !t.vendor) continue;
    const p = get(t.vendor);   // har vendor ki khata (supplier bhi) — sirf dikhane ke liye
    if (!p) continue;
    const a = Number(t.amount) || 0;
    if (t.payment_mode === 'Udhaar') { p.udhaar += a; p.udhaarN++; } else p.paidTotal += a;
    if (paidOn(t.notes)) p.settled += a;
    if ((t.date || '') > p.last) p.last = t.date;
  }
  return Object.values(map).sort((a, b) => (b.udhaar > 0) - (a.udhaar > 0) || b.last.localeCompare(a.last));
}
// Udhaar chukana: purani entries pehle. Poori chuki entry → wahi entry paid (mode/account) + [[paid:date]].
// Aakhri entry aadhi chuki → utni paid, baaki ki nayi Udhaar entry (same date/item/vendor). Amount kabhi nahi khota.
async function settleUdhaar(list, amount, accId, mode, payDate) {
  let left = money(amount); let n = 0;
  for (const t of list.slice().sort(sortOldFirst)) {
    if (left <= 0) break;
    const total = money(Number(t.amount) || 0);
    if (left >= total) {
      await saveTx(Object.assign({}, t, { payment_mode: mode, account_id: accId, notes: withPaidMark(t.notes, payDate) }), false, true);
      left = money(left - total); n++;
    } else {
      const paidRec = Object.assign({}, t, { amount: left, payment_mode: mode, account_id: accId, notes: withPaidMark(t.notes, payDate) });
      const remRec = Object.assign({}, t, { id: uid(), amount: money(total - left), payment_mode: 'Udhaar', account_id: null });
      delete remRec.created_at;
      await saveTx(paidRec, false, true); await saveTx(remRec, true, true);
      left = 0; n++;
    }
  }
  logEvent('entry', tr('Udhaar settled', 'Udhaar chukaya') + ': ' + inr(amount) + ' · ' + n + ' ' + tr('entries', 'entries') + ' · ' + mode, 'info');
  return n;
}

/* ===================== Global filter (Entries + Reports + Khata) ===================== */
// Ek hi filter object — Entries list, Reports ki date range aur har tap-to-filter isi ko use karte hain.
// Sirf dikhane/chhantne ka kaam: data kabhi nahi badalta.
function blankFilter() { return { q: '', party: '', category: '', item: '', mode: '', account: '', type: 'all', range: 'all', from: '', to: '', includePersonal: true }; }
const FILTER_KEYS = Object.keys(blankFilter());
function cleanFilter(part) { const out = {}; for (const k of FILTER_KEYS) if (part && part[k] !== undefined && part[k] !== null) out[k] = part[k]; return out; }
function isoDate(d) { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); }
function monthBounds(y, m) { return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) }; }
function rangeBounds(f) {
  const n = new Date();
  if (f.range === 'month') return monthBounds(n.getFullYear(), n.getMonth());
  if (f.range === 'lastmonth') return monthBounds(n.getFullYear(), n.getMonth() - 1);
  if (f.range === 'custom') return { from: f.from || '', to: f.to || '' };
  return { from: '', to: '' };
}
function inDates(iso, f) {
  const b = rangeBounds(f || {}); const d = iso || '';
  if (b.from && d < b.from) return false;
  if (b.to && d > b.to) return false;
  return true;
}
const WEEKDAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], hi: ['Ravi', 'Som', 'Mangal', 'Budh', 'Guru', 'Shukr', 'Shani'] };
function weekday(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : WEEKDAYS[lang === 'hi' ? 'hi' : 'en'][d.getDay()]; }
// Entries ke din wale header: "Aaj · 1 Nov", "Shukr, 17 Oct" (saal sirf tab jab is saal ka na ho)
function dayLabel(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-'); const md = parseInt(d, 10) + ' ' + monthShort(parseInt(m, 10) - 1) + (String(new Date().getFullYear()) === y ? '' : ' ' + y);
  if (iso === today()) return tr('Today', 'Aaj') + ' · ' + md;
  if (iso === yesterday()) return tr('Yesterday', 'Kal') + ' · ' + md;
  return weekday(iso) + ', ' + md;
}
function contractById(id) { return id ? state.contracts.find((c) => c.id === id) : null; }
// Party match: vendor / kisse aaya / (theka payment ho to) theke ka thekedar — naam case/space se fark nahi padta
function txPartyMatch(t, k) {
  if (!k) return true;
  if (nameKey(t.vendor) === k || nameKey(t.from_party) === k) return true;
  if (t.category === 'Theka Payment' && t.contract_id) { const c = contractById(t.contract_id); if (c && nameKey(c.thekedar_name || c.kaam) === k) return true; }
  return false;
}
const MONTH_RE = /\b(january|february|march|april|june|july|august|september|sept|october|november|december)\b/g;
function normQ(q) { return String(q || '').toLowerCase().replace(MONTH_RE, (m) => m.slice(0, 3)).replace(/\s+/g, ' ').trim(); }
function qAmount(s) { const x = String(s).replace(/[₹,\s]/g, '').replace(/^rs\.?/, ''); return /^\d+(\.\d+)?$/.test(x) ? Number(x) : null; }
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function searchHay(t) {
  const c = contractById(t.contract_id);
  return ' ' + [t.item, t.vendor, cleanNote(t.notes), t.source, t.from_party, t.category, t.payment_mode, c && c.thekedar_name, t.type === 'Transfer' ? 'transfer' : '', fmtDate(t.date)]
    .filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ') + ' ';
}
// Search: item/party/note/source/category/mode, amount ("17000", "17,000", "₹17000"), date/month ("oct", "1 nov")
function matchesQ(t, raw) {
  const q = normQ(raw); if (!q) return true;
  const whole = qAmount(q);
  if (whole != null && money(t.amount) === money(whole)) return true;
  const hay = searchHay(t);
  if (hay.includes(' ' + q)) return true;
  return q.split(' ').every((tok) => {
    const n = qAmount(tok);
    if (n != null) {
      if (money(t.amount) === money(n)) return true;
      return new RegExp('(^|[^0-9])' + escRe(tok.replace(/[₹,]/g, '')) + '([^0-9]|$)').test(hay);
    }
    return hay.includes(tok);
  });
}
function matchesFilter(t, f, skip) {
  f = f || state.f; const sk = skip || {};
  if (!sk.type && f.type && f.type !== 'all' && t.type !== f.type) return false;
  if (!sk.dates && !inDates(t.date, f)) return false;
  if (f.includePersonal === false && NON_BUILD_CATS.includes(t.category)) return false;
  if (f.party && !txPartyMatch(t, nameKey(f.party))) return false;
  if (f.category && nameKey(t.category) !== nameKey(f.category)) return false;
  if (f.item && nameKey(t.item) !== nameKey(f.item)) return false;
  if (f.mode && t.payment_mode !== f.mode) return false;
  if (f.account && t.account_id !== f.account && t.to_account_id !== f.account) return false;
  if (!sk.q && f.q && !matchesQ(t, f.q)) return false;
  return true;
}
function filteredTx(f, skip) { return state.transactions.filter((t) => matchesFilter(t, f, skip)); }
function rangeName(r) { return { all: tr('All', 'Sab'), month: tr('This month', 'Is mahina'), lastmonth: tr('Last month', 'Pichla'), custom: tr('Custom', 'Custom') }[r] || r; }
function rangeText(f) {
  if (!f || f.range === 'all' || !f.range) return '';
  if (f.range === 'month') return tr('This month', 'Is mahina');
  if (f.range === 'lastmonth') return tr('Last month', 'Pichla mahina');
  const a = f.from || '', b = f.to || '';
  if (a && b && a.slice(0, 7) === b.slice(0, 7)) {
    const mb = monthBounds(+a.slice(0, 4), +a.slice(5, 7) - 1);
    if (mb.from === a && mb.to === b) return monthShort(+a.slice(5, 7) - 1) + ' ' + a.slice(0, 4);
  }
  if (!a && !b) return tr('Custom dates', 'Custom date');
  return (a ? fmtDate(a) : '…') + ' – ' + (b ? fmtDate(b) : '…');
}
function typeName(ty) { return ({ all: tr('All', 'Sab'), Out: tr('Expense', 'Kharcha'), In: tr('In', 'Aaya'), Transfer: tr('Transfer', 'Transfer') })[ty] || ty; }
// Active filter ke chips ("Ram Mistry ✕") — type chips alag dikhte hain isliye yahan nahi
function activeFilterChips(f) {
  const out = [];
  if (f.range && f.range !== 'all') out.push({ k: 'range', label: '📅 ' + rangeText(f) });
  if (f.party) out.push({ k: 'party', label: f.party });
  if (f.category) out.push({ k: 'category', label: f.category });
  if (f.item) out.push({ k: 'item', label: f.item });
  if (f.mode) out.push({ k: 'mode', label: f.mode });
  if (f.account) out.push({ k: 'account', label: accName(f.account) });
  if (f.includePersonal === false) out.push({ k: 'includePersonal', label: tr('Without Personal', 'Personal ke bina') });
  if (f.q) out.push({ k: 'q', label: '🔍 "' + f.q + '"' });
  return out;
}
function filterCount(f) { return activeFilterChips(f).filter((c) => c.k !== 'q').length + (f.type && f.type !== 'all' ? 1 : 0); }
function filterActive(f) { return filterCount(f) > 0 || !!(f.q && f.q.trim()); }
function clearFilterKey(f, k) {
  const b = blankFilter();
  if (k === 'range') { f.range = 'all'; f.from = ''; f.to = ''; } else f[k] = b[k];
}
function filterJson(f) { return JSON.stringify(cleanFilter(Object.assign(blankFilter(), f))); }
function rowsTotals(rows) {
  const s = { out: 0, inn: 0, ud: 0 };
  for (const t of rows) { const a = Number(t.amount) || 0; if (t.type === 'Out') { s.out += a; if (t.payment_mode === 'Udhaar') s.ud += a; } else if (t.type === 'In') s.inn += a; }
  return s;
}
// Kisi aur screen se tap → Entries is filter ke saath. refine = Entries ke andar hi (baaki filter rehte hain).
function openEntriesWith(part, opts) {
  opts = opts || {};
  let f;
  if (opts.refine) f = Object.assign({}, state.f, cleanFilter(part));
  else {
    f = blankFilter();
    if (opts.keepDates) { f.range = state.f.range; f.from = state.f.from; f.to = state.f.to; }
    Object.assign(f, cleanFilter(part));
  }
  state.f = f; efLimit = EF_PAGE;
  if (state.view !== 'entries') state.entriesFrom = state.view;
  scrollPos.entries = 0;
  if (state.view === 'entries') renderScreen(0); else show('entries', { top: true });
}

/* ---- Saved views (filter ko naam se save — sirf is phone pe, localStorage gk_views) ---- */
function savedViews() { try { const a = JSON.parse(localStorage.getItem('gk_views') || '[]'); return Array.isArray(a) ? a.filter((v) => v && v.name && v.f) : []; } catch (_) { return []; } }
function setSavedViews(a) { try { localStorage.setItem('gk_views', JSON.stringify(a)); } catch (_) { } }
function defaultViewName(f) {
  const bits = activeFilterChips(f).filter((c) => c.k !== 'q').map((c) => c.label.replace(/^📅 /, ''));
  if (f.type && f.type !== 'all') bits.unshift(typeName(f.type));
  if (f.q) bits.push('"' + f.q + '"');
  return bits.join(' · ').slice(0, 40) || tr('My view', 'Mera view');
}
function openSaveView() {
  const f = Object.assign({}, state.f);
  const inner = `
    <h3>⭐ ${tr('Save this view', 'Ye view save karo')}</h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Saves the current filter with a name, shown at the top of Entries. Saved on this phone only.', 'Abhi wala filter ek naam se save hoga — Entries me upar chip ban ke dikhega. Sirf is phone pe save hota hai.')}</p>
    <div class="field"><label>${tr('Name', 'Naam')}</label><input id="sv-name" value="${esc(defaultViewName(f))}" maxlength="40" autocomplete="off" /></div>
    <div class="active-chips">${activeFilterChips(f).map((c) => `<span class="chip sm static ud">${esc(c.label)}</span>`).join('')}${f.type !== 'all' ? `<span class="chip sm static">${esc(typeName(f.type))}</span>` : ''}</div>
    <button class="btn-primary" id="sv-save">⭐ ${tr('Save view', 'View save karo')}</button>
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#sv-save').onclick = () => {
      const name = root.querySelector('#sv-name').value.trim();
      if (!name) return toast(tr('Enter a name', 'Naam daalo'), true);
      const views = savedViews().filter((v) => v.name.toLowerCase() !== name.toLowerCase());
      views.push({ name, f: cleanFilter(f) }); setSavedViews(views);
      closeSheet(); renderScreen(); toast(tr('View saved ⭐', 'View save ho gaya ⭐'));
    };
  });
}
function deleteSavedView(i) {
  const views = savedViews(); const v = views[i]; if (!v) return;
  if (!confirm(tr('Delete saved view "' + v.name + '"? (Entries are not affected)', '"' + v.name + '" view hata dein? (Entries pe koi asar nahi)'))) return;
  views.splice(i, 1); setSavedViews(views); renderScreen(); toast(tr('View deleted', 'View hata diya'));
}

/* ---- Navigation: back button sheet band kare / pichla tab, Entries ka scroll yaad ---- */
const scrollPos = {};
const VIEW_NAMES = () => ({ dashboard: tr('Home', 'Home'), entries: tr('Entries', 'Entries'), reports: tr('Reports', 'Reports'), theka: tr('Khata', 'Khata'), settings: tr('Settings', 'Settings') });
let historyBound = false;
function bindHistory() {
  try { history.replaceState({ v: state.view }, ''); } catch (_) { }
  if (historyBound) return; historyBound = true;
  window.addEventListener('popstate', (e) => {
    if (!document.querySelector('.bottom-nav')) return;
    if (modalRoot() && modalRoot().children.length) { closeSheet(); try { history.pushState({ v: state.view }, ''); } catch (_) { } return; }
    const v = e.state && e.state.v;
    if (v && v !== state.view) show(v, { fromPop: true, restore: true });
  });
}

/* ---- Party helpers (Kharcha form ke smart defaults + Khata) ---- */
// Party ki pichli entries se: sabse zyada wali category, har category ka aakhri item, aakhri mode, theke
function partyProfile(name) {
  const k = nameKey(name); if (!k) return null;
  const rows = state.transactions.filter((t) => t.type === 'Out' && nameKey(t.vendor) === k);   // date-desc
  const contracts = state.contracts.filter((c) => nameKey(c.thekedar_name || c.kaam) === k);
  if (!rows.length && !contracts.length) return null;
  const cc = {}, firstIdx = {};
  rows.forEach((t, i) => { if (!t.category) return; cc[t.category] = (cc[t.category] || 0) + 1; if (firstIdx[t.category] == null) firstIdx[t.category] = i; });
  const topCat = Object.keys(cc).sort((a, b) => cc[b] - cc[a] || firstIdx[a] - firstIdx[b])[0] || null;
  const im = itemMap(), lastItemByCat = {};
  for (const t of rows) if (t.category && t.item && !lastItemByCat[t.category]) lastItemByCat[t.category] = canonName(t.item, im);
  return { key: k, name: canonName(name, vendorMap()), topCat, lastItemByCat, lastMode: rows.length ? rows[0].payment_mode : null, contracts, n: rows.length };
}
function pickContract(cs) { return cs.find((c) => thekaStatus(c).kind !== 'done') || cs[0] || null; }
function thekaShortStatus(s) {
  if (s.kind === 'baaki') return tr('left ', 'baaki ') + inr(s.diff);
  if (s.kind === 'advance') return tr('advance ', 'advance ') + inr(s.diff);
  if (s.kind === 'done') return tr('fully paid', 'pura ho gaya');
  if (s.kind === 'ratewise') return tr('rate-wise · paid ', 'rate-wise · diya ') + inr(s.paid);
  return tr('paid ', 'diya ') + inr(s.paid);
}
// Party ka poora ledger: vendor naam se + theke se linked theka payments (vendor kuch bhi likha ho)
function partyLedger(p) {
  const ids = new Set(p.contracts.map((c) => c.id));
  return state.transactions.filter((t) => t.type === 'Out' && (nameKey(t.vendor) === p.key || (t.category === 'Theka Payment' && t.contract_id && ids.has(t.contract_id))));
}
// Home "Recent party" chips: date ke hisaab se aakhri 6 party
function recentParties(n) {
  const vm = vendorMap(), seen = new Set(), out = [];
  for (const t of state.transactions) {
    if (t.type !== 'Out' || !t.vendor) continue;
    const k = nameKey(t.vendor); if (!k || seen.has(k)) continue;
    seen.add(k); out.push(canonName(t.vendor, vm)); if (out.length >= n) break;
  }
  return out;
}

/* ---- Date field with quick chips (Aaj / Kal) — har form me date dikhe (37% entries purani date ki) ---- */
function dateFieldHtml(id, val) {
  return `<div class="field"><label>${tr('Date', 'Date')}</label><div class="date-row"><input id="${id}" type="date" value="${esc(val || today())}" />
    <div class="chips date-chips" data-date-for="${id}"><button type="button" class="chip sm" data-d="0">${tr('Today', 'Aaj')}</button><button type="button" class="chip sm" data-d="1">${tr('Yesterday', 'Kal')}</button></div></div>
    <div class="date-hint" id="${id}-hint"></div></div>`;
}
function bindDateField(root, id) {
  const el = root.querySelector('#' + id), wrap = root.querySelector(`[data-date-for="${id}"]`), hint = root.querySelector('#' + id + '-hint');
  if (!el || !wrap) return;
  const paint = () => {
    const v = el.value;
    wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', v === (c.dataset.d === '0' ? today() : yesterday())));
    if (hint) hint.textContent = v && v !== today() && v !== yesterday() ? '📅 ' + weekday(v) + ', ' + fmtDate(v) + ' — ' + tr('earlier date', 'purani date') : '';
  };
  wrap.querySelectorAll('.chip').forEach((c) => c.onclick = () => { el.value = c.dataset.d === '0' ? today() : yesterday(); paint(); });
  el.addEventListener('change', paint); el.addEventListener('input', paint); paint();
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
    <aside class="side-nav" id="side-nav" aria-label="${esc(tr('Main menu', 'Menu'))}"></aside>
  `;
  $('#nav').innerHTML = [
    ['dashboard', '🏠', tr('Home', 'Home')], ['entries', '📒', tr('Entries', 'Entries')], ['reports', '📊', tr('Reports', 'Reports')],
    ['theka', '👥', tr('Khata', 'Khata')], ['settings', '⚙️', tr('Settings', 'Settings')]
  ].map(([v, i, l]) => `<button class="nav-item" data-view="${v}"><span class="ico">${i}</span>${l}</button>`).join('');
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-item'); if (b) { if (b.dataset.view === 'entries') state.entriesFrom = null; show(b.dataset.view); } });
  // Laptop/desktop (>=1100px): left sidebar — wahi 5 tab + naya kharcha (CSS hi decide karta hai kaunsa nav dikhe)
  $('#side-nav').innerHTML = `<div class="side-brand"><img src="icons/icon-192.png" alt="" /><b>Pai-Pai</b></div>
    <button type="button" class="side-new" id="side-new">💸 ${tr('New expense', 'Naya kharcha')} <kbd>N</kbd></button>` + [
    ['dashboard', '🏠', tr('Home', 'Home')], ['entries', '📒', tr('Entries', 'Entries')], ['reports', '📊', tr('Reports', 'Reports')],
    ['theka', '👥', tr('Khata', 'Khata')], ['settings', '⚙️', tr('Settings', 'Settings')]
  ].map(([v, i, l]) => `<button type="button" class="side-item" data-view="${v}"><span class="ico">${i}</span><span>${l}</span></button>`).join('') +
    `<div class="side-help">${tr('Shortcuts', 'Shortcuts')}: <kbd>N</kbd> ${tr('new expense', 'naya kharcha')} · <kbd>/</kbd> ${tr('search', 'search')} · <kbd>Esc</kbd> ${tr('close', 'band')}</div>`;
  $('#side-nav').addEventListener('click', (e) => { const b = e.target.closest('.side-item'); if (b) { if (b.dataset.view === 'entries') state.entriesFrom = null; show(b.dataset.view); } });
  $('#side-new').onclick = () => openOutForm();
  // Sticky din-headers app-header ke neeche chipkein
  const setHdr = () => { const h = document.querySelector('.app-header'); if (h) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px'); };
  setHdr(); if (!window.__ppHdr) { window.__ppHdr = true; window.addEventListener('resize', setHdr); }
}

function renderHeader() {
  const sub = $('#hdr-sub'); if (sub) sub.textContent = tr('Construction ledger', 'Hisaab kitaab');
  const badge = $('#sync-badge'); if (!badge) return;
  const pc = pendingCount();
  let sync;
  if (!state.online) sync = `<span class="sync-badge offline"><span class="dot"></span>${tr('Offline', 'Offline')}${pc ? ' · ' + pc : ''}</span>`;
  else if (pc) sync = `<span class="sync-badge pending"><span class="dot"></span>${tr('Sync', 'Sync')} ${pc}</span>`;
  else sync = `<span class="sync-badge"><span class="dot"></span>${tr('Synced', 'Synced')}</span>`;
  const errN = newErrorCount();
  const err = errN ? `<span class="sync-badge err" id="err-badge">⚠️ ${errN}</span>` : '';
  badge.innerHTML = err + sync;
  const syncEl = badge.querySelector('.sync-badge:not(.err)');
  if (syncEl) syncEl.onclick = async () => { if (state.online) { toast(tr('Syncing…', 'Sync ho raha hai…')); await flushQueue(); await loadAll(); refresh(); toast(tr('Synced', 'Sync ho gaya')); } };
  const eb = badge.querySelector('#err-badge');
  if (eb) eb.onclick = openActivityLog;
}

// opts: fromPop (back button), restore (pichla scroll wapas), top (upar se)
// Entries pe lautne par scroll + filter wahi rehta hai.
function show(view, opts) {
  opts = opts || {};
  const prev = state.view;
  if (prev !== view && document.getElementById('screen')) scrollPos[prev] = window.scrollY;
  state.view = view;
  if (!opts.fromPop && prev !== view) { try { history.pushState({ v: view }, ''); } catch (_) { } }
  let y = 0;
  if (prev === view) y = view === 'entries' ? window.scrollY : 0;
  else if (opts.restore || (view === 'entries' && !opts.top)) y = scrollPos[view] || 0;
  renderScreen(y);
}
// scrollY diya ho to wahan; warna (refresh) jahan the wahin rehna
function renderScreen(scrollY) {
  const keepY = window.scrollY;
  const navs = document.querySelectorAll('.nav-item, .side-item');
  navs.forEach((n) => n.classList.toggle('active', n.dataset.view === state.view));
  const screen = $('#screen'); if (!screen) return;
  let r;
  if (state.view === 'dashboard') r = screenDashboard();
  else if (state.view === 'entries') r = screenEntries();
  else if (state.view === 'reports') r = screenReports();
  else if (state.view === 'theka') r = screenTheka();
  else r = screenSettings();
  screen.innerHTML = r.html; if (r.bind) r.bind();
  try { window.scrollTo(0, scrollY != null ? scrollY : keepY); } catch (_) { }
}

/* ====================== Charts (SVG, no deps) ===================== */
const CAT_COLOR = { 'Material': '#1c7a49', 'Labour': '#1d6fd0', 'Theka Payment': '#e3a008', 'Architect': '#8b5cf6', 'Misc': '#94a3b8', 'Personal': '#db2777' };
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
    if (!isBuildOut(t)) continue;
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
      if (!isBuildOut(t)) continue;
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
function lastMonth(iso) { const d = new Date(iso + 'T00:00:00'); const n = new Date(); const p = new Date(n.getFullYear(), n.getMonth() - 1, 1); return d.getFullYear() === p.getFullYear() && d.getMonth() === p.getMonth(); }
function getBudget() { const b = Number(localStorage.getItem('gk_budget')); return b > 0 ? b : 0; }

// "Aaj ki labour": pichle 60 din me jis party ki Din-wali labour sabse recent hai, uske items (rate ke saath)
function quickLabourSource() {
  const d = new Date(); d.setDate(d.getDate() - 60);
  const since = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const lab = state.transactions.filter((t) => t.type === 'Out' && t.category === 'Labour' && t.vendor && t.item && t.date >= since && Number(t.rate) > 0 && t.unit === 'Din');
  if (!lab.length) return null;
  // Jis party ki sabse zyada din-wali labour entries hain (ek-aadh baar wala vendor nahi)
  const vc = {};
  for (const t of lab) { const k = nameKey(t.vendor); vc[k] = (vc[k] || 0) + 1; }
  const vk = Object.keys(vc).sort((a, b) => vc[b] - vc[a])[0];
  if (vc[vk] < 3) return null;
  const mine = lab.filter((t) => nameKey(t.vendor) === vk);
  const im = itemMap(), byItem = {};
  for (const t of mine) {   // date-desc order → pehla mila = latest rate
    const k = nameKey(t.item);
    if (!byItem[k]) byItem[k] = { item: canonName(t.item, im), rate: Number(t.rate), count: 0 };
    byItem[k].count++;
  }
  const items = Object.values(byItem).filter((x) => x.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8);
  if (!items.length) return null;
  return { vendor: canonName(mine[0].vendor, vendorMap()), mode: mine[0].payment_mode || 'Udhaar', items };
}

function denaBaakiRows() {
  const rows = [];
  for (const p of parties()) {
    if (p.udhaar > 0) rows.push({ party: p.key, label: `${p.name} — ${tr('side work udhaar', 'side kaam udhaar')} (${p.udhaarN})`, v: inr(p.udhaar), color: '#8a6100' });
  }
  for (const c of state.contracts) {
    const s = thekaStatus(c), nm = c.thekedar_name || c.kaam || tr('Theka', 'Theka'), key = nameKey(c.thekedar_name || c.kaam);
    if (s.kind === 'baaki') rows.push({ party: key, label: `${nm} — ${tr('theka left', 'theka baaki')}`, v: inr(s.diff), color: '#c0392b' });
    else if (s.kind === 'noamount') rows.push({ party: key, label: `${nm} — ${tr('theka amount not set', 'theka amount set nahi')}`, v: tr('set', 'daalo'), color: '#8a6100' });
    else if (s.kind === 'ratewise') rows.push({ party: key, label: `${nm} — ${tr('rate-wise, advance given', 'rate-wise, advance diya')}`, v: inr(s.paid), color: '#1d6fd0' });
    else if (s.kind === 'advance') rows.push({ party: key, label: `${nm} — ${tr('advance (measurement pending)', 'advance (measurement baaki)')}`, v: inr(s.diff), color: '#1d6fd0' });
  }
  return rows;
}

function screenDashboard() {
  const cashTracked = anyTracked('Cash'), bankTracked = anyTracked('Bank');
  // Card = tracked accounts ka balance. Untracked account ka kharcha alag se Reports/Settings me
  // "Spent" dikhta hai — use balance me se ghatana galat tha (balance negative ho jaata tha).
  const cashVal = cashTracked ? balByType('Cash') : spentByType('Cash');
  const bankVal = bankTracked ? balByType('Bank') : spentByType('Bank');
  const kul = sumOut(isBuildOut);
  const isMah = sumOut((t) => isBuildOut(t) && thisMonth(t.date));
  const pichla = sumOut((t) => isBuildOut(t) && lastMonth(t.date));
  const personal = sumOut((t) => NON_BUILD_CATS.includes(t.category));
  const budget = getBudget();
  const recent = state.transactions.slice(0, 6);
  const segs = catSegments(dashRange === 'month');
  const segTotal = segs.reduce((s, x) => s + x.value, 0);
  const months = last6MonthsSpend();
  const hasMonthData = months.some((m) => m.value > 0);
  const dena = denaBaakiRows();
  const ql = quickLabourSource();
  const rp = recentParties(6);
  const cashAcc = state.accounts.find((a) => a.type === 'Cash'), bankAcc = state.accounts.find((a) => a.type === 'Bank');

  const html = `
    <div class="screen">
      <div class="actions compact">
        <button class="action-btn out" data-act="out"><span class="ico">💸</span>${tr('Add Expense', 'Kharcha daalo')}</button>
        <button class="action-btn in" data-act="in"><span class="ico">➕</span>${tr('Money In', 'Paisa Aaya')}</button>
        <button class="action-btn transfer" data-act="transfer"><span class="ico">🔁</span>${tr('Transfer', 'Transfer')}</button>
      </div>

      ${rp.length ? `<div class="rp-head">${tr('Recent parties — tap for new expense', 'Recent party — tap = naya kharcha')}</div>
      <div class="filter-chips rp-chips" id="rp-chips">${rp.map((n) => `<button type="button" class="chip sm ud" data-v="${esc(n)}">➕ ${esc(n)}</button>`).join('')}</div>` : ''}

      ${ql ? `<div class="report-card ql-card">
        <h4>👷 ${tr('Today\'s labour', 'Aaj ki labour')} — ${esc(ql.vendor)}</h4>
        <div class="muted" style="margin:-6px 0 8px">${tr('Tap once = 1 day, twice = ½ day, again = off', '1 tap = 1 din, 2 tap = ½ din, 3 tap = hatao')} · ${esc(ql.mode)}</div>
        <div class="chips" id="ql-chips">${ql.items.map((it, i) => `<button type="button" class="chip sm" data-i="${i}">${esc(it.item)}</button>`).join('')}</div>
        <div class="ql-foot"><input id="ql-date" type="date" value="${today()}" /><button class="btn-secondary" id="ql-save" disabled>${tr('Save', 'Save')}</button></div>
      </div>` : ''}

      <div class="dash-cards">
      <div class="balance-row">
        <div class="bal-card cash tap" data-go="cash" tabindex="0" role="button"><div class="label">💵 ${cashTracked ? tr('Cash in hand', 'Cash haath me') : tr('Cash spent', 'Cash se gaya')}</div><div class="amt">${inr(cashVal)}</div></div>
        <div class="bal-card bank tap" data-go="bank" tabindex="0" role="button"><div class="label">🏦 ${bankTracked ? tr('In bank', 'Bank me') : tr('Bank spent', 'Bank se gaya')}</div><div class="amt">${inr(bankVal)}</div></div>
      </div>
      <div class="stat-row">
        <div class="stat tap" data-go="kul" tabindex="0" role="button"><div class="label">${tr('House total spent', 'Ghar ka kul kharcha')}</div><div class="amt spend">${inr(kul)}</div>${personal > 0 ? `<div class="sub-note">+ ${tr('Personal', 'Personal')} ${inr(personal)}</div>` : ''}</div>
        <div class="stat tap" data-go="month" tabindex="0" role="button"><div class="label">${tr('This month', 'Is mahine')}</div><div class="amt spend">${inr(isMah)}</div><div class="sub-note">${tr('Last month', 'Pichle mahine')} ${inr(pichla)}</div></div>
      </div>
      </div>

      <div class="dash-grid">

      ${budget ? (() => { const pct = Math.min(100, Math.round(kul / budget * 100)); const left = budget - kul; return `<div class="report-card" style="margin-top:12px"><h4>🏠 ${tr('Budget', 'Budget')}</h4>
        <div class="bar ${kul > budget ? 'red' : ''}"><span style="width:${pct}%"></span></div>
        <div class="muted" style="margin-top:6px">${inr(kul)} / ${inr(budget)} · ${pct}% · ${left >= 0 ? tr('left ', 'baaki ') + inr(left) : tr('over by ', 'budget se upar ') + inr(-left)}</div></div>`; })() : ''}

      ${dena.length ? `<div class="report-card" style="margin-top:12px"><h4>🧾 ${tr('To pay / pending', 'Dena baaki / pending')}</h4>
        ${dena.map((r) => `<div class="rrow tap" data-party="${esc(r.party)}" tabindex="0" role="button"><div class="k">${esc(r.label)}</div><div class="v" style="color:${r.color}">${esc(r.v)}</div></div>`).join('')}</div>` : ''}

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
      </div>

      <div class="section-label sl-row"><span>${tr('Recent', 'Recent')}</span>${recent.length ? `<button type="button" class="link-btn" id="see-all">${tr('See all', 'Sab entries')} ›</button>` : ''}</div>
      <div class="list">${recent.length ? recent.map((t) => entryRow(t)).join('') : emptyState(tr('No entries yet. Start from the buttons above 👆', 'Abhi koi entry nahi. Upar se shuru karein 👆'))}</div>
    </div>`;

  const bind = () => {
    $('#screen').querySelectorAll('.action-btn').forEach((b) => b.onclick = () => {
      const a = b.dataset.act; if (a === 'out') openOutForm(); else if (a === 'in') openInForm(); else openTransferForm();
    });
    const rt = $('#dash-range');
    if (rt) rt.querySelectorAll('button').forEach((b) => b.onclick = () => { dashRange = b.dataset.r; renderScreen(); });
    $('#screen').querySelectorAll('.rrow[data-party]').forEach((el) => el.onclick = () => openParty(el.dataset.party));
    // Cards tappable: Cash/Bank → us account ki entries; kul → Reports Category; is mahine → is mahine ki entries
    $('#screen').querySelectorAll('[data-go]').forEach((el) => el.onclick = () => {
      const g = el.dataset.go;
      if (g === 'cash' && cashAcc) openEntriesWith({ account: cashAcc.id });
      else if (g === 'bank' && bankAcc) openEntriesWith({ account: bankAcc.id });
      else if (g === 'kul') { state.reportTab = 'category'; state.f.range = 'all'; state.f.from = ''; state.f.to = ''; show('reports'); }
      else if (g === 'month') openEntriesWith({ range: 'month', type: 'Out', includePersonal: false });
    });
    const rpc = $('#rp-chips'); if (rpc) rpc.querySelectorAll('.chip').forEach((c) => c.onclick = () => openOutForm(null, { vendor: c.dataset.v }));
    const sa = $('#see-all'); if (sa) sa.onclick = () => { state.entriesFrom = null; show('entries'); };
    if (ql) bindQuickLabour(ql);
    bindEntryRows();
  };
  return { html, bind };
}

function bindQuickLabour(ql) {
  const qty = ql.items.map(() => 0);
  const chips = $('#ql-chips'), saveBtn = $('#ql-save');
  const paint = () => {
    let total = 0, n = 0;
    chips.querySelectorAll('.chip').forEach((c) => {
      const i = +c.dataset.i, q = qty[i], it = ql.items[i];
      c.classList.toggle('active', q > 0);
      c.textContent = it.item + (q === 1 ? ' · 1' : q === 0.5 ? ' · ½' : '');
      if (q) { total += lineAmount(q, it.rate, 'Din'); n++; }
    });
    saveBtn.disabled = !n;
    saveBtn.textContent = n ? `${tr('Save', 'Save')} ${n} · ${inr(total)}` : tr('Save', 'Save');
  };
  chips.querySelectorAll('.chip').forEach((c) => c.onclick = () => { const i = +c.dataset.i; qty[i] = qty[i] === 0 ? 1 : qty[i] === 1 ? 0.5 : 0; paint(); });
  saveBtn.onclick = async () => {
    const date = $('#ql-date').value || today();
    const accId = ql.mode === 'Udhaar' ? null : accountForMode(ql.mode, null);
    const recs = ql.items.map((it, i) => qty[i] ? {
      id: uid(), type: 'Out', date, category: 'Labour', item: it.item, qty: qty[i], unit: 'Din', rate: it.rate,
      amount: money(lineAmount(qty[i], it.rate, 'Din')), vendor: ql.vendor, payment_mode: ql.mode, account_id: accId, notes: null, contract_id: null
    } : null).filter(Boolean);
    const dups = recs.filter((r) => findDup(r, true));
    if (dups.length && !confirm(tr('Already entered for this date: ', 'Is date ki ye entry pehle se hai: ') + dups.map((d) => d.item).join(', ') + '\n\n' + tr('Add again anyway?', 'Fir bhi dobara add karein?'))) return;
    for (const r of recs) await saveTx(r, true, true);
    toast(tr(recs.length + ' labour entries saved ✅', recs.length + ' labour entries save ✅'));
    refresh();
  };
  paint();
}

function emptyState(msg) { return `<div class="empty"><div class="big">📭</div>${esc(msg)}</div>`; }

// Ek entry ki row. opts: noDate (Entries me date header pe hai), running (party ledger me ab tak kul diya)
function entryRow(t, opts) {
  opts = opts || {};
  let title, cls, ico, sign; const bits = [];
  const pl = (name) => name ? `<span class="pl ud" data-party="${esc(name)}">${esc(name)}</span>` : '';
  if (t.type === 'Out') {
    cls = 'out'; sign = '−'; ico = CAT_ICON[t.category] || '🧾';
    if (t.category === 'Theka Payment') {
      const c = contractById(t.contract_id), party = t.vendor || (c && c.thekedar_name) || '';
      title = esc(tr('Theka', 'Theka')) + (party ? ' — ' + pl(party) : '');
    } else title = `<span class="ud">${esc(t.item || t.category || tr('Expense', 'Kharcha'))}</span>`;
    if (t.qty) bits.push(esc(fmtQtyRate(t)));
    if (t.vendor && t.category !== 'Theka Payment') bits.push(pl(t.vendor));
    if (t.account_id) bits.push(esc(accName(t.account_id)));
  } else if (t.type === 'In') {
    cls = 'in'; sign = '+'; ico = '💰';
    title = `<span class="ud">${esc(t.source || tr('Money In', 'Paisa Aaya'))}</span>`;
    if (t.from_party) bits.push(pl(t.from_party));
    if (t.account_id) bits.push(esc(accName(t.account_id)));
  } else {
    cls = 'transfer'; sign = ''; ico = '🔁';
    title = esc(tr('Transfer', 'Transfer'));
    bits.push(esc(`${accName(t.account_id)} → ${accName(t.to_account_id)}`));
  }
  if (!opts.noDate) bits.unshift(esc(fmtDate(t.date)));
  const note = cleanNote(t.notes);
  if (note) bits.push(`<span class="nt">📝 ${esc(note)}</span>`);
  const tag = t.payment_mode === 'Udhaar' ? '<span class="tag udhaar">Udhaar</span>' : (paidOn(t.notes) ? `<span class="tag paid">${esc(tr('settled', 'chukaya'))}</span>` : '');
  return `<div class="entry ${cls}${opts.noDate ? ' compact' : ''}" data-id="${esc(t.id)}" tabindex="0" role="button"${t.payment_mode === 'Udhaar' ? ' data-ud="1"' : ''}>
    <div class="ic">${ico}</div>
    <div class="body">
      <div class="ttl">${tag}${title}</div>
      <div class="meta">${bits.join(' · ')}</div>
    </div>
    <div class="amt ${cls}">${sign}${inr(t.amount)}${opts.running != null ? `<small>∑ ${inr(opts.running)}</small>` : ''}</div>
  </div>`;
}
// Row tap → detail. Party naam pe tap → Entries us party ke filter ke saath.
function bindEntryRows(root) {
  (root || $('#screen')).querySelectorAll('.entry[data-id]').forEach((el) => {
    el.onclick = (e) => {
      const pl = e.target.closest('.pl');
      if (pl) {
        e.stopPropagation();
        const inSheet = !!el.closest('.modal');
        if (inSheet) closeSheet();
        openEntriesWith({ party: pl.dataset.party }, { refine: state.view === 'entries' && !inSheet });
        return;
      }
      const t = state.transactions.find((x) => x.id === el.dataset.id); if (!t) return;
      // Laptop pe Entries list ki row → detail right pane me (sheet nahi)
      if (paneMode() && el.closest('#ef-list')) { state.efSel = t.id; renderPane(); return; }
      openEntryDetail(t);
    };
  });
}

/* ========================= SCREEN: ENTRIES ======================== */
const EF_PAGE = 250;
let efLimit = EF_PAGE, efTimer = null, viewEdit = false;
function screenEntries() {
  const f = state.f;
  const html = `
    <div class="screen">
      ${state.entriesFrom && VIEW_NAMES()[state.entriesFrom] ? `<button type="button" class="back-link" id="ef-back">‹ ${esc(tr('Back to ', 'Wapas ') + VIEW_NAMES()[state.entriesFrom])}</button>` : ''}
      <h2 class="title">${tr('All Entries', 'Saari Entries')}</h2>
      <div id="ef-views"></div>
      <div class="toolbar">
        <input id="ef-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="🔍 ${tr('Item, party, note, ₹, date…', 'Item, party, note, ₹, date…')}" value="${esc(f.q)}" />
        <button type="button" class="btn-secondary filter-btn" id="ef-filter"></button>
      </div>
      <div class="filter-chips" id="ef-chips">
        ${['all', 'Out', 'In', 'Transfer'].map((ty) => `<button type="button" class="chip sm ${f.type === ty ? 'active' : ''}" data-t="${ty}">${esc(typeName(ty))}</button>`).join('')}
      </div>
      <div id="ef-active"></div>
      <div id="ef-sum" class="ef-sum"></div>
      <div class="ef-split"><div id="ef-list"></div><aside class="ef-pane" id="ef-pane" aria-live="polite"></aside></div>
    </div>`;
  const bind = () => {
    renderEntriesList();
    $('#ef-q').oninput = (e) => {
      const v = e.target.value; clearTimeout(efTimer);
      efTimer = setTimeout(() => { state.f.q = v; efLimit = EF_PAGE; renderEntriesList(); }, 150);
    };
    $('#ef-chips').querySelectorAll('.chip').forEach((c) => c.onclick = () => {
      state.f.type = c.dataset.t; efLimit = EF_PAGE;
      $('#ef-chips').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c)); renderEntriesList();
    });
    $('#ef-filter').onclick = openFilterSheet;
    const back = $('#ef-back'); if (back) back.onclick = () => { const v = state.entriesFrom; state.entriesFrom = null; show(v, { restore: true }); };
  };
  return { html, bind };
}
// Sirf list wala hissa dobara banao (search box/keyboard nahi chhedta)
function renderEntriesList() {
  const f = state.f, list = $('#ef-list'); if (!list) return;
  const rows = filteredTx(f);
  // saved views
  const views = savedViews(), cur = filterJson(f);
  $('#ef-views').innerHTML = views.length ? `<div class="filter-chips views">${views.map((v, i) => `<span class="vchip-wrap"><button type="button" class="chip sm vchip ud ${filterJson(v.f) === cur ? 'active' : ''}" data-vi="${i}">⭐ ${esc(v.name)}</button>${viewEdit ? `<button type="button" class="vchip-x" data-vx="${i}" aria-label="${esc(tr('Delete view', 'View hatao'))}">✕</button>` : ''}</span>`).join('')}
    <button type="button" class="chip sm ghost" id="ef-vedit">${viewEdit ? esc(tr('Done', 'Ho gaya')) : '✏️'}</button></div>` : '';
  const fc = filterCount(f);
  $('#ef-filter').textContent = '+ ' + tr('Filter', 'Filter') + (fc ? ' (' + fc + ')' : '');
  // active filter chips
  const chips = activeFilterChips(f);
  $('#ef-active').innerHTML = chips.length ? `<div class="active-chips">${chips.map((c) => `<button type="button" class="chip sm fchip ud" data-clear="${c.k}">${esc(c.label)} ✕</button>`).join('')}<button type="button" class="link-btn" id="ef-clear">${tr('Clear', 'Saaf karo')}</button></div>` : '';
  // summary
  const s = rowsTotals(rows);
  const bits = [`<b>${rows.length}</b> ${tr('entries', 'entries')}`];
  if (s.out) bits.push(`<b style="color:var(--red)">${tr('Out', 'Gaya')} ${inr(s.out)}</b>`);
  if (s.inn) bits.push(`<b style="color:var(--green)">${tr('In', 'Aaya')} ${inr(s.inn)}</b>`);
  if (s.ud) bits.push(`<b style="color:#8a6100">Udhaar ${inr(s.ud)}</b>`);
  $('#ef-sum').innerHTML = `<div class="sum-line">${bits.join(' · ')}</div>
    <div class="sum-actions">${rows.length ? `<button type="button" class="link-btn" id="ef-csv">⬇️ CSV</button>` : ''}${filterActive(f) && !views.some((v) => filterJson(v.f) === cur) ? `<button type="button" class="link-btn" id="ef-save-view">⭐ ${tr('Save view', 'View save karo')}</button>` : ''}</div>`;
  // list grouped by date
  if (!rows.length) list.innerHTML = emptyState(filterActive(f) ? tr('Nothing found for this filter', 'Is filter me kuch nahi mila') : tr('No entries yet', 'Abhi koi entry nahi'));
  else {
    const dayOut = {};
    for (const t of rows) if (t.type === 'Out') dayOut[t.date] = (dayOut[t.date] || 0) + (Number(t.amount) || 0);
    let html = '', cur = null;
    for (const t of rows.slice(0, efLimit)) {
      if (t.date !== cur) {
        if (cur !== null) html += '</div></section>';
        cur = t.date;
        html += `<section class="day"><div class="day-h"><span>${esc(dayLabel(cur))}</span>${dayOut[cur] ? `<span class="day-t">${inr(dayOut[cur])}</span>` : ''}</div><div class="day-card">`;
      }
      html += entryRow(t, { noDate: true });
    }
    if (cur !== null) html += '</div></section>';
    if (rows.length > efLimit) html += `<button type="button" class="btn-ghost" id="ef-more">${tr('Show more', 'Aur dikhao')} (${rows.length - efLimit})</button>`;
    list.innerHTML = html;
    bindEntryRows(list);
  }
  // binds
  const rerender = () => { efLimit = EF_PAGE; renderEntriesList(); };
  $('#ef-active').querySelectorAll('[data-clear]').forEach((b) => b.onclick = () => { clearFilterKey(state.f, b.dataset.clear); if (b.dataset.clear === 'q') $('#ef-q').value = ''; rerender(); });
  const cl = $('#ef-clear'); if (cl) cl.onclick = () => { const ty = state.f.type; state.f = blankFilter(); state.f.type = ty; $('#ef-q').value = ''; rerender(); };
  const csv = $('#ef-csv'); if (csv) csv.onclick = () => exportCSV(rows, filterActive(f) ? 'filtered-' : '');
  const sv = $('#ef-save-view'); if (sv) sv.onclick = openSaveView;
  const more = $('#ef-more'); if (more) more.onclick = () => { efLimit += EF_PAGE; renderEntriesList(); };
  renderPane();
  const ve = $('#ef-vedit'); if (ve) ve.onclick = () => { viewEdit = !viewEdit; renderEntriesList(); };
  $('#ef-views').querySelectorAll('[data-vx]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); deleteSavedView(+b.dataset.vx); });
  $('#ef-views').querySelectorAll('.vchip').forEach((b) => {
    let timer = null, long = false;
    const cancel = () => clearTimeout(timer);
    b.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; deleteSavedView(+b.dataset.vi); }, 650); });
    b.addEventListener('pointerup', cancel); b.addEventListener('pointerleave', cancel); b.addEventListener('pointercancel', cancel);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.onclick = () => {
      if (long) { long = false; return; }
      const v = savedViews()[+b.dataset.vi]; if (!v) return;
      state.f = Object.assign(blankFilter(), cleanFilter(v.f)); efLimit = EF_PAGE; renderScreen(0);
    };
  });
}

/* ---- Filter sheet ("+ Filter"): date, party, category, item, mode, account, type, personal ---- */
function partyOptions() {
  const vm = vendorMap(), cnt = {}, label = {};
  for (const t of state.transactions) for (const v of [t.vendor, t.from_party]) {
    const k = nameKey(v); if (!k) continue; cnt[k] = (cnt[k] || 0) + 1; if (!label[k]) label[k] = canonName(v, vm);
  }
  for (const c of state.contracts) { const k = nameKey(c.thekedar_name); if (k && !label[k]) { label[k] = canonName(c.thekedar_name, vm); cnt[k] = cnt[k] || 0; } }
  return Object.keys(label).map((k) => ({ v: label[k], n: cnt[k] })).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v));
}
function itemOptions() {
  const im = itemMap(), cnt = {}, label = {};
  for (const t of state.transactions) { const k = nameKey(t.item); if (!k) continue; cnt[k] = (cnt[k] || 0) + 1; if (!label[k]) label[k] = canonName(t.item, im); }
  return Object.keys(label).map((k) => ({ v: label[k], n: cnt[k] })).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v));
}
function openFilterSheet() {
  const d = Object.assign({}, state.f);
  const pOpts = partyOptions(), iOpts = itemOptions();
  const inner = `
    <h3>🔎 ${tr('Filter entries', 'Entries filter')}</h3>
    <div class="field"><label>${tr('Date', 'Date')}</label><div class="chips" id="fs-range"></div>
      <div class="row2 ${d.range === 'custom' ? '' : 'hidden'}" id="fs-custom" style="margin-top:8px">
        <div><label class="mini-l">${tr('From', 'Kab se')}</label><input id="fs-from" type="date" value="${esc(d.from)}" /></div>
        <div><label class="mini-l">${tr('To', 'Kab tak')}</label><input id="fs-to" type="date" value="${esc(d.to)}" /></div></div></div>
    <div class="field"><label>${tr('Party', 'Party (kise diya / kisse aaya)')}</label><input id="fs-pq" class="mini-q" type="search" autocomplete="off" placeholder="🔍 ${tr('search name', 'naam dhoondo')}" /><div class="chips pick" id="fs-party"></div></div>
    <div class="field"><label>${tr('Category', 'Category')}</label><div class="chips pick" id="fs-cat"></div></div>
    <div class="field"><label>${tr('Item', 'Item')}</label><input id="fs-iq" class="mini-q" type="search" autocomplete="off" placeholder="🔍 ${tr('search item', 'item dhoondo')}" /><div class="chips pick" id="fs-item"></div></div>
    <div class="field"><label>${tr('Payment mode', 'Payment mode')}</label><div class="chips pick" id="fs-mode"></div></div>
    <div class="field"><label>${tr('Account', 'Account')}</label><div class="chips pick" id="fs-acc"></div></div>
    <div class="field"><label>${tr('Type', 'Type')}</label><div class="chips pick" id="fs-type"></div></div>
    <div class="field"><label>${tr('Include Personal?', 'Personal shamil?')}</label><div class="chips pick" id="fs-pers"></div></div>
    <div class="sheet-foot"><button class="btn-primary" id="fs-apply"></button>
    <button class="btn-ghost" id="fs-reset">${tr('Remove all filters', 'Saare filter hatao')}</button></div>`;
  openSheet(inner, (root) => {
    const apply = root.querySelector('#fs-apply');
    const update = () => {
      const rows = filteredTx(d), s = rowsTotals(rows);
      apply.textContent = `${tr('Show', 'Dikhao')}: ${rows.length} ${tr('entries', 'entries')}` + (s.out ? ' · ' + tr('Out ', 'Gaya ') + inr(s.out) : (s.inn ? ' · ' + tr('In ', 'Aaya ') + inr(s.inn) : ''));
    };
    // chip group: opts() → [{v,label}], toggle = dobara tap pe hatao
    const group = (id, opts, field, toggle, onSet) => {
      const el = root.querySelector('#' + id);
      const paint = () => {
        el.innerHTML = opts().map((o) => `<button type="button" class="chip sm ${o.ud ? 'ud' : ''} ${String(d[field]) === String(o.v) ? 'active' : ''}" data-v="${esc(o.v)}">${esc(o.label)}${o.n != null ? ` <span class="cn">${o.n}</span>` : ''}</button>`).join('') || `<span class="muted">${tr('No match', 'Kuch nahi mila')}</span>`;
        el.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
          let v = c.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false;
          d[field] = (toggle && String(d[field]) === String(v)) ? '' : v;
          if (onSet) onSet(d[field]); paint(); update();
        });
      };
      paint(); return paint;
    };
    group('fs-range', () => ['all', 'month', 'lastmonth', 'custom'].map((r) => ({ v: r, label: rangeName(r) })), 'range', false, (r) => {
      root.querySelector('#fs-custom').classList.toggle('hidden', r !== 'custom');
      if (r === 'custom' && !d.from && !d.to) { const n = new Date(); d.from = monthBounds(n.getFullYear(), n.getMonth()).from; d.to = today(); root.querySelector('#fs-from').value = d.from; root.querySelector('#fs-to').value = d.to; }
    });
    root.querySelector('#fs-from').onchange = (e) => { d.from = e.target.value; update(); };
    root.querySelector('#fs-to').onchange = (e) => { d.to = e.target.value; update(); };
    const pq = root.querySelector('#fs-pq'), iq = root.querySelector('#fs-iq');
    const pick = (all, qEl, field) => () => {
      const q = nameKey(qEl.value);
      let list = all.filter((o) => !q || nameKey(o.v).includes(q));
      const sel = all.find((o) => nameKey(o.v) === nameKey(d[field]));
      list = list.slice(0, 24); if (sel && !list.includes(sel)) list.unshift(sel);
      return list.map((o) => ({ v: o.v, label: o.v, n: o.n, ud: true }));
    };
    const paintParty = group('fs-party', pick(pOpts, pq, 'party'), 'party', true);
    const paintItem = group('fs-item', pick(iOpts, iq, 'item'), 'item', true);
    pq.oninput = paintParty; iq.oninput = paintItem;
    group('fs-cat', () => allCats().map((c) => ({ v: c, label: c })), 'category', true);
    group('fs-mode', () => PAY_MODES.map((m) => ({ v: m, label: m })), 'mode', true);
    group('fs-acc', () => state.accounts.map((a) => ({ v: a.id, label: (a.type === 'Cash' ? '💵 ' : '🏦 ') + a.name, ud: true })), 'account', true);
    group('fs-type', () => ['all', 'Out', 'In', 'Transfer'].map((ty) => ({ v: ty, label: typeName(ty) })), 'type', false);
    group('fs-pers', () => [{ v: true, label: tr('Yes', 'Haan') }, { v: false, label: tr('No', 'Nahi') }], 'includePersonal', false);
    update();
    apply.onclick = () => {
      if (d.range !== 'custom') { d.from = ''; d.to = ''; }
      state.f = Object.assign(blankFilter(), cleanFilter(d)); efLimit = EF_PAGE; scrollPos.entries = 0;
      closeSheet(); if (state.view === 'entries') renderScreen(0); else show('entries', { top: true });
    };
    root.querySelector('#fs-reset').onclick = () => { state.f = blankFilter(); efLimit = EF_PAGE; closeSheet(); if (state.view === 'entries') renderScreen(0); else show('entries'); };
  });
}

/* ========================= SCREEN: REPORTS ======================== */
const REPORT_TABS = [['summary', 'Summary', 'Summary'], ['category', 'Category', 'Category'], ['party', 'Party', 'Party'], ['item', 'Item', 'Item'], ['month', 'Month', 'Mahina']];
// Report ki ek list (sab rows, bar, count). partFn(row) → filter; har row tap → Entries (us dimension + date range)
function reportList(title, rows, partFn, opts) {
  opts = opts || {};
  if (!rows.length) return `<div class="report-card"><h4>${title}</h4><div class="muted">${tr('Nothing in this range', 'Is range me kuch nahi')}</div></div>`;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount))), total = rows.reduce((s, r) => s + r.amount, 0);
  return `<div class="report-card list-card"><h4>${title}<span class="h4-sub">${rows.length} · ${inr(total)}</span></h4><div class="rl-rows">${rows.map((r) => {
    const w = Math.min(100, Math.max(0, Math.round(Math.abs(r.amount) / max * 100)));
    const pct = total ? Math.round(r.amount / total * 100) : 0;
    const sub = opts.sub ? opts.sub(r) : esc(`${r.count} ${tr('entries', 'entries')}${opts.pct ? ' · ' + pct + '%' : ''}`);
    const part = partFn ? partFn(r) : null;
    return `<div class="rli ${part ? 'tap' : ''}"${part ? ` data-f="${esc(JSON.stringify(part))}" tabindex="0" role="button"` : ''}><div class="rrow"><div class="k"><span class="ud">${esc(r.key)}</span><small>${sub}</small></div><div class="v">${inr(r.amount)}${part ? '<span class="chev">›</span>' : ''}</div></div>
      ${opts.bar === false ? '' : `<div class="bar ${opts.red ? 'red' : ''}"><span style="width:${w}%"></span></div>`}</div>`;
  }).join('')}</div></div>`;
}
function screenReports() {
  const f = state.f, tab = state.reportTab || 'summary';
  const dateF = { range: f.range, from: f.from, to: f.to };
  const inR = (t) => inDates(t.date, dateF);
  const rl = rangeText(f) || tr('All', 'Sab');
  let body;
  if (tab === 'category') body = reportCategory(inR);
  else if (tab === 'party') body = reportParty(inR);
  else if (tab === 'item') body = reportItem(inR);
  else if (tab === 'month') body = reportMonth(inR);
  else body = reportSummary(inR, rl);
  const html = `
    <div class="screen">
      <h2 class="title">${tr('Reports', 'Reports')} — ${esc(rl)}</h2>
      <div class="seg-tabs" id="rp-tabs">${REPORT_TABS.map(([k, en, hi]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-tab="${k}">${tr(en, hi)}</button>`).join('')}</div>
      <div class="filter-chips" id="rf-chips">
        ${['all', 'month', 'lastmonth', 'custom'].map((r) => `<button type="button" class="chip sm ${(f.range || 'all') === r ? 'active' : ''}" data-r="${r}">${esc(rangeName(r))}</button>`).join('')}
      </div>
      ${f.range === 'custom' ? `<div class="row2 custom-range"><div><label class="mini-l">${tr('From', 'Kab se')}</label><input id="rf-from" type="date" value="${esc(f.from)}" /></div><div><label class="mini-l">${tr('To', 'Kab tak')}</label><input id="rf-to" type="date" value="${esc(f.to)}" /></div></div>` : ''}
      <div class="muted tap-hint">👆 ${tr('Tap any row to see its entries', 'Kisi bhi row pe tap karo — uski entries dikhengi')}</div>
      <div class="r-body r-${tab}">${body}</div>
      <button class="btn-secondary" id="csv-btn" style="width:100%;margin-top:6px">⬇️ ${tr('CSV / Excel export', 'CSV / Excel export')} (${esc(rl)})</button>
    </div>`;
  const bind = () => {
    $('#rp-tabs').querySelectorAll('button').forEach((b) => b.onclick = () => { state.reportTab = b.dataset.tab; renderScreen(0); });
    $('#rf-chips').querySelectorAll('.chip').forEach((c) => c.onclick = () => {
      const r = c.dataset.r; state.f.range = r;
      if (r === 'custom') { if (!state.f.from && !state.f.to) { const n = new Date(); state.f.from = monthBounds(n.getFullYear(), n.getMonth()).from; state.f.to = today(); } }
      else { state.f.from = ''; state.f.to = ''; }
      renderScreen();
    });
    const fr = $('#rf-from'), to = $('#rf-to');
    if (fr) fr.onchange = () => { state.f.from = fr.value; renderScreen(); };
    if (to) to.onchange = () => { state.f.to = to.value; renderScreen(); };
    $('#screen').querySelectorAll('[data-f]').forEach((el) => el.onclick = () => {
      let part; try { part = JSON.parse(el.dataset.f); } catch (_) { return; }
      openEntriesWith(part, { keepDates: !part._all });
    });
    const kh = $('#r-khata'); if (kh) kh.onclick = () => show('theka');
    $('#csv-btn').onclick = () => exportCSV(state.transactions.filter(inR), f.range === 'all' ? '' : 'range-');
  };
  return { html, bind };
}
function reportSummary(inR, rl) {
  const T = state.transactions.filter(inR);
  const sumT = (fn) => T.filter(fn).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalIn = sumT((t) => t.type === 'In'), totalOut = sumT((t) => t.type === 'Out');
  const build = sumT(isBuildOut), personal = sumT((t) => t.type === 'Out' && NON_BUILD_CATS.includes(t.category));
  const bankUntracked = state.accounts.some((a) => a.type === 'Bank' && !accTracked(a));
  const ud = pendingUdhaar(), udTotal = ud.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const udBy = groupSum('Out', (t) => t.vendor, (t) => t.payment_mode === 'Udhaar');
  const aaya = groupSum('In', (t) => t.from_party || t.source || 'Other', inR);
  const fromKeys = new Set(state.transactions.filter((t) => t.type === 'In' && t.from_party).map((t) => nameKey(t.from_party)));
  const byMode = groupSum('Out', (t) => t.payment_mode, inR);
  const tapRow = (k, v, part, color, small) => `<div class="rli tap" data-f="${esc(JSON.stringify(part))}" tabindex="0" role="button"><div class="rrow"><div class="k">${k}${small ? `<small>${small}</small>` : ''}</div><div class="v"${color ? ` style="color:${color}"` : ''}>${v}<span class="chev">›</span></div></div></div>`;
  return `
    <div class="report-card">
      <h4>🔁 ${esc(rl)} — ${tr('In vs Out', 'Aaya vs Gaya')}</h4>
      ${tapRow(tr('Total In', 'Total Aaya (In)'), inr(totalIn), { type: 'In' }, '#1f7a4d')}
      ${tapRow(tr('Total Out (spent)', 'Total Gaya (Kharcha)'), inr(totalOut), { type: 'Out' }, '#c0392b')}
      <div class="total-line"><span>${tr('In − Out', 'Aaya − Gaya')}</span><span>${inr(totalIn - totalOut)}</span></div>
      ${bankUntracked ? `<div class="muted" style="margin-top:6px">${tr('Money coming into Bank is not tracked, so this is not your savings.', 'Bank me aaya paisa track nahi hota, isliye ye bachat nahi hai.')}</div>` : ''}
      ${tapRow('🏠 ' + tr('House (construction) spend', 'Ghar (construction) kharcha'), inr(build), { type: 'Out', includePersonal: false }, '', tr('excludes Personal', 'Personal ke bina'))}
      ${personal ? tapRow('👤 ' + tr('Personal', 'Personal'), inr(personal), { category: 'Personal' }, '#db2777', tr('not in house total', 'ghar ke total me nahi')) : ''}
    </div>
    ${udTotal ? `<div class="report-card"><h4>⚠️ ${tr('Udhaar pending (now)', 'Udhaar baaki (abhi tak ka)')}<span class="h4-sub">${inr(udTotal)}</span></h4>
      ${udBy.map((r) => tapRow(`<span class="ud">${esc(r.key)}</span>`, inr(r.amount), { party: r.key, mode: 'Udhaar', _all: 1 }, '#8a6100', esc(r.count + ' ' + tr('entries', 'entries')))).join('')}</div>` : ''}
    ${reportList('💰 ' + tr('Where money came from', 'Paisa kahan se aaya'), aaya, (r) => fromKeys.has(nameKey(r.key)) ? { type: 'In', party: r.key } : { type: 'In', q: r.key }, { bar: true })}
    ${reportList('💳 ' + tr('Payment mode wise', 'Payment mode wise'), byMode.filter((r) => r.key !== '—'), (r) => ({ type: 'Out', mode: r.key }), { pct: true })}
    <div class="report-card">
      <h4>💼 ${tr('Account balances (now)', 'Account balances (abhi)')}</h4>
      ${state.accounts.map((a) => { const tk = accTracked(a); const v = tk ? inr(balanceOf(a.id)) : `<span class="muted" style="font-weight:600">${tr('Spent', 'Gaya')} ${inr(spentViaAccount(a.id))}</span>`; return tapRow(`${a.type === 'Cash' ? '💵' : '🏦'} <span class="ud">${esc(a.name)}</span>`, v, { account: a.id, _all: 1 }); }).join('') || `<div class="muted">${tr('No account', 'Koi account nahi')}</div>`}
    </div>
    <button type="button" class="link-card" id="r-khata">🤝 ${tr('Theka & party hisaab', 'Theka ka hisaab')} → ${tr('Khata', 'Khata')} <span class="chev">›</span></button>`;
}
function reportCategory(inR) {
  const byCat = groupSum('Out', (t) => t.category, inR);
  const segs = byCat.filter((r) => r.amount > 0).map((r) => ({ label: r.key, value: r.amount, color: CAT_COLOR[r.key] || '#94a3b8' }));
  const total = segs.reduce((s, x) => s + x.value, 0);
  return (segs.length ? `<div class="report-card chart-card"><div class="donut-wrap">${donutSVG(segs, total)}${donutLegend(segs, total)}</div></div>` : '') +
    reportList('📦 ' + tr('Category-wise spend', 'Category-wise kharcha'), byCat, (r) => r.key === '—' ? null : { type: 'Out', category: r.key }, { bar: true, red: true, pct: true });
}
function reportParty(inR) {
  const rows = groupSum('Out', (t) => t.vendor, inR).filter((x) => x.key !== '—');
  return reportList('🏪 ' + tr('Party-wise (paid to)', 'Party-wise (kise gaya)'), rows, (r) => ({ type: 'Out', party: r.key }), { bar: true, pct: true });
}
// Item report: kul qty (unit ke saath), average rate, sabse kam→zyada rate, pehla→aakhri rate (trend). Theka nahi.
function itemStats(pred) {
  const im = itemMap(), map = {};
  const olderFirst = state.transactions.filter((t) => t.type === 'Out' && t.category !== 'Theka Payment' && t.item && pred(t)).sort(sortOldFirst);
  for (const t of olderFirst) {
    const k = nameKey(t.item); if (!k) continue;
    const g = map[k] || (map[k] = { key: canonName(t.item, im), amount: 0, count: 0, units: {}, rated: {} });
    const a = Number(t.amount) || 0, q = Number(t.qty) || 0, r = Number(t.rate) || 0;
    g.amount += a; g.count++;
    if (q > 0 && t.unit) g.units[t.unit] = (g.units[t.unit] || 0) + q;
    if (q > 0 && r > 0 && t.unit) {
      const x = g.rated[t.unit] || (g.rated[t.unit] = { n: 0, qty: 0, amt: 0, min: Infinity, max: -Infinity, first: null, last: null });
      x.n++; x.qty += q; x.amt += a; x.min = Math.min(x.min, r); x.max = Math.max(x.max, r);
      if (!x.first) x.first = { r, d: t.date }; x.last = { r, d: t.date };
    }
  }
  return Object.values(map).map((g) => {
    const u = Object.keys(g.rated).sort((a, b) => g.rated[b].n - g.rated[a].n)[0];
    if (u) { const x = g.rated[u], per = PER_1000_UNITS.includes(u); g.rate = { unit: u, per1000: per, avg: x.qty ? x.amt / x.qty * (per ? 1000 : 1) : 0, min: x.min, max: x.max, first: x.first, last: x.last, n: x.n }; }
    return g;
  }).sort((a, b) => b.amount - a.amount);
}
function reportItem(inR) {
  const rows = itemStats(inR);
  const sub = (g) => {
    const lines = [esc([fmtUnits(g.units), g.count + ' ' + tr('entries', 'entries')].filter(Boolean).join(' · '))];
    if (g.rate) {
      const r = g.rate, unit = r.per1000 ? '/1000' : '/' + r.unit;
      lines.push(esc(`${tr('avg', 'avg')} ${inr(Math.round(r.avg))}${unit}` + (r.n > 1 && r.min !== r.max ? ` · ${inr(r.min)}–${inr(r.max)}` : '')));
      if (r.n > 1 && r.first.r !== r.last.r) {
        const up = r.last.r > r.first.r;
        lines.push(`<span style="color:${up ? '#c0392b' : '#1f7a4d'}">${up ? '↑' : '↓'} ${esc(inr(r.first.r) + ' (' + fmtDate(r.first.d) + ') → ' + inr(r.last.r) + ' (' + fmtDate(r.last.d) + ')')}</span>`);
      }
    }
    return lines.join('<br>');
  };
  return reportList('🧱 ' + tr('Item-wise (material/labour)', 'Item-wise (material/labour)'), rows, (r) => ({ type: 'Out', item: r.key }), { sub, bar: true }) +
    `<div class="muted" style="margin:-4px 4px 12px">${tr('Theka payments are not items — see Khata. Rate trend uses entries that have qty × rate.', 'Theka payment item nahi hai — Khata me dekho. Rate/trend sirf qty × rate wali entries se.')}</div>`;
}
function reportMonth(inR) {
  const map = {};
  for (const t of state.transactions) {
    if (t.type !== 'Out' || !inR(t) || !t.date) continue;
    const m = t.date.slice(0, 7), g = map[m] || (map[m] = { total: 0, build: 0, n: 0, cats: {} });
    const a = Number(t.amount) || 0; g.total += a; g.n++; if (isBuildOut(t)) g.build += a;
    const c = t.category || '—'; g.cats[c] = (g.cats[c] || 0) + a;
  }
  const months = Object.keys(map).sort().reverse();
  if (!months.length) return `<div class="report-card"><div class="muted">${tr('Nothing in this range', 'Is range me kuch nahi')}</div></div>`;
  const max = Math.max(1, ...months.map((m) => map[m].total));
  return `<div class="report-card list-card"><h4>📅 ${tr('Month-wise spend', 'Mahine-wise kharcha')}<span class="h4-sub">${months.length}</span></h4><div class="rl-rows">${months.map((m) => {
    const g = map[m], y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1, b = monthBounds(y, mo);
    const top = Object.entries(g.cats).sort((a, c) => c[1] - a[1]).slice(0, 2).map(([c, v]) => `${c} ${inrShort(v)}`).join(' · ');
    const personal = g.total - g.build;
    return `<div class="rli tap" data-f="${esc(JSON.stringify({ range: 'custom', from: b.from, to: b.to }))}" tabindex="0" role="button"><div class="rrow"><div class="k">${esc(monthShort(mo) + ' ' + y)}<small>${esc(g.n + ' ' + tr('entries', 'entries') + ' · ' + top + (personal > 0 ? ' · ' + tr('incl. Personal ', 'Personal ') + inrShort(personal) : ''))}</small></div><div class="v">${inr(g.total)}<span class="chev">›</span></div></div>
      <div class="bar red"><span style="width:${Math.round(g.total / max * 100)}%"></span></div></div>`;
  }).join('')}</div></div>`;
}

/* ========================== SCREEN: KHATA (party = khata) ========================= */
// Har party (thekedar / vendor / supplier) ka ek jagah hisaab. Theka alag, side kaam ka udhaar alag.
function khataData() {
  return parties().map((p) => {
    const L = partyLedger(p);
    const st = p.contracts.map((c) => thekaStatus(c));
    const cats = new Set(L.map((t) => t.category || ''));
    let last = '';
    for (const t of L) if ((t.date || '') > last) last = t.date;
    for (const c of p.contracts) if ((c.start_date || '') > last) last = c.start_date;
    return Object.assign(p, {
      ledger: L, n: L.length, last,
      paid: L.filter((t) => t.payment_mode !== 'Udhaar').reduce((s, t) => s + (Number(t.amount) || 0), 0),
      st, thekaBaaki: st.filter((s) => s.kind === 'baaki').reduce((s, x) => s + x.diff, 0),
      supplier: !p.contracts.length && cats.size === 1 && cats.has('Material')
    });
  }).sort((a, b) => (b.last || '').localeCompare(a.last || '') || a.name.localeCompare(b.name));
}
const KHATA_TABS = [['all', 'All', 'Sab'], ['baaki', 'To pay', 'Dena baaki'], ['udhaar', 'Udhaar', 'Udhaar'], ['theka', 'Theka', 'Theka'], ['supplier', 'Supplier', 'Supplier']];
function khataMatch(p, tab) {
  if (tab === 'baaki') return p.udhaar > 0 || p.thekaBaaki > 0;
  if (tab === 'udhaar') return p.udhaar > 0;
  if (tab === 'theka') return p.contracts.length > 0;
  if (tab === 'supplier') return p.supplier;
  return true;
}
function khataRow(p) {
  const tags = [];
  if (p.udhaar > 0) tags.push(`<span class="tag udhaar">udhaar ${inr(p.udhaar)}</span>`);
  for (const s of p.st) {
    if (s.kind === 'baaki') tags.push(`<span class="tag red">${tr('theka left', 'theka baaki')} ${inr(s.diff)}</span>`);
    else if (s.kind === 'advance') tags.push(`<span class="tag blue">advance ${inr(s.diff)}</span>`);
    else if (s.kind === 'done') tags.push(`<span class="tag">${tr('theka', 'theka')} ${tr('fully paid', 'pura')} ✅</span>`);
    else if (s.kind === 'ratewise') tags.push(`<span class="tag blue">${tr('rate-wise theka', 'rate-wise theka')}</span>`);
    else tags.push(`<span class="tag amber">${tr('set theka amount', 'theka amount daalo')}</span>`);
  }
  if (!p.contracts.length && !p.udhaar && p.settled > 0) tags.push(`<span class="tag">udhaar ${tr('settled', 'chuk gaya')} ✅</span>`);
  return `<div class="krow tap" data-party="${esc(p.key)}" tabindex="0" role="button">
    <div class="k-main"><div class="k-name ud">${esc(p.name)}</div>
      ${tags.length ? `<div class="k-tags">${tags.join('')}</div>` : ''}
      <div class="k-sub">${p.n} ${tr('entries', 'entries')} · ${inr(p.paid)} ${tr('paid', 'diya')}${p.last ? ' · ' + esc(fmtDate(p.last)) : ''}</div></div>
    <div class="k-arrow">›</div></div>`;
}
let khTimer = null;
function screenTheka() {
  const ps = khataData();
  const udTotal = pendingUdhaar().reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const thekaBaaki = state.contracts.map(thekaStatus).filter((s) => s.kind === 'baaki').reduce((s, x) => s + x.diff, 0);
  const tab = state.khataTab || 'all';
  const html = `
    <div class="screen">
      <h2 class="title">${tr('Khata (party-wise)', 'Khata (party-wise hisaab)')}</h2>
      <div class="due-card tap" id="k-due" tabindex="0" role="button">
        <div class="due-l">${tr('Total to pay', 'Kul dena baaki')}</div>
        <div class="due-v">${inr(udTotal + thekaBaaki)}</div>
        <div class="due-s">${tr('Udhaar', 'Udhaar')} ${inr(udTotal)} · ${tr('Theka left', 'Theka baaki')} ${inr(thekaBaaki)} <span class="muted">(${tr('advances not counted', 'advance nahi gina')})</span></div>
      </div>
      <div class="toolbar"><input id="k-q" type="search" autocomplete="off" placeholder="🔍 ${tr('Search party', 'Party dhoondo')}" value="${esc(state.khataQ || '')}" />
        <button type="button" class="btn-secondary" id="add-theka">➕ ${tr('Theka', 'Theka')}</button></div>
      <div class="filter-chips" id="k-chips">${KHATA_TABS.map(([k, en, hi]) => `<button type="button" class="chip sm ${tab === k ? 'active' : ''}" data-k="${k}">${tr(en, hi)} <span class="cn">${ps.filter((p) => khataMatch(p, k)).length}</span></button>`).join('')}</div>
      <div class="list k-list" id="k-list"></div>
      <p class="muted" style="margin:12px 2px 0">${tr('Theka and side-work udhaar are kept separate. Tap a party for the full ledger, payments, udhaar settle and WhatsApp hisaab.', 'Theka aur side kaam ka udhaar alag-alag. Party pe tap karo — poora ledger, payment, udhaar chukao, WhatsApp hisaab.')}</p>
    </div>`;
  const bind = () => {
    const renderList = () => {
      const q = nameKey(state.khataQ || ''), t = state.khataTab || 'all';
      const rows = ps.filter((p) => khataMatch(p, t) && (!q || p.key.includes(q)));
      $('#k-list').innerHTML = rows.length ? rows.map(khataRow).join('') : emptyState(tr('No party found', 'Koi party nahi mili'));
      $('#k-list').querySelectorAll('[data-party]').forEach((el) => el.onclick = () => openParty(el.dataset.party));
    };
    $('#add-theka').onclick = () => openThekaForm();
    $('#k-due').onclick = () => { state.khataTab = 'baaki'; $('#k-chips').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x.dataset.k === 'baaki')); renderList(); };
    $('#k-chips').querySelectorAll('.chip').forEach((c) => c.onclick = () => { state.khataTab = c.dataset.k; $('#k-chips').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c)); renderList(); });
    $('#k-q').oninput = (e) => { clearTimeout(khTimer); const v = e.target.value; khTimer = setTimeout(() => { state.khataQ = v; renderList(); }, 150); };
    renderList();
  };
  return { html, bind };
}

function openParty(key) {
  const p = parties().find((x) => x.key === key);
  if (!p) return;
  const pend = pendingUdhaar(key);
  const all = state.transactions.filter((t) => t.type === 'Out' && nameKey(t.vendor) === key);
  const settledByDate = {};
  for (const t of all) { const d = paidOn(t.notes); if (d) { const s = settledByDate[d] || (settledByDate[d] = { amt: 0, n: 0 }); s.amt += Number(t.amount) || 0; s.n++; } }
  const thekaIds = new Set(p.contracts.map((c) => c.id));
  // Theka ka diya theke ke link se (vendor naam kuch bhi likha ho) — Theka screen jaisa hi number
  const thekaPaid = p.contracts.reduce((s, c) => s + contractPaid(c.id), 0);
  const otherPaid = all.filter((t) => t.payment_mode !== 'Udhaar' && !(t.category === 'Theka Payment' && thekaIds.has(t.contract_id))).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  // Poora ledger (purana → naya running total of diya); dikhate naya pehle
  const L = partyLedger(p).sort(sortOldFirst);
  let run = 0; const runMap = {};
  for (const t of L) { if (t.payment_mode !== 'Udhaar') run += Number(t.amount) || 0; runMap[t.id] = run; }
  const inner = `
    <h3>📒 <span class="ud">${esc(p.name)}</span></h3>
    <div class="party-head">
      <div><b>${inr(thekaPaid + otherPaid)}</b><small>${tr('paid', 'kul diya')}</small></div>
      <div><b style="color:${p.udhaar > 0 ? '#8a6100' : 'inherit'}">${inr(p.udhaar)}</b><small>${tr('udhaar pending', 'udhaar baaki')}</small></div>
      <div><b>${L.length}</b><small>${tr('entries', 'entries')}</small></div>
    </div>
    <div class="party-actions">
      <button class="btn-primary" id="p-pay">➕ ${tr('Pay', 'Payment do')}</button>
      <div class="row2"><button class="btn-secondary" id="p-entries">📜 ${tr('See in Entries', 'Entries mein dekho')}</button><button class="btn-secondary" id="p-wa">📤 ${tr('Send on WhatsApp', 'WhatsApp pe hisaab')}</button></div>
    </div>
    ${p.contracts.map((c) => { const s = thekaStatus(c), sl = thekaStatusLine(s); return `<div class="report-card">
      <h4>🤝 ${tr('Theka', 'Theka')}${c.kaam ? ' — <span class="ud">' + esc(c.kaam) + '</span>' : ''}</h4>
      ${sqftLabel(c.notes) ? `<div class="muted" style="margin:-4px 0 6px">📐 ${esc(sqftLabel(c.notes))}</div>` : ''}
      <div class="rrow"><div class="k">${tr('Theka amount', 'Theka amount')}</div><div class="v">${s.amt ? inr(s.amt) : '—'}</div></div>
      <div class="rrow"><div class="k">${tr('Paid', 'Diya')}</div><div class="v" style="color:#1f7a4d">${inr(s.paid)}</div></div>
      <div class="rrow"><div class="k">${esc(sl.k)}</div><div class="v" style="color:${sl.color}">${esc(sl.v)}</div></div>
      ${(() => { const rl = parseRates(c.notes); if (!rl.length) return ''; return `<div class="section-label" style="margin-top:12px">${tr('Rate list', 'Rate list')}</div>` +
        rl.map((l) => `<div class="rrow"><div class="k"><span class="ud">${esc(l.n)}</span><small>${inr(l.r)} ${esc(RATE_UNITS[l.u] || '')}${Number(l.q) ? ' × ' + esc(l.q) : ''}</small></div><div class="v">${Number(l.q) ? inr(rateLineAmt(l)) : '<span class="muted">' + tr('pending', 'baaki') + '</span>'}</div></div>`).join('') +
        (ratesTotal(rl) ? `<div class="total-line"><span>${tr('Measured total', 'Measurement total')}</span><span>${inr(ratesTotal(rl))}</span></div>` : ''); })()}
      ${s.kind === 'advance' ? `<div class="muted" style="margin-top:6px">${tr('Paid more than current theka amount — normal if more work/measurement is still to be added. Update the theka amount after measurement.', 'Theka amount se zyada diya — normal hai agar aur kaam/measurement abhi add hona hai. Measurement ke baad theka amount update kar dena.')}</div>` : ''}
      <button class="btn-secondary" data-edit-theka="${esc(c.id)}" style="width:100%;margin-top:10px">✏️ ${tr('Edit theka / measurement', 'Theka / measurement edit')}</button>
    </div>`; }).join('')}
    ${pend.length || Object.keys(settledByDate).length ? `<div class="report-card">
      <h4>👷 ${tr('Side work (outside theka)', 'Side kaam (theke se alag)')}</h4>
      <div class="rrow"><div class="k">${tr('Udhaar pending', 'Udhaar baaki')}<small>${pend.length} ${tr('entries', 'entries')}${pend.length ? ' · ' + tr('from ', '') + fmtDate(pend[0].date) + tr('', ' se') : ''}</small></div><div class="v" style="color:#8a6100">${inr(p.udhaar)}</div></div>
      ${Object.keys(settledByDate).sort().reverse().map((d) => `<div class="rrow"><div class="k">✅ ${tr('Settled on', 'Chukaya')} ${fmtDate(d)}<small>${settledByDate[d].n} ${tr('entries', 'entries')}</small></div><div class="v" style="color:#1f7a4d">${inr(settledByDate[d].amt)}</div></div>`).join('')}
      ${pend.length ? `<button class="btn-primary" id="bulk-settle">💸 ${tr('Settle udhaar', 'Udhaar chukao')} (${inr(p.udhaar)})</button>` : ''}
    </div>` : ''}
    <div class="report-card">
      <h4>🧮 ${tr('Total paid to', 'Kul diya')} <span class="ud">${esc(p.name)}</span></h4>
      ${p.contracts.length ? `<div class="rrow"><div class="k">${tr('Theka payments', 'Theka payments')}</div><div class="v">${inr(thekaPaid)}</div></div>` : ''}
      <div class="rrow"><div class="k">${tr('Other payments (side work, material…)', 'Baaki payments (side kaam, material…)')}</div><div class="v">${inr(otherPaid)}</div></div>
      <div class="total-line"><span>${tr('Total', 'Total')}</span><span>${inr(thekaPaid + otherPaid)}</span></div>
    </div>
    ${L.length ? `<div class="section-label ledger-h"><span>📜 ${tr('Full ledger (newest first)', 'Poora hisaab (naya pehle)')}</span>
      <span class="seg-toggle" id="led-tabs"><button type="button" class="on" data-l="all">${tr('All', 'Sab')}</button>${pend.length ? `<button type="button" data-l="ud">Udhaar</button>` : ''}</span></div>
      <div class="muted" style="margin:-4px 2px 8px">∑ = ${tr('total paid up to that entry (udhaar not counted until settled)', 'us entry tak kul diya (udhaar chukne tak nahi gina)')}</div>
      <div class="day-card" id="party-ledger">${L.slice().reverse().map((t) => entryRow(t, { running: runMap[t.id] })).join('')}</div>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Close', 'Band karo')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelectorAll('[data-edit-theka]').forEach((b) => b.onclick = () => { const c = state.contracts.find((x) => x.id === b.dataset.editTheka); closeSheet(); if (c) openThekaForm(c); });
    const bs = root.querySelector('#bulk-settle'); if (bs) bs.onclick = () => { closeSheet(); openBulkSettle(key); };
    const pl = root.querySelector('#party-ledger'); if (pl) bindEntryRows(pl);
    const lt = root.querySelector('#led-tabs');
    if (lt) lt.querySelectorAll('button').forEach((b) => b.onclick = () => {
      lt.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      pl.querySelectorAll('.entry').forEach((e) => e.classList.toggle('hidden', b.dataset.l === 'ud' && !e.dataset.ud));
    });
    root.querySelector('#p-pay').onclick = () => {
      closeSheet();
      const c = p.contracts.length ? pickContract(p.contracts) : null;
      const pp = partyProfile(p.name);
      openOutForm(null, { vendor: p.name, mode: 'Cash', category: c ? 'Theka Payment' : ((pp && pp.topCat) || undefined), contract_id: c ? c.id : null });
    };
    root.querySelector('#p-entries').onclick = () => { closeSheet(); openEntriesWith({ party: p.name }); };
    root.querySelector('#p-wa').onclick = () => openWhatsAppSummary(p);
  });
}

// WhatsApp pe hisaab: sirf text banta hai, user dekh/badal sakta hai, phir wa.me khulta hai. App khud kuch nahi bhejta.
function partySummaryText(p) {
  const out = [];
  out.push(`*${p.name} — ${tr('Account statement', 'Hisaab')}*`);
  out.push(`${tr('As on', 'Tareekh')}: ${fmtDate(today())}`);
  let thekaBaaki = 0;
  for (const c of p.contracts) {
    const s = thekaStatus(c), sl = thekaStatusLine(s);
    out.push(''); out.push(`🤝 ${tr('Theka', 'Theka')}${c.kaam ? ': ' + c.kaam : ''}`);
    if (s.amt) out.push(`${tr('Theka amount', 'Theka amount')}: ${inr(s.amt)}`);
    const sq = sqftLabel(c.notes); if (sq) out.push(`${tr('Measurement', 'Measurement')}: ${sq}`);
    const rl = parseRates(c.notes);
    if (rl.length) {
      out.push(tr('Rate list:', 'Rate list:'));
      for (const l of rl) out.push(`• ${l.n}: ${inr(l.r)} ${RATE_UNITS[l.u] || ''}${Number(l.q) ? ' × ' + l.q + ' = ' + inr(rateLineAmt(l)) : ''}`);
      if (ratesTotal(rl)) out.push(`${tr('Measured total', 'Measurement total')}: ${inr(ratesTotal(rl))}`);
    }
    out.push(`${tr('Paid on theka', 'Theke pe diya')}: ${inr(s.paid)}`);
    out.push(`${sl.k}: ${sl.v}`);
    if (s.kind === 'baaki') thekaBaaki += s.diff;
  }
  const L = partyLedger(p).sort(sortOldFirst);
  const paid = L.filter((t) => t.payment_mode !== 'Udhaar');
  const paidSum = paid.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (paid.length) {
    out.push(''); out.push(`💸 ${tr('Payments', 'Payments')} (${paid.length}):`);
    const MAX = 40;
    if (paid.length > MAX) out.push(`… ${paid.length - MAX} ${tr('older payments', 'purani payments')} ${inr(paid.slice(0, paid.length - MAX).reduce((s, t) => s + (Number(t.amount) || 0), 0))}`);
    for (const t of paid.slice(-MAX)) {
      const what = t.category === 'Theka Payment' ? tr('Theka', 'Theka') : (t.item || t.category || '');
      out.push(`• ${fmtDate(t.date)} — ${inr(t.amount)}${t.payment_mode ? ' (' + t.payment_mode + ')' : ''}${what ? ' · ' + what : ''}`);
    }
    out.push(`${tr('Total paid', 'Kul diya')}: ${inr(paidSum)}`);
  }
  const pend = pendingUdhaar(p.key), udSum = pend.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (pend.length) {
    out.push(''); out.push(`👷 ${tr('Side work udhaar pending', 'Side kaam udhaar baaki')} (${pend.length}):`);
    for (const t of pend.slice(-30)) out.push(`• ${fmtDate(t.date)} — ${[t.item || t.category, fmtQtyRate(t)].filter(Boolean).join(' ')} = ${inr(t.amount)}`);
    out.push(`${tr('Udhaar total', 'Udhaar total')}: ${inr(udSum)}`);
  }
  out.push('');
  const due = thekaBaaki + udSum;
  out.push(due > 0 ? `*${tr('Total to pay', 'Kul dena baaki')}: ${inr(due)}*` : `*${tr('Nothing pending', 'Kuch baaki nahi')} ✅*`);
  return out.join('\n');
}
function openWhatsAppSummary(p) {
  const text = partySummaryText(p);
  const inner = `
    <h3>📤 ${tr('WhatsApp hisaab', 'WhatsApp pe hisaab')} — <span class="ud">${esc(p.name)}</span></h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Check or edit the text. WhatsApp opens — choose the contact there.', 'Text dekh lo / badal lo. WhatsApp khulega — wahan contact chuno.')}</p>
    <div class="field"><textarea id="wa-text" class="wa-text">${esc(text)}</textarea></div>
    <button class="btn-primary" id="wa-send">📤 ${tr('Open WhatsApp', 'WhatsApp kholo')}</button>
    <div class="row2" style="margin-top:8px"><button class="btn-secondary" id="wa-copy">📋 ${tr('Copy', 'Copy karo')}</button><button class="btn-ghost" id="cancel" style="margin-top:0">${tr('Close', 'Band karo')}</button></div>`;
  openSheet(inner, (root) => {
    const ta = root.querySelector('#wa-text');
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#wa-send').onclick = () => { window.open('https://wa.me/?text=' + encodeURIComponent(ta.value), '_blank'); };
    root.querySelector('#wa-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); toast(tr('Copied', 'Copy ho gaya')); }
      catch (_) { ta.select(); try { document.execCommand('copy'); toast(tr('Copied', 'Copy ho gaya')); } catch (e) { toast(tr('Copy failed — select and copy', 'Copy nahi hua — select karke copy karo'), true); } }
    };
  });
}

function openBulkSettle(key) {
  const pend = pendingUdhaar(key); if (!pend.length) return;
  const name = canonName(pend[0].vendor, vendorMap());
  const total = money(pend.reduce((s, t) => s + (Number(t.amount) || 0), 0));
  const inner = `
    <h3>💸 ${tr('Settle udhaar', 'Udhaar chukao')} — ${esc(name)}</h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Total pending', 'Kul baaki')} <b>${inr(total)}</b> (${pend.length} ${tr('entries', 'entries')}). ${tr('Oldest entries are settled first. Amounts are never lost — a partial payment leaves the rest as udhaar.', 'Purani entries pehle chukti hain. Amount kabhi nahi khota — aadha diya to baaki udhaar me hi rahega.')}</p>
    <div class="field"><label>${tr('Amount paid ₹', 'Kitna diya ₹')}</label><input id="b-amt" type="text" inputmode="decimal" value="${total}" /><div class="amt-preview" id="b-prev"></div></div>
    <div class="field"><label>${tr('Mode', 'Mode')}</label>${chipsHtml('bmode', PAY_MODES.filter((m) => m !== 'Udhaar'), 'Cash')}</div>
    <div class="field"><label>${tr('Paid from (account)', 'Kahan se diya (account)')}</label><select id="b-acc">${accOptions(accountForMode('Cash', null))}</select></div>
    <div class="field"><label>${tr('Date paid', 'Kis din diya')}</label><input id="b-date" type="date" value="${today()}" /></div>
    <button class="btn-primary" id="save">✅ ${tr('Mark paid', 'Paid mark karo')}</button>
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    const amtEl = root.querySelector('#b-amt'), prev = root.querySelector('#b-prev'), accEl = root.querySelector('#b-acc');
    const showPrev = () => {
      const paid = num(amtEl.value);
      if (isNaN(paid) || paid <= 0) { prev.textContent = ''; return; }
      let left = paid, n = 0; for (const t of pend) { if (left <= 0) break; left -= Number(t.amount) || 0; n++; }
      prev.innerHTML = paid >= total ? `<b>${tr('All', 'Saari')} ${pend.length} ${tr('entries settled', 'entries chuk jayengi')}</b>` + (paid > total ? ` · ${tr('extra', 'extra')} ${inr(paid - total)} ${tr('not used', 'use nahi hoga')}` : '')
        : `${n} ${tr('entries (oldest first)', 'entries (purani pehle)')} · ${tr('Remaining udhaar', 'Baaki udhaar')}: <b>${inr(total - paid)}</b>`;
    };
    amtEl.oninput = showPrev; showPrev();
    bindChips(root, 'bmode', (m) => { const a = accountForMode(m, accEl.value); if (a) accEl.value = a; });
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#save').onclick = async () => {
      let paid = num(amtEl.value);
      if (isNaN(paid) || paid <= 0) return toast(tr('Enter amount paid', 'Kitna diya wo daalo'), true);
      paid = money(Math.min(paid, total));
      const acc = accEl.value; if (!acc) return toast(tr('Choose the paying account', 'Account chuno jahan se diya'), true);
      const mode = chipVal(root, 'bmode'); const d = root.querySelector('#b-date').value || today();
      if (!confirm(tr(`${inr(paid)} paid to ${name} via ${mode} on ${fmtDate(d)}. Mark as paid?`, `${name} ko ${inr(paid)} diye (${mode}, ${fmtDate(d)}). Paid mark karein?`))) return;
      closeSheet();
      await settleUdhaar(pend, paid, acc, mode, d);
      refresh(); toast(tr('Udhaar updated ✅', 'Udhaar update ho gaya ✅'));
    };
  });
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
        ${state.accounts.map((a) => { const meta = accTracked(a) ? `${tr('Balance', 'Balance')} ${inr(balanceOf(a.id))}` : `${tr('Spent', 'Gaya')} ${inr(spentViaAccount(a.id))}`; return `<div class="entry" data-acc="${a.id}">
          <div class="ic">${a.type === 'Cash' ? '💵' : '🏦'}</div>
          <div class="body"><div class="ttl">${esc(a.name)}</div><div class="meta">${a.type} · ${meta}</div></div>
          <div class="amt">›</div></div>`; }).join('')}
      </div>
      <button class="btn-secondary" id="add-acc" style="width:100%;margin-top:10px">➕ ${tr('New Account', 'Naya Account')}</button>

      <div class="section-label">${tr('House budget', 'Ghar ka budget')}</div>
      <div style="display:flex;gap:8px"><input id="budget-in" type="text" inputmode="decimal" value="${getBudget() || ''}" placeholder="${tr('e.g. 3000000', 'jaise 3000000')}" style="flex:1;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px" /><button class="btn-secondary" id="budget-save">${tr('Save', 'Save')}</button></div>
      <div class="muted" style="margin-top:6px">${tr('Shown on Home as a progress bar (saved on this phone).', 'Home pe progress bar dikhega (is phone me save hota hai).')}</div>

      <div class="section-label">${tr('Hisaab check', 'Hisaab check')}</div>
      <button class="btn-secondary" id="cleanup" style="width:100%">🧹 ${tr('Hisaab cleanup (suggestions)', 'Hisaab cleanup (suggestions)')}</button>
      ${localStorage.getItem('gk_cleanup_undo') ? `<button class="btn-ghost" id="cleanup-undo" style="width:100%">↩️ ${tr('Undo last cleanup', 'Pichla cleanup undo karo')}</button>` : ''}

      <div class="section-label">${tr('Backup', 'Backup')}</div>
      <div class="small-actions">
        <button class="btn-secondary" id="exp-json">⬇️ ${tr('Backup (JSON)', 'Backup (JSON)')}</button>
        <button class="btn-secondary" id="exp-csv">⬇️ CSV</button>
      </div>
      <button class="btn-secondary" id="sync-now" style="width:100%;margin-top:8px">🔄 ${tr('Sync now', 'Abhi Sync karo')}</button>
      <button class="btn-secondary" id="activity-log" style="width:100%;margin-top:8px">🔍 ${tr('Activity log / Errors', 'Activity log / Errors')}</button>

      <details class="adv">
        <summary>⚙️ ${tr('Advanced', 'Advanced')}</summary>
        <button class="btn-secondary" id="import-btn" style="width:100%;margin-top:10px">📥 ${tr('Import entries (JSON)', 'Entries import (JSON)')}</button>
        <button class="btn-ghost" id="clear-all" style="width:100%;margin-top:8px;color:var(--red);border-color:#f3c9c4">🗑️ ${tr('Clear all data', 'Sab data clear karo')}</button>
        ${!cfgValid() ? `
        <div class="section-label">${tr('Cloud (Supabase)', 'Cloud (Supabase)')}</div>
        <div class="field"><label>${tr('Project URL', 'Project URL')}</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" /></div>
        <div class="field"><label>${tr('Anon public key', 'Anon public key')}</label><input id="cfg-key" value="${esc(c.key)}" placeholder="eyJ..." autocapitalize="off" autocorrect="off" /></div>
        <button class="btn-secondary" id="save-cfg" style="width:100%">💾 ${tr('Save cloud config', 'Cloud config save')}</button>` : ''}
      </details>

      <div class="section-label">${tr('Account', 'Account')}</div>
      <div class="muted" style="margin:0 2px 8px">${tr('Logged in', 'Logged in')}: ${esc(email || '—')}</div>
      <button class="btn-ghost" id="logout">🚪 ${tr('Logout', 'Logout')}</button>
      <div class="center muted mt16">Pai-Pai · v1</div>
    </div>`;

  const bind = () => {
    $('#lang-toggle').querySelectorAll('button').forEach((b) => b.onclick = () => { if (b.dataset.l !== lang) { setLang(b.dataset.l); refresh(); } });
    $('#add-acc').onclick = () => openAccountForm();
    $('#budget-save').onclick = () => { const b = num($('#budget-in').value); if (isNaN(b) || b <= 0) localStorage.removeItem('gk_budget'); else localStorage.setItem('gk_budget', String(money(b))); toast(tr('Budget saved', 'Budget save')); };
    $('#cleanup').onclick = openCleanup;
    const cu = $('#cleanup-undo'); if (cu) cu.onclick = undoCleanup;
    $('#screen').querySelectorAll('.entry[data-acc]').forEach((el) => el.onclick = () => {
      const a = state.accounts.find((x) => x.id === el.dataset.acc); if (a) openAccountForm(a);
    });
    $('#exp-json').onclick = exportJSON;
    $('#exp-csv').onclick = () => exportCSV();
    $('#sync-now').onclick = async () => { toast(tr('Syncing…', 'Sync…')); await flushQueue(); await loadAll(); refresh(); toast(tr('Done', 'Ho gaya')); };
    $('#activity-log').onclick = openActivityLog;
    $('#import-btn').onclick = openImportForm;
    $('#clear-all').onclick = clearAllData;
    const sc = $('#save-cfg');
    if (sc) sc.onclick = () => {
      const url = $('#cfg-url').value, key = $('#cfg-key').value;
      if (!url || !key) return toast(tr('Enter both URL and key', 'URL aur key dono daalein'), true);
      setCfg(url, key); toast(tr('Saved — reloading app', 'Save ho gaya — app reload ho raha hai')); setTimeout(() => location.reload(), 800);
    };
    $('#logout').onclick = async () => {
      // Logout se pehle bin-sync entries bachao — warna offline entry hamesha ke liye chali jaati thi
      if (pendingCount() > 0 && state.online && sb) { toast(tr('Syncing before logout…', 'Logout se pehle sync…')); await flushQueue(); }
      if (pendingCount() > 0) {
        const n = pendingCount();
        if (!confirm(tr(n + ' entr' + (n > 1 ? 'ies are' : 'y is') + ' not synced yet and will be LOST on logout. Logout anyway?', n + ' entries abhi sync nahi hui — logout par chali jayengi. Fir bhi logout?'))) return;
      }
      if (sb) { try { await sb.auth.signOut(); } catch (_) {} }
      // Phone pe pichle user ka hisaab na reh jaye (shared phone par dusre ko dikh jaata tha)
      clearLocalData(); location.reload();
    };
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
function setChip(root, name, value) { const w = root.querySelector(`[data-chips="${name}"]`); if (w) w.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.val === value)); }
function accOptions(selId) { return state.accounts.map((a) => `<option value="${a.id}" ${a.id === selId ? 'selected' : ''}>${esc(a.name)}</option>`).join(''); }

/* ====================== FORM: Kharcha (Out) ====================== */
// Order: Amount → Kise diya (party) → Category → Item → Mode → Date. Qty × Rate, note, account "+ Aur" me.
// Party chunte hi smart defaults (sirf pre-fill; jo user ne khud chhua wo kabhi nahi badalta).
// preset (naya entry): { vendor, category, contract_id, mode, account, date, next }
function openOutForm(existing, preset) {
  preset = preset || {};
  // isEdit = sach me purani saved entry (Repeat me clone ka naya id hota hai → new entry)
  const isEdit = !!(existing && state.transactions.some((x) => x.id === existing.id));
  const fromExisting = !!existing;
  const md = catDefault('Material') || {};
  const defMode = (md.mode && md.mode !== 'Udhaar') ? md.mode : 'Cash';
  const pMode = preset.mode && PAY_MODES.includes(preset.mode) ? preset.mode : null;
  const mode0 = pMode || defMode;
  // Account mode se aayega (Cash mode -> Cash account), last-used se nahi — warna ek Bank entry sabko Bank bana deti thi
  const t = existing || {
    id: uid(), type: 'Out', date: preset.date || today(), category: preset.category || 'Material', payment_mode: mode0,
    account_id: accountForMode(mode0, preset.account || md.acc) || (state.accounts[0] || {}).id,
    vendor: preset.vendor || null, contract_id: preset.contract_id || null
  };
  const itemsDL = 'dl-items';
  // Purani entry ka unit agar list me na ho to bhi use option me rakho (warna save par chup-chaap badal jata)
  const unitOpts = (t.unit && !UNITS.includes(t.unit)) ? [t.unit, ...UNITS] : UNITS;
  const inner = `
    <h3>${isEdit ? tr('✏️ Edit expense', '✏️ Kharcha edit') : preset.next ? tr('➖ Next expense', '➖ Agla kharcha') : tr('➖ New Expense', '➖ Naya Kharcha')}</h3>
    ${preset.next ? `<div class="next-note">✅ ${tr('Saved. Same party, date & mode kept — just enter the amount.', 'Save ho gaya. Party, date aur mode wahi hai — bas amount daalo.')}</div>` : ''}
    <div class="field amt-field"><label>${tr('Amount ₹', 'Amount ₹ (kitna diya)')}</label><input id="f-amount" class="big-amt" type="text" inputmode="decimal" autocomplete="off" value="${t.amount ?? ''}" placeholder="₹ 0" /><div class="amt-preview" id="amt-prev"></div></div>

    <div class="field"><label>${tr('Paid to (party)', 'Kise diya (party)')}</label><input id="f-vendor" list="dl-vendor" autocomplete="off" autocapitalize="words" value="${esc(t.vendor || '')}" placeholder="${tr('shop / person name', 'dukaan / aadmi ka naam')}" />
      <datalist id="dl-vendor">${allVendors().map((v) => `<option>${esc(v)}</option>`).join('')}</datalist>
      <div class="chips recent" id="rc-vendors"></div></div>
    <div id="theka-hint" class="hint-card hidden"></div>

    <div class="field"><label>${tr('Category', 'Category')}</label>
      <div class="chips" data-chips="cat" id="cat-chips"></div>
      <div id="cat-new" class="hidden" style="display:flex;gap:8px;margin-top:8px">
        <input id="cat-new-input" placeholder="${tr('New category name', 'Nayi category ka naam')}" style="flex:1" autocapitalize="words" />
        <button type="button" class="btn-secondary" id="cat-new-add">${tr('Add', 'Add')}</button>
      </div>
    </div>

    <div id="item-block">
      <div class="field"><label>${tr('Item / Work', 'Item / Kaam')}</label>
        <input id="f-item" list="${itemsDL}" autocomplete="off" value="${esc(t.item || '')}" placeholder="${tr('e.g. Cement, Sariya, Kade, Taar…', 'jaise Cement, Sariya, Kade, Taar…')}" />
        <datalist id="${itemsDL}"></datalist>
        <div class="chips recent" id="rc-items"></div>
      </div>
    </div>

    <div id="theka-block" class="field hidden"><label>${tr('Which theka payment', 'Kis theke ka payment')}</label>
      <select id="f-contract"><option value="">${tr('— Choose theka —', '— Theka chuno —')}</option>${state.contracts.map((c) => `<option value="${esc(c.id)}" ${c.id === t.contract_id ? 'selected' : ''}>${esc(c.thekedar_name || c.kaam || tr('Theka', 'Theka'))}${c.kaam && c.thekedar_name ? ' — ' + esc(c.kaam) : ''}</option>`).join('')}</select>
    </div>

    <div class="field"><label>${tr('Payment mode', 'Payment mode')}</label>${chipsHtml('mode', PAY_MODES, t.payment_mode)}</div>
    ${dateFieldHtml('f-date', t.date)}

    <button type="button" class="more-toggle" id="more-toggle"></button>
    <div id="more-block" class="hidden">
      <div class="row3" id="qty-block">
        <div class="field"><label id="qty-label">${tr('Qty', 'Qty')}</label><input id="f-qty" type="text" inputmode="decimal" value="${t.qty ?? ''}" placeholder="0" /></div>
        <div class="field"><label>${tr('Unit', 'Unit')}</label><select id="f-unit">${unitOpts.map((u) => `<option ${u === t.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
        <div class="field"><label id="rate-label">${tr('Rate ₹', 'Rate ₹')}</label><input id="f-rate" type="text" inputmode="decimal" value="${t.rate ?? ''}" placeholder="0" /></div>
      </div>
      <div class="field"><label>${tr('Note (optional)', 'Note (optional)')}</label><textarea id="f-notes" placeholder="${tr('any detail…', 'koi detail…')}">${esc(cleanNote(t.notes))}</textarea></div>
      <div class="field" id="account-field"><label>${tr('Paid from (account)', 'Paisa kahan se gaya (account)')}</label><select id="f-account">${accOptions(t.account_id)}</select></div>
    </div>

    <div class="save-row"><button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>${isEdit ? '' : `<button class="btn-primary next" id="save-next">💾 ${tr('Save + next', 'Save + agla')}</button>`}</div>
    ${isEdit ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>
  `;
  openSheet(inner, (root) => {
    const isPaymentCat = (cat) => cat === 'Theka Payment' || cat === 'Architect';   // seedha payment (item/qty/rate nahi)
    let renderRecentItems = () => {};   // niche assign hota hai
    // User ne khud kya chhua? Smart defaults sirf un-chhue fields bharte hain.
    let catTouched = fromExisting || !!preset.category, itemTouched = fromExisting, itemAuto = false;
    let modeTouched = fromExisting || !!pMode, accountTouched = isEdit;
    const vendorEl = root.querySelector('#f-vendor'), itemEl = root.querySelector('#f-item'), unitEl = root.querySelector('#f-unit');
    const contractSel = root.querySelector('#f-contract'), hintEl = root.querySelector('#theka-hint');
    const moreBlock = root.querySelector('#more-block'), moreToggle = root.querySelector('#more-toggle');
    const moreOpen = () => !moreBlock.classList.contains('hidden');
    const setMoreLabel = () => {
      const pay = isPaymentCat(chipVal(root, 'cat'));
      moreToggle.textContent = (moreOpen() ? '− ' : '+ ') + (pay ? tr('More: note, account', 'Aur: note, account') : tr('More: qty × rate, note, account', 'Aur: qty × rate, note, account'));
    };
    const updItems = (cat) => { root.querySelector('#' + itemsDL).innerHTML = itemSuggestions(cat).map((i) => `<option>${esc(i)}</option>`).join(''); };
    const toggleBlocks = (cat) => {
      const pay = isPaymentCat(cat);
      root.querySelector('#item-block').classList.toggle('hidden', pay);
      root.querySelector('#qty-block').classList.toggle('hidden', pay);
      root.querySelector('#theka-block').classList.toggle('hidden', cat !== 'Theka Payment');
      setMoreLabel();
    };
    // Udhaar par "Paid from (account)" chhupao — abhi kisi account se paisa nahi gaya
    const toggleAccount = (mode) => { root.querySelector('#account-field').classList.toggle('hidden', mode === 'Udhaar'); };
    // Account ko current mode ke type se sync karo (last-used acc se nahi — Bank-trap khatam)
    const syncAccountToMode = () => {
      if (accountTouched) return;
      const sel = root.querySelector('#f-account'); if (!sel) return;
      const acc = accountForMode(chipVal(root, 'mode'), sel.value);
      if (acc) sel.value = acc;
    };
    // Category ka last-used mode pre-fill (Udhaar nahi) — jab tak user ne mode na chhua ho
    const applyCatDefault = (cat) => {
      const d = catDefault(cat); if (!d) return;
      if (!modeTouched && d.mode && d.mode !== 'Udhaar') { setChip(root, 'mode', d.mode); toggleAccount(d.mode); }
      syncAccountToMode();
    };
    // Custom categories: chips + "Naya" inline add (naya person/service)
    const catNew = root.querySelector('#cat-new'), catNewIn = root.querySelector('#cat-new-input');
    let selectCat = () => {};
    const renderCatChips = (selected) => {
      const wrap = root.querySelector('#cat-chips');
      wrap.innerHTML = allCats().map((c) => `<button type="button" class="chip ${c === selected ? 'active' : ''}" data-val="${esc(c)}">${esc(c)}</button>`).join('')
        + `<button type="button" class="chip cat-add" id="cat-add">+ ${tr('New', 'Naya')}</button>`;
      wrap.querySelectorAll('.chip[data-val]').forEach((c) => c.onclick = () => { catTouched = true; catNew.classList.add('hidden'); selectCat(c.dataset.val); });
      root.querySelector('#cat-add').onclick = () => { catNew.classList.remove('hidden'); catNewIn.value = ''; catNewIn.focus(); };
    };
    selectCat = (cat) => {
      renderCatChips(cat); updItems(cat); toggleBlocks(cat);
      if (!isEdit) applyCatDefault(cat);
      renderRecentItems(cat); applyItemUnit(); renderHint();
    };
    const addCat = () => {
      const name = catNewIn.value.trim(); if (!name) return;
      learnList('gk_categories', name); catNew.classList.add('hidden'); catTouched = true;
      renderCatChips(name); updItems(name); toggleBlocks(name);
    };
    root.querySelector('#cat-new-add').onclick = addCat;
    catNewIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });

    // Theke wali party → "Theka Payment" ka sujhav (ek tap me accept → contract_id set)
    const renderHint = () => {
      const pp = partyProfile(vendorEl.value);
      const c = pp && pp.contracts.length ? pickContract(pp.contracts) : null;
      const cat = chipVal(root, 'cat');
      if (!c) { hintEl.className = 'hint-card hidden'; hintEl.innerHTML = ''; return; }
      const st = thekaShortStatus(thekaStatus(c));
      if (cat === 'Theka Payment') {
        if (!isEdit && !contractSel.value) contractSel.value = c.id;   // naye payment me theka khud link (edit me kabhi nahi)
        const linked = contractById(contractSel.value);
        hintEl.className = 'hint-card ok';
        hintEl.innerHTML = linked ? `🤝 ${tr('Theka', 'Theka')}: <b class="ud">${esc(linked.thekedar_name || '')}</b>${linked.kaam ? ' · <span class="ud">' + esc(linked.kaam) + '</span>' : ''} · ${esc(thekaShortStatus(thekaStatus(linked)))}` : `🤝 ${tr('Choose which theka below', 'Niche theka chuno')}`;
        return;
      }
      if (catTouched) { hintEl.className = 'hint-card hidden'; hintEl.innerHTML = ''; return; }   // user ne khud category chuni
      hintEl.className = 'hint-card';
      hintEl.innerHTML = `<div>🤝 <b class="ud">${esc(pp.name)}</b> ${tr('has a running theka', 'ka theka chal raha hai')} → <b>Theka Payment</b> <span class="muted">(${esc(st)})</span></div>
        <button type="button" class="btn-secondary sm" id="hint-accept">${tr('Yes, theka payment', 'Haan, Theka Payment')}</button>`;
      hintEl.querySelector('#hint-accept').onclick = () => { catTouched = true; contractSel.value = c.id; selectCat('Theka Payment'); };
    };
    contractSel.addEventListener('change', () => {
      // Theka chuna aur party khaali → thekedar ka naam bhar do (sirf khaali ho to)
      const c = contractById(contractSel.value);
      if (c && c.thekedar_name && !vendorEl.value.trim()) { vendorEl.value = c.thekedar_name; appliedKey = nameKey(c.thekedar_name); }
      renderHint();
    });

    // Party-first smart defaults: category (sabse zyada wali), item (aakhri), mode (aakhri; Udhaar sirf agar aakhri Udhaar tha)
    let appliedKey = (fromExisting || preset.next) ? nameKey(t.vendor) : null;
    const applyParty = () => {
      const k = nameKey(vendorEl.value);
      if (k && k !== appliedKey && !fromExisting) {
        const pp = partyProfile(vendorEl.value);
        if (pp) {
          appliedKey = k;
          if (!catTouched && pp.topCat && allCats().includes(pp.topCat)) selectCat(pp.topCat);
          const cat = chipVal(root, 'cat');
          if (!itemTouched && !isPaymentCat(cat)) {
            const it = pp.lastItemByCat[cat] || '';
            if (it || itemAuto) { itemEl.value = it; itemAuto = !!it; applyItemUnit(); }
          }
          if (!modeTouched && pp.lastMode && PAY_MODES.includes(pp.lastMode)) { setChip(root, 'mode', pp.lastMode); toggleAccount(pp.lastMode); syncAccountToMode(); }
        }
      }
      renderHint();
    };

    // Mode chuna → account us type ka set (Cash->Cash, UPI/NetBanking/Online->Bank)
    bindChips(root, 'mode', (m) => {
      modeTouched = true; toggleAccount(m);
      const sel = root.querySelector('#f-account');
      const acc = accountForMode(m, sel.value);   // sahi-type ho to wahi rahega
      if (acc) sel.value = acc;
    });
    root.querySelector('#f-account').addEventListener('change', () => { accountTouched = true; });
    toggleAccount(t.payment_mode);
    bindDateField(root, 'f-date');

    const qty = root.querySelector('#f-qty'), rate = root.querySelector('#f-rate'), amount = root.querySelector('#f-amount'), prev = root.querySelector('#amt-prev');
    // "manual" tabhi jab stored amount sach me qty×rate se alag ho (ya qty/rate hai hi nahi).
    let manual = !!(existing && existing.amount != null && (existing.qty == null || existing.rate == null ||
      Number(existing.amount).toFixed(2) !== lineAmount(existing.qty, existing.rate, existing.unit).toFixed(2)));
    // Eint/Hazaar jaise per-1000 unit par Rate ka label "/ 1000" dikhao (taaki per-piece rate na daale)
    const rateLabel = root.querySelector('#rate-label'), qtyLabel = root.querySelector('#qty-label');
    const syncRateLabel = () => { const p = PER_1000_UNITS.includes(unitEl.value); rateLabel.textContent = p ? tr('Rate ₹ / 1000', 'Rate ₹ / 1000') : tr('Rate ₹', 'Rate ₹'); qtyLabel.textContent = p ? tr('Qty (pcs)', 'Qty (ginti)') : tr('Qty', 'Qty'); };
    const calc = () => {
      syncRateLabel();
      const q = num(qty.value), r = num(rate.value);
      if (!isNaN(q) && !isNaN(r)) {
        const per1000 = PER_1000_UNITS.includes(unitEl.value);
        const amt = lineAmount(q, r, unitEl.value);
        prev.innerHTML = `${q} × ${inr(r)}${per1000 ? ' <b>÷ 1000</b>' : ''} = <b>${inr(amt)}</b>` +
          (per1000 && q > 0 && q < 100 ? `<br><span style="color:#c0392b">⚠️ ${tr('Qty must be the full count (e.g. 5000 bricks), not thousands', 'Qty me poori ginti daalo (jaise 5000 eint), hazaar nahi')}</span>` : '');
        if (!manual) amount.value = amt.toFixed(2).replace(/\.00$/, '');
      } else prev.textContent = '';
    };
    // Qty/rate badle → amount dobara auto (preview = jo save hoga). Amount khud type karo → manual.
    const onQtyRate = () => { manual = false; calc(); };
    qty.oninput = onQtyRate; rate.oninput = onQtyRate; amount.oninput = () => { manual = amount.value.trim() !== ''; calc(); }; calc();

    // Item ke hisaab se unit auto-set (reta/bajri/mitti → Sakda), jab tak user khud unit na badle
    let unitTouched = !!(existing && existing.unit);
    unitEl.onchange = () => { unitTouched = true; calc(); };
    const applyItemUnit = () => {
      if (unitTouched) return;
      const k = Object.keys(ITEM_UNIT).find((x) => x.toLowerCase() === itemEl.value.trim().toLowerCase());
      if (k) { unitEl.value = ITEM_UNIT[k]; return; }
      const cu = CAT_UNIT[chipVal(root, 'cat')];   // item match nahi → category ka default (Labour→Din)
      if (cu) unitEl.value = cu;
    };

    // Rate-book: item + dukaan ka pichla rate — sirf jab Qty × Rate khula ho (chhupa rate kabhi save na ho)
    let rateAuto = false;
    const maybeFillRate = () => {
      if (!moreOpen() || isPaymentCat(chipVal(root, 'cat'))) return;
      if (rate.value.trim() !== '' && !rateAuto) return;          // user ka type kiya rate na badlo
      if (!vendorEl.value.trim()) return;                         // dukaan pata nahi → rate guess mat karo
      const rb = rbGetExact(itemEl.value, vendorEl.value);        // sirf isi item + isi dukaan ka pichla rate
      if (rb != null && String(rb) !== rate.value) {
        rate.value = rb; rateAuto = true; manual = false; calc();
        toast(tr(vendorEl.value.trim() + "'s last rate ₹" + rb + ' filled — change if needed', vendorEl.value.trim() + ' ka pichla rate ₹' + rb + ' bhara — badal sakte ho'));
      }
    };
    rate.addEventListener('input', () => { rateAuto = false; });  // user ne rate chheda → ab manual
    itemEl.oninput = () => { itemTouched = true; itemAuto = false; applyItemUnit(); maybeFillRate(); };
    vendorEl.oninput = () => { applyParty(); maybeFillRate(); };
    vendorEl.onchange = () => { applyParty(); };

    // Recent quick-pick chips (item by category, party) — tap to fill
    const rcItems = root.querySelector('#rc-items'), rcVendors = root.querySelector('#rc-vendors');
    renderRecentItems = (cat) => {
      rcItems.innerHTML = recentItems(cat).map((i) => `<button type="button" class="chip sm ud" data-v="${esc(i)}">${esc(i)}</button>`).join('');
      rcItems.querySelectorAll('.chip').forEach((c) => c.onclick = () => { itemEl.value = c.dataset.v; itemEl.dispatchEvent(new Event('input', { bubbles: true })); });
    };
    const renderRecentVendors = () => {
      rcVendors.innerHTML = recentVendors().map((v) => `<button type="button" class="chip sm ud" data-v="${esc(v)}">${esc(v)}</button>`).join('');
      rcVendors.querySelectorAll('.chip').forEach((c) => c.onclick = () => { vendorEl.value = c.dataset.v; vendorEl.dispatchEvent(new Event('input', { bubbles: true })); });
    };

    // initial paint
    renderCatChips(t.category); updItems(t.category); toggleBlocks(t.category);
    renderRecentItems(t.category); renderRecentVendors();
    applyItemUnit();
    if (!fromExisting && t.vendor && !preset.next) applyParty(); else renderHint();

    // "+ Aur" collapse (qty × rate, note, account)
    const setMore = (open) => { moreBlock.classList.toggle('hidden', !open); setMoreLabel(); if (open && !fromExisting) maybeFillRate(); };
    moreToggle.onclick = () => setMore(!moreOpen());
    if (isEdit || (existing && (existing.qty != null || existing.rate != null || cleanNote(existing.notes)))) setMore(true); else setMoreLabel();
    if (!isEdit) setTimeout(() => { try { amount.focus({ preventScroll: true }); } catch (_) { } }, 60);

    root.querySelector('#cancel').onclick = closeSheet;
    if (isEdit) root.querySelector('#del').onclick = () => confirmDelete(t);
    const doSave = (next) => {
      const cat = chipVal(root, 'cat');
      const mode = chipVal(root, 'mode');
      const rec = {
        id: t.id, type: 'Out', date: root.querySelector('#f-date').value || today(),
        category: cat, amount: num(amount.value) || 0,
        account_id: mode === 'Udhaar' ? null : (root.querySelector('#f-account').value || null),
        payment_mode: mode,
        vendor: vendorEl.value.trim() || null,
        notes: joinNote(root.querySelector('#f-notes').value, noteMarkers(t.notes)),
        item: null, qty: null, unit: null, rate: null, contract_id: null
      };
      if (cat === 'Theka Payment') { rec.contract_id = contractSel.value || null; }
      else if (cat === 'Architect') { /* seedha payment — sirf amount + vendor + note */ }
      else {
        rec.item = itemEl.value.trim() || null;
        const q = num(qty.value), r = num(rate.value);
        rec.qty = isNaN(q) ? null : q; rec.rate = isNaN(r) ? null : r;
        // Purani entry (bina qty/rate) ka unit waisa hi rakho — sirf khol ke Save karne se data na badle
        rec.unit = (isEdit && isNaN(q) && isNaN(r)) ? (t.unit ?? null) : unitEl.value;
        // amount hamesha qty×rate ke barabar rahe (jab tak user ne khud amount na badla ho)
        // rate-book sirf tab yaad rakho jab amount qty×rate se bana — manual amount ke saath rate galat ho sakta hai
        if (!manual && !isNaN(q) && !isNaN(r)) {
          rec.amount = lineAmount(q, r, rec.unit);
          rbSet(rec.item, rec.vendor, rec.rate);
        }
      }
      rec.amount = money(rec.amount);   // paise tak round (float drift store na ho)
      if (!(rec.amount > 0)) { toast(tr('Enter a valid amount', 'Amount sahi daalein'), true); amount.focus(); return; }
      // Pehle se maujood spelling use karo ("tinku biana" → "Tinku Biana") — naya variant na bane
      rec.vendor = canonName(rec.vendor, vendorMap()); rec.item = canonName(rec.item, itemMap());
      if (mode === 'Udhaar') rec.notes = joinNote(cleanNote(rec.notes), noteMarkers(rec.notes).replace(/\[\[paid:[^\]]*\]\]/g, '').trim());
      if (!confirmIfDup(rec, !isEdit)) return;
      learnList('gk_items_' + cat, rec.item); learnList('gk_vendors', rec.vendor);
      bumpRecent('gk_ri_' + cat, rec.item); bumpRecent('gk_rv', rec.vendor);
      setCatDefault(cat, rec.account_id, mode);   // is category ka last-used account+mode yaad
      closeSheet(); saveTx(rec, !isEdit);
      if (next) {
        // Ek baithak me kai entries: date + party + mode (+ category/theka) wahi, baaki khaali
        openOutForm(null, { next: true, date: rec.date, vendor: rec.vendor, mode: rec.payment_mode, category: cat, contract_id: rec.contract_id, account: rec.account_id });
        toast(tr('Saved ✅ — enter the next one', 'Save ✅ — agla daalo'));
      }
    };
    root.querySelector('#save').onclick = () => doSave(false);
    const sn = root.querySelector('#save-next'); if (sn) sn.onclick = () => doSave(true);
  });
}

/* ====================== FORM: Paisa Aaya (In) ==================== */
function openInForm(existing, preset) {
  preset = preset || {};
  const t = existing || { id: uid(), type: 'In', date: preset.date || today(), source: preset.source || 'Bank Withdrawal', account_id: (preset.account && accById(preset.account) ? preset.account : (state.accounts[0] || {}).id) };
  // List me na ho aisa source (import/legacy) bhi rahe — warna edit par chup-chaap badal jaata tha
  const srcOpts = (t.source && !SOURCES.includes(t.source)) ? [t.source, ...SOURCES] : SOURCES;
  const inner = `
    <h3>${existing ? tr('✏️ Edit money in', '✏️ Aaya edit') : preset.next ? tr('➕ Next money in', '➕ Agla Paisa Aaya') : tr('➕ Money In', '➕ Paisa Aaya')}</h3>
    ${preset.next ? `<div class="next-note">✅ ${tr('Saved. Same date & account kept.', 'Save ho gaya. Date aur account wahi hai.')}</div>` : ''}
    <div class="field"><label>${tr('Amount ₹', 'Amount ₹')}</label><input id="f-amount" class="big-amt" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('Received in (account)', 'Kahan aaya (account)')}</label><select id="f-account">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>${tr('Source (where from)', 'Kahan se aaya (source)')}</label>${chipsHtml('src', srcOpts, t.source)}</div>
    <div class="field"><label>${tr('From whom (name, optional)', 'Kisse (naam, optional)')}</label><input id="f-from" list="dl-from" autocomplete="off" value="${esc(t.from_party || '')}" placeholder="${tr('person / bank', 'aadmi / bank')}" />
      <datalist id="dl-from">${learned('gk_from').map((v) => `<option>${esc(v)}</option>`).join('')}</datalist></div>
    ${dateFieldHtml('f-date', t.date)}
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="f-notes">${esc(cleanNote(t.notes))}</textarea></div>
    <div class="save-row"><button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>${existing ? '' : `<button class="btn-primary next" id="save-next">💾 ${tr('Save + next', 'Save + agla')}</button>`}</div>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    bindChips(root, 'src');
    bindDateField(root, 'f-date');
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    const doSave = (next) => {
      const acc = accById(root.querySelector('#f-account').value);
      const rec = {
        id: t.id, type: 'In', date: root.querySelector('#f-date').value || today(),
        amount: parseFloat(root.querySelector('#f-amount').value) || 0,
        account_id: root.querySelector('#f-account').value || null,
        source: chipVal(root, 'src') || 'Bank Withdrawal', from_party: root.querySelector('#f-from').value.trim() || null,
        payment_mode: acc && acc.type === 'Cash' ? 'Cash' : 'Net Banking',
        notes: joinNote(root.querySelector('#f-notes').value, noteMarkers(t.notes))
      };
      rec.amount = money(rec.amount);
      if (!(rec.amount > 0)) return toast(tr('Enter a valid amount', 'Amount sahi daalein'), true);
      rec.from_party = canonName(rec.from_party, spellingMap([...state.transactions.map((x) => x.from_party), ...learned('gk_from')]));
      if (!confirmIfDup(rec, !existing)) return;
      learnList('gk_from', rec.from_party);
      closeSheet(); saveTx(rec, !existing);
      if (next) { openInForm(null, { next: true, date: rec.date, account: rec.account_id, source: rec.source }); toast(tr('Saved ✅ — enter the next one', 'Save ✅ — agla daalo')); }
    };
    root.querySelector('#save').onclick = () => doSave(false);
    const sn = root.querySelector('#save-next'); if (sn) sn.onclick = () => doSave(true);
  });
}

/* ========================= FORM: Transfer ======================= */
function openTransferForm(existing, preset) {
  preset = preset || {};
  const t = existing || { id: uid(), type: 'Transfer', date: preset.date || today(),
    account_id: preset.from || (state.accounts.find((a) => a.type === 'Bank') || state.accounts[0] || {}).id,
    to_account_id: preset.to || (state.accounts.find((a) => a.type === 'Cash') || state.accounts[0] || {}).id };
  const inner = `
    <h3>${existing ? tr('✏️ Edit transfer', '✏️ Transfer edit') : '🔁 ' + tr('Transfer', 'Transfer')}</h3>
    ${preset.next ? `<div class="next-note">✅ ${tr('Saved. Same date & accounts kept.', 'Save ho gaya. Date aur accounts wahi hain.')}</div>` : `<p class="muted" style="margin:0 2px 6px">${tr('E.g. cash withdrawn from bank, or one account to another.', 'Jaise: Bank se cash nikala, ya ek account se dusre me.')}</p>`}
    <div class="field"><label>${tr('Amount ₹', 'Amount ₹')}</label><input id="f-amount" class="big-amt" type="number" inputmode="decimal" step="any" value="${t.amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('From', 'Kahan se (from)')}</label><select id="f-from">${accOptions(t.account_id)}</select></div>
    <div class="field"><label>${tr('To', 'Kahan (to)')}</label><select id="f-to">${accOptions(t.to_account_id)}</select></div>
    ${dateFieldHtml('f-date', t.date)}
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="f-notes">${esc(cleanNote(t.notes))}</textarea></div>
    <div class="save-row"><button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>${existing ? '' : `<button class="btn-primary next" id="save-next">💾 ${tr('Save + next', 'Save + agla')}</button>`}</div>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    bindDateField(root, 'f-date');
    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = () => confirmDelete(t);
    const doSave = (next) => {
      const from = root.querySelector('#f-from').value, to = root.querySelector('#f-to').value;
      if (from === to) return toast(tr('Choose different From and To accounts', 'From aur To alag account chuno'), true);
      const rec = {
        id: t.id, type: 'Transfer', date: root.querySelector('#f-date').value || today(),
        amount: parseFloat(root.querySelector('#f-amount').value) || 0,
        account_id: from, to_account_id: to, payment_mode: 'Transfer',
        notes: joinNote(root.querySelector('#f-notes').value, noteMarkers(t.notes))
      };
      rec.amount = money(rec.amount);
      if (!(rec.amount > 0)) return toast(tr('Enter a valid amount', 'Amount sahi daalein'), true);
      if (!confirmIfDup(rec, !existing)) return;
      closeSheet(); saveTx(rec, !existing);
      if (next) { openTransferForm(null, { next: true, date: rec.date, from, to }); toast(tr('Saved ✅ — enter the next one', 'Save ✅ — agla daalo')); }
    };
    root.querySelector('#save').onclick = () => doSave(false);
    const sn = root.querySelector('#save-next'); if (sn) sn.onclick = () => doSave(true);
  });
}

/* =================== Entry detail (view/edit) =================== */
// Party / category / item / mode / account pe tap → Entries us filter ke saath
// Laptop (>=1100px) Entries: right pane me chuni hui entry ki detail (ya party filter ho to khata ka link)
function paneMode() { return isDesktop() && state.view === 'entries' && !!document.getElementById('ef-pane'); }
function renderPane() {
  const pane = document.getElementById('ef-pane'); if (!pane) return;
  const list = document.getElementById('ef-list');
  if (!isDesktop()) { pane.innerHTML = ''; return; }
  let t = state.efSel && state.transactions.find((x) => x.id === state.efSel);
  if (t && !matchesFilter(t, state.f)) t = null;   // filter badla aur entry ab list me nahi
  if (list) list.querySelectorAll('.entry').forEach((e) => e.classList.toggle('sel', !!t && e.dataset.id === t.id));
  if (t) { openEntryDetail(t, { pane }); return; }
  state.efSel = null;
  const p = state.f.party ? parties().find((x) => x.key === nameKey(state.f.party)) : null;
  pane.innerHTML = `<div class="pane-empty"><div class="big">👈</div>${tr('Pick an entry to see its detail here', 'Entry chuno — uski detail yahan dikhegi')}
    ${p ? `<button type="button" class="btn-secondary" id="pane-party" style="width:100%;margin-top:14px">📒 <span class="ud">${esc(p.name)}</span> — ${tr('open khata', 'khata kholo')}</button>` : ''}
    <div class="muted" style="margin-top:14px"><kbd>/</kbd> ${tr('search', 'search')} · <kbd>N</kbd> ${tr('new expense', 'naya kharcha')} · <kbd>Esc</kbd> ${tr('close', 'band')}</div></div>`;
  const pb = pane.querySelector('#pane-party'); if (pb) pb.onclick = () => openParty(p.key);
}
function openEntryDetail(t, opts) {
  opts = opts || {};
  const lines = [];
  lines.push([tr('Type', 'Type'), { In: tr('Money In', 'Paisa Aaya'), Out: tr('Expense', 'Kharcha'), Transfer: tr('Transfer', 'Transfer') }[t.type]]);
  lines.push([tr('Amount', 'Amount'), inr(t.amount)]);
  lines.push([tr('Date', 'Date'), (weekday(t.date) ? weekday(t.date) + ', ' : '') + fmtDate(t.date)]);
  if (t.category) lines.push([tr('Category', 'Category'), t.category, { category: t.category }]);
  if (t.item) lines.push([tr('Item', 'Item'), t.item, { item: t.item }]);
  if (t.qty) lines.push([tr('Qty', 'Qty'), fmtQtyRate(t)]);
  if (t.vendor) lines.push([tr('Party', 'Party'), t.vendor, { party: t.vendor }]);
  if (t.source) lines.push([tr('Source', 'Source'), t.source]);
  if (t.from_party) lines.push([tr('From', 'Kisse'), t.from_party, { party: t.from_party }]);
  if (t.type === 'Transfer') lines.push(['', `${accName(t.account_id)} → ${accName(t.to_account_id)}`]);
  else if (t.account_id) lines.push([tr('Account', 'Account'), accName(t.account_id), { account: t.account_id }]);
  if (t.payment_mode) lines.push([tr('Mode', 'Mode'), t.payment_mode, t.type === 'Out' ? { mode: t.payment_mode } : null]);
  if (t.contract_id) { const c = contractById(t.contract_id); lines.push([tr('Theka', 'Theka'), (c && c.thekedar_name) || '—', c && c.thekedar_name ? { party: c.thekedar_name } : null]); }
  if (cleanNote(t.notes)) lines.push([tr('Note', 'Note'), cleanNote(t.notes)]);
  if (paidOn(t.notes)) lines.push([tr('Udhaar paid on', 'Udhaar chukaya'), fmtDate(paidOn(t.notes))]);

  const isUdhaar = t.type === 'Out' && t.payment_mode === 'Udhaar';
  const inner = `
    <h3>${CAT_ICON[t.category] || (t.type === 'In' ? '💰' : '🔁')} ${tr('Detail', 'Detail')}</h3>
    <div class="report-card">${lines.map(([k, v, part]) => `<div class="rrow"><div class="k">${esc(k)}</div><div class="v">${part ? `<button type="button" class="vlink ud" data-f="${esc(JSON.stringify(part))}">${esc(v)} <span class="vl-i">🔍</span></button>` : `<span class="ud">${esc(v)}</span>`}</div></div>`).join('')}</div>
    <div class="muted" style="margin:-4px 2px 6px">🔍 ${tr('Tap a party / category / item to see all its entries', 'Party / category / item pe tap → uski saari entries')}</div>
    ${isUdhaar ? `<button class="btn-primary" id="settle">✅ ${tr('Udhaar paid (mark)', 'Udhaar chukaya (paid mark)')}</button>` : ''}
    ${t.type === 'Out' ? `<button class="btn-secondary" id="repeat" style="width:100%;margin-top:8px">🔁 ${tr('Repeat (new entry)', 'Dobara — nayi entry')}</button>` : ''}
    <button class="btn-secondary" id="edit" style="width:100%;margin-top:8px">✏️ ${tr('Edit', 'Edit')}</button>
    <button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>
    <button class="btn-ghost" id="cancel">${tr('Close', 'Band karo')}</button>`;
  const bindDetail = (root, close) => {
    root.querySelector('#cancel').onclick = close;
    root.querySelector('#del').onclick = () => confirmDelete(t);
    root.querySelector('#edit').onclick = () => { closeSheet(); if (t.type === 'Out') openOutForm(t); else if (t.type === 'In') openInForm(t); else openTransferForm(t); };
    root.querySelectorAll('.vlink[data-f]').forEach((b) => b.onclick = () => {
      let part; try { part = JSON.parse(b.dataset.f); } catch (_) { return; }
      const refine = state.view === 'entries' && modalRoot().children.length <= 1;
      closeSheet(); openEntriesWith(part, { refine });
    });
    const rpt = root.querySelector('#repeat');
    if (rpt) rpt.onclick = () => { closeSheet(); const c = Object.assign({}, t, { id: uid(), date: today(), notes: cleanNote(t.notes) || null }); delete c.created_at; openOutForm(c); };
    if (isUdhaar) root.querySelector('#settle').onclick = () => { closeSheet(); openSettleForm(t); };
  };
  if (opts.pane) { opts.pane.innerHTML = `<div class="pane-card">${inner}</div>`; bindDetail(opts.pane, () => { state.efSel = null; renderPane(); }); return; }
  openSheet(inner, (root) => bindDetail(root, closeSheet));
}

function openSettleForm(t) {
  const inner = `
    <h3>✅ ${tr('Udhaar paid', 'Udhaar chukaya')}</h3>
    <p class="muted" style="margin:0 2px 8px">${esc(t.vendor || tr('Vendor', 'Vendor'))} — ${tr('total udhaar', 'kul udhaar')} ${inr(t.amount)}. ${tr('How much did you pay, and from where?', 'Kitna diya aur kahan se?')}</p>
    <div class="field"><label>${tr('Amount paid ₹', 'Kitna diya ₹')}</label><input id="s-amt" type="text" inputmode="decimal" value="${t.amount ?? ''}" /><div class="amt-preview" id="s-prev"></div></div>
    <div class="field"><label>${tr('Account (paid from)', 'Account (kahan se diya)')}</label><select id="s-acc"><option value="">— ${tr('Choose account', 'Account chuno')} —</option>${accOptions(null)}</select></div>
    <div class="field"><label>${tr('Mode', 'Mode')}</label>${chipsHtml('smode', PAY_MODES.filter((m) => m !== 'Udhaar'), 'Cash')}</div>
    <button class="btn-primary" id="save">💾 ${tr('Mark paid', 'Paid mark karo')}</button>
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    const sAcc = root.querySelector('#s-acc');
    sAcc.value = accountForMode('Cash', null) || '';
    // Mode chuna → account us type ka (Cash → Cash account, UPI/Net Banking → Bank) — Kharcha form jaisa
    bindChips(root, 'smode', (m) => { const a = accountForMode(m, sAcc.value); if (a) sAcc.value = a; });
    const amtEl = root.querySelector('#s-amt'), prev = root.querySelector('#s-prev');
    const total = money(Number(t.amount) || 0);
    const showPrev = () => {
      const paid = num(amtEl.value);
      if (isNaN(paid) || paid <= 0) { prev.textContent = ''; return; }
      if (paid >= total) prev.innerHTML = `<b>${tr('Full paid', 'Poora chukaya')}</b>`;
      else prev.innerHTML = `${tr('Remaining', 'Baaki')}: <b>${inr(total - paid)}</b> ${tr('(stays as Udhaar)', '(Udhaar hi rahega)')}`;
    };
    amtEl.oninput = showPrev; showPrev();
    root.querySelector('#cancel').onclick = closeSheet;
    root.querySelector('#save').onclick = async () => {
      const acc = root.querySelector('#s-acc').value;
      if (!acc) return toast(tr('Choose the paying account', 'Account chuno jahan se diya'), true);
      const mode = chipVal(root, 'smode');
      let paid = num(amtEl.value);
      if (isNaN(paid) || paid <= 0) return toast(tr('Enter amount paid', 'Kitna diya wo daalo'), true);
      paid = money(Math.min(paid, total));
      // poora → wahi entry paid (+ [[paid:aaj]]); aadha → utna paid, baaki nayi Udhaar entry (settleUdhaar)
      closeSheet();
      await settleUdhaar([t], paid, acc, mode, today());
      refresh(); toast(tr('Udhaar updated ✅', 'Udhaar update ho gaya ✅'));
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
function buildNote(text, sqft, rates) {
  let n = (text || '').trim();
  if (sqft && (Number(sqft.ga) || Number(sqft.fa))) n = (n ? n + ' ' : '') + '[[sqft:' + JSON.stringify(sqft) + ']]';
  if (rates && rates.length) n = (n ? n + ' ' : '') + '[[rates:' + encodeURIComponent(JSON.stringify(rates)) + ']]';
  return n || null;
}
// Rate-wise theka (jaise tile: ₹/sqft, ₹/running ft, per step, fix). Notes me [[rates:<url-encoded JSON>]]
// (encode isliye ki JSON ke ']' marker ko na todein). Har line: {n: kaam, r: rate, u: unit, q: measurement qty}
const RATE_UNITS = { sqft: '/sqft', rft: '/running ft', pc: '/piece', fix: 'fix' };
function parseRates(notes) {
  const m = String(notes || '').match(/\[\[rates:([^\]]*)\]\]/);
  if (!m) return [];
  try { const a = JSON.parse(decodeURIComponent(m[1])); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function rateLineAmt(l) { return (Number(l.r) || 0) * (Number(l.q) || 0); }
function ratesTotal(list) { return list.reduce((s, l) => s + rateLineAmt(l), 0); }
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
    <div class="row2"><div class="field"><label>${tr('Ground sqft', 'Ground sqft')}</label><input id="t-g-area" type="number" inputmode="decimal" placeholder="0" /></div><div class="field"><label>${tr('₹ / sqft', '₹ / sqft')}</label><input id="t-g-rate" type="number" inputmode="decimal" placeholder="${tr('rate', 'rate')}" /></div></div>
    <div class="row2"><div class="field"><label>${tr('1st floor sqft', '1st floor sqft')}</label><input id="t-f-area" type="number" inputmode="decimal" placeholder="0" /></div><div class="field"><label>${tr('₹ / sqft', '₹ / sqft')}</label><input id="t-f-rate" type="number" inputmode="decimal" placeholder="${tr('rate', 'rate')}" /></div></div>
    <div class="amt-preview" id="t-sqft-prev"></div>

    <div class="section-label" style="margin-top:8px">${tr('Rate list (rate-wise theka, optional)', 'Rate list (rate-wise theka, optional)')}</div>
    <div class="muted" style="margin:-4px 2px 6px">${tr('Rate per kaam; fill Qty when measurement is done.', 'Har kaam ka rate; measurement hone par Qty bharo.')}</div>
    <div id="t-rates"></div>
    <button type="button" class="btn-secondary" id="t-rate-add" style="width:100%">+ ${tr('Add rate line', 'Rate line jodo')}</button>
    <div class="amt-preview" id="t-rate-prev"></div>

    <div class="field"><label>${tr('Theka amount ₹', 'Theka amount ₹')}</label><input id="t-amt" type="number" inputmode="decimal" step="any" value="${c.theka_amount ?? ''}" placeholder="0" /></div>
    <div class="field"><label>${tr('Start date', 'Shuru date')}</label><input id="t-date" type="date" value="${c.start_date || today()}" /></div>
    <div class="field"><label>${tr('Note', 'Note')}</label><textarea id="t-notes">${esc(cleanNote(c.notes))}</textarea></div>
    <button class="btn-primary" id="save">💾 ${tr('Save', 'Save')}</button>
    ${existing ? `<button class="btn-primary danger" id="del">🗑️ ${tr('Delete', 'Delete')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Cancel', 'Cancel')}</button>`;
  openSheet(inner, (root) => {
    // Sq-ft calculator: ground × rate + 1st × rate → theka amount auto
    const gArea = root.querySelector('#t-g-area'), gRate = root.querySelector('#t-g-rate'), fArea = root.querySelector('#t-f-area'), fRate = root.querySelector('#t-f-rate'), amtEl = root.querySelector('#t-amt'), sqPrev = root.querySelector('#t-sqft-prev');
    // writeAmt=true par hi amount field bharte hain. Reopen par sirf preview dikhana hai (warna user ka
    // manually badla hua theka_amount sq-ft total se overwrite ho jaata tha). Live input par event aata
    // hai (truthy) → amount bharo; restore par calcSqft(false) → sirf preview.
    const calcSqft = (writeAmt = true) => {
      const ga = parseFloat(gArea.value) || 0, gr = parseFloat(gRate.value) || 0, fa = parseFloat(fArea.value) || 0, fr = parseFloat(fRate.value) || 0;
      if (!ga && !fa) { sqPrev.textContent = ''; return; }
      const total = ga * gr + fa * fr;
      if (writeAmt && total > 0) amtEl.value = money(total);   // sirf tab likho jab sach me total bana (rate blank → amount na mite)
      sqPrev.innerHTML = `${ga ? ga + '×₹' + gr : ''}${ga && fa ? ' + ' : ''}${fa ? fa + '×₹' + fr : ''} = <b>${inr(total)}</b>`;
    };
    // Jab tak user ne amount khud na chhua ho, sqft edit amount bharta rahe. Manually/hand-set amount ko
    // sqft chhedne par na mitao (warna negotiate kiya hua lump-sum theka_amount overwrite ho jaata tha).
    let amtTouchedManually = !!(existing && Number(c.theka_amount) > 0 && !sp.sqft);
    amtEl.oninput = () => { amtTouchedManually = true; };
    const onSqft = () => calcSqft(!amtTouchedManually);
    gArea.oninput = onSqft; gRate.oninput = onSqft; fArea.oninput = onSqft; fRate.oninput = onSqft;
    // pehle save ki hui sqft details wapas bhar do
    if (sp.sqft) {
      if (sp.sqft.ga != null) gArea.value = sp.sqft.ga;
      if (sp.sqft.gr != null) gRate.value = sp.sqft.gr;
      if (sp.sqft.fa != null) fArea.value = sp.sqft.fa;
      if (sp.sqft.fr != null) fRate.value = sp.sqft.fr;
      // stored amount sqft-total se alag hai (hand-set) → use protected maano
      const ga = parseFloat(gArea.value) || 0, gr = parseFloat(gRate.value) || 0, fa = parseFloat(fArea.value) || 0, fr = parseFloat(fRate.value) || 0;
      if (Number(c.theka_amount) && money(c.theka_amount) !== money(ga * gr + fa * fr)) amtTouchedManually = true;
      calcSqft(false);   // sirf preview — stored theka_amount ko mat chhedo
    }

    // Rate list rows
    const rWrap = root.querySelector('#t-rates'), rPrev = root.querySelector('#t-rate-prev');
    const rowHtml = (l) => `<div class="rate-row">
      <input class="rl-n" placeholder="${tr('Work', 'Kaam')}" value="${esc(l.n || '')}" />
      <input class="rl-r" inputmode="decimal" placeholder="₹" value="${l.r ?? ''}" />
      <select class="rl-u">${Object.entries(RATE_UNITS).map(([k, v]) => `<option value="${k}" ${k === (l.u || 'sqft') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <input class="rl-q" inputmode="decimal" placeholder="${tr('Qty', 'Qty')}" value="${Number(l.q) ? l.q : ''}" />
      <button type="button" class="rl-x" aria-label="remove">✕</button></div>`;
    const readRates = () => Array.from(rWrap.querySelectorAll('.rate-row')).map((r) => ({ n: r.querySelector('.rl-n').value.trim(), r: num(r.querySelector('.rl-r').value) || 0, u: r.querySelector('.rl-u').value, q: num(r.querySelector('.rl-q').value) || 0 })).filter((l) => l.n);
    const calcRates = () => {
      const t = ratesTotal(readRates());
      rPrev.innerHTML = t ? `${tr('Measured total', 'Measurement total')}: <b>${inr(t)}</b> <button type="button" class="link-btn" id="t-rate-use">${tr('Use as theka amount', 'Theka amount me daalo')}</button>` : '';
      const u = rPrev.querySelector('#t-rate-use'); if (u) u.onclick = () => { amtEl.value = money(t); amtTouchedManually = true; };
    };
    const addRow = (l) => { rWrap.insertAdjacentHTML('beforeend', rowHtml(l || {})); const r = rWrap.lastElementChild; r.querySelectorAll('input,select').forEach((e) => e.oninput = calcRates); r.querySelector('.rl-x').onclick = () => { r.remove(); calcRates(); }; };
    parseRates(c.notes).forEach(addRow);
    root.querySelector('#t-rate-add').onclick = () => addRow({ u: 'sqft' });
    calcRates();

    root.querySelector('#cancel').onclick = closeSheet;
    if (existing) root.querySelector('#del').onclick = async () => {
      if (!confirm(tr('Delete this theka? This cannot be undone.', 'Ye theka delete karein? Wapas nahi aayega.'))) return;
      state.contracts = state.contracts.filter((x) => x.id !== c.id); cacheSet('contracts', state.contracts);
      await deleteRow('contracts', c.id); closeSheet(); refresh(); toast(tr('Theka deleted', 'Theka delete'));
    };
    root.querySelector('#save').onclick = async () => {
      const rec = {
        id: c.id, user_id: userId(), thekedar_name: root.querySelector('#t-name').value.trim() || null,
        kaam: root.querySelector('#t-kaam').value.trim() || null, theka_amount: money(parseFloat(root.querySelector('#t-amt').value) || 0),
        start_date: root.querySelector('#t-date').value || null,
        notes: buildNote(root.querySelector('#t-notes').value, { ga: parseFloat(gArea.value) || 0, gr: parseFloat(gRate.value) || 0, fa: parseFloat(fArea.value) || 0, fr: parseFloat(fRate.value) || 0 }, readRates())
      };
      if (c.created_at) rec.created_at = c.created_at;
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
    <div class="field"><label>${tr('Opening balance ₹ (starting amount)', 'Opening balance ₹ (shuruaati amount)')}</label><input id="a-open" type="text" inputmode="decimal" value="${a.opening_balance ?? 0}" />
      <div class="muted" style="margin-top:6px">${tr('This is the STARTING amount (not the current balance). Entries add on top of it.', 'Ye SHURUAATI amount hai (aaj ka balance nahi). Entries iske upar judti hain.')}</div></div>
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
      // Khaali/galat opening balance ko chup-chaap 0 mat karo — edit me purana rakho (balance gum na ho)
      const openN = num(root.querySelector('#a-open').value);
      const opening = isNaN(openN) ? (existing ? (Number(a.opening_balance) || 0) : 0) : openN;
      const rec = { id: a.id, user_id: userId(), name: root.querySelector('#a-name').value.trim() || 'Account', type: chipVal(root, 'atype'), opening_balance: opening, notes: chipVal(root, 'track') === 'No' ? '[[notrack]]' : null };
      const i = state.accounts.findIndex((x) => x.id === a.id);
      if (i >= 0) state.accounts[i] = rec; else state.accounts.push(rec);
      cacheSet('accounts', state.accounts);
      await pushRow('accounts', rec); closeSheet(); refresh(); toast(tr('Account saved', 'Account save'));
    };
  });
}

/* =========================== Save / Delete ====================== */
function userId() { return state.session && state.session.user ? state.session.user.id : (localStorage.getItem('gk_uid') || null); }
// Phone se is user ka cached hisaab hatao (cloud data ko kuch nahi hota). Language/config rehne do.
function clearLocalData() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('gk_cache_') || k === 'gk_pending' || k === 'gk_uid' || k === 'gk_email' || k === 'gk_cleanup_undo' || k === 'gk_activity') localStorage.removeItem(k);
  }
}
// Same din + same item/vendor + same amount + same mode wali entry pehle se hai? (double-tap / dobara daalna)
function findDup(rec, loose) {
  return state.transactions.find((x) => x.id !== rec.id && x.type === rec.type && x.date === rec.date &&
    money(x.amount) === money(rec.amount) && nameKey(x.item) === nameKey(rec.item) && nameKey(x.vendor) === nameKey(rec.vendor) &&
    (loose || (x.category || null) === (rec.category || null)) &&
    (rec.type !== 'In' || nameKey(x.source) === nameKey(rec.source)) &&
    (rec.type !== 'Transfer' || (x.account_id === rec.account_id && x.to_account_id === rec.to_account_id)));
}
function confirmIfDup(rec, isNew) {
  if (!isNew) return true;
  const d = findDup(rec);
  if (!d) return true;
  return confirm(tr('A same entry already exists on ', 'Ye entry pehle se hai: ') + fmtDate(d.date) + ' · ' + (d.item || d.category || d.source || d.type) + ' · ' + inr(d.amount) +
    '\n\n' + tr('Save again anyway?', 'Fir bhi dobara save karein?'));
}
// Local pehle (turant dikhe), cloud background me — form network ka wait nahi karta.
// quiet = bulk kaam (settle/cleanup) me har row pe toast/refresh mat karo.
async function saveTx(rec, isNew, quiet) {
  rec.user_id = userId();
  const i = state.transactions.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.transactions[i] = Object.assign({}, state.transactions[i], rec);
  else { if (!rec.created_at) rec.created_at = new Date().toISOString(); state.transactions.unshift(rec); }  // local timestamp → naya entry "Recent" me upar rahe
  sortTxns();   // date desc, fir created_at desc
  cacheSet('transactions', state.transactions);
  if (!quiet) refresh();
  logEvent('entry', (isNew ? tr('Saved', 'Save') : tr('Updated', 'Update')) + ': ' + (rec.item || rec.category || tr('entry', 'entry')) + ' ' + inr(rec.amount) + (rec.payment_mode ? ' · ' + rec.payment_mode : ''), 'info');
  pushRow('transactions', rec).then(() => renderHeader());   // jaan-boojh ke await nahi (slow network pe form atakta tha)
  if (!quiet) toast(isNew ? tr('Entry saved ✅', 'Entry save ho gayi ✅') : tr('Updated ✅', 'Update ho gaya ✅'));
}
function confirmDelete(t) {
  if (!confirm(tr('Delete this entry?', 'Ye entry delete karein?'))) return;
  state.transactions = state.transactions.filter((x) => x.id !== t.id);
  cacheSet('transactions', state.transactions);
  deleteRow('transactions', t.id);
  logEvent('entry', tr('Deleted', 'Delete') + ': ' + (t.item || t.category || tr('entry', 'entry')) + ' ' + inr(t.amount), 'info');
  closeSheet(); refresh(); toast(tr('Deleted', 'Delete ho gaya'));
}
// Activity log / errors dekho — checking ke liye. Yahan se sirf padha jata hai, data nahi badalta.
function openActivityLog() {
  markActSeen();
  const log = activityLog();
  const rows = log.length ? log.map((e) => {
    const isErr = e.level === 'error';
    return `<div class="rrow"><div class="k">${isErr ? '⚠️ ' : '• '}<b${isErr ? ' style="color:var(--red)"' : ''}>${esc(e.msg)}</b><small style="display:block;color:#8a8f88;font-weight:400;margin-top:2px">${esc(fmtLogTime(e.ts))} · ${esc(e.kind)}</small></div></div>`;
  }).join('') : `<div class="muted center" style="padding:24px">${tr('No activity yet', 'Abhi tak kuch nahi')}</div>`;
  const errN = log.filter((e) => e.level === 'error').length;
  const inner = `
    <h3>🔍 ${tr('Activity log', 'Activity log')}</h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Recent entries, syncs & errors (last 200). Nothing here changes your data.', 'Recent entries, sync aur errors (last 200). Yahan se data nahi badalta.')}${errN ? ' · ' + errN + ' ' + tr('error(s)', 'error') : ''}</p>
    <div class="report-card" style="max-height:60vh;overflow:auto">${rows}</div>
    <button class="btn-primary" id="close" style="width:100%;margin-top:10px">${tr('Close', 'Band karo')}</button>
    <div class="center" style="margin-top:14px"><span id="clear-log" style="font-size:12px;color:#9aa196;text-decoration:underline;cursor:pointer">${tr('Clear log', 'Log clear karo')}</span></div>`;
  openSheet(inner, (root) => {
    root.querySelector('#close').onclick = () => { closeSheet(); renderHeader(); };
    // Chhota subtle link + confirm — taaki galti se poora log delete na ho
    root.querySelector('#clear-log').onclick = () => {
      if (!confirm(tr('Clear the whole activity log? This cannot be undone.', 'Poora activity log clear karein? Wapas nahi aayega.'))) return;
      try { localStorage.removeItem('gk_activity'); } catch (_) { } closeSheet(); renderHeader(); toast(tr('Log cleared', 'Log clear ho gaya'));
    };
  });
  renderHeader();
}

/* ======================= Hisaab cleanup (suggestions) ======================= */
// Data me milne wali gadbad ke SUJHAV. Kuch bhi apne aap nahi badalta: user har sujhav dekh ke tick karta hai,
// apply se pehle poora JSON backup download hota hai, aur "Undo" se purani rows wapas aa jaati hain.
// Amount kabhi nahi badalta (sirf duplicate delete karne par wo entry hatti hai — wo default OFF hai).
const NAME_STOP = new Set(['labour', 'majdoor', 'mazdoor', 'mistry', 'wala', 'wale', 'wali', 'supplier', 'brick', 'bricks', 'shop', 'store', 'trader', 'traders',
  'multiple', 'vendor', 'vendors', 'person', 'persons', 'payment', 'cash', 'ji', 'bhai', 'se', 'pehle', 'ke', 'ka', 'ki', 'and', 'aur', 'the', 'co']);
function nameCore(s) { return String(s || '').toLowerCase().split(/[^a-z0-9ऀ-ॿ]+/).filter((w) => w && !NAME_STOP.has(w)); }
const PERSONAL_RE = /\b(sunar|jewel\w*|payal|hospital|doctor|dawai|dawa|medicine)\b/i;
const MATERIAL_RE = /\b(cement|reta|bajri|sariya|saria|eint|gitti|rodi|dust)\b/i;
const TRANSPORT_RE = /(kiraya|karaya|bhada|bhaada|lane ka|transport)/i;

function computeCleanup() {
  const T = state.transactions, props = [];
  const txLabel = (t) => `${fmtDate(t.date)} · ${t.item || t.category || t.type} · ${t.vendor || t.from_party || ''} · ${inr(t.amount)}`;

  // 1) Eint/Hazaar: qty hazaar me likhi (5) jabki formula poori ginti maangta hai (5000). Amount same rehta hai.
  const eint = T.filter((t) => PER_1000_UNITS.includes(t.unit) && Number(t.qty) > 0 && Number(t.qty) < 100 && Number(t.rate) > 0 &&
    Math.abs(Number(t.qty) * Number(t.rate) - Number(t.amount)) < 1);
  if (eint.length) props.push({ key: 'eint', on: true, title: tr('Eint qty: thousands → full count', 'Eint qty: hazaar → poori ginti'),
    why: tr('Amount stays the same. Fixes item report and editing (otherwise editing could turn ₹38,000 into ₹38).', 'Amount wahi rahega. Item report aur edit theek honge (warna edit pe ₹38,000 → ₹38 ho sakta tha).'),
    changes: eint.map((t) => ({ table: 'transactions', id: t.id, set: { qty: Number(t.qty) * 1000 }, label: txLabel(t), from: `${t.qty} ${t.unit}`, to: `${Number(t.qty) * 1000} pcs` })) });

  // 2) Vendor naam ek karo: same naam alag spelling + "Rajnish" / "Rajnish Biana" / "Brick Supplier Rajnish Biana"
  const cnt = {};
  for (const t of T) if (t.vendor) cnt[t.vendor.trim()] = (cnt[t.vendor.trim()] || 0) + 1;
  for (const c of state.contracts) if (c.thekedar_name) cnt[c.thekedar_name.trim()] = (cnt[c.thekedar_name.trim()] || 0);
  const names = Object.keys(cnt), parent = {};
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  names.forEach((n) => { parent[n] = n; });
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = names[i], b = names[j];
    if (nameKey(a) && nameKey(a) === nameKey(b)) { union(a, b); continue; }
    const ca = nameCore(a), cb = nameCore(b);
    const [s, l] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
    if (s.length && s[0].length >= 4 && s.every((w, k) => l[k] === w)) union(a, b);
  }
  const groups = {};
  names.forEach((n) => { (groups[find(n)] = groups[find(n)] || []).push(n); });
  for (const g of Object.values(groups)) {
    if (g.length < 2) continue;
    // Title Case wali spelling pehle ("Tinku Biana" > "Tinku biana"), phir jo zyada use hui
    const canon = g.slice().sort((a, b) => titledName(b) - titledName(a) || cnt[b] - cnt[a] || b.length - a.length)[0];
    const ch = [];
    for (const t of T) if (t.vendor && g.includes(t.vendor.trim()) && t.vendor !== canon) ch.push({ table: 'transactions', id: t.id, set: { vendor: canon }, label: txLabel(t), from: t.vendor, to: canon });
    for (const c of state.contracts) if (c.thekedar_name && g.includes(c.thekedar_name.trim()) && c.thekedar_name !== canon) ch.push({ table: 'contracts', id: c.id, set: { thekedar_name: canon }, label: tr('Theka', 'Theka') + ' · ' + (c.kaam || ''), from: c.thekedar_name, to: canon });
    if (ch.length) props.push({ key: 'vendor:' + canon, on: true, title: tr('Same vendor: ', 'Ek hi vendor: ') + g.map((x) => `"${x}"`).join(' + ') + ' → "' + canon + '"',
      why: tr('Only the name changes. Untick if these are different people.', 'Sirf naam badlega. Agar ye alag log hain to tick hata do.'), changes: ch });
  }

  // 3) Theka payment ka vendor = thekedar (vendor field me description likha tha → note me shift)
  for (const c of state.contracts) {
    const ch = [];
    for (const t of T) {
      if (t.type !== 'Out' || t.category !== 'Theka Payment' || t.contract_id !== c.id || !c.thekedar_name) continue;
      if (nameKey(t.vendor) === nameKey(c.thekedar_name)) continue;
      ch.push({ table: 'transactions', id: t.id, set: { vendor: c.thekedar_name, notes: joinNote([t.vendor, cleanNote(t.notes)].filter(Boolean).join(' — '), noteMarkers(t.notes)) },
        label: txLabel(t), from: t.vendor || '—', to: c.thekedar_name + (t.vendor ? ` (${tr('note', 'note')}: "${t.vendor}")` : '') });
    }
    if (ch.length) props.push({ key: 'theka:' + c.id, on: true, title: tr('Theka payments → vendor ', 'Theka payment ka vendor → ') + c.thekedar_name,
      why: tr('These payments are already counted in this theka; only the vendor name is fixed and the old text moves to the note.', 'Ye payments pehle se isi theke me gini hain; sirf vendor naam theek hoga, purana text note me chala jayega.'), changes: ch });
  }

  // 4) Personal kharcha ghar ke kharche se alag
  const pers = T.filter((t) => t.type === 'Out' && t.category !== 'Personal' && PERSONAL_RE.test([t.item, t.notes, t.vendor].join(' ')));
  if (pers.length) props.push({ key: 'personal', on: true, title: tr('Move personal spends to "Personal"', 'Personal kharche → "Personal" category'),
    why: tr('Still deducted from cash; just not counted in house construction total.', 'Cash se katna waisa hi rahega; bas ghar ke construction total me nahi gina jayega.'),
    changes: pers.map((t) => ({ table: 'transactions', id: t.id, set: { category: 'Personal' }, label: txLabel(t), from: t.category, to: 'Personal' })) });

  // 5) Misc me material (cement/reta…) → Material (kiraya/transport Misc hi rahe)
  const misc = T.filter((t) => t.type === 'Out' && t.category === 'Misc' && MATERIAL_RE.test(t.item || '') && !TRANSPORT_RE.test(t.item || ''));
  if (misc.length) props.push({ key: 'misc', on: true, title: tr('Material logged under Misc → Material', 'Misc me likha material → Material'), why: '',
    changes: misc.map((t) => ({ table: 'transactions', id: t.id, set: { category: 'Material' }, label: txLabel(t), from: 'Misc', to: 'Material' })) });

  // 6) Custom category (jaise "Chokhat") → Material, taaki saara material ek jagah gine
  const custom = Array.from(new Set(T.filter((t) => t.type === 'Out' && t.category && !CATEGORIES.includes(t.category)).map((t) => t.category)));
  for (const cat of custom) {
    const rows = T.filter((t) => t.type === 'Out' && t.category === cat);
    props.push({ key: 'cat:' + cat, on: true, title: `"${cat}" → Material`, why: tr('Item name keeps the detail.', 'Item ka naam detail rakhega.'),
      changes: rows.map((t) => ({ table: 'transactions', id: t.id, set: Object.assign({ category: 'Material' }, t.item ? {} : { item: cat }), label: txLabel(t), from: cat, to: 'Material' + (t.item ? '' : ' · ' + cat) })) });
  }

  // 7) Pakki double entries (same din/item/vendor/amount/mode) — naya wala hatane ka sujhav, default OFF
  const seen = {}, dups = [];
  for (const t of T.slice().sort(sortOldFirst)) {
    const k = [t.type, t.date, money(t.amount), t.category, nameKey(t.item), nameKey(t.vendor), t.payment_mode, t.account_id, t.to_account_id, nameKey(t.source), cleanNote(t.notes)].join('|');
    if (seen[k]) dups.push({ keep: seen[k], del: t }); else seen[k] = t;
  }
  for (const d of dups) props.push({ key: 'dup:' + d.del.id, on: false, title: tr('Possible double entry: ', 'Shayad double entry: ') + txLabel(d.del),
    why: tr('Same entry exists (entered earlier). Tick ONLY if it really happened once.', 'Bilkul same entry pehle se hai. Tick SIRF tab karo jab ye kaam sach me ek hi baar hua tha.'),
    deletes: [{ table: 'transactions', id: d.del.id, label: txLabel(d.del) + ' · ' + tr('entered', 'daali') + ' ' + fmtLogTime(d.del.created_at) }] });
  return props;
}

function openCleanup() {
  const props = computeCleanup();
  const outTotal = (rows) => rows.filter((t) => t.type === 'Out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const body = props.length ? props.map((p, i) => {
    const n = (p.changes || []).length + (p.deletes || []).length;
    const rows = (p.changes || []).map((c) => `<div class="cl-row">${esc(c.label)}<br><span class="muted">${esc(c.from)} → <b>${esc(c.to)}</b></span></div>`).join('') +
      (p.deletes || []).map((d) => `<div class="cl-row">🗑️ ${esc(d.label)}</div>`).join('');
    return `<label class="cl-item"><input type="checkbox" data-i="${i}" ${p.on ? 'checked' : ''} />
      <div><b>${esc(p.title)}</b> <span class="muted">(${n})</span>${p.why ? `<div class="muted">${esc(p.why)}</div>` : ''}
      <details><summary class="muted">${tr('See entries', 'Entries dekho')}</summary>${rows}</details></div></label>`;
  }).join('') : `<div class="muted center" style="padding:24px">${tr('Nothing to fix 🎉', 'Kuch theek karne layak nahi mila 🎉')}</div>`;
  const inner = `
    <h3>🧹 ${tr('Hisaab cleanup', 'Hisaab cleanup')}</h3>
    <p class="muted" style="margin:0 2px 8px">${tr('Suggestions only — nothing changes until you tap Apply. A full JSON backup downloads first, and you can Undo from Settings.', 'Sirf sujhav — Apply dabane tak kuch nahi badlega. Pehle poora JSON backup download hoga, aur Settings se Undo kar sakte ho.')}</p>
    <div class="report-card">${body}</div>
    <div class="report-card" id="cl-sum"></div>
    ${props.length ? `<button class="btn-primary" id="cl-apply">✅ ${tr('Backup + Apply ticked', 'Backup + tick wale apply karo')}</button>` : ''}
    <button class="btn-ghost" id="cancel">${tr('Close', 'Band karo')}</button>`;
  openSheet(inner, (root) => {
    root.querySelector('#cancel').onclick = closeSheet;
    const picked = () => Array.from(root.querySelectorAll('input[data-i]')).filter((c) => c.checked).map((c) => props[+c.dataset.i]);
    const sum = () => {
      const sel = picked(), delIds = new Set(sel.flatMap((p) => (p.deletes || []).map((d) => d.id)));
      const before = outTotal(state.transactions), after = outTotal(state.transactions.filter((t) => !delIds.has(t.id)));
      const nCh = new Set(sel.flatMap((p) => (p.changes || []).map((c) => c.id))).size;
      root.querySelector('#cl-sum').innerHTML = `<div class="rrow"><div class="k">${tr('Entries changing', 'Entries badlengi')}</div><div class="v">${nCh}</div></div>
        <div class="rrow"><div class="k">${tr('Entries deleted', 'Entries delete')}</div><div class="v">${delIds.size}</div></div>
        <div class="rrow"><div class="k">${tr('Total money out (before → after)', 'Kul gaya paisa (pehle → baad)')}</div><div class="v">${inr(before)} → ${inr(after)}</div></div>`;
    };
    root.querySelectorAll('input[data-i]').forEach((c) => c.onchange = sum); sum();
    const ap = root.querySelector('#cl-apply');
    if (ap) ap.onclick = async () => {
      const sel = picked(); if (!sel.length) return toast(tr('Nothing ticked', 'Kuch tick nahi kiya'), true);
      if (!canWrite()) return toast(tr('Connect to internet first (cleanup needs a live connection)', 'Pehle internet chalu karo (cleanup ke liye zaroori)'), true);
      if (!confirm(tr('A backup file will download first, then the ticked changes apply. Continue?', 'Pehle backup file download hogi, phir tick wale badlav lagenge. Aage badhein?'))) return;
      ap.disabled = true; ap.textContent = tr('Applying…', 'Lag raha hai…');
      await applyCleanup(sel);
      closeSheet(); refresh();
    };
  });
}

async function applyCleanup(sel) {
  exportJSON('pai-pai-backup-before-cleanup-');
  const tables = { transactions: state.transactions, contracts: state.contracts, accounts: state.accounts };
  const before = state.transactions.filter((t) => t.type === 'Out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  // Har row ke saare badlav jod lo (ek row pe do sujhav ho sakte hain), original ki poori copy undo ke liye
  const sets = {}, dels = [];
  for (const p of sel) {
    for (const c of p.changes || []) { const k = c.table + ':' + c.id; sets[k] = Object.assign(sets[k] || { table: c.table, id: c.id, set: {} }, {}); Object.assign(sets[k].set, c.set); }
    for (const d of p.deletes || []) dels.push(d);
  }
  const delKeys = new Set(dels.map((d) => d.table + ':' + d.id));
  const undo = { ts: new Date().toISOString(), rows: [] };
  for (const k of Object.keys(sets)) { if (delKeys.has(k)) continue; const s = sets[k]; const o = tables[s.table].find((x) => x.id === s.id); if (o) undo.rows.push({ table: s.table, row: JSON.parse(JSON.stringify(o)) }); }
  for (const d of dels) { const o = tables[d.table].find((x) => x.id === d.id); if (o) undo.rows.push({ table: d.table, row: JSON.parse(JSON.stringify(o)) }); }
  localStorage.setItem('gk_cleanup_undo', JSON.stringify(undo));
  let n = 0;
  for (const k of Object.keys(sets)) {
    if (delKeys.has(k)) continue;
    const s = sets[k], arr = tables[s.table], i = arr.findIndex((x) => x.id === s.id); if (i < 0) continue;
    arr[i] = Object.assign({}, arr[i], s.set);
    await pushRow(s.table, arr[i]); n++;
  }
  for (const d of dels) {
    const arr = tables[d.table], i = arr.findIndex((x) => x.id === d.id); if (i < 0) continue;
    arr.splice(i, 1); await deleteRow(d.table, d.id); n++;
  }
  sortTxns(); cacheSet('transactions', state.transactions); cacheSet('contracts', state.contracts);
  const after = state.transactions.filter((t) => t.type === 'Out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  logEvent('cleanup', tr('Cleanup applied', 'Cleanup laga') + ': ' + n + ' ' + tr('rows', 'rows') + ' · ' + tr('total out', 'kul gaya') + ' ' + inr(before) + ' → ' + inr(after), 'info');
  toast(tr(n + ' entries updated ✅ (Undo in Settings)', n + ' entries theek ho gayi ✅ (Undo Settings me)'));
}

async function undoCleanup() {
  let u; try { u = JSON.parse(localStorage.getItem('gk_cleanup_undo') || 'null'); } catch (_) { u = null; }
  if (!u || !u.rows || !u.rows.length) return toast(tr('Nothing to undo', 'Undo karne ko kuch nahi'), true);
  if (!canWrite()) return toast(tr('Connect to internet first', 'Pehle internet chalu karo'), true);
  if (!confirm(tr(`Restore ${u.rows.length} rows to how they were before the cleanup on ${fmtLogTime(u.ts)}? Any edits you made to these rows after that will also be reverted.`,
    `${fmtLogTime(u.ts)} wale cleanup se pehle jaisi ${u.rows.length} rows wapas laayein? Uske baad in rows me kiya gaya edit bhi wapas purana ho jayega.`))) return;
  const tables = { transactions: state.transactions, contracts: state.contracts, accounts: state.accounts };
  for (const r of u.rows) {
    const arr = tables[r.table], i = arr.findIndex((x) => x.id === r.row.id);
    if (i >= 0) arr[i] = r.row; else arr.push(r.row);
    await pushRow(r.table, r.row);
  }
  sortTxns(); cacheSet('transactions', state.transactions); cacheSet('contracts', state.contracts);
  localStorage.removeItem('gk_cleanup_undo');
  logEvent('cleanup', tr('Cleanup undone', 'Cleanup undo') + ': ' + u.rows.length + ' rows', 'info');
  refresh(); toast(tr('Restored ✅', 'Wapas pehle jaisa ✅'));
}

/* ============================ Export ============================ */
function download(name, text, mime) {
  const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// rows diye ho to sirf wahi (Entries ka filter / Reports ki range); warna saari entries
function exportCSV(rows, prefix) {
  const list = Array.isArray(rows) ? rows : state.transactions;
  const cols = ['date', 'type', 'category', 'item', 'qty', 'unit', 'rate', 'amount', 'account', 'to_account', 'payment_mode', 'vendor', 'source', 'from_party', 'notes'];
  const head = cols.join(',');
  const out = list.map((t) => cols.map((c) => {
    let v;
    if (c === 'account') v = accName(t.account_id);
    else if (c === 'to_account') v = t.to_account_id ? accName(t.to_account_id) : '';
    else if (c === 'notes') v = cleanNote(t.notes);
    else v = t[c];
    v = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(v) && isNaN(Number(v))) v = "'" + v;   // Excel isse formula na samjhe
    return '"' + v.replace(/"/g, '""') + '"';
  }).join(','));
  download('pai-pai-' + (typeof prefix === 'string' ? prefix : '') + today() + '.csv', '﻿' + head + '\n' + out.join('\n'), 'text/csv;charset=utf-8');
  toast(tr('CSV downloaded', 'CSV download ho gaya') + ' (' + list.length + ')');
}
function exportJSON(prefix) {
  download((typeof prefix === 'string' ? prefix : 'pai-pai-backup-') + today() + '.json', JSON.stringify({ accounts: state.accounts, contracts: state.contracts, transactions: state.transactions, exported: today() }, null, 2), 'application/json');
  toast(tr('Backup downloaded', 'Backup download ho gaya'));
}

/* ============================== Import ========================== */
// account ko type ('Cash'/'Bank') YA naam se resolve karo (na ho to bana do).
// Naya account hamesha 'Cash'/'Bank' type ka hi bane (warna dashboard cards me dikhta hi nahi tha).
async function resolveAccount(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let a = state.accounts.find((x) => x.type === s || (x.name || '').toLowerCase() === s.toLowerCase());
  if (!a) {
    const type = /bank/i.test(s) ? 'Bank' : 'Cash';
    a = { id: uid(), user_id: userId(), name: type === 'Bank' ? 'Bank' : 'Cash (haath)', type: type, opening_balance: 0 };
    state.accounts.push(a); cacheSet('accounts', state.accounts); await pushRow('accounts', a);
  }
  return a.id;
}
async function resolveTheka(name, startDate, kaam, amount, note) {
  if (!name) return null;
  let c = state.contracts.find((x) => (x.thekedar_name || '').toLowerCase() === name.toLowerCase());
  if (!c) {
    c = { id: uid(), user_id: userId(), thekedar_name: name, kaam: kaam || 'Mistry / Theka', theka_amount: money(amount), start_date: startDate || today(), notes: note || null };
    state.contracts.push(c); cacheSet('contracts', state.contracts); await pushRow('contracts', c);
  } else if (Number(amount) > 0 && money(amount) > (Number(c.theka_amount) || 0)) {
    // baad ki row me asli/poora theka_amount aaya → adopt karo (pehli row me 0/chhota tha to thik ho jaye)
    c.theka_amount = money(amount); cacheSet('contracts', state.contracts); await pushRow('contracts', c);
  }
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
      let n = 0, skipped = 0;
      for (const it of arr) {
        const amt = money(Number(it.amount) || 0); if (!(amt > 0)) continue;
        const isTransfer = it.type === 'Transfer';
        const accId = it.mode === 'Udhaar' ? null : await resolveAccount(it.acc);
        const toAccId = isTransfer ? await resolveAccount(it.to_acc) : null;
        if (isTransfer && !toAccId) { skipped++; continue; }   // bina destination Transfer paisa kho deta — chhod do
        const cid = await resolveTheka(it.theka, it.date, it.theka_kaam, it.theka_amount, it.theka_note);
        const rec = {
          id: uid(), user_id: userId(), type: it.type || 'Out', date: it.date || today(), amount: amt,
          category: it.category || null, item: it.item || null,
          qty: it.qty != null ? Number(it.qty) : null, unit: it.unit || null, rate: it.rate != null ? Number(it.rate) : null,
          vendor: it.vendor || null, payment_mode: isTransfer ? 'Transfer' : (it.mode || null), account_id: accId, to_account_id: toAccId, contract_id: cid,
          source: it.source || null, from_party: it.from || null, notes: it.note || null
        };
        state.transactions.push(rec); await pushRow('transactions', rec);
        if (it.vendor) learnList('gk_vendors', it.vendor);
        if (it.category && !CATEGORIES.includes(it.category)) learnList('gk_categories', it.category);
        n++;
      }
      sortTxns();
      cacheSet('transactions', state.transactions);
      closeSheet(); refresh();
      toast(tr(n + ' entries imported ✅' + (skipped ? ' (' + skipped + ' skipped)' : ''), n + ' entries import ho gayi ✅' + (skipped ? ' (' + skipped + ' chhod di)' : '')));
    };
  });
}

// Saari entries + thekas delete (accounts rehne do). Cloud se bhi hata do.
async function clearAllData() {
  // Offline me clear mat karo — server pe data reh jaata aur agle sync par wapas aa jaata tha
  if (!sb || !state.online) return toast(tr('Connect to internet to clear data', 'Data clear karne ke liye internet zaroori'), true);
  if (!confirm(tr('Delete ALL entries and thekas? This cannot be undone.', 'Saari entries aur thekas delete kar du? Wapas nahi aayenge.'))) return;
  // Pehle server se delete karo aur CONFIRM karo ki sach me hua (Supabase error throw nahi karta,
  // {error} value me deta hai). Tabhi local saaf karo — warna "cleared" dikha kar sync par wapas aa jaata tha.
  let r1, r2;
  try {
    r1 = await sb.from('transactions').delete().eq('user_id', userId());
    r2 = await sb.from('contracts').delete().eq('user_id', userId());
  } catch (e) { r1 = { error: e }; }
  if ((r1 && r1.error) || (r2 && r2.error)) {
    console.warn('clear', (r1 && r1.error) || (r2 && r2.error));
    return toast(tr('Could not clear on server — try again', 'Server se clear nahi hua — phir try karein'), true);
  }
  state.transactions = []; state.contracts = [];
  cacheSet('transactions', []); cacheSet('contracts', []);
  // Sirf in dono table ke pending ops hatao — accounts ke bin-sync writes reh jaayein
  queueSet(queueGet().filter((op) => op.table !== 'transactions' && op.table !== 'contracts'));
  refresh();
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

  $('#auth-lang').querySelectorAll('button').forEach((b) => b.onclick = () => { if (b.dataset.l !== lang) { const em = $('#au-email'); if (em) state.authEmail = em.value; setLang(b.dataset.l); renderAuth(); } });

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
  // Is phone pe pehle kisi AUR user ka cache hai to hatao (warna uska hisaab dikh jaata). Apna ho to rehne do.
  const me = state.session && state.session.user ? state.session.user.id : null;
  if (me && !state.session.offline) {
    const prev = localStorage.getItem('gk_uid');
    if (prev && prev !== me) clearLocalData();
    localStorage.setItem('gk_uid', me);
    if (state.session.user.email) localStorage.setItem('gk_email', state.session.user.email);
  }
  buildShell();
  bindHistory();
  renderHeader();
  // Cache me jo hai wo TURANT dikhao (network ka wait nahi) — offline-first ka asli fayda
  loadCache();
  if (state.transactions.length || state.accounts.length) show('dashboard');
  else app().querySelector('#screen').innerHTML = `<div class="full-loader"><div class="spinner"></div>${tr('Loading data…', 'Data load ho raha hai…')}</div>`;
  renderHeader();
  // Phir background me cloud se latest le kar update kar do
  if (canWrite()) { await loadFromCloud(); refresh(); }
  else show('dashboard');
  renderHeader();
}

function bindConnectivity() {
  window.addEventListener('online', async () => {
    state.online = true; renderHeader();
    if (state.session && state.session.offline && sb) {
      // Offline-mode se wapas: asli session lo. Na mile to login maango — queue me padi entries safe rehti hain.
      let s = null; try { const { data } = await sb.auth.getSession(); s = data ? data.session : null; } catch (_) { }
      if (!s) { toast(tr('Please log in again — your offline entries are safe and will sync after login', 'Dobara login karo — offline entries safe hain, login ke baad sync hongi'), true); state.authStep = 'login'; renderAuth(); return; }
      state.session = s;
    }
    await flushQueue(); await loadAll(); refresh();
  });
  window.addEventListener('offline', () => { state.online = false; renderHeader(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.online && sb && state.session) { await flushQueue(); renderHeader(); }
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}

/* ---- Tablet / laptop: breakpoints (CSS media queries; JS sirf layout-change pe re-render) + keyboard ---- */
const MQ_DESK = '(min-width: 1100px)', MQ_WIDE = '(min-width: 768px)';
function isDesktop() { return !!(window.matchMedia && window.matchMedia(MQ_DESK).matches); }
function isWide() { return !!(window.matchMedia && window.matchMedia(MQ_WIDE).matches); }
function watchBreakpoints() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia(MQ_DESK);
  const on = () => { if (document.getElementById('screen') && state.view === 'entries') renderScreen(); };
  if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
}
function focusSearch() {
  if (state.view === 'theka' && $('#k-q')) { $('#k-q').focus(); return; }
  if (state.view !== 'entries') show('entries');
  const q = $('#ef-q'); if (q) { q.focus(); try { q.select(); } catch (_) { } }
}
// Esc = sheet/dialog band · Enter (form field me, tablet/laptop) = Save · '/' = search · 'n' = naya kharcha
// ('/' aur 'n' sirf tab jab kisi input me type nahi kar rahe aur koi sheet khuli nahi)
function setupKeys() {
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.bottom-nav')) return;   // login screen pe kuch nahi
    const tgt = e.target;
    const typing = !!(tgt && tgt.matches && (tgt.matches('input, textarea, select') || tgt.isContentEditable));
    const modal = !!(modalRoot() && modalRoot().children.length);
    if (e.key === 'Escape') {
      if (modal) { e.preventDefault(); closeSheet(); return; }
      if (typing && tgt.blur) { tgt.blur(); return; }
      if (state.view === 'entries' && state.efSel) { state.efSel = null; renderPane(); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    if (e.key === 'Enter') {
      if (modal && typing && tgt.tagName === 'INPUT' && isWide() && !tgt.hasAttribute('list') && !tgt.classList.contains('mini-q') &&
          !['checkbox', 'radio', 'button', 'submit'].includes(tgt.type) && tgt.id !== 'cat-new-input') {
        const sheet = tgt.closest('.sheet'); const btn = sheet && sheet.querySelector('#save, #sv-save, #fs-apply');
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        return;
      }
      if (!typing && tgt && tgt.getAttribute && tgt.getAttribute('tabindex') === '0' && !tgt.matches('button, a')) { e.preventDefault(); tgt.click(); }
      return;
    }
    if (e.key === ' ' && !typing && tgt && tgt.getAttribute && tgt.getAttribute('tabindex') === '0' && !tgt.matches('button, a')) { e.preventDefault(); tgt.click(); return; }
    if (typing || modal) return;
    if (e.key === '/') { e.preventDefault(); focusSearch(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openOutForm(); }
  });
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
  // Koi bhi unhandled error/rejection → activity log me daalo (chup-chaap gum na ho)
  window.addEventListener('error', (e) => { try { logEvent('app', 'Error: ' + (e.message || msgOf(e.error)), 'error'); renderHeader(); } catch (_) { } });
  window.addEventListener('unhandledrejection', (e) => { try { logEvent('app', 'Error: ' + msgOf(e.reason), 'error'); renderHeader(); } catch (_) { } });
  registerSW();
  bindConnectivity();
  setupKeyboardNav();
  setupKeys();
  watchBreakpoints();
  if (!initClient()) { renderAuth(); return; }
  try {
    const { data } = await sb.auth.getSession();
    state.session = data ? data.session : null;
  } catch (e) { console.warn(e); }
  // Offline + token expire = session null aata hai. Phone pe isi user ka cache hai to app khol do
  // (entries queue me save hongi, net + login ke baad sync). Warna login screen pe atak jaate the.
  if (!state.session && !navigator.onLine && localStorage.getItem('gk_uid') && cacheGet('transactions').length) {
    state.session = { offline: true, user: { id: localStorage.getItem('gk_uid'), email: localStorage.getItem('gk_email') || '' } };
  }
  sb.auth.onAuthStateChange((_ev, session) => {
    if (!session && state.session && state.session.offline) return;   // offline-mode me logout mat dikhao
    state.session = session;
    if (!session) { state.authStep = cfgValid() ? 'login' : 'config'; renderAuth(); }
  });
  if (state.session) await enterApp(); else renderAuth();
}

window.addEventListener('load', start);
