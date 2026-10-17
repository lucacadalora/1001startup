'use strict';
/**
 * 1001startup.id — Lead Search.
 *
 * The census answers "which companies exist". This answers "who do I talk to,
 * and how do I reach them" — the commercial lane the census was always headed
 * for. Two pages: a passcode gate and the console.
 *
 * The console is built as a shell with a product rail because there will be
 * more lanes later. The rail deliberately names only the lane that exists.
 * Inventing plausible-sounding future products would read, to anyone but us,
 * exactly like shipped features.
 *
 * Same editorial system as the rest of 1001: white, hairlines, square corners,
 * Overused Grotesk over IBM Plex Mono, no emoji anywhere.
 *
 * LANGUAGE: every shell takes `lang` and translates inline with L(en, id) —
 * see i18n1001.js. Data stays as recorded (names, roles, evidence quotes,
 * engine notes); the frame around it is what speaks Indonesian. Form actions
 * and fetch URLs stay bare — only PAGE links get the /id prefix.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

/* Confidence is the whole product. It gets a colour, never an icon. */
const CONF = {
  published: '#2F7A5C',
  inferred: '#8A6D3B',
  ambiguous: '#B2447E',
  none: '#8E8E93',
};

/* The confidence markers are semantic, so their Indonesian labels are fixed
   here once, precision over brevity: an inferred address must never read as
   anything firmer than "hasil inferensi pola". Unknown values pass through. */
const CONF_ID = {
  published: 'terpublikasi',
  inferred: 'hasil inferensi pola',
  ambiguous: 'ambigu',
  none: 'nihil',
};

const BASE = `
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000}
.btn.primary{background:#000;color:#fff}
.btn:disabled{border-color:#74747D;color:#74747D;background:#fff;cursor:default}
`;

/* opts: { robots, desc, path }. `path` emits hreflang/canonical pairs and is
   passed for /leads ONLY — the gate and the history pages are account pages,
   they stay noindex and declare no alternates. */
