/* 1001startup.id — click a company, get the company.
 *
 * The table used to send every click straight off-site to the company's own
 * homepage, which is the one place a census reader has already been. Now a row
 * opens the profile we actually hold — funding, round, investors, head office,
 * headcount, what we estimated and every source behind it — in a right-hand
 * drawer, with the website still one button away inside it.
 *
 * The drawer does NOT render the profile: it fetches the same server-rendered
 * card the standalone page uses (/company/<id>?panel=1), so the two can never
 * drift. Each row's name is a real <a href="/company/<id>">, so middle-click,
 * ctrl-click, "copy link" and a JS-less browser all still work — the drawer is
 * an enhancement over a page that already exists.
 *
 * Lives in a file because the CSP is script-src 'self'.
 */
(function () {
  var tbl = document.getElementById('tbl');
  if (!tbl || !tbl.tBodies.length) return;
  var body = tbl.tBodies[0];

  var cache = {};          // id -> card HTML, so re-opening is instant
  var wrap, scroll, posEl, prevBtn, nextBtn, closeBtn;
  var openId = null, openRow = null, lastFocus = null, pushed = 0, seq = 0;
  /* /id pages fetch the /id fragment and push /id URLs, so the drawer, the
     address bar and a copied link all stay in the reader's language */
  var PFX = location.pathname === '/id' || location.pathname.indexOf('/id/') === 0 ? '/id' : '';
  /* a table can name its own profile address (the exporter census on
     1001startup.id lives at /umkm/company/<id>, English only) */
  var BASE = tbl.getAttribute('data-base');
  if (BASE) PFX = '';
  else BASE = '/company/';
  var IDL = document.documentElement.lang === 'id';
  var T = IDL
    ? { prev: '&lsaquo; Sebelumnya', prevA: 'Perusahaan sebelumnya', next: 'Berikutnya &rsaquo;', nextA: 'Perusahaan berikutnya', close: 'Tutup', err: 'Profil ini gagal dimuat. ', open: 'Buka sebagai halaman' }
    : { prev: '&lsaquo; Prev', prevA: 'Previous company', next: 'Next &rsaquo;', nextA: 'Next company', close: 'Close', err: 'Could not load this profile. ', open: 'Open it as a page instead' };

  function build() {
    wrap = document.createElement('div');
    wrap.className = 'cpwrap';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="cpbd" data-close="1"></div>' +
      '<aside class="cpdr" role="dialog" aria-modal="true" aria-labelledby="cp-title" tabindex="-1">' +
        '<div class="cpbar">' +
          '<button type="button" class="cpstep" data-step="-1" aria-label="' + T.prevA + '">' + T.prev + '</button>' +
          '<button type="button" class="cpstep" data-step="1" aria-label="' + T.nextA + '">' + T.next + '</button>' +
          '<span class="cppos"></span>' +
          '<button type="button" class="cpx" data-close="1">' + T.close + '</button>' +
        '</div>' +
        '<div class="cpscroll"></div>' +
      '</aside>';
    document.body.appendChild(wrap);
    scroll = wrap.querySelector('.cpscroll');
    posEl = wrap.querySelector('.cppos');
    closeBtn = wrap.querySelector('.cpx');
    prevBtn = wrap.querySelector('[data-step="-1"]');
    nextBtn = wrap.querySelector('[data-step="1"]');

    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      var step = e.target.closest('[data-step]');
      if (step) { hop(+step.dataset.step); return; }
      /* a comparable company inside the card swaps the drawer in place */
      var sib = e.target.closest('a[data-cp]');
      if (sib) { e.preventDefault(); open(sib.dataset.cp, rowFor(sib.dataset.cp)); }
    });
  }

  /* The rows a reader can actually see right now: 1001.js hides everything the
     filters excluded and everything on another page, so Prev/Next walks the
     visible result in its current sort order — which is what the pager and the
     column headers just promised. */
  function shown() {
    return [].filter.call(body.rows, function (r) { return r.style.display !== 'none'; });
  }
  function rowFor(id) {
    return body.querySelector('tr[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }

  function mark(row) {
    [].forEach.call(body.querySelectorAll('tr.cp-open'), function (r) { r.classList.remove('cp-open'); });
    if (row) row.classList.add('cp-open');
  }

  function steps() {
    var list = shown(), i = openRow ? list.indexOf(openRow) : -1;
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i < 0 || i >= list.length - 1;
    posEl.textContent = i >= 0 ? (i + 1) + ' / ' + list.length : '';
  }

  function hop(d) {
    var list = shown(), i = openRow ? list.indexOf(openRow) : -1;
    var next = list[i + d];
    if (next) open(next.dataset.id, next);
  }

  function skeleton(name) {
    return '<div class="cp cp-load"><h2 class="cp-name" id="cp-title">' + (name || '') + '</h2>' +
      '<div class="cp-ln"></div><div class="cp-ln"></div><div class="cp-ln"></div></div>';
  }

  function open(id, row, replace) {
    if (!id) return;
    if (!wrap) build();
    var first = !openId;
    if (first) lastFocus = document.activeElement;
    openId = id; openRow = row || rowFor(id);
    mark(openRow);

    var name = openRow ? (openRow.cells[1].textContent || '').trim() : '';
    scroll.innerHTML = cache[id] || skeleton(name);
    scroll.scrollTop = 0;

    if (wrap.hidden) {
      wrap.hidden = false;
      document.body.classList.add('cplock');
      /* one frame before the transform flips, or the drawer just appears */
      requestAnimationFrame(function () { wrap.classList.add('on'); });
    }
    steps();
    closeBtn.focus();

    var url = PFX + BASE + encodeURIComponent(id);
    if (replace || (!first && pushed)) history.replaceState({ cp: id }, '', url);
    else { history.pushState({ cp: id }, '', url); pushed++; }

    if (cache[id]) return;
    var my = ++seq;
    fetch(url + '?panel=1', { headers: { Accept: 'text/html' }, credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        cache[id] = html;
        if (my === seq && openId === id) scroll.innerHTML = html;
      })
      .catch(function () {
        if (my !== seq || openId !== id) return;
        scroll.innerHTML = '<div class="cp-err">' + T.err +
          '<a href="' + url + '">' + T.open + '</a>.</div>';
      });
  }

  function close(fromPop) {
    if (!openId) return;
    openId = null;
    mark(null);
    wrap.classList.remove('on');
    document.body.classList.remove('cplock');
    var done = function () { if (!openId) wrap.hidden = true; };
    setTimeout(done, 220);
    if (!fromPop && pushed) { var n = pushed; pushed = 0; history.go(-n); }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    openRow = null;
  }

  /* Row click opens the drawer. A modified click on the name link is left to
     the browser — that is someone deliberately asking for a new tab. */
  body.addEventListener('click', function (e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a');
    if (a && !a.classList.contains('cp-link')) return;   // YC badge etc. keep their own behaviour
    var row = e.target.closest('tr[data-id]');
    if (!row || !body.contains(row)) return;
    e.preventDefault();
    open(row.dataset.id, row);
  });

  document.addEventListener('keydown', function (e) {
    if (!openId) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    /* horizontal only: Up/Down must keep scrolling the profile itself */
    else if (e.key === 'ArrowRight') { e.preventDefault(); hop(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); hop(-1); }
  });

  /* Back closes the drawer instead of leaving the census — the URL was ours */
  window.addEventListener('popstate', function (e) {
    var id = e.state && e.state.cp;
    if (id) { pushed = pushed || 1; open(id, rowFor(id), true); }
    else if (openId) { pushed = 0; close(true); }
  });

  /* Deep link: /company/<id> is a real page, but if the landing is reached with
     one in the hash (#c=<id>) or the row was linked from elsewhere on the page,
     open it without a round trip through the server-rendered page. */
  var h = /^#c=(.+)$/.exec(location.hash || '');
  if (h) open(decodeURIComponent(h[1]), null);
})();
