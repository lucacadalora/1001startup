/* ============================================================================
 * Vantis — cookie consent + first-party analytics
 * ----------------------------------------------------------------------------
 * One file, no dependencies, dropped into every page with a single <script>.
 * The 8 pages of vantis.sh are standalone HTML with inlined CSS and no shared
 * stylesheet, so this file carries its own styles rather than assuming any.
 *
 * Order of operations matters and is the whole point of the file:
 *   1. nothing is loaded, no cookie is written, until a choice exists
 *   2. a choice arrives (banner, stored record, or a GPC/DNT signal)
 *   3. only then does the analytics tracker get injected
 *
 * The tracker is self-hosted Umami, proxied first-party under /_v/ by nginx.
 * No third-party request leaves the visitor's browser, which is what lets the
 * cookie policy say "first-party only" truthfully.
 *
 * 1001startup.id reports to a second tracker as well: its own self-hosted
 * Databuddy (dashboard at data.1001startup.id), reached first-party under
 * /_d/ the same way, and only after the same consent.
 * ==========================================================================*/
(function () {
  'use strict';

  var STORE_KEY = 'vantis-consent';
  var COOKIE_KEY = 'vs_consent';
  var VERSION = 1;                 // bump to re-ask everyone after a policy change
  /* One file serves both hosts. data-domains is a hard guard inside umami's
   * script.js — if the current hostname is not listed, the tracker loads and
   * silently sends nothing — so the id and the domain have to be chosen
   * together, per site, or 1001 would look dead in the dashboard. */
  var ID_PASAR = '9374a26f-0da4-4be0-82a2-1638fad1cda4';
  var ID_1001 = 'f0f2d734-d9b2-43cc-9a5a-bf02b5b02ae9';
  var ID_UMKM = '18e8fa5f-17c5-4df2-9d44-580b68092917';
  var ID_CNC = 'de76eb14-f31d-4ec4-8f4b-11b62bcb14b7';   // cnc.vantis.sh, CNC + 3D map (working name)
  /* 1001 answers on both its old vantis.sh host and its own domain during the
   * migration. Both map to the same website id so the move reads as one site
   * with continuous history, not two half-sites split on the day DNS flipped.
   * 1001umkm.id is pre-mapped the same way for the day its domain points. */
  var SITES = {
    'pasar.vantis.sh': ID_PASAR,
    '1001.vantis.sh': ID_1001,
    '1001startup.id': ID_1001,
    'www.1001startup.id': ID_1001,
    'umkm.vantis.sh': ID_UMKM,
    '1001umkm.id': ID_UMKM,
    'www.1001umkm.id': ID_UMKM,
    'cnc.vantis.sh': ID_CNC,
  };
  var HOSTNAME = location.hostname;
  /* Databuddy website id, per host. Hosts not listed here load Umami only. */
  var DB_SITES = {
    '1001startup.id': '1905f714-3080-452a-abe2-df7315e013db',
    'www.1001startup.id': '1905f714-3080-452a-abe2-df7315e013db',
  };
  var DB_ID = DB_SITES[HOSTNAME];
  var WEBSITE_ID = SITES[HOSTNAME] || SITES['pasar.vantis.sh'];
  var SITE_NAME = WEBSITE_ID === ID_1001 ? '1001startup.id'
    : WEBSITE_ID === ID_UMKM ? '1001umkm.id'
    : WEBSITE_ID === ID_CNC ? 'CNC + 3D Indonesia' : 'PASAR';
  var POLICY_URL = 'https://vantis.sh/cookies/';

  /* ── consent record ──────────────────────────────────────────────────────
   * Stored twice on purpose: localStorage is what this script reads, the
   * cookie is the durable record of *when and what* was agreed to — the thing
   * you need if anyone ever asks us to prove consent was collected.          */

  function read() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && v.v === VERSION ? v : null;
    } catch (e) { return null; }
  }

  function write(rec) {
    rec.v = VERSION;
    rec.ts = new Date().toISOString();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) {}
    try {
      // 12 months. Lax, not None: nothing here is needed cross-site.
      document.cookie = COOKIE_KEY + '=' + encodeURIComponent(
        rec.analytics ? 'a' : '-') + (rec.preferences ? 'p' : '-') +
        ';path=/;max-age=31536000;SameSite=Lax' +
        (location.protocol === 'https:' ? ';Secure' : '');
    } catch (e) {}
    return rec;
  }

  // A browser-level opt-out is a choice already made. Asking again after the
  // visitor has set GPC is just nagging someone who answered in advance.
  function signalledOptOut() {
    return navigator.globalPrivacyControl === true ||
           navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  /* ── analytics ───────────────────────────────────────────────────────────*/

  var loaded = false;

  function track(name, data) {
    if (!loaded || !window.umami) return;
    try { window.umami.track(name, data || {}); } catch (e) {}
    // Databuddy measures time on page and scroll depth itself, on its own
    // page-exit event, so 'engagement' would only repeat it there.
    if (DB_ID && window.databuddy && name !== 'engagement') {
      try { window.databuddy.track(name, data || {}); } catch (e) {}
    }
  }
  window.vsTrack = track;   // usable from page code; a no-op without consent

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/_v/s.js';                       // nginx -> 127.0.0.1:8180/script.js
    s.setAttribute('data-website-id', WEBSITE_ID);
    s.setAttribute('data-domains', HOSTNAME);
    s.onload = instrument;
    document.head.appendChild(s);
    if (DB_ID) loadDatabuddy();
  }

  /* The page's CSP allows no inline script and no other origin, so the
   * tracker reads its settings from this object instead of data- attributes
   * and talks to /_d/ on this host (nginx -> the collector on this server).
   * Visitor ids stay stable across days: this only ever runs after a yes to
   * analytics, and without it a returning reader would count as new daily. */
  function loadDatabuddy() {
    window.databuddyConfig = {
      clientId: DB_ID,
      apiUrl: location.origin + '/_d',
      anonymizeVisitorIds: false,
      trackWebVitals: true,
      trackErrors: true,
      trackOutgoingLinks: true
    };
    var d = document.createElement('script');
    d.defer = true;
    d.src = '/_d/s.js';                       // nginx -> pinned copy of databuddy.js
    document.head.appendChild(d);
  }

  /* Withdrawing consent removes the ids Databuddy keeps in this browser. */
  function forgetDatabuddy() {
    try {
      ['did', 'did_profile', 'did_params'].forEach(function (k) { localStorage.removeItem(k); });
      ['did_session', 'did_session_timestamp', 'did_session_start', 'did_profile_sent']
        .forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ── instrumentation ─────────────────────────────────────────────────────
   * Umami's own tracker covers pageview, referrer, UTM, device, browser, OS,
   * language and country. Everything below is the behavioural layer: what got
   * read, what got clicked, what got copied, how far down people went.       */

  function label(el) {
    var t = el.getAttribute('data-vs-label') ||
            el.getAttribute('aria-label') ||
            (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() ||
            el.getAttribute('title') || '';
    if (!t) {
      var img = el.querySelector('img');
      t = (img && (img.alt || img.src.split('/').pop())) || el.className || 'unlabelled';
    }
    return t.slice(0, 60);
  }

  // Which part of the page a click came from. Falls back up the tree to the
  // nearest thing with an id, which on these pages is always a section anchor.
  function section(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.id) return n.id;
      if (n.dataset && n.dataset.vsSection) return n.dataset.vsSection;
      n = n.parentElement;
    }
    return 'page';
  }

  function instrument() {
    var path = location.pathname;

    /* clicks — one delegated handler covers every link and button on the site,
     * so new markup is instrumented the moment it ships, with no edits here. */
    var lastClick = { key: '', t: 0, n: 0 };
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('a,button,[role="button"],[data-vs]');
      if (!el) return;

      var lbl = label(el);
      var sec = section(el);
      var href = el.getAttribute('href') || '';
      var props = { label: lbl, section: sec, path: path };

      if (href) {
        if (/^mailto:/i.test(href)) {
          props.to = href.replace(/^mailto:/i, '').split('?')[0];
          track('email_click', props);
        } else if (/^https?:/i.test(href)) {
          var host = '';
          try { host = new URL(href, location.href).hostname; } catch (err) {}
          props.href = href.slice(0, 120);
          props.host = host;
          // Subdomain traffic is the number that actually matters here: it is
          // the landing page handing a visitor to a live product.
          if (host && host !== location.hostname) {
            track(/\.vantis\.sh$/.test(host) ? 'product_click' : 'outbound_click', props);
          } else {
            track('click', props);
          }
        } else if (href.charAt(0) === '#') {
          props.anchor = href;
          track('nav_click', props);
        } else {
          props.href = href.slice(0, 120);
          track('nav_click', props);
        }
      } else {
        track('click', props);
      }

      /* rage clicks: same target hit 3+ times inside a second. Almost always
       * something that looks interactive and isn't. */
      var key = sec + '|' + lbl;
      var now = Date.now();
      if (key === lastClick.key && now - lastClick.t < 1000) {
        lastClick.n++;
        if (lastClick.n === 3) track('rage_click', { label: lbl, section: sec, path: path });
      } else {
        lastClick.n = 1;
      }
      lastClick.key = key; lastClick.t = now;
    }, true);

    /* scroll depth — fires once per milestone per pageview */
    var hit = {}, maxDepth = 0;
    function onScroll() {
      var h = document.documentElement;
      var scrollable = h.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      var pct = Math.min(100, Math.round(((window.scrollY || h.scrollTop) / scrollable) * 100));
      if (pct > maxDepth) maxDepth = pct;
      [25, 50, 75, 100].forEach(function (m) {
        if (pct >= m && !hit[m]) { hit[m] = 1; track('scroll_depth', { depth: m, path: path }); }
      });
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { onScroll(); ticking = false; });
    }, { passive: true });
    onScroll();

    /* section reads — a section counts as read once half of it has been on
     * screen. Tells us which parts of a long landing page people reach.      */
    if ('IntersectionObserver' in window) {
      var seen = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id || en.target.dataset.vsSection;
          if (!id || seen[id]) return;
          seen[id] = 1;
          track('section_view', { section: id, path: path });
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('section[id],[data-vs-section]').forEach(function (el) {
        io.observe(el);
      });
    }

    /* copy — on /tokenomics and /vantis this is someone lifting the contract
     * address, which is the highest-intent thing that happens on the site.   */
    document.addEventListener('copy', function () {
      var sel = '';
      try { sel = String(window.getSelection() || ''); } catch (e) {}
      track('copy', {
        path: path,
        chars: sel.length,
        kind: /^0x[a-fA-F0-9]{40}$/.test(sel.trim()) ? 'address' : 'text'
      });
    });

    /* engagement — sent when the tab is hidden or closed. visibilitychange is
     * the only unload-ish event mobile Safari reliably delivers.             */
    var start = Date.now(), sent = false;
    function sendEngagement() {
      if (sent) return;
      sent = true;
      track('engagement', {
        path: path,
        seconds: Math.round((Date.now() - start) / 1000),
        max_depth: maxDepth
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') sendEngagement();
      else { sent = false; start = Date.now(); }
    });
    window.addEventListener('pagehide', sendEngagement);
  }

  /* ── banner ──────────────────────────────────────────────────────────────*/

  var CSS =
  '.vs-cc,.vs-cc *{box-sizing:border-box;}' +
  '.vs-cc{position:fixed;left:20px;bottom:20px;z-index:9999;width:328px;max-width:calc(100vw - 32px);' +
    'background:#fff;border:1px solid #E7E7E7;border-radius:0;box-shadow:0 10px 30px rgba(0,0,0,.10);' +
    'padding:14px 16px;font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#000;' +
    'opacity:0;transform:translateY(10px);transition:opacity .28s ease,transform .28s ease;}' +
  '.vs-cc.vs-in{opacity:1;transform:translateY(0);}' +
  // clears the fixed 248px product rail that appears at this breakpoint
  '' +
  '@media (max-width:560px){.vs-cc{left:16px;right:16px;bottom:16px;width:auto;padding:18px;}}' +
  '.vs-cc-head{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;}' +
  '.vs-cc-ico{flex:none;width:24px;height:24px;color:#000;margin-top:1px;}' +
  '.vs-cc-ico svg{width:100%;height:100%;display:block;}' +
  '.vs-cc-txt{font-size:12.5px;font-weight:300;line-height:1.55;color:#3b3b3b;margin:0;}' +
  '.vs-cc-txt a{color:#000;font-weight:500;text-decoration:underline;text-underline-offset:2px;}' +
  '.vs-cc-btn{display:block;width:100%;border-radius:0;padding:9px 12px;cursor:pointer;' +
    'font-family:IBM Plex Mono,ui-monospace,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:600;letter-spacing:.01em;' +
    'border:1px solid #E7E7E7;background:#fff;color:#000;transition:transform .16s ease,border-color .16s ease,background .16s ease;}' +
  '.vs-cc-btn:hover{transform:translateY(-1px);border-color:#000;}' +
  // brand rule: ink on green, never white on green
  '.vs-cc-btn.vs-p{background:#000;border-color:#000;color:#fff;margin-bottom:7px;}' +
  '.vs-cc-btn.vs-p:hover{background:#A65922;border-color:#000;}' +
  '.vs-cc-row{display:flex;gap:9px;}' +
  '.vs-cc-row .vs-cc-btn{font-weight:500;font-size:12.5px;padding:10px 12px;}' +
  '.vs-cc-panel{display:none;margin:2px 0 15px;border-top:1px solid #e5e7eb;padding-top:13px;}' +
  '.vs-cc.vs-open .vs-cc-panel{display:block;}' +
  '.vs-cc-opt{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #f0f1f3;}' +
  '.vs-cc-opt:last-child{border-bottom:0;}' +
  '.vs-cc-opt h4{margin:0 0 2px;font-family:"Space Grotesk",Inter,sans-serif;font-size:12.5px;font-weight:600;letter-spacing:.01em;}' +
  '.vs-cc-opt p{margin:0;font-size:11.5px;font-weight:300;line-height:1.5;color:#676767;}' +
  '.vs-cc-sw{flex:none;position:relative;width:38px;height:22px;border-radius:11px;background:#d0d5db;border:0;cursor:pointer;' +
    'transition:background .18s ease;margin-top:2px;}' +
  '.vs-cc-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;' +
    'transition:transform .18s ease;}' +
  '.vs-cc-sw[aria-checked="true"]{background:#C96F2E;}' +
  '.vs-cc-sw[aria-checked="true"]::after{transform:translateX(16px);}' +
  '.vs-cc-sw[disabled]{background:#000;cursor:default;opacity:.35;}' +
  '.vs-cc-sw[disabled]::after{transform:translateX(16px);}' +
  '.vs-cc :focus-visible{outline:2px solid #000;outline-offset:2px;}' +
  '@media (prefers-reduced-motion:reduce){.vs-cc,.vs-cc-btn,.vs-cc-sw,.vs-cc-sw::after{transition:none;}.vs-cc{transform:none;}}';

  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/>' +
    '<circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="14.5" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></svg>';

  var el = null;

  function build(rec) {
    if (el) return el;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    el = document.createElement('div');
    el.className = 'vs-cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie preferences');
    el.innerHTML =
      '<div class="vs-cc-head">' +
        '<span class="vs-cc-ico">' + ICON + '</span>' +
        '<p class="vs-cc-txt">We use cookies to remember your preferences and to see which parts of ' +
        SITE_NAME + ' people actually read. First-party only — nothing is sold or shared. ' +
        '<a href="' + POLICY_URL + '">Cookie Policy</a></p>' +
      '</div>' +
      '<div class="vs-cc-panel">' +
        '<div class="vs-cc-opt">' +
          '<div><h4>Essential</h4><p>Serves the site and remembers this choice. Always on.</p></div>' +
          '<button class="vs-cc-sw" role="switch" aria-checked="true" aria-label="Essential cookies" disabled></button>' +
        '</div>' +
        '<div class="vs-cc-opt">' +
          '<div><h4>Analytics</h4><p>Self-hosted on our own server. Pages read, links clicked, how far you scroll.' +
            // Databuddy keeps its visitor id in localStorage; say so where the choice is made.
            (DB_ID ? ' Keeps a random visitor ID in this browser, so a return visit is not counted as new.' : '') +
            '</p></div>' +
          '<button class="vs-cc-sw" role="switch" aria-checked="false" aria-label="Analytics cookies" data-k="analytics"></button>' +
        '</div>' +
        '<div class="vs-cc-opt">' +
          '<div><h4>Preferences</h4><p>Small things you set yourself, like dismissing the announcement bar.</p></div>' +
          '<button class="vs-cc-sw" role="switch" aria-checked="false" aria-label="Preference cookies" data-k="preferences"></button>' +
        '</div>' +
      '</div>' +
      '<button class="vs-cc-btn vs-p" data-a="all">Accept all</button>' +
      '<div class="vs-cc-row">' +
        '<button class="vs-cc-btn" data-a="reject">Reject non-essential</button>' +
        '<button class="vs-cc-btn" data-a="custom">Customize</button>' +
      '</div>';

    document.body.appendChild(el);

    var toggles = el.querySelectorAll('.vs-cc-sw[data-k]');
    if (rec) {
      toggles.forEach(function (t) {
        t.setAttribute('aria-checked', rec[t.dataset.k] ? 'true' : 'false');
      });
    }

    el.addEventListener('click', function (e) {
      var sw = e.target.closest('.vs-cc-sw[data-k]');
      if (sw) {
        sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
        return;
      }
      var btn = e.target.closest('.vs-cc-btn');
      if (!btn) return;
      var a = btn.dataset.a;

      if (a === 'custom' && !el.classList.contains('vs-open')) {
        // first press opens the panel; the button then becomes Save, so a
        // visitor can never be one click from an accidental blanket accept
        el.classList.add('vs-open');
        btn.textContent = 'Save choices';
        el.querySelector('[data-a="all"]').textContent = 'Accept all';
        return;
      }

      var rec2;
      if (a === 'all') rec2 = { analytics: true, preferences: true, how: 'accept_all' };
      else if (a === 'reject') rec2 = { analytics: false, preferences: false, how: 'reject' };
      else {
        rec2 = { how: 'custom' };
        toggles.forEach(function (t) { rec2[t.dataset.k] = t.getAttribute('aria-checked') === 'true'; });
      }
      apply(write(rec2), true);
      hide();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el && el.classList.contains('vs-in')) hide();
    });

    setTimeout(function () { if (el) el.classList.add('vs-in'); }, 1400);
    return el;
  }

  function hide() {
    if (!el) return;
    el.classList.remove('vs-in');
    setTimeout(function () { if (el) { el.remove(); el = null; } }, 300);
  }

  /* Keys the page code itself writes for the "Preferences" category. If that
   * category is refused we have to actually stop the write, not just promise
   * to — otherwise the toggle is decoration and the policy is a lie.        */
  var PREF_KEYS = ['vantis-announce', 'b1001.intro'];   // b1001.intro: 1001startup.id builder card, "intro seen" 24h stamp
  var prefGuardOn = false;

  function enforcePreferences(allowed) {
    PREF_KEYS.forEach(function (k) {
      if (!allowed) { try { localStorage.removeItem(k); } catch (e) {} }
    });
    if (allowed || prefGuardOn) return;
    prefGuardOn = true;
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) {
      if (PREF_KEYS.indexOf(k) !== -1) return;      // silently dropped
      return orig.apply(this, arguments);
    };
  }

  function apply(rec, fresh) {
    enforcePreferences(!!rec.preferences);
    if (rec.analytics) {
      loadAnalytics();
      // Record the decision itself — but only ever for people who said yes to
      // analytics. Counting the refusals would be exactly the thing they
      // refused.
      if (fresh) setTimeout(function () { track('consent', { choice: rec.how }); }, 600);
    } else if (DB_ID) {
      forgetDatabuddy();
    }
    document.documentElement.setAttribute('data-vs-consent', rec.analytics ? 'analytics' : 'essential');
  }

  /* ── reopen affordance ───────────────────────────────────────────────────
   * Consent has to be as easy to withdraw as it was to give. Every footer
   * carries a static "Cookies" link to the policy, which works with no JS at
   * all; this only fills one in if a page is ever shipped without it.        */
  function addFooterLink() {
    if (document.querySelector('footer a[href="/cookies/"]')) return;
    // .footer-links on the main pages; .footer-inner is the fallback for the
    // partner pages, whose footer is a bare brand + line of fine print.
    var list = document.querySelector('.footer-links') || document.querySelector('.footer-inner');
    if (!list) return;
    var a = document.createElement('a');
    a.href = '/cookies/';
    a.textContent = 'Cookies';
    a.className = 'fine';
    a.setAttribute('data-vs-reopen', '');
    list.appendChild(a);
  }

  function openPrefs() {
    if (el) return;
    build(read() || { analytics: false, preferences: false });
  }

  /* ── boot ────────────────────────────────────────────────────────────────*/

  function start() {
    addFooterLink();
    /* Withdrawing consent has to be as easy as giving it. addFooterLink only
       finds its hooks on vantis.sh, and nothing ever read data-vs-reopen, so on
       these hosts a stored choice was final. One delegated handler makes any
       element carrying the attribute reopen the panel; the link keeps a real
       href to the policy so it still does something useful without JS. */
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-vs-reopen]');
      if (!t) return;
      e.preventDefault();
      openPrefs();
    });
    var rec = read();
    if (rec) { apply(rec, false); return; }
    if (signalledOptOut()) { apply(write({ analytics: false, preferences: false, how: 'gpc' }), false); return; }
    build(null);
  }

  window.VantisConsent = {
    open: openPrefs,
    get: read,
    reset: function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      document.cookie = COOKIE_KEY + '=;path=/;max-age=0';
      location.reload();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
