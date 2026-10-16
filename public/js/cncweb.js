/* CNC + 3D Indonesia — company-web pages: on wide screens, draw curved wires
   from the subject in the middle to every branch label. Phones get the CSS
   tree instead, so nothing here is needed to read the page. Lives in a file
   because the CSP is script-src 'self'. */
(function () {
  'use strict';
  var map = document.getElementById('map'), hub = document.getElementById('hub'), svg = document.getElementById('wires');
  if (!map || !hub || !svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (window.matchMedia('(max-width: 980px)').matches) return;
    var m = map.getBoundingClientRect(), h = hub.getBoundingClientRect();
    var hy = h.top + h.height / 2 - m.top;
    [].forEach.call(map.querySelectorAll('.br .bh b'), function (b) {
      var r = b.getBoundingClientRect();
      var left = r.left + r.width / 2 < h.left + h.width / 2;
      var x1 = left ? h.left - m.left : h.right - m.left;
      var x2 = left ? r.right - m.left + 6 : r.left - m.left - 6;
      var y2 = r.top + r.height / 2 - m.top;
      var mx = (x1 + x2) / 2;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + hy + ' C' + mx + ' ' + hy + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2);
      svg.appendChild(p);
    });
  }
  draw();
  window.addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
