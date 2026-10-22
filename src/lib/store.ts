import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb as getNodeDb, receiptsDir } from "./db";
import { setDbProvider } from "./core/sql";
import * as core from "./core/store";
import type { BackupFile } from "./core/store";

/**
 * Desktop server data layer: the platform-neutral store (./core/store) on better-sqlite3, plus
 * receipt files in data/receipts.
 */
setDbProvider(getNodeDb);

export * from "./core/store";

export function saveReceipt(bytes: Buffer, mime: string): string {
  const name = core.newReceiptName(mime, bytes.length);
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ receiptsDir(), name), bytes);
  return name;
}

export function receiptPath(name: string): string | null {
  if (!core.isReceiptName(name)) return null;
  const file = path.join(/*turbopackIgnore: true*/ receiptsDir(), name);
  return fs.existsSync(file) ? file : null;
}

/** Removes receipt files no expense points to (older than a day, so undo and open forms still work). */
export function cleanupReceipts() {
  const dir = receiptsDir();
  const used = core.usedReceipts();
  const cutoff = Date.now() - 24 * 3600_000;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(/*turbopackIgnore: true*/ dir, name);
    try {
      if (!used.has(name) && fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch {}
  }
}

export function exportAll(): BackupFile {
  const data = core.exportAll();
  for (const e of data.events) {
    for (const x of e.expenses) {
      const file = x.receipt && receiptPath(x.receipt);
      if (file) {
        data.receipts[x.receipt!] = `data:${core.receiptMime(x.receipt!)};base64,${fs.readFileSync(/*turbopackIgnore: true*/ file).toString("base64")}`;
      }
    }
  }
  return data;
}

export function importBackup(data: BackupFile, mode: "merge" | "replace") {
  const result = core.importBackup(data, mode);
  for (const [name, url] of Object.entries(data.receipts ?? {})) {
    const m = /^data:[^;]+;base64,(.*)$/.exec(url);
    if (m && core.isReceiptName(name)) fs.writeFileSync(path.join(/*turbopackIgnore: true*/ receiptsDir(), name), Buffer.from(m[1], "base64"));
  }
  return result;
}

export function clearAll() {
  core.clearAll();
  const dir = receiptsDir();
  for (const name of fs.readdirSync(dir)) fs.rmSync(path.join(/*turbopackIgnore: true*/ dir, name), { force: true });
}
