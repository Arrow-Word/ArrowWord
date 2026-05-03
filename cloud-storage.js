// cloud-storage.js — v17.1
// Stores a lightweight INDEX (titles, sizes, dates) separately from FULL puzzle data.
// Directory page loads fast (index only). Solver loads full data on demand.

const JSONBIN_BIN_ID  = '69f6d39aaaba88219765b85a';
const JSONBIN_API_KEY = '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;
const _isConfigured = () => JSONBIN_BIN_ID !== '69f6d39aaaba88219765b85a' && JSONBIN_API_KEY !== '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';

// ── Internal read/write ───────────────────────────────────────────────────────
async function _jbGet() {
  if (!_isConfigured()) return _localGet();
  const res = await fetch(JSONBIN_BASE + '/latest', { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
  if (!res.ok) throw new Error('JSONBin read error ' + res.status);
  const d = await res.json();
  return Array.isArray(d.record) ? d.record : [];
}

async function _jbPut(list) {
  if (!_isConfigured()) { _localSave(list); return; }
  const res = await fetch(JSONBIN_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(list),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'JSONBin write error ' + res.status); }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Get all puzzles (includes full data — used by builder/delete pages)
async function cloudGetPuzzles() {
  return _jbGet();
}

// Get lightweight list for directory display (no grid data = fast)
async function cloudGetIndex() {
  const list = await _jbGet();
  return list.map(p => ({
    id: p.id,
    title: p.title,
    publishedAt: p.publishedAt,
    publishedAtMs: p.publishedAtMs,
    rows: p.rows,
    cols: p.cols,
  }));
}

// Get single puzzle with full data for solving
async function cloudGetPuzzle(id) {
  const list = await _jbGet();
  return list.find(p => p.id === id) || null;
}

async function cloudSavePuzzles(list) {
  return _jbPut(list);
}

async function cloudPublishPuzzle(title, data) {
  const list = await _jbGet();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const existing = list.findIndex(p => p.title === title);
  const entry = {
    id: existing >= 0 ? list[existing].id : id,
    title,
    publishedAt: new Date().toLocaleDateString('en-ZA'),
    publishedAtMs: Date.now(),
    rows: data.rows,
    cols: data.cols,
    data,
  };
  if (existing >= 0) list[existing] = entry; else list.unshift(entry);
  await _jbPut(list);
  return entry.id;
}

async function cloudRemovePuzzle(id) {
  const list = await _jbGet();
  await _jbPut(list.filter(p => p.id !== id));
}

// ── localStorage fallback ─────────────────────────────────────────────────────
const _LOCAL_KEY = 'arrowword_published';
function _localGet() { try { return JSON.parse(localStorage.getItem(_LOCAL_KEY) || '[]'); } catch(e) { return []; } }
function _localSave(list) { localStorage.setItem(_LOCAL_KEY, JSON.stringify(list)); }
