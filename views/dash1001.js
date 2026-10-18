'use strict';
/**
 * 1001startup.id — My 1001 as a dashboard (/me, /id/me while data/dash.live
 * exists; `?dash=1` shows it to a signed-in reader before that, `?dash=0` shows
 * the old list page). Luca, 18 Oct 2026: "make this into like real dashboard",
 * with an agent that finds the email/contact of people in 1001's data (Exa
 * people search, Firecrawl or Monid later: COMING SOON) and a general chatbot
 * that searches the data.
 *
 * Layout, phone first (one column: search, numbers, Ask, Following, Lead
 * agent, widgets, account); 2 columns from 760 px; 3 from 1180 px:
 * Following | Ask 1001 + New rounds | Lead agent + the other widgets.
 *
 *  - Search bar: instant search over every startup, BUMN, data centre,
 *    investor and sector (GET /api/me/index, no model), `/` jumps in, the last
 *    row hands the words to Ask 1001. public/js/me1001.js.
 *  - Ask 1001: answers only from 1001's data (lib/ask1001.js, DeepSeek V4.1
 *    Flash through our aisurplus gateway). Shown while data/ask.live exists.
 *  - Lead agent: coming soon. "Get early access" and the Contacts button on a
 *    followed startup or BUMN save a request (acct_lead_asks), so Luca sees
 *    which companies readers want contacts at. Nothing is searched.
 *
 * Followed startups stay in table#tbl as tr[data-id] rows, so
 * public/js/company1001.js still opens their card in the drawer.
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const { shell } = require('./browse1001');
const { V } = require('./html');
const NAV = require('./nav1001');
const ME = require('./me1001');

const { STYLE, ROLES, KIND, n0, usd, subLine, roleButtons, wRounds, wRead, wInvestors, wSectors, wClosed } = ME.parts;

function rowHtml(r, L, asked, leadOn) {
  const tag = KIND[r.kind] ? L(KIND[r.kind][0], KIND[r.kind][1]) : '';
  const logo = r.logo
    ? `<img src="${esc(r.logo)}" alt="" width="36" height="36" loading="lazy">`
    : `<span class="me-ini" aria-hidden="true">${esc(String(r.name || '?').trim().slice(0, 2).toUpperCase())}</span>`;
  /* the lead agent looks for people at companies: startups and BUMN */
  const lead = leadOn && (r.kind === 'company' || r.kind === 'bumn')
    ? `<button class="md-cb" type="button" data-lk="${esc(r.kind)}" data-lr="${esc(r.ref)}" data-ln="${esc(r.name)}"${r.kind === 'company' && (r.obj.founders || []).length ? ` data-lf="${esc(r.obj.founders.slice(0, 6).join(', '))}"` : ''} aria-pressed="${asked ? 'true' : 'false'}">${asked ? L('Contacts asked', 'Kontak diminta') : L('Contacts', 'Kontak')}</button>`
    : '';
  return `<tr${r.kind === 'company' ? ` data-id="${esc(r.ref)}"` : ''}>
  <td class="me-lg">${logo}</td>
  <td class="me-mn"><a${r.kind === 'company' ? ' class="cp-link"' : ''} href="${esc(r.href)}"${String(r.name || '').length > 48 ? ` title="${esc(r.name)}"` : ''}><span class="md-nm${String(r.name || '').length > 48 ? ' long' : ''}">${esc(r.name)}</span></a><span class="me-k">${esc(tag)}</span><div class="me-s">${esc(subLine(r, L))}</div></td>
  <td class="me-fw"><button class="fw1001" type="button" data-fk="${esc(r.kind)}" data-fr="${esc(r.ref)}" hidden>${L('Following', 'Diikuti')}</button>${lead}</td>
</tr>`;
}

const kpi = (href, label, value, sub) => `<a class="md-kpi" href="${esc(href)}"><span class="md-kl">${esc(label)}</span><b>${esc(value)}</b><span class="md-ks">${esc(sub)}</span></a>`;

