import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.UNDERSTUDY_DB || path.join(root, "data", "understudy.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, value TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, value TEXT NOT NULL, started_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL, undone_at TEXT);
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, event TEXT NOT NULL, detail TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS recordings (id TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL);
`);

const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };

export const store = {
  kind: "sqlite",
  path: dbPath,
  loadState() {
    const row = db.prepare("SELECT value FROM app_state WHERE id = 1").get();
    return row ? parse(row.value, null) : null;
  },
  saveState(value) {
    db.prepare("INSERT INTO app_state(id, value, updated_at) VALUES(1, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(value), now());
  },
  saveSkill(card, approved = false) {
    const serialized = JSON.stringify(card);
    const existing = db.prepare("SELECT value, approved FROM skills WHERE id=?").get(card.id);
    const keepApproval = existing && existing.value === serialized ? Boolean(existing.approved) : approved;
    db.prepare("INSERT INTO skills(id, value, approved, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, approved=excluded.approved, updated_at=excluded.updated_at").run(card.id, serialized, keepApproval ? 1 : 0, now());
    return { card, approved: this.isApproved(card.id) };
  },
  getSkill(id) {
    const row = db.prepare("SELECT value, approved FROM skills WHERE id = ?").get(id);
    return row ? { card: parse(row.value, null), approved: Boolean(row.approved) } : null;
  },
  listSkills() {
    return db.prepare("SELECT value, approved FROM skills ORDER BY updated_at DESC").all().map((row) => ({ card: parse(row.value, null), approved: Boolean(row.approved) })).filter((item) => item.card);
  },
  approveSkill(id) {
    const result = db.prepare("UPDATE skills SET approved=1, updated_at=? WHERE id=?").run(now(), id);
    return Number(result.changes) > 0;
  },
  isApproved(id) { return Boolean(db.prepare("SELECT approved FROM skills WHERE id=?").get(id)?.approved); },
  saveRun(run) {
    const id = run.id || `${run.startedAt || now()}-${Math.random().toString(36).slice(2, 8)}`;
    const value = { ...run, id };
    db.prepare("INSERT INTO runs(id, value, started_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(id, JSON.stringify(value), value.startedAt || now());
    return value;
  },
  listRuns() { return db.prepare("SELECT value FROM runs ORDER BY started_at DESC").all().map((row) => parse(row.value, null)).filter(Boolean); },
  clearRuns() { db.prepare("DELETE FROM runs").run(); },
  saveSnapshot(snapshot) {
    const id = snapshot.id || `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const value = { ...snapshot, id };
    db.prepare("INSERT INTO snapshots(id, value, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(id, JSON.stringify(value), now());
    return value;
  },
  markSnapshotUndone(id) { if (id) db.prepare("UPDATE snapshots SET undone_at=? WHERE id=?").run(now(), id); },
  saveRecording(recording) {
    db.prepare("INSERT INTO recordings(id, value, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(recording.id, JSON.stringify(recording), recording.createdAt || now());
    return recording;
  },
  audit(event, detail = {}) {
    db.prepare("INSERT INTO audit_log(at, event, detail) VALUES(?, ?, ?)").run(now(), event, JSON.stringify(detail));
  },
  listAudit(limit = 100) { return db.prepare("SELECT at, event, detail FROM audit_log ORDER BY id DESC LIMIT ?").all(limit).map((r) => ({ at: r.at, event: r.event, detail: parse(r.detail, {}) })).reverse(); },
  close() { db.close(); },
};

