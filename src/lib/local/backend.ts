/**
 * The on-device backend (Android/iOS app and the web app): the shared data layer running on sql.js,
 * with receipts kept as Blobs in IndexedDB. Nothing leaves the device.
 */
import { Capacitor } from "@capacitor/core";
import { ZodError } from "zod";
import { setDbProvider } from "../core/sql";
import * as store from "../core/store";
import * as service from "../core/service";
import { createDemoTrip } from "../core/demo";
import { eventToCsv } from "../csv";
import { idb, type StoredReceipt } from "./idb";
import { openLocalDb } from "./sqljs";
import { blobToDataUrl, shrinkImage } from "../client/images";
import type { Backend } from "../client/backend";

/** Turn validation errors into the same plain messages the desktop API returns. */
function friendly(err: unknown): never {
  if (err instanceof ZodError) throw new Error(err.issues[0]?.message ?? "Invalid input");
  throw err;
}

export async function createLocalBackend(): Promise<Backend> {
  const db = await openLocalDb();
  setDbProvider(() => db.sql);
  const native = Capacitor.isNativePlatform();

  const read = async <T>(fn: () => T): Promise<T> => {
    try {
      return fn();
    } catch (err) {
      friendly(err);
    }
  };
  const write = async <T>(fn: () => T): Promise<T> => {
    const result = await read(fn);
    await db.persist();
    return result;
  };

  // Tidy receipts no expense uses any more (kept a day, so undo still works).
  void (async () => {
    const used = store.usedReceipts();
    const cutoff = Date.now() - 24 * 3600_000;
    for (const key of await idb.keys("receipts")) {
      const name = String(key);
      if (used.has(name)) continue;
      const r = await idb.get<StoredReceipt>("receipts", name);
      if (!r || r.createdAt < cutoff) await idb.delete("receipts", name);
    }
  })().catch(() => {});

  const urls = new Map<string, string>();

  return {
    info: async () => ({
      platform: "local",
      launched: false,
      native,
      dataLocation: native ? "Private app storage on this device" : "This browser's storage on this device",
    }),
    listEvents: () => read(() => store.listEventSummaries()),
    getEvent: (id) => read(() => store.getEvent(id)),
    createEvent: (data) => write(() => store.createEvent(data)),
    patchEvent: (id, action) => write(() => store.applyEventAction(id, action)),
    deleteEvent: (id) => write(() => store.deleteEvent(id)),
    listPeople: (includeHidden = false) => read(() => store.listPeople(includeHidden)),
    addPerson: (name) => write(() => service.addPerson({ name })),
    updatePerson: (id, fields) => write(() => service.editPerson(id, fields)),
    deletePerson: (id) => write(() => store.deletePerson(id)),
    getSettings: () => read(() => store.getSettings()),
    patchSettings: (patch) => write(() => service.patchSettings(patch)),
    loadDemo: () => write(() => createDemoTrip()),
    exportBackup: async () => {
      const data = await read(() => store.exportAll());
      for (const e of data.events) {
        for (const x of e.expenses) {
          if (!x.receipt) continue;
          const r = await idb.get<StoredReceipt>("receipts", x.receipt);
          if (r) data.receipts[x.receipt] = await blobToDataUrl(r.blob);
        }
      }
      return data;
    },
    importBackup: async (raw, mode) => {
      const data = await read(() => service.parseBackup(raw));
      if (mode === "replace") await idb.clear("receipts");
      const result = await write(() => store.importBackup(data, mode));
      for (const [name, url] of Object.entries(data.receipts ?? {})) {
        if (!store.isReceiptName(name) || !url.startsWith("data:")) continue;
        const blob = await (await fetch(url)).blob();
        await idb.put("receipts", name, { blob, createdAt: Date.now() } satisfies StoredReceipt);
      }
      return result;
    },
    clearAll: async () => {
      await write(() => store.clearAll());
      await idb.clear("receipts");
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    },
    uploadReceipt: async (file) => {
      const blob = await shrinkImage(file);
      const mime = blob === file ? file.type : "image/jpeg";
      const name = await read(() => store.newReceiptName(mime, blob.size));
      await idb.put("receipts", name, { blob, createdAt: Date.now() } satisfies StoredReceipt);
      return name;
    },
    receiptUrl: async (name) => {
      if (urls.has(name)) return urls.get(name)!;
      const r = await idb.get<StoredReceipt>("receipts", name);
      if (!r) return null;
      const url = URL.createObjectURL(r.blob);
      urls.set(name, url);
      return url;
    },
    eventCsv: (id) =>
      read(() => {
        const event = store.getEvent(id);
        if (!event) throw new store.NotFoundError("Event not found");
        return eventToCsv(event).replace(/^﻿/, "");
      }),
  };
}
