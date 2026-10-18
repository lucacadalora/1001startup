/* 1001startup.id /signin — Clerk's email-code form, then our own session.
 *
 * Clerk (app "1001startup") proves who the reader is; lib/account1001.js turns
 * that into 1001's own 30-day cookie. The page loads Clerk's two scripts from
 * the Frontend API host (clerk.browser.js + ui.browser.js, Core 3); this file
 * waits for both, loads Clerk, mounts the sign-in form, and when a session
 * appears posts its token to /signin/clerk.
 *
 * ?out=1 (after "Sign out") ends the Clerk session too, or the reader would be
 * signed straight back in by the code below.
 *
 * Inside the wall's popup (/signin?embed=1, data-embed="1") nothing navigates:
 * the frame reports its height and, once signed in, tells the page around it
 * (public/js/wall1001.js), which lifts the wall in place.
 */
(function () {
  'use strict';
  var root = document.getElementById('si-clerk');
  if (!root) return;
  var lang = root.getAttribute('data-lang') === 'id' ? 'id' : 'en';
  var next = root.getAttribute('data-next') || '';
  var out = root.getAttribute('data-out') === '1';
  var embed = root.getAttribute('data-embed') === '1';
  var via = root.getAttribute('data-via') || '';
  var msg = document.getElementById('si-msg');
  function tell(m) {
    if (embed && window.parent !== window) {
      try { window.parent.postMessage(m, location.origin); } catch (e) { /* no page around us */ }
    }
  }
  if (embed && window.ResizeObserver) {
    var tellHeight = function () { tell({ type: 'a1001-h', h: Math.ceil(document.body.getBoundingClientRect().height) }); };
    new ResizeObserver(tellHeight).observe(document.body);
    tellHeight();
  }
  /* already signed in (another tab got there first): just lift the wall */
  if (embed && root.getAttribute('data-signed') === '1') { tell({ type: 'a1001-in' }); return; }
  var T = lang === 'id' ? {
    load: 'Formulir masuk belum bisa dimuat. Muat ulang halaman ini.',
    fail: 'Kamu sudah terverifikasi, tapi kami belum bisa menyelesaikan proses masuk. Muat ulang halaman ini.',
  } : {
    load: 'The sign-in form could not load. Reload this page.',
    fail: 'You are verified, but we could not finish signing you in. Reload this page.',
  };
  function say(t) { if (msg) { msg.textContent = t; msg.hidden = !t; } }

  /* Same look as the rest of 1001: black, square, Overused Grotesk. The
     intro above the form is ours, so Clerk's own header is hidden on the
     first step (css in views/signin1001.js). Email only (Luca's call 4). */
  var APPEARANCE = {
    theme: 'simple',
    variables: {
      colorPrimary: '#000000', colorPrimaryForeground: '#ffffff', colorForeground: '#000000',
      colorMutedForeground: '#52525B', colorBackground: '#ffffff', colorInput: '#ffffff',
      colorInputForeground: '#000000', colorNeutral: '#000000', colorBorder: '#000000',
      colorRing: '#E8734B', colorDanger: '#B3261E', fontFamily: 'inherit', fontFamilyButtons: 'inherit',
      fontSize: '15px', borderRadius: '0',
    },
    options: { logoPlacement: 'none', socialButtonsPlacement: 'bottom', showOptionalFields: false, unsafe_disableDevelopmentModeWarnings: true },
    captcha: { theme: 'light', size: 'flexible' },
    elements: { socialButtonsRoot: { display: 'none' }, dividerRow: { display: 'none' } },
  };

  /* Clerk's own Indonesian (public/js/clerk-id-ID.js, loaded on /id pages),
     with the lines it leaves in English filled in and "Anda" turned into
     "kamu", the way the rest of 1001 speaks. */
  function idText() {
    var base = window.__clerk1001_idID;
    if (lang !== 'id' || !base) return undefined;
    var t = JSON.parse(JSON.stringify(base));
    t.formFieldInputPlaceholder__emailAddress = 'Masukkan alamat email kamu';
    t.signIn = t.signIn || {};
    t.signIn.emailCode = Object.assign({}, t.signIn.emailCode, { title: 'Cek email kamu' });
    t.signUp = t.signUp || {};
    t.signUp.emailCode = Object.assign({}, t.signUp.emailCode, {
      title: 'Verifikasi email kamu', subtitle: 'Masukkan kode yang kami kirim ke email kamu',
    });
    t.unstable__errors = Object.assign({}, t.unstable__errors, { form_code_incorrect: 'Kodenya salah. Coba lagi.' });
    return t;
  }

  function whenLoaded() {
    return new Promise(function (resolve, reject) {
      var n = 0;
      (function poll() {
        if (window.Clerk && window.__internal_ClerkUICtor) return resolve(window.Clerk);
        if (++n > 200) return reject(new Error('clerk scripts did not load'));
        setTimeout(poll, 100);
      })();
    });
  }

  var busy = false;
  function exchange(clerk) {
    if (busy || !clerk.session) return;
    busy = true;
    root.classList.add('si-busy');
    clerk.session.getToken().then(function (token) {
      return fetch('/signin/clerk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, next: next, lang: lang, via: via }),
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || ('http ' + r.status));
        if (embed) return tell({ type: 'a1001-in' });
        location.replace(j.next || (lang === 'id' ? '/id/signin' : '/signin'));
      });
    }).catch(function () {
      busy = false;
      root.classList.remove('si-busy');
      say(T.fail);
    });
  }

  /* where Clerk should land after it signs in or out: this page, without ?out
     (in the popup: this same frame) */
  var here = embed ? location.pathname + location.search
    : location.pathname + (next ? '?next=' + encodeURIComponent(next) : '');

  whenLoaded().then(function (clerk) {
    return clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, appearance: APPEARANCE, localization: idText() }).then(function () {
      /* Clerk reloads `here` after signing out, and that load mounts the form */
      if (out && clerk.session) return clerk.signOut({ redirectUrl: here }).then(function () { return 'left'; });
      return null;
    }).then(function (left) {
      if (left) return;
      if (clerk.session) return exchange(clerk);
      clerk.addListener(function (e) { if (e && e.session) exchange(clerk); });
      root.innerHTML = '';
      clerk.mountSignIn(root, {
        routing: 'hash',
        withSignUp: true,
        /* keep Clerk on this page when it finishes: the listener above takes
           over from here and lands the reader on `next` */
        forceRedirectUrl: here,
        signUpForceRedirectUrl: here,
      });
      root.classList.add('si-ready');
    });
  }).catch(function () { say(T.load); });
})();
