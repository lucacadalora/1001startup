'use strict';
/**
 * 1001startup.id — /signin (+ /id/signin). Reader accounts, login wall slice 1
 * (Luca, 18 Oct 2026; plan https://claude.ai/artifact/UsFcmrbQjNFJQACJDAmGDK).
 *
 * Two states: the sign-in form (Clerk's email-code flow, mounted into
 * #si-clerk by public/js/signin1001.js) and "you're signed in", which is ours
 * and needs no Clerk at all. Email code only (Luca's call 4, like gamescool.id).
 * Nobody is forced here yet; the wall that sends people to this page is slice 2.
 *
 * Built on browse1001's shell so the header, footer and consent behave like
 * every other 1001 page. Forms post to BARE URLs with a hidden lang field: an
 * /id POST would hit the ID_READY preHandler and 302 (see leads1001.js).
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const { shell } = require('./browse1001');
const { V } = require('./html');

const CSS = `<style>
.si{max-width:1180px;margin:0 auto;padding:56px 20px 8px;display:grid;place-items:center}
.si-card{width:100%;max-width:420px;border:1px solid #000;padding:30px 28px 26px;background:#fff}
.si-k{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;display:flex;align-items:center;gap:8px}
.si-k .sq{width:6px;height:6px;background:#E8734B;display:inline-block}
.si-card h1{font-size:28px;line-height:1.12;letter-spacing:-0.025em;font-weight:500;margin-top:14px;text-wrap:balance}
.si-sub{color:#52525B;font-size:15px;line-height:1.55;margin-top:10px}
.si-sub b{color:#000;font-weight:600;word-break:break-all}
.si-f{margin-top:24px;display:grid;gap:12px}
.si-f label{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B}
.si-f input{width:100%;padding:13px 15px;border:1px solid #000;border-radius:0;font:500 16px/1.2 'Overused Grotesk',system-ui,sans-serif;background:#fff;color:#000;outline:none}
.si-f input:focus{box-shadow:inset 0 -2px #E8734B}
.si-f input.code{font:400 24px/1 'IBM Plex Mono',monospace;letter-spacing:.32em;padding:14px 15px}
.si-f .btn{width:100%;text-align:center;padding:14px 18px}
.si-err{font-size:14px;color:#B3261E;border-left:2px solid #B3261E;padding-left:10px;line-height:1.45}
.si-alt{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:18px;font-size:14px}
.si-alt a,.si-alt button{color:#52525B;font:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.si-alt a:hover,.si-alt button:hover{color:#000}
.si-alt form{display:inline}
.si-note{margin-top:22px;padding-top:16px;border-top:1px solid #E7E7E7;font-size:13px;line-height:1.6;color:#6B6B73}
.si-row{display:grid;gap:10px;margin-top:24px}
.si-row .btn{text-align:center}
@media(max-width:480px){.si{padding:28px 16px 4px}.si-card{padding:24px 20px 22px}.si-card h1{font-size:25px}}
</style>`;

function page({ lang, path, title, body }) {
  const L = I18N.mkL(lang);
  return shell({
    title, path, lang, active: '', robots: 'noindex, nofollow',
    desc: L('Sign in to 1001startup.id with your email and a 6-digit code.',
      'Masuk ke 1001startup.id dengan email dan kode 6 angka.'),
    body: CSS + `<main class="si"><div class="si-card">${body}</div></main>`,
  });
}

const hidden = (lang, next) => `<input type="hidden" name="lang" value="${lang === 'id' ? 'id' : 'en'}">`
  + (next ? `<input type="hidden" name="next" value="${esc(next)}">` : '');

const note = (L) => `<p class="si-note">${L(
  'We keep your email to sign you in. It is never shown on the site. Signing in sets one cookie that keeps you signed in for 30 days.',
  'Email kamu kami simpan untuk proses masuk, dan tidak pernah ditampilkan di situs. Masuk menyimpan satu cookie agar kamu tetap masuk selama 30 hari.')}</p>`;

/** The sign-in form: Clerk's email-code flow, mounted by public/js/signin1001.js. */
function signIn({ lang = 'en', next = '', pk = '', fapi = '', out = false }) {
  const L = I18N.mkL(lang);
  const ready = !!(pk && fapi);
  return page({
    lang, path: '/signin', title: L('Sign in — 1001startup.id', 'Masuk — 1001startup.id'),
    body: `
<div class="si-intro">
<div class="si-k"><span class="sq" aria-hidden="true"></span>${L('Sign in', 'Masuk')}</div>
<h1>${L('Sign in to 1001startup.id', 'Masuk ke 1001startup.id')}</h1>
<p class="si-sub">${L('Free. Type your email and we send you a 6-digit code. No password.',
    'Gratis. Ketik email kamu, kami kirim kode 6 angka. Tanpa kata sandi.')}</p>
</div>
<div id="si-clerk" class="si-clerk" data-lang="${lang === 'id' ? 'id' : 'en'}" data-next="${esc(next)}" data-out="${out ? '1' : ''}">
  <div class="si-skel" aria-hidden="true"><span></span><span></span><span></span></div>
</div>
<p id="si-msg" class="si-err" role="alert"${ready ? ' hidden' : ''}>${ready ? '' : L('Sign-in is not available right now. Try again later.', 'Layanan masuk belum tersedia. Coba lagi nanti.')}</p>
<noscript><p class="si-err">${L('Signing in needs JavaScript turned on.', 'Untuk masuk, JavaScript perlu diaktifkan.')}</p></noscript>
${note(L)}
${ready ? `<script async crossorigin="anonymous" data-clerk-publishable-key="${esc(pk)}" src="https://${esc(fapi)}/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>
<script async crossorigin="anonymous" data-clerk-publishable-key="${esc(pk)}" src="https://${esc(fapi)}/npm/@clerk/ui@1/dist/ui.browser.js"></script>
<script src="/js/signin1001.js?v=${V}" defer></script>` : ''}`,
  });
}

/** Signed in already. */
function account({ lang = 'en', email = '', next = '' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return page({
    lang, path: '/signin', title: L('Your account — 1001startup.id', 'Akun kamu — 1001startup.id'),
    body: `
<div class="si-k"><span class="sq" aria-hidden="true"></span>${L('Account', 'Akun')}</div>
<h1>${L('You are signed in', 'Kamu sudah masuk')}</h1>
<p class="si-sub">${L(`Signed in as <b>${esc(email)}</b>.`, `Masuk sebagai <b>${esc(email)}</b>.`)}</p>
<div class="si-row">
  <a class="btn primary" href="${esc(next || PF + '/')}">${next ? L('Back to where you were', 'Kembali ke halaman tadi') : L('Go to 1001startup.id', 'Ke 1001startup.id')}</a>
  <form method="POST" action="/signout">${hidden(lang, '')}<button class="btn" type="submit" style="width:100%">${L('Sign out', 'Keluar')}</button></form>
</div>`,
  });
}

module.exports = { signIn, account };
