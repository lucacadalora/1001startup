/* 1001startup.id front page — one search box across the four datasets.
 *
 * Reads /data/search-index.json once (names, sectors and places only — the
 * same words every public table already prints; the gated working files are
 * never touched) and filters it in the browser as you type. Results come back
 * grouped by dataset, at most a few each, every one a link to the page that
 * holds that company. Arrow keys move, Enter opens, Escape closes. Without JS
 * the form still works: it submits to the startup table with ?q=.
 *
 * Also forwards the old front page's table anchor: links to /#companies (the
 * census used to live on /) land on /startups.
 *
 * Lives in a file because the CSP is script-src 'self'.
 */
(function () {
  'use strict';
  var PFX = location.pathname === '/id' || location.pathname.indexOf('/id/') === 0 ? '/id' : '';
  if (location.hash === '#companies') { location.replace(PFX + '/startups'); return; }

  var form = document.getElementById('hs'), input = document.getElementById('hq'), box = document.getElementById('hres');
  if (!form || !input || !box) return;
  /* the long placeholder is cut off on a phone; it gets the short one */
  if (input.dataset.short && window.matchMedia('(max-width:640px)').matches) input.placeholder = input.dataset.short;
  var IDL = document.documentElement.lang === 'id';
  var G = IDL
    ? { s: 'Startup', b: 'BUMN', r: 'BUMD', d: 'Pusat data', e: 'Eksportir (UMKM)', none: 'Belum ada perusahaan yang cocok dengan', miss: 'Ada perusahaan yang terlewat? Kabari kami', allS: 'Semua startup yang cocok', allE: 'Semua eksportir yang cocok', load: 'Memuat…', err: 'Pencarian belum bisa dimuat. Coba lagi sebentar.' }
    : { s: 'Startups', b: 'State companies (BUMN)', r: 'Regional state companies (BUMD)', d: 'Data centres', e: 'Exporters (UMKM)', none: 'No company matches', miss: 'Missing a company? Tell us', allS: 'All matching startups', allE: 'All matching exporters', load: 'Loading…', err: 'Search could not load. Try again in a moment.' };
  var COLOR = { s: '#E8734B', b: '#F3C64B', r: '#C99A2E', d: '#7AB88A', p: '#7AB88A', e: '#4E7A96' };
  var ORDER = ['s', 'b', 'r', 'd', 'e'];  /* r = regional state companies, only in the index while /bumd is on */
  var PER = { s: 5, b: 3, r: 3, d: 4, e: 4 };

  var data = null, loading = null, active = -1, links = [];

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* highlight the first occurrence of the query inside the name */
  function mark(name, q) {
    var n = name.toLowerCase(), i = q ? n.indexOf(q.toLowerCase()) : -1;
    if (i < 0) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = fetch('/data/search-index.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        data = (j.r || []).map(function (r, i) {
          return { name: r[0], k: r[1], sub: r[2] || '', url: r[3], logo: r[4] || '', i: i,
            n: norm(r[0]), x: norm(r[0] + ' ' + (r[2] || '') + ' ' + (r[5] || '')) };
        });
        return data;
      })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function href(r) {
    /* startups and exporters arrive as bare ids (the index stays small);
       only the startup census has Indonesian pages, the others are English */
    if (r.url.charAt(0) === '/') return r.url;
    return r.k === 's' ? PFX + '/company/' + r.url : '/umkm/company/' + r.url;
  }

  function search(q) {
    var qn = norm(q);
    if (!qn) return null;
    var toks = qn.split(' ');
    var hits = [];
    for (var j = 0; j < data.length; j++) {
      var r = data[j], ok = true;
      for (var t = 0; t < toks.length; t++) if (r.x.indexOf(toks[t]) < 0) { ok = false; break; }
      if (!ok) continue;
      var sc = r.n.indexOf(qn) === 0 ? 100 : (' ' + r.n).indexOf(' ' + qn) >= 0 ? 70 : r.n.indexOf(qn) >= 0 ? 50 : 20;
      hits.push({ r: r, sc: sc });
    }
    hits.sort(function (a, b) { return b.sc - a.sc || a.r.i - b.r.i; });
    var groups = { s: [], b: [], d: [], e: [] }, total = { s: 0, b: 0, d: 0, e: 0 };
    hits.forEach(function (h) {
      var g = h.r.k === 'p' ? 'd' : h.r.k;
      if (!groups[g]) return;
      total[g]++;
      if (groups[g].length < PER[g]) groups[g].push(h);
    });
    /* the group holding the best match goes first */
    var order = ORDER.slice().sort(function (a, b) {
      var A = groups[a][0], B = groups[b][0];
      if (!A || !B) return (B ? 1 : 0) - (A ? 1 : 0);
      return B.sc - A.sc || ORDER.indexOf(a) - ORDER.indexOf(b);
    });
    return { q: q.trim(), groups: groups, total: total, order: order, n: hits.length };
  }

  function render(res) {
    if (!res) { close(); return; }
    var html = '';
    res.order.forEach(function (g) {
      var list = res.groups[g];
      if (!list.length) return;
      html += '<div class="rg" style="--dc:' + COLOR[g] + '"><i aria-hidden="true"></i>' + G[g] +
        (res.total[g] > list.length ? ' · ' + res.total[g] : '') + '</div>';
      list.forEach(function (h) {
        var r = h.r;
        html += '<a role="option" aria-selected="false" href="' + esc(href(r)) + '" style="--dc:' + COLOR[r.k] + '">' +
          (r.logo ? '<img src="' + esc(r.logo) + '" alt="" width="26" height="26" loading="lazy">' : '<span class="ph" aria-hidden="true"></span>') +
          '<span><b>' + mark(r.name, res.q) + '</b>' + (r.sub ? '<em>' + esc(r.sub) + '</em>' : '') + '</span></a>';
      });
      if (g === 's' && res.total.s > list.length) html += '<a class="more" href="' + PFX + '/startups?q=' + encodeURIComponent(res.q) + '">' + G.allS + ' (' + res.total.s + ') →</a>';
      if (g === 'e' && res.total.e > list.length) html += '<a class="more" href="/umkm?q=' + encodeURIComponent(res.q) + '">' + G.allE + ' (' + res.total.e + ') →</a>';
    });
    if (!res.n) {
      html = '<div class="none">' + G.none + ' “' + esc(res.q) + '”. <a href="' + PFX + '/about" style="display:inline;padding:0;text-decoration:underline">' + G.miss + '</a>.</div>';
    }
    box.innerHTML = html;
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    links = [].slice.call(box.querySelectorAll('a[role="option"]'));
    active = -1;
  }

  function close() {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  }

  function move(d) {
    if (!links.length) return;
    if (active >= 0) links[active].setAttribute('aria-selected', 'false');
    active = (active + d + links.length) % links.length;
    links[active].setAttribute('aria-selected', 'true');
    links[active].scrollIntoView({ block: 'nearest' });
  }

  var seq = 0;
  function update() {
    var q = input.value, my = ++seq;
    if (!norm(q)) { close(); return; }
    if (!data) { box.innerHTML = '<div class="none">' + G.load + '</div>'; box.hidden = false; }
    load().then(function () { if (my === seq) render(search(q)); })
      .catch(function () { if (my === seq) { box.innerHTML = '<div class="none">' + G.err + '</div>'; box.hidden = false; } });
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', function () { load().catch(function () {}); if (norm(input.value)) update(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (box.hidden) update(); else move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') { if (!box.hidden) { e.preventDefault(); close(); } }
  });
  form.addEventListener('submit', function (e) {
    /* Enter opens the highlighted result, or the best one; with nothing
       matched the form goes on to the startup table's own search */
    var go = active >= 0 ? links[active] : links[0];
    if (go && !box.hidden) { e.preventDefault(); location.href = go.getAttribute('href'); }
  });
  document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
})();
