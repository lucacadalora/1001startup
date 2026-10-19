'use strict';
const { esc } = require('../lib/util');

// Bump on every deploy that changes css/js: Cloudflare edge-caches these
// paths ~4h and the purge token is DNS-only.
const V = 'p154';

const NAV = [
  { href: '/world', label: 'World' },
  { href: '/qr', label: 'QR maker' },
  { href: '/directory', label: 'Directory' },
];

/**
 * Page shell. All pages are noindex while the product is unlisted.
 * opts: { title, desc, path, body, scripts:[{src,module}], data:{id,json},
 *         og:{title,desc}, bare (no header/footer), authed, wide }
 */
function page(opts) {
  const title = opts.title ? `${opts.title} — PASAR` : 'PASAR';
  const desc = opts.desc || 'A market you can walk through. Link-in-bio profiles as buildings in a shared 3D city, with QR codes drawn as city blocks.';
  const css = ['/css/site.css', '/css/px.css', ...(opts.css || [])]
    .filter((h, i, a) => a.indexOf(h) === i)
    .map((h) => `<link rel="stylesheet" href="${esc(h)}?v=${V}">`)
    .join('\n');
  const scripts = (opts.scripts || [])
    .map((s) => `<script ${s.module ? 'type="module" ' : ''}src="${esc(s.src)}?v=${V}" defer></script>`)
    .join('\n  ');
  const data = opts.data
    ? `<script type="application/json" id="${esc(opts.data.id)}">${opts.data.json.replace(/</g, '\\u003c')}</script>`
    : '';
  const banner = opts.banner
    ? `<div class="banner"><span class="sq"></span>${opts.banner}<span class="sq"></span></div>` : '';
  const header = opts.bare ? '' : `
${banner}
<header class="site-head">
  <div class="head-row">
    <a class="brand" href="/"><img src="/assets/mark.svg" alt="" width="24" height="24"><span class="brand-name">PASAR</span><span class="brand-tag">early access</span></a>
    <nav class="head-nav">
      ${NAV.map((n) => `<a href="${n.href}"${opts.path === n.href ? ' class="on"' : ''}>${n.label}</a>`).join('')}
    </nav>
    <div class="head-cta">
      <!--PX-BADGE-->
      ${opts.authed
        ? '<a class="btn ghost sm" href="/dashboard">Dashboard</a>'
        : '<a class="btn ghost sm" href="/login">Log in</a><a class="btn primary sm" href="/claim">Claim your plot</a>'}
      <button class="icon-round nav-burger" id="nav-burger" type="button" aria-label="Menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
  <div class="nav-sheet" id="nav-sheet">
    <a href="/world">World</a><a href="/qr">QR maker</a><a href="/directory">Directory</a>
    ${opts.authed ? '<a href="/dashboard">Dashboard</a>' : '<a href="/login">Log in</a><a href="/claim">Claim your plot</a>'}
  </div>
</header>`;
  const footer = opts.bare ? '' : `
<footer class="site-foot">
  <div class="shell foot-row">
    <div class="foot-brand"><img src="/assets/mark.svg" alt=""><div><b>PASAR</b><span>The market you can walk through.</span></div></div>
    <nav class="foot-nav">
      <a href="/world">World</a><a href="/qr">QR maker</a><a href="/directory">Directory</a><a href="/claim">Claim a plot</a><a href="/login">Log in</a><a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a>
    </nav>
    <!--PX-BADGE-->
  </div>
</footer>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PASAR">
<meta property="og:title" content="${esc((opts.og && opts.og.title) || title)}">
<meta property="og:description" content="${esc((opts.og && opts.og.desc) || desc)}">
<meta property="og:image" content="https://pasar.vantis.sh/assets/og.png?v=p15">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
${css}
${data}
${scripts}
<script src="/js/nav.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</head>
<body class="${opts.bare ? 'bare' : ''}${opts.wide ? ' wide' : ''}">
${header}
<main${opts.bare ? ' class="bare-main"' : ''}>
${opts.body}
</main>
${footer}
</body>
</html>`;
}

module.exports = { page, V };
