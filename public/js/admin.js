(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null;

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }

  function districtName(key) {
    var d = data.districts.find(function (x) { return x.key === key; });
    return d ? d.name : key;
  }

  function renderStats() {
    var st = data.stats;
    $('adm-stats').innerHTML = '';
    [['Active merchants', st.merchants], ['Total scans', st.scans], ['Total views', st.views]].forEach(function (s) {
      var c = document.createElement('span');
      c.className = 'chip';
      var b = document.createElement('b'); b.textContent = s[1];
      c.appendChild(b); c.appendChild(document.createTextNode(' ' + s[0]));
      $('adm-stats').appendChild(c);
    });
  }

  function renderTable() {
    var q = $('adm-q').value.trim().toLowerCase();
    var rows = data.merchants.filter(function (m) {
      return !q || m.handle.includes(q) || m.name.toLowerCase().includes(q) ||
        m.category.includes(q) || districtName(m.category).toLowerCase().includes(q);
    });
    var t = $('adm-table');
    t.innerHTML = '<tr><th>Merchant</th><th>District</th><th>Links</th><th>Views</th><th>Scans</th><th>Status</th><th>Joined</th><th></th></tr>';
    rows.forEach(function (m) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var a = document.createElement('a');
      a.href = '/@' + m.handle; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = m.name;
      td1.appendChild(a);
      td1.appendChild(document.createElement('br'));
      var small = document.createElement('span');
      small.className = 'mono'; small.textContent = '@' + m.handle;
      td1.appendChild(small);
      tr.appendChild(td1);
      var mk = function (txt, cls) {
        var td = document.createElement('td');
        if (cls) td.className = cls;
        td.textContent = txt;
        tr.appendChild(td);
        return td;
      };
      mk(districtName(m.category));
      mk(m.links); mk(m.views); mk(m.scans);
      var tds = document.createElement('td');
      var pill = document.createElement('span');
      pill.className = 'pill ' + m.status;
      pill.textContent = m.status;
      tds.appendChild(pill);
      if (m.featured) {
        var f = document.createElement('span');
        f.className = 'pill featured'; f.textContent = 'featured'; f.style.marginLeft = '6px';
        tds.appendChild(f);
      }
      tr.appendChild(tds);
      mk(m.created_at.slice(0, 10), 'mono');
      var act = document.createElement('td');
      var btn = function (label, fn) {
        var b = document.createElement('button');
        b.className = 'icon-btn'; b.style.width = 'auto'; b.style.padding = '0 8px'; b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', fn);
        act.appendChild(b);
        act.appendChild(document.createTextNode(' '));
      };
      btn(m.status === 'active' ? 'Hide' : 'Show', function () {
        api('POST', '/api/admin/merchants/' + m.id, { status: m.status === 'active' ? 'hidden' : 'active' }).then(load);
      });
      btn(m.featured ? 'Unfeature' : 'Feature', function () {
        api('POST', '/api/admin/merchants/' + m.id, { featured: !m.featured }).then(load);
      });
      btn('Delete', function () {
        if (!confirm('Permanently delete @' + m.handle + '? This cannot be undone.')) return;
        api('DELETE', '/api/admin/merchants/' + m.id).then(load);
      });
      tr.appendChild(act);
      t.appendChild(tr);
    });
  }

  function load() {
    api('GET', '/api/admin/overview').then(function (res) {
      if (res.status === 401) {
        $('adm-login-card').style.display = '';
        $('adm-app').style.display = 'none';
        return;
      }
      data = res.j;
      $('adm-login-card').style.display = 'none';
      $('adm-app').style.display = '';
      renderStats(); renderTable();
    });
  }

  $('adm-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('POST', '/api/admin/login', { key: $('adm-key').value }).then(function (res) {
      if (res.ok) { load(); return; }
      var m = $('adm-msg');
      m.textContent = res.j.message || 'Wrong key.';
      m.className = 'form-msg err';
    });
  });
  $('adm-q').addEventListener('input', renderTable);

  load();
})();
