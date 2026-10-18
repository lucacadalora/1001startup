'use strict';
/**
 * 1001startup.id — My 1001 (/me, /id/me): what a signed-in reader follows.
 * Dashboard slice 1 (Luca, 18 Oct 2026; plan
 * https://claude.ai/artifact/CavAoXkc8XgExFGG5th8uH): phone first, one column;
 * the desktop terminal is slice 2.
 *
 * Followed startups sit in table#tbl as tr[data-id] rows, so
 * public/js/company1001.js opens their full card in the same drawer the census
 * table uses (a bottom sheet on phones). State companies, data centres and
 * investors link to their own pages. Every Follow button on 1001 is
 * public/js/follow1001.js; its styles and the sign-in-to-follow popup are
 * `css` below, which lib/account1001.js puts in the <head> of 1001 pages while
 * data/me.live exists.
 *
 * Slice 3 (Luca, 18 Oct 2026): widgets under the list, all from data 1001
 * already has: new rounds (by year), most read this week (visitor counter),
 * investors (followed ones with their companies, or the biggest), sector
 * pulse (your sectors first) and closed companies. Each can be hidden with
 * one line in data/me-widgets-off.txt (rounds, read, investors, sectors,
 * closed).
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const { shell } = require('./browse1001');
const { V } = require('./html');
const NAV = require('./nav1001');

/* Luca's call 4: one skippable question after sign-up */
const ROLES = [
  ['founder', 'Founder', 'Founder'],
  ['investor', 'Investor', 'Investor'],
  ['corporate', 'Corporate', 'Korporat'],
  ['government', 'Government', 'Pemerintah'],
  ['journalist', 'Journalist', 'Jurnalis'],
  ['student', 'Student', 'Mahasiswa'],
  ['other', 'Other', 'Lainnya'],
];
const ROLE_KEYS = ROLES.map(([k]) => k);
const KIND = {
  company: ['Startup', 'Startup'],
  bumn: ['BUMN', 'BUMN'],
  dc: ['Data centre', 'Pusat data'],
  investor: ['Investor', 'Investor'],
};

const n0 = (x) => Math.round(Number(x || 0)).toLocaleString('en-US');
function usd(m) {
  if (typeof m !== 'number' || !(m > 0)) return '';
  if (m >= 1000) return 'US$' + (Math.round(m / 100) / 10).toString() + 'B';
  return 'US$' + (m >= 100 ? Math.round(m) : Math.round(m * 10) / 10) + 'M';
}
function idrT(v) {
  if (typeof v !== 'number') return '';
  return 'Rp' + (v >= 100 ? n0(v) : Math.round(v * 10) / 10) + 'T';
}
/* "Series C (US$70M)" -> "Series C"; long notes stay short */
function round(s) {
  const t = String(s || '').split('(')[0].split(' — ')[0].trim();
  return t.length > 30 ? t.slice(0, 29).trim() + '…' : t;
}
const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

