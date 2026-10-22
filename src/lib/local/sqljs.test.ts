// The phone/web data layer: the shared store running on sql.js through the better-sqlite3-style adapter.
import { beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { adapt } from "./sqljs";
import { initSchema, setDbProvider, type SqlDb } from "../core/sql";
import * as store from "../core/store";
import { patchSettings, parseBackup } from "../core/service";
import { createDemoTrip } from "../core/demo";
import { eventMath } from "../event-math";

let raw: Database;
let db: SqlDb;

beforeEach(async () => {
  const SQL = await initSqlJs({ locateFile: (f) => path.resolve("node_modules/sql.js/dist", f) });
  raw = new SQL.Database();
  raw.exec("PRAGMA foreign_keys = ON");
  db = adapt(raw);
  initSchema(db);
  setDbProvider(() => db);
});

describe("sql.js adapter", () => {
  it("supports positional and @named parameters, get/all/run", () => {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("a", "1");
    db.prepare("INSERT INTO settings (key, value) VALUES (@key, @value)").run({ key: "b", value: "2" });
    expect(db.prepare("SELECT value FROM settings WHERE key = ?").get("b")).toEqual({ value: "2" });
    expect(db.prepare("SELECT value FROM settings WHERE key = ?").get("zzz")).toBeUndefined();
    expect(db.prepare("SELECT key FROM settings ORDER BY key").all()).toEqual([{ key: "a" }, { key: "b" }]);
    expect(db.prepare("DELETE FROM settings").run().changes).toBe(2);
  });

  it("rolls back a failed transaction, including nested ones", () => {
    const fail = db.transaction(() => {
      db.prepare("INSERT INTO settings (key, value) VALUES ('x', '1')").run();
      db.transaction(() => db.prepare("INSERT INTO settings (key, value) VALUES ('y', '1')").run())();
      throw new Error("boom");
    });
    expect(() => fail()).toThrow("boom");
    expect(db.prepare("SELECT COUNT(*) AS n FROM settings").get()).toEqual({ n: 0 });
  });
});

describe("store on sql.js", () => {
  it("runs the demo trip with the same maths as the desktop", () => {
    const id = createDemoTrip();
    const event = store.getEvent(id)!;
    expect(event.expenses).toHaveLength(8);
    expect(eventMath(event).balanceOf("me").net).toBe(1306150);
    expect(store.listEventSummaries()[0].myNet).toBe(1306150);
  });

  it("deleting an event cascades to its expenses, even after a save (export) reset the connection", () => {
    const id = createDemoTrip();
    raw.export(); // what persist() does; it reopens the database internally
    raw.exec("PRAGMA foreign_keys = ON"); // ...which is why persist() re-enables this
    store.deleteEvent(id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM expenses").get()).toEqual({ n: 0 });
  });

  it("validates like the desktop API", () => {
    expect(() => patchSettings({ categories: [{ name: "A", emoji: "", color: "" }, { name: "a", emoji: "", color: "" }] })).toThrow(/unique/);
    expect(() => parseBackup({ app: "something-else" })).toThrow(/isn't a MUNE Splits backup/);
  });

  it("round-trips a backup", () => {
    createDemoTrip();
    const backup = store.exportAll();
    store.clearAll();
    expect(store.listEventSummaries()).toHaveLength(0);
    store.importBackup(parseBackup(JSON.parse(JSON.stringify(backup))), "merge");
    expect(store.listEventSummaries()[0].myNet).toBe(1306150);
  });
});

describe("receipt names", () => {
  it("accepts generated names and rejects anything path-like", () => {
    const name = store.newReceiptName("image/png", 1000);
    expect(store.isReceiptName(name)).toBe(true);
    expect(store.receiptMime(name)).toBe("image/png");
    expect(store.isReceiptName("../../etc/passwd")).toBe(false);
    expect(store.isReceiptName("abcdefxpng")).toBe(false);
    expect(() => store.newReceiptName("text/html", 10)).toThrow();
  });
});
