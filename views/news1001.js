'use strict';
/**
 * /news — THE WIRE. Automated startup journalism over the census:
 * Exa-discovered reporting, clustered per story, briefed in our own words
 * (scripts/census-news.py), plus census-native signals (headcount moves only
 * — census row-adds are a changelog, not news). Bloomberg/TIA in FUNCTION, 1001's own visual system in
 * form (feedback-no-reference-cloning): Overused Grotesk + Plex Mono,
 * hairlines, white, census sprites/logos as art — never press photos.
 *
 * Server-rendered feed; public/js/news1001.js adds filter chips, search,
 * load-more paging, the top-of-the-wire rail controls and a poll that offers
 * a refresh pill when the pipeline publishes new items (no client re-render —
 * one renderer).
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

// Sector tile colors — same family as the map's CENS_C (public/js/jakarta.js).
const SECTOR_C = {
  fintech: '#A8481F', commerce: '#3F7D4E', logistics: '#8A6D1C', health: '#4e748c',
  edtech: '#7c93a6', saas: '#564d43', 'ai-cloud': '#2e3f4e', media: '#a3506e',
  travel: '#6e8a5a', prop: '#7A5F38', agri: '#5a7a3f', fnb: '#b0703c',
  climate: '#1f7a6d', bank: '#2A6E9F', crypto: '#6E4E8C', misc: '#6d675d',
};
const TYPES = {
  funding: { label: 'Funding', id: 'Pendanaan', c: '#A8481F' },
  ma: { label: 'M&A', id: 'M&A', c: '#7A5F38' },
  ipo: { label: 'IPO & listings', id: 'IPO & bursa', c: '#8A6D1C' },
  regulatory: { label: 'Regulatory', id: 'Regulasi', c: '#a3506e' },
  people: { label: 'People', id: 'Manajemen', c: '#4E7A96' },
  product: { label: 'Product', id: 'Produk', c: '#3F7D4E' },
  market: { label: 'Ecosystem', id: 'Ekosistem', c: '#6d675d' },
};
const tLabel = (t, lang) => (lang === 'id' && t.id ? t.id : t.label);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function dayHead(d, lang) {
  // Parse as UTC so getUTC* returns the literal written date — the old
  // +07:00 suffix shifted every displayed day back by one (Aug 29 → "Aug 28").
  const t = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(t.getTime())) return d;
  return lang === 'id'
    ? `${DAYS_ID[t.getUTCDay()]} · ${t.getUTCDate()} ${MONS_ID[t.getUTCMonth()]}`
    : `${DAYS[t.getUTCDay()]} · ${MONS[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

/* The Indonesian text of an item, where the pipeline has written one
   (scripts/census-news.py stores hl_id / pts_id / cx_id in its state so a
   rebuild keeps them). English is the fallback, never a hole — and `link`
   items keep the outlet's own headline in its own language by design. */
const hlOf = (it, lang) => (lang === 'id' && it.hl_id ? it.hl_id : it.headline);
const cxOf = (it, lang) => (lang === 'id' && it.cx_id ? it.cx_id : it.context);

function art(it) {
  const a = it.art || {};
  if (a.kind === 'sprite') return `<span class="na sp"><img src="${esc(a.src)}" alt="" loading="lazy"></span>`;
  if (a.kind === 'logo') return `<span class="na lg"><img src="${esc(a.src)}" alt="" loading="lazy"></span>`;
  const c = SECTOR_C[a.sector] || SECTOR_C.misc;
  const ch = ((it.companies && it.companies[0] && it.companies[0].name) || it.headline || '?').trim().charAt(0).toUpperCase();
  return `<span class="na tl" style="background:${c}">${esc(ch)}</span>`;
}

function chips(it, lang, PF) {
  const t = TYPES[it.type] || TYPES.market;
  let h = `<span class="tch" style="--tc:${t.c}"><span class="sq"></span>${esc(tLabel(t, lang))}</span>`;
  for (const c of it.companies || []) {
    h += `<a class="cch" href="${PF || ''}/company/${esc(c.id)}">${esc(c.name)}</a>`;
  }
  if (it.kind === 'signal') h += `<span class="sch">${lang === 'id' ? 'sinyal sensus' : 'census signal'}</span>`;
  if (it.kind === 'original') h += `<span class="och">${lang === 'id' ? 'sumber primer' : 'primary source'}</span>`;
  if (it.kind === 'link') h += `<span class="sch">${lang === 'id' ? 'hanya judul' : 'headline only'}</span>`;
  return h;
}

