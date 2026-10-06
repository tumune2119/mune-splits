import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DB = Database.Database;

const DEFAULT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");

/** Folder holding the database and receipts. Override with MUNE_SPLITS_DATA_DIR. */
export function dataDir(): string {
  const configured = process.env.MUNE_SPLITS_DATA_DIR;
  return configured ? path.resolve(/*turbopackIgnore: true*/ configured) : DEFAULT_DIR;
}

export function receiptsDir(): string {
  const dir = path.join(/*turbopackIgnore: true*/ dataDir(), "receipts");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), "mune-splits.db");
}

// Idempotent schema; runs on every start so a fresh ./data folder just works.
const DDL = `
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_me INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  settled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event_people (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (event_id, person_id)
);
CREATE INDEX IF NOT EXISTS event_people_person_idx ON event_people(person_id);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  payers TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  split TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  receipt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS expenses_event_idx ON expenses(event_id);
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_id TEXT NOT NULL REFERENCES people(id),
  to_id TEXT NOT NULL REFERENCES people(id),
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS settlements_event_idx ON settlements(event_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function open(): DB {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(DDL);
  // The owner always exists, so "You" can be added to any event.
  db.prepare("INSERT OR IGNORE INTO people (id, name, color, is_me, hidden, created_at) VALUES ('me', 'You', '#FFB38A', 1, 0, ?)").run(
    Date.now(),
  );
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __muneSplitsDb?: DB };

export function getDb(): DB {
  g.__muneSplitsDb ??= open();
  return g.__muneSplitsDb;
}
