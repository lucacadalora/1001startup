'use strict';
/* Publish public/data/zones.json from zones-def.json, keeping only zones whose
   fetched data file exists and parses. The map loads this at boot. */
const fs = require('fs');
const path = require('path');
const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'zones-def.json'), 'utf8'));
const ok = [];
for (const z of defs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', `zone-${z.id}.json`), 'utf8'));
    if ((d.buildings || []).length < 3) { console.log(`drop ${z.id}: only ${(d.buildings || []).length} buildings`); continue; }
    ok.push(z);
  } catch { console.log(`drop ${z.id}: no data`); }
}
fs.writeFileSync(path.join(__dirname, '..', 'public', 'data', 'zones.json'), JSON.stringify(ok));
console.log(`zones.json: ${ok.length}/${defs.length} zones published`);
