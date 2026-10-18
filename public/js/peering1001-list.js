/* 1001startup.id /peering — the two lists under the map: find, filter, and
   "Show on the map" (handed to the map module as a pm:show event). */
(function () {
  'use strict';
  function wire(listId, qId, countId, chipSel) {
    var list = document.getElementById(listId);
    if (!list) return;
    var rows = Array.prototype.slice.call(list.querySelectorAll('.fr'));
    var q = document.getElementById(qId);
    var count = document.getElementById(countId);
    var grey = 'all';
    function run() {
      var t = (q && q.value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var ok = (!t || r.getAttribute('data-q').indexOf(t) !== -1) && (grey === 'all' || r.getAttribute('data-grey') === grey);
        r.hidden = !ok;
        if (ok) shown++;
      });
      if (count) count.textContent = shown === rows.length ? rows.length + ' rows' : shown + ' of ' + rows.length;
    }
    if (q) q.addEventListener('input', run);
    if (chipSel) {
      var chips = Array.prototype.slice.call(document.querySelectorAll(chipSel));
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          grey = c.getAttribute('data-g');
          chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
          run();
        });
      });
    }
    run();
  }
  wire('pf-list', 'pf-q', 'pf-count', '.tools .chip[data-g]');
  wire('px-list', 'px-q', 'px-count', null);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-show]');
    if (!b) return;
    e.preventDefault();
    var map = document.getElementById('map');
    if (map) map.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.dispatchEvent(new CustomEvent('pm:show', { detail: { place: b.getAttribute('data-show'), mode: b.getAttribute('data-mode') || 'dc' } }));
  });
})();
