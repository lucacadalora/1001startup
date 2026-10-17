'use strict';
/* 1001startup.id/data-center stays hidden until Luca's go: the routes 404 and the
   Census menu leaves the entry out unless data/datacenter.live exists (going live =
   create that file; no restart needed once the code is loaded) or DC_PREVIEW=1 is set
   on a test port. Checked at most once every 10 s. */
const fs = require('fs');
const path = require('path');
const FLAG = path.join(__dirname, '..', 'data', 'datacenter.live');
let last = 0;
let on = false;
function dcLive() {
  if (process.env.DC_PREVIEW === '1') return true;
  const now = Date.now();
  if (now - last > 10000) { last = now; on = fs.existsSync(FLAG); }
  return on;
}
module.exports = { dcLive };
