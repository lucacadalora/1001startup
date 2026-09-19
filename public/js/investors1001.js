'use strict';
/* /investors index: live search over the server-rendered table, and row-click
 * navigation on both investor pages. CSP is script-src 'self', so this lives
 * here and never inline. */
(function () {
  var q = document.getElementById('q');
  var count = document.getElementById('count');
  var table = document.getElementById('inv');
  if (q && table) {
    var IDL = document.documentElement.lang === 'id';
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    var total = rows.length;
    q.addEventListener('input', function () {
      var t = q.value.trim().toLowerCase();
      var shown = 0;
      for (var i = 0; i < rows.length; i++) {
        var hit = !t || (rows[i].getAttribute('data-n') || '').indexOf(t) !== -1;
        rows[i].style.display = hit ? '' : 'none';
        if (hit) shown++;
      }
      if (count) count.textContent = (t ? shown + (IDL ? ' dari ' : ' of ') + total : total) + (IDL ? ' investor' : ' investors');
    });
  }
  /* whole row is a target, but only when the click was not on a real link —
   * ctrl/cmd-click and middle-click keep working through the anchor itself */
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (ev.target.closest('a')) return;
    var tr = ev.target.closest('tr.rowlink');
    if (tr && tr.getAttribute('data-href')) location.href = tr.getAttribute('data-href');
  });
})();
