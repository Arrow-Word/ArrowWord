// site-banner.js — v27
// Shows a "TEST SITE" banner automatically when a page is opened from the
// staging address (…/Arrow-Staging/…). On the live site it does nothing.
// The same file and the same pages are used on both sites.
// v27 - First version.
(function () {
  if (!/\/arrow-staging(\/|$)/i.test(location.pathname)) return;

  function show() {
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

  function start() {
    show();
    markTitle();
    var titleEl = document.querySelector('title');
    if (titleEl && window.MutationObserver) {
      new MutationObserver(markTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
