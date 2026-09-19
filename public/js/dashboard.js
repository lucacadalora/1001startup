(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var ACCENTS = JSON.parse($('dash').getAttribute('data-accents'));
  var me = null;

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().then(function (j) {
        // Only a dead session sends us to /login — a 401 with another error
        // (e.g. wrong current password) must surface in the form instead.
        if (r.status === 401 && j.error === 'not_logged_in') { location.href = '/login'; throw new Error('auth'); }
        return { ok: r.ok, j: j };
      });
    });
  }
  function flash(el, ok, text) {
    el.textContent = text;
    el.className = 'form-msg ' + (ok ? 'ok' : 'err');
    if (ok) setTimeout(function () { el.className = 'form-msg'; }, 2500);
  }

  function renderStats() {
    $('dash-stats').innerHTML = '';
    var stats = [
      ['Profile views', me.views], ['QR scans', me.scans], ['Link clicks', me.clicks],
      ['Your page', '@' + me.handle],
    ];
    stats.forEach(function (s) {
      var c = document.createElement('span');
      c.className = 'chip';
      var b = document.createElement('b');
      b.textContent = s[1];
      c.appendChild(b);
      c.appendChild(document.createTextNode(' ' + s[0]));
      $('dash-stats').appendChild(c);
    });
  }

  function renderProfile() {
    $('p-name').value = me.name;
    $('p-category').value = me.category;
    $('p-bio').value = me.bio || '';
    $('p-location').value = me.location || '';
    $('p-tags').value = me.tags || '';
    var sw = $('p-swatches');
    sw.innerHTML = '';
    ACCENTS.forEach(function (color, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (i === me.accent ? ' on' : '');
      b.style.background = color;
      b.setAttribute('aria-label', 'Accent ' + (i + 1));
      b.addEventListener('click', function () {
        me.accent = i;
        // only retint the swatches — rewriting the text inputs from `me`
        // would wipe unsaved name/district/bio edits
        Array.prototype.forEach.call(sw.children, function (el, j) {
          el.classList.toggle('on', j === i);
        });
      });
      sw.appendChild(b);
    });
  }

  function renderLinks() {
    var list = $('links-list');
    list.innerHTML = '';
    if (!me.links.length) {
      list.innerHTML = '<p class="hint">No links yet — add your shop, socials or booking page below.</p>';
      return;
    }
    me.links.forEach(function (l, idx) {
      var row = document.createElement('div');
      row.className = 'link-row';
      row.innerHTML = '<span class="lbl"></span><span class="url"></span><span class="clicks"></span>';
      row.querySelector('.lbl').textContent = l.label;
      row.querySelector('.url').textContent = l.url;
      row.querySelector('.clicks').textContent = l.clicks + ' clicks';
      var mk = function (txt, title, fn) {
        var b = document.createElement('button');
        b.className = 'icon-btn'; b.type = 'button'; b.textContent = txt; b.title = title;
        b.addEventListener('click', fn);
        row.appendChild(b);
      };
      mk('↑', 'Move up', function () { move(idx, -1); });
      mk('↓', 'Move down', function () { move(idx, 1); });
      mk('✎', 'Edit', function () { editLink(row, l); });
      mk('✕', 'Delete', function () {
        if (!confirm('Delete "' + l.label + '"?')) return;
        api('DELETE', '/api/me/links/' + l.id).then(load);
      });
      list.appendChild(row);
    });
  }

  function editLink(row, l) {
    row.innerHTML = '';
    var lab = document.createElement('input'); lab.type = 'text'; lab.value = l.label; lab.maxLength = 40; lab.style.flex = '0 0 32%';
    var url = document.createElement('input'); url.type = 'url'; url.value = l.url; url.maxLength = 300;
    var save = document.createElement('button'); save.className = 'btn primary sm'; save.type = 'button'; save.textContent = 'Save';
    var cancel = document.createElement('button'); cancel.className = 'btn ghost sm'; cancel.type = 'button'; cancel.textContent = 'Cancel';
    save.addEventListener('click', function () {
      api('PUT', '/api/me/links/' + l.id, { label: lab.value.trim(), url: url.value.trim() }).then(function (res) {
        if (res.ok) load(); else flash($('links-msg'), false, res.j.message || 'Check the link fields.');
      });
    });
    cancel.addEventListener('click', renderLinks);
    row.append(lab, url, save, cancel);
  }

  function move(idx, delta) {
    var to = idx + delta;
    if (to < 0 || to >= me.links.length) return;
    var ids = me.links.map(function (l) { return l.id; });
    var tmp = ids[idx]; ids[idx] = ids[to]; ids[to] = tmp;
    api('POST', '/api/me/links/reorder', { ids: ids }).then(load);
  }

  function renderQr() {
    $('my-qr').src = '/@' + me.handle + '/qr.svg';
    $('qr-svg').href = '/@' + me.handle + '/qr.svg';
    $('qr-svg').setAttribute('download', 'pasar-' + me.handle + '-qr.svg');
    $('view-profile').href = '/@' + me.handle;
    $('view-world').href = '/world?focus=' + me.handle;
  }

  function load() {
    api('GET', '/api/me').then(function (res) {
      if (!res.ok) return;
      me = res.j;
      renderStats(); renderProfile(); renderLinks(); renderQr();
    });
  }

  $('p-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('PUT', '/api/me', {
      name: $('p-name').value.trim(),
      category: $('p-category').value,
      bio: $('p-bio').value.trim(),
      location: $('p-location').value.trim(),
      tags: $('p-tags').value.trim(),
      accent: me.accent,
    }).then(function (res) {
      flash($('p-msg'), res.ok, res.ok ? 'Saved. Your building is updated.' : (res.j.message || 'Could not save.'));
      if (res.ok) load();
    });
  });

  $('link-add').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('POST', '/api/me/links', { label: $('a-label').value.trim(), url: $('a-url').value.trim() })
      .then(function (res) {
        if (res.ok) { $('a-label').value = ''; $('a-url').value = ''; load(); }
        else flash($('links-msg'), false, res.j.message || 'Check the link fields.');
      });
  });

  $('pw-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('POST', '/api/me/password', { current: $('w-cur').value, next: $('w-new').value })
      .then(function (res) {
        flash($('w-msg'), res.ok, res.ok ? 'Password changed.' : (res.j.message || 'Could not change password.'));
        if (res.ok) { $('w-cur').value = ''; $('w-new').value = ''; }
      });
  });

  $('qr-png').addEventListener('click', function () {
    fetch('/@' + me.handle + '/qr.svg').then(function (r) { return r.text(); }).then(function (svg) {
      var blob = new Blob([svg], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = 1600; c.height = 1600;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1600, 1600);
        ctx.drawImage(img, 0, 0, 1600, 1600);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'pasar-' + me.handle + '-qr.png';
          document.body.appendChild(a); a.click(); a.remove();
        }, 'image/png');
      };
      img.src = url;
    });
  });

  $('logout').addEventListener('click', function () {
    api('POST', '/api/logout').then(function () { location.href = '/'; });
  });
  $('delete-me').addEventListener('click', function () {
    var typed = prompt('This permanently removes your plot, links and QR. Type your handle (' + me.handle + ') to confirm:');
    if (typed !== me.handle) return;
    api('DELETE', '/api/me').then(function () { location.href = '/'; });
  });

  load();
})();
