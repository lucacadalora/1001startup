'use strict';
/* /model page: chart hover tooltips + mermaid-source copy button.
 * Lives here (not inline) because the site CSP is script-src 'self'. */
(function () {
  var tip = document.getElementById('tip');
  if (tip) {
    Array.prototype.forEach.call(document.querySelectorAll('.hv'), function (g) {
      g.addEventListener('mousemove', function (e) {
        tip.textContent = g.getAttribute('data-tip');
        tip.style.opacity = 1;
        tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 290) + 'px';
        tip.style.top = (e.clientY + 16) + 'px';
      });
      g.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
    });
  }
  /* language of the server-rendered page; the restored label must match the
     label the view rendered into the button (L('Copy source','Salin sumber')) */
  var id = document.documentElement.lang === 'id';
  var btn = document.getElementById('copymm');
  if (btn) btn.addEventListener('click', function () {
    var t = document.getElementById('mmsrc').textContent;
    navigator.clipboard.writeText(t).then(function () {
      btn.textContent = id ? 'Tersalin' : 'Copied';
      setTimeout(function () { btn.textContent = id ? 'Salin sumber' : 'Copy source'; }, 1600);
    }).catch(function () { btn.textContent = id ? 'Pilih teks + salin manual' : 'Select + copy manually'; });
  });
})();
