'use strict';
const { esc } = require('../lib/util');
const { page } = require('./html');
const { DISTRICTS, ACCENTS } = require('../lib/layout');
const cityqr = require('../lib/cityqr');

const SITE = 'https://pasar.vantis.sh';

const ICONS = {
  world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l4-3v16M13 21V5l6 3v13"/><path d="M9 9h.01M9 13h.01M16 11h.01M16 15h.01"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M20 20h1"/></svg>',
  keys: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 7l7-4 7 4M7 21V10M17 21V10"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z"/><rect x="9.5" y="7.5" width="5" height="5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="wave" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/><path class="slash" d="M4 4l16 16" style="display:none"/></svg>',
  aerial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 3l-3 3M12 3l3 3"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M9 15h.01M15 15h.01M9 18h6"/></svg>',
};

/* ── landing ─────────────────────────────────────────────────────── */
function home({ stats, counts, authed }) {
  const heroMatrix = cityqr.matrix(SITE, 'Q');
  const sampleSvg = cityqr.renderLeaf(`${SITE}/q/you`, { moduleSize: 12 });
  const chipSvg = cityqr.renderLeaf(`${SITE}/q/your-shop`, { moduleSize: 8 });
  return homeBlocks({ stats, counts, authed, heroMatrix, sampleSvg, chipSvg });
}

function homeBlocks({ stats, counts, authed, heroMatrix, sampleSvg, chipSvg }) {
  const body = `
<section class="hero">
  <div class="shell hero-grid">
    <h1>PASAR turns a link in bio into a storefront in a living city</h1>
    <div class="hero-side">
      <p>Every profile is a building on a themed street — with your links, live scan counts, and a QR
      code that grows into a living tree.</p>
      <div class="hero-btns">
        <a class="btn ghost" href="/world">Explore the world</a>
        <a class="btn primary" href="/claim">Claim your plot</a>
      </div>
    </div>
  </div>
</section>

<div class="stage" id="hero-stage">
  <div class="stage-inner">
    <canvas id="hero-qr" aria-label="Interactive 3D QR city"></canvas>
    <div class="stage-tools">
      <button class="icon-round" id="hero-sound" type="button" aria-label="Toggle ambient sound" title="Ambient sound">${ICONS.sound}</button>
      <button class="btn ghost sm" id="hero-aerial" type="button">Scan view</button>
    </div>
  </div>
  <div class="stage-cap">This tree is a working QR code — every link grows its own. Drag to orbit, press scan view</div>
  <audio id="hero-amb" loop preload="none" src="/assets/audio/ambience-morning.mp3"></audio>
</div>

<div class="shell">
  <div class="stats">
    <div class="rv"><b>10</b><span>Districts to build on</span></div>
    <div class="rv d1"><b>60s</b><span>From claim to live</span></div>
    <div class="rv d2"><b>3</b><span>Seasons of light &amp; sound</span></div>
  </div>
</div>

<section class="sect">
  <div class="shell">
    <span class="eyebrow">Why a city</span>
    <h2>A lone link is a dead end. A street gets wandered.</h2>
    <div class="feature-grid">
      <div class="feature rv"><div class="glyph">${ICONS.world}</div>
        <h3>A shared world</h3>
        <p>Your building goes up on a real street the moment you claim, with your name on it. Visitors
        stroll past your neighbors to reach you.</p></div>
      <div class="feature rv d1"><div class="glyph">${ICONS.qr}</div>
        <h3>The City QR</h3>
        <p>Your QR code grown as a one-of-a-kind tree. It scans like any QR code from a phone camera, and looks
        like nowhere else in print.</p></div>
      <div class="feature rv d2"><div class="glyph">${ICONS.pin}</div>
        <h3>Themed districts</h3>
        <p>Inference Row for AI providers, Craft Lane for makers, Food Quarter for kitchens — ten streets
        that group merchants the way a real market does.</p></div>
      <div class="feature rv"><div class="glyph">${ICONS.chart}</div>
        <h3>Live counts</h3>
        <p>Profile views, QR scans, and per-link clicks — measured first-party on our own
        infrastructure, shown on your dashboard.</p></div>
      <div class="feature rv d1"><div class="glyph">${ICONS.sun}</div>
        <h3>Seasons &amp; sound</h3>
        <p>Morning, dusk, and rain change the light, the shadows, and the ambience — in the live tree
        and in the flat leaf mosaic alike.</p></div>
      <div class="feature rv d2"><div class="glyph">${ICONS.keys}</div>
        <h3>Yours to keep</h3>
        <p>Export everything as JSON anytime. Delete your plot and it is gone. No ads, no lock-in, and a
        nightly backup of the whole city.</p></div>
    </div>
  </div>
</section>

<section class="sect">
  <div class="shell">
    <span class="eyebrow">The City QR</span>
    <h2>The QR is the tree, seen from above.</h2>
    <p class="lede">Flat, it is a leaf mosaic — the helicopter view of your tree. Live, you can orbit it
    through the seasons. Both scan from any phone camera.</p>
    <div class="btns">
      <a class="btn ghost" href="/qr">Try the QR maker</a>
      <a class="btn primary" href="/claim">Get yours free</a>
    </div>
    <div class="panel-row">
      <div class="panel rv"><span class="p-label">Flat — the tree from above</span>${sampleSvg}</div>
      <div class="panel rv d1"><span class="p-label">Live — dusk season</span><canvas id="qr-panel-3d" aria-label="3D QR diorama, dusk season"></canvas></div>
    </div>
  </div>
</section>

<section class="sect">
  <div class="shell">
    <span class="eyebrow">The world</span>
    <h2>Works in any bio. Gets you found in a city.</h2>
    <p class="lede">This is what a street looks like as merchants move in. Wander the live world, or open
    the next stall on it.</p>
    <div class="btns">
      <a class="btn ghost" href="/directory">Browse the directory</a>
      <a class="btn primary" href="/world">Explore the world</a>
    </div>
    <div class="demo-window rv">
      <div class="demo-chrome"><i></i><i></i><i></i><span>pasar.vantis.sh/world</span></div>
      <canvas id="street-demo" aria-label="Illustration of a market street"></canvas>
    </div>
  </div>
</section>

<section class="sect">
  <div class="shell">
    <span class="eyebrow">Open your stall</span>
    <h2>Live before your kopi gets cold.</h2>
    <div class="btns">
      <a class="btn ghost" href="/qr">Make a QR first</a>
      <a class="btn primary big" href="/claim">Claim your plot</a>
    </div>
  </div>
</section>`;
  return page({
    title: 'A market you can walk through', path: '/', authed, body,
    banner: 'Early access — the city just opened. <a href="/claim" style="color:inherit">Claim your street name</a>',
    data: { id: 'hero-data', json: JSON.stringify({ matrix: heroMatrix }) },
    scripts: [{ src: '/js/home.js', module: true }],
  });
}

