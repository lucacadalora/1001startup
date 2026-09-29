/* 1001startup.id /chain hub: search, relationship filter, sortable counts and
   whole-row links. A file, not inline: the site's CSP allows script-src 'self'. */
(() => {
  const tbl = document.querySelector('.chtbl');
  if (!tbl) return;
  const body = tbl.tBodies[0];
  const rows = [...body.rows];
  const orig = rows.slice();
  const q = document.querySelector('.ch-q');
  const cnt = document.querySelector('.ch-cnt');
  const btns = [...document.querySelectorAll('.ch-kn[data-k]')];
  const total = rows.length;
  const word = cnt ? cnt.textContent.replace(/^\d+\s*/, '') : '';
  let kind = null;
  const apply = () => {
    const t = ((q && q.value) || '').toLowerCase().trim();
    let n = 0;
    for (const r of rows) {
      const ok = (!t || (r.dataset.q || '').includes(t)) && (!kind || (r.dataset.k || '').split(' ').includes(kind));
      r.hidden = !ok;
      if (ok) n += 1;
    }
    if (cnt) cnt.textContent = n === total ? `${total} ${word}` : `${n} ${cnt.dataset.of} ${total} ${word}`;
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    kind = kind === b.dataset.k ? null : b.dataset.k;
    btns.forEach((x) => {
      const on = x.dataset.k === kind;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    apply();
  }));
  if (q) {
    q.addEventListener('input', apply);
    const pre = new URLSearchParams(location.search).get('q');
    if (pre) { q.value = pre; apply(); }
  }
  /* a count column sorts high-to-low, then low-to-high, then back to the ranking */
  tbl.querySelectorAll('th[data-s]').forEach((th) => th.addEventListener('click', () => {
    const i = Number(th.dataset.s);
    const cur = th.getAttribute('aria-sort');
    const next = cur === 'descending' ? 'ascending' : cur === 'ascending' ? 'none' : 'descending';
    tbl.querySelectorAll('th[data-s]').forEach((x) => x.setAttribute('aria-sort', 'none'));
    th.setAttribute('aria-sort', next);
    const val = (r) => parseInt(r.cells[i].textContent, 10) || 0;
    const list = next === 'none' ? orig
      : rows.slice().sort((a, b) => (next === 'descending' ? val(b) - val(a) : val(a) - val(b)));
    list.forEach((r) => body.appendChild(r));
  }));
  /* the whole row opens the company; the name stays the real link */
  body.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) return;
    const tr = ev.target.closest('tr');
    const a = tr && tr.querySelector('a[href]');
    if (a) location.href = a.href;
  });
})();
