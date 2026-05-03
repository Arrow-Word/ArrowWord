// cloud-storage.js — v18.1
// CREDENTIALS ALREADY FILLED IN — upload this file directly, no editing needed.
// Index bin: 69f74075856a6821899f4770 (titles/sizes only — loads fast)
// Data bin:  69f6d39aaaba88219765b85a  (full puzzle grid — loaded on demand)

const JSONBIN_API_KEY = '$2a$10$Qz35tUrG18iwK4GJM12MwO3sr0LzpH5/M3J21usrclq50iWcvHBp6';
const INDEX_BIN_ID    = '69f74075856a6821899f4770';
const DATA_BIN_ID     = '69f6d39aaaba88219765b85a';

const INDEX_URL = 'https://api.jsonbin.io/v3/b/' + INDEX_BIN_ID;
const DATA_URL  = 'https://api.jsonbin.io/v3/b/' + DATA_BIN_ID;
const H_READ    = { 'X-Master-Key': JSONBIN_API_KEY };
const H_WRITE   = { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Versioning': 'false' };

async function _get(url) {
  const res = await fetch(url + '/latest', { headers: H_READ });
  if (!res.ok) throw new Error('Read error ' + res.status);
  const d = await res.json();
  return Array.isArray(d.record) ? d.record : [];
}

async function _put(url, data) {
  const res = await fetch(url, { method: 'PUT', headers: H_WRITE, body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Write error ' + res.status); }
}

// FAST: only titles/sizes, no grid data — used by directory page
async function cloudGetIndex() {
  return _get(INDEX_URL);
}

// On demand: full grid data for one puzzle — used by solver
async function cloudGetPuzzle(id) {
  const all = await _get(DATA_URL);
  return all.find(p => p.id === id) || null;
}

// All puzzles with full data — used by builder and delete page
async function cloudGetPuzzles() {
  return _get(DATA_URL);
}

async function cloudPublishPuzzle(title, data) {
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const publishedAt = new Date().toLocaleDateString('en-ZA');
  const publishedAtMs = Date.now();

  const [indexList, dataList] = await Promise.all([cloudGetIndex(), cloudGetPuzzles()]);

  const existingIdx  = indexList.findIndex(p => p.title === title);
  const finalId      = existingIdx >= 0 ? indexList[existingIdx].id : id;

  const idxEntry  = { id: finalId, title, publishedAt, publishedAtMs, rows: data.rows, cols: data.cols };
  const dataEntry = { id: finalId, title, publishedAt, publishedAtMs, rows: data.rows, cols: data.cols, data };

  if (existingIdx >= 0) indexList[existingIdx] = idxEntry; else indexList.unshift(idxEntry);
  const existingData = dataList.findIndex(p => p.title === title);
  if (existingData >= 0) dataList[existingData] = dataEntry; else dataList.unshift(dataEntry);

  await Promise.all([_put(INDEX_URL, indexList), _put(DATA_URL, dataList)]);
  return finalId;
}

async function cloudRemovePuzzle(id) {
  const [il, dl] = await Promise.all([cloudGetIndex(), cloudGetPuzzles()]);
  await Promise.all([
    _put(INDEX_URL, il.filter(p => p.id !== id)),
    _put(DATA_URL,  dl.filter(p => p.id !== id)),
  ]);
}

async function cloudSavePuzzles(list) {
  const il = list.map(p => ({ id:p.id, title:p.title, publishedAt:p.publishedAt, publishedAtMs:p.publishedAtMs, rows:p.rows, cols:p.cols }));
  await Promise.all([_put(INDEX_URL, il), _put(DATA_URL, list)]);
}