/* ── world ───────────────────────────────────────────────────────── */
function world({ authed }) {
  const body = `
<div class="world-wrap" id="world-wrap">
  <canvas id="world-canvas" aria-label="Explorable 3D market city"></canvas>
  <div class="world-bar">
    <div class="world-search">
      <input id="world-q" type="text" placeholder="Search merchants…" autocomplete="off" aria-label="Search merchants">
      <div class="world-hits" id="world-hits"></div>
    </div>
    <div class="world-chips" id="world-chips"></div>
    <a class="btn primary sm world-cta" href="/claim">Claim your plot</a>
  </div>
  <div class="world-hint" id="world-hint">Drag to look around · scroll to zoom · right-drag or two-finger drag to pan</div>
  <div class="world-tip" id="world-tip"></div>
  <div class="world-panel" id="world-panel"></div>
  <div class="world-fallback" id="world-fallback">
    <h1 style="font-size:24px;margin-bottom:8px">The world needs WebGL</h1>
    <p style="color:var(--body-c)">Your browser couldn't start the 3D view. You can still browse every street in the
    <a href="/directory">directory</a>.</p>
  </div>
</div>`;
  return page({ title: 'World', path: '/world', authed, wide: true, body, scripts: [{ src: '/js/world.js', module: true }] });
}

/* ── SCBD drive prototype ────────────────────────────────────────── */
function scbd({ authed }) {
  const body = `
<div class="world-wrap" id="drive-wrap">
  <canvas id="drive-canvas" aria-label="Drivable 3D map of SCBD, Jakarta"></canvas>
  <div class="drive-title"><span class="sq"></span>SCBD — JAKARTA · DRIVE PROTOTYPE<span class="sq"></span></div>
  <div class="view-toggle">
    <a class="chip" href="/jakarta">Jakarta</a>
    <a class="chip" href="/jakarta?area=scbd">SCBD</a>
    <a class="chip on" href="/scbd">Drive 3D</a>
  </div>
  <div class="drive-hud">
    <span id="hud-road">SCBD · JAKARTA</span>
    <span id="hud-speed">0 KM/H</span>
  </div>
  <div class="world-hint">Arrows / WASD to drive · R resets · click a tower</div>
  <div class="world-panel" id="drive-panel"></div>
  <div class="touch-pad touch-left"><button class="tc" id="tc-left" aria-label="Steer left">◀</button><button class="tc" id="tc-right" aria-label="Steer right">▶</button></div>
  <div class="touch-pad touch-right"><button class="tc" id="tc-stop" aria-label="Brake">▼</button><button class="tc" id="tc-go" aria-label="Accelerate">▲</button></div>
  <div class="world-fallback" id="drive-fallback">
    <h1 style="font-size:24px;margin-bottom:8px">The drive needs WebGL</h1>
    <p style="color:var(--gray)">Your browser couldn't start the 3D view.</p>
  </div>
</div>`;
  return page({
    title: 'SCBD Drive', path: '/scbd', authed, wide: true, body,
    desc: 'Drive the real SCBD, Jakarta — real streets and towers from OpenStreetMap, in 3D.',
    scripts: [{ src: '/js/scbd.js', module: true }],
  });
}

