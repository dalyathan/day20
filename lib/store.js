// Small SQLite store (Node's built-in node:sqlite). What we keep, and nothing more:
// the session, the buyer's own answers about tracking, the result of each email
// check, and reminders she asked for. "Disconnect" deletes all of it.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || join(dir, "day20.sqlite"));

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS facts (owner TEXT, dispute_id TEXT, data TEXT NOT NULL, PRIMARY KEY (owner, dispute_id));
CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY, owner TEXT, dispute_id TEXT, at TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (owner TEXT, endpoint TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, owner TEXT, dispute_id TEXT, at TEXT, title TEXT, channel TEXT, email TEXT, sent_at TEXT);
`);

const j = (s) => (s ? JSON.parse(s) : null);

export const sessions = {
  get: (sid) => j(db.prepare("SELECT data FROM sessions WHERE sid = ?").get(sid)?.data),
  set: (sid, data) => db.prepare("INSERT INTO sessions (sid, data, created) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET data = excluded.data").run(sid, JSON.stringify(data), Date.now()),
  del: (sid) => db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid),
};

export const facts = {
  get: (owner, id) => j(db.prepare("SELECT data FROM facts WHERE owner = ? AND dispute_id = ?").get(owner, id)?.data) || {},
  set: (owner, id, data) => db.prepare("INSERT INTO facts VALUES (?, ?, ?) ON CONFLICT(owner, dispute_id) DO UPDATE SET data = excluded.data").run(owner, id, JSON.stringify(data)),
};

export const checks = {
  add: (owner, id, at, data) => { const cid = randomUUID(); db.prepare("INSERT INTO checks VALUES (?, ?, ?, ?, ?)").run(cid, owner, id, at, JSON.stringify(data)); return cid; },
  list: (owner, id) => db.prepare("SELECT at, data FROM checks WHERE owner = ? AND dispute_id = ? ORDER BY at").all(owner, id).map((r) => ({ at: r.at, ...j(r.data) })),
  markLastReported: (owner, id) => {
    const row = db.prepare("SELECT id, data FROM checks WHERE owner = ? AND dispute_id = ? ORDER BY at DESC LIMIT 1").get(owner, id);
    if (row) db.prepare("UPDATE checks SET data = ? WHERE id = ?").run(JSON.stringify({ ...j(row.data), reported: true }), row.id);
  },
};

export const push = {
  add: (owner, sub) => db.prepare("INSERT INTO push_subs VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET owner = excluded.owner, data = excluded.data").run(owner, sub.endpoint, JSON.stringify(sub)),
  forOwner: (owner) => db.prepare("SELECT data FROM push_subs WHERE owner = ?").all(owner).map((r) => j(r.data)),
  remove: (endpoint) => db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint),
};

export const reminders = {
  replace: (owner, id, list) => {
    db.prepare("DELETE FROM reminders WHERE owner = ? AND dispute_id = ? AND sent_at IS NULL").run(owner, id);
    const ins = db.prepare("INSERT INTO reminders VALUES (?, ?, ?, ?, ?, ?, ?, NULL)");
    for (const r of list) ins.run(randomUUID(), owner, id, r.at, r.title, r.channel, r.email || null);
  },
  list: (owner, id) => db.prepare("SELECT at, title, channel, email, sent_at FROM reminders WHERE owner = ? AND dispute_id = ? ORDER BY at").all(owner, id),
  due: (nowIso) => db.prepare("SELECT * FROM reminders WHERE sent_at IS NULL AND at <= ? LIMIT 50").all(nowIso),
  markSent: (rid, at) => db.prepare("UPDATE reminders SET sent_at = ? WHERE id = ?").run(at, rid),
};

// The kill switch: everything Day 20 holds about this owner, gone.
export function forget(owner, payerId = null) {
  for (const t of ["facts", "checks", "push_subs", "reminders"]) db.prepare(`DELETE FROM ${t} WHERE owner = ?`).run(owner);
  if (payerId) db.prepare("DELETE FROM sessions WHERE json_extract(data, '$.payerId') = ?").run(payerId); // her other devices too
}

// Retention: demo data is deleted after 7 days; idle signed-in sessions after 60.
export function cleanup(now = Date.now()) {
  const week = now - 7 * 86400000, sixty = now - 60 * 86400000;
  const oldDemo = db.prepare("SELECT sid FROM sessions WHERE created < ? AND json_extract(data, '$.demo') = 1").all(week).map((r) => r.sid);
  for (const sid of oldDemo) forget(`demo:${sid}`);
  db.prepare("DELETE FROM sessions WHERE (created < ? AND json_extract(data, '$.demo') = 1) OR created < ?").run(week, sixty);
}
