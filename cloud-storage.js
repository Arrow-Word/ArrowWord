// cloud-storage.js — v17.2
// Fixed: _isConfigured() was broken, causing localStorage fallback on all devices.

const JSONBIN_BIN_ID  = '69f6d39aaaba88219765b85a';
const JSONBIN_API_KEY = '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

// Simply always use JSONBin — credentials are hardcoded so no check needed
async function cloudGetPuzzles() {
  const res = await fetch(JSONBIN_BASE + '/latest', { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
  if (!res.ok) throw new Error('JSONBin read error ' + res.status);
  const d = await res.json();
  return Array.isArray(d.record) ? d.record : [];
}

async function cloudGetIndex() {
  const list = await cloudGetPuzzles();
  return list.map(p => ({ id: p.id, title: p.title, publishedAt: p.publishedAt, publishedAtMs: p.publishedAtMs, rows: p.rows, cols: p.cols }));
}

async function cloudGetPuzzle(id) {
  const list = await cloudGetPuzzles();
  return list.find(p => p.id === id) || null;
}

async function cloudSavePuzzles(list) {
  const res = await fetch(JSONBIN_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(list),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'JSONBin write error ' + res.status); }
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