function scbdMap({ authed }) {
  const body = `
<div class="world-wrap" id="map-wrap">
  <div id="map-host" aria-label="2D startup map of SCBD, Jakarta"></div>
  <div class="drive-title"><span class="sq"></span>SCBD — STARTUP MAP<span class="sq"></span></div>
  <div class="view-toggle">
    <a class="chip" href="/jakarta">Jakarta</a>
    <a class="chip on" href="/scbd/map">2D map</a>
    <a class="chip" href="/scbd">Drive 3D</a>
  </div>
  <div class="world-hint">Drag to pan · scroll to zoom · click a building</div>
  <div class="world-panel map-panel" id="map-panel"></div>
</div>`;
  return page({
    title: 'SCBD Startup Map', path: '/scbd/map', authed, wide: true, body,
    desc: 'The startups of SCBD, Jakarta, on a hex map of the real district.',
    scripts: [{ src: '/js/scbdmap.js' }],
  });
}

function jakarta({ authed }) {
  const body = `
<div class="world-wrap" id="jkt-wrap">
  <canvas id="jkt-canvas" aria-label="Isometric startup map of the whole of Jakarta"></canvas>
  <div class="drive-title"><span class="sq"></span>JAKARTA — STARTUP CITY<span class="sq"></span></div>
  <div class="view-toggle">
    <a class="chip on" href="/jakarta">Jakarta</a>
    <a class="chip" href="/jakarta?area=scbd">SCBD</a>
    <a class="chip" href="/jakarta?area=southquarter">South Quarter</a>
    <a class="chip" href="/jakarta?area=gambir">Gambir</a>
    <a class="chip" href="/blocks">Blocks</a>
    <a class="chip" href="/scbd">Drive 3D</a>
  </div>
  <div class="jkt-legend" id="jkt-legend"></div>
  <div class="jkt-ctl">
    <button id="jz-in" aria-label="Zoom in">+</button>
    <button id="jz-out" aria-label="Zoom out">−</button>
    <button id="jz-home" aria-label="Find VANTIS" title="Find VANTIS">◎</button>
  </div>
  <div class="world-tip" id="jkt-tip"></div>
  <div class="world-hint">Drag to pan · scroll to zoom · click a building · gold areas open into streets</div>
  <div class="world-panel map-panel" id="map-panel"></div>
  <!--PX-BADGE-MAP-->
</div>`;
  return page({
    title: 'Jakarta Startup City', path: '/jakarta', authed, wide: true, body,
    desc: 'The whole of Jakarta as an isometric startup city — real kota and kecamatan boundaries, one building per company.',
    scripts: [{ src: '/js/jakarta.js' }],
  });
}

function blocks({ authed }) {
  const body = `
<div class="world-wrap" id="bl-wrap">
  <canvas id="bl-canvas" aria-label="Startup blocks — one plot per company"></canvas>
  <div class="drive-title"><span class="sq"></span>PASAR — STARTUP BLOCKS<span class="sq"></span></div>
  <div class="view-toggle">
    <a class="chip on" href="/blocks">Blocks</a>
    <a class="chip" href="/jakarta">Jakarta</a>
    <a class="chip" href="/scbd">Drive 3D</a>
  </div>
  <div class="jkt-legend" id="bl-legend"></div>
  <div class="jkt-ctl">
    <button id="bz-in" aria-label="Zoom in">+</button>
    <button id="bz-out" aria-label="Zoom out">−</button>
  </div>
  <div class="world-tip" id="jkt-tip"></div>
  <div class="world-hint">Drag to pan · scroll to zoom · click a block</div>
  <div class="world-panel map-panel" id="map-panel"></div>
</div>`;
  return page({
    title: 'Startup Blocks', path: '/blocks', authed, wide: true, body,
    desc: 'One block per company — collectible buildings generated from each brand, plot by plot.',
    scripts: [{ src: '/js/blocks.js' }],
  });
}

