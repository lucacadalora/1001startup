/* PASAR profile — the radio dial.
 * Mechanics that matter for smoothness: the icons NEVER move when you
 * select. Only the wedge rotates (one GPU transform, shortest angular
 * path), and two icons swap opacity. Dragging rotates the whole ring.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var dataEl = $('pp-data');
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var links = DATA.links || [];

  /* ── platform marks ────────────────────────────────────────────── */
  var GLYPHS = {
    x: '<path d="M4 4l7.1 9.4L4.4 20h2.5l5.3-5.2L16.6 20H20l-7.4-9.8L18.9 4h-2.5l-4.8 4.7L8.4 4H4z"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="3.7" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="16.7" cy="7.3" r="1.25"/>',
    linkedin: '<rect x="4" y="9.6" width="3.2" height="10"/><circle cx="5.6" cy="6" r="1.8"/><path d="M10 9.6h3v1.5c.6-1 1.7-1.8 3.3-1.8 2.6 0 3.7 1.6 3.7 4.4v5.9h-3.2v-5.3c0-1.4-.5-2.3-1.7-2.3-1.1 0-1.9.8-1.9 2.3v5.3H10v-10z"/>',
    youtube: '<path d="M21 8.2c-.2-1.3-.9-2-2.2-2.2C16.9 5.7 12 5.7 12 5.7s-4.9 0-6.8.3C3.9 6.2 3.2 6.9 3 8.2 2.8 9.7 2.8 12 2.8 12s0 2.3.2 3.8c.2 1.3.9 2 2.2 2.2 1.9.3 6.8.3 6.8.3s4.9 0 6.8-.3c1.3-.2 2-.9 2.2-2.2.2-1.5.2-3.8.2-3.8s0-2.3-.2-3.8zM10 15V9l5.2 3L10 15z"/>',
    tiktok: '<path d="M15.5 4c.3 1.9 1.6 3.3 3.6 3.6v2.7c-1.4 0-2.6-.4-3.6-1.1v5.4c0 3-2 5-4.9 5-2.8 0-4.9-2-4.9-4.8 0-2.7 2-4.7 4.8-4.7.3 0 .7 0 1 .1v2.8c-.3-.1-.6-.2-1-.2-1.2 0-2.1.9-2.1 2.1 0 1.2.9 2.1 2.1 2.1 1.3 0 2.2-.9 2.2-2.3V4h2.8z"/>',
    whatsapp: '<path d="M12 3.5A8.5 8.5 0 0 0 4.6 16.2L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5zm0 1.8a6.7 6.7 0 1 1-3.4 12.5l-.4-.2-2.5.6.7-2.4-.3-.4A6.7 6.7 0 0 1 12 5.3zm-2.4 3c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3.2-.5s0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.8z"/>',
    github: '<path d="M12 3a9 9 0 0 0-2.9 17.6c.5.1.6-.2.6-.5v-1.7c-2.5.6-3-1.1-3-1.1-.4-1-1-1.3-1-1.3-.8-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.4 2.2 1 2.7.8.1-.6.3-1 .6-1.3-2-.2-4.1-1-4.1-4.5 0-1 .4-1.8 1-2.5-.1-.2-.4-1.2.1-2.4 0 0 .8-.2 2.5.9a8.7 8.7 0 0 1 4.6 0c1.7-1.2 2.5-.9 2.5-.9.5 1.2.2 2.2.1 2.4.6.7 1 1.5 1 2.5 0 3.5-2.1 4.2-4.1 4.4.3.3.6.8.6 1.7v2.5c0 .3.2.6.6.5A9 9 0 0 0 12 3z"/>',
    facebook: '<path d="M13.5 20v-6.5h2.2l.3-2.6h-2.5V9.3c0-.8.2-1.3 1.3-1.3h1.3V5.7c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.9H8.8v2.6H11V20h2.5z"/>',
    telegram: '<path d="M20 5.3 3.9 11.5c-.7.3-.7.8-.1 1l4.1 1.3 1.6 4.8c.2.5.5.6.9.3l2.3-2.1 4.2 3.1c.5.3.9.1 1-.5l2.6-12.6c.2-.8-.3-1.1-.9-.8zm-3.2 3.2-6.5 6-.3 2.6-1.3-4 8.1-4.6z"/>',
    vantis: '<path d="M3.6 4.5h4.2l3.3 8-1.5 3.6L3.6 4.5zM12.6 12.1l3.2-7.6h4.6L13.7 19.5h-3.4l-1.4-3.3 1.6-3.9z"/>',
    shop: '<path d="M6 8V6.8A6 6 0 0 1 12 3a6 6 0 0 1 6 3.8V8h1.5l.9 11.2c.1.9-.6 1.8-1.6 1.8H5.2c-1 0-1.7-.9-1.6-1.8L4.5 8H6zm2 0h8v-.9C15.6 5.6 14 4.8 12 4.8S8.4 5.6 8 7.1V8z"/>',
    globe: '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.8 12h16.4M12 3.8c2.3 2.3 3.4 5 3.4 8.2s-1.1 5.9-3.4 8.2c-2.3-2.3-3.4-5-3.4-8.2S9.7 6.1 12 3.8z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  };
  function brandOf(url, label) {
    var s = ((url || '') + ' ' + (label || '')).toLowerCase();
    if (/vantis/.test(s)) return 'vantis';
    if (/x\.com|twitter/.test(s)) return 'x';
    if (/instagram/.test(s)) return 'instagram';
    if (/linkedin/.test(s)) return 'linkedin';
    if (/youtube|youtu\.be/.test(s)) return 'youtube';
    if (/tiktok/.test(s)) return 'tiktok';
    if (/wa\.me|whatsapp/.test(s)) return 'whatsapp';
    if (/github/.test(s)) return 'github';
    if (/facebook|fb\.com/.test(s)) return 'facebook';
    if (/t\.me|telegram/.test(s)) return 'telegram';
    if (/shop|store|toko|order|menu|catalog|etsy|shopee|tokopedia/.test(s)) return 'shop';
    return null;
  }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function markHtml(url, label) {
    var b = brandOf(url, label);
    if (b) return '<svg viewBox="0 0 24 24" fill="currentColor">' + GLYPHS[b] + '</svg>';
    var ch = ((label || '?').trim().charAt(0) || '?').toUpperCase();
    return '<span class="mono">' + esc(ch) + '</span>';
  }

  /* list-mode icons */
  [].forEach.call(document.querySelectorAll('.pp-row-ico'), function (el) {
    el.innerHTML = markHtml(el.getAttribute('data-url'), el.getAttribute('data-label'));
  });

  /* ── the dial ──────────────────────────────────────────────────── */
  var dial = $('pp-dial'), wedge = $('pp-wedge'), iconWrap = $('pp-icons'), openBtn = $('pp-open');
  var n = links.length;
  var rot = 0;            // ring rotation (drag)
  var sel = 0;            // selected index
  var wedgeDeg = 0;       // accumulated angle so sweeps take the short way
  var moved = false;

  var icons = links.map(function (l, i) {
    var b = document.createElement('button');
    b.className = 'pp-ico';
    b.type = 'button';
    b.setAttribute('aria-label', l.label);
    b.innerHTML = markHtml(l.url, l.label);
    b.addEventListener('click', function () { select(i, true); });  // keyboard only
    iconWrap.appendChild(b);
    return b;
  });

  function angleOf(i) { return (i * 360) / n + rot; }   // 0deg = 12 o'clock

  function placeIcons() {
    var R = dial.clientWidth * 0.452;
    for (var i = 0; i < n; i++) {
      var a = angleOf(i) * Math.PI / 180;
      icons[i].style.transform =
        'translate(' + (Math.sin(a) * R).toFixed(1) + 'px,' + (-Math.cos(a) * R).toFixed(1) + 'px)' +
        (i === sel ? ' scale(1.14)' : '');
    }
  }
  function norm(d) { d = (d + 180) % 360; if (d < 0) d += 360; return d - 180; }
  function pointWedge(animate) {
    wedge.classList.toggle('sweep', !!animate);
    wedgeDeg += norm(angleOf(sel) - wedgeDeg);
    wedge.style.transform = 'rotate(' + wedgeDeg.toFixed(2) + 'deg)';
  }
  function select(i, animate) {
    sel = i;
    for (var k = 0; k < n; k++) icons[k].classList.toggle('on', k === i);
    placeIcons();
    pointWedge(animate);
    var l = links[i];
    openBtn.href = '/l/' + l.id;
    openBtn.innerHTML = markHtml(l.url, l.label) +
      '<span class="pp-open-label">Open ' + esc(l.label) + '</span><i class="arw">↗</i>';
  }

  /* ── pointer: the WHOLE dial is the control ──────────────────────
   * Tapping anywhere outside the QR selects the link in that direction,
   * so every entry has a huge wedge-shaped hit area. Dragging spins the
   * ring. Pointer capture is taken only once a real drag starts — taking
   * it on pointerdown retargets events away from children and kills taps.
   */
  var drag = null;
  function centreOf() {
    var r = dial.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }
  function angAt(e) {   // degrees, 0 = 3 o'clock, clockwise positive
    var c = centreOf();
    return Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI;
  }
  function radiusAt(e) {
    var c = centreOf();
    return Math.hypot(e.clientX - c.x, e.clientY - c.y);
  }
  function nearestTo(e) {          // index whose slot is closest to the pointer
    var target = angAt(e) + 90;    // convert to our 12-o'clock-zero convention
    var best = 0, bd = 1e9;
    for (var i = 0; i < n; i++) {
      var d = Math.abs(norm(angleOf(i) - target));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  var DEAD = 0.23;                 // ignore taps on the QR disc itself

  dial.addEventListener('pointerdown', function (e) {
    drag = { a0: angAt(e), rot0: rot, x: e.clientX, y: e.clientY, r: radiusAt(e) };
    moved = false;
  });
  dial.addEventListener('pointermove', function (e) {
    if (!drag) {                                    // hover preview
      if (e.pointerType === 'mouse' && radiusAt(e) > dial.clientWidth * DEAD) {
        var h = nearestTo(e);
        for (var k = 0; k < n; k++) icons[k].classList.toggle('hover', k === h && k !== sel);
      }
      return;
    }
    if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      moved = true;
      wedge.classList.remove('sweep');
      dial.setPointerCapture(e.pointerId);         // capture only for real drags
      dial.classList.add('dragging');
    }
    if (!moved) return;
    rot = drag.rot0 + (angAt(e) - drag.a0);
    placeIcons();
    pointWedge(false);
  });
  dial.addEventListener('pointerleave', function () {
    for (var k = 0; k < n; k++) icons[k].classList.remove('hover');
  });
  function endPointer(e) {
    if (!drag) return;
    var wasDrag = moved, r = drag.r;
    drag = null;
    dial.classList.remove('dragging');
    if (!wasDrag && r > dial.clientWidth * DEAD) select(nearestTo(e), true);
    moved = false;
  }
  dial.addEventListener('pointerup', endPointer);
  dial.addEventListener('pointercancel', function () { drag = null; moved = false; dial.classList.remove('dragging'); });

  /* keyboard: arrows step around the ring */
  dial.setAttribute('tabindex', '0');
  dial.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select((sel + 1) % n, true); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select((sel - 1 + n) % n, true); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { openBtn.click(); e.preventDefault(); }
  });

  new ResizeObserver(placeIcons).observe(dial);
  if (n) select(0, false);

  /* ── modes: QR / Links / Share ─────────────────────────────────── */
  var mQR = $('mode-qr'), mLink = $('mode-link'), mShare = $('mode-share');
  var listEl = $('pp-list');
  function setMode(qr) {
    dial.style.display = qr ? '' : 'none';
    listEl.hidden = qr;
    openBtn.style.display = qr ? '' : 'none';
    mQR.classList.toggle('on', qr);
    mLink.classList.toggle('on', !qr);
    if (qr) placeIcons();
  }
  mQR.addEventListener('click', function () { setMode(true); });
  mLink.addEventListener('click', function () { setMode(false); });
  mShare.addEventListener('click', function () {
    var url = mShare.getAttribute('data-url');
    if (navigator.share) { navigator.share({ title: DATA.name, url: url }).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(function () {
        var node = mShare.lastChild;
        var old = node.textContent;
        node.textContent = 'Copied';
        setTimeout(function () { node.textContent = old; }, 1600);
      })
      .catch(function () { window.prompt('Copy this link', url); });
  });

  /* ── background: falling code rain, in our own block language ──── */
  var cv = $('pp-rain');
  if (cv && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ctx = cv.getContext('2d');
    var cols = [], W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var CELL = 15;
    function sizeRain() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = [];
      for (var i = 0, c = Math.ceil(W / CELL); i < c; i++) {
        cols.push({ y: Math.random() * (H + 200) - 100, v: 30 + Math.random() * 55, len: 8 + (Math.random() * 14 | 0) });
      }
    }
    sizeRain();
    addEventListener('resize', sizeRain);
    var last = performance.now();
    requestAnimationFrame(function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        c.y += c.v * dt;
        if (c.y - c.len * CELL > H) { c.y = -Math.random() * 120; c.v = 26 + Math.random() * 46; }
        for (var j = 0; j < c.len; j++) {
          var y = c.y - j * CELL;
          if (y < -CELL || y > H) continue;
          ctx.fillStyle = 'rgba(255,255,255,' + ((1 - j / c.len) * 0.22).toFixed(3) + ')';
          var s = j === 0 ? 6 : 4;
          ctx.fillRect(i * CELL + (CELL - s) / 2, y, s, s);
        }
      }
      requestAnimationFrame(loop);
    });
  }
})();
