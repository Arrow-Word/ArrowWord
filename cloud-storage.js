// cloud-storage.js — v18
// ══════════════════════════════════════════════════════════════════════════════
// TWO-BIN ARCHITECTURE for fast loading:
//
//  BIN 1 (INDEX_BIN_ID): Tiny index — only title, size, date, id.
//                        Directory loads this only. < 2KB for 100 puzzles.
//                        Loads in under 1 second.
//
//  BIN 2 (DATA_BIN_ID):  Full puzzle data with grid/clues/answers.
//                        Only fetched when someone opens a puzzle to solve.
//
// SETUP:
//  1. Your existing bin becomes DATA_BIN_ID (already filled in below).
//  2. Create a SECOND new bin at jsonbin.io with content [] and save it.
//  3. Paste that new bin's ID as INDEX_BIN_ID below.
//  Same API key works for both bins.
// ══════════════════════════════════════════════════════════════════════════════

const JSONBIN_API_KEY = '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';
const INDEX_BIN_ID    = '69f74075856a6821899f4770'; // new empty bin — paste id here
const DATA_BIN_ID     = '69f6d39aaaba88219765b85a';    // your existing bin

const INDEX_URL   = 'https://api.jsonbin.io/v3/b/' + INDEX_BIN_ID;
const DATA_URL    = 'https://api.jsonbin.io/v3/b/' + DATA_BIN_ID;
const H_READ      = { 'X-Master-Key': JSONBIN_API_KEY };
const H_WRITE     = { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Versioning': 'false' };

async function _get(url) {
  const res = await fetch(url + '/latest', { headers: H_READ });
  if (!res.ok) throw new Error('Read error ' + res.status);
  const d = await res.json();
  return Array.isArray(d.record) ? d.record : (d.record || []);
}

async function _put(url, data) {
  const res = await fetch(url, { method: 'PUT', headers: H_WRITE, body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Write error ' + res.status); }
}

// Fast — only loads titles/sizes, no grid data
async function cloudGetIndex() {
  try {
    const idx = await _get(INDEX_URL);
    return Array.isArray(idx) ? idx : [];
  } catch(e) {
    // If index bin not set up yet, fall back to full data (slower but works)
    console.warn('Index bin not available, falling back to full data');
    const full = await _get(DATA_URL);
    return (Array.isArray(full) ? full : []).map(p => ({ id:p.id, title:p.title, publishedAt:p.publishedAt, publishedAtMs:p.publishedAtMs, rows:p.rows, cols:p.cols }));
  }
}

// Only called when a user opens a puzzle to solve
async function cloudGetPuzzle(id) {
  const all = await _get(DATA_URL);
  return (Array.isArray(all) ? all : []).find(p => p.id === id) || null;
}

// All puzzles with full data (used by delete page and builder)
async function cloudGetPuzzles() {
  const all = await _get(DATA_URL);
  return Array.isArray(all) ? all : [];
}

async function cloudPublishPuzzle(title, data) {
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date();
  const publishedAt = now.toLocaleDateString('en-ZA');
  const publishedAtMs = now.getTime();

  // Read both bins in parallel for speed
  const [indexList, dataList] = await Promise.all([cloudGetIndex(), cloudGetPuzzles()]);

  const existingIdx = indexList.findIndex(p => p.title === title);
  const finalId = existingIdx >= 0 ? indexList[existingIdx].id : id;

  const idxEntry = { id: finalId, title, publishedAt, publishedAtMs, rows: data.rows, cols: data.cols };
  if (existingIdx >= 0) indexList[existingIdx] = idxEntry; else indexList.unshift(idxEntry);

  const dataEntry = { id: finalId, title, publishedAt, publishedAtMs, rows: data.rows, cols: data.cols, data };
  const existingData = dataList.findIndex(p => p.title === title);
  if (existingData >= 0) dataList[existingData] = dataEntry; else dataList.unshift(dataEntry);

  // Write both bins in parallel
  await Promise.all([_put(INDEX_URL, indexList), _put(DATA_URL, dataList)]);
  return finalId;
}

async function cloudRemovePuzzle(id) {
  const [indexList, dataList] = await Promise.all([cloudGetIndex(), cloudGetPuzzles()]);
  await Promise.all([
    _put(INDEX_URL, indexList.filter(p => p.id !== id)),
    _put(DATA_URL, dataList.filter(p => p.id !== id)),
  ]);
}

async function cloudSavePuzzles(list) {
  const indexList = list.map(p => ({ id:p.id, title:p.title, publishedAt:p.publishedAt, publishedAtMs:p.publishedAtMs, rows:p.rows, cols:p.cols }));
  await Promise.all([_put(INDEX_URL, indexList), _put(DATA_URL, list)]);
}