/* ── directory ───────────────────────────────────────────────────── */
function directory({ districts, authed }) {
  const body = `
<div class="shell" style="padding-top:52px">
  <span class="eyebrow">Every street, as a list</span>
  <h1 style="font-size:32px;margin-top:10px">Directory</h1>
  <p style="color:var(--body-c);margin:10px 0 34px">Prefer the scenic route? <a href="/world" style="color:var(--accent-deep);font-weight:650">Walk the world</a>.</p>
  ${districts.map((d) => `
  <section class="dir-district">
    <h2>${esc(d.name)} <span>${esc(d.desc)}</span></h2>
    <div class="dir-grid">
      ${d.merchants.length ? d.merchants.map((m) => `
        <a class="dir-card" href="/@${esc(m.handle)}">
          <b><span class="dot" style="background:${esc(m.accentColor)}"></span>${esc(m.name)}</b>
          <span>@${esc(m.handle)}</span>
        </a>`).join('') : `<div class="dir-empty">No merchants yet — this street is waiting for its first stall.</div>`}
    </div>
  </section>`).join('')}
</div>`;
  return page({ title: 'Directory', path: '/directory', authed, body });
}

/* ── profile ─────────────────────────────────────────────────────── */
function profile({ m, links, districtName }) {
  const accent = ACCENTS[(m.accent | 0) % ACCENTS.length];
  const initial = ([...(m.name || m.handle).trim()][0] || '?').toUpperCase();
  const data = { accent, handle: m.handle, name: m.name,
    links: links.map((l) => ({ id: l.id, label: l.label, url: l.url })) };
  const tags = (m.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const body = `
<div class="pp" style="--acc:${accent}">
  <canvas class="pp-rain" id="pp-rain" aria-hidden="true"></canvas>
  <div class="pp-inner">

    <div class="pp-card">
      <div class="pp-avatar" style="background:${accent}">${esc(initial)}</div>
      <div class="pp-id">
        <h1>${esc(m.name)}</h1>
        ${m.bio ? `<p class="pp-bio">${esc(m.bio)}</p>` : ''}
        ${m.location ? `<div class="pp-loc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>${esc(m.location)}</div>` : ''}
      </div>
      ${tags.length ? `<div class="pp-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    </div>

    <div class="pp-stage" id="pp-stage">
      <div class="pp-dial" id="pp-dial">
        <div class="pp-ring" aria-hidden="true"></div>
        <svg class="pp-wedge" id="pp-wedge" viewBox="-100 -100 200 200" aria-hidden="true">
          <path d="M 0 0 L -30 -95 A 100 100 0 0 1 30 -95 Z" fill="${accent}"/>
        </svg>
        <div class="pp-icons" id="pp-icons"></div>
        <div class="pp-qr">
          <img src="/@${esc(m.handle)}/qr.svg" alt="QR code for this page" width="240" height="240">
        </div>
      </div>
      <div class="pp-list" id="pp-list" hidden>
        ${links.map((l) => `<a class="pp-row" href="/l/${l.id}" rel="nofollow noopener"><span class="pp-row-ico" data-url="${esc(l.url)}" data-label="${esc(l.label)}"></span><b>${esc(l.label)}</b><i>↗</i></a>`).join('')}
      </div>
    </div>

    <a class="pp-open" id="pp-open" href="#" rel="noopener"></a>

    <div class="pp-bar" role="tablist">
      <button class="pp-mode on" id="mode-qr" type="button" role="tab">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9-2h3v3h-3v-3zm5 0h2v2h-2v-2zm-5 5h3v2h-3v-2zm5 0h2v2h-2v-2z"/></svg>QR</button>
      <button class="pp-mode" id="mode-link" type="button" role="tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>Links</button>
      <button class="pp-mode" id="mode-share" type="button" data-url="${SITE}/@${esc(m.handle)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>Share</button>
    </div>

    <div class="pp-foot">
      <a href="/"><img src="/assets/mark.svg" alt="" width="16" height="16"><b>PASAR</b></a>
      <span>·</span>
      <a href="/world?focus=${esc(m.handle)}">Find me in the world</a>
    </div>
  </div>
</div>`;
  return page({
    title: `${m.name} (@${m.handle})`, path: `/@${m.handle}`, bare: true,
    desc: m.bio || `${m.name} on PASAR — links, storefront and City QR.`,
    og: { title: `${m.name} — PASAR`, desc: m.bio || `Visit ${m.name}'s plot in the market.` },
    body, data: { id: 'pp-data', json: JSON.stringify(data) },
    scripts: [{ src: '/js/profile.js' }],
  });
}

/* ── qr tool ─────────────────────────────────────────────────────── */
function qrTool({ authed }) {
  const dots = ['#C96F2E', '#3F7D4E', '#B08A2E', '#4E7A96', '#8A5A83'];
  const body = `
<div class="tool">
  <span class="eyebrow">Free tool</span>
  <h1 style="margin-top:10px">City QR maker</h1>
  <p class="sub" style="color:var(--body-c);margin-top:10px">Turn any link into a QR code drawn as a city block —
  with seasons, sound and colors. No account needed. Merchants get one automatically for their profile.</p>
  <div class="tool-grid">
    <div class="card" style="margin-top:0">
      <label for="qr-data" style="margin-top:0">Link or text</label>
      <input id="qr-data" type="url" maxlength="512" value="${SITE}">
      <label for="qr-ecl">Error correction</label>
      <select id="qr-ecl">
        <option value="M">M — smaller code</option>
        <option value="Q" selected>Q — balanced (recommended)</option>
        <option value="H">H — toughest</option>
      </select>
      <label>Style</label>
      <div class="theme-row" id="qr-styles">
        <button class="chip on" data-style="leaf" type="button">Tree mosaic</button>
        <button class="chip" data-style="ink" type="button">Ink</button>
      </div>
      <label>Season</label>
      <div class="theme-row" id="qr-themes">
        <button class="chip on" data-theme="morning" type="button">Morning</button>
        <button class="chip" data-theme="dusk" type="button">Dusk</button>
        <button class="chip" data-theme="rain" type="button">Rain</button>
        <button class="icon-round" id="qr-sound" type="button" aria-label="Toggle ambient sound" style="margin-left:4px">${ICONS.sound}</button>
      </div>
      <label>Accent color</label>
      <div class="color-dots" id="qr-dots">
        ${dots.map((c, i) => `<button class="color-dot${i === 0 ? ' on' : ''}" data-color="${c}" style="background:${c}" type="button" aria-label="Accent ${i + 1}"></button>`).join('')}
      </div>
      <div class="dl-row">
        <button class="btn primary sm" id="qr-dl-svg" type="button">Download SVG</button>
        <button class="btn ghost sm" id="qr-dl-png" type="button">Download PNG</button>
      </div>
      <p class="hint" style="margin-top:14px">The tree mosaic is the tree seen from above — scan-verified. Ink is the
      max-contrast fallback for rough print surfaces. Test prints with a phone camera before going big.</p>
    </div>
    <div class="tool-preview">
      <div class="tool-tabs">
        <button class="chip" id="tab-flat" type="button">Flat</button>
        <button class="chip on" id="tab-3d" type="button">3D</button>
      </div>
      <img class="flat" id="qr-flat" alt="City QR preview" style="display:none">
      <canvas id="qr-3d" aria-label="3D QR preview"></canvas>
      <audio id="qr-amb" loop preload="none" src="/assets/audio/ambience-morning.mp3"></audio>
    </div>
  </div>
</div>`;
  return page({ title: 'City QR maker', path: '/qr', authed, body, scripts: [{ src: '/js/qrtool.js', module: true }] });
}

/* ── claim / login ───────────────────────────────────────────────── */
function claim({ authed }) {
  const body = `
<div class="narrow">
  <span class="eyebrow">Sixty seconds to live</span>
  <h1 style="margin-top:10px">Claim your plot</h1>
  <p class="sub">A handle, a street, your links. Your building goes up immediately.</p>
  <form id="claim-form" novalidate>
    <label for="c-handle">Handle</label>
    <input id="c-handle" type="text" maxlength="30" autocomplete="off" spellcheck="false" placeholder="your-shop">
    <p class="hint">3–30 characters: lowercase letters, numbers, hyphens. This becomes pasar.vantis.sh/@<b id="c-handle-echo">your-shop</b></p>
    <p class="field-err" id="c-handle-err"></p>
    <label for="c-name">Display name</label>
    <input id="c-name" type="text" maxlength="60" placeholder="Your Shop">
    <label for="c-category">District</label>
    <select id="c-category">
      ${DISTRICTS.map((d) => `<option value="${d.key}">${esc(d.name)} — ${esc(d.desc)}</option>`).join('')}
    </select>
    <label for="c-bio">Short bio <span style="color:var(--mute);font-weight:400">(optional)</span></label>
    <textarea id="c-bio" maxlength="280" placeholder="What do you sell, make, or run?"></textarea>
    <label for="c-link-label">First link <span style="color:var(--mute);font-weight:400">(optional — add more later)</span></label>
    <div style="display:flex;gap:8px">
      <input id="c-link-label" type="text" maxlength="40" placeholder="Label (e.g. Shop)" style="flex:0 0 38%">
      <input id="c-link-url" type="url" maxlength="300" placeholder="https://…">
    </div>
    <label for="c-pass">Password</label>
    <input id="c-pass" type="password" minlength="8" maxlength="128" autocomplete="new-password">
    <p class="hint">At least 8 characters. There's no email on file, so a lost password can't be reset — keep it safe.</p>
    <div class="form-msg" id="c-msg"></div>
    <button class="btn primary" type="submit" style="margin-top:22px;width:100%">Claim plot</button>
    <p class="hint" style="margin-top:14px">Keep it legal and honest — plots used for scams or illegal goods are removed.
    Already have one? <a href="/login" style="color:var(--accent-deep);font-weight:650">Log in</a>.</p>
  </form>
</div>`;
  return page({ title: 'Claim your plot', path: '/claim', authed, body, scripts: [{ src: '/js/claim.js' }] });
}

function login({ authed }) {
  const body = `
<div class="narrow">
  <h1>Log in</h1>
  <p class="sub">Welcome back to the market.</p>
  <form id="login-form" novalidate>
    <label for="l-handle">Handle</label>
    <input id="l-handle" type="text" maxlength="30" autocomplete="username" spellcheck="false">
    <label for="l-pass">Password</label>
    <input id="l-pass" type="password" maxlength="128" autocomplete="current-password">
    <div class="form-msg" id="l-msg"></div>
    <button class="btn primary" type="submit" style="margin-top:22px;width:100%">Log in</button>
    <p class="hint" style="margin-top:14px">No plot yet? <a href="/claim" style="color:var(--accent-deep);font-weight:650">Claim one</a>.</p>
  </form>
</div>`;
  return page({ title: 'Log in', path: '/login', authed, body, scripts: [{ src: '/js/login.js' }] });
}

/* ── dashboard ───────────────────────────────────────────────────── */
function dashboard() {
  const body = `
<div class="dash" id="dash" data-accents='${JSON.stringify(ACCENTS)}'>
  <h1>Your plot</h1>
  <div class="dash-stats" id="dash-stats"></div>
  <div class="card">
    <h2>Profile</h2>
    <div class="sub">Shown on your page and on your building in the world.</div>
    <form id="p-form" novalidate>
      <label for="p-name">Display name</label>
      <input id="p-name" type="text" maxlength="60">
      <label for="p-category">District</label>
      <select id="p-category">${DISTRICTS.map((d) => `<option value="${d.key}">${esc(d.name)}</option>`).join('')}</select>
      <p class="hint">Moving district moves your building to that street.</p>
      <label for="p-bio">Short bio</label>
      <textarea id="p-bio" maxlength="280"></textarea>
      <label for="p-location">Location <span style="color:var(--mute);font-weight:400">(optional)</span></label>
      <input id="p-location" type="text" maxlength="60" placeholder="Jakarta, Indonesia">
      <label for="p-tags">Tags <span style="color:var(--mute);font-weight:400">(up to 3, comma-separated)</span></label>
      <input id="p-tags" type="text" maxlength="70" placeholder="founder, builder, ai">
      <label>Accent</label>
      <div class="swatches" id="p-swatches"></div>
      <div class="form-msg" id="p-msg"></div>
      <button class="btn primary sm" type="submit" style="margin-top:18px">Save profile</button>
    </form>
  </div>
  <div class="card">
    <h2>Links</h2>
    <div class="sub">Up to 20. Reorder with the arrows; clicks are counted.</div>
    <div id="links-list"></div>
    <form id="link-add" novalidate style="display:flex;gap:8px;margin-top:14px;align-items:flex-start">
      <input id="a-label" type="text" maxlength="40" placeholder="Label" style="flex:0 0 32%">
      <input id="a-url" type="url" maxlength="300" placeholder="https://…">
      <button class="btn ghost sm" type="submit" style="white-space:nowrap">Add link</button>
    </form>
    <div class="form-msg" id="links-msg"></div>
  </div>
  <div class="card">
    <h2>Your City QR</h2>
    <div class="sub">Scans straight to your profile. Print it anywhere.</div>
    <img class="qr-preview" id="my-qr" alt="Your City QR">
    <div class="dl-row">
      <a class="btn ghost sm" id="qr-svg" download>Download SVG</a>
      <button class="btn ghost sm" id="qr-png" type="button">Download PNG</button>
      <a class="btn ghost sm" id="view-profile" target="_blank" rel="noopener">View my page</a>
      <a class="btn ghost sm" id="view-world">See my building</a>
    </div>
  </div>
  <div class="card">
    <h2>Account</h2>
    <form id="pw-form" novalidate>
      <label for="w-cur">Current password</label>
      <input id="w-cur" type="password" maxlength="128" autocomplete="current-password">
      <label for="w-new">New password</label>
      <input id="w-new" type="password" minlength="8" maxlength="128" autocomplete="new-password">
      <div class="form-msg" id="w-msg"></div>
      <button class="btn ghost sm" type="submit" style="margin-top:14px">Change password</button>
    </form>
    <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap">
      <a class="btn ghost sm" href="/api/me/export">Export my data (JSON)</a>
      <button class="btn ghost sm" id="logout" type="button">Log out</button>
      <button class="btn danger sm" id="delete-me" type="button">Delete my plot</button>
    </div>
  </div>
</div>`;
  return page({ title: 'Dashboard', path: '/dashboard', authed: true, body, scripts: [{ src: '/js/dashboard.js' }] });
}

/* ── admin ───────────────────────────────────────────────────────── */
function admin() {
  const body = `
<div class="dash" id="admin">
  <h1>PASAR admin</h1>
  <div class="card" id="adm-login-card">
    <h2>Sign in</h2>
    <form id="adm-form" novalidate>
      <label for="adm-key">Admin key</label>
      <input id="adm-key" type="password" maxlength="128" autocomplete="off">
      <div class="form-msg" id="adm-msg"></div>
      <button class="btn primary sm" type="submit" style="margin-top:14px">Enter</button>
    </form>
  </div>
  <div id="adm-app" style="display:none">
    <div class="dash-stats" id="adm-stats"></div>
    <div class="card">
      <h2>Merchants</h2>
      <input id="adm-q" type="text" placeholder="Filter by handle, name, district…" style="margin-top:10px">
      <div style="overflow-x:auto"><table class="admin-table" id="adm-table"></table></div>
    </div>
  </div>
</div>`;
  return page({ title: 'Admin', path: '/admin', body, bare: false, scripts: [{ src: '/js/admin.js' }] });
}

/* ── errors ──────────────────────────────────────────────────────── */
function notFound() {
  const body = `
<div class="narrow" style="text-align:center;padding-top:100px">
  <h1 style="font-size:72px;font-family:var(--display);font-weight:800">404</h1>
  <p class="sub" style="margin-top:12px">This street doesn't exist — yet.</p>
  <div style="display:flex;gap:10px;justify-content:center;margin-top:26px">
    <a class="btn ghost" href="/">Back to the gate</a>
    <a class="btn primary" href="/claim">Build here</a>
  </div>
</div>`;
  return page({ title: 'Not found', path: '', body });
}

/* ── /census — the regulator view: Jakarta's startup economy as a monitoring
   surface. Server-rendered per request from public/data/census.json (written
   by scripts/build-census.js; refreshed by the data-cleaning loop), so data
   edits go live without a restart. All derived figures are labeled estimates. */
function census({ authed, data }) {
  const fmt = (n, d = 0) => (n === null || n === undefined) ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const css = `
<style>
.cen-wrap{max-width:1180px;margin:0 auto;padding:34px 20px 70px}
.cen-eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A6D1C;display:flex;align-items:center;gap:8px}
.cen-eyebrow .sq{width:6px;height:6px;background:#F3C64B;display:inline-block}
.cen-wrap h1{font-size:clamp(30px,4.6vw,54px);letter-spacing:-0.03em;margin:14px 0 10px}
.cen-sub{max-width:74ch;color:#4a443c;font-size:15.5px;line-height:1.55}
.cen-note{font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8a8272;margin-top:14px}
.cen-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin:28px 0 8px}
.cen-stats .c{background:#fff;padding:18px 16px}
.cen-stats .v{font-size:clamp(22px,2.6vw,34px);letter-spacing:-0.02em}
.cen-stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8a8272;margin-top:6px}
.cen-tablewrap{overflow-x:auto;border:1px solid #E7E7E7;margin-top:26px}
table.cen{border-collapse:collapse;width:100%;min-width:920px;font-size:13.5px}
table.cen th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8a8272;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap}
table.cen td{padding:9px 12px;border-bottom:1px solid #F0F0EC;vertical-align:top}
table.cen td.n,table.cen th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
table.cen td.rk{font-family:'IBM Plex Mono',monospace;color:#8a8272;font-size:12px}
table.cen a{color:inherit;text-decoration:none;border-bottom:1px solid #d8d2c6}
table.cen .sec{color:#6d675d;font-size:12.5px}
.cen-h2{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;margin:44px 0 12px;display:flex;gap:8px;align-items:center}
.cen-h2 .sq{width:6px;height:6px;background:#201A14;display:inline-block}
.cen-agg{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.cen-agg .c{background:#fff;padding:14px 16px}
.cen-agg .t{font-size:14px;font-weight:500}
.cen-agg .d{font:400 11px/1.7 'IBM Plex Mono',monospace;color:#8a8272;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}
.cen-method{border:1px solid #E7E7E7;padding:20px 22px;margin-top:14px;max-width:100%}
.cen-method p{font-size:14px;line-height:1.6;color:#4a443c;max-width:86ch}
.cen-method ul{margin:10px 0 0 18px;font-size:13px;line-height:1.7;color:#6d675d}
.cen-src{font:400 11px/1.9 'IBM Plex Mono',monospace;word-break:break-all;color:#8a8272;margin-top:12px}
.cen-empty{border:1px solid #E7E7E7;padding:38px 26px;margin-top:30px;font-size:15px;color:#4a443c}
.cen-chips{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap}
</style>`;
  let core = '';
  if (!data || !data.companies || !data.companies.length) {
    core = `<div class="cen-empty">The census is being assembled — sector sweeps and verification are still running. Nothing worth showing yet.</div>`;
  } else {
    const T = data.totals || {};
    const rows = data.companies.map((c) => `
      <tr>
        <td class="rk">${c.rank}</td>
        <td>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</td>
        <td class="sec">${esc(c.sector_label || c.sector || '')}</td>
        <td class="sec">${esc(c.kota || '—')}</td>
        <td class="n">${fmt(c.funding_total_usd_m)}</td>
        <td class="n">${fmt(c.valuation_usd_m)}</td>
        <td class="n">${fmt(c.employees_est)}</td>
        <td class="n">${fmt(c.est_gva_idr_bn)}</td>
      </tr>`).join('');
    const agg = (list) => list.map((a) => `
      <div class="c"><div class="t">${esc(a.name)}</div>
      <div class="d">${a.count} companies · ${fmt(a.jobs)} jobs est · IDR ${fmt(a.gva_idr_bn)} bn/yr est</div></div>`).join('');
    const m = data.method || {};
    core = `
  <div class="cen-stats">
    <div class="c"><div class="v">${fmt(T.companies)}</div><div class="k">companies counted</div></div>
    <div class="c"><div class="v">US$ ${fmt(T.funding_usd_b, 1)} B</div><div class="k">disclosed funding, cumulative</div></div>
    <div class="c"><div class="v">${fmt(T.jobs)}</div><div class="k">jobs — estimate</div></div>
    <div class="c"><div class="v">IDR ${fmt(T.gva_idr_t, 1)} T</div><div class="k">direct GVA / yr — estimate</div></div>
    <div class="c"><div class="v">IDR ${fmt(T.gva_incl_indirect_idr_t, 1)} T</div><div class="k">incl. indirect ×${m.indirect_multiplier || '—'} — estimate</div></div>
  </div>
  <div class="cen-note">ranked by latest known valuation, then disclosed funding · sources: public reporting · updated ${esc((data.generated || '').slice(0, 10))}</div>
  <div class="cen-tablewrap"><table class="cen">
    <thead><tr><th>#</th><th>Company</th><th>Sector</th><th>Kota</th><th class="n">Funding US$M</th><th class="n">Valuation US$M</th><th class="n">Jobs est</th><th class="n">GVA est IDR bn/yr</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="cen-note">${data.low_confidence || 0} records carry confidence &lt; 0.5 and are queued for the next verification pass${data.nearby && data.nearby.length ? ` · ${data.nearby.length} companies HQ'd just outside DKI (BSD/Tangerang belt) tracked separately` : ''}.</div>
  <div class="cen-h2"><span class="sq"></span>BY SECTOR</div>
  <div class="cen-agg">${agg(data.by_sector || [])}</div>
  <div class="cen-h2"><span class="sq"></span>BY KOTA</div>
  <div class="cen-agg">${agg(data.by_kota || [])}</div>
  <div class="cen-h2"><span class="sq"></span>HOW THE ESTIMATES ARE MADE</div>
  <div class="cen-method">
    <p>${esc(m.method_summary || '')}</p>
    ${m.caveats && m.caveats.length ? `<ul>${m.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    <div class="cen-src">${(m.sources || []).slice(0, 8).map(esc).join('<br>')}</div>
  </div>`;
  }
  const body = `${css}
<div class="cen-wrap">
  <div class="cen-eyebrow"><span class="sq"></span>REGULATOR VIEW — WORKING DRAFT<span class="sq"></span></div>
  <h1>Jakarta Startup Census</h1>
  <p class="cen-sub">The startup economy of Greater Jakarta — DKI plus the Bodetabek ring — as one monitoring surface: who operates here, where they sit,
  what they have raised, whom they employ, and what that activity plausibly adds to the city's output.
  Built so a ministry desk — Komdigi, Kemenko Perekonomian, Bappenas — could read the ecosystem at a glance.
  Every derived figure is an estimate and labeled as one; nothing here is company-reported confidential data.</p>
  <div class="cen-chips view-toggle" style="position:static">
    <a class="chip" href="https://1001startup.id/map" target="_blank" rel="noopener">On the map ↗</a>
    <a class="chip" href="/jakarta">Jakarta map</a>
    <a class="chip" href="/blocks">Blocks</a>
  </div>
  ${core}
</div>`;
  return page({
    title: 'Jakarta Startup Census', path: '/census', authed, body,
    desc: "A regulator's view of Jakarta's startup economy — census, funding, jobs and estimated GDP contribution.",
  });
}

module.exports = { home, world, scbd, scbdMap, jakarta, blocks, census, directory, profile, qrTool, claim, login, dashboard, admin, notFound };
