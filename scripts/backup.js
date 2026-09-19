'use strict';
/* Nightly SQLite backup with 14-day retention. Cron: 02:45 WIB daily. */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const OUT_DIR = path.join(process.env.HOME, 'backups', 'pasar');
fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const dest = path.join(OUT_DIR, `pasar-${stamp}.db`);
const db = new Database(path.join(__dirname, '..', 'data', 'pasar.db'), { readonly: true });

db.backup(dest).then(() => {
  db.close();
  /* No salt scrubbing needed: visitor salts live in their own file
     (data/px-salt.db, 0600) which this job deliberately does not copy, so a
     backup can never pair a salt with the hashes it would reverse. Note that
     DELETE would not have been enough anyway — SQLite leaves the freed bytes
     in the file until a VACUUM rewrites it. */
  const cutoff = Date.now() - 14 * 86400e3;
  for (const f of fs.readdirSync(OUT_DIR)) {
    const p = path.join(OUT_DIR, f);
    if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
  }
  console.log(`backup ok: ${dest}`);
}).catch((e) => { console.error(e); process.exit(1); });
