/* The traffic page keeps itself current: the live block re-reads every 12s so
 * the number visibly moves, while the charted history only changes when the
 * range does — a chart that twitches every few seconds reads as noise, not as
 * data. Range switching is plain links, so the page works with no JS at all. */
(function () {
  'use strict';
  var TICK_MS = 12000;
  var n = document.getElementById('px-live-n');
  if (!n) return;

  /* This client is shared with PASAR, whose shell always says lang="en" —
   * only the 1001 Indonesian shell (/id/stats) sets lang="id", so this flag
   * can never fire on a PASAR page. Strings must match what the server
   * rendered, or the first refresh visibly rewrites the page's language. */
  var ID = document.documentElement.lang === 'id';

  var nf = new Intl.NumberFormat('en-US');
  var dot = document.getElementById('px-live-dot');
  var list = document.getElementById('px-live-list');
  var total = document.getElementById('px-total-views');
  var grand = document.getElementById('px-total-all');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function paint(d) {
    n.textContent = nf.format(d.online || 0);
    if (dot) dot.classList.toggle('px-idle', !(d.online > 0));
    if (total) total.textContent = nf.format(d.views || 0);
    if (grand && d.all != null) grand.textContent = nf.format(d.all);
    if (!list) return;
    var pages = d.livePages || [];
    list.innerHTML = pages.length
      ? pages.map(function (p) {
        return '<div class="r"><code>' + esc(p.k || '/') + '</code><b>' + nf.format(p.n) + '</b></div>';
      }).join('')
      : '<div class="px-empty">' + (ID
        ? 'Tidak ada seorang pun di situs dalam lima menit terakhir.'
        : 'Nobody on the site in the last five minutes.') + '</div>';
  }

  /* A live number that quietly freezes is worse than one that admits it stopped:
   * without this the block keeps rendering its last value and the dot keeps
   * saying "live" while the figure goes minutes stale. */
  var fails = 0, timer = null;

  function stale(on) {
    if (dot) dot.classList.toggle('px-stale', on);
    if (n) n.title = on
      ? (ID ? 'Hitungan langsung tidak tersedia — menampilkan nilai terakhir yang diketahui'
        : 'Live count unavailable — showing the last known value')
      : '';
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function tick() {
    if (document.hidden) { schedule(TICK_MS); return; }
    fetch('/api/px/live', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d) { fails = 0; stale(false); paint(d); schedule(TICK_MS); return; }
        throw new Error('bad response');
      })
      .catch(function () {
        fails++;
        if (fails >= 2) stale(true);
        // back off to a minute so a rate-limited or wobbling server is not hammered
        schedule(Math.min(TICK_MS * Math.pow(2, fails), 60000));
      });
  }
  schedule(TICK_MS);
})();
