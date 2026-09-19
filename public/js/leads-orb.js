(function () {
  'use strict';
  /* The agent's face while it works.
   *
   * card.vantis.sh drives the `thinking-orbs` React package: a canvas of dots
   * that re-forms into a different arrangement for each pipeline state. This
   * app has no build step and no React, so this is a vanilla reimplementation
   * of the same BEHAVIOUR — a dot sphere that morphs between formations as the
   * run moves through its stages — not a port of that package's code.
   *
   * Why it exists at all: a seconds counter tells you time is passing, which is
   * the one thing the operator can already see. The formation changing on each
   * stage says the run is moving.
   *
   * Exposed as window.LeadsOrb = { mount, set, stop }.
   */

  var FORMATIONS = ['orbits', 'globe', 'web', 'ring'];

  /* Points on a sphere, evenly spread. Used as the base for every formation so
     dots travel a short distance when the arrangement changes. */
  function fib(n) {
    var pts = [];
    var off = 2 / n;
    var inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = i * off - 1 + off / 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var phi = i * inc;
      pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
    }
    return pts;
  }

  function target(kind, i, n, base) {
    var t = i / n;
    var b = base[i];
    if (kind === 'globe') return b;
    if (kind === 'ring') {
      var a = t * Math.PI * 2;
      return [Math.cos(a), 0, Math.sin(a)];
    }
    if (kind === 'orbits') {
      // three tilted rings — the "working" look
      var band = i % 3;
      var ang = (i / n) * Math.PI * 2 * 3;
      var tilt = (band - 1) * 0.6;
      var x = Math.cos(ang);
      var z = Math.sin(ang);
      return [x, Math.sin(ang) * Math.sin(tilt) * 0.9, z * Math.cos(tilt)];
    }
    // web: pull dots onto a coarse lattice so the connecting lines read
    var q = 0.5;
    return [Math.round(b[0] / q) * q, Math.round(b[1] / q) * q, Math.round(b[2] / q) * q];
  }

  function mount(el, opts) {
    opts = opts || {};
    var N = opts.count || 90;
    var size = opts.size || 96;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    var base = fib(N);
    var cur = base.map(function (p) { return [p[0], p[1], p[2]]; });
    var dst = base.map(function (p) { return [p[0], p[1], p[2]]; });
    var kind = 'globe';
    var rot = 0;
    var raf = null;
    var stopped = false;
    /* Respect the OS setting: a permanent animation is exactly the thing this
       preference exists to switch off. The orb still renders, it just holds. */
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setKind(k) {
      if (FORMATIONS.indexOf(k) < 0) k = 'globe';
      kind = k;
      for (var i = 0; i < N; i++) dst[i] = target(k, i, N, base);
    }
    setKind('globe');

    function frame() {
      if (stopped) return;
      rot += still ? 0 : (kind === 'ring' ? 0.004 : 0.011);
      var cx = size / 2;
      var cy = size / 2;
      var R = size * 0.33;
      ctx.clearRect(0, 0, size, size);

      var proj = [];
      for (var i = 0; i < N; i++) {
        // ease toward the formation rather than snapping
        cur[i][0] += (dst[i][0] - cur[i][0]) * 0.07;
        cur[i][1] += (dst[i][1] - cur[i][1]) * 0.07;
        cur[i][2] += (dst[i][2] - cur[i][2]) * 0.07;
        var x = cur[i][0], y = cur[i][1], z = cur[i][2];
        var xr = x * Math.cos(rot) - z * Math.sin(rot);
        var zr = x * Math.sin(rot) + z * Math.cos(rot);
        // depth gives the sphere its front and back
        var d = (zr + 1.6) / 2.6;
        proj.push({ x: cx + xr * R, y: cy + y * R, d: d });
      }

      if (kind === 'web') {
        ctx.lineWidth = 0.5;
        for (var a = 0; a < N; a += 2) {
          for (var b2 = a + 1; b2 < Math.min(a + 7, N); b2++) {
            var dx = proj[a].x - proj[b2].x;
            var dy = proj[a].y - proj[b2].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < size * 0.17) {
              ctx.strokeStyle = 'rgba(0,0,0,' + (0.11 * proj[a].d) + ')';
              ctx.beginPath();
              ctx.moveTo(proj[a].x, proj[a].y);
              ctx.lineTo(proj[b2].x, proj[b2].y);
              ctx.stroke();
            }
          }
        }
      }

      for (var k = 0; k < N; k++) {
        var p = proj[k];
        var rr = (kind === 'ring' ? 1.5 : 1.25) * (0.45 + p.d);
        ctx.fillStyle = 'rgba(0,0,0,' + (0.14 + p.d * 0.62) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = window.requestAnimationFrame(frame);
    }
    frame();

    return {
      set: setKind,
      stop: function () { stopped = true; if (raf) window.cancelAnimationFrame(raf); },
    };
  }

  window.LeadsOrb = { mount: mount, FORMATIONS: FORMATIONS };
})();
