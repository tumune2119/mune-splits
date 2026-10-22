/**
 * SQLite on the device: sql.js (WebAssembly) behind the same SqlDb interface the desktop uses with
 * better-sqlite3, so the data layer runs unchanged. The whole database is saved to IndexedDB after
 * every change (it's small: receipts are stored separately).
 */
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { initSchema, type SqlDb } from "../core/sql";
import { asset } from "../client/backend";
import { idb } from "./idb";

type Params = SqlValue[] | Record<string, SqlValue>;

/** better-sqlite3 call styles → sql.js bindings: run(a, b, c) or run({ id, name }) for @id/@name. */
function bindings(params: unknown[]): Params {
  const clean = (v: unknown): SqlValue => (v === undefined ? null : typeof v === "boolean" ? Number(v) : (v as SqlValue));
  if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(params[0] as Record<string, unknown>).map(([k, v]) => [`@${k}`, clean(v)]));
  }
  return params.map(clean);
}

/** Exported for tests. */
export function adapt(db: Database): SqlDb {
  let depth = 0;
  return {
    prepare(sql) {
      const rows = (params: unknown[], one: boolean) => {
        const stmt = db.prepare(sql);
        try {
          stmt.bind(bindings(params));
          const out: Record<string, SqlValue>[] = [];
          while (stmt.step()) {
            out.push(stmt.getAsObject());
            if (one) break;
          }
          return out;
        } finally {
          stmt.free();
        }
      };
      return {
        run: (...params) => {
          db.run(sql, bindings(params));
          return { changes: db.getRowsModified() };
        },
        get: (...params) => rows(params, true)[0],
        all: (...params) => rows(params, false),
      };
    },
    exec: (sql) => void db.exec(sql),
    // Savepoints nest, like better-sqlite3 transactions.
    transaction:
      (fn) =>
      (...args) => {
        const name = `sp${depth++}`;
        db.exec(`SAVEPOINT ${name}`);
        try {
          const result = fn(...args);
          db.exec(`RELEASE ${name}`);
          return result;
        } catch (err) {
          db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
          throw err;
        } finally {
          depth--;
        }
      },
  };
}

export interface LocalDb {
  sql: SqlDb;
  /** Writes the current database image to IndexedDB. */
  persist(): Promise<void>;
  /** Replaces everything with a fresh, empty database. */
  reset(): Promise<void>;
}

export async function openLocalDb(): Promise<LocalDb> {
  const SQL = await initSqlJs({ locateFile: () => asset("/sql-wasm.wasm") });
  const saved = await idb.get<Uint8Array>("files", "db");
  let raw = saved ? new SQL.Database(saved) : new SQL.Database();
  raw.exec("PRAGMA foreign_keys = ON");
  let sql = adapt(raw);
  initSchema(sql);

  // Ask the browser not to evict our storage (matters most for the iPhone home-screen web app).
  navigator.storage?.persist?.().catch(() => {});

  let writing: Promise<void> = Promise.resolve();
  const db: LocalDb = {
    get sql() {
      return sql;
    },
    persist() {
      // Serialise writes so an older image can never land after a newer one.
      writing = writing.then(() => {
        const image = raw.export();
        // export() reopens the database internally, which resets this per-connection setting.
        raw.exec("PRAGMA foreign_keys = ON");
        return idb.put("files", "db", image).then(() => {});
      });
      return writing;
    },
    async reset() {
      raw.close();
      raw = new SQL.Database();
      raw.exec("PRAGMA foreign_keys = ON");
      sql = adapt(raw);
      initSchema(sql);
      await db.persist();
    },
  };
  if (!saved) await db.persist();
  return db;
}
