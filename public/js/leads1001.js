(function () {
  'use strict';
  /* Lead Search console.
   *
   * A run is 20-60 seconds of Exa and inference calls. A spinner for a minute
   * reads as a hang, so the server streams NDJSON progress and this renders
   * each stage as it lands. Everything is built with createElement/textContent:
   * the payload contains names, roles and URLs pulled off third-party pages,
   * and none of that is ever trusted as markup. */

  /* The shell sets <html lang>; every status and result-frame string follows
     it. Data is never translated: names, roles, evidence quotes, engine notes
     and server messages render exactly as recorded. */
  var ID_LANG = document.documentElement.lang === 'id';
  function T(en, id) { return ID_LANG && id != null ? id : en; }

  var form = document.getElementById('lf');
  if (!form) return;
  var runBtn = document.getElementById('run');
  var csvBtn = document.getElementById('csv');
  var stepsEl = document.getElementById('steps');
  var outEl = document.getElementById('out');
  var errEl = document.getElementById('err');
  var rtEl = document.getElementById('rt');
  var runWrap = document.getElementById('runwrap');
  var orbCap = document.getElementById('orbcap');
  var last = null;
  var orb = null;

  /* Each stage gets a formation and a verb, so the orb is reporting the run
     rather than decorating it. */
  var STAGE = {
    discover: ['globe', T('Finding companies', 'Mencari perusahaan')],
    company:  ['orbits', T('Switching company', 'Pindah perusahaan')],
    roles:    ['orbits', T('Reading the brief', 'Membaca brief')],
    hunt:     ['globe', T('Searching', 'Menelusuri')],
    verify:   ['web', T('Verifying', 'Memverifikasi')],
    domain:   ['web', T('Resolving domain', 'Melacak domain')],
    evidence: ['web', T('Gathering evidence', 'Mengumpulkan bukti')],
    pattern:  ['orbits', T('Learning format', 'Mempelajari pola')],
    rank:     ['orbits', T('Ranking', 'Memeringkat')]
  };

  /* The confidence markers are semantic; their Indonesian labels are fixed,
     precision over brevity — an inferred address must never read firmer than
     "hasil inferensi pola". */
  var CONF = {
    published: { c: '#2F7A5C', t: T('published', 'terpublikasi') },
    inferred: { c: '#8A6D3B', t: T('inferred', 'hasil inferensi pola') },
    ambiguous: { c: '#B2447E', t: T('ambiguous', 'ambigu') },
    none: { c: '#8E8E93', t: T('none', 'nihil') }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function stage(name, detail, done) {
    var meta = STAGE[name];
    if (orb && meta) { orb.set(meta[0]); if (orbCap) orbCap.textContent = meta[1]; }
    var row = el('div', 'step' + (done ? ' dn' : ''));
    row.appendChild(el('span', 'k', name));
    row.appendChild(el('span', 'd', detail || ''));
    stepsEl.appendChild(row);
    stepsEl.scrollTop = stepsEl.scrollHeight;
  }

  function chip(kind) {
    var meta = CONF[kind] || CONF.none;
    var c = el('span', 'chip', meta.t);
    c.style.color = meta.c;
    return c;
  }

  function emailCell(p) {
    var td = el('td');
    var e = p.email || {};
    if (!e.value) {
      td.appendChild(el('span', 'em', '—'));
      return td;
    }
    var wrap = el('div', 'em');
    /* A published address earns a link to the page it was read on. That link is
       the difference between a fact and a guess, so it is never omitted. */
    if (e.confidence === 'published' && e.sources && e.sources.length) {
      var a = el('a', null, e.value);
      a.href = e.sources[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      wrap.appendChild(a);
    } else {
      wrap.appendChild(document.createTextNode(e.value));
    }
    td.appendChild(wrap);
    if (e.alternates && e.alternates.length) {
      td.appendChild(el('span', 'alt', T('or ', 'atau ') + e.alternates.join(T('  or  ', '  atau  '))));
    }
    /* What the FORMAT rests on, which is a different question from the
       confidence chip (that one is about the name). An address built with
       nothing observed behind it must not look like one backed by a corpus. */
    if (e.basis === 'shape') td.appendChild(el('span', 'alt', T('format from address shapes, not name-verified',
      'pola dari bentuk alamat, tanpa verifikasi nama')));
    else if (e.basis === 'assumed') td.appendChild(el('span', 'alt', T('no format evidence — convention only',
      'tanpa bukti pola — hanya konvensi')));
    return td;
  }

  function render(r) {
    clear(outEl);
    last = r;

    var led = el('div', 'ledger');
    var u = r.usage || {};
    [[String((r.people || []).length), T('people currently employed', 'orang masih bekerja')],
     [String(r.exaQueries || 0), T('Exa queries', 'kueri Exa')],
     [(u.tokensIn || 0) + ' / ' + (u.tokensOut || 0), T('tokens in / out', 'token masuk / keluar')],
     ['US$' + Number(u.costUsd || 0).toFixed(5), T('inference spent', 'biaya inferensi')]
    ].forEach(function (pair) {
      var c = el('div', 'c');
      c.appendChild(el('div', 'v', pair[0]));
      c.appendChild(el('div', 'k', pair[1]));
      led.appendChild(c);
    });
    outEl.appendChild(led);

    if (!(r.people || []).length) {
      var w = el('div', 'warn', T('No currently-employed people were found for that company. '
        + 'Either the name did not match how Exa indexes them, or every profile found was a former employee.',
      'Tidak ditemukan orang yang masih bekerja di perusahaan itu. Entah namanya tidak cocok dengan '
        + 'cara Exa mengindeksnya, atau semua profil yang ditemukan ternyata mantan karyawan.'));
      outEl.appendChild(w);
    } else {
      var tw = el('div', 'tablewrap');
      var t = el('table');
      var thead = el('thead');
      var hr = el('tr');
      var cols = [T('Person', 'Nama'), T('Current role', 'Jabatan saat ini'), 'Email',
        T('Confidence', 'Tingkat keyakinan'), T('Why them', 'Kenapa dia')];
      if (r.multi) cols.splice(1, 0, T('Company', 'Perusahaan'));
      cols.forEach(function (h) { hr.appendChild(el('th', null, h)); });
      thead.appendChild(hr);
      t.appendChild(thead);
      var tb = el('tbody');
      (r.people || []).forEach(function (p) {
        var tr = el('tr');
        var td1 = el('td');
        var nm = el('div', 'nm');
        if (p.linkedin) {
          var la = el('a', null, p.name);
          la.href = p.linkedin; la.target = '_blank'; la.rel = 'noopener noreferrer';
          nm.appendChild(la);
        } else nm.textContent = p.name;
        td1.appendChild(nm);
        if (p.since) td1.appendChild(el('div', 'rl', T('since ', 'sejak ') + p.since));
        tr.appendChild(td1);

        if (r.multi) tr.appendChild(el('td', 'rl', p.company || ''));

        var td2 = el('td');
        td2.appendChild(el('div', 'rl', p.role || '—'));
        if (p.department) td2.appendChild(el('div', 'rl', p.department));
        tr.appendChild(td2);

        tr.appendChild(emailCell(p));

        var td4 = el('td');
        td4.appendChild(chip((p.email && p.email.confidence) || 'none'));
        tr.appendChild(td4);

        tr.appendChild(el('td', 'why', p.why || ''));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      tw.appendChild(t);
      outEl.appendChild(tw);
      csvBtn.disabled = false;
    }

    var ev = el('div', 'ev');
    ev.appendChild(el('h2', null, T('How these addresses were decided', 'Bagaimana alamat-alamat ini diputuskan')));

    /* A run covering several companies has a different domain and a different
       learned format for each, so one merged paragraph would be a lie. */
    if (r.multi && (r.companies || []).length) {
      (r.companies || []).forEach(function (co) {
        var cp = el('p');
        var b = el('b', null, co.name + ' — ');
        cp.appendChild(b);
        cp.appendChild(document.createTextNode(T('mail domain ', 'domain email ')));
        cp.appendChild(el('code', null, co.domain || T('not found', 'tidak ditemukan')));
        cp.appendChild(document.createTextNode(
          (co.mailProvider ? T(' on ', ' di ') + co.mailProvider : '')
          + ', ' + (co.people || 0) + T(' people, ', ' orang, ')
          + ((co.patterns || []).length
            ? T('format ', 'pola ') + co.patterns[0].pattern + ' (' + co.patterns[0].observed + T(' agreeing)', ' alamat sepakat)')
            : T('no format learned, so nothing was guessed', 'tidak ada pola yang terbaca, jadi tidak ada yang ditebak')) + '.'));
        ev.appendChild(cp);
      });
    } else {
      var p1 = el('p');
      p1.appendChild(document.createTextNode(T('Mail domain ', 'Domain email ')));
      var code = el('code', null, r.domain || T('not found', 'tidak ditemukan'));
      p1.appendChild(code);
      p1.appendChild(document.createTextNode(
        (r.mailProvider ? T(' on ', ' di ') + r.mailProvider : '')
        + (r.domainSource ? T(', from ', ', dari ') + r.domainSource : '') + '.'));
      ev.appendChild(p1);
      /* When the domain could not be tied to the company we still print it, but
         the run refuses to build addresses on it. Saying so is the point. */
      if (r.domain && r.domainTrusted === false) {
        ev.appendChild(el('div', 'warn', T('That domain could not be tied to the company name, '
          + 'so no addresses were guessed from it. Set the mail domain yourself to override.',
        'Domain itu tidak bisa dikaitkan dengan nama perusahaannya, jadi tidak ada alamat yang '
          + 'ditebak darinya. Isi sendiri kolom domain email untuk menimpa keputusan ini.')));
      }
    }

    if (!r.multi && (r.patterns || []).length) {
      var pl = el('p', null, T('Format learned from addresses that are actually published:',
        'Pola email dipelajari dari alamat yang benar-benar terpublikasi:'));
      ev.appendChild(pl);
      var ul = el('ul');
      r.patterns.forEach(function (pat) {
        var li = el('li', null, pat.pattern + ' — ' + pat.observed + T(' real address'
          + (pat.observed === 1 ? ' agrees' : 'es agree'), ' alamat asli sepakat'));
        ul.appendChild(li);
      });
      ev.appendChild(ul);
    } else if (!r.multi && (r.shapes || []).length) {
      /* No address could be pinned to a name we know, but the domain's real
         addresses still have a readable shape. Saying which, and saying it is
         weaker evidence, beats the old flat "no format could be learned" —
         which was printed even as an address was being built. */
      ev.appendChild(el('p', null, T('No published address could be matched to a person by name, so the '
        + 'format was read from the SHAPE of real addresses on this domain:',
      'Tidak ada alamat terpublikasi yang bisa dicocokkan ke nama orang, jadi pola dibaca dari '
        + 'BENTUK alamat asli di domain ini:')));
      var ul3 = el('ul');
      r.shapes.forEach(function (s) {
        var li3 = el('li', null, s.pattern + ' — ' + s.observed + T(' address'
          + (s.observed === 1 ? '' : 'es'), ' alamat')
          + ((s.examples || []).length ? ' (' + s.examples.slice(0, 3).join(', ') + ')' : ''));
        ul3.appendChild(li3);
      });
      ev.appendChild(ul3);
      ev.appendChild(el('div', 'warn', T('Shape evidence is weaker than a name match: it shows how this '
        + 'company builds addresses, not that any particular address exists.',
      'Bukti bentuk lebih lemah daripada kecocokan nama: ia menunjukkan cara perusahaan ini menyusun '
        + 'alamat, bukan bahwa alamat tertentu benar-benar ada.')));
    } else if (!r.multi) {
      ev.appendChild(el('p', null, r.domainTrusted === false
        ? T('No address format could be learned, and the domain is not trusted, so no address was guessed.',
          'Tidak ada pola alamat yang bisa dipelajari, dan domainnya tidak tepercaya, jadi tidak ada alamat yang ditebak.')
        : T('No address format could be learned. Addresses below use the first.last convention and have '
          + 'nothing observed behind them.',
        'Tidak ada pola alamat yang bisa dipelajari. Alamat di bawah memakai konvensi first.last '
          + 'dan tidak punya satu pun observasi di baliknya.')));
    }

    if ((r.emailsFound || []).length) {
      ev.appendChild(el('p', null, r.emailsFound.length + T(' addresses were found verbatim on public pages:',
        ' alamat ditemukan tertulis persis di halaman publik:')));
      var ul2 = el('ul');
      r.emailsFound.slice(0, 12).forEach(function (f) {
        var li = el('li');
        li.appendChild(document.createTextNode(f.email + '  '));
        if (f.sources && f.sources[0]) {
          var a2 = el('a', null, T('source', 'sumber'));
          a2.href = f.sources[0]; a2.target = '_blank'; a2.rel = 'noopener noreferrer';
          li.appendChild(a2);
        }
        ul2.appendChild(li);
      });
      ev.appendChild(ul2);
    }

    if ((r.roleBoxes || []).length) {
      ev.appendChild(el('p', null, T('Shared mailboxes found (real, but they belong to nobody, so they never '
        + 'vote on the format): ',
      'Kotak surat bersama yang ditemukan (asli, tapi bukan milik perorangan, jadi tidak pernah '
        + 'ikut menentukan pola email): ') + r.roleBoxes.map(function (x) { return x.email; }).join(', ')));
    }

    ev.appendChild(el('div', 'warn', r.verification || ''));
    if ((r.notes || []).length) {
      ev.appendChild(el('div', 'warn', T('Run notes: ', 'Catatan pencarian: ') + r.notes.join('; ')));
    }
    outEl.appendChild(ev);
  }

  function csvEscape(v) {
    var s = v == null ? '' : String(v);
    /* A role like "Head of Ops, Jakarta" and a why-line with a quote both break
       a naive join. Quote whenever the value carries a delimiter. */
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  csvBtn.addEventListener('click', function () {
    if (!last) return;
    var rows = [['company', 'name', 'role', 'since', 'email', 'confidence', 'alternates', 'linkedin', 'why']];
    (last.people || []).forEach(function (p) {
      var e = p.email || {};
      rows.push([p.company || last.company, p.name, p.role, p.since, e.value, e.confidence,
        (e.alternates || []).join(' | '), p.linkedin, p.why]);
    });
    var text = rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\n');
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        csvBtn.textContent = T('Copied', 'Tersalin');
        setTimeout(function () { csvBtn.textContent = T('Copy CSV', 'Salin CSV'); }, 1800);
      }, fallback);
    } else fallback();
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var company = document.getElementById('company').value.trim();
    var intent = document.getElementById('intent').value.trim();
    /* The company is OPTIONAL — with only a brief the agent discovers its own
       candidates. An earlier guard here required a company and silently ate
       the click, which contradicted everything the form said. One of the two
       must be present; an empty form has nothing to research. */
    if (!company && !intent) {
      clear(errEl);
      errEl.appendChild(el('div', 'err', T('Name a company, or describe who you are trying to reach.',
        'Sebutkan perusahaan, atau jelaskan siapa yang ingin dijangkau.')));
      return;
    }
    var body = {
      company: company,
      domain: document.getElementById('domain').value.trim(),
      intent: intent
    };

    runBtn.disabled = true;
    csvBtn.disabled = true;
    runBtn.textContent = T('Running', 'Sedang berjalan');
    clear(stepsEl); clear(outEl); clear(errEl);
    if (runWrap) runWrap.className = 'runwrap on';
    if (!orb && window.LeadsOrb) {
      var host = document.getElementById('orb');
      if (host) orb = window.LeadsOrb.mount(host, { count: 90, size: 96 });
    }
    if (orb) orb.set('globe');
    if (orbCap) orbCap.textContent = T('Starting', 'Memulai');
    var t0 = Date.now();
    var tick = setInterval(function () {
      rtEl.textContent = Math.round((Date.now() - t0) / 1000) + 's';
    }, 1000);

    function finish() {
      clearInterval(tick);
      runBtn.disabled = false;
      runBtn.textContent = T('Run search', 'Jalankan pencarian');
      /* The orb keeps breathing on the finished run instead of vanishing —
         the ring is the resting formation, same as the card's. */
      if (orb) orb.set('ring');
      if (orbCap) orbCap.textContent = T('Done', 'Selesai');
    }
    function fail(msg) {
      clear(errEl);
      errEl.appendChild(el('div', 'err', msg));
      finish();
    }

    /* "Load failed" / "Failed to fetch" is what the browser says when the
       SOCKET died — on this host that is almost always the server being
       restarted for a deploy while the run was in flight. Saying so, and what
       it means for the spend, beats echoing the browser's four words. */
    var settled = false; // a done or error line arrived — the run truly ended
    function cutOff() {
      fail(T('The connection was cut before the run finished — usually a deploy restarting '
        + 'the server mid-run. Nothing was saved and the spend so far is lost. '
        + 'Run it again in a minute; the interrupted attempt is flagged in History.',
      'Koneksi terputus sebelum pencarian selesai — biasanya karena deploy me-restart server '
        + 'di tengah jalan. Tidak ada yang tersimpan dan biaya yang terlanjur keluar hangus. '
        + 'Coba lagi sekitar satu menit lagi; percobaan yang terputus ditandai di Riwayat.'));
    }

    fetch('/leads/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) { location.href = (ID_LANG ? '/id' : '') + '/leads/login'; return; }
      if (!res.ok && !res.body) {
        return res.text().then(function (t) { fail(T('The server refused the run. ',
          'Server menolak pencarian ini. ') + t.slice(0, 200)); });
      }
      if (!res.body || !res.body.getReader) {
        /* No streaming available: the whole body still arrives eventually, so
           read it in one go and take the final object. */
        return res.text().then(function (t) { handleAll(t); finish(); });
      }
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            /* A stream can end without a trailing newline, so whatever is left
               in the buffer is a real line and must not be dropped. */
            if (buf.trim()) handleLine(buf);
            /* The stream closed cleanly but no verdict ever arrived: the
               server went away mid-run. An empty step list is not an answer. */
            if (!settled) { cutOff(); return; }
            finish();
            return;
          }
          buf += dec.decode(r.value, { stream: true });
          var i;
          /* Only consume up to the LAST newline. A chunk boundary routinely
             lands mid-object; the remainder stays buffered until it completes. */
          while ((i = buf.indexOf('\n')) >= 0) {
            var line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (line.trim()) handleLine(line);
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      if (settled) return;
      var msg = e && e.message ? String(e.message) : '';
      /* TypeError with "fetch"/"load" wording = the network layer died. */
      if (/load failed|failed to fetch|network/i.test(msg) || (e && e.name === 'TypeError')) cutOff();
      else fail(T('The run could not be reached: ', 'Server tidak bisa dihubungi: ')
        + (msg || T('network error', 'gangguan jaringan')));
    });

    function handleAll(text) {
      text.split('\n').forEach(function (l) { if (l.trim()) handleLine(l); });
    }
    function handleLine(line) {
      var d;
      try { d = JSON.parse(line); } catch (e) { return; }
      if (d.type === 'stage') stage(d.name, d.detail, true);
      else if (d.type === 'error') { settled = true; fail(d.message || T('The run failed.', 'Pencarian gagal.')); }
      else if (d.type === 'done' && d.result) { settled = true; render(d.result); }
    }
  });
})();
