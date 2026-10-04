/* px — the heartbeat behind the "online" number, plus the badge it feeds.
 *
 * The server counts the page view on its own; this file exists only so that
 * "online" means "still here" rather than "loaded a page in the last five
 * minutes". A closed tab stops beating and falls out of the window by itself,
 * which is what keeps the number honest with no cleanup and no cookie. */
(function () {
  'use strict';
  var BEAT_MS = 45000;          // comfortably inside the server's 5-minute window
  var badges = document.querySelectorAll('[data-px-badge]');

  var nf = new Intl.NumberFormat('en-US');
  var timer = null;

  function paint(d) {
    for (var i = 0; i < badges.length; i++) {
      var b = badges[i];
      var on = b.querySelector('[data-px-online]');
      var vw = b.querySelector('[data-px-views]');
      var dot = b.querySelector('.px-dot');
      if (on) on.textContent = nf.format(d.online || 0);
      if (vw) vw.textContent = nf.format(d.views || 0);
      if (dot) dot.classList.toggle('px-idle', !(d.online > 0));
    }
  }

  /* A person shows up as a person: the first trusted tap, click, wheel turn or
   * key press (or a real mouse movement) is reported once, with a beat sent
   * straight away. Until then the server counts the visit as an unconfirmed page
   * load, which keeps scrapers that run this page's JavaScript out of the
   * public numbers. Nothing about the event itself is sent: only that it happened. */
  var engaged = false, moved = 0;
  var EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  function engage(e) {
    if (engaged || (e && e.isTrusted === false)) return;
    engaged = true;
    for (var i = 0; i < EVENTS.length; i++) removeEventListener(EVENTS[i], engage, true);
    removeEventListener('mousemove', onMove, true);
    lastBeat = Date.now();
    beat();
  }
  function onMove(e) {
    if (!e.isTrusted) return;
    moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    if (moved > 40) engage(e);
  }
  for (var j = 0; j < EVENTS.length; j++) addEventListener(EVENTS[j], engage, { capture: true, passive: true });
  addEventListener('mousemove', onMove, { capture: true, passive: true });

  function beat() {
    if (document.hidden) return;                 // a background tab is not a reader
    fetch('/api/px/beat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(engaged ? { p: location.pathname, e: 1 } : { p: location.pathname }),
      credentials: 'same-origin',
      keepalive: true,
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) paint(d); })
      .catch(function () { /* offline or blocked: the page is unaffected */ });
  }

  /* Cycling tabs fires visibilitychange every time; beating on each one burns a
   * rate-limit budget shared by everyone behind the same NAT. One beat per
   * BEAT_MS regardless of how often focus changes. */
  var lastBeat = 0;
  function beatThrottled() {
    var now = Date.now();
    if (now - lastBeat < BEAT_MS) return;
    lastBeat = now;
    beat();
  }

  function start() {
    if (timer) return;
    beatThrottled();
    timer = setInterval(beatThrottled, BEAT_MS);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  start();
})();
