// cloud-storage.js — v17
// ══════════════════════════════════════════════════════════════════════════════
// SETUP — YOU MUST DO THIS ONCE:
// 1. Go to https://jsonbin.io and log in
// 2. Find your bin (or create one with content [])
// 3. Copy the Bin ID from the URL
// 4. Go to API Keys and copy your Master Key
// 5. Paste both below, then upload this file to GitHub
// ══════════════════════════════════════════════════════════════════════════════

const JSONBIN_BIN_ID  = '69f6d39aaaba88219765b85a';
const JSONBIN_API_KEY = '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;
const _isConfigured = () => JSONBIN_BIN_ID !== 'PASTE_YOUR_BIN_ID_HERE' && JSONBIN_API_KEY !== 'PASTE_YOUR_MASTER_KEY_HERE';

async function cloudGetPuzzles() {
  if (!_isConfigured()) { console.warn('cloud-storage: not configured, using localStorage'); return _localGet(); }
  const res = await fetch(JSONBIN_BASE + '/latest', { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
  if (!res.ok) throw new Error('JSONBin read error ' + res.status);
  const data = await res.json();
  return Array.isArray(data.record) ? data.record : [];
}

async function cloudSavePuzzles(list) {
  if (!_isConfigured()) { _localSave(list); return; }
  const res = await fetch(JSONBIN_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(list),
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'JSONBin write error ' + res.status); }
}

async function cloudPublishPuzzle(title, data) {
  const list = await cloudGetPuzzles();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const existing = list.findIndex(p => p.title === title);
  const entry = { id: existing >= 0 ? list[existing].id : id, title,
    publishedAt: new Date().toLocaleDateString('en-ZA'), publishedAtMs: Date.now(),
    rows: data.rows, cols: data.cols, data };
  if (existing >= 0) list[existing] = entry; else list.unshift(entry);
  await cloudSavePuzzles(list);
  return entry.id;
}

async function cloudRemovePuzzle(id) {
  const list = await cloudGetPuzzles();
  await cloudSavePuzzles(list.filter(p => p.id !== id));
}

const _LOCAL_KEY = 'arrowword_published';
function _localGet() { try { return JSON.parse(localStorage.getItem(_LOCAL_KEY) || '[]'); } catch(e) { return []; } }
function _localSave(list) { localStorage.setItem(_LOCAL_KEY, JSON.stringify(list)); }

function cloudShowCredentialWarning(sel) {
  if (_isConfigured()) return;
  const el = document.querySelector(sel); if (!el) return;
  const w = document.createElement('div');
  w.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 14px;font-size:12px;color:#664d03;margin-bottom:12px;line-height:1.5';
  w.innerHTML = '⚠️ <strong>Cloud storage not configured.</strong> Open <code>cloud-storage.js</code>, paste your JSONBin Bin ID and Master Key, then upload to GitHub. Until then, puzzles only appear in this browser.';
  el.insertBefore(w, el.firstChild);
}
