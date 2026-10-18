/* dc.1001startup.id/graph — how Indonesia's networks connect (views/peeringgraph1001.js).
 *
 * Three columns, data centres | networks | exchanges, joined by PeeringDB's two links: a
 * network is in a data centre (its interconnection facilities) and a network has a port on
 * an exchange (its public peering). The opening view is the core of the country; any box
 * re-centres the graph on itself and the address follows (?fac= / ?as= / ?ix=), so a view
 * can be shared. Lines run only in the gaps between columns, so none crosses a name. On
 * phones the network column stays and a switch shows one of its two sides at a time.
 */
(() => {
  'use strict';
  const graph = document.getElementById('pg-graph');
  if (!graph) return;
  let cfg = {};
  try { cfg = JSON.parse(graph.dataset.cfg || '{}'); } catch (e) { /* keep defaults */ }
  const hdr = document.getElementById('pg-hdr');
  const head = document.getElementById('pg-head');
  const input = document.getElementById('pg-q');
  const sug = document.getElementById('pg-sug');
  const tabs = [...document.querySelectorAll('.pg-tabs [data-side]')];
  const NS = 'http://www.w3.org/2000/svg';
  const MAP = cfg.map || 'https://dc.1001startup.id/';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(max-width: 759px)');
  const n0 = (v) => Number(v || 0).toLocaleString('en-US');
  const pc = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => String(n || '?').replace(/^(PT|CV)\.?\s+/i, '').split(/[\s/&+()-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  const F = new Map();
  const X = new Map();
  const NET = new Map();
  const BYASN = new Map();
  const facNets = new Map();
  const ixNets = new Map();
  const USERS = new Map();
  let side = 'f';
  let view = null;
  let hoverKey = null;
  let geo = [];

  const TNAME = { I: 'ISP', C: 'Carrier', S: 'Network services', T: 'Content', E: 'Enterprise', R: 'Route server', U: 'Education and research', G: 'Government', N: 'Non-profit', '': 'Type not given' };
  const PNAME = { O: 'Open', S: 'Selective', R: 'Restrictive', N: 'No peering' };
  const GNAME = { isp: 'ISPs', car: 'Carriers', con: 'Content and cloud', oth: 'Other networks' };
  const groupOf = (n) => (USERS.has(n.asn) || n.t === 'I' ? 'isp' : n.t === 'C' || n.t === 'S' ? 'car' : n.t === 'T' || n.t === 'E' ? 'con' : 'oth');
  const score = (n) => n.fs.length + n.xs.length;
  const byScore = (a, b) => score(b) - score(a) || a.asn - b.asn;
  const users = (n) => (USERS.get(n.asn) || {}).pct || 0;
  const byUsers = (a, b) => users(b) - users(a) || byScore(a, b);
  const nname = (n) => (n.nv ? `AS${n.asn} (name unverified)` : n.n);

  /* ── boxes ─────────────────────────────────────────────────────── */
  /* meta = the short line every screen shows; xm = the rest, which a phone leaves out */
  const facItem = (f, o = {}) => ({
    k: `f:${f.id}`, label: f.n, title: f.full, logo: f.logo, grey: f.grey, mark: true,
    meta: o.meta != null ? o.meta : f.bld || `${n0(f.nets)} networks`, xm: o.meta != null ? '' : f.bld ? ` · ${n0(f.nets)} networks` : '',
    tag: o.tag || '', focus: !!o.focus,
  });
  const ixItem = (x, o = {}) => ({
    k: `x:${x.id}`, label: x.n, title: x.full, logo: x.logo, grey: x.grey, mark: true,
    meta: o.meta != null ? o.meta : `${n0(x.nets)} networks`, xm: '', tag: o.tag || '', focus: !!o.focus,
  });
  const netItem = (n, o = {}) => {
    const u = users(n);
    return {
      k: `n:${n.id}`, label: nname(n), title: `${n.n} · AS${n.asn}`, logo: '', grey: false, mark: false,
      meta: `AS${n.asn} · ${u ? `${pc(u)} users` : TNAME[n.t] || TNAME['']}`, xm: ` · ${n.fs.length} DC · ${n.xs.length} IX`,
      tag: o.tag || '', focus: !!o.focus,
    };
  };
  /* networks of a data centre or an exchange: four groups, up to six each first, then the
     rest of the 24 places to the groups that still have more */
  function pick(list, cap) {
    const by = { isp: [], car: [], con: [], oth: [] };
    for (const n of list) by[groupOf(n)].push(n);
    by.isp.sort(byUsers); by.car.sort(byScore); by.con.sort(byScore); by.oth.sort(byScore);
    const keys = ['isp', 'car', 'con', 'oth'];
    const take = {};
    let left = cap;
    keys.forEach((k) => { take[k] = Math.min(by[k].length, 6); left -= take[k]; });
    let grew = true;
    while (left > 0 && grew) {
      grew = false;
      for (const k of keys) if (left > 0 && take[k] < by[k].length) { take[k] += 1; left -= 1; grew = true; }
    }
    const out = [];
    for (const k of keys) {
      if (!by[k].length) continue;
      out.push({ gh: GNAME[k], count: `${n0(take[k])} of ${n0(by[k].length)}` });
      by[k].slice(0, take[k]).forEach((n) => out.push(netItem(n)));
    }
    return { col: out, shown: keys.reduce((s, k) => s + take[k], 0) };
  }
  const tally = (nets, key, skip) => {
    const c = new Map();
    for (const n of nets) for (const id of n[key]) if (id !== skip) c.set(id, (c.get(id) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  };
  /* every line joins two boxes on screen: a network and a data centre it is in, or a
     network and an exchange it has a port on */
  function edgesOf(cols, focus) {
    const fs = new Set(cols.f.filter((it) => it.k).map((it) => +it.k.slice(2)));
    const xs = new Set(cols.x.filter((it) => it.k).map((it) => +it.k.slice(2)));
    const out = [];
    for (const it of cols.n) {
      if (!it.k) continue;
      const n = NET.get(+it.k.slice(2));
      for (const id of n.fs) if (fs.has(id)) out.push([`f:${id}`, it.k]);
      for (const id of n.xs) if (xs.has(id)) out.push([it.k, `x:${id}`]);
    }
    return out.map(([a, b]) => [a, b, a === focus || b === focus]);
  }

  /* ── the four views ────────────────────────────────────────────── */
  function overview() {
    const fs = [...F.values()].sort((a, b) => b.nets - a.nets || a.id - b.id).slice(0, 12);
    const xs = [...X.values()].sort((a, b) => b.nets - a.nets || a.id - b.id).slice(0, 12);
    const all = [...NET.values()];
    const used = new Set();
    const take = (list, k) => { const out = []; for (const n of list) { if (out.length >= k) break; if (!used.has(n.id)) { used.add(n.id); out.push(n); } } return out; };
    const isp = take(USERS.size ? all.filter((n) => USERS.has(n.asn)).sort(byUsers) : all.filter((n) => n.t === 'I').sort(byScore), 8);
    const car = take(all.filter((n) => n.t === 'C' || n.t === 'S').sort((a, b) => b.fs.length - a.fs.length || byScore(a, b)), 8);
    const con = take(all.filter((n) => n.t === 'T' || n.t === 'E').sort((a, b) => b.xs.length - a.xs.length || b.fs.length - a.fs.length || a.asn - b.asn), 8);
    const cols = {
      f: fs.map((f) => facItem(f)),
      n: [{ gh: USERS.size ? 'ISPs with the most users' : 'ISPs in the most places' }, ...isp.map((n) => netItem(n)),
        { gh: 'Carriers in the most data centres' }, ...car.map((n) => netItem(n)),
        { gh: 'Content and cloud on the most exchanges' }, ...con.map((n) => netItem(n))],
      x: xs.map((x) => ixItem(x)),
    };
    return {
      key: null, cols, edges: edgesOf(cols, null),
      more: { f: `${n0(F.size - fs.length)} more · search for any`, n: `${n0(NET.size - isp.length - car.length - con.length)} more · search for any`, x: `${n0(X.size - xs.length)} more · search for any` },
      empty: {},
      hdr: {
        f: ['Data centres', `the ${fs.length} with the most networks`],
        n: ['Networks', `${isp.length + car.length + con.length} of ${n0(NET.size)}, three ways of being big`],
        x: ['Exchanges', `the ${xs.length} with the most networks`],
      },
      head: `<div class="kk">All of Indonesia</div><h2>The core of the network</h2>
<p>The ${fs.length} data centres and ${xs.length} exchanges with the most networks, and ${isp.length + car.length + con.length} networks that tie them: the ISPs with the most users, the carriers in the most data centres, and the content and cloud networks on the most exchanges. <span class="dk">Point at a box to light its links; click it to see everything it connects to.</span><span class="ph">Tap a box to see everything it connects to.</span></p>`,
    };
  }

  function facView(f) {
    const list = (facNets.get(f.id) || []).map((id) => NET.get(id)).filter(Boolean);
    const { col, shown } = pick(list, 24);
    const others = tally(list, 'fs', f.id);
    const xs = tally(list, 'xs');
    for (const id of f.ixs) if (!xs.some(([x]) => x === id) && X.has(id)) xs.push([id, 0]);
    const cols = {
      f: [facItem(f, { focus: true, meta: [f.bld, `${n0(f.nets)} networks`].filter(Boolean).join(' · ') }),
        ...others.slice(0, 11).map(([id, c]) => facItem(F.get(id), { meta: `${n0(c)} of the same networks` }))],
      n: col,
      x: xs.slice(0, 12).map(([id, c]) => ixItem(X.get(id), { meta: c ? `${n0(c)} of its networks` : 'none of its networks', tag: f.ixs.includes(id) ? 'switch here' : '' })),
    };
    const key = `f:${f.id}`;
    const where = [f.full !== f.n ? f.full : '', f.op, f.city].filter(Boolean);
    return {
      key, cols, edges: edgesOf(cols, key),
      more: { f: others.length > 11 ? `${n0(others.length - 11)} more data centres` : '', n: list.length > shown ? `${n0(list.length - shown)} more networks · search for one` : '', x: xs.length > 12 ? `${n0(xs.length - 12)} more exchanges` : '' },
      empty: { n: list.length ? '' : `PeeringDB lists no network in ${f.n}.` },
      hdr: {
        f: ['Data centres', 'this one, then where its networks also are'],
        n: ['Networks', `${n0(shown)} of the ${n0(list.length)} in it`],
        x: ['Exchanges', 'where its networks have ports'],
      },
      head: `<button type="button" class="chip pg-back" data-home>← All of Indonesia</button>
<div class="pg-id">${mark(f.logo, f.n, f.grey, true)}<div><div class="kk">Data centre · PeeringDB facility${f.grey ? ' · grey: we can’t name it' : ''}</div><h2>${esc(f.n)}</h2>${where.length ? `<p>${esc(where.join(' · '))}</p>` : ''}</div></div>
<ul class="pg-facts"><li><b>${n0(f.nets)}</b> networks in it</li><li><b>${n0(f.ixs.length)}</b> exchange${f.ixs.length === 1 ? '' : 's'} with a switch here</li>${f.bld ? `<li>in <b>${esc(f.bld)}</b>, with ${n0(f.bn - 1)} other facilit${f.bn - 1 === 1 ? 'y' : 'ies'}</li>` : ''}${list.length ? `<li>its networks are also in <b>${n0(others.length)}</b> other data centres and on <b>${n0(xs.filter(([, c]) => c).length)}</b> exchanges</li>` : ''}</ul>
<p class="pg-acts">${f.place ? `<a class="btn sm" href="${esc(MAP)}?place=${encodeURIComponent(f.place)}&amp;layer=dc">Show on the map</a>` : ''}<a class="btn sm" href="https://www.peeringdb.com/fac/${f.id}" target="_blank" rel="noopener nofollow">PeeringDB entry</a></p>`,
    };
  }

  function netView(n) {
    const fs = n.fs.map((id) => F.get(id)).filter(Boolean).sort((a, b) => b.nets - a.nets || a.id - b.id);
    const xs = n.xs.map((id) => X.get(id)).filter(Boolean).sort((a, b) => b.nets - a.nets || a.id - b.id);
    const key = `n:${n.id}`;
    const u = USERS.get(n.asn);
    const name = nname(n);
    const cols = { f: fs.slice(0, 30).map((f) => facItem(f)), n: [netItem(n, { focus: true })], x: xs.slice(0, 30).map((x) => ixItem(x)) };
    return {
      key, cols, edges: edgesOf(cols, key),
      more: { f: fs.length > 30 ? `${n0(fs.length - 30)} more data centres` : '', n: '', x: xs.length > 30 ? `${n0(xs.length - 30)} more exchanges` : '' },
      empty: {
        f: fs.length ? '' : `${name} lists no Indonesian data centre in PeeringDB. In this data it meets other networks only on exchanges.`,
        x: xs.length ? '' : `${name} lists no port on any Indonesian exchange. In this data it meets other networks only in the data centres it is in.`,
      },
      hdr: {
        f: ['Data centres', `its ${n0(fs.length)} interconnection facilit${fs.length === 1 ? 'y' : 'ies'}`],
        n: ['Network', `AS${n.asn}`],
        x: ['Exchanges', `its ${n0(xs.length)} public peering point${xs.length === 1 ? '' : 's'}`],
      },
      head: `<button type="button" class="chip pg-back" data-home>← All of Indonesia</button>
<div class="pg-id">${mark('', name, false, true)}<div><div class="kk">Network · AS${n.asn} · ${esc(TNAME[n.t] || TNAME[''])}</div><h2>${esc(name)}</h2><p>Peering policy: ${esc(PNAME[n.p] || 'not given')}${u ? ` · about ${pc(u.pct)} of Indonesian internet users (APNIC Labs estimate)` : ''}${n.nv ? ' · PeeringDB’s name for this network doesn’t match the registry, so we don’t show it' : ''}</p></div></div>
<ul class="pg-facts"><li><b>${n0(fs.length)}</b> interconnection facilit${fs.length === 1 ? 'y' : 'ies'} (data centres)</li><li><b>${n0(xs.length)}</b> public peering exchange${xs.length === 1 ? '' : 's'}</li></ul>
<p class="pg-acts"><a class="btn sm" href="https://www.peeringdb.com/net/${n.id}" target="_blank" rel="noopener nofollow">PeeringDB entry</a><a class="btn sm" href="https://bgp.he.net/AS${n.asn}" target="_blank" rel="noopener nofollow">Routes on bgp.he.net</a></p>`,
    };
  }

  function ixView(x) {
    const list = (ixNets.get(x.id) || []).map((id) => NET.get(id)).filter(Boolean);
    const { col, shown } = pick(list, 24);
    const others = tally(list, 'xs', x.id);
    const fs = tally(list, 'fs');
    for (const id of x.sites) if (!fs.some(([f]) => f === id) && F.has(id)) fs.push([id, 0]);
    const key = `x:${x.id}`;
    const site = x.sites.map((id) => F.get(id)).find((f) => f && f.place);
    const cols = {
      f: fs.slice(0, 12).map(([id, c]) => facItem(F.get(id), { meta: c ? `${n0(c)} of its networks` : 'none of its networks', tag: x.sites.includes(id) ? 'switch here' : '' })),
      n: col,
      x: [ixItem(x, { focus: true }), ...others.slice(0, 11).map(([id, c]) => ixItem(X.get(id), { meta: `${n0(c)} of the same networks` }))],
    };
    return {
      key, cols, edges: edgesOf(cols, key),
      more: { f: fs.length > 12 ? `${n0(fs.length - 12)} more data centres` : '', n: list.length > shown ? `${n0(list.length - shown)} more networks · search for one` : '', x: others.length > 11 ? `${n0(others.length - 11)} more exchanges` : '' },
      empty: { n: list.length ? '' : `PeeringDB lists no network on ${x.n}.` },
      hdr: {
        f: ['Data centres', 'where its networks are'],
        n: ['Networks', `${n0(shown)} of the ${n0(list.length)} on it`],
        x: ['Exchanges', 'this one, then where its networks also peer'],
      },
      head: `<button type="button" class="chip pg-back" data-home>← All of Indonesia</button>
<div class="pg-id">${mark(x.logo, x.n, x.grey, true)}<div><div class="kk">Exchange${x.op ? ` · ${esc(x.op)}` : ''}${x.grey ? ' · grey: data centre not known' : ''}</div><h2>${esc(x.n)}</h2>${x.full !== x.n || x.city ? `<p>${esc([x.full !== x.n ? x.full : '', x.city].filter(Boolean).join(' · '))}</p>` : ''}</div></div>
<ul class="pg-facts"><li><b>${n0(x.nets)}</b> networks with a port</li><li>a switch in <b>${n0(x.sites.length)}</b> data centre${x.sites.length === 1 ? '' : 's'}</li>${list.length ? `<li>its networks are also on <b>${n0(others.length)}</b> other exchanges</li>` : ''}</ul>
<p class="pg-acts">${site ? `<a class="btn sm" href="${esc(MAP)}?place=${encodeURIComponent(site.place)}&amp;layer=ix">Show on the map</a>` : ''}<a class="btn sm" href="https://www.peeringdb.com/ix/${x.id}" target="_blank" rel="noopener nofollow">PeeringDB entry</a></p>`,
    };
  }

  function build(k) {
    if (!k) return overview();
    const [t, s] = k.split(':');
    const id = +s;
    if (t === 'f' && F.has(id)) return facView(F.get(id));
    if (t === 'n' && NET.has(id)) return netView(NET.get(id));
    if (t === 'x' && X.has(id)) return ixView(X.get(id));
    return overview();
  }

  /* ── drawing ───────────────────────────────────────────────────── */
  function mark(src, name, grey, big) {
    const s = big ? 38 : 22;
    if (grey) return '<span class="mk grey" aria-hidden="true"></span>';
    if (src) return `<img class="mk" src="${esc(src)}" alt="" width="${s}" height="${s}" loading="lazy" decoding="async">`;
    return `<span class="mk mono-mk" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  function nodeEl(it) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pg-n${it.grey ? ' is-grey' : ''}${it.focus ? ' focus' : ''}`;
    b.dataset.k = it.k;
    if (it.title && it.title !== it.label) b.title = it.title;
    b.innerHTML = `${it.mark ? mark(it.logo, it.label, it.grey) : ''}<span class="tx"><b>${esc(it.label)}</b>${it.meta ? `<small>${esc(it.meta)}${it.xm ? `<span class="xm">${esc(it.xm)}</span>` : ''}</small>` : ''}</span>${it.tag ? `<i class="tg">${esc(it.tag)}</i>` : ''}`;
    b.setAttribute('aria-label', [it.label, it.meta + (it.xm || ''), it.tag].filter(Boolean).join(', ') + (it.focus ? ' (shown now)' : ''));
    return b;
  }
  function draw(v) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pg-svg');
    svg.setAttribute('aria-hidden', 'true');
    const parts = [svg];
    for (const c of ['f', 'gl', 'n', 'gr', 'x']) {
      const d = document.createElement('div');
      if (c === 'gl' || c === 'gr') { d.className = `pg-gap g-${c[1]}`; parts.push(d); continue; }
      d.className = `pg-col c-${c}`;
      for (const it of v.cols[c]) {
        if (it.gh) {
          const h = document.createElement('div');
          h.className = 'pg-gh';
          h.innerHTML = `${esc(it.gh)}${it.count ? ` <b>${esc(it.count)}</b>` : ''}`;
          d.append(h);
        } else d.append(nodeEl(it));
      }
      if (v.empty[c]) { const e = document.createElement('div'); e.className = 'pg-empty'; e.textContent = v.empty[c]; d.append(e); }
      if (v.more[c]) { const m = document.createElement('div'); m.className = 'pg-more'; m.textContent = v.more[c]; d.append(m); }
      parts.push(d);
    }
    graph.replaceChildren(...parts);
    layout();
  }
  function renderHead(v) {
    head.innerHTML = v.head;
    head.classList.toggle('is-home', !v.key);
    hdr.querySelector('.c-f .t').textContent = v.hdr.f[0];
    hdr.querySelector('.c-f .d').textContent = v.hdr.f[1];
    hdr.querySelector('.c-n .t').textContent = v.hdr.n[0];
    hdr.querySelector('.c-n .d').textContent = v.hdr.n[1];
    hdr.querySelector('.c-x .t').textContent = v.hdr.x[0];
    hdr.querySelector('.c-x .d').textContent = v.hdr.x[1];
  }
  /* lines: from the right edge of one box to the left edge of the next column's box, each
     end spread over the middle of the box in the order of the far ends, so the bundle fans
     out instead of meeting in one point */
  function layout() {
    const svg = graph.querySelector('.pg-svg');
    if (!svg || !view) return;
    const box = graph.getBoundingClientRect();
    const W = Math.ceil(graph.clientWidth);
    const H = Math.ceil(graph.scrollHeight);
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const rect = new Map();
    graph.querySelectorAll('.pg-n').forEach((el) => {
      if (!el.getClientRects().length) return; // the column a phone isn't showing
      const r = el.getBoundingClientRect();
      rect.set(el.dataset.k, { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top });
    });
    geo = [];
    for (const [a, b, p] of view.edges) {
      const A = rect.get(a); const B = rect.get(b);
      if (!A || !B) continue;
      const aLeft = A.l + A.r < B.l + B.r;
      geo.push({ a, b, p, lk: aLeft ? a : b, rk: aLeft ? b : a, L: aLeft ? A : B, R: aLeft ? B : A, y1: 0, y2: 0, d: '' });
    }
    const ports = new Map();
    const add = (key, g, oy, end) => { if (!ports.has(key)) ports.set(key, []); ports.get(key).push({ g, oy, end }); };
    for (const g of geo) { add(`${g.lk}|r`, g, (g.R.t + g.R.b) / 2, 1); add(`${g.rk}|l`, g, (g.L.t + g.L.b) / 2, 2); }
    for (const [key, list] of ports) {
      const R = rect.get(key.split('|')[0]);
      const mid = (R.t + R.b) / 2;
      const span = Math.min((R.b - R.t) * 0.6, (list.length - 1) * 3);
      list.sort((u, w) => u.oy - w.oy);
      list.forEach((it, i) => {
        const y = list.length > 1 ? mid - span / 2 + (span * i) / (list.length - 1) : mid;
        if (it.end === 1) it.g.y1 = y; else it.g.y2 = y;
      });
    }
    const frag = document.createDocumentFragment();
    for (const g of geo) {
      const x1 = g.L.r; const x2 = g.R.l; const dx = (x2 - x1) / 2;
      const f = (v) => v.toFixed(1);
      g.d = `M${f(x1)} ${f(g.y1)}C${f(x1 + dx)} ${f(g.y1)} ${f(x2 - dx)} ${f(g.y2)} ${f(x2)} ${f(g.y2)}`;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('class', `pg-e${g.p ? ' p' : ''}`);
      g.el = p;
      frag.append(p);
    }
    svg.replaceChildren(frag);
    paint();
  }
  /* what is lit: the box pointed at (else the picked one), its own lines, and for a data
     centre or an exchange the next hop through its networks to the other side */
  function paint() {
    const svg = graph.querySelector('.pg-svg');
    if (!svg) return;
    const k = hoverKey || (view && view.key);
    const lit = new Set();
    const hop = new Set();
    const on = new Set();
    if (k) {
      const own = geo.filter((g) => g.a === k || g.b === k);
      own.forEach((g) => { lit.add(g); on.add(g.a); on.add(g.b); });
      if (k[0] !== 'n') {
        const nets = new Set(own.map((g) => (g.a === k ? g.b : g.a)));
        for (const g of geo) {
          const via = nets.has(g.a) ? g.a : nets.has(g.b) ? g.b : null;
          if (!via) continue;
          const far = g.a === via ? g.b : g.a;
          if (far[0] !== k[0]) { hop.add(g); on.add(far); }
        }
      }
    }
    /* pointing at a box lights its whole chain; the picked box keeps its own lines dark
       and the next hop grey, so the page doesn't turn into one black mass */
    if (hoverKey) hop.forEach((g) => lit.add(g));
    for (const g of geo) { g.el.classList.toggle('lit', lit.has(g)); g.el.classList.toggle('hop', !lit.has(g) && hop.has(g)); }
    graph.classList.toggle('hov', !!hoverKey);
    graph.querySelectorAll('.pg-n').forEach((el) => {
      const key = el.dataset.k;
      el.classList.toggle('on', !!hoverKey && on.has(key) && key !== hoverKey);
      el.classList.toggle('dim', !!hoverKey && !on.has(key) && key !== hoverKey);
    });
    svg.querySelectorAll('.pg-fl').forEach((p) => p.remove());
    if (reduce.matches || !lit.size) return;
    let i = 0;
    for (const g of lit) {
      if (i >= 90) break;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('class', 'pg-fl');
      p.style.animationDelay = `${-((i * 0.41) % 1.5).toFixed(2)}s`;
      svg.append(p);
      i += 1;
    }
  }

  /* ── moving around ─────────────────────────────────────────────── */
  function keyFromUrl() {
    const q = new URLSearchParams(location.search);
    const fac = +q.get('fac'); const as = +q.get('as'); const ix = +q.get('ix');
    if (fac && F.has(fac)) return `f:${fac}`;
    if (as && BYASN.has(as)) return `n:${BYASN.get(as)}`;
    if (ix && X.has(ix)) return `x:${ix}`;
    return null;
  }
  function setSide(s, relayout) {
    side = s;
    graph.dataset.side = s;
    hdr.dataset.side = s;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.side === s)));
    if (relayout) layout();
  }
  function go(k, push) {
    const v = build(k);
    if (push) {
      const u = new URL(location.href);
      ['fac', 'as', 'ix'].forEach((p) => u.searchParams.delete(p));
      if (v.key) {
        const [t, id] = v.key.split(':');
        if (t === 'f') u.searchParams.set('fac', id);
        else if (t === 'x') u.searchParams.set('ix', id);
        else u.searchParams.set('as', NET.get(+id).asn);
      }
      history.pushState(null, '', u);
    }
    if (v.key && v.key[0] === 'f') setSide('f', false);
    else if (v.key && v.key[0] === 'x') setSide('x', false);
    const swap = () => { view = v; hoverKey = null; renderHead(v); draw(v); };
    if (!view || reduce.matches) swap();
    else {
      graph.classList.add('swap');
      setTimeout(() => { swap(); requestAnimationFrame(() => graph.classList.remove('swap')); }, 150);
    }
    if (push) {
      const r = head.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.7) head.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
    }
  }
  graph.addEventListener('click', (e) => { const n = e.target.closest('.pg-n'); if (n && n.dataset.k !== (view && view.key)) go(n.dataset.k, true); });
  graph.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const n = e.target.closest('.pg-n');
    const k = n ? n.dataset.k : null;
    if (k !== hoverKey) { hoverKey = k; paint(); }
  });
  graph.addEventListener('pointerleave', () => { if (hoverKey) { hoverKey = null; paint(); } });
  graph.addEventListener('focusin', (e) => { const n = e.target.closest('.pg-n'); if (n && n.matches(':focus-visible')) { hoverKey = n.dataset.k; paint(); } });
  graph.addEventListener('focusout', () => { if (hoverKey) { hoverKey = null; paint(); } });
  head.addEventListener('click', (e) => { if (e.target.closest('[data-home]')) go(null, true); });
  tabs.forEach((t) => t.addEventListener('click', () => setSide(t.dataset.side, true)));
  window.addEventListener('popstate', () => { if (F.size) go(keyFromUrl(), false); });
  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(graph);
  else window.addEventListener('resize', relayout);
  phone.addEventListener('change', relayout);
  /* the site's contact tab sits near the bottom-right corner: hide it while the graph is
     under that band (same rule as the map), so it never covers a box */
  let band = null;
  const watchBand = () => {
    if (band) band.disconnect();
    if (!('IntersectionObserver' in window)) return;
    band = new IntersectionObserver((es) => document.body.classList.toggle('pg-over-graph', es[0].isIntersecting),
      { rootMargin: `-${Math.max(0, window.innerHeight - 160)}px 0px -76px 0px` });
    band.observe(graph);
  };
  watchBand();
  window.addEventListener('resize', watchBand);
  reduce.addEventListener('change', () => paint());

  /* ── search ────────────────────────────────────────────────────── */
  let index = [];
  let hits = [];
  let sel = -1;
  function buildIndex() {
    index = [];
    for (const f of F.values()) index.push({ k: `f:${f.id}`, kind: 'DC', label: f.n, sub: [f.bld, f.city, `${n0(f.nets)} networks`].filter(Boolean).join(' · '), hay: [f.n, f.full, f.pdb, f.op, f.bld, f.city].join(' ').toLowerCase(), w: f.nets });
    for (const x of X.values()) index.push({ k: `x:${x.id}`, kind: 'IX', label: x.n, sub: [x.op, x.city, `${n0(x.nets)} networks`].filter(Boolean).join(' · '), hay: [x.n, x.full, x.op, x.city].join(' ').toLowerCase(), w: x.nets });
    for (const n of NET.values()) index.push({ k: `n:${n.id}`, kind: 'NET', label: nname(n), sub: `AS${n.asn} · ${TNAME[n.t] || TNAME['']} · ${n.fs.length} DC · ${n.xs.length} IX`, hay: `${n.nv ? '' : n.n} as${n.asn} ${n.asn}`.toLowerCase(), w: score(n) + users(n) * 10 });
  }
  function find(text) {
    const s = text.trim().toLowerCase().replace(/^as\s+(?=\d)/, 'as');
    if (!s) return [];
    const words = s.split(/\s+/);
    const res = [];
    for (const it of index) {
      if (!words.every((w) => it.hay.includes(w))) continue;
      const lab = it.label.toLowerCase();
      const rank = lab === s || it.hay.split(' ').includes(s) ? 0 : lab.startsWith(s) ? 1 : 2;
      res.push([rank, -it.w, it]);
    }
    res.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return res.slice(0, 8).map((r) => r[2]);
  }
  function showHits() {
    const open = !!input.value.trim();
    sug.hidden = !open;
    input.parentElement.setAttribute('aria-expanded', String(open));
    if (!open) return;
    sug.innerHTML = hits.length
      ? hits.map((h, i) => `<li role="option" id="pg-o${i}" data-k="${esc(h.k)}" aria-selected="${i === sel}"><span class="k">${h.kind}</span><span><b>${esc(h.label)}</b><small>${esc(h.sub)}</small></span></li>`).join('')
      : '<li class="nil" role="option" aria-disabled="true">Nothing by that name in PeeringDB’s Indonesian records</li>';
    if (sel >= 0) input.setAttribute('aria-activedescendant', `pg-o${sel}`); else input.removeAttribute('aria-activedescendant');
  }
  function choose(k) { input.value = ''; hits = []; sel = -1; showHits(); input.blur(); go(k, true); }
  input.addEventListener('input', () => { hits = find(input.value); sel = hits.length ? 0 : -1; showHits(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); sel = (sel + 1) % hits.length; showHits(); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); sel = (sel - 1 + hits.length) % hits.length; showHits(); }
    else if (e.key === 'Enter' && sel >= 0 && hits[sel]) { e.preventDefault(); choose(hits[sel].k); }
    else if (e.key === 'Escape') { input.value = ''; hits = []; sel = -1; showHits(); }
  });
  sug.addEventListener('mousedown', (e) => e.preventDefault());
  sug.addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li) choose(li.dataset.k); });
  input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; input.parentElement.setAttribute('aria-expanded', 'false'); }, 120));
  input.addEventListener('focus', () => { if (input.value.trim()) showHits(); });

  /* ── data ──────────────────────────────────────────────────────── */
  function ingest(G, R) {
    for (const f of G.f) { F.set(f.id, f); facNets.set(f.id, []); }
    for (const x of G.x) { X.set(x.id, x); ixNets.set(x.id, []); }
    for (const r of G.n) {
      const n = { id: r[0], asn: r[1], n: r[2], t: r[3], p: r[4], fs: r[5], xs: r[6], nv: !!r[7] };
      NET.set(n.id, n);
      BYASN.set(n.asn, n.id);
      n.fs.forEach((id) => facNets.has(id) && facNets.get(id).push(n.id));
      n.xs.forEach((id) => ixNets.has(id) && ixNets.get(id).push(n.id));
    }
    if (R && Array.isArray(R.isps)) for (const i of R.isps) USERS.set(i.asn, { pct: i.pct, unverified: !!i.unverified });
  }
  const getJson = (u) => fetch(u, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null));
  Promise.all([getJson(cfg.data || '/data/peering-graph.json'), cfg.reach ? getJson(cfg.reach).catch(() => null) : null])
    .then(([G, R]) => {
      if (!G || !Array.isArray(G.n)) throw new Error('no data');
      ingest(G, R);
      buildIndex();
      setSide(phone.matches && keyFromUrl() && keyFromUrl()[0] === 'x' ? 'x' : 'f', false);
      go(keyFromUrl(), false);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    })
    .catch(() => { graph.innerHTML = '<p class="pg-load" style="grid-column:1/-1">The graph could not load. Try again in a minute, or use the <a href="/">peering map</a>.</p>'; });
})();