function sources(it, lang, PF) {
  // One chip per OUTLET — a cluster often holds two articles from the same
  // paper, and "KUMPARAN · KUMPARAN" reads like a bug.
  const seen = new Set();
  const uniq = (it.sources || []).filter((s) => {
    const k = s.outlet || s.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const out = uniq.slice(0, 5).map((s) => {
    const internal = (s.url || '').startsWith('/');
    const name = internal ? (lang === 'id' ? 'profil sensus' : 'census profile') : esc((s.outlet || '').replace(/\.(com|co\.id|id|co)$/i, '').replace(/\..*$/, ''));
    return `<a href="${esc(internal ? (PF || '') + s.url : s.url)}"${internal ? '' : ' target="_blank" rel="noopener"'}>${name}${internal ? '' : ' ↗'}</a>`;
  }).join('<span class="dot">·</span>');
  const more = uniq.length > 5 ? `<span class="dot">·</span>+${uniq.length - 5}${lang === 'id' ? ' lagi' : ' more'}` : '';
  return `<span class="src mono">${out}${more}</span>`;
}

/* Luca, Aug 30: "i need a summary, like 2-3 points of news summary" — each
 * story reads as bullets, not a paragraph. `points` from the pipeline; `brief`
 * (old format) splits into sentences so a stale JSON still renders. */
function pointsOf(it, lang) {
  if (lang === 'id' && it.pts_id && it.pts_id.length) return it.pts_id;
  if (it.points && it.points.length) return it.points;
  // Fallback split guards against "Oct. 1." producing a bullet reading "1." —
  // only break where a real sentence starts, and drop fragments.
  if (it.brief) {
    return it.brief.split(/(?<=[.!?])\s+(?=[A-Z("“])/)
      .map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3).slice(0, 3);
  }
  return [];
}

function pointsHtml(it, lang) {
  const pts = pointsOf(it, lang);
  return pts.length ? `<ul class="pts">${pts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
}

function row(it, lang, PF) {
  const hl = it.kind === 'link' && it.sources && it.sources[0]
    ? `<a class="hl ext" href="${esc(it.sources[0].url)}" target="_blank" rel="noopener">${esc(hlOf(it, lang))}</a>`
    : esc(hlOf(it, lang));
  /* the search index carries BOTH languages so a reader can type either */
  const q = [it.headline, it.hl_id, pointsOf(it, 'en').join(' '), (it.pts_id || []).join(' '),
    (it.companies || []).map((c) => c.name).join(' ')].filter(Boolean).join(' ').toLowerCase();
  const cx = cxOf(it, lang);
  return `<article class="nrow" id="n-${esc(it.id)}" data-type="${esc(it.type)}" data-kind="${esc(it.kind || 'wire')}" data-date="${esc(it.date)}"
    data-q="${esc(q)}">
  ${art(it)}
  <div class="nb">
    <p class="ch">${chips(it, lang, PF)}</p>
    <h4>${hl}</h4>
    ${pointsHtml(it, lang)}
    ${cx ? `<p class="cx">${esc(cx)}</p>` : ''}
    <p class="sl">${sources(it, lang, PF)}${it.note ? `<span class="nt mono">${esc(lang === 'id' && it.note_id ? it.note_id : it.note)}</span>` : ''}</p>
  </div>
</article>`;
}

function lead(it, lang, PF) {
  const cx = cxOf(it, lang);
  return `<section class="leadwrap wrap"><article class="lead" id="n-${esc(it.id)}">
  <div class="la">${art(it)}</div>
  <div class="lb">
    <p class="ch">${chips(it, lang, PF)}</p>
    <h2>${esc(hlOf(it, lang))}</h2>
    ${pointsHtml(it, lang)}
    ${cx ? `<p class="cx">${esc(cx)}</p>` : ''}
    <p class="sl">${sources(it, lang, PF)}<span class="dt mono">${esc(dayHead(it.date, lang))}</span></p>
  </div>
</article></section>`;
}

function news({ data, news, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const items = (news && news.items) || [];
  // Real logos only in the feed (Luca, Aug 30) — remap any sprite art still in
  // the published JSON; the pipeline stopped emitting sprites the same day.
  const byId = new Map(((data && data.companies) || []).map((c) => [c.id, c]));
  for (const it of items) {
    if (it.art && it.art.kind === 'sprite') {
      const c = byId.get(it.art.company);
      it.art = c && c.logo
        ? { kind: 'logo', src: c.logo, company: c.id }
        : { kind: 'tile', sector: (c && c.sector_key) || 'misc', company: it.art.company };
    }
  }
  const generated = ((news && news.generated) || '').slice(0, 16).replace('T', ' ');
  const counts = {};
  for (const it of items) counts[it.type] = (counts[it.type] || 0) + 1;
  const nSig = items.filter((i) => i.kind === 'signal').length;
  const nOrig = items.filter((i) => i.kind === 'original').length;

  // Lead = the most newsworthy recent story, not the prettiest thumbnail —
  // the first cut led with a vendor pitch because it had a logo while the
  // biggest funding round of the window sat in the feed. Score: event weight,
  // corroboration, census relevance; art is a tiebreak.
  const TYPE_W = { funding: 5, ma: 4, ipo: 4, regulatory: 2, people: 2, product: 1, market: 1 };
  const newest = items.length ? items[0].date : '';
  const recent = items.filter((i) => i.kind === 'wire' && pointsOf(i, 'en').length &&
    (new Date(newest) - new Date(i.date)) / 86400000 <= 4);
  let leadIt = null;
  let best = -1;
  for (const i of recent) {
    const score = (TYPE_W[i.type] || 0) +
      Math.min((i.sources || []).length, 4) +
      ((i.companies || []).length ? 1 : 0) +
      (i.art && i.art.kind !== 'tile' ? 0.5 : 0);
    if (score > best) { best = score; leadIt = i; }
  }
  if (!leadIt) leadIt = items.find((i) => i.kind === 'wire' && pointsOf(i, 'en').length) || null;
  const rest = leadIt ? items.filter((i) => i !== leadIt) : items;

  // Day-grouped feed (lead excluded).
  const byDay = new Map();
  for (const it of rest) {
    if (!byDay.has(it.date)) byDay.set(it.date, []);
    byDay.get(it.date).push(it);
  }
  const feed = [...byDay.entries()].map(([d, list]) =>
    `<div class="day" data-day="${esc(d)}"><h3 class="dh mono">${esc(dayHead(d, lang))}</h3>${list.map((it) => row(it, lang, PF)).join('')}</div>`
  ).join('');

  // Top-of-the-wire rail (replaced the marquee ticker, Luca Aug 30: chopped
  // uppercase text, no way to see WHO a story is about). Cards carry the
  // company mark via art(it) — runs after the sprite→logo remap above.
  const railCards = items.slice(0, 12).map((it) => {
    const t = TYPES[it.type] || TYPES.market;
    const d = new Date(it.date + 'T00:00:00Z');
    const dt = Number.isNaN(d.getTime()) ? it.date
      : lang === 'id' ? `${d.getUTCDate()} ${MONS_ID[d.getUTCMonth()]}` : `${MONS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    return `<a class="rcard" href="#n-${esc(it.id)}">
    <span class="rtop">${art(it)}<span class="rmeta">
      <span class="rk" style="--tc:${t.c}"><span class="sq"></span>${esc(tLabel(t, lang))}</span>
      <span class="rd">${esc(dt)}</span></span></span>
    <span class="rh">${esc(hlOf(it, lang))}</span></a>`;
  }).join('');

  const chipsBar = ['funding', 'ma', 'ipo', 'regulatory', 'people', 'product', 'market']
    .filter((t) => counts[t])
    .map((t) => `<button class="chip" data-f="${t}" aria-pressed="false">${tLabel(TYPES[t], lang)} · ${counts[t]}</button>`)
    .join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('News — 1001startup.id', 'Berita Startup Indonesia — 1001startup.id')}</title>
<meta name="description" content="${L('Automated, attributed startup journalism over the Indonesian census — funding, people moves, M&A and regulation, every source linked.', 'Berita startup Indonesia dari kawat sensus: pendanaan, pergantian manajemen, M&A, dan regulasi — diringkas dengan kata kami sendiri, dan setiap sumbernya tertaut.')}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, '/news')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('News', 'Berita'), path: '/news' }])}
${I18N.ogImage()}
<meta property="og:title" content="${L('The Wire — 1001startup.id', 'Kawat Berita — 1001startup.id')}">
<meta property="og:description" content="${L('Automated, attributed startup journalism over the Indonesian census.', 'Jurnalisme startup otomatis di atas sensus — setiap berita menyebut sumbernya.')}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.phead{max-width:1180px;margin:0 auto;padding:44px 20px 24px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.phead h1{font-size:clamp(34px,4.6vw,56px);line-height:1.02;letter-spacing:-0.03em;font-weight:500}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.pmeta{font:400 11px/1.7 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:right}
.pmeta a{color:#52525B}
/* ---- top-of-the-wire rail ---- */
.railwrap{border-top:1px solid #E7E7E7;border-bottom:1px solid #E7E7E7;background:#fff}
.railbar{max-width:1180px;margin:0 auto;padding:12px 20px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
.railbar .rt{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;display:flex;gap:8px;align-items:center}
.railbar .rt .sq{width:6px;height:6px;background:#C05A2E;display:inline-block}
.railnav{display:flex;gap:6px;align-items:center}
.railidx{font-size:10px;color:#6B6B73;margin-right:4px;font-variant-numeric:tabular-nums}
.rbtn{width:28px;height:28px;border:1px solid #D9D9DE;background:#fff;color:#26262B;cursor:pointer;display:grid;place-items:center;font:500 15px/1 'Overused Grotesk',system-ui,sans-serif;padding:0}
.rbtn:hover{border-color:#000;color:#000}
.rbtn:active{background:#000;color:#fff;border-color:#000}
/* Paged carousel INSIDE the content column (Luca, Aug 30: "fix the margin,
   that should be carousel") — the old full-bleed scroller only honoured the
   column on the left at scrollLeft 0; every card after that ran under the
   page margin and got chopped at the viewport edge. .railin owns the gutter,
   .rail has no horizontal padding, and cards tile to exact thirds so a page
   is always whole cards flush to both margins — nothing is ever half-cut. */
.railin{max-width:1180px;margin:0 auto;padding:0 20px}
.rail{--rgap:44px;display:flex;gap:var(--rgap);overflow-x:auto;scroll-snap-type:x mandatory;padding:12px 0 16px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.rail::-webkit-scrollbar{display:none}
.rcard{position:relative;flex:0 0 calc((100% - 2*var(--rgap))/3);scroll-snap-align:start;text-decoration:none;display:flex;flex-direction:column;gap:9px;min-width:0}
/* Divider centred in the gap; suppressed at every page boundary so no
   hairline ever lands on the column edge. */
.rcard::after{content:"";position:absolute;top:2px;bottom:2px;right:calc(var(--rgap)/-2);width:1px;background:#ECECEC}
.rcard:nth-child(3n)::after,.rcard:last-child::after{display:none}
.rcard:hover .rh{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.rtop{display:flex;gap:10px;align-items:center}
.rcard .na{width:42px;height:42px;background:#FAFAFA;border:1px solid #EFEFEF}
.rcard .na.lg img{width:30px;height:30px}
.rcard .na.sp img{width:38px;max-height:38px;object-fit:contain}
.rcard .na.tl{width:42px;height:42px;font-size:17px;border:0}
.rmeta{display:flex;flex-direction:column;gap:5px;min-width:0}
.rcard .rk{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--tc);display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
.rcard .rk .sq{width:5px;height:5px;background:var(--tc);display:inline-block;flex:0 0 auto}
.rcard .rd{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.rcard .rh{font-size:14.5px;line-height:1.32;letter-spacing:-0.012em;font-weight:530;color:#000;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:940px){.rail{--rgap:36px}.rcard{flex-basis:calc((100% - var(--rgap))/2)}
  .rcard:nth-child(3n)::after{display:block}
  .rcard:nth-child(2n)::after,.rcard:last-child::after{display:none}}
@media(max-width:620px){.rail{--rgap:24px}.rcard{flex-basis:100%}.rcard::after{display:none}}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
.nrow,.lead{scroll-margin-top:84px}
.nrow:target,.lead:target{background:#FBF9F4}
/* ---- lead ---- */
.leadwrap{padding-top:26px}
.lead{display:grid;grid-template-columns:300px 1fr;gap:34px;border:1px solid #E7E7E7;position:relative;padding:26px}
.lead::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:${GRAD}}
.la{display:grid;place-items:center;background:#FAFAFA;border:1px solid #EFEFEF;min-height:230px}
.la .na.sp img{width:230px;height:auto}
.la .na.lg img{width:110px;height:110px}
.la .na.tl{width:110px;height:110px;font-size:44px}
.lead h2{font-size:clamp(24px,3vw,36px);line-height:1.08;letter-spacing:-0.025em;font-weight:530;margin:10px 0 12px;text-wrap:balance}
.lead .bf{font-size:17px;color:#26262B;max-width:62ch}
@media(max-width:820px){.lead{grid-template-columns:1fr}.la{min-height:170px}.la .na.sp img{width:170px}}
/* ---- feed ---- */
.feedwrap{max-width:1180px;margin:0 auto;padding:8px 20px 30px}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:22px 0 6px;position:sticky;top:0;background:#fff;z-index:20;border-bottom:1px solid #E7E7E7}
.toolbar input{font:inherit;font-size:14px;border:1px solid #D9D9DE;padding:8px 12px;min-width:210px;flex:1;max-width:330px}
.toolbar input:focus{outline:2px solid #000;outline-offset:-1px}
.chip{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;border:1px solid #D9D9DE;background:#fff;color:#52525B;padding:8px 10px;cursor:pointer}
.chip[aria-pressed="true"]{background:#000;color:#fff;border-color:#000}
.count{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;margin-left:auto}
.dh{font-size:11px;color:#6B6B73;padding:26px 0 4px;border-bottom:1px solid #E7E7E7}
.nrow{display:grid;grid-template-columns:56px 1fr;gap:18px;padding:18px 0;border-bottom:1px solid #F0F0F0}
.na{display:grid;place-items:center;overflow:hidden}
.nrow .na{width:56px;height:56px;background:#FAFAFA;border:1px solid #EFEFEF}
.nrow .na.sp img{width:52px;height:auto;max-height:52px;object-fit:contain}
.nrow .na.lg img{width:40px;height:40px}
.nrow .na.tl,.na.tl{color:#fff;font-weight:600}
.nrow .na.tl{font-size:22px;width:56px;height:56px;border:0}
.ch{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.tch{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--tc);display:inline-flex;align-items:center;gap:6px}
.tch .sq{width:6px;height:6px;background:var(--tc);display:inline-block}
.cch{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B;text-decoration:none;border:1px solid #E2E2E6;padding:3px 6px}
.cch:hover{border-color:#000;color:#000}
.sch{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;border:1px dashed #D9D9DE;padding:3px 6px}
.och{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#2F7A5C;border:1px solid #2F7A5C;padding:3px 6px}
.nrow h4{font-size:18.5px;line-height:1.22;letter-spacing:-0.015em;font-weight:530;max-width:76ch}
.nrow h4 .ext{text-decoration:none;border-bottom:1px solid #D9D9D9}
.nrow h4 .ext:hover{border-color:#000}
.bf{font-size:15px;line-height:1.5;color:#3F3F46;margin-top:5px;max-width:76ch}
.pts{list-style:none;margin-top:7px;max-width:76ch}
.pts li{font-size:15px;line-height:1.5;color:#3F3F46;padding-left:16px;position:relative;margin-top:4px}
.pts li::before{content:'';position:absolute;left:0;top:.55em;width:5px;height:5px;background:#B9B9BE}
.lead .pts li{font-size:16.5px}
.lead .pts li::before{background:#26262B}
.cx{font-size:13.5px;line-height:1.5;color:#52525B;margin-top:7px;padding-left:10px;border-left:2px solid #E8734B;max-width:70ch}
.sl{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-top:9px}
.src{font-size:10.5px;color:#6B6B73}
.src a{color:#52525B;text-decoration:none;border-bottom:1px solid #E2E2E6}
.src a:hover{color:#000;border-color:#000}
.src .dot{color:#C9C9CE;padding:0 6px}
.nt{font-size:10px;color:#86653C}
.dt{font-size:10.5px;color:#6B6B73;margin-left:auto}
.more{display:block;margin:26px auto 0;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border:1px solid #000;background:#fff;padding:12px 22px;cursor:pointer}
.more:hover{background:#000;color:#fff}
.empty{padding:60px 0;color:#6B6B73}
/* ---- how ---- */
.how{max-width:1180px;margin:0 auto;padding:34px 20px 10px}
.how h4{font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;gap:8px;align-items:center}
.how h4 .sq{width:6px;height:6px;background:#000}
.how p{font-size:14.5px;color:#52525B;max-width:86ch;margin-bottom:8px}
.how a{color:#26262B}
/* ---- refresh pill ---- */
.newpill{position:fixed;right:18px;bottom:18px;z-index:95;background:#000;color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:12px 16px;border:0;cursor:pointer;display:none}
.newpill.show{display:block}
footer{max-width:1180px;margin:36px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
footer a{color:#52525B}
@media(max-width:700px){.nrow{grid-template-columns:44px 1fr;gap:12px}.nrow .na{width:44px;height:44px}.nrow .na.tl{width:44px;height:44px;font-size:18px}.nrow .na.sp img{width:40px;max-height:40px}.nrow .na.lg img{width:32px;height:32px}.pmeta{text-align:left}}
</style>
</head>
<body>
<div class="banner">${L('AUTOMATED WIRE · BRIEFS IN OUR OWN WORDS · EVERY ITEM LINKS TO ITS REPORTING', 'KAWAT BERITA OTOMATIS · DIRINGKAS DENGAN KATA KAMI SENDIRI · SETIAP BERITA TERTAUT KE SUMBERNYA')}</div>
${NAV.header('news', { lang, path: '/news', translated: true })}
<div class="phead">
  <div>
    <p class="eyebrow"><span class="sq"></span>${L('The wire', 'Kawat berita')}</p>
    <h1>${L('What moved.', 'Kabar terbaru.')}</h1>
  </div>
  <p class="pmeta">${items.length}${L(' stories on the wire', ' berita di kawat')}${nSig ? ` · ${nSig}${L(' census signals', ' sinyal sensus')}` : ''}<br>
  ${L('pipeline last ran ', 'pipeline terakhir jalan ')}${esc(generated)} UTC · <a href="#how">${L('how this is made', 'cara halaman ini dibuat')}</a></p>
</div>
${railCards ? `<section class="railwrap" aria-label="${L('Top of the wire', 'Sorotan utama')}">
  <div class="railbar">
    <p class="rt mono"><span class="sq"></span>${L('Top of the wire', 'Sorotan utama')}</p>
    <div class="railnav">
      <span class="railidx mono" id="railidx"></span>
      <button class="rbtn" id="rprev" type="button" aria-label="${L('Previous stories', 'Berita sebelumnya')}">‹</button>
      <button class="rbtn" id="rnext" type="button" aria-label="${L('Next stories', 'Berita berikutnya')}">›</button>
    </div>
  </div>
  <div class="railin"><div class="rail" id="rail">${railCards}</div></div>
</section>` : ''}
${leadIt ? lead(leadIt, lang, PF) : ''}
<div class="feedwrap">
  <div class="toolbar">
    <input id="q" type="search" placeholder="${L('Search the wire — company, investor, keyword', 'Cari berita — perusahaan, investor, kata kunci')}" aria-label="${L('Search news', 'Cari berita')}">
    ${chipsBar}
    ${nOrig ? `<button class="chip" data-f="original" aria-pressed="false">${L('Primary source', 'Sumber primer')} · ${nOrig}</button>` : ''}
    ${nSig ? `<button class="chip" data-f="signal" aria-pressed="false">${L('Census signals', 'Sinyal sensus')} · ${nSig}</button>` : ''}
    <span class="count" id="count"></span>
  </div>
  <div id="feed">${feed || `<p class="empty">${L('The wire is empty — the pipeline has not published yet.', 'Belum ada berita — pipeline belum menerbitkan apa pun.')}</p>`}</div>
  <button class="more" id="more" hidden>${L('Show more', 'Tampilkan lebih banyak')}</button>
</div>
<section class="how" id="how">
  <h4><span class="sq"></span>${L('How this page is made', 'Cara halaman ini dibuat')}</h4>
  <p>${L('A pipeline discovers reporting about Indonesian startups from a fixed list of credible outlets, matches it against the census, groups the outlets covering the same story, and writes the two-sentence brief you read here in its own words. The orange-edged line under a brief is census context — our own data on that company. Facts belong to the cited outlets: every item names and links every source it draws on (UU 28/2014 Pasal 43(c): use of current news with full attribution).',
  'Sebuah pipeline menemukan pemberitaan tentang startup Indonesia dari daftar tetap media yang kredibel, mencocokkannya dengan sensus, mengelompokkan media yang meliput peristiwa yang sama, lalu menulis ringkasan dua kalimat yang dibaca di sini dengan kata-katanya sendiri. Garis bertepi oranye di bawah ringkasan adalah konteks sensus — data kami sendiri tentang perusahaan itu. Fakta tetap milik media yang dikutip: setiap berita menyebut dan menautkan semua sumber yang dipakainya (UU 28/2014 Pasal 43 huruf c: pemanfaatan berita aktual dengan penyebutan sumber selengkapnya).')}</p>
  <p>${L('Items marked <em>primary source</em> are read from a company\'s own site or announcement — no outlet in between; they are the company\'s claims and are attributed as such. Items marked <em>census signal</em> are not press coverage at all — they are movements in the census\'s own tracked data: LinkedIn-read headcount changes between runs, dated and sourced on the company profile. A company being added to the census is not one of them; that is a change to our database, not a story, and it does not appear on the wire. Paywalled reporting is never summarized from its text; it appears as a headline and a link. Artwork is the census\'s own (building sprites and logo tiles) — press photographs are never republished. Briefs the pipeline is not confident in are held back for review, not published.',
  'Berita bertanda <em>sumber primer</em> dibaca langsung dari situs atau pengumuman perusahaannya sendiri — tanpa media di tengahnya; isinya klaim perusahaan, dan diatribusikan sebagai itu. Berita bertanda <em>sinyal sensus</em> sama sekali bukan liputan pers — itu pergerakan pada data pantauan sensus sendiri: perubahan jumlah pekerja hasil pembacaan LinkedIn antar-penyisiran, bertanggal dan bersumber di profil perusahaan. Perusahaan yang baru masuk sensus tidak termasuk; itu perubahan pada basis data kami, bukan berita, dan tidak pernah tampil di kawat. Pemberitaan berbayar tidak pernah diringkas dari isinya; ia hanya tampil sebagai judul dan tautan. Semua gambar milik sensus sendiri (sprite gedung dan ubin logo) — foto pers tidak pernah dimuat ulang. Ringkasan yang belum diyakini pipeline ditahan untuk ditinjau, bukan diterbitkan.')}</p>
  <p>${L('Corrections: every company figure cited in context lines follows the census\'s <a href="/coverage#method">method</a> and links to its source on the <a href="/#companies">company record</a>.',
  `Koreksi: setiap angka perusahaan yang dikutip di baris konteks mengikuti <a href="${PF}/coverage#method">metode sensus</a> dan tertaut ke sumbernya di <a href="${PF}/#companies">catatan perusahaannya</a>.`)}</p>
</section>
<footer>
  <span>1001startup.id — ${L('the census of Indonesian startups', 'sensus startup Indonesia')}</span>
  <span><a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Briefs: own words, sources linked · updated ', 'Ringkasan: kata kami sendiri, sumber tertaut · diperbarui ')}${esc(((news && news.generated) || '').slice(0, 10))}</span>
</footer>
<button class="newpill" id="newpill" type="button">${L('New on the wire — refresh', 'Ada berita baru — muat ulang')}</button>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/news1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { news };
