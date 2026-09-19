(function () {
  'use strict';
  var msg = document.getElementById('l-msg');
  document.getElementById('login-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    msg.className = 'form-msg';
    fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: document.getElementById('l-handle').value.trim(),
        password: document.getElementById('l-pass').value,
      }),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { location.href = '/dashboard'; return; }
        msg.textContent = res.j.message || "That handle and password don't match.";
        msg.className = 'form-msg err';
      })
      .catch(function () { msg.textContent = 'Network hiccup — try again.'; msg.className = 'form-msg err'; });
  });
})();
