/* /bumd (views/bumd1001.js): opens the folded section a link points at, and the company search.
   CSP script-src 'self', so this is the page's only script; the page reads fine without it. */
(function () {
  'use strict';
  function openTo(id) {
    var t = id && document.getElementById(id);
    if (!t) return;
    for (var n = t; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
    t.scrollIntoView({ block: 'start' });
  }
  function fromHash() { try { openTo(decodeURIComponent((location.hash || '').slice(1))); } catch (e) { /* bad hash */ } }
  /* in-page links into a closed group or province open it first, then jump */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    ev.preventDefault();
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed */ }
    openTo(id);
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();

  var q = document.getElementById('bd-q'), cnt = document.getElementById('bd-count');
  if (!q) return;
  var rows = Array.prototype.slice.call(document.querySelectorAll('#bd-provs .bd-co'));
  /* what a row is found by: its name, legal name, owners, sector and region (the region is the province heading) */
  var text = rows.map(function (r) {
    var p = r.closest('.bd-p'), h = p && p.querySelector('summary b');
    return ((r.querySelector('.nm') || r).textContent + ' ' + ((r.querySelector('.lg') || {}).textContent || '') + ' ' + ((r.querySelector('.ow') || {}).textContent || '') + ' ' + (h ? h.textContent : '')).toLowerCase();
  });
  var provs = Array.prototype.slice.call(document.querySelectorAll('#bd-provs .bd-p'));
  q.addEventListener('input', function () {
    var s = q.value.trim().toLowerCase(), shown = 0;
    rows.forEach(function (r, i) { r.hidden = !!s && text[i].indexOf(s) < 0; });
    provs.forEach(function (p) {
      var n = p.querySelectorAll('.bd-co:not([hidden])').length;
      shown += n;
      p.hidden = !!s && !n;
      if (s) p.open = n > 0 && n <= 40;
    });
    cnt.textContent = s ? shown + (shown === 1 ? ' company' : ' companies') : '';
  });
})();
