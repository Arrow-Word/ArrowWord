// staff-access.js — v33
// ══════════════════════════════════════════════════════════════════════════════
// Google sign-in for the staff pages: builder, admin and delete puzzles.
// Adds a "Sign in with Google" button and a status line to the page's lock box,
// checks the account's role in the database, and opens the page for accounts
// with an allowed role (builder / admin).
//
// While everyone moves over to signing in, the old password still works as a
// backup. A bar at the top of the page always shows who is signed in and
// whether they will be able to publish once the database is locked down.
//
// Needs supabase-auth.js to be loaded first.
// v33 - Reports its version to the version badge (site-banner.js).
// v32 - First version.
// ══════════════════════════════════════════════════════════════════════════════
(window.AW_FILES = window.AW_FILES || {})['staff-access.js'] = 'v33';

// o.box          the lock box element the sign-in button goes into
// o.before       element inside the box to put the sign-in button above
// o.allowed      roles that may use the page, e.g. ['builder','admin']
// o.unlock()     opens the page (called once, when an allowed account signs in)
// o.isUnlocked() true if the page is already open (e.g. by password)
function setupStaffAccess(o) {
  const allowedText = (/^[aeiou]/i.test(o.allowed[0]) ? 'an ' : 'a ') + o.allowed.join(' or ');
  const GOOGLE = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  const css = document.createElement('style');
  css.textContent =
    '.staff-access{margin:0 0 14px}' +
    '.staff-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#333;border:1px solid #ccc;border-radius:7px;padding:11px;font:600 15px Arial,sans-serif;cursor:pointer}' +
    '.staff-google:hover{box-shadow:0 2px 8px rgba(0,0,0,0.15)}' +
    '.staff-status{font:13px/1.5 Arial,sans-serif;color:#666;margin-top:10px;min-height:20px}' +
    '.staff-status.bad{color:#b00020}' +
    '.staff-or{font:12px Arial,sans-serif;color:#aaa;margin:14px 0 4px;text-transform:uppercase;letter-spacing:1px}' +
    '#staff-bar{box-sizing:border-box;width:100%;padding:8px 14px;font:13px/1.4 Arial,sans-serif;display:none;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center}' +
    '#staff-bar.ok{display:flex;background:#e8f6ec;color:#155724;border-bottom:1px solid #b7e1c1}' +
    '#staff-bar.warn{display:flex;background:#fff3cd;color:#664d03;border-bottom:1px solid #f0d27a}' +
    '#staff-bar button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:12px;padding:3px 10px;font:12px Arial,sans-serif;cursor:pointer}';
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.className = 'staff-access';
  wrap.innerHTML = '<button type="button" class="staff-google">' + GOOGLE + ' Sign in with Google</button>' +
    '<div class="staff-status">Checking sign-in…</div>' +
    '<div class="staff-or">or use the password</div>';
  o.box.insertBefore(wrap, o.before);
  const btn = wrap.querySelector('.staff-google');
  const status = wrap.querySelector('.staff-status');
  btn.addEventListener('click', () => { status.className = 'staff-status'; status.textContent = 'Opening Google sign-in…'; sbSignInGoogle(); });

  const bar = document.createElement('div');
  bar.id = 'staff-bar';
  bar.setAttribute('role', 'status');
  document.body.insertBefore(bar, document.body.firstChild);

  const state = { user: null, role: null, error: null, ready: false };
  let opened = false;

  function name(u) { return (u.user_metadata && u.user_metadata.full_name) || u.email || 'your account'; }
  function setStatus(text, bad) { status.textContent = text; status.className = 'staff-status' + (bad ? ' bad' : ''); }
  function showBar(kind, html) { bar.className = kind; bar.innerHTML = html; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // The bar at the top of an open page: who is signed in, and what that means.
  function refreshBar() {
    if (!o.isUnlocked()) { bar.className = ''; return; }
    if (state.user && !state.error && o.allowed.includes(state.role)) {
      showBar('ok', '✓ Signed in as <strong>' + esc(name(state.user)) + '</strong> · Role: ' + esc(state.role) + ' <button type="button" data-act="out">Sign out</button>');
    } else if (state.user && state.error) {
      showBar('warn', '⚠ Signed in as <strong>' + esc(name(state.user)) + '</strong>, but your role could not be checked (' + esc(state.error) + ').');
    } else if (state.user) {
      showBar('warn', '⚠ Signed in as <strong>' + esc(name(state.user)) + '</strong>, which is not ' + esc(allowedText) + ' account. Saving changes will stop working once the security update is switched on. <button type="button" data-act="out">Sign out</button>');
    } else {
      showBar('warn', '⚠ You opened this page with the password. Please sign in with Google: saving changes will soon need it. <button type="button" data-act="in">Sign in with Google</button>');
    }
  }
  bar.addEventListener('click', e => {
    const act = e.target && e.target.getAttribute('data-act');
    if (act === 'in') sbSignInGoogle();
    if (act === 'out') sbSignOut();
  });

  async function check(user) {
    state.ready = true;
    state.user = user; state.role = null; state.error = null;
    if (!user) {
      btn.style.display = '';
      setStatus('Not signed in.');
      refreshBar();
      return;
    }
    btn.style.display = 'none';
    setStatus('Signed in as ' + name(user) + '. Checking your access…');
    const r = await sbGetMyRole();
    if (state.user !== user) return;   // signed out meanwhile
    state.role = r.role; state.error = r.error;
    if (r.error) {
      setStatus('Signed in as ' + name(user) + ', but your access could not be checked: ' + r.error + '. Use the password for now.', true);
    } else if (o.allowed.includes(r.role)) {
      setStatus('Signed in as ' + name(user) + ' (' + r.role + ').');
      if (!opened && !o.isUnlocked()) { opened = true; o.unlock(); }
    } else {
      setStatus('Signed in as ' + name(user) + ', but this account is not ' + allowedText + ' account. Ask the site admin for access.', true);
      btn.style.display = '';
      btn.lastChild.textContent = ' Sign in with a different Google account';
    }
    refreshBar();
  }

  sbOnUserChanged(user => { check(user); });
  setTimeout(() => {
    if (!state.ready) setStatus('The sign-in service could not be reached. Use the password, or reload the page.', true);
  }, 10000);

  // Pages call this after opening with the password, so the bar appears.
  return { refresh: refreshBar, state };
}
