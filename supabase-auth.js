// supabase-auth.js — v18
// ══════════════════════════════════════════════════════════════════════════════
// Handles all Supabase auth (Google, Facebook) and user progress storage.
// Loaded by directory.html and admin.html.
// ══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://bfpoiewwvtdczkmoqlye.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcG9pZXd3dnRkY3prbW9xbHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODAxMTUsImV4cCI6MjA5MzQ1NjExNX0.EoIz2o7xg69tfAnSOp5wVusjc71s0cOmsEoSDwaxjso';

// Load Supabase SDK
const _sbScript = document.createElement('script');
_sbScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
document.head.appendChild(_sbScript);

let _sb = null;
let _user = null;
let _userCallbacks = [];

_sbScript.onload = async () => {
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // Handle OAuth callback (when Google redirects back to our page)
  const { data: { session } } = await _sb.auth.getSession();
  if (session) _user = session.user;

  // Listen for auth changes
  _sb.auth.onAuthStateChange((event, session) => {
    _user = session ? session.user : null;
    _userCallbacks.forEach(cb => cb(_user));
  });

  // Notify any callbacks that were registered before SDK loaded
  _userCallbacks.forEach(cb => cb(_user));
};

// ── Public auth API ───────────────────────────────────────────────────────────
function sbOnUserChanged(cb) {
  _userCallbacks.push(cb);
  if (_sb) cb(_user); // call immediately if already loaded
}

function sbGetUser() { return _user; }

async function sbSignInGoogle() {
  if (!_sb) return;
  await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
}

async function sbSignInFacebook() {
  if (!_sb) return;
  await _sb.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: window.location.href }
  });
}

async function sbSignOut() {
  if (!_sb) return;
  await _sb.auth.signOut();
}

// ── Progress API ──────────────────────────────────────────────────────────────
async function sbSaveProgress(puzzleId, answers, complete, checkCount) {
  if (!_sb || !_user) return false;
  const row = {
    user_id: _user.id,
    puzzle_id: puzzleId,
    answers: answers,
    complete: complete,
    check_count: checkCount || 0,
    last_saved: new Date().toISOString(),
    completed_at: complete ? new Date().toISOString() : null,
  };
  const { error } = await _sb.from('user_progress').upsert(row, { onConflict: 'user_id,puzzle_id' });
  if (error) { console.error('Save progress error:', error); return false; }
  return true;
}

async function sbLoadProgress(puzzleId) {
  if (!_sb || !_user) return null;
  const { data, error } = await _sb.from('user_progress')
    .select('*')
    .eq('user_id', _user.id)
    .eq('puzzle_id', puzzleId)
    .single();
  if (error || !data) return null;
  return data;
}

async function sbLoadAllProgress() {
  if (!_sb || !_user) return {};
  const { data, error } = await _sb.from('user_progress')
    .select('puzzle_id, complete, check_count, last_saved, completed_at')
    .eq('user_id', _user.id);
  if (error || !data) return {};
  const result = {};
  data.forEach(row => { result[row.puzzle_id] = row; });
  return result;
}

async function sbIncrementCheckCount(puzzleId) {
  if (!_sb || !_user) return 0;
  // Get current count first
  const { data } = await _sb.from('user_progress')
    .select('check_count')
    .eq('user_id', _user.id)
    .eq('puzzle_id', puzzleId)
    .single();
  const newCount = ((data && data.check_count) || 0) + 1;
  await _sb.from('user_progress').upsert({
    user_id: _user.id, puzzle_id: puzzleId, check_count: newCount, last_saved: new Date().toISOString()
  }, { onConflict: 'user_id,puzzle_id' });
  return newCount;
}

// ── Admin API (reads all users progress) ─────────────────────────────────────
async function sbAdminGetAllProgress() {
  if (!_sb) return [];
  const { data, error } = await _sb.from('user_progress').select('*');
  if (error) { console.error('Admin progress query error:', error); return []; }
  return data || [];
}

async function sbAdminGetAllUsers() {
  if (!_sb) return [];
  const { data, error } = await _sb.from('user_profiles').select('*');
  if (error) { console.error('Admin users query error:', error); return []; }
  return data || [];
}