function head(lang, title, extraCss, opts) {
  const { robots = 'noindex, nofollow', desc = '', path = null } = opts || {};
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}<meta name="robots" content="${robots}">
${path ? I18N.headTags(lang, path) + '\n' + I18N.ogImage() + '\n' : ''}<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<style>${BASE}${extraCss || ''}</style>
</head>`;
}

/* ── the gate ─────────────────────────────────────────────────────── */

const LOGIN_CSS = `
.gate{min-height:100vh;display:grid;place-items:center;padding:40px 20px}
.gcol{width:100%;max-width:392px;text-align:center}
.gmark{width:40px;height:40px;border:1.5px solid #000;display:grid;place-items:center;margin:0 auto 22px;font:600 12px/1 'IBM Plex Mono',monospace}
.gcol h1{font-size:26px;letter-spacing:-0.02em;font-weight:500}
.gsub{color:#6B6B73;font-size:14px;margin-top:8px}
.gform{text-align:left;margin-top:28px}
.gform label{display:block;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:7px}
.gform input{width:100%;padding:13px 15px;border:1px solid #000;font:500 15px/1 'Overused Grotesk',sans-serif;outline:none;background:#fff;color:#000}
.gform input:focus{box-shadow:inset 0 -2px #E8734B}
.gform .btn{width:100%;margin-top:14px;text-align:center}
.gerr{margin-top:12px;font-size:13px;color:#C0392B;border-left:2px solid #C0392B;padding-left:10px}
.gfoot{margin-top:26px;font-size:12.5px;color:#6B6B73;line-height:1.6}
.gfoot a{color:#52525B}
`;

function login({ error, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return `${head(lang, L('Lead search — 1001startup.id', 'Cari Kontak — 1001startup.id'), LOGIN_CSS)}
<body>
<div class="banner">1001STARTUP.ID · ${L('LEAD SEARCH', 'CARI KONTAK')} · INTERNAL</div>
<div class="gate"><div class="gcol">
  <div class="gmark">1001</div>
  <h1>${L('Lead search', 'Cari Kontak')}</h1>
  <p class="gsub">${L('Research agents over the census. Sign in to run a search.',
    'Agen riset yang bekerja di atas data sensus. Masuk untuk menjalankan pencarian.')}</p>
  <form class="gform" method="POST" action="/leads/login">
    <label for="passcode">${L('Access code', 'Kode akses')}</label>
    <input id="passcode" name="passcode" type="password" autocomplete="current-password" autofocus required>
    ${error ? `<p class="gerr">${esc(error)}</p>` : ''}
    <button class="btn primary" type="submit">${L('Sign in', 'Masuk')}</button>
  </form>
  <p class="gfoot">
    ${L('Runs spend real credits on the Vantis Card rail.',
    'Setiap pencarian memakai kredit sungguhan di jalur Vantis Card.')}<br>
    <a href="${NAV.censusHome(PF)}">${L('Back to the census', 'Kembali ke sensus')}</a>
  </p>
</div></div>
</body>
</html>`;
}

/* ── the console ──────────────────────────────────────────────────── */

const DASH_CSS = `
${NAV.css}
.lay{max-width:1180px;margin:0 auto;padding:26px 20px 80px;display:grid;grid-template-columns:210px 1fr;gap:34px;align-items:start}
@media(max-width:900px){.lay{grid-template-columns:1fr;gap:20px}}
.rail{position:sticky;top:20px}
@media(max-width:900px){.rail{position:static}}
.rgrp{font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#6B6B73;margin:0 0 10px}
.rail a,.rail span.off{display:block;padding:9px 11px;text-decoration:none;font-size:14px;border-left:2px solid transparent;color:#52525B}
.rail a.on{color:#000;border-left-color:#E8734B;background:#FAFAFA;font-weight:600}
.rail span.off{color:#74747D;cursor:default}
.rnote{font-size:12px;line-height:1.5;color:#6B6B73;margin-top:14px;padding:0 11px}
h1.pt{font-size:30px;letter-spacing:-0.025em;font-weight:500}
.plede{color:#52525B;font-size:15px;max-width:64ch;margin-top:8px;line-height:1.55}
.card{border:1px solid #E7E7E7;padding:20px;margin-top:22px}
.card h2{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#6B6B73;margin-bottom:14px}
.f{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.f{grid-template-columns:1fr}}
.f .wide{grid-column:1/-1}
.f label{display:block;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:6px}
.f input,.f textarea{width:100%;padding:11px 13px;border:1px solid #D9D9DE;font:500 14.5px/1.45 'Overused Grotesk',sans-serif;outline:none;background:#fff;color:#000}
.f input:focus,.f textarea:focus{border-color:#000}
.f textarea{min-height:74px;resize:vertical}
.f .hint{font-size:11.5px;color:#6B6B73;margin-top:5px;line-height:1.45}
.act{display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap}
.opt{font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;border:1px solid #E7E7E7;padding:3px 5px;margin-left:7px}
.runwrap{display:none;margin-top:16px;border-top:1px solid #E7E7E7;padding-top:16px;grid-template-columns:128px 1fr;gap:20px;align-items:start}
.runwrap.on{display:grid}
@media(max-width:700px){.runwrap{grid-template-columns:1fr;gap:10px}.orbwrap{justify-self:start}}
.orbwrap{display:flex;flex-direction:column;align-items:center;gap:8px;position:sticky;top:20px}
.orbcap{font-size:9.5px;color:#6B6B73;letter-spacing:.1em;text-align:center;min-height:12px}
.steps{display:block;margin:0;border:0;padding:0}
.step{display:flex;gap:10px;align-items:baseline;padding:5px 0;font-size:13.5px;color:#52525B}
.step .k{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;min-width:74px}
.step.dn .k{color:#2F7A5C}
.ledger{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-top:22px}
@media(max-width:700px){.ledger{grid-template-columns:repeat(2,1fr)}}
.ledger .c{background:#fff;padding:14px 15px}
.ledger .v{font-size:20px;letter-spacing:-0.02em;font-weight:600}
.ledger .k{font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:4px}
.tablewrap{overflow-x:auto;margin-top:22px;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;font-size:14px}
th{font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;text-align:left;padding:11px 13px;border-bottom:1px solid #E7E7E7;background:#FAFAFA;white-space:nowrap}
td{padding:12px 13px;border-bottom:1px solid #F2F2F4;vertical-align:top}
tr:last-child td{border-bottom:0}
td .nm{font-weight:600}
td .rl{color:#52525B;font-size:13px;line-height:1.4}
td .why{color:#52525B;font-size:13px;line-height:1.45}
.em{font-family:'IBM Plex Mono',monospace;font-size:12.5px;word-break:break-all}
.em a{color:#2F7A5C}
.alt{display:block;color:#6B6B73;font-size:11.5px;margin-top:3px;font-family:'IBM Plex Mono',monospace}
.chip{display:inline-block;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border:1px solid currentColor;padding:4px 6px;white-space:nowrap}
.ev{margin-top:22px;border:1px solid #E7E7E7;padding:20px}
.ev h2{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#6B6B73;margin-bottom:12px}
.ev p{font-size:13.5px;color:#52525B;line-height:1.6;margin-bottom:10px}
.ev ul{margin:10px 0 0 18px;font-size:13px;color:#52525B;line-height:1.7}
.ev code{font-family:'IBM Plex Mono',monospace;font-size:12px;background:#F6F6F6;padding:1px 4px}
.warn{border-left:2px solid #8A6D3B;padding-left:12px;color:#52525B;font-size:13px;line-height:1.6;margin-top:14px}
.err{border-left:2px solid #C0392B;padding-left:12px;color:#C0392B;font-size:13.5px;margin-top:14px;line-height:1.55}
.recent{margin-top:14px;font-size:13px;color:#6B6B73}
.recent b{color:#000;font-weight:600}
.lo{margin-left:auto;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;background:none;border:0;cursor:pointer;padding:9px 11px}
.lo:hover{color:#000}
`;

/* One rail for both console pages. When a third product lands it is added
   here once, not in each view. Page links get the language prefix; the
   logout form action stays bare — a POST to /id/... would be 302'd. */
function rail(active, lang) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const item = (href, label, on) => on
    ? `<a class="on" href="${href}">${esc(label)}</a>`
    : `<a href="${href}">${esc(label)}</a>`;
  return `<aside class="rail">
    <p class="rgrp">${L('Products', 'Produk')}</p>
    ${item(PF + '/leads', L('Lead search', 'Cari kontak'), active === 'search')}
    ${item(PF + '/leads/history', L('History', 'Riwayat'), active === 'history')}
    <span class="off">${L('More lanes to come', 'Jalur lain menyusul')}</span>
    <p class="rnote">${L("Lead search is the only lane running. The next ones are Luca's to name.",
    'Baru jalur cari kontak yang berjalan. Penamaan jalur berikutnya menunggu Luca.')}</p>
    <form method="POST" action="/leads/logout"><button class="lo" type="submit">${L('Sign out', 'Keluar')}</button></form>
  </aside>`;
}

function dashboard({ companies, stats, recent, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const list = (companies || []).map((c) => c.name).filter(Boolean).sort();
  const island = JSON.stringify({ companies: companies || [] }).replace(/</g, '\\u003c');
  const s = stats || { runs: 0, people: 0, cost: 0 };
  const rec = (recent || []).slice(0, 5);

  return `${head(lang,
    L('Lead search — 1001startup.id', 'Cari Kontak Startup Indonesia — 1001startup.id'),
    DASH_CSS, {
      robots: 'index, follow',
      path: '/leads',
      desc: L('Lead search over the census: research agents find the right person at each Indonesian startup — current role, and an email pattern learned from published evidence only. Nothing invented.',
        'Cari kontak startup Indonesia langsung dari sensus: agen riset menemukan orang yang tepat di tiap perusahaan — jabatan terkini dan pola email yang dipelajari hanya dari bukti terpublikasi. Tanpa karangan.'),
    })}
<body>
<div class="banner">${L('LEAD SEARCH · EXA RESEARCH + DEEPSEEK V4 FLASH ON THE VANTIS CARD RAIL',
    'CARI KONTAK · RISET EXA + DEEPSEEK V4 FLASH DI JALUR VANTIS CARD')}</div>
${NAV.header('agents', { lang, path: '/leads', translated: true })}
<div class="lay">

  ${rail('search', lang)}

  <main>
    <h1 class="pt">${L('Who to approach, and how to reach them',
    'Siapa yang perlu didekati, dan bagaimana menghubunginya')}</h1>
    <p class="plede">${L(`Name a company and say what you are selling. Research agents search public
      profiles through Exa, keep only the people who still work there, then work out the company's
      email format from addresses that are actually published. Asking for one person by name works
      too — "carikan email Budi Santoso di DOKU" — and the agent verifies where they work first.
      Every address is labelled as read or as inferred — nothing is presented as verified,
      because none of it is.`,
    `Sebutkan perusahaannya dan jelaskan apa yang dijual. Agen riset menelusuri profil publik
      lewat Exa, menyaring hanya orang yang masih bekerja di sana, lalu membaca pola email
      perusahaan dari alamat yang benar-benar terpublikasi. Meminta satu orang lewat namanya juga
      bisa — "carikan email Budi Santoso di DOKU" — dan agen memverifikasi dulu tempat orang itu
      bekerja. Setiap alamat diberi label: terbaca langsung dari halaman publik, atau hasil
      inferensi pola — tidak ada yang disajikan sebagai terverifikasi, karena memang tidak ada
      yang diverifikasi.`)}</p>

    <div class="card">
      <h2>${L('New search', 'Pencarian baru')}</h2>
      <form id="lf" class="f" autocomplete="off">
        <div>
          <label for="company">${L('Company', 'Perusahaan')} <span class="opt">${L('optional', 'opsional')}</span></label>
          <input id="company" name="company" list="colist" placeholder="${L('Kitabisa — or several, comma separated', 'Kitabisa — atau beberapa sekaligus, dipisah koma')}">
          <datalist id="colist">${list.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
          <p class="hint">${L(`${list.length} census companies autocomplete here, but any company works.
             Name several separated by commas, or leave it empty and the agent finds candidates from your brief.`,
    `${list.length} perusahaan sensus muncul otomatis saat mengetik di sini, tapi perusahaan di luar
             sensus pun bisa dicari. Sebutkan beberapa sekaligus dipisah koma, atau kosongkan —
             biarkan agen menemukan kandidat dari brief di bawah.`)}</p>
        </div>
        <div>
          <label for="domain">${L('Mail domain (optional)', 'Domain email (opsional)')}</label>
          <input id="domain" name="domain" placeholder="${L('left blank, the agent finds it', 'biarkan kosong, agen yang mencarinya')}">
          <p class="hint">${L("Staff mail is not always on the website domain. Blibli's sits on gdn-commerce.com.",
    'Email karyawan tidak selalu memakai domain situs webnya. Milik Blibli ada di gdn-commerce.com.')}</p>
        </div>
        <div class="wide">
          <label for="intent">${L('What are you selling, and who do you need', 'Apa yang dijual, dan siapa yang dicari')}</label>
          <textarea id="intent" name="intent" placeholder="${L('I sell an HRIS. I need whoever owns HR systems, the budget holder, and the IT gatekeeper.',
    'Saya menjual HRIS. Saya perlu pemilik sistem HR, pemegang anggaran, dan gatekeeper IT-nya.')}"></textarea>
          <p class="hint">${L(`This becomes the role queries. With no company above, it also decides which
             companies to research — so name the kind of business you are after. Asking for one
             person by name ("carikan email Budi Santoso") searches for that person instead.`,
    `Brief ini menjadi kueri jabatan. Kalau kolom perusahaan di atas kosong, brief ini juga yang
             menentukan perusahaan mana yang diriset — jadi sebutkan jenis bisnis yang disasar.
             Menyebut satu nama ("carikan email Budi Santoso") membuat agen mencari orang itu saja.`)}</p>
        </div>
        <div class="wide act">
          <button class="btn primary" id="run" type="submit">${L('Run search', 'Jalankan pencarian')}</button>
          <button class="btn" id="csv" type="button" disabled>${L('Copy CSV', 'Salin CSV')}</button>
          <span class="hint" id="rt"></span>
        </div>
      </form>
      <div class="runwrap" id="runwrap">
        <div class="orbwrap"><div id="orb"></div><div class="orbcap mono" id="orbcap"></div></div>
        <div class="steps" id="steps"></div>
      </div>
      <div id="err"></div>
    </div>

    <div id="out"></div>

    ${s.runs ? `<p class="recent"><b>${s.runs}</b> ${L('searches run so far', 'pencarian sejauh ini')} · <b>${s.people}</b> ${L('people found', 'orang ditemukan')} ·
      <b>US$${Number(s.cost || 0).toFixed(4)}</b> ${L('of inference spent', 'terpakai untuk inferensi')}${
    rec.length ? ' · ' + L('recent', 'terakhir') + ': ' + rec.map((r) => esc(r.company)).join(', ') : ''}</p>` : ''}
  </main>
</div>

<script type="application/json" id="leads-data">${island}</script>
<script src="/js/leads-orb.js?v=${V}" defer></script>
<script src="/js/leads1001.js?v=${V}" defer></script>
</body>
</html>`;
}


/* ── history ──────────────────────────────────────────────────────── */

const HIST_CSS = `
.hrow-l{display:block;text-decoration:none;border:1px solid #E7E7E7;padding:14px 16px;margin-top:-1px}
.hrow-l:hover{background:#FAFAFA;border-color:#000;position:relative;z-index:1}
.hh{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.hh b{font-size:15.5px;font-weight:600}
.hq{color:#52525B;font-size:13.5px;line-height:1.5;margin-top:6px;max-width:92ch}
.hm{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.hm b{color:#000;font-weight:600}
.who{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;border:1px solid #E7E7E7;padding:4px 6px;color:#52525B}
.nokeep{border:1px solid #E7D9BC;color:#8A6D3B;padding:3px 6px}
.failed{border-left:2px solid #C0392B}
.failed .hh b{color:#C0392B}
.pg{display:flex;gap:6px;margin-top:16px;align-items:center;flex-wrap:wrap}
.pg a,.pg span{padding:7px 11px;border:1px solid #E7E7E7;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;color:#000}
.pg a:hover{border-color:#000}
.pg .now{background:#000;color:#fff;border-color:#000}
.pg .rng{margin-left:auto;border:0;color:#6B6B73}
.back{display:inline-block;margin-bottom:14px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#52525B;text-decoration:none}
.back:hover{color:#000}
.prompt{border:1px solid #E7E7E7;padding:18px;margin-top:18px;background:#FAFAFA}
.prompt dt{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-bottom:5px}
.prompt dd{margin:0 0 14px;font-size:14.5px;line-height:1.55;white-space:pre-wrap}
.prompt dd:last-child{margin-bottom:0}
.rolechip{display:inline-block;font:400 11px/1 'IBM Plex Mono',monospace;border:1px solid #D9D9DE;padding:5px 7px;margin:0 5px 5px 0;color:#52525B;text-transform:none;letter-spacing:0}
.empty{color:#6B6B73;font-size:14px;padding:26px 0}
.notkept{border:1px solid #E7E7E7;border-left:2px solid #8A6D3B;padding:18px 20px;margin-top:22px}
.notkept h2{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#8A6D3B;margin-bottom:10px}
.notkept p{font-size:14px;line-height:1.6;color:#52525B;margin-bottom:8px}
.notkept p:last-child{margin-bottom:0}
.notkept code{font-family:'IBM Plex Mono',monospace;font-size:12.5px;background:#F6F6F6;padding:1px 4px}
`;

const shortDate = (s) => String(s || '').replace('T', ' ').slice(0, 16);
const money = (n) => 'US$' + Number(n || 0).toFixed(5);

/* running | done | failed | interrupted, resolved from what the row can prove.
   created_at is SQLite UTC ("YYYY-MM-DD HH:MM:SS"); a row still "running" long
   past any legitimate run length was killed by a restart before the boot sweep
   could flag it, and must be REPORTED as such — a stale "running" would imply
   work that is not happening. */
function stateOf(run) {
  if (run.status === 'running') {
    const born = Date.parse(String(run.created_at).replace(' ', 'T') + 'Z');
    return (Number.isFinite(born) && Date.now() - born > 10 * 60e3) ? 'interrupted' : 'running';
  }
  if (run.status === 'interrupted') return 'interrupted';
  return run.error ? 'failed' : 'done';
}

function history({ runs, page, pages, total, offset, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const rows = (runs || []).map((r) => {
    const state = stateOf(r);
    const meta = state === 'failed'
      ? `<div class="hm"><span style="color:#C0392B">${L('failed', 'gagal')} — ${esc(String(r.error).slice(0, 120))}</span></div>`
      : state === 'interrupted'
        ? `<div class="hm"><span class="nokeep">${L('interrupted — a server restart killed this run; nothing was saved',
          'terputus — server di-restart di tengah pencarian; tidak ada yang tersimpan')}</span></div>`
        : state === 'running'
          ? `<div class="hm"><span class="nokeep">${L('still running', 'masih berjalan')}</span></div>`
          : `<div class="hm">
            <span><b>${r.people}</b> ${L('people', 'orang')}</span>
            <span><b>${r.published}</b> ${L('published', 'terpublikasi')}</span>
            <span><b>${r.exa_queries}</b> exa</span>
            <span><b>${(r.tokens_in || 0) + '/' + (r.tokens_out || 0)}</b> ${L('tokens', 'token')}</span>
            <span><b>${esc(money(r.cost_usd))}</b></span>
            <span>${Math.round((r.ms || 0) / 1000)}s</span>
            ${r.has_result ? '' : `<span class="nokeep">${L('answer not kept', 'jawaban tidak disimpan')}</span>`}
          </div>`;
    return `<a class="hrow-l${state === 'failed' ? ' failed' : ''}" href="${PF}/leads/history/${r.id}">
      <div class="hh">
        <b>${esc(r.company || L('(no company)', '(tanpa perusahaan)'))}</b>
        ${r.session ? `<span class="who">${L('session', 'sesi')} ${esc(r.session)}</span>` : ''}
        <span class="hm" style="margin:0">${esc(shortDate(r.created_at))}</span>
      </div>
      ${r.intent ? `<p class="hq">${esc(String(r.intent).slice(0, 300))}</p>` : ''}
      ${meta}
    </a>`;
  }).join('');

  const pager = pages > 1 ? `<div class="pg">
    ${page > 1 ? `<a href="${PF}/leads/history?p=${page - 1}">${L('Prev', 'Sebelumnya')}</a>` : `<span style="color:#74747D">${L('Prev', 'Sebelumnya')}</span>`}
    ${Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 4), page + 3).map((n) => n === page
    ? `<span class="now">${n}</span>` : `<a href="${PF}/leads/history?p=${n}">${n}</a>`).join('')}
    ${page < pages ? `<a href="${PF}/leads/history?p=${page + 1}">${L('Next', 'Berikutnya')}</a>` : `<span style="color:#74747D">${L('Next', 'Berikutnya')}</span>`}
    <span class="pg rng" style="padding:0">${offset + 1}–${Math.min(offset + (runs || []).length, total)} ${L('of', 'dari')} ${total}</span>
  </div>` : '';

  return `${head(lang, L('History — Lead search', 'Riwayat — Cari Kontak'), DASH_CSS + HIST_CSS)}
<body>
<div class="banner">${L('LEAD SEARCH · RUN HISTORY', 'CARI KONTAK · RIWAYAT PENCARIAN')}</div>
${NAV.header('agents', { lang, path: '/leads/history' + (page > 1 ? '?p=' + page : ''), translated: true })}
<div class="lay">
  ${rail('history', lang)}
  <main>
    <h1 class="pt">${L('Every run, and what came back', 'Setiap pencarian, dan hasil yang kembali')}</h1>
    <p class="plede">${L(`Each search is kept with the brief that produced it and the people it returned,
      so an answer can be re-read without paying for it twice. Everyone signs in with the same access
      code, so this is one shared log — the session tag is what tells two people apart.`,
    `Setiap pencarian disimpan bersama brief pemicunya dan orang-orang yang ditemukannya, jadi
      jawaban bisa dibaca ulang tanpa membayar dua kali. Semua orang masuk dengan kode akses yang
      sama, jadi ini satu log bersama — yang membedakan dua pengguna adalah penanda sesinya.`)}</p>
    ${rows || `<p class="empty">${L('No searches have been run yet.', 'Belum ada pencarian yang dijalankan.')}</p>`}
    ${pager}
  </main>
</div>
</body>
</html>`;
}

function historyRun({ run, result, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const confLabel = (c) => L(c, CONF_ID[c] || c);
  const r = result || {};
  const people = r.people || [];
  const roles = (() => { try { return JSON.parse(run.roles || '[]'); } catch { return []; } })();
  const state = stateOf(run);

  /* A run whose output was never stored is NOT a run that found nobody. The
     first version of this page said "returned no currently-employed people"
     directly under a ledger reading 22 — missing data dressed up as a negative
     finding, which is the one thing this product must never do. The same rule
     covers interrupted and still-running rows: their zeros are absences, not
     findings, so neither the ledger nor an empty table may render for them. */
  const captured = !!result;

  if (state === 'interrupted' || state === 'running') {
    return `${head(lang, L('Run ' + run.id + ' — Lead search', 'Pencarian ' + run.id + ' — Cari Kontak'), DASH_CSS + HIST_CSS)}
<body>
<div class="banner">${L('LEAD SEARCH · RUN', 'CARI KONTAK · PENCARIAN')} ${run.id}</div>
${NAV.header('agents', { lang, path: '/leads/history/' + run.id, translated: true })}
<div class="lay">
  ${rail('history', lang)}
  <main>
    <a class="back" href="${PF}/leads/history">← ${L('All runs', 'Semua pencarian')}</a>
    <h1 class="pt">${esc(run.company || L('(no company)', '(tanpa perusahaan)'))}</h1>
    <p class="plede">${L('Run', 'Pencarian')} ${run.id} · ${esc(shortDate(run.created_at))}${
  run.session ? ' · ' + L('session', 'sesi') + ' ' + esc(run.session) : ''}${run.ip ? ' · ' + esc(run.ip) : ''}</p>
    <div class="prompt">
      <dl>
        <dt>${L('Company asked for', 'Perusahaan yang diminta')}</dt><dd>${esc(run.company || L('(left empty — the agent chooses)', '(dikosongkan — agen yang memilih)'))}</dd>
        <dt>${L('The brief', 'Brief')}</dt><dd>${esc(run.intent || L('(none given)', '(tidak diisi)'))}</dd>
        ${run.domain ? `<dt>${L('Mail domain', 'Domain email')}</dt><dd>${esc(run.domain)}</dd>` : ''}
      </dl>
    </div>
    ${state === 'running'
    ? `<div class="notkept">
      <h2>${L('Still running', 'Masih berjalan')}</h2>
      <p>${L(`This run started at ${esc(shortDate(run.created_at))} UTC and has not reported back yet.
        A search takes one to three minutes; refresh this page.`,
    `Pencarian ini dimulai pada ${esc(shortDate(run.created_at))} UTC dan belum melapor kembali.
        Satu pencarian butuh satu sampai tiga menit; muat ulang halaman ini.`)}</p>
    </div>`
    : `<div class="notkept">
      <h2>${L('Interrupted — a server restart killed this run', 'Terputus — server di-restart di tengah pencarian')}</h2>
      <p>${L(`The run was cut off mid-flight before it could finish, most likely by a deploy restarting
        the server. Whatever it had spent up to that point is gone and nothing was saved.`,
    `Pencarian terpotong di tengah jalan sebelum sempat selesai — kemungkinan besar karena deploy
        me-restart server. Biaya yang sudah keluar sampai titik itu hangus, dan tidak ada yang
        tersimpan.`)}</p>
      <p>${L(`Nothing here should be read as a finding about ${esc(run.company || 'the target')} —
        run the same search again.`,
    `Jangan baca apa pun di halaman ini sebagai temuan tentang ${esc(run.company || 'perusahaan target')} —
        jalankan ulang pencarian yang sama.`)}</p>
    </div>`}
  </main>
</div>
</body>
</html>`;
  }
  const table = people.length ? `<div class="tablewrap"><table>
    <thead><tr>
      <th>${L('Person', 'Nama')}</th>${r.multi ? `<th>${L('Company', 'Perusahaan')}</th>` : ''}<th>${L('Current role', 'Jabatan saat ini')}</th>
      <th>Email</th><th>${L('Confidence', 'Tingkat keyakinan')}</th><th>${L('Why them', 'Kenapa dia')}</th>
    </tr></thead>
    <tbody>${people.map((p) => {
    const e = p.email || {};
    const col = CONF[e.confidence] || CONF.none;
    const addr = e.value
      ? (e.confidence === 'published' && e.sources && e.sources[0]
        ? `<a href="${esc(e.sources[0])}" target="_blank" rel="noopener noreferrer">${esc(e.value)}</a>`
        : esc(e.value))
      : '—';
    return `<tr>
        <td><div class="nm">${p.linkedin
    ? `<a href="${esc(p.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(p.name || '')}</a>`
    : esc(p.name || '')}</div>${p.since ? `<div class="rl">${L('since', 'sejak')} ${esc(p.since)}</div>` : ''}</td>
        ${r.multi ? `<td class="rl">${esc(p.company || '')}</td>` : ''}
        <td><div class="rl">${esc(p.role || '—')}</div>${p.department ? `<div class="rl">${esc(p.department)}</div>` : ''}</td>
        <td><div class="em">${addr}</div>${(e.alternates || []).length
    ? `<span class="alt">${L('or', 'atau')} ${esc((e.alternates || []).join(L('  or  ', '  atau  ')))}</span>` : ''}${
  e.basis === 'shape' ? `<span class="alt">${L('format from address shapes, not name-verified', 'pola dari bentuk alamat, tanpa verifikasi nama')}</span>`
    : e.basis === 'assumed' ? `<span class="alt">${L('no format evidence — convention only', 'tanpa bukti pola — hanya konvensi')}</span>` : ''}</td>
        <td><span class="chip" style="color:${col}">${esc(confLabel(e.confidence || 'none'))}</span></td>
        <td class="why">${esc(p.why || '')}</td>
      </tr>`;
  }).join('')}</tbody></table></div>`
    : (captured ? `<p class="empty">${L('This run returned no currently-employed people.',
      'Pencarian ini tidak menemukan satu pun orang yang masih bekerja di sana.')}</p>` : '');

  const ev = (run.error || !captured) ? '' : `<div class="ev">
    <h2>${L('How these addresses were decided', 'Bagaimana alamat-alamat ini diputuskan')}</h2>
    ${r.multi && (r.companies || []).length
    ? (r.companies || []).map((c) => `<p><b>${esc(c.name)}</b> — ${L('mail domain', 'domain email')} <code>${esc(c.domain || L('not found', 'tidak ditemukan'))}</code>${
      c.mailProvider ? ' ' + L('on', 'di') + ' ' + esc(c.mailProvider) : ''}, ${c.people || 0} ${L('people', 'orang')}, ${
      (c.patterns || []).length ? L('format', 'pola') + ' ' + esc(c.patterns[0].pattern) + ' (' + c.patterns[0].observed + ' ' + L('agreeing', 'alamat sepakat') + ')'
        : L('no format learned, so nothing was guessed', 'tidak ada pola yang terbaca, jadi tidak ada yang ditebak')}.</p>`).join('')
    : `<p>${L('Mail domain', 'Domain email')} <code>${esc(r.domain || L('not found', 'tidak ditemukan'))}</code>${r.mailProvider ? ' ' + L('on', 'di') + ' ' + esc(r.mailProvider) : ''}${
      r.domainSource ? ', ' + L('from', 'dari') + ' ' + esc(r.domainSource) : ''}.</p>
        ${r.domainTrusted === false
      ? `<div class="warn">${L('That domain could not be tied to the company name, so no addresses were guessed from it.',
        'Domain itu tidak bisa dikaitkan dengan nama perusahaannya, jadi tidak ada alamat yang ditebak darinya.')}</div>` : ''}
        ${(r.patterns || []).length
      ? '<p>' + L('Format learned from addresses that are actually published:', 'Pola email dipelajari dari alamat yang benar-benar terpublikasi:') + '</p><ul>'
            + (r.patterns || []).map((x) => `<li>${esc(x.pattern)} — ${x.observed} ${L('real address' + (x.observed === 1 ? ' agrees' : 'es agree'), 'alamat asli sepakat')}</li>`).join('') + '</ul>'
      : (r.shapes || []).length
        ? '<p>' + L('No published address could be matched to a person by name, so the format was read from the SHAPE of real addresses on this domain:',
          'Tidak ada alamat terpublikasi yang bisa dicocokkan ke nama orang, jadi pola dibaca dari BENTUK alamat asli di domain ini:') + '</p><ul>'
              + (r.shapes || []).map((x) => `<li>${esc(x.pattern)} — ${x.observed} ${L('address' + (x.observed === 1 ? '' : 'es'), 'alamat')}${(x.examples || []).length
                ? ' (' + esc((x.examples || []).slice(0, 3).join(', ')) + ')' : ''}</li>`).join('')
              + '</ul><div class="warn">' + L('Shape evidence is weaker than a name match: it shows how this company builds addresses, not that any particular address exists.',
          'Bukti bentuk lebih lemah daripada kecocokan nama: ia menunjukkan cara perusahaan ini menyusun alamat, bukan bahwa alamat tertentu benar-benar ada.') + '</div>'
        : `<p>${r.domainTrusted === false
          ? L('No address format could be learned, and the domain is not trusted, so no address was guessed.',
            'Tidak ada pola alamat yang bisa dipelajari, dan domainnya tidak tepercaya, jadi tidak ada alamat yang ditebak.')
          : L('No address format could be learned. The addresses above use the first.last convention and have nothing observed behind them.',
            'Tidak ada pola alamat yang bisa dipelajari. Alamat di atas memakai konvensi first.last dan tidak punya satu pun observasi di baliknya.')}</p>`}`}
    ${(r.emailsFound || []).length
    ? `<p>${(r.emailsFound || []).length} ${L('addresses were found verbatim on public pages:', 'alamat ditemukan tertulis persis di halaman publik:')}</p><ul>${
      (r.emailsFound || []).slice(0, 12).map((f) => `<li>${esc(f.email)} ${f.sources && f.sources[0]
        ? `<a href="${esc(f.sources[0])}" target="_blank" rel="noopener noreferrer">${L('source', 'sumber')}</a>` : ''}</li>`).join('')}</ul>` : ''}
    ${(r.roleBoxes || []).length
    ? `<p>${L('Shared mailboxes found (real, but they belong to nobody, so they never vote on the format):',
      'Kotak surat bersama yang ditemukan (asli, tapi bukan milik perorangan, jadi tidak pernah ikut menentukan pola email):')}
         ${esc((r.roleBoxes || []).map((x) => x.email).join(', '))}</p>` : ''}
    ${r.verification ? `<div class="warn">${esc(r.verification)}</div>` : ''}
    ${(r.notes || []).length ? `<div class="warn">${L('Run notes:', 'Catatan pencarian:')} ${esc((r.notes || []).join('; '))}</div>` : ''}
  </div>`;

  return `${head(lang, L('Run ' + run.id + ' — Lead search', 'Pencarian ' + run.id + ' — Cari Kontak'), DASH_CSS + HIST_CSS)}
<body>
<div class="banner">${L('LEAD SEARCH · RUN', 'CARI KONTAK · PENCARIAN')} ${run.id}</div>
${NAV.header('agents', { lang, path: '/leads/history/' + run.id, translated: true })}
<div class="lay">
  ${rail('history', lang)}
  <main>
    <a class="back" href="${PF}/leads/history">← ${L('All runs', 'Semua pencarian')}</a>
    <h1 class="pt">${esc(run.company || L('(no company)', '(tanpa perusahaan)'))}</h1>
    <p class="plede">${L('Run', 'Pencarian')} ${run.id} · ${esc(shortDate(run.created_at))}${
  run.session ? ' · ' + L('session', 'sesi') + ' ' + esc(run.session) : ''}${run.ip ? ' · ' + esc(run.ip) : ''}</p>

    <div class="prompt">
      <dl>
        <dt>${L('Company asked for', 'Perusahaan yang diminta')}</dt><dd>${esc(run.company || L('(left empty — the agent chose)', '(dikosongkan — agen yang memilih)'))}</dd>
        <dt>${L('The brief', 'Brief')}</dt><dd>${esc(run.intent || L('(none given)', '(tidak diisi)'))}</dd>
        ${run.domain ? `<dt>${L('Mail domain', 'Domain email')}</dt><dd>${esc(run.domain)}</dd>` : ''}
        ${roles.length ? `<dt>${L('Role queries the model expanded it into', 'Kueri jabatan hasil penjabaran model')}</dt>
          <dd>${roles.map((x) => `<span class="rolechip">${esc(x)}</span>`).join('')}</dd>` : ''}
      </dl>
    </div>

    ${run.error ? `<div class="err">${L('This run failed:', 'Pencarian ini gagal:')} ${esc(run.error)}</div>` : `
    <div class="ledger">
      <div class="c"><div class="v">${run.people}</div><div class="k">${L('people currently employed', 'orang masih bekerja')}</div></div>
      <div class="c"><div class="v">${run.exa_queries}</div><div class="k">${L('Exa queries', 'kueri Exa')}</div></div>
      <div class="c"><div class="v">${(run.tokens_in || 0) + ' / ' + (run.tokens_out || 0)}</div><div class="k">${L('tokens in / out', 'token masuk / keluar')}</div></div>
      <div class="c"><div class="v">${esc(money(run.cost_usd))}</div><div class="k">${L('inference spent', 'biaya inferensi')}</div></div>
    </div>`}

    ${run.error ? '' : table}
    ${ev}
    ${(!run.error && !captured) ? `<div class="notkept">
      <h2>${L('The answer was not kept', 'Jawabannya tidak disimpan')}</h2>
      <p>${L(`This run finished normally — it found <b>${run.people}</b> currently-employed
        ${run.people === 1 ? 'person' : 'people'}${run.domain ? ` on <code>${esc(run.domain)}</code>` : ''}
        across ${run.exa_queries} Exa ${run.exa_queries === 1 ? 'query' : 'queries'}. Only its metrics
        were stored: run history was added after this search, so the people themselves were not saved.`,
    `Pencarian ini selesai normal — menemukan <b>${run.people}</b> orang yang masih
        bekerja${run.domain ? ` di <code>${esc(run.domain)}</code>` : ''} lewat ${run.exa_queries} kueri Exa.
        Hanya metriknya yang tersimpan: fitur riwayat baru dibangun setelah pencarian ini
        berjalan, jadi daftar orangnya tidak ikut disimpan.`)}</p>
      <p>${L(`Nothing above should be read as a finding about ${esc(run.company || 'this company')} —
        run the search again to get the list back.`,
    `Jangan baca angka di atas sebagai temuan tentang ${esc(run.company || 'perusahaan ini')} —
        jalankan ulang pencariannya untuk mendapatkan daftarnya kembali.`)}</p>
    </div>` : ''}
  </main>
</div>
</body>
</html>`;
}

module.exports = { login, dashboard, history, historyRun, CONF };
