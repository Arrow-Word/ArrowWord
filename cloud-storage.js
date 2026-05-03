// cloud-storage.js — v15
// Uses JSONBin.io for puzzle storage.
// FREE tier: unlimited reads, unlimited writes, 10,000 records.
// Anyone can publish puzzles — no GitHub token, no login required.
// You (the owner) set this up once with a master API key.
//
// ── SETUP (one time, 2 minutes) ──────────────────────────────────────────────
// 1. Go to https://jsonbin.io and create a free account
// 2. Click "CREATE BIN" and paste in:   []
//    Save it. Copy the BIN ID from the URL (looks like: 6638f2e7ad19ca34f87f1234)
// 3. Go to API Keys → copy your Master Key (starts with $2b$10$...)
// 4. Paste both values below:

const JSONBIN_BIN_ID  = 'PASTE_YOUR_BIN_ID_HERE';
const JSONBIN_API_KEY = 'PASTE_YOUR_MASTER_KEY_HERE';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

// ── Read all puzzles (no auth needed for public bins) ─────────────────────────
async function cloudGetPuzzles() {
  if (JSONBIN_BIN_ID === 'PASTE_YOUR_BIN_ID_HERE') return _localGetPuzzles();
  try {
    const res = await fetch(JSONBIN_BASE + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error('JSONBin read error ' + res.status);
    const data = await res.json();
    return Array.isArray(data.record) ? data.record : [];
  } catch (e) {
    console.warn('cloudGetPuzzles failed, falling back to local:', e.message);
    return _localGetPuzzles();
  }
}

// ── Write all puzzles ─────────────────────────────────────────────────────────
async function cloudSavePuzzles(list) {
  if (JSONBIN_BIN_ID === 'PASTE_YOUR_BIN_ID_HERE') { _localSavePuzzles(list); return; }
  const res = await fetch(JSONBIN_BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_API_KEY,
      'X-Bin-Versioning': 'false',   // overwrite, don't stack versions
    },
    body: JSON.stringify(list),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'JSONBin write error ' + res.status);
  }
}

// ── Publish a puzzle (anyone can call this) ───────────────────────────────────
async function cloudPublishPuzzle(title, data) {
  const list = await cloudGetPuzzles();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const existing = list.findIndex(p => p.title === title);
  const entry = {
    id:            existing >= 0 ? list[existing].id : id,
    title,
    publishedAt:   new Date().toLocaleDateString('en-ZA'),
    publishedAtMs: Date.now(),
    rows:          data.rows,
    cols:          data.cols,
    data,
  };
  if (existing >= 0) list[existing] = entry;
  else list.unshift(entry);
  await cloudSavePuzzles(list);
  return entry.id;
}

// ── Remove a puzzle ───────────────────────────────────────────────────────────
async function cloudRemovePuzzle(id) {
  const list = await cloudGetPuzzles();
  await cloudSavePuzzles(list.filter(p => p.id !== id));
}

// ── Local fallback (used when BIN ID not yet configured) ─────────────────────
// This lets you test the app locally before setting up JSONBin.
const LOCAL_KEY = 'arrowword_published';
function _localGetPuzzles() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch(e) { return []; }
}
function _localSavePuzzles(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

// ── Setup check helper — call on page load to warn if not configured ──────────
function cloudCheckSetup() {
  if (JSONBIN_BIN_ID === 'PASTE_YOUR_BIN_ID_HERE') {
    console.warn('⚠️  ArrowWord: cloud-storage.js is not configured. Puzzles will only be saved locally until you add your JSONBin credentials.');
    return false;
  }
  return true;
}
