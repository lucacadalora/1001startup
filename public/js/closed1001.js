/* Filtering for the shutdown register. Lives in a file because the app's CSP is
   script-src 'self' — an inline <script> here is silently dropped. */
(function () {
  'use strict';
  var q = document.getElementById('cq');
  var tbl = document.getElementById('ctbl');
  if (!tbl) return;
  var rows = [].slice.call(tbl.tBodies[0].rows);
  var count = document.getElementById('ccount');
  var chips = document.getElementById('cchips');
  var fate = '';

  function apply() {
    var needle = (q && q.value || '').trim().toLowerCase();
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var okF = !fate || r.getAttribute('data-fate') === fate;
      var okQ = !needle || (r.getAttribute('data-f') || '').indexOf(needle) !== -1;
      var show = okF && okQ;
      r.style.display = show ? '' : 'none';
      if (show) n++;
    }
    if (count) count.textContent = n + (document.documentElement.lang === 'id' ? ' ditampilkan' : ' shown');
  }

  if (q) q.addEventListener('input', apply);
  if (chips) chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    fate = b.getAttribute('data-fate') || '';
    [].forEach.call(chips.querySelectorAll('.chip'), function (c) { c.classList.toggle('on', c === b); });
    apply();
  });
})();
