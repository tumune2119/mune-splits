import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { initSchema, type SqlDb } from "./core/sql";

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

function open(): DB {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  initSchema(db as unknown as SqlDb);
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __muneSplitsDb?: DB };

export function getDb(): SqlDb {
  g.__muneSplitsDb ??= open();
  return g.__muneSplitsDb as unknown as SqlDb;
}
