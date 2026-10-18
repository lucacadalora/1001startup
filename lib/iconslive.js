'use strict';
/* The exporter sector icons on the front page (Luca, 18 Oct 2026: "generate
   other style like svg/icon"): one-colour pictograms in each sector's colour,
   real SVG, in place of the clay sprites in the 04 Exporters card and the
   logo wall. Shown only while data/sector-icons.live exists (or
   SECTOR_ICONS_PREVIEW=1 on a test port); remove the file and the clay
   sprites are back within 10 s, no restart. Same mechanism as lib/dclive.js. */
const fs = require('fs');
const path = require('path');
const FLAG = path.join(__dirname, '..', 'data', 'sector-icons.live');
let last = 0;
let on = false;
function iconsLive() {
  if (process.env.SECTOR_ICONS_PREVIEW === '1') return true;
  const now = Date.now();
  if (now - last > 10000) { last = now; on = fs.existsSync(FLAG); }
  return on;
}
module.exports = { iconsLive };
