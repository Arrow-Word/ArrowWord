// cloud-storage.js — v19.2
// Puzzle storage via Supabase — no tokens needed, works on any device

const SUPABASE_URL  = 'https://bfpoiewwvtdczkmoqlye.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcG9pZXd3dnRkY3prbW9xbHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODAxMTUsImV4cCI6MjA5MzQ1NjExNX0.EoIz2o7xg69tfAnSOp5wVusjc71s0cOmsEoSDwaxjso';
const SB_PUZZLES    = SUPABASE_URL + '/rest/v1/puzzles';
const SB_HEADERS    = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function _sbGet(url) {
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error('Supabase read error ' + res.status);
  return res.json();
}

async function _sbPut(id, row) {
  const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify(row)
  });
  if (res.status === 404 || (await res.clone().json().then(d => !d || !d.length).catch(() => true))) {
    // Row doesn't exist, insert
    const ins = await fetch(SB_PUZZLES, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(row) });
    if (!ins.ok) throw new Error('Supabase insert error ' + ins.status);
  }
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
  return { id: p.id, title: p.title, publishedAt: p.published_at, publishedAtMs: p.published_at_ms, rows: p.rows, cols: p.cols, data: p.data };
}

// All puzzles with full data
async function cloudGetPuzzles() {
  const data = await _sbGet(SB_PUZZLES + '?select=*&order=published_at_ms.desc');
  return (data || []).map(p => ({ id: p.id, title: p.title, publishedAt: p.published_at, publishedAtMs: p.published_at_ms, rows: p.rows, cols: p.cols, data: p.data }));
}

async function cloudPublishPuzzle(title, data) {
  const existing = await _sbGet(SB_PUZZLES + '?title=eq.' + encodeURIComponent(title) + '&select=id');
  const id = (existing && existing.length) ? existing[0].id : ('p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7));
  const now = new Date();
  const row = { id, title, published_at: now.toLocaleDateString('en-ZA'), published_at_ms: now.getTime(), rows: data.rows, cols: data.cols, data };
  if (existing && existing.length) {
    const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify(row) });
    if (!res.ok) throw new Error('Update error ' + res.status);
  } else {
    const res = await fetch(SB_PUZZLES, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(row) });
    if (!res.ok) throw new Error('Insert error ' + res.status);
  }
  return id;
}

async function cloudRemovePuzzle(id) {
  const res = await fetch(SB_PUZZLES + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: SB_HEADERS });
  if (!res.ok) throw new Error('Delete error ' + res.status);
}

async function cloudSavePuzzles(list) {
  // Delete all then reinsert — used by admin clear
  await fetch(SB_PUZZLES + '?id=neq.none', { method: 'DELETE', headers: SB_HEADERS });
  if (list && list.length) {
    const rows = list.map(p => ({ id: p.id, title: p.title, published_at: p.publishedAt, published_at_ms: p.publishedAtMs, rows: p.rows, cols: p.cols, data: p.data }));
    const res = await fetch(SB_PUZZLES, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(rows) });
    if (!res.ok) throw new Error('Bulk insert error ' + res.status);
  }
}
