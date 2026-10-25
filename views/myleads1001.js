'use strict';
/**
 * 1001startup.id — the saved leads (/me/leads, /id/me/leads): everyone the
 * lead agent found in Ask 1001 for this reader, newest first, with the work
 * email where one was revealed, and the CSV (/me/leads.csv). Only for the
 * accounts data/leadagent.live lists (lib/leadagent1001.js); a 404 for anyone else.
 * Server-rendered, no script (the site's CSP is script-src 'self').
 * No provider names anywhere (Luca, 18 Oct 2026).
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const { shell } = require('./browse1001');

/**
 *  rows   lead_people rows (lib/leadagent1001.js list())
 *  used   credits spent today, all accounts
 *  cap    the day's credit limit
 *  bal    { left, plan, ends } this month's balance, or left null when unknown
 */
function page({ lang = 'en', rows = [], used = 0, cap = 100, bal = {} }) {
  const L = I18N.mkL(lang);
  const P = lang === 'id' ? '/id' : '';
  const nf = (x) => Math.round(Number(x || 0)).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
  const day = (s) => {
    const d = new Date(String(s || '').replace(' ', 'T') + 'Z');
    return isNaN(d) ? '' : d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  const withEmail = rows.filter((r) => r.email).length;

  const line = (r) => {
    const name = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ');
    const co = r.company_id
      ? `<a href="${P}/company/${encodeURIComponent(r.company_id)}">${esc(r.company || r.company_id)}</a>`
      : esc(r.company || r.domain || '');
    const mail = r.email
      ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.email_status ? `<span class="ld-st">${esc(String(r.email_status).toLowerCase().replace(/_/g, ' '))}</span>` : ''}`
      : `<span class="ld-no">${r.revealed_at ? L('none found', 'tidak ketemu') : L('ask Ask 1001', 'tanya Ask 1001')}</span>`;
    const li = r.linkedin && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(r.linkedin)
      ? `<a href="${esc(r.linkedin)}" rel="noopener noreferrer" target="_blank">LinkedIn</a>` : '';
    return `<tr>
  <td class="ld-n">${esc(name)}${r.location ? `<span>${esc(r.location)}</span>` : ''}</td>
  <td>${esc(r.title || '')}</td>
  <td>${co}</td>
  <td class="ld-m">${mail}</td>
  <td>${li}</td>
  <td class="ld-d">${esc(day(r.revealed_at || r.found_at))}</td>
</tr>`;
  };

  const balTxt = typeof bal.left === 'number'
    ? L(`${nf(bal.left)} credits left this month${bal.ends ? ` (renews ${day(bal.ends + ' 00:00:00')})` : ''}`, `sisa ${nf(bal.left)} kredit bulan ini${bal.ends ? ` (diperbarui ${day(bal.ends + ' 00:00:00')})` : ''}`)
    : '';

  const body = `<style>
.ld{max-width:1180px;margin:0 auto;padding:clamp(32px,6vh,64px) 24px 64px}
.ld .eyebrow .sq{background:#E8734B}
.ld h1{font-size:clamp(30px,4.6vw,48px);line-height:1.05;letter-spacing:-0.035em;font-weight:500;margin:12px 0 10px}
.ld-sub{color:#52525B;font-size:15px;line-height:1.55;max-width:70ch}
.ld-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:22px 0 18px}
.ld-bar .btn{text-decoration:none}
.ld-k{font:400 11px/1.4 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73}
.ld-wrap{overflow-x:auto;border-top:1px solid #000;-webkit-overflow-scrolling:touch}
.ld table{width:100%;min-width:760px;border-collapse:collapse;font-size:14px;line-height:1.4}
.ld th{font:400 10.5px/1.2 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73;text-align:left;padding:12px 12px 10px 0;border-bottom:1px solid #E4E4E7;white-space:nowrap}
.ld td{padding:12px 12px 12px 0;border-bottom:1px solid #EFEFEF;vertical-align:top}
.ld td a{text-decoration:underline;text-decoration-color:#C9C9CF;text-underline-offset:3px}
.ld td a:hover{text-decoration-color:#000}
.ld-n{font-weight:600;min-width:150px}
.ld-n span{display:block;font-weight:400;color:#6B6B73;font-size:12.5px}
.ld-m{white-space:nowrap}
.ld-st{margin-left:8px;font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#2F7A5C}
.ld-no{color:#8A8A92}
.ld-d{white-space:nowrap;color:#6B6B73}
.ld-empty{padding:28px 0;color:#52525B;max-width:60ch}
.ld-pn{margin-top:18px;font-size:12px;line-height:1.5;color:#8A8A92;max-width:80ch}
@media (max-width:640px){
.ld{padding:28px 16px 48px}
.ld-wrap{overflow:visible}
.ld thead{display:none}
.ld table,.ld tbody,.ld tr,.ld td{display:block;width:100%;min-width:0}
.ld tr{padding:14px 0;border-bottom:1px solid #EFEFEF}
.ld td{border:0;padding:2px 0}
.ld td:empty{display:none}
.ld-m{white-space:normal;overflow-wrap:anywhere}
.ld-d{font-size:12px}
}
</style>
<main class="ld">
  <div class="eyebrow"><span class="sq"></span>${L('Lead agent', 'Agen kontak')}</div>
  <h1>${L('Your leads', 'Kontak kamu')}</h1>
  <p class="ld-sub">${esc(L(`Everyone Ask 1001 found for you: ${nf(rows.length)} ${rows.length === 1 ? 'person' : 'people'}, ${nf(withEmail)} with a work email.`,
    `Semua orang yang ditemukan Ask 1001 untukmu: ${nf(rows.length)} orang, ${nf(withEmail)} dengan email kerja.`))}</p>
  <div class="ld-bar">
    <a class="btn" href="${P}/me">${L('Ask 1001', 'Ask 1001')}</a>
    ${rows.length ? `<a class="btn" href="/me/leads.csv" download>${L('Download CSV', 'Unduh CSV')}</a>` : ''}
    <span class="ld-k">${esc(L(`Credits today ${nf(used)} of ${nf(cap)}`, `Kredit hari ini ${nf(used)} dari ${nf(cap)}`))}${balTxt ? ' · ' + esc(balTxt) : ''}</span>
  </div>
  ${rows.length ? `<div class="ld-wrap"><table>
<thead><tr><th>${L('Name', 'Nama')}</th><th>${L('Title', 'Jabatan')}</th><th>${L('Company', 'Perusahaan')}</th><th>${L('Work email', 'Email kerja')}</th><th>LinkedIn</th><th>${L('Date', 'Tanggal')}</th></tr></thead>
<tbody>
${rows.map(line).join('\n')}
</tbody></table></div>`
    : `<p class="ld-empty">${esc(L('No one yet. In Ask 1001, pick People and ask something like “Who runs partnerships at Xendit?”.', 'Belum ada. Di Ask 1001, pilih Orang lalu tanya misalnya “Siapa yang pegang partnership di Xendit?”.'))}</p>`}
  <p class="ld-pn">${esc(L('Finding people is free or nearly free; a work email costs credits once per person (UTC days). A surname with * stays hidden until its email is asked for. Only you see this list.',
    'Mencari orang gratis atau hampir gratis; email kerja memakai kredit sekali per orang (hari UTC). Nama belakang dengan * tetap tersembunyi sampai emailnya diminta. Hanya kamu yang melihat daftar ini.'))}</p>
</main>`;
  return shell({
    title: L('Your leads — 1001startup.id', 'Kontak kamu — 1001startup.id'),
    desc: L('People Ask 1001 found for you.', 'Orang yang ditemukan Ask 1001 untukmu.'),
    path: '/me/leads', lang, body, robots: 'noindex, nofollow', active: '',
  });
}

module.exports = { page };
