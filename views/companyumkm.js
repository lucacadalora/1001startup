'use strict';
/* 1001umkm.id — one exporter, in full.
 *
 * ONE renderer, two contexts, exactly like the census: card() is served both as
 * the body of the landing page's right-hand drawer (GET /company/<id>?panel=1)
 * and as the body of the standalone page (GET /company/<id>), so the two can
 * never drift. Every class is cp- prefixed and styled by the SHARED
 * /css/company1001.css — the drawer chrome, fact ledger and sibling cards are
 * the same design system as 1001startup.id on purpose.
 *
 * The tier badge + note panel come from views/pagesumkm.js (one exported chunk).
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const UM = require('./pagesumkm');

const fmt = (n) => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('en-US');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

const blank = () => '<span class="cp-none">Not published — shown blank, never guessed</span>';

function factRow(k, v, u) {
  if (!v) return '';
  return `<div class="cp-fact"><dt class="cp-k">${esc(k)}</dt><dd class="cp-v">${v}${u ? ` <span class="cp-u">${esc(u)}</span>` : ''}</dd></div>`;
}
const section = (h, body) => body ? `<section class="cp-sec"><h3 class="cp-h3">${esc(h)}</h3>${body}</section>` : '';

function card({ c, data, standalone }) {
  const TM = ((data && data.method) || {}).tier_meta || {};
  const t = TM[c.tier] || {};
  const total = ((data && data.totals) || {}).exporters;
  const companies = (data && data.companies) || [];
  const loc = [c.city, c.province].filter(Boolean).join(', ');

  /* comparable = the six nearest-RANK exporters in the same sector — peers of
     similar evidence strength, not just the biggest names (census idiom) */
  const sib = companies
    .filter((x) => x.sector === c.sector && x.id !== c.id)
    .sort((a, b) => Math.abs(a.rank - c.rank) - Math.abs(b.rank - c.rank))
    .slice(0, 6)
    .sort((a, b) => a.rank - b.rank);

  const tierNote = `${t.def || ''}${c.tier_src
    ? ` The compiling sweep filed this row as “${c.tier_src}”; it is shown as ${(t.label || c.tier).toLowerCase()} here because the source is the company’s own storefront rather than a trade-show record.`
    : ''} ${c.source_url
    ? 'The source link on this page is the exact page the row was compiled from.'
    : 'No source page was recorded as a link for this row — the sweep wrote a description instead, and it is kept above rather than dressed up as a citation.'}`;

  return `<article class="cp" data-id="${esc(c.id)}">
  <header class="cp-top">
    <div class="cp-ident">
      ${c.logo ? `<img class="cp-logo" src="${esc(c.logo)}" alt="" width="46" height="46">` : '<span class="cp-logo cp-blank"></span>'}
      <div class="cp-names">
        <h2 class="cp-name"${standalone ? '' : ' id="cp-title"'}>${esc(c.name)}</h2>
      </div>
    </div>
    <div class="cp-tags">
      <span class="cp-tag cp-sector">${esc(c.sector)}</span>
      <span class="cp-tag">${esc(c.industry)}</span>
      ${loc ? `<span class="cp-tag">${esc(loc)}</span>` : ''}
      <span class="cp-tag cp-rank">Census #${esc(c.rank)}${total ? ` of ${total}` : ''}</span>
    </div>
    ${c.products ? `<p class="cp-what">${esc(c.products)}</p>` : ''}
    <div class="cp-act">
      ${c.email ? `<a class="cp-btn cp-primary" href="mailto:${esc(c.email)}">Email this exporter</a>` : ''}
      ${c.url ? `<a class="cp-btn${c.email ? '' : ' cp-primary'}" href="${esc(c.url)}" target="_blank" rel="noopener nofollow">Visit website <span aria-hidden="true">↗</span></a>` : ''}
      ${c.phone ? `<a class="cp-btn" href="tel:${esc(c.phone.replace(/[^+\d]/g, ''))}">Call ${esc(c.phone)}</a>` : ''}
    </div>
  </header>

  <dl class="cp-facts">
    ${factRow('Verified', `${UM.tierMark(c, TM)} <span class="cp-u">tier ${c.tier_rank} of 6</span>${
      c.source_url ? ` <a class="cp-srcl" href="${esc(c.source_url)}" target="_blank" rel="noopener nofollow" title="${esc(c.verification)}">${esc(host(c.source_url))}</a>` : ''}`)}
    ${factRow('Export markets', c.markets ? esc(c.markets) : blank())}
    ${factRow('Certifications', c.certs ? esc(c.certs) : blank())}
    ${factRow('Minimum order', c.moq ? esc(c.moq) : blank())}
    ${factRow('Incoterms', c.incoterms ? esc(c.incoterms) : blank())}
    ${factRow('Payment terms', c.payment_terms ? esc(c.payment_terms) : blank())}
    ${factRow('Where', loc ? esc(loc) : blank())}
    ${factRow('Email', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : blank())}
    ${factRow('Phone', c.phone ? esc(c.phone) : blank())}
  </dl>

  ${section('On the record', c.notes ? `<p class="cp-p">${esc(c.notes)}</p>` : '')}

  ${section('Verification', `<p class="cp-p"><span class="cp-lbl">${esc(t.label || c.tier)}</span>${esc(tierNote)}</p>
    <p class="cp-fine">A tier says what public evidence we read — it is not a due-diligence report. Verify the
    counterparty, use bank-checked instruments, inspect before full payment.</p>`)}

  ${section('Sources', (() => {
    const urls = [...new Set([c.source_url, c.url].filter(Boolean))];
    return urls.length ? `<ol class="cp-src">${urls.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow"><span class="cp-srch">${esc(host(u))}</span><span class="cp-srcu">${esc(u)}</span></a></li>`).join('')}</ol>` : '';
  })())}

  ${sib.length ? section('Comparable in ' + c.sector, `<div class="cp-sibs">${sib.map((s) => `<a class="cp-sib" href="/company/${esc(s.id)}" data-cp="${esc(s.id)}">
      <span class="cp-sibn">${esc(s.name)}</span><span class="cp-sibr">#${s.rank}${s.province ? ' · ' + esc(s.province) : ''}</span></a>`).join('')}</div>`) : ''}

  <footer class="cp-foot">
    <p class="cp-fine">Row ${esc(c.id)} · ${c.source_url ? 'compiled from the source above' : 'no source link recorded'} · contact channels as published, not re-verified.${
      (c.fixes || []).length ? ' Mechanical fixes on this row: ' + esc(c.fixes.join('; ')) + '.' : ''}</p>
  </footer>
</article>`;
}

function shell({ title, desc, body, path }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#ffffff">
<link rel="icon" type="image/png" href="/assets/favicon-umkm.png">
<link rel="apple-touch-icon" href="/assets/favicon-umkm.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${UM.GRAD};color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${UM.HEADCSS}
.pgwrap{max-width:880px;margin:0 auto;padding:34px 20px 64px}
.bk{display:inline-block;margin-bottom:18px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;color:#8E8E93}
.bk:hover{color:#000}
${UM.TBCSS}
${UM.NOTECSS}
.ftlegal{max-width:880px;margin:0 auto;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid #E7E7E7;padding:18px 20px 28px;font-size:10.5px;line-height:1.6;color:#8E8E93}
.ftlegal a{color:inherit;text-decoration:none;border-bottom:1px solid #D9D9D9}
.ftlegal a:hover{color:#000;border-bottom-color:#000}
</style>
</head>
<body>
<div class="banner">WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY ROW LINKS TO THE SOURCE IT WAS COMPILED FROM</div>
${UM.header('')}
<main class="pgwrap">
<a class="bk" href="/#exporters">← All exporters</a>
${body}
</main>
<div class="note" id="note" role="tooltip" hidden>
  <button type="button" class="nx" aria-label="Close">×</button>
  <div class="nk"></div>
  <div class="nb"></div>
  <div class="nm" hidden></div>
  <div class="nl" hidden></div>
</div>
<footer><div class="ftlegal mono">
  <span>© 2026 1001umkm.id · the census of Indonesian exporting SMEs</span>
  <span><a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a></span>
</div></footer>
<script src="/js/umkm.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

function page({ c, data }) {
  return shell({
    title: `${c.name} — 1001umkm.id`,
    desc: `${c.name}: ${c.sector} exporter${c.province ? ' from ' + c.province : ''} — products, export markets, trade terms, verification and contact channels.`,
    body: card({ c, data, standalone: true }),
    path: '/company/' + c.id,
  });
}

function notFound({ data }) {
  return shell({
    title: 'Not in the census — 1001umkm.id',
    desc: 'Nothing at this address.',
    body: `<article class="cp"><h2 class="cp-name">Nothing at this address.</h2>
    <p class="cp-p" style="margin-top:12px">No exporter — and no page — carries this address. The full table is one click back.</p></article>`,
    path: '/company',
  });
}

module.exports = { card, page, notFound };
