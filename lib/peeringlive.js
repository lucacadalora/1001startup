'use strict';
/* 1001startup.id/peering stays hidden until Luca's go: the routes 404 and the
   Datasets menu leaves the entry out unless data/peering.live exists (going live =
   create that file; no restart needed once the code is loaded) or PEERING_PREVIEW=1
   is set on a test port. Checked at most once every 10 s. */
const fs = require('fs');
const path = require('path');
const FLAG = path.join(__dirname, '..', 'data', 'peering.live');
let last = 0;
let on = false;
function peeringLive() {
  if (process.env.PEERING_PREVIEW === '1') return true;
  const now = Date.now();
  if (now - last > 10000) { last = now; on = fs.existsSync(FLAG); }
  return on;
}
/* The ISP reach panel on the place card (Luca, 18 Oct 2026: "put the ISP reach panel live
   on dc.1001startup.id with its caveats"): on while data/peering-reach.json exists
   (scripts/peering-reach-build.py writes it; removing it hides the panel, no restart),
   or with PEERING_REACH=1 on a test port. Checked at most once every 10 s. */
const REACH = path.join(__dirname, '..', 'data', 'peering-reach.json');
let rlast = 0;
let ron = false;
function reachLive() {
  if (process.env.PEERING_REACH === '1') return true;
  const now = Date.now();
  if (now - rlast > 10000) { rlast = now; ron = fs.existsSync(REACH); }
  return ron;
}
module.exports = { peeringLive, reachLive };
