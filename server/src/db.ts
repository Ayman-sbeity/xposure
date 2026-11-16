// SQLite database (built into Node: no database server to install or run).
// One file, data/xposure.db. Back it up by copying the file (or use Settings > Download backup).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;
export type Row = Record<string, unknown>;

export const now = (): string => new Date().toISOString();

// Each entry runs once, in order. Never edit a released migration: add a new one.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '{}',
    channel TEXT NOT NULL DEFAULT 'form',
    locale TEXT NOT NULL DEFAULT 'en',
    page TEXT NOT NULL DEFAULT '',
    campaign TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX messages_by_status ON messages(status, created_at DESC);
  CREATE TABLE meetings (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT 'questions',
    message TEXT NOT NULL DEFAULT '',
    locale TEXT NOT NULL DEFAULT 'en',
    campaign TEXT NOT NULL DEFAULT '',
    join_url TEXT NOT NULL DEFAULT '',
    zoom_meeting_id TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX meetings_by_start ON meetings(start_at);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE content (
    section TEXT PRIMARY KEY,
    doc TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
  );
  CREATE TABLE content_history (
    id INTEGER PRIMARY KEY,
    section TEXT NOT NULL,
    doc TEXT,
    saved_at TEXT NOT NULL,
    saved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
  );
  CREATE INDEX content_history_by_section ON content_history(section, id DESC);
  CREATE TABLE media (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    file TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    size INTEGER NOT NULL,
    alt TEXT NOT NULL DEFAULT '',
    alt_ar TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
  );
  CREATE TABLE activity (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX activity_by_time ON activity(at DESC);
  `,
];

export function openDatabase(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  for (let i = row ? Number(row.value) : 0; i < MIGRATIONS.length; i++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i]);
      db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(i + 1));
    });
  }
}

/** Run `fn` atomically. node:sqlite is synchronous, so nothing else runs in between. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Record who did what, for the activity log. */
export function logActivity(db: Db, adminId: number | null, action: string, target = '', detail = ''): void {
  db.prepare('INSERT INTO activity (at, admin_id, action, target, detail) VALUES (?, ?, ?, ?, ?)').run(now(), adminId, action, target, detail.slice(0, 500));
}

export function getSetting<T>(db: Db, key: string): T | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setSetting(db: Db, key: string, value: unknown): void {
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(
    key,
    JSON.stringify(value),
    now(),
  );
}
