'use strict';
/**
 * 1001startup.id — My 1001 as one chat box (/me, /id/me while data/chat.live
 * and data/ask.live both exist; `?chat=1` shows it to a signed-in reader
 * before that, `?dash=1` the dashboard, `?dash=0` the old list page).
 * Luca, 20 Oct 2026, on Firecrawl's and Exa's landing pages: "too much
 * information in dashboard, focus on the chatbot like this".
 *
 * One question box in the middle of the page, like those two:
 *  - Chips in the box's bar (All data, Startups, BUMN, Data centres,
 *    Investors) tell Ask 1001 where to look first (lib/ask1001.js `scope`).
 *    People is the lead agent, still coming soon: it opens a sheet with
 *    "Get early access" (POST /api/me/lead, the request the dashboard saved).
 *    No provider names anywhere (Luca, 18 Oct).
 *  - Typing a name offers its page (GET /api/me/index, the dashboard's
 *    instant search); Enter always asks.
 *  - Answers stack under the box, newest first, their words appearing as
 *    DeepSeek writes them, as in oyenza.app's Ask (Luca, 20 Oct: "lets use
 *    deepseek like how oyenza.app works"; same model, same gateway).
 *    public/js/chat1001.js.
 *  - What the dashboard showed (numbers, rounds, most read, sectors,
 *    investors, closed) lives on the site's own pages; only Following and
 *    the account stay here, in one quiet strip at the bottom.
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const { shell } = require('./browse1001');
const { V } = require('./html');
const ME = require('./me1001');

const { ROLES, KIND, roleButtons } = ME.parts;

/* [scope, EN, ID, placeholder EN, placeholder ID]; '' = all data */
const SCOPES = [
  ['', 'All data', 'Semua data', 'Which fintech startups raised a round in 2026?', 'Startup fintech mana yang dapat pendanaan di 2026?'],
  ['startups', 'Startups', 'Startup', 'Which startups in Bandung have the most people?', 'Startup di Bandung mana yang orangnya paling banyak?'],
  ['bumn', 'BUMN', 'BUMN', 'Which BUMN had the highest net profit?', 'BUMN mana yang laba bersihnya paling tinggi?'],
  ['dc', 'Data centres', 'Pusat data', 'Which data centres are operating in Batam?', 'Pusat data apa saja yang beroperasi di Batam?'],
  ['investors', 'Investors', 'Investor', 'Which investors back the most fintech startups?', 'Investor mana yang paling banyak mendanai startup fintech?'],
];

/* Questions to start with, per chip: each one is answerable from 1001's data today. */
function examples(rows, k, L) {
  const mine = rows.find((r) => r.kind === 'company');
  const round = k.topRound || 'Xendit';
  return {
    '': [
      mine ? L(`Tell me about ${mine.name}`, `Ceritakan tentang ${mine.name}`) : L('Which startups raised a round in 2026?', 'Startup mana yang dapat pendanaan di 2026?'),
      L(`Who invested in ${round}?`, `Siapa investor ${round}?`),
      L('Which data centres are operating in Batam?', 'Pusat data apa saja yang beroperasi di Batam?'),
      L('How many subsidiaries does Telkom have?', 'Berapa anak usaha Telkom?'),
    ],
    startups: [
      L('Which startups raised a round in 2026?', 'Startup mana yang dapat pendanaan di 2026?'),
      L('Which fintechs have the most people?', 'Fintech mana yang orangnya paling banyak?'),
      L('Which startups closed in 2025?', 'Startup mana yang tutup di 2025?'),
    ],
    bumn: [
      L('Which BUMN had the highest net profit?', 'BUMN mana yang laba bersihnya paling tinggi?'),
      L('How many subsidiaries does Telkom have?', 'Berapa anak usaha Telkom?'),
      L('Tell me about Pertamina', 'Ceritakan tentang Pertamina'),
    ],
    dc: [
      L('Which data centres are operating in Batam?', 'Pusat data apa saja yang beroperasi di Batam?'),
      L('What are the biggest data-centre projects?', 'Proyek pusat data mana yang paling besar?'),
      L('Which data centres does NeutraDC run?', 'Pusat data mana saja yang dijalankan NeutraDC?'),
    ],
    investors: [
      L('Which investors back the most fintech startups?', 'Investor mana yang paling banyak mendanai startup fintech?'),
      L(`Who invested in ${round}?`, `Siapa investor ${round}?`),
      L('Tell me about East Ventures', 'Ceritakan tentang East Ventures'),
    ],
  };
}

const ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>';

/**
 * The page.
 *  rows    [{ kind, ref, name, href }] what the reader follows, newest first
 *  k       { startups, bumn, subs, dcs, investors, topRound } (lib/account1001.js kpisFor)
 *  early   true once the reader asked for early access to the lead agent
 */
function page({ lang = 'en', user, rows, k, early = false }) {
  const L = I18N.mkL(lang);
  const nf = (x) => Math.round(Number(x || 0)).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
  const ex = examples(rows, k, L);
  const role = ROLES.find(([x]) => x === user.role);

  const chips = SCOPES.map(([sc, en, id, pen, pid], i) => `<button type="button" class="ck-c" data-sc="${sc}" data-ph="${esc(L(pen, pid))}" aria-pressed="${i ? 'false' : 'true'}">${esc(L(en, id))}</button>`).join('');
  const tries = SCOPES.map(([sc]) => `<div class="ck-try" data-for="${sc}" hidden><span>${L('Try', 'Coba')}</span>${ex[sc].map((q) => `<button type="button" class="ck-x" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`).join('');

  const SHOW = 24;
  const fLink = (r) => `<a href="${esc(r.href)}">${esc(r.name)}<span>${esc(KIND[r.kind] ? L(KIND[r.kind][0], KIND[r.kind][1]) : '')}</span></a>`;
  const following = rows.length
    ? `<div class="ck-fl">${rows.slice(0, SHOW).map(fLink).join('')}${rows.length > SHOW ? `<details class="ck-fm"><summary>${L(`${rows.length - SHOW} more`, `${rows.length - SHOW} lainnya`)}</summary><div class="ck-fl">${rows.slice(SHOW).map(fLink).join('')}</div></details>` : ''}</div>`
    : `<p class="ck-fe">${L('Tap + Follow on any startup, BUMN, data centre or investor, and it shows up here.', 'Ketuk + Ikuti di startup, BUMN, pusat data, atau investor mana pun, dan ia muncul di sini.')}</p>`;

  /* the one skippable question (call 4), here instead of above the chat */
  const roleRow = user.role_at
    ? `<div><dt>${L('What you do', 'Pekerjaan')}</dt><dd>${role ? esc(L(role[1], role[2])) : '—'}<details class="ck-chg"><summary>${L('Change', 'Ubah')}</summary><form method="POST" action="/me/role" class="ck-roles">${roleButtons(L, lang)}</form></details></dd></div>`
    : `<div><dt>${L('What you do', 'Pekerjaan')}</dt><dd><form method="POST" action="/me/role" class="ck-roles">${roleButtons(L, lang)}<button type="submit" name="skip" value="1" class="skip">${L('Skip', 'Lewati')}</button></form></dd></div>`;

  const body = `<style>
.ck{max-width:808px;margin:0 auto;padding:clamp(36px,7vh,76px) 24px 8px}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ck-hero{text-align:center;display:grid;justify-items:center;gap:12px;margin-bottom:28px}
.ck-hero .eyebrow{margin:0}
.ck-hero .eyebrow .sq{background:#E8734B}
.ck-hero h1{font-size:clamp(32px,5.4vw,56px);line-height:1.04;letter-spacing:-0.035em;font-weight:500;max-width:16ch;text-wrap:balance}
.ck-sub{color:#52525B;font-size:16px;line-height:1.55;max-width:56ch;text-wrap:balance}
.ck-box{position:relative;border:1px solid #000;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.08)}
.ck-box:focus-within{box-shadow:0 0 0 3px rgba(232,115,75,.35),0 18px 50px rgba(0,0,0,.08)}
.ck-box textarea{display:block;width:100%;border:0;outline:0;resize:none;background:transparent;padding:20px 20px 16px;font:400 18px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;color:#000;min-height:64px;max-height:200px;border-radius:0}
.ck-box textarea::placeholder{color:#8A8A92}
.ck-bar{display:flex;align-items:center;gap:10px;border-top:1px solid #EFEFEF;background:#FAFAFA;padding:8px 8px 8px 10px}
.ck-cs{flex:1;min-width:0;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.ck-cs::-webkit-scrollbar{display:none}
.ck-c{flex:none;border:1px solid transparent;background:transparent;color:#6B6B73;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:10px 11px;cursor:pointer;border-radius:0;white-space:nowrap}
.ck-c:hover{color:#000}
.ck-c[aria-pressed="true"]{background:#fff;border-color:#000;color:#000}
.ck-c.ck-pp em{font-style:normal;color:#B4532F;margin-left:6px}
.ck-go{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;background:#E8734B;color:#fff;cursor:pointer;border-radius:0}
.ck-go:hover{background:#D4643E}
.ck-go:disabled{background:#D9D9DE;cursor:default}
.ck-sg{position:absolute;z-index:40;left:-1px;right:-1px;top:100%;margin:0;padding:0;list-style:none;background:#fff;border:1px solid #000;border-top:0;box-shadow:0 18px 40px rgba(0,0,0,.12);max-height:min(360px,56vh);overflow:auto}
.ck-sg[hidden],.ck-try[hidden],.ck-th[hidden],.ck-ld [hidden]{display:none}
.ck-sg .h{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73;padding:11px 14px 7px;cursor:default}
.ck-sg li[role="option"]{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #F1F1F1;cursor:pointer}
.ck-sg li[aria-selected="true"]{background:#FFF6F1;box-shadow:inset 3px 0 #E8734B}
.ck-sg .t{min-width:0;flex:1;display:grid;gap:2px}
.ck-sg .t b{font-weight:600;font-size:14.5px;color:#000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-sg .t span{font-size:12.5px;color:#52525B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-sg .k{flex:none;font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:4px 6px}
.ck-try{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;margin-top:16px}
.ck-try>span{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73;margin-right:2px}
.ck-x{border:1px solid #E7E7E7;background:#fff;color:#000;font:400 13.5px/1.3 'Overused Grotesk',system-ui,sans-serif;padding:8px 11px;cursor:pointer;border-radius:0;text-align:left}
.ck-x:hover{border-color:#000}
.ck-th{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:30px;font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73}
.ck-new{border:1px solid #D9D9DE;background:#fff;color:#000;font:inherit;letter-spacing:inherit;text-transform:inherit;padding:8px 10px;cursor:pointer;border-radius:0}
.ck-new:hover{border-color:#000}
.ck-thread{display:grid;gap:0;margin-top:10px}
.ck-thread:empty{display:none}
.ck-qa{border-top:1px solid #E7E7E7;padding:18px 0 20px;display:grid;gap:10px}
.ck-qq{font-weight:600;font-size:17px;line-height:1.35;margin:0;letter-spacing:-0.01em}
.ck-qq span{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:3px 6px;margin-left:8px;vertical-align:3px;white-space:nowrap}
.ck-st{display:flex;flex-wrap:wrap;gap:4px 10px;margin:0;padding:0;list-style:none;font:400 11.5px/1.4 'IBM Plex Mono',monospace;color:#6B6B73}
.ck-st:empty{display:none}
.ck-st li::before{content:"\\2192\\00a0";color:#E8734B}
.ck-st li.run::after{content:" \\2026";animation:ckblink 1s steps(2,end) infinite}
@keyframes ckblink{50%{opacity:0}}
.ck-caret{display:inline-block;width:.5em;height:1.05em;margin-left:3px;background:#E8734B;vertical-align:-3px;animation:ckblink 1s steps(2,end) infinite}
@media(prefers-reduced-motion:reduce){.ck-st li.run::after,.ck-caret{animation:none}}
.ck-an{font-size:15.5px;line-height:1.65;color:#18181B;display:grid;gap:8px;overflow-wrap:anywhere;font-weight:400}
.ck-an p,.ck-an ul{margin:0}
.ck-an ul{padding-left:18px;display:grid;gap:4px}
.ck-an b{font-weight:600}
.ck-an a{color:#000;text-decoration:underline;text-decoration-color:#E8734B;text-underline-offset:3px;font-weight:500}
.ck-an.wait{color:#6B6B73}
.ck-an.calm{color:#52525B}
.ck-en{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 0;padding:0;list-style:none}
.ck-en li{display:flex;align-items:center;gap:8px;border:1px solid #E7E7E7;padding:5px 5px 5px 9px;min-width:0;max-width:100%}
.ck-en a{font-weight:600;font-size:13.5px;color:#000;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-en .fw1001{padding:6px 8px;font-size:10px}
.ck-sr{font:400 11px/1.4 'IBM Plex Mono',monospace;color:#8A8A92;margin:0}
.ck-pn{font-size:12px;line-height:1.5;color:#8A8A92;text-align:center;margin:18px auto 0;max-width:62ch}
.ck-me{margin-top:56px;border-top:1px solid #E7E7E7;padding-top:18px;display:grid;gap:18px}
.ck-mh{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73;margin:0 0 10px}
.ck-fl{display:flex;flex-wrap:wrap;gap:6px}
.ck-fl a{display:inline-flex;align-items:center;gap:8px;border:1px solid #E7E7E7;padding:7px 10px;text-decoration:none;color:#000;font-size:13.5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-fl a:hover{border-color:#000}
.ck-fl a span{font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#8A8A92}
.ck-fm{margin-top:6px}
.ck-fm summary{cursor:pointer;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#52525B;padding:6px 0}
.ck-fe{font-size:14px;line-height:1.5;color:#52525B;margin:0}
.ck-acct dl{margin:0;display:grid;border-top:1px solid #F1F1F1}
.ck-acct dl>div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;padding:10px 0;border-bottom:1px solid #F1F1F1;font-size:14px;align-items:start}
.ck-acct dt{color:#6B6B73;font-weight:400}
.ck-acct dd{margin:0;overflow-wrap:anywhere}
.ck-roles{display:flex;flex-wrap:wrap;gap:6px}
.ck-roles button{border:1px solid #D9D9DE;background:#fff;color:#000;font:500 13.5px/1 'Overused Grotesk',system-ui,sans-serif;padding:9px 11px;cursor:pointer;border-radius:0}
.ck-roles button:hover{border-color:#000}
.ck-roles .skip{color:#6B6B73}
.ck-chg{display:inline-block;margin-left:10px}
.ck-chg summary{cursor:pointer;color:#52525B;font-size:13px;text-decoration:underline;text-underline-offset:3px}
.ck-chg[open]{display:block;margin:8px 0 0}
.ck-out{margin-top:12px}
.ck-ld{border:1px solid #000;padding:0;max-width:440px;width:calc(100% - 32px);box-shadow:0 24px 70px rgba(0,0,0,.2);color:#000;margin:auto}
.ck-ld::backdrop{background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ck-ld::before{content:"";display:block;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
.ck-ld form{display:grid;gap:12px;padding:20px 22px 18px;margin:0}
.ck-ld .k{display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;margin:0}
.ck-ld .k i{width:6px;height:6px;background:#E8734B;display:inline-block}
.ck-ld h2{font:500 26px/1.12 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.02em;margin:0;text-wrap:balance}
.ck-ld p{font-size:14.5px;line-height:1.55;color:#3F3F46;margin:0}
.ck-ld .a{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:4px}
.ck-lb{border:1px solid #000;background:#000;color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;padding:12px 14px;cursor:pointer;border-radius:0}
.ck-lb[aria-pressed="true"]{background:#fff;color:#000;cursor:default}
.ck-lb[aria-pressed="true"]::before{content:"\\2713  "}
.ck-ld .x{border:1px solid #E7E7E7;background:#fff;color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;padding:12px 14px;cursor:pointer;border-radius:0}
.ck-ld .ok{color:#1E7A46;font-size:13.5px}
@media(max-width:759px){
  .ck{padding:28px 16px 8px}
  .ck-hero{gap:10px;margin-bottom:22px}
  .ck-sub{font-size:14.5px}
  .ck-box textarea{font-size:16px;padding:16px 14px 12px;min-height:76px}   /* two lines: the example question wraps on a 320 px phone */
  .ck-bar{padding:6px 6px 6px 6px;gap:6px}
  .ck-cs{-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);padding-right:18px}
  .ck-c{padding:10px 9px}
  .ck-go{width:42px;height:42px}
  .ck-try{justify-content:flex-start}
  .ck-try>span{width:100%;margin-bottom:2px}
  .ck-qq{font-size:16px}
  .ck-me{margin-top:44px}
  .ck-acct dl>div{grid-template-columns:1fr;gap:4px}
}
</style>
<main class="ck" id="ck" data-lang="${lang === 'id' ? 'id' : 'en'}">
  <header class="ck-hero">
    <div class="eyebrow"><span class="sq"></span>Ask 1001</div>
    <h1>${L('Ask about Indonesia’s companies', 'Tanya soal perusahaan Indonesia')}</h1>
    <p class="ck-sub">${esc(L(`Answers come only from 1001’s data: ${nf(k.startups)} startups, ${nf(k.bumn)} BUMN with ${nf(k.subs)} subsidiaries, ${nf(k.dcs)} data centres and ${nf(k.investors)} investors.`,
      `Jawaban hanya dari data 1001: ${nf(k.startups)} startup, ${nf(k.bumn)} BUMN dengan ${nf(k.subs)} anak usaha, ${nf(k.dcs)} pusat data, dan ${nf(k.investors)} investor.`))}</p>
  </header>
  <form class="ck-box" id="ck-f" autocomplete="off">
    <label class="vh" for="ck-q">${L('Ask 1001 a question', 'Tanya Ask 1001')}</label>
    <textarea id="ck-q" name="q" rows="1" maxlength="500" spellcheck="false" aria-autocomplete="list" aria-controls="ck-sg" aria-describedby="ck-pn" placeholder="${esc(L(SCOPES[0][3], SCOPES[0][4]))}"></textarea>
    <div class="ck-bar">
      <div class="ck-cs" role="group" aria-label="${L('Where to look', 'Cari di')}">
        ${chips}
        <button type="button" class="ck-c ck-pp" data-people aria-haspopup="dialog">${L('People', 'Orang')}<em>${L('Soon', 'Segera')}</em></button>
      </div>
      <button type="submit" class="ck-go" aria-label="${L('Ask', 'Tanya')}">${ARROW}</button>
    </div>
    <ul class="ck-sg" id="ck-sg" role="listbox" aria-label="${L('Pages on 1001', 'Halaman di 1001')}" hidden></ul>
  </form>
  ${tries}
  <div class="ck-th" id="ck-th" hidden><span>${L('This chat', 'Chat ini')}</span><button type="button" class="ck-new" id="ck-new">${L('New chat', 'Chat baru')}</button></div>
  <div class="ck-thread" id="ck-thread" aria-live="polite"></div>
  <p class="ck-pn" id="ck-pn">${L('Ask 1001 can make mistakes, so check the pages it links. Questions are kept without your name, to improve Ask 1001.', 'Ask 1001 bisa keliru, jadi cek halaman yang ditautkannya. Pertanyaan disimpan tanpa namamu, untuk memperbaiki Ask 1001.')}</p>
  <section class="ck-me" aria-label="${L('Your 1001', '1001 kamu')}">
    <div>
      <h2 class="ck-mh">${L('Following', 'Yang kamu ikuti')}${rows.length ? ` · ${nf(rows.length)}` : ''}</h2>
      ${following}
    </div>
    <div class="ck-acct">
      <h2 class="ck-mh">${L('Your account', 'Akun kamu')}</h2>
      <dl>
        <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
        ${roleRow}
      </dl>
      <form method="POST" action="/signout" class="ck-out"><input type="hidden" name="lang" value="${lang === 'id' ? 'id' : 'en'}"><button class="btn" type="submit">${L('Sign out', 'Keluar')}</button></form>
    </div>
  </section>
</main>
<dialog class="ck-ld" id="ck-ld" aria-labelledby="ck-ld-h">
  <form method="dialog">
    <p class="k"><i aria-hidden="true"></i>${L('Lead agent · coming soon', 'Agen kontak · segera hadir')}</p>
    <h2 id="ck-ld-h">${L('The right person at any company.', 'Orang yang tepat di perusahaan mana pun.')}</h2>
    <p>${L('Name a company and a role. Get the person and how to reach them, with the source for each contact.', 'Sebut perusahaan dan jabatannya. Dapatkan orangnya dan cara menghubunginya, lengkap dengan sumber tiap kontak.')}</p>
    <div class="a">
      <button type="button" class="ck-lb" data-early aria-pressed="${early ? 'true' : 'false'}">${early ? L('You’re on the list', 'Kamu sudah terdaftar') : L('Get early access', 'Minta akses awal')}</button>
      <button type="submit" value="close" class="x">${L('Close', 'Tutup')}</button>
    </div>
    <p class="ok" data-ok${early ? '' : ' hidden'}>${L('It will show up in this box when it opens.', 'Agen ini muncul di kotak ini saat dibuka.')}</p>
  </form>
</dialog>
<script src="/js/chat1001.js?v=${V}c1" data-lang="${lang === 'id' ? 'id' : 'en'}" defer></script>`;
  return shell({
    title: L('Ask 1001 — 1001startup.id', 'Ask 1001 — 1001startup.id'),
    desc: L('Ask about Indonesia’s startups, BUMN, data centres and investors.', 'Tanya soal startup, BUMN, pusat data, dan investor Indonesia.'),
    path: '/me', lang, body, robots: 'noindex, nofollow', active: '',
  });
}

module.exports = { page, SCOPES };
