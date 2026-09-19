'use strict';
/* 1001startup.id — the language layer.
 *
 * English is the default and lives at the bare paths; Bahasa Indonesia is the
 * SAME server-rendered page at /id/<path>. Separate URLs per language is the
 * arrangement search engines index (a client-side string swap is invisible to
 * them), so the toggle in the header is a plain <a> between the two URLs and
 * every translated page declares the pair with hreflang.
 *
 * server.js strips the /id prefix before routing (fastify rewriteUrl) and the
 * request carries lang1001='id'; views receive `lang` and translate with the
 * inline L(en, id) helper from mkL — the string stays at its use site, so a
 * section edit and its translation travel in one diff instead of drifting
 * apart in a dictionary file.
 *
 * What is deliberately NOT translated: text that comes out of census.json
 * (verify_note, funding_note, method_summary, scope reasons…). That prose is
 * the sourced working record, quoted as written. The page frame around it is
 * what speaks Indonesian.
 *
 * ORIGIN is the one absolute-URL constant in the 1001 views: hreflang and
 * canonical require fully-qualified URLs, and 1001startup.id is the live
 * canonical domain (1001.vantis.sh stays as an alias that will forward). A
 * page served on the alias still declares the .id URLs — that is the point:
 * when noindex lifts, everything consolidates onto the real domain.
 */
const { esc } = require('../lib/util');

const ORIGIN = 'https://1001startup.id';
const LANGS = ['en', 'id'];

/* URL prefix for in-site links on a translated page: PF + '/company/x' */
const pfx = (lang) => (lang === 'id' ? '/id' : '');

/* const L = mkL(lang);  L('Companies', 'Perusahaan') — falls back to English
   when the Indonesian string is missing, so a forgotten translation degrades
   to the default language rather than to a hole in the page. */
const mkL = (lang) => (en, id) => (lang === 'id' && id != null ? id : en);

/* <head> block for a page that exists in both languages. `path` is the bare
   (unprefixed) path of the page: '/', '/closed', '/map', '/company/<id>'.
   Emit this ONLY on translated pages — hreflang pointing at a URL that 302s
   back to English would be declaring an alternate that does not exist. */
function headTags(lang, path) {
  const p = esc(path || '/');
  const en = ORIGIN + (p === '/' ? '/' : p);
  const id = ORIGIN + '/id' + (p === '/' ? '/' : p);
  return `<link rel="canonical" href="${lang === 'id' ? id : en}">
<link rel="alternate" hreflang="en" href="${en}">
<link rel="alternate" hreflang="id" href="${id}">
<link rel="alternate" hreflang="x-default" href="${en}">
<meta property="og:locale" content="${lang === 'id' ? 'id_ID' : 'en_US'}">
<meta property="og:locale:alternate" content="${lang === 'id' ? 'en_US' : 'id_ID'}">`;
}

/* The share card, one for the whole site. Content-hashed FILENAME (the CF
   edge caches /assets for a long time and the purge token is DNS-only), so
   regenerating the card means a new hash and a one-line change here. */
const OG_IMG = ORIGIN + '/assets/og-1001-e1ecc9a4.png';
/* Pass an absolute URL to override — company pages hand in their own card
   (data/og-cards.json via server.js); everything else gets the site card. */
const ogImage = (url) => `<meta property="og:image" content="${url || OG_IMG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;

module.exports = { ORIGIN, LANGS, pfx, mkL, headTags, OG_IMG, ogImage };
