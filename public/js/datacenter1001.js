/* 1001startup.id/data-center — project list: search, region chips, matrix-cell filter,
   size sort, and jumps from the matrix that open the project they land on.
   A file of its own because the CSP is script-src 'self'. */
(function () {
  'use strict';
  var list = document.getElementById('dc-list');
  if (!list) return;
  var rows = [].slice.call(list.querySelectorAll('details.pr'));
  var q = document.getElementById('dc-q');
  var sel = document.getElementById('dc-cell');
  var count = document.getElementById('dc-count');
  var chips = [].slice.call(document.querySelectorAll('.tools .chip[data-region]'));
  var region = 'all';
  var sortDir = 0; // 0 = page order, 1 = largest first, -1 = smallest first
  var order = rows.slice();

  function apply() {
    var term = (q && q.value || '').trim().toLowerCase();
    var cell = sel ? sel.value : 'all';
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (region === 'all' || r.dataset.region === region) &&
        (cell === 'all' || r.dataset.cell === cell) &&
        (!term || (r.dataset.name || '').indexOf(term) >= 0);
      r.hidden = !ok;
      if (ok) shown++;
    });
    if (count) count.textContent = shown + ' of ' + rows.length;
  }
  function setRegion(k) {
    region = k;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.region === k)); });
    apply();
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { setRegion(c.dataset.region); }); });
  if (q) q.addEventListener('input', apply);
  if (sel) sel.addEventListener('change', apply);

  var sortBtn = list.querySelector('.phd [data-sort="size"]');
  if (sortBtn) sortBtn.addEventListener('click', function () {
    sortDir = sortDir === 1 ? -1 : (sortDir === -1 ? 0 : 1);
    var sorted = sortDir === 0 ? order.slice() : rows.slice().sort(function (a, b) {
      return (Number(b.dataset.size) - Number(a.dataset.size)) * sortDir;
    });
    var frag = document.createDocumentFragment();
    sorted.forEach(function (r) { frag.appendChild(r); });
    list.appendChild(frag);
    sortBtn.textContent = sortDir === 1 ? 'Size ↓' : (sortDir === -1 ? 'Size ↑' : 'Size');
  });

  function reveal(id) {
    var el = document.getElementById(id);
    if (!el || !el.classList.contains('pr')) return;
    if (el.hidden) { if (q) q.value = ''; if (sel) sel.value = 'all'; setRegion('all'); }
    el.open = true;
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1600);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('a') : null;
    if (!t) return;
    var href = t.getAttribute('href') || '';
    if (href.indexOf('#p-') === 0) reveal(href.slice(1));
    else if (href === '#projects' && t.dataset.cell && sel) {
      if (q) q.value = '';
      sel.value = t.dataset.cell;
      setRegion('all');
    }
  });
  if (location.hash.indexOf('#p-') === 0) reveal(location.hash.slice(1));
  apply();
})();
