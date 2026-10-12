// site-banner.js — v33
// Loaded by every page. Does two things:
//  1. TEST SITE banner: shown automatically when a page is opened from the
//     staging address (…/Arrow-Staging/…). On the live site it does nothing.
//  2. Version badge: a small version number in the bottom-right corner of
//     every page, read from the page's <meta name="aw-version">. Click it to
//     see the versions of the shared files too, and to check whether a newer
//     copy of the page has been uploaded (i.e. whether you are on a stale page).
// The same file and the same pages are used on both sites.
// v33 - Added the version badge.
// v27 - First version (TEST SITE banner).
(window.AW_FILES = window.AW_FILES || {})['site-banner.js'] = 'v33';

(function () {
  var isStaging = /\/arrow-staging(\/|$)/i.test(location.pathname);

  function pageVersion(doc) {
    var m = (doc || document).querySelector('meta[name="aw-version"]');
    return m ? m.getAttribute('content') : '?';
  }
  function pageName() {
    var p = location.pathname.split('/').pop();
    return p || 'index.html';
  }

  // ── TEST SITE banner (staging only) ─────────────────────────────────────────
  function showBanner() {
    if (document.getElementById('site-test-banner')) return;
    var style = document.createElement('style');
    style.textContent =
      '#site-test-banner{box-sizing:border-box;width:100%;padding:8px 12px;background:#fff0bd;color:#4e3c00;' +
      'border-bottom:2px solid #d8b94d;text-align:center;font:600 13px/1.35 Arial,sans-serif}' +
      '#site-test-tag{position:fixed;left:8px;bottom:8px;z-index:9999;padding:4px 10px;border-radius:12px;' +
      'background:#fff0bd;color:#4e3c00;border:1px solid #d8b94d;font:700 11px/1.2 Arial,sans-serif;' +
      'opacity:.9;pointer-events:none}' +
      '@media print{#site-test-banner,#site-test-tag{display:none!important}}';
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'site-test-banner';
    bar.setAttribute('role', 'status');
    bar.textContent = '⚠ TEST SITE — this is the staging copy. It uses the LIVE puzzle database, so publishing, editing and deleting here are real.';
    document.body.insertBefore(bar, document.body.firstChild);

    var tag = document.createElement('div');
    tag.id = 'site-test-tag';
    tag.textContent = 'TEST SITE';
    document.body.appendChild(tag);
  }

  // Mark the browser tab too, and keep the mark if a page changes its title.
  function markTitle() {
    if (document.title.indexOf('[TEST] ') !== 0) document.title = '[TEST] ' + document.title;
  }

  // ── Version badge (every page, both sites) ──────────────────────────────────
  function showVersion() {
    if (document.getElementById('aw-version')) return;
    var style = document.createElement('style');
    style.textContent =
      '#aw-version{position:fixed;right:8px;bottom:8px;z-index:9998;max-width:calc(100vw - 16px);box-sizing:border-box;' +
      'font:11px/1.4 Arial,sans-serif;color:#665588;background:rgba(255,255,255,.88);border:1px solid #d8cdea;' +
      'border-radius:10px;padding:2px 8px;cursor:pointer;user-select:none;box-shadow:0 1px 4px rgba(68,51,102,.12)}' +
      '#aw-version:hover{background:#fff}' +
      '#aw-version .aw-v-details{display:none;margin:4px 0 2px;cursor:default}' +
      '#aw-version.open{padding:8px 10px;border-radius:8px}' +
      '#aw-version.open .aw-v-details{display:block}' +
      '#aw-version table{border-collapse:collapse;margin:2px 0 6px}' +
      '#aw-version td{padding:1px 10px 1px 0;white-space:nowrap}' +
      '#aw-version td+td{font-weight:700;padding-right:0}' +
      '#aw-version button{font:11px Arial,sans-serif;border:1px solid #b9a6dc;background:#f5f0ff;color:#443366;border-radius:6px;padding:3px 8px;cursor:pointer}' +
      '#aw-version .aw-v-result{margin-top:5px;max-width:260px;white-space:normal}' +
      '#aw-version.stale{background:#fff3cd;border-color:#e0b84a;color:#664d03}' +
      '@media print{#aw-version{display:none!important}}';
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.id = 'aw-version';
    box.setAttribute('title', 'Version of this page. Click for details.');
    box.innerHTML = '<span class="aw-v-short"></span><div class="aw-v-details"></div>';
    var short = box.querySelector('.aw-v-short');
    var details = box.querySelector('.aw-v-details');
    var version = pageVersion();
    short.textContent = version;
    document.body.appendChild(box);

    function sharedFiles() {
      var files = {};
      var known = window.AW_FILES || {};
      Object.keys(known).forEach(function (k) { if (k !== 'site-banner.js') files[k] = known[k]; });
      try {
        var css = getComputedStyle(document.documentElement).getPropertyValue('--aw-grid-core-css').trim().replace(/['"]/g, '');
        if (css) files['grid-core.css'] = css;
      } catch (e) {}
      files['site-banner.js'] = known['site-banner.js'];
      return files;
    }

    function renderDetails() {
      var rows = '<tr><td>' + pageName() + '</td><td>' + version + '</td></tr>';
      var files = sharedFiles();
      Object.keys(files).sort().forEach(function (k) { rows += '<tr><td>' + k + '</td><td>' + files[k] + '</td></tr>'; });
      details.innerHTML = '<div style="font-weight:700;margin-bottom:3px">' + (isStaging ? 'TEST SITE' : 'Live site') + '</div>' +
        '<table>' + rows + '</table>' +
        '<button type="button" class="aw-v-check">Check for a newer version</button>' +
        '<div class="aw-v-result"></div>';
    }

    // Asks the website for the current copy of this page (not the browser's
    // saved copy) and compares its version with the one showing.
    function checkLatest(resultEl) {
      resultEl.textContent = 'Checking…';
      var url = location.pathname + '?aw-version-check=' + Date.now();
      fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('the site answered ' + r.status);
        return r.text();
      }).then(function (html) {
        var m = html.match(/<meta\s+name=["']aw-version["']\s+content=["']([^"']+)["']/i);
        var latest = m ? m[1] : null;
        if (!latest) { resultEl.textContent = 'Could not find a version number in the uploaded page.'; return; }
        if (latest === version) {
          box.classList.remove('stale');
          resultEl.textContent = '✓ Up to date: the uploaded page is also ' + latest + '.';
        } else {
          box.classList.add('stale');
          short.textContent = version + ' → ' + latest + ' available';
          resultEl.innerHTML = 'The uploaded page is <strong>' + latest + '</strong>, but you are seeing <strong>' + version + '</strong>. Press Ctrl+F5 (or pull down to refresh on a phone) to load it. GitHub can take a few minutes to publish a new upload.';
        }
      }).catch(function (e) {
        resultEl.textContent = 'Could not check just now (' + (e && e.message || e) + ').';
      });
    }

    box.addEventListener('click', function (e) {
      if (e.target.closest('.aw-v-check')) { checkLatest(details.querySelector('.aw-v-result')); return; }
      if (e.target.closest('.aw-v-details')) return;
      if (box.classList.toggle('open')) renderDetails();
    });
  }

  function start() {
    if (isStaging) {
      showBanner();
      markTitle();
      var titleEl = document.querySelector('title');
      if (titleEl && window.MutationObserver) {
        new MutationObserver(markTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
      }
    }
    showVersion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
