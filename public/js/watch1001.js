/* watch1001 — what readers look for on 1001startup.id (lib/watch1001.js).
 *
 * Every search box on the site filters in the page; this sends the words once
 * they settle (a pause in typing, Enter, leaving the box, or the home page's
 * search form going off), with which box it was, the page, and the count the
 * page shows when it shows one. Nothing else about the reader is sent. */
(function () {
  'use strict';
  var WAIT = 1500, URL_ = '/api/watch/search';
  var COUNT = { q: '#count', 'bm-q': '#bm-count', 'px-q': '#px-count', cq: '#count' };
  var last = {}, timers = {};
  var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'id' ? 'id' : 'en';

  function isBox(t) {
    return t && t.tagName === 'INPUT' && (t.type === 'search' || t.id === 'hq');
  }
  function keyOf(t) { return t.id || t.name || t.className || 'search'; }
  function countOf(t) {
    var sel = COUNT[t.id], c = sel ? document.querySelector(sel) : null;
    if (!c) {
      var box = t.closest('.tools, .bm-tools, .ch-tools, .toolbar, .filters, form');
      c = box ? box.querySelector('.count, .cnt, [id$="count"]') : null;
    }
    if (!c || c.offsetParent === null) return null;
    var m = /(\d[\d.,]*)/.exec(c.textContent || '');
    if (!m) return null;
    var n = parseInt(m[1].replace(/[.,]/g, ''), 10);
    return isFinite(n) ? n : null;
  }
  function send(t, now) {
    var k = keyOf(t), q = String(t.value || '').replace(/\s+/g, ' ').trim();
    clearTimeout(timers[k]);
    if (q.length < 2 || q === last[k]) return;
    last[k] = q;
    var body = JSON.stringify({ q: q.slice(0, 100), box: String(t.id || t.name || '').slice(0, 24), p: location.pathname, n: now ? null : countOf(t), l: lang });
    try {
      fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'same-origin' })
        .catch(function () { /* a lost search is fine */ });
    } catch (e) { /* old browser */ }
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!isBox(t) || e.isTrusted === false) return;
    var k = keyOf(t);
    clearTimeout(timers[k]);
    timers[k] = setTimeout(function () { send(t, false); }, WAIT);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && isBox(e.target)) setTimeout(function () { send(e.target, false); }, 300);
  }, true);
  document.addEventListener('change', function (e) { if (isBox(e.target)) send(e.target, false); }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target, t = f && f.querySelector && f.querySelector('input[type="search"], #hq');
    if (t) send(t, true);
  }, true);
})();
