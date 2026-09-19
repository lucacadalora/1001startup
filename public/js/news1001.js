/* THE WIRE (/news) client: filter chips + search + load-more over the
 * server-rendered feed (one renderer — this file only shows/hides), the
 * top-of-the-wire rail (arrows, index, auto-advance), and a poll that offers
 * a refresh pill when the pipeline publishes a newer census-news.json. */
(() => {
  'use strict';
  const feed = document.getElementById('feed');
  if (!feed) return;
  const rows = Array.from(feed.querySelectorAll('.nrow'));
  const days = Array.from(feed.querySelectorAll('.day'));
  const q = document.getElementById('q');
  const count = document.getElementById('count');
  const more = document.getElementById('more');
  const chips = Array.from(document.querySelectorAll('.toolbar .chip'));
  const PAGE = 40;
  let shown = PAGE;
  let filter = null; // type key, or 'signal'

  const match = (r) => {
    const kindFilters = ['signal', 'original'];
    if (kindFilters.includes(filter) && r.dataset.kind !== filter) return false;
    if (filter && !kindFilters.includes(filter) && r.dataset.type !== filter) return false;
    const needle = (q && q.value || '').trim().toLowerCase();
    if (needle && !(r.dataset.q || '').includes(needle)) return false;
    return true;
  };

  function draw() {
    const hits = rows.filter(match);
    const visible = new Set(hits.slice(0, shown));
    rows.forEach((r) => { r.style.display = visible.has(r) ? '' : 'none'; });
    days.forEach((d) => {
      const any = Array.from(d.querySelectorAll('.nrow')).some((r) => visible.has(r));
      d.style.display = any ? '' : 'none';
    });
    if (count) {
      var IDL = document.documentElement.lang === 'id';
      count.textContent = hits.length === rows.length
        ? `${rows.length}${IDL ? ' berita' : ' items'}`
        : `${hits.length}${IDL ? ' dari ' : ' of '}${rows.length}`;
    }
    if (more) more.hidden = hits.length <= shown;
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    const f = c.dataset.f;
    filter = filter === f ? null : f;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === filter)));
    shown = PAGE;
    draw();
  }));
  if (q) {
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { shown = PAGE; draw(); }, 120); });
  }
  if (more) more.addEventListener('click', () => { shown += PAGE; draw(); });
  draw();

  // Top-of-the-wire carousel: the rail is clipped to the content column and
  // cards tile to exact fractions of it, so a "page" is always whole cards
  // flush to both margins (Luca, Aug 30: "fix the margin, that should be
  // carousel" — the old scroller ran cards under the page margin and chopped
  // them at the viewport edge). Arrows and the index move by PAGE, not by one
  // card. Geometry is read from the DOM, so the CSS breakpoints own how many
  // cards a page holds and this file never has to know.
  const rail = document.getElementById('rail');
  if (rail) {
    const cards = Array.from(rail.querySelectorAll('.rcard'));
    const idxEl = document.getElementById('railidx');
    const n = cards.length;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pos = (i) => cards[i].offsetLeft - cards[0].offsetLeft;
    // Gap and card width straight from layout — survives every breakpoint.
    const gap = () => (n > 1 ? Math.max(0, pos(1) - cards[0].offsetWidth) : 0);
    const per = () => {
      const w = cards[0].offsetWidth + gap();
      return w > 0 ? Math.max(1, Math.min(n, Math.round((rail.clientWidth + gap()) / w))) : 1;
    };
    const pages = () => Math.ceil(n / per());
    const maxScroll = () => Math.max(0, rail.scrollWidth - rail.clientWidth);
    const page = () => {
      // At the scroll end the last page is short, so nearest-card would report
      // the second-to-last page forever — pin it.
      if (rail.scrollLeft >= maxScroll() - 2) return pages() - 1;
      let best = 0;
      for (let i = 1; i < n; i++) {
        if (Math.abs(pos(i) - rail.scrollLeft) < Math.abs(pos(best) - rail.scrollLeft)) best = i;
      }
      return Math.min(pages() - 1, Math.floor(best / per()));
    };
    const pad2 = (x) => String(x).padStart(2, '0');
    const show = () => { if (idxEl) idxEl.textContent = `${pad2(page() + 1)} / ${pad2(pages())}`; };
    const goPage = (p) => {
      const total = pages();
      const t = ((p % total) + total) % total;
      rail.scrollTo({ left: Math.min(pos(Math.min(t * per(), n - 1)), maxScroll()),
                      behavior: reduced ? 'auto' : 'smooth' });
    };

    let auto = !reduced && n > 1;
    let hold = false;
    let inview = true;
    const stop = () => { auto = false; };
    const prev = document.getElementById('rprev');
    const next = document.getElementById('rnext');
    if (prev) prev.addEventListener('click', () => { stop(); goPage(page() - 1); });
    if (next) next.addEventListener('click', () => { stop(); goPage(page() + 1); });
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) =>
      rail.addEventListener(ev, stop, { passive: true }));
    rail.addEventListener('pointerenter', () => { hold = true; });
    rail.addEventListener('pointerleave', () => { hold = false; });
    rail.addEventListener('focusin', () => { hold = true; });
    rail.addEventListener('focusout', () => { hold = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { inview = es[0].isIntersecting; }).observe(rail);
    }
    let raf;
    rail.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(show);
    }, { passive: true });
    // A breakpoint change repages the carousel: re-snap to the current page's
    // first card so a resize never leaves it parked mid-page.
    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        rail.scrollTo({ left: Math.min(pos(Math.min(page() * per(), n - 1)), maxScroll()), behavior: 'auto' });
        show();
      }, 150);
    }, { passive: true });
    if (auto) {
      setInterval(() => {
        if (!auto || hold || !inview || document.hidden) return;
        const at = page();
        goPage(at >= pages() - 1 ? 0 : at + 1);
      }, 6000);
    }
    show();
  }

  // Refresh pill when the pipeline has published since this render.
  const pill = document.getElementById('newpill');
  const stamp = (document.querySelector('.pmeta') || {}).textContent || '';
  let generated = null;
  const poll = async () => {
    try {
      const r = await fetch('/data/census-news.json', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      if (generated === null) { generated = d.generated; return; }
      if (d.generated !== generated && pill) pill.classList.add('show');
    } catch { /* offline — try again next tick */ }
  };
  poll();
  setInterval(poll, 5 * 60 * 1000);
  if (pill) pill.addEventListener('click', () => location.reload());
  void stamp;
})();
