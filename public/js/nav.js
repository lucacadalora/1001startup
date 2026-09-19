(function () {
  'use strict';
  var burger = document.getElementById('nav-burger');
  var sheet = document.getElementById('nav-sheet');
  if (!burger || !sheet) return;
  burger.addEventListener('click', function (ev) {
    ev.stopPropagation();
    var open = sheet.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (sheet.classList.contains('open') && !sheet.contains(e.target)) {
      sheet.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();
