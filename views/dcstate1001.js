'use strict';
/* /data-center: the data centres state companies run for themselves (18 Oct 2026).
 *
 * Luca, 18 Oct 2026, after the BUMN research: add the state-run sites to /data-center,
 * marked as in-house. 21 sites in 15 BUMN groups (banks, Pertamina, PLN Icon Plus, KAI,
 * SIG ...), none of them among the 72 projects above. Three also sell space or data-centre
 * services (Icon Plus, PGNCOM, Krakatau's estate), so those carry an "Also rents space" tag. Built by
 * ~/projects/bumn-group-webs/tools/export-site.py into data/dc-state.json; every site links
 * to its company on /bumn and to the source its research lane opened.
 * Shown only while data/dcstate.live exists (DCSTATE_PREVIEW=1 on a test port).
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const { liveFlag } = require('../lib/flaglive');

const live = liveFlag('dcstate.live', 'DCSTATE_PREVIEW');
const FILE = path.join(__dirname, '..', 'data', 'dc-state.json');
let cache = { mtime: 0, data: null };
function load() {
  try {
    const st = fs.statSync(FILE);
    if (st.mtimeMs !== cache.mtime) cache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const TAG = { Running: 'st ok', 'Being built': 'st part', Planned: 'st only' };

const CSS = `
.ss-g{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-top:6px}
.ss-i{background:#fff;padding:12px 14px 13px;display:grid;gap:6px;align-content:start;min-width:0}
.ss-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.ss-h b{font-weight:600;font-size:14px;line-height:1.3}
.ss-t{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}
.ss-i p{color:#3F3F46;font-size:13px;line-height:1.45}
.ss-f{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin-top:2px}
.ss-f .co{font:400 10.5px/1.2 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#000;text-decoration:none;border-bottom:1px solid #000}
.ss-f .sr{color:#6B6B73;font-size:11.5px;text-decoration:none;border-bottom:1px solid #D9D9D9}
@media(max-width:860px){.ss-g{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.ss-g{grid-template-columns:minmax(0,1fr)}}
`;

function stateSites(n = 72) {
  if (!live()) return '';
  const D = load();
  if (!D || !(D.sites || []).length) return '';
  const groups = new Set(D.sites.map((s) => s.group)).size;
  const rent = D.sites.filter((s) => s.rents).length;
  const items = D.sites.map((s) => `<li class="ss-i"><div class="ss-h"><b>${esc(s.name)}</b><span class="ss-t"><span class="${TAG[s.status] || 'tg'}">${esc(s.status)}</span>${s.rents ? '<span class="tg">Also rents space</span>' : ''}</span></div>`
    + `<p>${esc(s.what)}</p><div class="ss-f"><a class="co" href="/bumn#${esc(s.slug)}">${esc(s.group)}</a>`
    + `<a class="sr" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(host(s.u))}</a></div></li>`).join('');
  return `<style>${CSS}</style>
<section class="wrap" id="state-sites">
  <div class="eyebrow"><span class="sq"></span>STATE-RUN DATA CENTRES · IN-HOUSE</div>
  <p class="lede">${D.sites.length} data centres and recovery sites that ${groups} state companies run themselves: banks, Pertamina, PLN Icon Plus, KAI and others. Most serve the company's own systems; ${rent} also rent space to others. They sit apart from the ${n} projects below. Each one links to its company on /bumn and to its source.</p>
  <ul class="ss-g">${items}</ul>
</section>
`;
}

module.exports = { stateSites };
