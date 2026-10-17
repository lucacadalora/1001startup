'use strict';
/* The four-dataset front page of 1001startup.id stays dark until Luca's go
   (18 Oct 2026). One switch carries the whole change, so one file undoes it:
   while data/home.live exists, / is the new front page, the startup table sits
   at /startups, the header gets the Datasets menu (and its one-row phone
   header), the exporter census answers at /umkm and umkm.vantis.sh forwards
   there. Remove the file and every one of those goes back within 10 s, no
   restart. HOME_PREVIEW=1 turns it on for a test port only. Same mechanism as
   lib/dclive.js. */
const fs = require('fs');
const path = require('path');
const FLAG = path.join(__dirname, '..', 'data', 'home.live');
let last = 0;
let on = false;
function homeLive() {
  if (process.env.HOME_PREVIEW === '1') return true;
  const now = Date.now();
  if (now - last > 10000) { last = now; on = fs.existsSync(FLAG); }
  return on;
}
module.exports = { homeLive };
