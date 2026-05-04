// cloud-storage.js — v19.1
const GH_OWNER  = 'arrow-word';
const GH_REPO   = 'ArrowWord';
const GH_BRANCH = 'main';
const GH_FILE   = 'puzzles.json';

const CDN_URL = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${GH_FILE}`;
const API_URL = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

function ghGetToken()   { return localStorage.getItem('gh_pat') || ''; }
function ghSaveToken(t) { localStorage.setItem('gh_pat', t.trim()); }

async function cloudGetIndex() {
  const res = await fetch(CDN_URL + '?v=' + Date.now());
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Could not load puzzles (' + res.status + ')');
  const list = await res.json();
  return list.map(p => ({ id:p.id, title:p.title, publishedAt:p.publishedAt, publishedAtMs:p.publishedAtMs, rows:p.rows, cols:p.cols }));
}

async function cloudGetPuzzle(id) {
  const res = await fetch(CDN_URL + '?v=' + Date.now());
  if (!res.ok) throw new Error('Could not load puzzle');
  const list = await res.json();
  return list.find(p => p.id === id) || null;
}

async function cloudGetPuzzles() {
  const res = await fetch(CDN_URL + '?v=' + Date.now());
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Could not load puzzles');
  return res.json();
}

async function _ghWrite(list, token) {
  const infoRes = await fetch(API_URL + '?ref=' + GH_BRANCH + '&t=' + Date.now(), {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
  });
  let sha = null;
  if (infoRes.ok) { const info = await infoRes.json(); sha = info.sha; }
  else if (infoRes.status === 401 || infoRes.status === 403) {
    localStorage.removeItem('gh_pat');
    throw new Error('GitHub token rejected. Token cleared — try publishing again.');
  } else if (infoRes.status !== 404) { throw new Error('GitHub API error ' + infoRes.status); }

  const body = { message: 'Update puzzles.json', branch: GH_BRANCH,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2)))) };
  if (sha) body.sha = sha;

  const writeRes = await fetch(API_URL, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!writeRes.ok) {
    const e = await writeRes.json().catch(()=>({}));
    if (writeRes.status === 401 || writeRes.status === 403) {
      localStorage.removeItem('gh_pat');
      throw new Error('GitHub token rejected. Token cleared — try publishing again.');
    }
    throw new Error(e.message || 'GitHub write error ' + writeRes.status);
  }
}

async function _getTokenOrPrompt() {
  let token = ghGetToken();
  if (token) return token;
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    bg.innerHTML = `<div style="background:#fff;border-radius:10px;padding:24px;max-width:440px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.2)">
      <h3 style="font-size:16px;font-weight:700;color:#443366;margin-bottom:8px">GitHub token needed</h3>
      <p style="font-size:13px;color:#555;line-height:1.6;margin-bottom:12px">
        <strong>Get one:</strong><br>
        1. <a href="https://github.com/settings/tokens/new" target="_blank" style="color:#7744bb">github.com/settings/tokens/new</a><br>
        2. Name it, set No expiration, tick <strong>repo</strong>, Generate &amp; copy
      </p>
      <input id="_gh_tok" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #bbb;border-radius:5px;margin-bottom:10px">
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="_gh_cancel" style="padding:8px 16px;font-size:13px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer">Cancel</button>
        <button id="_gh_save" style="padding:8px 16px;font-size:13px;border:none;border-radius:5px;background:#7744bb;color:#fff;font-weight:600;cursor:pointer">Save &amp; continue</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    document.getElementById('_gh_save').onclick = () => {
      const val = document.getElementById('_gh_tok').value.trim();
      if (!val) { alert('Please paste your token.'); return; }
      ghSaveToken(val);
      document.body.removeChild(bg);
      resolve(val);
    };
    document.getElementById('_gh_cancel').onclick = () => { document.body.removeChild(bg); resolve(null); };
  });
}

async function cloudPublishPuzzle(title, data) {
  const token = await _getTokenOrPrompt();
  if (!token) return null;
  const list = await cloudGetPuzzles();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const entry = { id, title, publishedAt: new Date().toLocaleDateString('en-ZA'), publishedAtMs: Date.now(), rows: data.rows, cols: data.cols, data };
  const existing = list.findIndex(p => p.title === title);
  if (existing >= 0) { entry.id = list[existing].id; list[existing] = entry; } else list.unshift(entry);
  await _ghWrite(list, token);
  return entry.id;
}

async function cloudRemovePuzzle(id) {
  const token = await _getTokenOrPrompt();
  if (!token) return;
  const list = await cloudGetPuzzles();
  await _ghWrite(list.filter(p => p.id !== id), token);
}

async function cloudSavePuzzles(list) {
  const token = await _getTokenOrPrompt();
  if (!token) return;
  await _ghWrite(list, token);
}
