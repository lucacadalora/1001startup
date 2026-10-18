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
/* our scripts' version: bump the letter on every change to signin1001.js or
   wall1001.js (/js is served immutable for a year) */
const AV = V + 'a6';

/* Clerk's form restyled to 1001: used by /signin and by the wall's popup frame */
const CLERK_CSS = `
.si-err{font-size:14px;color:#B3261E;border-left:2px solid #B3261E;padding-left:10px;line-height:1.45}
.si-clerk{min-height:140px;min-width:0;max-width:100%;transition:opacity .15s}
/* Clerk fixes its card at 25rem; inside our card it must follow our width */
#si-clerk{width:100%!important;max-width:100%!important;display:block!important}
#si-clerk .cl-rootBox,#si-clerk .cl-cardBox,#si-clerk .cl-card{width:100%!important;min-width:0;max-width:100%!important}
/* Clerk centres a narrow form inside its card; ours fills the card */
#si-clerk .cl-main,#si-clerk .cl-form,#si-clerk .cl-formFieldRow,#si-clerk .cl-formField,#si-clerk .cl-formButtonPrimary,#si-clerk .cl-footer{width:100%;align-self:stretch}
#si-clerk .cl-identityPreview{max-width:100%;flex-wrap:wrap;justify-content:flex-start}
#si-clerk .cl-identityPreviewText{white-space:normal;overflow-wrap:anywhere;text-overflow:clip;overflow:visible}
.si-busy{opacity:.45;pointer-events:none}
.si-skel span{display:block;height:46px;background:#F3F3F5;margin-bottom:12px}
.si-skel span:first-child{height:12px;width:22%}
.si-ready .si-skel{display:none}
#si-clerk .cl-cardBox{border:0;border-radius:0;box-shadow:none;background:transparent;overflow:visible}
#si-clerk .cl-card{padding:0;border:0;border-radius:0;box-shadow:none;background:transparent;gap:20px}
#si-clerk .cl-signIn-start .cl-header{display:none}
#si-clerk .cl-header{align-items:flex-start;text-align:left}
#si-clerk .cl-headerTitle{font:500 26px/1.15 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.025em;color:#000}
#si-clerk .cl-headerSubtitle{font:500 15px/1.55 'Overused Grotesk',system-ui,sans-serif;color:#52525B}
#si-clerk .cl-formFieldLabel{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B}
#si-clerk .cl-formFieldInput{height:46px;padding:0 15px;border:1px solid #000;border-radius:0;box-shadow:none;font:500 16px/1.2 'Overused Grotesk',system-ui,sans-serif;color:#000;background:#fff}
#si-clerk .cl-formFieldInput:focus{box-shadow:inset 0 -2px #E8734B;outline:none}
#si-clerk .cl-formButtonPrimary{height:46px;border-radius:0;background:#000;color:#fff;box-shadow:none;border:0;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em}
#si-clerk .cl-formButtonPrimary:hover{background:#2a2a2e}
#si-clerk .cl-formButtonPrimary .cl-buttonArrowIcon{display:none}
#si-clerk .cl-otpCodeFieldInput{border:1px solid #000;border-radius:0;font:400 22px/1 'IBM Plex Mono',monospace}
#si-clerk .cl-footer{background:transparent;border:0;padding:0;justify-content:flex-start}
#si-clerk .cl-footerActionText,.si-clerk .cl-footerActionLink{font:500 14px/1.4 'Overused Grotesk',system-ui,sans-serif}
#si-clerk .cl-footerActionLink{color:#000;text-decoration:underline;text-underline-offset:3px}
#si-clerk .cl-formResendCodeLink,.si-clerk .cl-identityPreviewEditButton{color:#000}
`;

const CSS = `<style>
.si{max-width:1180px;margin:0 auto;padding:56px 20px 8px;display:grid;grid-template-columns:minmax(0,1fr);justify-items:center}
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
.si-alt{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:18px;font-size:14px}
.si-alt a,.si-alt button{color:#52525B;font:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.si-alt a:hover,.si-alt button:hover{color:#000}
.si-alt form{display:inline}
.si-note{margin-top:22px;padding-top:16px;border-top:1px solid #E7E7E7;font-size:13px;line-height:1.6;color:#6B6B73}
.si-row{display:grid;gap:10px;margin-top:24px}
.si-row .btn{text-align:center}
.si-intro{margin-bottom:22px}
.si-card:has(.cl-card:not(.cl-signIn-start)) .si-intro{display:none}
@media(max-width:480px){.si{padding:28px 16px 4px}.si-card{padding:24px 20px 22px}.si-card h1{font-size:25px}}
${CLERK_CSS}</style>`;

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
${lang === 'id' ? `<script src="/js/clerk-id-ID.js?v=${AV}" defer></script>\n` : ''}<script src="/js/signin1001.js?v=${AV}" defer></script>` : ''}`,
  });
}

/* The form alone, for the wall's popup (served at /signin?embed=1 with
   frame-ancestors 'self'). No header or footer: the card around it carries
   the title and the note. signed = this browser is already signed in
   (another tab got there first): the script tells the wall to lift. */
function embed({ lang = 'en', next = '', pk = '', fapi = '', via = '', signed = false }) {
  const L = I18N.mkL(lang);
  const ready = !!(pk && fapi);
  return `<!doctype html>
<html lang="${lang === 'id' ? 'id' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${L('Sign in', 'Masuk')} — 1001startup.id</title>
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#000}
body{font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;padding:2px 2px 6px}
${CLERK_CSS}
.si-err{margin-top:12px}
</style>
</head>
<body>
<div id="si-clerk" class="si-clerk" data-embed="1" data-lang="${lang === 'id' ? 'id' : 'en'}" data-next="${esc(next)}" data-via="${esc(via)}"${signed ? ' data-signed="1"' : ''}>
  ${signed ? '' : '<div class="si-skel" aria-hidden="true"><span></span><span></span><span></span></div>'}
</div>
<p id="si-msg" class="si-err" role="alert"${ready ? ' hidden' : ''}>${ready ? '' : L('Sign-in is not available right now. Try again later.', 'Layanan masuk belum tersedia. Coba lagi nanti.')}</p>
${ready && !signed ? `<script async crossorigin="anonymous" data-clerk-publishable-key="${esc(pk)}" src="https://${esc(fapi)}/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>
<script async crossorigin="anonymous" data-clerk-publishable-key="${esc(pk)}" src="https://${esc(fapi)}/npm/@clerk/ui@1/dist/ui.browser.js"></script>` : ''}
${lang === 'id' ? `<script src="/js/clerk-id-ID.js?v=${AV}" defer></script>\n` : ''}<script src="/js/signin1001.js?v=${AV}" defer></script>
</body>
</html>`;
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

module.exports = { signIn, account, embed, AV };
