// github-storage.js
// Stores published puzzles as puzzles.json in your GitHub repo.
// GitHub Pages serves the file; the GitHub API writes it.
// All reads are unauthenticated (public repo). Only writes need the token.

const GH_CONFIG = {
  owner: 'arrow-word',          // your GitHub username / org
  repo:  'ArrowWord',           // your repo name
  branch: 'main',               // branch Netlify/Pages deploys from
  file:   'puzzles.json',       // file that stores all published puzzles
  // Raw URL for reading (no auth needed for public repos)
  rawBase: 'https://raw.githubusercontent.com/arrow-word/ArrowWord/main/',
};

// ── Read puzzles (no auth) ────────────────────────────────────────────────────
async function ghGetPuzzles() {
  const url = GH_CONFIG.rawBase + GH_CONFIG.file + '?cb=' + Date.now();
  const res = await fetch(url);
  if (res.status === 404) return [];          // file doesn't exist yet
  if (!res.ok) throw new Error('Failed to load puzzles (' + res.status + ')');
  return await res.json();
}

async function ghGetPuzzle(id) {
  const all = await ghGetPuzzles();
  return all.find(p => p.id === id) || null;
}

// ── Write puzzles (needs token) ───────────────────────────────────────────────
function ghGetToken() {
  return localStorage.getItem('gh_token') || '';
}

function ghSetToken(token) {
  localStorage.setItem('gh_token', token.trim());
}

// Get the current SHA of puzzles.json (needed to update it via GitHub API)
async function ghGetFileSHA(token) {
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}?ref=${GH_CONFIG.branch}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
  });
  if (res.status === 404) return null;  // file doesn't exist yet, that's fine
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'GitHub API error ' + res.status);
  }
  const data = await res.json();
  return data.sha;
}

async function ghSavePuzzles(list, token) {
  const sha = await ghGetFileSHA(token);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2))));
  const body = {
    message: 'Update puzzles.json',
    content,
    branch: GH_CONFIG.branch,
  };
  if (sha) body.sha = sha;  // required when updating an existing file
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'GitHub write error ' + res.status);
  }
  return true;
}

// ── Publish a puzzle ──────────────────────────────────────────────────────────
async function ghPublishPuzzle(title, data, token) {
  const list = await ghGetPuzzles();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const existing = list.findIndex(p => p.title === title);
  const entry = {
    id:          existing >= 0 ? list[existing].id : id,
    title,
    publishedAt: new Date().toLocaleDateString('en-ZA'),
    publishedAtMs: Date.now(),
    rows:        data.rows,
    cols:        data.cols,
    data,
  };
  if (existing >= 0) list[existing] = entry;
  else list.unshift(entry);
  await ghSavePuzzles(list, token);
  return entry.id;
}

// ── Remove a puzzle ───────────────────────────────────────────────────────────
async function ghRemovePuzzle(id, token) {
  const list = await ghGetPuzzles();
  const updated = list.filter(p => p.id !== id);
  await ghSavePuzzles(updated, token);
}

// ── Token prompt helper ───────────────────────────────────────────────────────
// Shows a small inline form to enter/save the token.
// resolves with the token string, or null if cancelled.
function ghPromptToken() {
  return new Promise((resolve) => {
    const existing = ghGetToken();
    if (existing) { resolve(existing); return; }

    // Build a modal
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    bg.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:24px;max-width:460px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.2)">
        <h3 style="font-size:16px;font-weight:700;color:#443366;margin-bottom:8px">🔑 GitHub Token required</h3>
        <p style="font-size:13px;color:#555;line-height:1.6;margin-bottom:12px">
          To publish puzzles to the web, a one-time GitHub token is needed. This is stored only in your browser.<br><br>
          <strong>How to get one (2 minutes):</strong><br>
          1. Go to <a href="https://github.com/settings/tokens/new" target="_blank" style="color:#7744bb">github.com/settings/tokens/new</a><br>
          2. Give it a name (e.g. "ArrowWord")<br>
          3. Set expiration to "No expiration"<br>
          4. Tick <strong>repo</strong> (the first checkbox under "Select scopes")<br>
          5. Click <strong>Generate token</strong> and paste it below
        </p>
        <input id="gh-token-input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #bbb;border-radius:5px;margin-bottom:10px">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="gh-token-cancel" style="padding:8px 16px;font-size:13px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer">Cancel</button>
          <button id="gh-token-save" style="padding:8px 16px;font-size:13px;border:none;border-radius:5px;background:#7744bb;color:#fff;font-weight:600;cursor:pointer">Save &amp; continue</button>
        </div>
        <p style="font-size:11px;color:#aaa;margin-top:8px">Your token is saved in your browser only and never sent anywhere except GitHub.</p>
      </div>`;
    document.body.appendChild(bg);

    document.getElementById('gh-token-save').onclick = () => {
      const val = document.getElementById('gh-token-input').value.trim();
      if (!val) { alert('Please paste your GitHub token.'); return; }
      ghSetToken(val);
      document.body.removeChild(bg);
      resolve(val);
    };
    document.getElementById('gh-token-cancel').onclick = () => {
      document.body.removeChild(bg);
      resolve(null);
    };
  });
}
