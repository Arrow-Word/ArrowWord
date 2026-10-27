// supabase-auth.js — v36
// v36 - Added email-and-password sign-in alongside Google: sign up (with an
//       emailed confirmation link), sign in, forgot password and set a new
//       password. sbMountEmailForm() draws the email sign-in form used on the
//       directory, builder, admin and delete pages.
// v33 - Reports its version to the version badge (site-banner.js).
// v32 - Added sbGetMyRole() (the signed-in person's role, with a clear error if
//       it can't be read) and sbGetAccessToken() (lets database changes be
//       made as the signed-in person).
// v31 - Removed Facebook sign-in (no longer offered) and an unused comments
//       loader. Removed the old Facebook mention from the header.
// ══════════════════════════════════════════════════════════════════════════════
// Handles Supabase sign-in (Google or email) and user progress, ratings and
// comments. Loaded by every page that needs a signed-in person.
// ══════════════════════════════════════════════════════════════════════════════
(window.AW_FILES = window.AW_FILES || {})['supabase-auth.js'] = 'v36';

const _AUTH_URL  = 'https://bfpoiewwvtdczkmoqlye.supabase.co';
const _AUTH_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcG9pZXd3dnRkY3prbW9xbHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODAxMTUsImV4cCI6MjA5MzQ1NjExNX0.EoIz2o7xg69tfAnSOp5wVusjc71s0cOmsEoSDwaxjso';

// Load Supabase SDK
const _sbScript = document.createElement('script');
_sbScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
document.head.appendChild(_sbScript);

let _sb = null;
let _user = null;
let _userCallbacks = [];
let _authEventCallbacks = [];
let _lastAuthEvent = null;

_sbScript.onload = async () => {
  _sb = supabase.createClient(_AUTH_URL, _AUTH_ANON);

  // Handle OAuth callback (when Google redirects back to our page)
  const { data: { session } } = await _sb.auth.getSession();
  if (session) _user = session.user;

  // Listen for auth changes
  _sb.auth.onAuthStateChange((event, session) => {
    _user = session ? session.user : null;
    _lastAuthEvent = event;
    _authEventCallbacks.forEach(cb => cb(event, _user));
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

// ── Email and password sign-in ────────────────────────────────────────────────
// Called with every sign-in event name (e.g. 'PASSWORD_RECOVERY').
function sbOnAuthEvent(cb) {
  _authEventCallbacks.push(cb);
  if (_sb && _lastAuthEvent) cb(_lastAuthEvent, _user);
}

// The folder this page is in, so links work on both the live and test sites.
function _sbSiteFolder() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }

function _sbFriendlyError(e) {
  const m = String((e && e.message) || e || '');
  if (/invalid login credentials/i.test(m)) return 'Email or password is incorrect. If you usually use Google, use the Google button instead.';
  if (/email not confirmed/i.test(m)) return 'NOT_CONFIRMED';
  if (/already registered|already been registered|user already exists/i.test(m)) return 'EXISTS';
  if (/password should be at least|password is too short|weak password/i.test(m)) return 'Please choose a longer password (at least 8 characters).';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Too many attempts just now. Please wait a minute and try again.';
  if (/invalid email|unable to validate email/i.test(m)) return 'Please enter a valid email address.';
  return m || 'Something went wrong. Please try again.';
}

// Creates an account. Returns { ok, needsConfirm, error }.
async function sbSignUpEmail(email, password, name) {
  if (!_sb) return { ok: false, error: 'The sign-in service has not loaded yet. Please try again.' };
  const { data, error } = await _sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: _sbSiteFolder() + 'directory.html', data: name ? { full_name: name } : {} }
  });
  if (error) return { ok: false, error: _sbFriendlyError(error) };
  // With email confirmation on, an existing address comes back with no identities.
  if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, error: 'EXISTS' };
  return { ok: true, needsConfirm: !(data && data.session) };
}

async function sbSignInEmail(email, password) {
  if (!_sb) return { ok: false, error: 'The sign-in service has not loaded yet. Please try again.' };
  const { error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: _sbFriendlyError(error) };
  return { ok: true };
}

