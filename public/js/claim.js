(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var handle = $('c-handle'), echo = $('c-handle-echo'), herr = $('c-handle-err'), msg = $('c-msg');
  var timer = null;

  // arriving from the hero claim bar: prefill and check the chosen handle
  var pre = new URLSearchParams(location.search).get('handle');
  if (pre) {
    handle.value = pre.toLowerCase().slice(0, 30);
    setTimeout(function () { handle.dispatchEvent(new Event('input')); }, 50);
  }

  handle.addEventListener('input', function () {
    var v = handle.value.trim().toLowerCase();
    handle.value = v;
    echo.textContent = v || 'your-shop';
    herr.style.display = 'none';
    clearTimeout(timer);
    if (v.length < 3) return;
    timer = setTimeout(function () {
      fetch('/api/handle/' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
        if (j.available === false) {
          herr.textContent = j.reason === 'invalid'
            ? 'Handles are 3–30 lowercase letters, numbers or hyphens.'
            : '@' + v + ' is already claimed.';
          herr.style.display = 'block';
        }
      }).catch(function () {});
    }, 350);
  });

  $('claim-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    msg.className = 'form-msg';
    var body = {
      handle: handle.value.trim().toLowerCase(),
      name: $('c-name').value.trim(),
      category: $('c-category').value,
      bio: $('c-bio').value.trim(),
      password: $('c-pass').value,
    };
    var label = $('c-link-label').value.trim(), url = $('c-link-url').value.trim();
    if (label || url) body.link = { label: label, url: url };
    fetch('/api/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { location.href = '/dashboard'; return; }
        msg.textContent = res.j.message || 'Something went wrong — check the fields and try again.';
        msg.className = 'form-msg err';
      })
      .catch(function () {
        msg.textContent = 'Network hiccup — try again.';
        msg.className = 'form-msg err';
      });
  });
})();
