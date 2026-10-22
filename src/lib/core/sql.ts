/**
 * The tiny SQLite surface the data layer needs. The desktop server backs it with better-sqlite3;
 * the phone/web build backs it with sql.js (SQLite compiled to WebAssembly). Same SQL everywhere.
 */
export interface SqlStatement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDb {
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
  /** Wraps fn in a (nestable) transaction, like better-sqlite3's db.transaction(fn). */
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R;
}

let provider: (() => SqlDb) | null = null;

/** Each platform registers its database once at startup. */
export function setDbProvider(p: () => SqlDb) {
  provider = p;
}

export function getDb(): SqlDb {
  if (!provider) throw new Error("MUNE Splits database isn't ready yet.");
  return provider();
}

// Idempotent schema; runs on every start so a fresh database just works.
export const SCHEMA = `
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

/** Creates tables and the owner ("You"), who always exists so they can join any event. */
export function initSchema(db: SqlDb) {
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO people (id, name, color, is_me, hidden, created_at) VALUES ('me', 'You', '#FFB38A', 1, 0, ?)").run(
    Date.now(),
  );
}
