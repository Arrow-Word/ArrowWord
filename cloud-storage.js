// cloud-storage.js — v33
// v33 - Reports its version to the version badge (site-banner.js).
// v32 - Publishing, changing and deleting puzzles are now done as the signed-in
//       person (when the page has supabase-auth.js), so the database can check
//       they are a builder. A change the database refuses now shows a clear
//       message instead of looking as if it worked.
//       Added cloudRenamePuzzle(): renames a puzzle and keeps its identity, so
//       solvers' progress stays attached to it.
// Puzzle storage via Supabase — no tokens needed, works on any device.
// v31 - Removed two unused functions, including cloudSavePuzzles, an old
//       "delete every puzzle and re-add them" routine nothing called any more.
(window.AW_FILES = window.AW_FILES || {})['cloud-storage.js'] = 'v33';

const SUPABASE_URL  = 'https://bfpoiewwvtdczkmoqlye.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcG9pZXd3dnRkY3prbW9xbHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODAxMTUsImV4cCI6MjA5MzQ1NjExNX0.EoIz2o7xg69tfAnSOp5wVusjc71s0cOmsEoSDwaxjso';
const SB_PUZZLES    = SUPABASE_URL + '/rest/v1/puzzles';
const SB_HEADERS    = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

// Headers for changes: as the signed-in person if there is one.
async function _sbWriteHeaders() {
  const headers = Object.assign({}, SB_HEADERS);
  try {
    if (typeof sbGetAccessToken === 'function') {
      const token = await sbGetAccessToken();
      if (token) headers.Authorization = 'Bearer ' + token;
    }
  } catch (e) {}
  return headers;
}

const SB_REFUSED = 'The database did not accept this change. Please make sure you are signed in with a builder or admin account.';

// Checks the answer to a change. The database answers a refused change to an
// existing puzzle with an empty list rather than an error, so treat that as refused.
async function _sbCheckWrite(res, what) {
  if (res.status === 401 || res.status === 403) throw new Error(SB_REFUSED);
  if (!res.ok) throw new Error(what + ' error ' + res.status);
  let rows = null;
  try { rows = await res.json(); } catch (e) {}
  if (Array.isArray(rows) && rows.length === 0) throw new Error(SB_REFUSED);
  return rows;
}

async function _sbGet(url) {
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error('Supabase read error ' + res.status);
  return res.json();
}

// Fast index — titles/sizes only
async function cloudGetIndex() {
  const data = await _sbGet(SB_PUZZLES + '?select=id,title,published_at,published_at_ms,rows,cols&order=published_at_ms.desc');
  return (data || []).map(p => ({
    id: p.id, title: p.title, publishedAt: p.published_at,
    publishedAtMs: p.published_at_ms, rows: p.rows, cols: p.cols
  }));
}

// Single puzzle with full data
async function cloudGetPuzzle(id) {
  const data = await _sbGet(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id) + '&select=*');
  if (!data || !data.length) return null;
  const p = data[0];
  return { id: p.id, title: p.title, publishedAt: p.published_at, publishedAtMs: p.published_at_ms, rows: p.rows, cols: p.cols, data: p.data, answer_cell_count: p.answer_cell_count };
}

// All puzzles with full data
async function cloudGetPuzzles() {
  const data = await _sbGet(SB_PUZZLES + '?select=*&order=published_at_ms.desc');
  return (data || []).map(p => ({ id: p.id, title: p.title, publishedAt: p.published_at, publishedAtMs: p.published_at_ms, rows: p.rows, cols: p.cols, data: p.data, answer_cell_count: p.answer_cell_count }));
}

async function cloudPublishPuzzle(title, data) {
  const existing = await _sbGet(SB_PUZZLES + '?title=eq.' + encodeURIComponent(title) + '&select=id');
  const id = (existing && existing.length) ? existing[0].id : ('p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7));
  const now = new Date();
  const row = { id, title, published_at: now.toLocaleDateString('en-ZA'), published_at_ms: now.getTime(), rows: data.rows, cols: data.cols, data };
  const headers = await _sbWriteHeaders();
  if (existing && existing.length) {
    const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers, body: JSON.stringify(row) });
    await _sbCheckWrite(res, 'Update');
  } else {
    const res = await fetch(SB_PUZZLES, { method: 'POST', headers, body: JSON.stringify(row) });
    await _sbCheckWrite(res, 'Insert');
  }
  return id;
}

async function cloudRemovePuzzle(id) {
  const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: await _sbWriteHeaders() });
  await _sbCheckWrite(res, 'Delete');
}

// Renames a published puzzle and keeps the same puzzle (same id), so solvers'
// progress, ratings and comments stay attached to it.
async function cloudRenamePuzzle(id, newTitle) {
  const clash = await _sbGet(SB_PUZZLES + '?title=eq.' + encodeURIComponent(newTitle) + '&select=id');
  if (clash && clash.some(p => p.id !== id)) throw new Error('Another puzzle is already called "' + newTitle + '".');
  const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: await _sbWriteHeaders(), body: JSON.stringify({ title: newTitle }) });
  await _sbCheckWrite(res, 'Rename');
}
