/* Shared 1001startup.id header dropdowns (views/nav1001.js renders the markup).
 * CSS already opens panels on :hover / :focus-within; this file adds what CSS
 * cannot: pin-on-click (the only opener touch has), aria-expanded, Escape,
 * outside-click close, and the fixed-sheet top position on phones. */
(() => {
  'use strict';
  /* One-row phone header (views/nav1001.js renders .m1 + the Menu button
     while the four-dataset front page is live): the button opens the links
     as an in-flow sheet under the brand row; dropdowns inside it open as
     accordions instead of fixed sheets. */
  const hd = document.querySelector('.hd1001.m1');
  const mt = hd && hd.querySelector('.mtog');
  const setMenu = (open) => {
    if (!mt) return;
    hd.classList.toggle('mopen', open);
    mt.setAttribute('aria-expanded', String(open));
    const l = mt.querySelector('.mtl');
    if (l) l.textContent = open ? (mt.dataset.open || 'Close') : (mt.dataset.shut || 'Menu');
  };
  if (mt) mt.addEventListener('click', () => setMenu(!hd.classList.contains('mopen')));

  const dds = Array.from(document.querySelectorAll('.hd1001 .dd'));
  if (!dds.length) return;
  const phone = () => window.matchMedia('(max-width:700px)').matches;
  const sheet = () => !!hd && phone();   // links live in the in-flow sheet

  const sync = (d, open) => {
    d.classList.toggle('open', open);
    d.querySelector('.dd-b').setAttribute('aria-expanded', String(open));
  };
  const closeAll = (except) => dds.forEach((d) => { if (d !== except) sync(d, false); });

  dds.forEach((d) => {
    const b = d.querySelector('.dd-b');
    const p = d.querySelector('.dd-p');

    b.addEventListener('click', () => {
      const open = !d.classList.contains('open');
      closeAll(d);
      sync(d, open);
      // On phones the panel is position:fixed full-width; hang it under the
      // tapped button (the nav wraps, so the button's row varies).
      p.style.top = open && phone() && !sheet() ? Math.round(b.getBoundingClientRect().bottom + 10) + 'px' : '';
    });

    // Keyboard users open via :focus-within — keep aria in step with that.
    d.addEventListener('focusin', () => b.setAttribute('aria-expanded', 'true'));
    d.addEventListener('focusout', () => {
      if (!d.classList.contains('open')) b.setAttribute('aria-expanded', 'false');
    });

    // Following a link (often a same-page #anchor) must drop the pin.
    p.addEventListener('click', (e) => { if (e.target.closest('a')) { closeAll(); setMenu(false); } });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hd1001 .dd')) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const d = dds.find((x) => x.classList.contains('open') || x.contains(document.activeElement));
    if (!d) {
      if (hd && hd.classList.contains('mopen')) { setMenu(false); mt.focus(); }
      return;
    }
    closeAll();
    d.querySelector('.dd-b').focus();
  });
  // A fixed-position phone sheet goes stale the moment the page scrolls; the
  // in-flow menu sheet scrolls with the page, so its accordions stay open.
  window.addEventListener('scroll', () => { if (phone() && !sheet()) closeAll(); }, { passive: true });
  window.addEventListener('resize', () => closeAll());
})();
