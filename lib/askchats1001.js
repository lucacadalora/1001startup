'use strict';
/**
 * 1001startup.id — Ask 1001 chat history (Luca, 26 Oct 2026: "need chat
 * history"). Each answered question is saved to the reader's own account as a
 * turn of a chat; /me lists the chats and reopens any of them. Only the
 * reader sees their chats, and a chat can be deleted.
 *
 *   const chats = require('./lib/askchats1001')({ db });
 *   chats.allowed(userId)              -> true while data/askhistory.live lets this account keep history
 *   chats.list(userId)                 -> [{ id, title, n, sc, at }] newest first
 *   chats.get(userId, id)              -> { id, title, turns: [{ q, sc, a, ents, asof, ms, at }] } | null
 *   chats.add(userId, chatId, turn)    -> the chat id the turn went to (a new chat when chatId is not theirs)
 *   chats.remove(userId, id)           -> true when it was theirs and is gone
 *
 * Switch: data/askhistory.live holds `all` or account ids, one per line (#
 * for a note). Without the file nobody keeps history and /me is the chat it
 * was (answers kept in the tab only), within 10 s, no restart. ask_log, the
 * anonymous log of questions, is unchanged either way.
 */
const fs = require('fs');
const path = require('path');

const TURNS_MAX = 50;     // a chat that long starts a new one
const CHATS_MAX = 300;    // per account; the oldest go first
const LIST_MAX = 60;

const str = (v) => (v === undefined || v === null ? '' : String(v));
const clip = (s, n) => { const t = str(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

module.exports = function createChats({ db, root = path.join(__dirname, '..') } = {}) {
  db.exec(`
CREATE TABLE IF NOT EXISTS ask_chats (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  sc TEXT,
  turns TEXT NOT NULL DEFAULT '[]',
  n INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ask_chats_user ON ask_chats(user_id, updated_at);
`);
  const Q = {
    list: db.prepare(`SELECT id, title, n, sc, updated_at AS at FROM ask_chats WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ${LIST_MAX}`),
    get: db.prepare(`SELECT id, title, turns, n FROM ask_chats WHERE user_id = ? AND id = ?`),
    make: db.prepare(`INSERT INTO ask_chats (user_id, title, sc, turns, n) VALUES (?, ?, ?, ?, 1)`),
    put: db.prepare(`UPDATE ask_chats SET turns = ?, n = ?, sc = COALESCE(?, sc), updated_at = datetime('now') WHERE id = ? AND user_id = ?`),
    drop: db.prepare(`DELETE FROM ask_chats WHERE user_id = ? AND id = ?`),
    trim: db.prepare(`DELETE FROM ask_chats WHERE user_id = ? AND id NOT IN (SELECT id FROM ask_chats WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ${CHATS_MAX})`),
  };

  /* who keeps history: data/askhistory.live, re-read at most every 10 s */
  const FLAG = process.env.ASKHISTORY_FILE_1001 || path.join(root, 'data', 'askhistory.live');
  let at = 0;
  let who = { all: false, ids: new Set() };
  function allowed(userId) {
    if (Date.now() - at > 10e3) {
      at = Date.now();
      try {
        const lines = fs.readFileSync(FLAG, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
        who = { all: lines.includes('all'), ids: new Set(lines.filter((l) => /^\d+$/.test(l)).map(Number)) };
      } catch { who = { all: false, ids: new Set() }; }
    }
    return Number.isInteger(userId) && (who.all || who.ids.has(userId));
  }

  /* a turn as it is kept: what the page shows, nothing more */
  function clean(t) {
    const ents = (Array.isArray(t.ents) ? t.ents : []).slice(0, 8).map((e) => ({ k: clip(e.k, 20), r: clip(e.r, 160), n: clip(e.n, 160), h: clip(e.h, 200), s: clip(e.s, 200) }));
    return { q: clip(t.q, 500), sc: clip(t.sc, 20), a: str(t.a).slice(0, 8000), ents, asof: clip(t.asof, 40), ms: Math.max(0, Math.round(+t.ms || 0)), at: new Date().toISOString() };
  }

  function list(userId) {
    try { return Q.list.all(userId); } catch { return []; }
  }
  function get(userId, id) {
    try {
      const r = Q.get.get(userId, +id || 0);
      if (!r) return null;
      let turns = [];
      try { turns = JSON.parse(r.turns); } catch { turns = []; }
      return { id: r.id, title: r.title, turns };
    } catch { return null; }
  }
  function add(userId, chatId, turn) {
    const t = clean(turn || {});
    if (!t.q || !t.a) return null;
    const run = db.transaction(() => {
      const r = chatId ? Q.get.get(userId, +chatId || 0) : null;
      if (r && r.n < TURNS_MAX) {
        let turns = [];
        try { turns = JSON.parse(r.turns); } catch { turns = []; }
        turns.push(t);
        Q.put.run(JSON.stringify(turns), turns.length, t.sc || null, r.id, userId);
        return r.id;
      }
      const id = Q.make.run(userId, clip(t.q, 90), t.sc || null, JSON.stringify([t])).lastInsertRowid;
      Q.trim.run(userId, userId);
      return Number(id);
    });
    try { return run(); } catch { return null; }
  }
  function remove(userId, id) {
    try { return Q.drop.run(userId, +id || 0).changes > 0; } catch { return false; }
  }

  return { allowed, list, get, add, remove };
};
