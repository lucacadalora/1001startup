#!/usr/bin/env node
'use strict';
// Gives Ask 1001 (the data chat on 1001startup.id/me, lib/ask1001.js) its own aisurplus key: ONE key that opens
// only deepseek-v4.1-flash-1017, with a weekly spend cap on the key itself.
//
// DeepSeek on aisurplus is ours only: portal/lib/keys.js OURS_ONLY_OWNERS lists the accounts whose keys may carry a
// deepseek id (Luca, 12 Oct 2026). A new service account is not on that list (its key got 'model-not-available'),
// so the key is minted on Luca's covered admin account e39be92eb6f1, the account the runbooks use for our own keys.
// Re-running finds the same live key and never mints a second one.
//
// Run it FROM THE LIVE RELEASE so no unreleased migration touches live data:
//   node scripts/provision-ask1001.cjs "$(systemctl show router-portal -p WorkingDirectory --value)" ~/.openclaw/secrets/aisurplus-1001-ask.key
// Prints ids only; the key's plaintext goes straight into <out-key-file> (mode 600).
// Undo: `node portal/cli.js keys revoke <key_id>` from the live release (or revoke it on aisurplus /admin).
const fs = require('fs');
const path = require('path');

const [release, outFile] = process.argv.slice(2);
if (!release || !outFile) { console.error('usage: provision-ask1001.cjs <live release dir> <out key file>'); process.exit(2); }
const OWNER = 'e39be92eb6f1';           // Luca's covered admin account (an OURS_ONLY owner)
const MODEL = 'deepseek-v4.1-flash-1017';
const KEY_NAME = '1001startup.id Ask';
const WEEKLY_CAP_MICRO = 5_000_000;    // $5 a week on the key; the app also stops itself at $1 a day (lib/ask1001.js)
/* the first try (18 Oct 2026): a service account outside OURS_ONLY_OWNERS; its key could not reach DeepSeek */
const RETIRED_USER = 'd500b57e5442';
const RETIRED_KEY = 'b5898149e253';

process.loadEnvFile(path.join(release, '.env.portal'));
const app = require(path.join(release, 'portal/server')).boot({ PORTAL_POLL: '0', ALLOWANCE_ENABLED: '0', PORTAL_BOOT_ASSERT: 'warn', log: () => {} });
(async () => {
  try {
    const old = app.keys.byId(RETIRED_KEY);
    if (old && !old.revoked_at) await app.keys.revoke(old, { actor: 'operator' });
    const covered = require(path.join(release, 'portal/lib/covered')).init({ db: app.store, ledger: app.ledger, log: () => {} });
    try { covered.revoke(RETIRED_USER, { actor: 'operator' }); } catch { /* already without a cover */ }

    const live = app.keys.listForUser(OWNER).filter(k => !k.revoked_at);
    let key = live.find(k => k.is_active && k.name === KEY_NAME && (!k.expires_at || Date.parse(k.expires_at) > Date.now()));
    let minted = false;
    if (!key) {
      const r = await app.keys.mint(OWNER, { name: KEY_NAME, scope: 'public', allowed_models: [MODEL], weekly_cap_micro: WEEKLY_CAP_MICRO, expires_days: 180 });
      fs.writeFileSync(outFile, r.plaintext, { mode: 0o600 });
      key = r.key; minted = true;
    } else if (!fs.existsSync(outFile)) {
      throw new Error(`a live key ${key.id} exists but ${outFile} is missing: revoke it and run again`);
    }
    console.log(JSON.stringify({ owner: OWNER, key_id: key.id, model: MODEL, weekly_cap_usd: WEEKLY_CAP_MICRO / 1e6, minted, owner_live_keys: live.length + (minted ? 1 : 0), retired_key: RETIRED_KEY }));
  } finally { await app.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
