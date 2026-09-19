'use strict';
/* 1001startup.id — structured data, in one place.
 *
 * Luca, Aug 31 2026, pointing at a competitor's Google result with sitelinks
 * under it: "how to make it appears in google like this?". Sitelinks
 * themselves are algorithmic — there is no markup that requests them, and
 * Google retired the tool that used to influence them. What IS in our hands:
 *
 *   - tell Google what the brand IS (Organization + WebSite on the home page),
 *     so it can form the entity that sitelinks hang off;
 *   - tell it how the site is SHAPED (BreadcrumbList on every inner page),
 *     which is both a hierarchy signal and a rich result we can actually earn
 *     — the breadcrumb trail that replaces the raw URL in a search result.
 *
 * Rules that apply here exactly as they do to the pages: nothing is asserted
 * that the census cannot back. No invented socials, no invented ratings, and
 * every breadcrumb step points at a page that really exists.
 */
const I18N = require('./i18n1001');

const ld = (obj) => `\n<script type="application/ld+json">${
  JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/* The brand entity. Emitted on the home page only — repeating it site-wide
   adds nothing and Google reads the home page as the entity's anchor. */
function siteLd(lang, { companies } = {}) {
  const pf = I18N.pfx(lang);
  const home = I18N.ORIGIN + (pf || '') + '/';
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '1001startup.id',
    url: I18N.ORIGIN + '/',
    logo: I18N.ORIGIN + '/assets/favicon-1001-512.png',
    description: lang === 'id'
      ? 'Sensus startup Indonesia: data pendanaan, valuasi, jumlah pekerja, dan lokasi kantor, seluruhnya dari sumber publik.'
      : 'The census of Indonesian startups: funding, valuations, headcount and head-office locations, all from public sources.',
  };
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: lang === 'id' ? 'Sensus Startup Indonesia — 1001startup.id' : "Indonesia's Startup Census — 1001startup.id",
    url: home,
    inLanguage: lang === 'id' ? 'id-ID' : 'en',
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  /* A Dataset entry is honest here — the census IS a dataset, it is what the
     site is for, and the count is read live rather than typed. */
  const dataset = companies ? {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: lang === 'id' ? 'Sensus Startup Indonesia' : 'The Indonesian Startup Census',
    description: lang === 'id'
      ? `Data ${companies} startup Indonesia yang beroperasi: pendanaan yang diumumkan, valuasi, jumlah pekerja bertanggal, sektor, investor, dan alamat kantor pusat. Sumber publik; setiap angka turunan diberi label estimasi.`
      : `${companies} operating Indonesian startups: disclosed funding, valuations, dated headcounts, sector, investors and head-office address. Public sources; every derived figure is a labeled estimate.`,
    url: home,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
    spatialCoverage: { '@type': 'Place', name: 'Indonesia' },
  } : null;
  return ld(org) + ld(site) + (dataset ? ld(dataset) : '');
}

/* BreadcrumbList. `trail` is [{name, path}] with paths BARE (unprefixed) —
   the language prefix is applied here so the /id trail cites /id URLs. The
   last item is the current page and still carries its own URL, which is what
   Google's own examples do. */
function breadcrumbLd(lang, trail) {
  if (!trail || trail.length < 2) return '';
  const pf = I18N.pfx(lang);
  return ld({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: I18N.ORIGIN + pf + (t.path === '/' ? '/' : t.path),
    })),
  });
}

/* Google truncates a title around 60 characters, and Indonesian keyword
   phrases plus a long company or sector name blow past that routinely. Give
   the variants longest-first; the first one that fits wins, and if none does
   the shortest is used rather than something guaranteed to be cut. */
function fitTitle(variants, max = 60) {
  for (const v of variants) if (v && v.length <= max) return v;
  return variants[variants.length - 1] || '';
}

/* Same idea for descriptions, which truncate around 165 characters. Longest
   first; if none fits the shortest is used and then hard-capped at a word. */
function fitDesc(variants, max = 165) {
  for (const v of variants) if (v && v.length <= max) return v;
  const last = variants[variants.length - 1] || '';
  if (last.length <= max) return last;
  return last.slice(0, last.lastIndexOf(' ', max - 1)).replace(/[,;:—-]$/, '') + '…';
}

module.exports = { siteLd, breadcrumbLd, fitTitle, fitDesc };