/** One row's second line, in the reader's language. */
function subLine(r, L) {
  const o = r.obj;
  if (r.kind === 'company') {
    return [o.sector_label,
      usd(o.funding_total_usd_m) && L(`${usd(o.funding_total_usd_m)} raised`, `dana ${usd(o.funding_total_usd_m)}`),
      o.last_round_year && `${round(o.last_round)} ${o.last_round_year}`.trim(),
      o.employees_est && L(`${n0(o.employees_est)} people`, `${n0(o.employees_est)} orang`)].filter(Boolean).join(' · ');
  }
  if (r.kind === 'bumn') {
    const f = o.fin || {};
    return [o.sector,
      f.revenue && f.revenue.v != null && L(`revenue ${idrT(f.revenue.v)}`, `pendapatan ${idrT(f.revenue.v)}`),
      f.net_profit && f.net_profit.v != null && L(`profit ${idrT(f.net_profit.v)}`, `laba ${idrT(f.net_profit.v)}`),
      f.revenue && f.revenue.period].filter(Boolean).join(' · ');
  }
  if (r.kind === 'dc') return [o.op, cap(o.region), o.status, o.mw].filter(Boolean).join(' · ');
  if (r.kind === 'investor') {
    return [L(`${o.cos.length} ${o.cos.length === 1 ? 'company' : 'companies'} in the census`, `${o.cos.length} perusahaan di sensus`),
      (o.sectors || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  }
  return '';
}

function rowHtml(r, L, following) {
  const tag = KIND[r.kind] ? L(KIND[r.kind][0], KIND[r.kind][1]) : '';
  const logo = r.logo
    ? `<img src="${esc(r.logo)}" alt="" width="36" height="36" loading="lazy">`
    : `<span class="me-ini" aria-hidden="true">${esc(String(r.name || '?').trim().slice(0, 2).toUpperCase())}</span>`;
  return `<tr${r.kind === 'company' ? ` data-id="${esc(r.ref)}"` : ''}>
  <td class="me-lg">${logo}</td>
  <td class="me-mn"><a${r.kind === 'company' ? ' class="cp-link"' : ''} href="${esc(r.href)}">${esc(r.name)}</a><span class="me-k">${esc(tag)}</span><div class="me-s">${esc(subLine(r, L))}</div></td>
  <td class="me-fw"><button class="fw1001" type="button" data-fk="${esc(r.kind)}" data-fr="${esc(r.ref)}" hidden>${following ? L('Following', 'Diikuti') : L('Follow', 'Ikuti')}</button></td>
</tr>`;
}

const fw = (kind, ref, L) => `<button class="fw1001" type="button" data-fk="${esc(kind)}" data-fr="${esc(ref)}" hidden>${L('Follow', 'Ikuti')}</button>`;
const day = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const month = (ym, lang) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : String(ym || '');
};
/* title, a count on the right, the body, one plain line under it */
const widget = (key, title, count, body, foot) => `
  <section class="me-w" data-w="${key}">
    <h2 class="me-wh"><i aria-hidden="true"></i>${esc(title)}${count ? `<em>${esc(count)}</em>` : ''}</h2>
    ${body}
    ${foot ? `<p class="me-wf">${foot}</p>` : ''}
  </section>`;

function wRounds(w, L, PF, lang) {
  if (!w || !w.items.length) return '';
  return widget('rounds', L('New rounds, 2025–26', 'Pendanaan baru, 2025–26'), n0(w.total),
    `<ul class="me-wl">${w.items.map((c) => `<li><div class="me-wm"><a href="${PF}/company/${encodeURIComponent(c.id)}">${esc(c.name)}</a><span>${esc([`${round(c.last_round)} ${c.last_round_year}`.trim(),
      usd(c.funding_total_usd_m) && L(`${usd(c.funding_total_usd_m)} raised in all`, `total dana ${usd(c.funding_total_usd_m)}`), c.sector_label].filter(Boolean).join(' · '))}</span></div>${fw('company', c.id, L)}</li>`).join('')}</ul>`,
    esc(L(`Startups whose last round was in 2025 or 2026, latest year first, then by money raised. The census dates a round by its year. As of ${day(w.asof, lang)}.`,
      `Startup yang putaran terakhirnya di 2025 atau 2026, tahun terbaru dulu, lalu menurut total dana. Sensus mencatat tahun putaran. Per ${day(w.asof, lang)}.`)));
}

function wRead(w, L, PF) {
  if (!w || !w.length) return '';
  return widget('read', L('Most read this week', 'Paling banyak dibaca minggu ini'), '',
    `<ul class="me-wl">${w.map((x) => `<li><div class="me-wm"><a href="${PF}/company/${encodeURIComponent(x.c.id)}">${esc(x.c.name)}</a><span>${esc([L(`${n0(x.n)} ${x.n === 1 ? 'reader' : 'readers'}`, `${n0(x.n)} pembaca`), x.c.sector_label].filter(Boolean).join(' · '))}</span></div>${fw('company', x.c.id, L)}</li>`).join('')}</ul>`,
    esc(L('People who opened each company page in the last 7 days, counted by 1001’s own visitor counter.', 'Orang yang membuka halaman tiap perusahaan dalam 7 hari terakhir, dihitung penghitung pengunjung 1001 sendiri.')));
}

function wInvestors(w, L, PF) {
  if (!w) return '';
  if (w.mine.length) {
    return widget('investors', L('Investors you follow', 'Investor yang kamu ikuti'), n0(w.mine.length),
      `<ul class="me-wl">${w.mine.map((e) => {
        const more = e.cos.length - 4;
        return `<li><div class="me-wm"><a href="${PF}/investor/${encodeURIComponent(e.slug)}">${esc(e.name)}</a><span>${esc(L(`${n0(e.cos.length)} ${e.cos.length === 1 ? 'company' : 'companies'} in the census`, `${n0(e.cos.length)} perusahaan di sensus`))}</span><span class="me-wc">${e.cos.slice(0, 4).map((x) => `<a href="${PF}/company/${encodeURIComponent(x.c.id)}">${esc(x.c.name)}</a>`).join(', ')}${more > 0 ? esc(L(` and ${more} more`, ` dan ${more} lainnya`)) : ''}</span></div>${fw('investor', e.slug, L)}</li>`;
      }).join('')}</ul>`, '');
  }
  if (!w.top.length) return '';
  return widget('investors', L('Investors with the most companies', 'Investor dengan perusahaan terbanyak'), '',
    `<ul class="me-wl">${w.top.map((e) => `<li><div class="me-wm"><a href="${PF}/investor/${encodeURIComponent(e.slug)}">${esc(e.name)}</a><span>${esc([L(`${n0(e.cos.length)} companies in the census`, `${n0(e.cos.length)} perusahaan di sensus`), (e.sectors || []).slice(0, 2).join(', ')].filter(Boolean).join(' · '))}</span></div>${fw('investor', e.slug, L)}</li>`).join('')}</ul>`,
    esc(L('Follow an investor and its companies show up here.', 'Ikuti investor, dan perusahaannya muncul di sini.')));
}

function wSectors(list, L, PF) {
  if (!list || !list.length) return '';
  const top = list.slice(0, 8);
  const max = Math.max(...top.map((x) => x.count || 0), 1);
  return widget('sectors', L('Sector pulse', 'Denyut sektor'), '',
    `<ul class="me-wl">${top.map((x) => `<li class="me-ws"><div class="me-wm">${x.key ? `<a href="${PF}/sector/${encodeURIComponent(x.key)}">${esc(x.name)}</a>` : `<b>${esc(x.name)}</b>`}${x.mine ? `<b class="me-y">${L('yours', 'milikmu')}</b>` : ''}<span>${esc(L(`${n0(x.count)} companies · ${n0(x.jobs)} jobs`, `${n0(x.count)} perusahaan · ${n0(x.jobs)} pekerjaan`))}</span><span class="me-bar"><i style="width:${Math.max(2, Math.round((x.count / max) * 100))}%"></i></span></div></li>`).join('')}</ul>`,
    esc(L('Companies and estimated jobs per sector in the census. Sectors of the startups you follow come first.', 'Jumlah perusahaan dan perkiraan pekerjaan per sektor di sensus. Sektor startup yang kamu ikuti tampil lebih dulu.')));
}

function wClosed(list, L, PF, lang) {
  if (!list || !list.length) return '';
  return widget('closed', L('Closed', 'Sudah tutup'), '',
    `<ul class="me-wl">${list.map((x) => `<li><div class="me-wm"><a href="${PF}/closed">${esc(x.name)}</a><span>${esc([L(`Stopped ${month(x.ended, lang)}`, `Berhenti ${month(x.ended, lang)}`),
      String(x.sector || '').split(' — ')[0], Number(x.funding_usd_m) > 0 && L(`had raised ${usd(Number(x.funding_usd_m))}`, `pernah mendapat ${usd(Number(x.funding_usd_m))}`)].filter(Boolean).join(' · '))}</span></div></li>`).join('')}</ul>`,
    `${esc(L('Latest first, from the census register of companies that stopped; each entry has its sources.', 'Terbaru dulu, dari daftar sensus perusahaan yang berhenti; tiap entri ada sumbernya.'))} <a href="${PF}/closed">${esc(L('See all', 'Lihat semua'))}</a>`);
}

function roleButtons(L, lang) {
  return `<input type="hidden" name="lang" value="${lang === 'id' ? 'id' : 'en'}">
      ${ROLES.map(([k, en, id]) => `<button type="submit" name="role" value="${k}">${esc(L(en, id))}</button>`).join('')}`;
}

/* the page's styles; the dashboard (views/dash1001.js) reuses the widget rules */
const STYLE = `<style>
.me{max-width:760px;margin:0 auto;padding:40px 20px 8px;display:grid;gap:28px}
.me-hd h1{font-size:clamp(30px,5vw,44px);line-height:1.05;letter-spacing:-0.03em;font-weight:500;margin-top:12px}
.me-sub{color:#52525B;font-size:15px;line-height:1.55;margin-top:8px;overflow-wrap:anywhere}
.me-q{border:1px solid #000;padding:18px;display:grid;gap:10px}
.me-q h2{font-size:19px;font-weight:600;letter-spacing:-0.01em}
.me-q p{color:#52525B;font-size:14px;line-height:1.5}
.me-roles{display:flex;flex-wrap:wrap;gap:8px}
.me-roles button{border:1px solid #000;background:#fff;color:#000;font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;padding:11px 13px;cursor:pointer;border-radius:0}
.me-roles button:hover{background:#000;color:#fff}
.me-roles .skip{border-color:#D9D9DE;color:#52525B}
.me .me-t{width:100%;min-width:0;border-collapse:collapse;font-size:inherit}   /* the shell gives every table min-width:760px */
.me-t td{padding:13px 0;border-bottom:1px solid #F1F1F1;vertical-align:top}
.me-t tr:first-child td{border-top:1px solid #E7E7E7}
.me-t tr[data-id]{cursor:pointer}
.me-lg{width:50px}
.me-lg img,.me-ini{width:36px;height:36px;display:block;object-fit:contain;border:1px solid #F1F1F1;background:#fff}
.me-ini{display:grid;place-items:center;font:400 11px/1 'IBM Plex Mono',monospace;color:#6B6B73;background:#FAFAFA}
.me-mn{padding-right:12px!important;min-width:0}
.me-mn a{font-weight:600;font-size:16px;line-height:1.3;text-decoration:none;color:#000}
.me-mn a:hover{text-decoration:underline;text-underline-offset:3px}
.me-k{font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;border:1px solid #D9D9DE;color:#6B6B73;padding:2px 4px;margin-left:7px;vertical-align:2px;white-space:nowrap}
.me-s{font-size:13.5px;line-height:1.45;color:#52525B;margin-top:3px;overflow-wrap:anywhere}
.me-fw{width:1%;white-space:nowrap;text-align:right}
.me-empty p{font-size:15px;line-height:1.55;color:#3F3F46;margin-bottom:14px}
.me-more{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.me-more span{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;width:100%;margin-bottom:2px}
.me-more a{border:1px solid #E7E7E7;padding:9px 12px;text-decoration:none;color:#000;font-size:14px}
.me-more a:hover{border-color:#000}
.me-prof{display:grid;gap:12px}
.me-prof h2{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73}
.me-prof dl{margin:0;border-top:1px solid #E7E7E7}
.me-prof dl>div{display:grid;grid-template-columns:140px minmax(0,1fr);gap:10px;padding:11px 0;border-bottom:1px solid #F1F1F1;font-size:14.5px}
.me-prof dt{color:#6B6B73}
.me-prof dd{margin:0;min-width:0;overflow-wrap:anywhere}
.me-chg{display:inline}
.me-chg summary{display:inline;cursor:pointer;color:#52525B;text-decoration:underline;text-underline-offset:3px;font-size:13.5px;margin-left:8px}
.me-chg .me-roles{margin-top:10px}
.me-out .btn{margin-top:4px}
.me-w{display:grid;gap:10px}
.me-wh{display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;margin:0}
.me-wh i{width:6px;height:6px;background:#E8734B;display:inline-block;flex:none}
.me-wh em{font-style:normal;margin-left:auto;color:#000}
.me-wl{list-style:none;margin:0;padding:0;border-top:1px solid #E7E7E7}
.me-wl li{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:11px 0;border-bottom:1px solid #F1F1F1}
.me-wl li .fw1001{flex:none}
.me-wl li.me-ws .me-wm{flex:1}
.me-wm{min-width:0;display:grid;gap:3px}
.me-wm>a,.me-wm>b:first-child{font-weight:600;font-size:15px;line-height:1.3;color:#000;text-decoration:none}
.me-wm>a:hover{text-decoration:underline;text-underline-offset:3px}
.me-wm span{font-size:13px;line-height:1.45;color:#52525B;overflow-wrap:anywhere}
.me-wc a{font-weight:500;color:#3F3F46;text-decoration:underline;text-decoration-color:#D9D9DE;text-underline-offset:3px}
.me-y{justify-self:start;font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:#E8734B;color:#fff;padding:3px 5px}
.me-bar{display:block;height:6px;background:#F3F3F5;margin-top:3px}
.me-bar i{display:block;height:100%;background:#2A6E9F}
.me-wf{font-size:12.5px;line-height:1.5;color:#6B6B73;margin:0}
.me-wf a{color:#52525B}
@media(max-width:560px){.me{padding:24px 16px 4px;gap:22px}.me-prof dl>div{grid-template-columns:1fr;gap:2px}.me-lg{width:46px}}
</style>
`;

/** /me for a signed-in reader. rows/suggest: [{ kind, ref, name, href, logo, obj }] */
function page({ lang = 'en', user, rows, widgets = {} }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const asked = !!user.role_at;
  const role = ROLES.find(([k]) => k === user.role);
  const joined = user.created_at
    ? new Date(String(user.created_at).replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '';
  const question = asked ? '' : `
  <section class="me-q" aria-labelledby="me-q-h">
    <h2 id="me-q-h">${L('One question: what do you do?', 'Satu pertanyaan: apa pekerjaanmu?')}</h2>
    <p>${L('It tells us who reads 1001. You can change it later, or skip it.', 'Supaya kami tahu siapa pembaca 1001. Bisa diubah nanti, atau dilewati.')}</p>
    <form method="POST" action="/me/role" class="me-roles">
      ${roleButtons(L, lang)}
      <button type="submit" name="skip" value="1" class="skip">${L('Skip', 'Lewati')}</button>
    </form>
  </section>`;
  const list = rows.length
    ? `<table id="tbl" class="me-t"><tbody>${rows.map((r) => rowHtml(r, L, true)).join('')}</tbody></table>`
    : `<div class="me-empty">
    <p><b>${L('You don’t follow anything yet.', 'Kamu belum mengikuti apa pun.')}</b> ${L('Tap + Follow on any startup, state company, data centre or investor and it shows up here, or start with the lists below.', 'Ketuk + Ikuti di startup, BUMN, pusat data, atau investor mana pun dan semuanya muncul di sini, atau mulai dari daftar di bawah.')}</p>
  </div>`;
  const W = widgets;
  const panels = [
    wRounds(W.rounds, L, PF, lang),
    wRead(W.read, L, PF),
    wInvestors(W.investors, L, PF),
    wSectors(W.sectors, L, PF),
    wClosed(W.closed, L, PF, lang),
  ].join('');
  const body = `${STYLE}<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<main class="me">
  <header class="me-hd">
    <div class="eyebrow"><span class="sq"></span>${L('My 1001', 'My 1001')}</div>
    <h1>${L('Following', 'Yang kamu ikuti')}</h1>
    <p class="me-sub">${rows.length
      ? L(`You follow ${rows.length}, newest first. Tap a startup for its full card.`, `Kamu mengikuti ${rows.length}, terbaru di atas. Ketuk startup untuk kartu lengkapnya.`)
      : L('Startups, state companies, data centres and investors you follow, in one place.', 'Startup, BUMN, pusat data, dan investor yang kamu ikuti, di satu tempat.')}</p>
  </header>
  ${question}
  <section aria-label="${L('Following', 'Yang kamu ikuti')}">${list}</section>
  <nav class="me-more" aria-label="${L('Find more to follow', 'Cari yang lain')}">
    <span>${L('Find more to follow', 'Cari yang lain untuk diikuti')}</span>
    <a href="${esc(NAV.censusHref(PF))}">${L('Startups', 'Startup')}</a>
    <a href="/bumn">${L('State companies (BUMN)', 'BUMN')}</a>
    <a href="/data-center">${L('Data centres', 'Pusat data')}</a>
    <a href="${PF}/investors">${L('Investors', 'Investor')}</a>
  </nav>
  ${panels}
  <section class="me-prof" aria-labelledby="me-p-h">
    <h2 id="me-p-h">${L('Your account', 'Akun kamu')}</h2>
    <dl>
      <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
      <div><dt>${L('Joined', 'Bergabung')}</dt><dd>${esc(joined)}</dd></div>
      <div><dt>${L('What you do', 'Pekerjaan')}</dt><dd>${role ? esc(L(role[1], role[2])) : '—'}${asked ? `<details class="me-chg"><summary>${L('Change', 'Ubah')}</summary><form method="POST" action="/me/role" class="me-roles">${roleButtons(L, lang)}</form></details>` : ''}</dd></div>
    </dl>
    <form method="POST" action="/signout" class="me-out"><input type="hidden" name="lang" value="${lang === 'id' ? 'id' : 'en'}"><button class="btn" type="submit">${L('Sign out', 'Keluar')}</button></form>
  </section>
</main>
<script src="/js/company1001.js?v=${V}" defer></script>`;
  return shell({
    title: L('My 1001 — 1001startup.id', 'My 1001 — 1001startup.id'),
    desc: L('What you follow on 1001startup.id.', 'Yang kamu ikuti di 1001startup.id.'),
    path: '/me', lang, body, robots: 'noindex, nofollow', active: '',
  });
}

/* Follow buttons and the sign-in-to-follow popup, put in the <head> of 1001
   pages. The popup copies the wall's card (views/wall1001.js) with a close
   button: following is a choice, the wall is not. ::before, not ::after, so
   it never fights the wall's blur. */
const css = `<style id="f1001-css">
.fw1001{display:inline-flex;align-items:center;gap:7px;border:1px solid #000;background:#fff;color:#000;font:400 11px/1 'IBM Plex Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;padding:9px 12px;cursor:pointer;border-radius:0;white-space:nowrap;vertical-align:middle}
.fw1001::before{content:"+";font-size:13px;line-height:1}
.fw1001[aria-pressed="true"]{background:#000;color:#fff}
.fw1001[aria-pressed="true"]::before{content:"\\2713"}
.fw1001:disabled{opacity:.55;cursor:default}
.fw1001:focus-visible{outline:2px solid #E8734B;outline-offset:2px}
.fw1001[hidden]{display:none!important}
.bm-card .fw1001{margin:0 0 10px}
.pb>.pfw{margin:0 0 10px}
.inv-fw{margin-top:14px}
.fw1001.f1001-hint{box-shadow:0 0 0 3px rgba(232,115,75,.55)}
#f1001-t{position:fixed;z-index:2147482900;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:420px;margin-right:auto;background:#fff;color:#000;border:1px solid #000;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:14px 16px;font:500 15px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;display:grid;gap:9px}
#f1001-t p{margin:0}
#f1001-t .k{display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73}
#f1001-t .k i{width:6px;height:6px;background:#E8734B;display:inline-block}
#f1001-t .a{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
#f1001-t .go{background:#000;color:#fff;text-decoration:none;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:10px 12px}
#f1001-t .ok{background:none;border:0;padding:6px 2px;font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;color:#52525B;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
@media(prefers-reduced-motion:no-preference){#f1001-t{animation:f1001in .3s cubic-bezier(.2,.8,.2,1)}}
html.f1001-on{overflow:hidden!important}
html.f1001-on::before{content:"";position:fixed;inset:0;z-index:2147482995;background:rgba(255,255,255,.38);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px)}
#f1001{position:fixed;inset:0;z-index:2147483001;display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
#f1001 .f1001-c{position:relative;width:100%;max-width:440px;margin:auto;background:#fff;color:#000;border:1px solid #000;box-shadow:0 24px 70px rgba(0,0,0,.2);font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;text-align:left;outline:none}
#f1001 .f1001-c::before{content:"";display:block;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
#f1001 .f1001-in{padding:22px 26px 20px}
#f1001 .f1001-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid #E7E7E7;background:#fff;color:#000;font:400 16px/1 'IBM Plex Mono',monospace;cursor:pointer;border-radius:0}
#f1001 .f1001-x:hover{border-color:#000}
#f1001 .f1001-k{margin:0;display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73}
#f1001 .f1001-k i{width:6px;height:6px;background:#E8734B;display:inline-block}
#f1001 h2{margin:12px 40px 0 0;padding:0;font:500 27px/1.12 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.025em;color:#000;text-wrap:balance}
#f1001 .f1001-s{margin:8px 0 0;font-size:15px;line-height:1.55;color:#52525B}
#f1001 iframe{display:block;width:100%;height:190px;margin:16px 0 0;border:0;background:#fff;color-scheme:light}
#f1001 .f1001-n{margin:14px 0 0;padding:12px 0 0;border-top:1px solid #E7E7E7;font-size:12.5px;line-height:1.55;color:#6B6B73}
@media(max-width:560px){#f1001{padding:0}#f1001 .f1001-c{max-width:none;margin:auto 0 0;border-width:1px 0 0;box-shadow:0 -14px 44px rgba(0,0,0,.18)}#f1001 .f1001-in{padding:18px 18px calc(16px + env(safe-area-inset-bottom,0px))}#f1001 h2{font-size:23px}}
@media(prefers-reduced-motion:no-preference){#f1001 .f1001-c{animation:f1001in .3s cubic-bezier(.2,.8,.2,1)}}
@keyframes f1001in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
</style>`;

module.exports = {
  page, css, ROLE_KEYS,
  /* shared with the dashboard (views/dash1001.js) */
  parts: { STYLE, ROLES, KIND, n0, usd, idrT, round, subLine, roleButtons, wRounds, wRead, wInvestors, wSectors, wClosed },
};