/* "3 startups · 1 BUMN" for the Following tile */
function followMix(rows, L) {
  const c = { company: 0, bumn: 0, dc: 0, investor: 0 };
  for (const r of rows) if (c[r.kind] != null) c[r.kind] += 1;
  return [
    c.company && L(`${c.company} ${c.company === 1 ? 'startup' : 'startups'}`, `${c.company} startup`),
    c.bumn && `${c.bumn} BUMN`,
    c.dc && L(`${c.dc} ${c.dc === 1 ? 'data centre' : 'data centres'}`, `${c.dc} pusat data`),
    c.investor && L(`${c.investor} ${c.investor === 1 ? 'investor' : 'investors'}`, `${c.investor} investor`),
  ].filter(Boolean).join(' · ');
}

/* Questions to start with: each one is answerable from 1001's data today. */
function tryList(rows, k, L) {
  const out = [];
  const mine = rows.find((r) => r.kind === 'company');
  if (mine) out.push(L(`Tell me about ${mine.name}`, `Ceritakan tentang ${mine.name}`));
  if (k.topRound) out.push(L(`Who invested in ${k.topRound}?`, `Siapa investor ${k.topRound}?`));
  out.push(L('Which startups raised a round in 2026?', 'Startup mana yang dapat pendanaan di 2026?'));
  out.push(L('Which data centres are operating in Batam?', 'Pusat data apa saja yang beroperasi di Batam?'));
  out.push(L('How many subsidiaries does Telkom have?', 'Berapa anak usaha Telkom?'));
  out.push(L('Which fintechs have the most people?', 'Fintech mana yang orangnya paling banyak?'));
  return out.slice(0, 5);
}

/**
 * The dashboard.
 *  rows    [{ kind, ref, name, href, logo, obj }] what the reader follows, newest first
 *  widgets as lib/account1001.js widgetsFor() builds them
 *  k       { startups, raisedB, rounds, bumn, subs, dcs, dcsOn, investors, founders, foundersAt, topRound }
 *  asked   Set of "kind:ref" lead-agent requests by this reader ('' : '' = early access)
 *  ask     true while Ask 1001 is switched on
 *  lead    false hides the lead agent card ("leads" in data/me-widgets-off.txt)
 */