async function sbResendConfirmation(email) {
  if (!_sb) return { ok: false, error: 'The sign-in service has not loaded yet.' };
  const { error } = await _sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: _sbSiteFolder() + 'directory.html' } });
  return error ? { ok: false, error: _sbFriendlyError(error) } : { ok: true };
}

async function sbSendPasswordReset(email) {
  if (!_sb) return { ok: false, error: 'The sign-in service has not loaded yet.' };
  const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo: _sbSiteFolder() + 'reset-password.html' });
  return error ? { ok: false, error: _sbFriendlyError(error) } : { ok: true };
}

async function sbUpdatePassword(password) {
  if (!_sb) return { ok: false, error: 'The sign-in service has not loaded yet.' };
  const { error } = await _sb.auth.updateUser({ password });
  return error ? { ok: false, error: _sbFriendlyError(error) } : { ok: true };
}

// Draws the email sign-in form into `container`.
// opts.onBusy(text)  optional: called while waiting (e.g. to show a message)
function sbMountEmailForm(container, opts) {
  opts = opts || {};
  if (!document.getElementById('sb-email-css')) {
    const css = document.createElement('style');
    css.id = 'sb-email-css';
    css.textContent =
      '.sb-email{text-align:left;font:14px/1.4 Arial,sans-serif;color:#333}' +
      '.sb-email-tabs{display:flex;gap:4px;margin:0 0 10px;border-bottom:1px solid #e0d8f0}' +
      '.sb-email-tabs button{flex:1;background:none;border:none;border-bottom:2px solid transparent;padding:8px 4px;font:600 13px Arial,sans-serif;color:#888;cursor:pointer;margin-bottom:-1px}' +
      '.sb-email-tabs button.on{color:#7744bb;border-bottom-color:#7744bb}' +
      '.sb-email label{display:block;font-size:12px;color:#666;margin:8px 0 3px}' +
      '.sb-email input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid #ccc;border-radius:7px;background:#fff;color:#222}' +
      '.sb-email input:focus{outline:none;border-color:#7744bb;box-shadow:0 0 0 2px rgba(119,68,187,.12)}' +
      '.sb-email .sb-go{width:100%;margin-top:12px;background:#7744bb;color:#fff;border:none;border-radius:7px;padding:11px;font:600 15px Arial,sans-serif;cursor:pointer}' +
      '.sb-email .sb-go:disabled{opacity:.6;cursor:default}' +
      '.sb-email .sb-links{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px}' +
      '.sb-email .sb-links a{color:#7744bb;cursor:pointer;text-decoration:underline}' +
      '.sb-email .sb-msg{margin-top:10px;font-size:13px;line-height:1.45;min-height:0}' +
      '.sb-email .sb-msg.bad{color:#b00020}.sb-email .sb-msg.good{color:#155724}' +
      '.sb-email .sb-msg a{color:inherit;font-weight:700;cursor:pointer;text-decoration:underline}';
    document.head.appendChild(css);
  }
  const box = document.createElement('form');
  box.className = 'sb-email';
  box.noValidate = true;
  box.innerHTML =
    '<div class="sb-email-tabs"><button type="button" data-mode="in" class="on">Sign in with email</button><button type="button" data-mode="up">Create account</button></div>' +
    '<div class="sb-f-name" style="display:none"><label>Your name (shown on the site)</label><input type="text" autocomplete="name" maxlength="60"></div>' +
    '<label>Email</label><input type="email" class="sb-f-email" autocomplete="email" required>' +
    '<div class="sb-f-pw"><label class="sb-pw-label">Password</label><input type="password" class="sb-f-password" autocomplete="current-password" minlength="8"></div>' +
    '<button type="submit" class="sb-go">Sign in</button>' +
    '<div class="sb-links"><a class="sb-forgot">Forgot password?</a><a class="sb-back" style="display:none">Back to sign in</a></div>' +
    '<div class="sb-msg" role="status"></div>';
  container.appendChild(box);
  const $ = sel => box.querySelector(sel);
  const nameIn = $('.sb-f-name input'), emailIn = $('.sb-f-email'), pwIn = $('.sb-f-password');
  const go = $('.sb-go'), msg = $('.sb-msg');
  let mode = 'in';

  function say(html, kind) { msg.innerHTML = html; msg.className = 'sb-msg' + (kind ? ' ' + kind : ''); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function setMode(m) {
    mode = m;
    box.querySelectorAll('.sb-email-tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    $('.sb-email-tabs').style.display = m === 'forgot' ? 'none' : '';
    $('.sb-f-name').style.display = m === 'up' ? '' : 'none';
    $('.sb-f-pw').style.display = m === 'forgot' ? 'none' : '';
    $('.sb-pw-label').textContent = m === 'up' ? 'Choose a password (at least 8 characters)' : 'Password';
    pwIn.setAttribute('autocomplete', m === 'up' ? 'new-password' : 'current-password');
    go.textContent = m === 'up' ? 'Create account' : m === 'forgot' ? 'Email me a reset link' : 'Sign in';
    $('.sb-forgot').style.display = m === 'forgot' ? 'none' : '';
    $('.sb-back').style.display = m === 'forgot' ? '' : 'none';
    say('');
  }
  box.querySelectorAll('.sb-email-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('.sb-forgot').addEventListener('click', () => setMode('forgot'));
  $('.sb-back').addEventListener('click', () => setMode('in'));
  msg.addEventListener('click', async e => {
    const act = e.target && e.target.getAttribute('data-act');
    if (act === 'resend') {
      say('Sending…');
      const r = await sbResendConfirmation(emailIn.value.trim());
      say(r.ok ? 'Sent. Please check your inbox (and spam folder) for the confirmation link.' : esc(r.error), r.ok ? 'good' : 'bad');
    }
    if (act === 'forgot') setMode('forgot');
    if (act === 'signin') setMode('in');
  });

  box.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailIn.value.trim(), pw = pwIn.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Please enter a valid email address.', 'bad'); emailIn.focus(); return; }
    if (mode !== 'forgot' && !pw) { say('Please enter your password.', 'bad'); pwIn.focus(); return; }
    if (mode === 'up' && pw.length < 8) { say('Please choose a password of at least 8 characters.', 'bad'); pwIn.focus(); return; }
    go.disabled = true;
    const label = go.textContent; go.textContent = 'Please wait…';
    if (opts.onBefore) try { opts.onBefore(mode); } catch (x) {}
    let r;
    try {
      if (mode === 'in') r = await sbSignInEmail(email, pw);
      else if (mode === 'up') r = await sbSignUpEmail(email, pw, nameIn.value.trim());
      else r = await sbSendPasswordReset(email);
    } catch (x) { r = { ok: false, error: _sbFriendlyError(x) }; }
    go.disabled = false; go.textContent = label;
    if (!r.ok) {
      if (r.error === 'NOT_CONFIRMED') say('Please confirm your email first: check your inbox (and spam folder) for our link. <a data-act="resend">Send it again</a>', 'bad');
      else if (r.error === 'EXISTS') say('An account with this email already exists. <a data-act="signin">Sign in</a>, use the Google button, or <a data-act="forgot">reset your password</a>.', 'bad');
      else say(esc(r.error), 'bad');
      return;
    }
    if (mode === 'in') { say('Signed in.', 'good'); pwIn.value = ''; }
    else if (mode === 'up') {
      pwIn.value = '';
      say(r.needsConfirm ? 'Almost done! We\'ve sent a confirmation link to <strong>' + esc(email) + '</strong>. Click it to finish creating your account. (Check your spam folder if it isn\'t there in a few minutes.)' : 'Account created. You\'re signed in.', 'good');
    } else say('If an account exists for <strong>' + esc(email) + '</strong>, we\'ve emailed a link to set a new password. It may take a few minutes to arrive.', 'good');
  });
  return { setMode };
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

// ── Rating API ────────────────────────────────────────────────────────────────
async function sbSaveRating(puzzleId, rating) {
  if (!_sb || !_user) return false;
  // Save to user progress
  await _sb.from('user_progress').upsert({
    user_id: _user.id, puzzle_id: puzzleId, rating,
    last_saved: new Date().toISOString()
  }, { onConflict: 'user_id,puzzle_id' });
  // Update aggregate ratings table
  const { data } = await _sb.from('puzzle_ratings').select('*').eq('puzzle_id', puzzleId).single();
  if (data) {
    await _sb.from('puzzle_ratings').update({
      total_ratings: data.total_ratings + 1,
      sum_ratings: data.sum_ratings + rating,
      avg_rating: ((data.sum_ratings + rating) / (data.total_ratings + 1)).toFixed(2)
    }).eq('puzzle_id', puzzleId);
  } else {
    await _sb.from('puzzle_ratings').insert({
      puzzle_id: puzzleId, total_ratings: 1, sum_ratings: rating, avg_rating: rating
    });
  }
  return true;
}

async function sbGetRatings() {
  if (!_sb) return {};
  const { data } = await _sb.from('puzzle_ratings').select('*');
  const result = {};
  (data || []).forEach(r => { result[r.puzzle_id] = r; });
  return result;
}

async function sbSaveTimeSpent(puzzleId, seconds) {
  if (!_sb || !_user) return;
  const { data } = await _sb.from('user_progress').select('time_spent_seconds')
    .eq('user_id', _user.id).eq('puzzle_id', puzzleId).single();
  const existing = (data && data.time_spent_seconds) || 0;
  await _sb.from('user_progress').upsert({
    user_id: _user.id, puzzle_id: puzzleId,
    time_spent_seconds: existing + seconds,
    last_saved: new Date().toISOString()
  }, { onConflict: 'user_id,puzzle_id' });
}

async function sbAdminGetRatings() {
  if (!_sb) return [];
  const { data } = await _sb.from('puzzle_ratings').select('*');
  return data || [];
}

// ── Comments API ──────────────────────────────────────────────────────────────
async function sbSaveComment(puzzleId, commentText, commentType = 'feedback') {
  if (!_sb || !_user) return false;
  const row = {
    puzzle_id: puzzleId,
    user_id: _user.id,
    comment_text: commentText,
    comment_type: commentType,
    created_at: new Date().toISOString()
  };
  const { error } = await _sb.from('puzzle_comments').insert(row);
  if (error) { console.error('Save comment error:', error); return false; }
  return true;
}

async function sbAdminGetAllComments() {
  if (!_sb) return [];
  const { data, error } = await _sb.from('puzzle_comments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Admin comments query error:', error); return []; }
  return data || [];
}

// ── Signed-in person: role and sign-in token ──────────────────────────────────
// Returns { role, error }. role is 'admin', 'builder', or 'user' when the
// account has no role. error explains why the role could not be read.
async function sbGetMyRole() {
  if (!_sb) return { role: null, error: 'the sign-in service has not loaded' };
  if (!_user) return { role: null, error: 'not signed in' };
  try {
    const { data, error } = await _sb.from('user_roles')
      .select('role')
      .eq('user_id', _user.id)
      .maybeSingle();
    if (error) return { role: null, error: error.message || String(error) };
    return { role: (data && data.role) || 'user', error: null };
  } catch (e) {
    return { role: null, error: (e && e.message) || String(e) };
  }
}

// The signed-in person's access token, or null when nobody is signed in.
async function sbGetAccessToken() {
  if (!_sb) return null;
  const { data } = await _sb.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

// ── Role API ──────────────────────────────────────────────────────────────────
async function sbGetUserRole() {
  if (!_sb || !_user) return 'user';
  const { data, error } = await _sb.from('user_roles')
    .select('role')
    .eq('user_id', _user.id)
    .single();
  if (error || !data) return 'user'; // default to user if no role set
  return data.role;
}

async function sbGetBuilder(userId) {
  if (!_sb) return null;
  const { data, error } = await _sb.from('user_profiles')
    .select('id, display_name, email')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

async function sbAdminSetRole(userId, role) {
  if (!_sb || !_user) return false;
  // Check if current user is admin
  const userRole = await sbGetUserRole();
  if (userRole !== 'admin') return false;
  
  const { error } = await _sb.from('user_roles').upsert({
    user_id: userId,
    role: role
  }, { onConflict: 'user_id' });
  
  if (error) { console.error('Set role error:', error); return false; }
  return true;
}

async function sbAdminGetAllRoles() {
  if (!_sb) return [];
  const { data, error } = await _sb.from('user_roles').select('*');
  if (error) { console.error('Get roles error:', error); return []; }
  return data || [];
}
