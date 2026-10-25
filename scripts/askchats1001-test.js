#!/usr/bin/env node
'use strict';
/* Tests for lib/askchats1001.js (Ask 1001 chat history), offline: an in-memory
 * database and a temp switch file. Exits 1 on any failure.
 *
 *   node scripts/askchats1001-test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

let fails = 0;
let passes = 0;
function ok(cond, what) {
  if (cond) { passes++; console.log('  ok  ', what); } else { fails++; console.log('  FAIL', what); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'askchats1001-'));
const FLAG = path.join(tmp, 'askhistory.live');
process.env.ASKHISTORY_FILE_1001 = FLAG;
const createChats = require('../lib/askchats1001');

console.log('\nswitch');
let C = createChats({ db: new Database(':memory:'), root: tmp });
ok(!C.allowed(2), 'no data/askhistory.live: nobody keeps history');
fs.writeFileSync(FLAG, '# Luca\n2\n');
C = createChats({ db: new Database(':memory:'), root: tmp });
ok(C.allowed(2) && !C.allowed(3), 'ids listed: only those accounts');
fs.writeFileSync(FLAG, 'all\n');
const db = new Database(':memory:');
C = createChats({ db, root: tmp });
ok(C.allowed(2) && C.allowed(3), '"all": every account');

console.log('\nchats');
const turn = (q) => ({ q, sc: 'people', a: 'Answer to ' + q, ents: [{ k: 'company', r: 'xendit', n: 'Xendit', h: '/company/xendit', s: 'x' }], asof: '2026-10-24', ms: 1234 });
const a = C.add(2, null, turn('Who runs partnerships at Xendit?'));
ok(a > 0, 'first answer starts a chat');
ok(C.add(2, a, turn('Get the email for Frisky')) === a, 'the next answer joins the open chat');
const b = C.add(3, a, turn('Not mine'));
ok(b > 0 && b !== a && C.get(2, a).turns.length === 2, 'another account cannot write into it: a new chat of its own');
ok(C.get(3, a) === null && C.get(2, b) === null, 'nor read it');
const g = C.get(2, a);
ok(g.title === 'Who runs partnerships at Xendit?' && g.turns[1].q === 'Get the email for Frisky' && g.turns[0].ents[0].h === '/company/xendit', 'turns kept in order, with their links');
const c = C.add(2, null, turn('C-level at Blibli'));
db.prepare("UPDATE ask_chats SET updated_at = datetime('now', '-1 hour') WHERE id = ?").run(a);
const L = C.list(2);
ok(L.length === 2 && L[0].id === c && L[1].n === 2, 'list: newest first, with how many questions');
ok(C.add(2, null, { q: '', a: 'x' }) === null && C.add(2, null, { q: 'x', a: '' }) === null, 'an empty question or answer is not saved');
ok(C.remove(3, a) === false && C.get(2, a), 'another account cannot delete it');
ok(C.remove(2, a) === true && C.get(2, a) === null && C.list(2).length === 1, 'deleted');
let id = C.add(2, null, turn('long'));
for (let i = 0; i < 49; i++) C.add(2, id, turn('more ' + i));
ok(C.get(2, id).turns.length === 50 && C.add(2, id, turn('one more')) !== id, 'a chat of 50 answers starts a new one');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