function page({ lang = 'en', user, rows, widgets = {}, k, asked = new Set(), ask = false, lead: leadOn = true }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const askedRole = !!user.role_at;
  const role = ROLES.find(([x]) => x === user.role);
  const joined = user.created_at
    ? new Date(String(user.created_at).replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '';
  const question = askedRole ? '' : `
  <section class="me-q md-q1" aria-labelledby="me-q-h">
    <h2 id="me-q-h">${L('One question: what do you do?', 'Satu pertanyaan: apa pekerjaanmu?')}</h2>
    <p>${L('It tells us who reads 1001. You can change it later, or skip it.', 'Supaya kami tahu siapa pembaca 1001. Bisa diubah nanti, atau dilewati.')}</p>
    <form method="POST" action="/me/role" class="me-roles">
      ${roleButtons(L, lang)}
      <button type="submit" name="skip" value="1" class="skip">${L('Skip', 'Lewati')}</button>
    </form>
  </section>`;

  const following = rows.length
    ? `<table id="tbl" class="me-t md-ft"><tbody>${rows.map((r) => rowHtml(r, L, asked.has(`${r.kind}:${r.ref}`), leadOn)).join('')}</tbody></table>`
    : `<div class="md-empty">
      <p><b>${L('You don’t follow anything yet.', 'Kamu belum mengikuti apa pun.')}</b> ${L('Tap + Follow on any startup, state company, data centre or investor, or find one with the search bar above.', 'Ketuk + Ikuti di startup, BUMN, pusat data, atau investor mana pun, atau cari lewat kolom pencarian di atas.')}</p>
    </div>`;

  const W = widgets;
  const askPanel = ask ? `
    <section class="md-p md-ask" id="md-ask" aria-labelledby="md-ask-h">
      <h2 class="md-ph" id="md-ask-h"><i aria-hidden="true"></i>Ask 1001<em>${L('Searches 1001’s own data', 'Mencari di data 1001 sendiri')}</em></h2>
      <form class="md-af" id="md-af" autocomplete="off">
        <label class="vh" for="md-ai">${L('Ask 1001 a question', 'Tanya Ask 1001')}</label>
        <textarea id="md-ai" name="q" rows="2" maxlength="500" placeholder="${esc(L('Ask about a startup, BUMN, data centre or investor', 'Tanya soal startup, BUMN, pusat data, atau investor'))}"></textarea>
        <button type="submit" class="md-go">${L('Ask', 'Tanya')}</button>
      </form>
      <div class="md-try" id="md-try"><span>${L('Try', 'Coba')}</span>${tryList(rows, k, L).map((q) => `<button type="button" class="md-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="md-thread" id="md-thread" aria-live="polite"></div>
      <p class="md-pn">${esc(L(`Answers come only from 1001’s data: ${n0(k.startups)} startups, ${n0(k.bumn)} BUMN with ${n0(k.subs)} subsidiaries, ${n0(k.dcs)} data-centre projects and ${n0(k.investors)} investors. Questions are kept without your name, to improve Ask 1001.`,
        `Jawaban hanya dari data 1001: ${n0(k.startups)} startup, ${n0(k.bumn)} BUMN dengan ${n0(k.subs)} anak usaha, ${n0(k.dcs)} proyek pusat data, dan ${n0(k.investors)} investor. Pertanyaan disimpan tanpa namamu, untuk memperbaiki Ask 1001.`))}</p>
    </section>` : '';

  const early = asked.has(':');
  const lead = !leadOn ? '' : `
    <section class="md-p md-lead" id="md-lead" aria-labelledby="md-lead-h">
      <h2 class="md-ph" id="md-lead-h"><i aria-hidden="true"></i>${L('Lead agent', 'Agen kontak')}<em class="md-soon">${L('Coming soon', 'Segera hadir')}</em></h2>
      <p class="md-lt">${L('Find the right person at any company in 1001, and how to reach them.', 'Temukan orang yang tepat di perusahaan mana pun di 1001, dan cara menghubunginya.')}</p>
      <ol class="md-ls">
        <li><b>${L('Who decides', 'Siapa yang memutuskan')}</b><span>${L('The founders 1001 lists, plus the role you are looking for.', 'Pendiri yang tercatat di 1001, ditambah jabatan yang kamu cari.')}</span></li>
        <li><b>${L('Still there', 'Masih di sana')}</b><span>${L('Checks that each person still works at the company.', 'Memeriksa bahwa orangnya masih bekerja di perusahaan itu.')}</span></li>
        <li><b>${L('How to reach them', 'Cara menghubungi')}</b><span>${L('A work email the company published, or its email pattern, marked as a guess.', 'Email kerja yang dipublikasikan perusahaan, atau pola emailnya, ditandai sebagai tebakan.')}</span></li>
        <li><b>${L('Where it came from', 'Sumbernya')}</b><span>${L('Every contact links to its source.', 'Setiap kontak menautkan sumbernya.')}</span></li>
      </ol>
      <p class="md-ln">${L(`<b>${n0(k.founders)}</b> founders named across <b>${n0(k.foundersAt)}</b> startups in 1001 today.`, `<b>${n0(k.founders)}</b> pendiri tercatat di <b>${n0(k.foundersAt)}</b> startup di 1001 saat ini.`)}</p>
      <div class="md-via"><span>${L('Will search through', 'Akan mencari lewat')}</span><b>${L('Exa people search', 'Exa people search')}</b><b>Firecrawl</b><b>Monid</b></div>
      <div class="md-la">
        <button class="md-lb" type="button" data-lead="1" aria-pressed="${early ? 'true' : 'false'}">${early ? L('You’re on the list', 'Kamu sudah terdaftar') : L('Get early access', 'Minta akses awal')}</button>
        <span class="md-lnote" id="md-lnote">${early
          ? L('It will show up here when it opens.', 'Agen ini muncul di sini saat dibuka.')
          : L('Or tap Contacts on a startup or BUMN you follow.', 'Atau ketuk Kontak di startup atau BUMN yang kamu ikuti.')}</span>
      </div>
    </section>`;

  const prof = `
    <section class="md-p me-prof" id="md-prof" aria-labelledby="me-p-h">
      <h2 class="md-ph" id="me-p-h"><i aria-hidden="true"></i>${L('Your account', 'Akun kamu')}</h2>
      <dl>
        <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
        <div><dt>${L('Joined', 'Bergabung')}</dt><dd>${esc(joined)}</dd></div>
        <div><dt>${L('What you do', 'Pekerjaan')}</dt><dd>${role ? esc(L(role[1], role[2])) : '—'}${askedRole ? `<details class="me-chg"><summary>${L('Change', 'Ubah')}</summary><form method="POST" action="/me/role" class="me-roles">${roleButtons(L, lang)}</form></details>` : ''}</dd></div>
      </dl>
      <form method="POST" action="/signout" class="me-out"><input type="hidden" name="lang" value="${lang === 'id' ? 'id' : 'en'}"><button class="btn" type="submit">${L('Sign out', 'Keluar')}</button></form>
    </section>`;

  const kpis = [
    kpi('#md-follow', L('Following', 'Diikuti'), n0(rows.length), rows.length ? followMix(rows, L) : L('Tap + Follow anywhere', 'Ketuk + Ikuti di mana saja')),
    kpi(NAV.censusHref(PF), L('Startups', 'Startup'), n0(k.startups), L(`US$${k.raisedB}B raised`, `dana US$${String(k.raisedB).replace('.', ',')} miliar`)),
    kpi('#md-rounds', L('New rounds', 'Pendanaan baru'), n0(k.rounds), L('last round in 2025–26', 'putaran terakhir 2025–26')),
    kpi('/bumn', 'BUMN', n0(k.bumn), L(`${n0(k.subs)} subsidiaries`, `${n0(k.subs)} anak usaha`)),
    kpi('/data-center', L('Data centres', 'Pusat data'), n0(k.dcs), L(`${n0(k.dcsOn)} operating`, `${n0(k.dcsOn)} beroperasi`)),
    kpi(`${PF}/investors`, L('Investors', 'Investor'), n0(k.investors), L('backing census startups', 'mendanai startup sensus')),
  ].join('');

  const body = `${STYLE}
<style>
.md{max-width:1440px;margin:0 auto;padding:30px 24px 12px;display:grid;gap:18px}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.md-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 24px}
.md-top h1{font-size:clamp(28px,4vw,40px);line-height:1.05;letter-spacing:-0.03em;font-weight:500;margin-top:10px}
.md-sub{color:#52525B;font-size:14.5px;line-height:1.5;margin-top:6px;max-width:62ch}
.md-acct{font:400 12px/1.4 'IBM Plex Mono',monospace;color:#6B6B73;overflow-wrap:anywhere;text-align:right}
.md-acct a{color:#000}
.md-q1{max-width:none}
.md-cmd{position:relative;display:flex;align-items:center;border:1px solid #000;background:#fff}
.md-cmd input{flex:1;min-width:0;border:0;outline:0;background:transparent;padding:14px 14px;font:400 15px/1.2 'IBM Plex Mono',ui-monospace,monospace;color:#000;-webkit-appearance:none;appearance:none;border-radius:0}
.md-cmd input::placeholder{color:#8A8A92}
.md-cmd:focus-within{box-shadow:0 0 0 3px rgba(232,115,75,.35)}
.md-cmd kbd{font:400 11px/1 'IBM Plex Mono',monospace;border:1px solid #D9D9DE;color:#52525B;padding:4px 7px;margin-right:12px;background:#fff}
.md-qr{position:absolute;z-index:40;left:-1px;right:-1px;top:100%;margin:0;padding:0;list-style:none;background:#fff;border:1px solid #000;border-top:0;box-shadow:0 18px 40px rgba(0,0,0,.12);max-height:min(460px,64vh);overflow:auto}
.md-qr li{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #F1F1F1;cursor:pointer}
.md-qr li[aria-selected="true"]{background:#FFF6F1;box-shadow:inset 3px 0 #E8734B}
.md-qr .t{min-width:0;flex:1;display:grid;gap:2px}
.md-qr .t b{font-weight:600;font-size:14.5px;color:#000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-qr .t span{font-size:12.5px;color:#52525B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-qr .me-k{margin-left:0;flex:none}
.md-qr .fw1001{padding:7px 9px;flex:none}
.md-qr li.ask .t b{font-weight:500}
.md-qr li.ask .t b em{font-style:normal;font-weight:600}
.md-qr li.none{cursor:default;color:#6B6B73;font-size:13.5px}
.md-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border:1px solid #E7E7E7;border-right:0}
.md-kpi{display:grid;gap:4px;align-content:start;padding:14px 16px;border-right:1px solid #E7E7E7;text-decoration:none;color:#000;min-width:0}
.md-kpi:hover{background:#FAFAFA}
.md-kl{font:400 10.5px/1.2 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73}
.md-kpi b{font:500 28px/1.1 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.md-ks{font-size:12.5px;line-height:1.4;color:#52525B;overflow-wrap:anywhere}
.md-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.45fr) minmax(0,1fr);gap:18px;align-items:start}
.md-col{display:grid;gap:18px;min-width:0}
.md-p{border:1px solid #E7E7E7;background:#fff;padding:16px;display:grid;gap:12px;min-width:0}
.md-ph{display:flex;align-items:center;gap:8px;font:400 11px/1.2 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#000;margin:0}
.md-ph i{width:6px;height:6px;background:#E8734B;display:inline-block;flex:none}
.md-ph em{font-style:normal;margin-left:auto;color:#6B6B73;letter-spacing:.04em;text-transform:none;text-align:right}
.md-ph .md-soon{color:#fff;background:#000;padding:4px 7px;letter-spacing:.07em;text-transform:uppercase;font-size:10px}
.md-p .me-w{gap:10px}
.md-p .me-wh{display:none}
.md-p .me-wl{border-top:1px solid #E7E7E7}
.md-p .me-wl li:last-child{border-bottom:0}
.md .me-t{width:100%;min-width:0;border-collapse:collapse;font-size:inherit;table-layout:fixed}   /* the shell gives every table min-width:760px */
.md-ft td{padding:11px 0}
.md-ft .me-lg{width:46px}
.md-ft .me-mn{width:auto}
.md-ft .me-fw{width:112px}
.md-ft .me-mn a{font-size:15px}
.md-nm{overflow-wrap:anywhere}
.md-nm.long{display:-webkit-inline-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;vertical-align:top}
.md-ft td.me-fw{text-align:right}
.md-ft .me-fw .fw1001,.md-ft .me-fw .md-cb{display:block;margin-left:auto}
.md-ft .me-fw .md-cb{margin-top:6px}
.md-cb{border:1px solid #D9D9DE;background:#fff;color:#3F3F46;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:7px 9px;cursor:pointer;border-radius:0;white-space:nowrap}
.md-cb:hover{border-color:#000;color:#000}
.md-cb[aria-pressed="true"]{border-color:#E8734B;color:#B4532F}
.md-empty p{font-size:14.5px;line-height:1.55;color:#3F3F46}
.md-more{display:flex;flex-wrap:wrap;gap:6px}
.md-more a{border:1px solid #E7E7E7;padding:8px 10px;text-decoration:none;color:#000;font-size:13.5px}
.md-more a:hover{border-color:#000}
.md-ask{border-color:#000}
.md-af{display:flex;gap:0;border:1px solid #000}
.md-af textarea{flex:1;min-width:0;border:0;outline:0;resize:none;padding:12px 12px;font:400 15px/1.45 'Overused Grotesk',system-ui,sans-serif;color:#000;background:#fff;border-radius:0;min-height:48px;max-height:180px}
.md-af:focus-within{box-shadow:0 0 0 3px rgba(232,115,75,.35)}
.md-go{border:0;border-left:1px solid #000;background:#000;color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;padding:0 18px;cursor:pointer;border-radius:0}
.md-go:disabled{opacity:.5;cursor:default}
.md-try{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.md-try[hidden],.md-qr[hidden],.md-ld [hidden]{display:none}
.md-try>span{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73;margin-right:2px}
.md-chip{border:1px solid #E7E7E7;background:#FAFAFA;color:#000;font:400 13px/1.3 'Overused Grotesk',system-ui,sans-serif;padding:7px 10px;cursor:pointer;border-radius:0;text-align:left}
.md-chip:hover{border-color:#000;background:#fff}
.md-thread{display:grid;gap:12px}
.md-thread:empty{display:none}
.md-qa{border-top:1px solid #E7E7E7;padding-top:12px;display:grid;gap:8px}
.md-qq{font-weight:600;font-size:15.5px;line-height:1.35;margin:0}
.md-st{display:flex;flex-wrap:wrap;gap:4px 10px;margin:0;padding:0;list-style:none;font:400 11.5px/1.4 'IBM Plex Mono',monospace;color:#6B6B73}
.md-st li::before{content:"\\2192 ";color:#E8734B}
.md-st li.run::after{content:" \\2026";animation:mdblink 1s steps(2,end) infinite}
@keyframes mdblink{50%{opacity:0}}
.md-an{font-size:15px;line-height:1.6;color:#18181B;display:grid;gap:8px;overflow-wrap:anywhere}
.md-an p,.md-an ul{margin:0}
.md-an ul{padding-left:18px;display:grid;gap:4px}
.md-an a{color:#000;text-decoration:underline;text-decoration-color:#E8734B;text-underline-offset:3px;font-weight:500}
.md-an.wait{color:#6B6B73}
.md-an.calm{color:#52525B}
.md-en{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.md-en li{display:flex;align-items:center;gap:8px;border:1px solid #E7E7E7;padding:5px 5px 5px 9px;min-width:0;max-width:100%}
.md-en a{font-weight:600;font-size:13.5px;color:#000;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-en .fw1001{padding:6px 8px;font-size:10px}
.md-sr{font:400 11px/1.4 'IBM Plex Mono',monospace;color:#8A8A92;margin:0}
.md-pn{font-size:12px;line-height:1.5;color:#8A8A92;margin:0}
.md-lead{position:relative;border-color:#000;padding-top:20px}
.md-lead::before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
.md-lt{font-size:16px;line-height:1.4;font-weight:600;letter-spacing:-0.01em;margin:0}
.md-ls{margin:0;padding:0;list-style:none;counter-reset:ls;display:grid;gap:8px}
.md-ls li{counter-increment:ls;display:grid;grid-template-columns:22px minmax(0,1fr);column-gap:8px;font-size:13.5px;line-height:1.45;color:#3F3F46}
.md-ls li::before{content:counter(ls);grid-row:span 2;width:20px;height:20px;border:1px solid #000;display:grid;place-items:center;font:400 10.5px/1 'IBM Plex Mono',monospace;color:#000}
.md-ls b{color:#000;font-weight:600}
.md-ln{font-size:13.5px;line-height:1.5;color:#3F3F46;margin:0;padding:10px 12px;background:#FAFAFA;border:1px solid #F1F1F1}
.md-ln b{color:#000;font-variant-numeric:tabular-nums}
.md-via{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.md-via span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;width:100%}
.md-via b{font-weight:500;font-size:13px;border:1px solid #D9D9DE;padding:5px 9px;color:#27272A}
.md-la{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.md-lb{border:1px solid #000;background:#000;color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;padding:11px 14px;cursor:pointer;border-radius:0}
.md-lb[aria-pressed="true"]{background:#fff;color:#000;cursor:default}
.md-lb[aria-pressed="true"]::before{content:"\\2713  "}
.md-lnote{font-size:12.5px;line-height:1.45;color:#6B6B73}
.md-p.me-prof dl{border-top:1px solid #E7E7E7}
.md-p.me-prof dl>div{grid-template-columns:110px minmax(0,1fr);font-size:14px}
.md-p.me-prof dl>div:last-child{border-bottom:0}
.md-ld{border:1px solid #000;padding:0;max-width:440px;width:calc(100% - 32px);box-shadow:0 24px 70px rgba(0,0,0,.2);color:#000}
.md-ld::backdrop{background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.md-ld form{display:grid;gap:12px;padding:20px 22px 18px;margin:0}
.md-ld::before{content:"";display:block;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
.md-ld .k{display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;margin:0}
.md-ld .k i{width:6px;height:6px;background:#E8734B;display:inline-block}
.md-ld h2{font:500 24px/1.15 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.02em;margin:0;text-wrap:balance}
.md-ld p{font-size:14.5px;line-height:1.55;color:#3F3F46;margin:0}
.md-ld .f{font-size:13.5px;color:#52525B;background:#FAFAFA;border:1px solid #F1F1F1;padding:9px 11px}
.md-ld .a{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.md-ld .x{border:1px solid #E7E7E7;background:#fff;color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;padding:11px 14px;cursor:pointer;border-radius:0}
.md-ld .ok{color:#1E7A46;font-size:13.5px}
@media(max-width:1179px){
  .md-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"b b" "a c"}
  .md-a{grid-area:a}.md-b{grid-area:b}.md-c{grid-area:c}
  .md-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
  .md-kpi:nth-child(-n+3){border-bottom:1px solid #E7E7E7}
}
@media(max-width:759px){
  .md{padding:20px 16px 8px;gap:14px}
  /* one column, in this order: Ask, Following, Lead agent, then the widgets */
  .md-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:none;gap:14px}
  .md-col{display:contents}
  .md-grid .md-p{order:9}
  .md-grid #md-ask{order:1}.md-grid #md-follow{order:2}.md-grid #md-lead{order:3}.md-grid #md-rounds{order:4}.md-grid #md-read{order:5}.md-grid #md-prof{order:10}
  .md-acct{text-align:left}
  .md-kpis{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .md-kpis::-webkit-scrollbar{display:none}
  .md-kpi{flex:0 0 40%;scroll-snap-align:start;padding:11px 12px}
  .md-kpi b{font-size:23px}
  .md-cmd input{font-size:14px;padding:13px 12px}
  .md-cmd kbd{display:none}
  .md-p{padding:14px}
  .md-ft .me-lg{width:40px}
  .md-ft .me-lg img,.md-ft .me-ini{width:30px;height:30px}
  .md-ft .me-fw{width:104px}
  .md-p.me-prof dl>div{grid-template-columns:1fr;gap:2px}
}
</style>
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<main class="md" id="md" data-lang="${lang === 'id' ? 'id' : 'en'}">
  <header class="md-top">
    <div>
      <div class="eyebrow"><span class="sq"></span>${L('My 1001', 'My 1001')}</div>
      <h1>${L('Your dashboard', 'Dasbor kamu')}</h1>
      <p class="md-sub">${ask
        ? L('What you follow, a chat that searches 1001’s data, and the lead agent that is on its way.', 'Yang kamu ikuti, chat yang mencari di data 1001, dan agen kontak yang segera hadir.')
        : L('What you follow, the numbers that move, and the lead agent that is on its way.', 'Yang kamu ikuti, angka yang bergerak, dan agen kontak yang segera hadir.')}</p>
    </div>
    <div class="md-acct">${esc(user.email)} · <a href="#md-prof">${L('Account', 'Akun')}</a></div>
  </header>
  ${question}
  <div class="md-cmd" role="search">
    <label class="vh" for="md-s">${L('Search 1001', 'Cari di 1001')}</label>
    <input id="md-s" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="md-qr" autocomplete="off" spellcheck="false"
      data-short="${esc(L('Search startups, BUMN, investors', 'Cari startup, BUMN, investor'))}"
      placeholder="${esc(L(`Search ${n0(k.startups)} startups, ${n0(k.bumn)} BUMN, ${n0(k.dcs)} data centres, ${n0(k.investors)} investors`, `Cari ${n0(k.startups)} startup, ${n0(k.bumn)} BUMN, ${n0(k.dcs)} pusat data, ${n0(k.investors)} investor`))}">
    <kbd aria-hidden="true">/</kbd>
    <ul class="md-qr" id="md-qr" role="listbox" hidden></ul>
  </div>
  <section class="md-kpis" aria-label="${L('1001 in numbers', '1001 dalam angka')}">${kpis}</section>
  <div class="md-grid">
    <div class="md-col md-a">
      <section class="md-p" id="md-follow" aria-labelledby="md-f-h">
        <h2 class="md-ph" id="md-f-h"><i aria-hidden="true"></i>${L('Following', 'Yang kamu ikuti')}<em>${rows.length ? n0(rows.length) : ''}</em></h2>
        ${following}
        <nav class="md-more" aria-label="${L('Find more to follow', 'Cari yang lain')}">
          <a href="${esc(NAV.censusHref(PF))}">${L('Startups', 'Startup')}</a>
          <a href="/bumn">BUMN</a>
          <a href="/data-center">${L('Data centres', 'Pusat data')}</a>
          <a href="${PF}/investors">${L('Investors', 'Investor')}</a>
        </nav>
      </section>
      ${W.read && W.read.length ? `<section class="md-p" id="md-read" aria-labelledby="md-r-h"><h2 class="md-ph" id="md-r-h"><i aria-hidden="true"></i>${L('Most read this week', 'Paling banyak dibaca minggu ini')}</h2>${wRead(W.read, L, PF)}</section>` : ''}
    </div>
    <div class="md-col md-b">
      ${askPanel}
      ${W.rounds && W.rounds.items.length ? `<section class="md-p" id="md-rounds" aria-labelledby="md-n-h"><h2 class="md-ph" id="md-n-h"><i aria-hidden="true"></i>${L('New rounds, 2025–26', 'Pendanaan baru, 2025–26')}<em>${n0(W.rounds.total)}</em></h2>${wRounds(W.rounds, L, PF, lang)}</section>` : ''}
      ${W.sectors && W.sectors.length ? `<section class="md-p" aria-labelledby="md-s-h"><h2 class="md-ph" id="md-s-h"><i aria-hidden="true"></i>${L('Sector pulse', 'Denyut sektor')}</h2>${wSectors(W.sectors, L, PF)}</section>` : ''}
    </div>
    <div class="md-col md-c">
      ${lead}
      ${W.investors ? `<section class="md-p" aria-labelledby="md-i-h"><h2 class="md-ph" id="md-i-h"><i aria-hidden="true"></i>${W.investors.mine.length ? L('Investors you follow', 'Investor yang kamu ikuti') : L('Investors with the most companies', 'Investor dengan perusahaan terbanyak')}</h2>${wInvestors(W.investors, L, PF)}</section>` : ''}
      ${W.closed && W.closed.length ? `<section class="md-p" aria-labelledby="md-c-h"><h2 class="md-ph" id="md-c-h"><i aria-hidden="true"></i>${L('Closed', 'Sudah tutup')}</h2>${wClosed(W.closed, L, PF, lang)}</section>` : ''}
      ${prof}
    </div>
  </div>
</main>
<dialog class="md-ld" id="md-ld" aria-labelledby="md-ld-h">
  <form method="dialog">
    <p class="k"><i aria-hidden="true"></i>${L('Lead agent · coming soon', 'Agen kontak · segera hadir')}</p>
    <h2 id="md-ld-h">${L('Contacts at', 'Kontak di')} <span data-n></span></h2>
    <p>${L('The lead agent will find who decides at', 'Agen kontak akan mencari siapa yang memutuskan di')} <span data-n></span>${L(', check they still work there, and show how to reach them, with the source for each contact.', ', memeriksa mereka masih bekerja di sana, dan menunjukkan cara menghubunginya, lengkap dengan sumber tiap kontak.')}</p>
    <p class="f" data-f hidden>${L('Founders in 1001:', 'Pendiri di 1001:')} <span data-fv></span></p>
    <div class="a">
      <button type="button" class="md-lb" data-go aria-pressed="false">${L('Ask for these contacts', 'Minta kontak ini')}</button>
      <button type="submit" value="close" class="x">${L('Close', 'Tutup')}</button>
    </div>
    <p class="ok" data-ok hidden>${L('Saved. The contacts will show up here when the lead agent opens.', 'Tersimpan. Kontaknya muncul di sini saat agen kontak dibuka.')}</p>
  </form>
</dialog>
<script src="/js/company1001.js?v=${V}" defer></script>
<script src="/js/me1001.js?v=${V}m1" data-lang="${lang === 'id' ? 'id' : 'en'}" data-ask="${ask ? 1 : 0}" defer></script>`;
  return shell({
    title: L('My 1001 — 1001startup.id', 'My 1001 — 1001startup.id'),
    desc: L('Your 1001startup.id dashboard.', 'Dasbor 1001startup.id kamu.'),
    path: '/me', lang, body, robots: 'noindex, nofollow', active: '',
  });
}

module.exports = { page };
