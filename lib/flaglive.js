'use strict';
/* On/off switches for 1001startup.id additions that wait for Luca's go, the same
   mechanism as lib/dclive.js and lib/homelive.js: a feature shows only while
   data/<file> exists (checked at most once every 10 s, so switching needs no
   restart once the code is loaded), or when its PREVIEW variable is 1 on a test port. */
const fs = require('fs');
const path = require('path');

function liveFlag(file, envVar) {
  const FLAG = path.join(__dirname, '..', 'data', file);
  let last = 0;
  let on = false;
  return function live() {
    if (process.env[envVar] === '1') return true;
    const now = Date.now();
    if (now - last > 10000) { last = now; on = fs.existsSync(FLAG); }
    return on;
  };
}

module.exports = { liveFlag };
