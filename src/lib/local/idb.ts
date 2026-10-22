/**
 * Minimal IndexedDB wrapper for the on-device build. Two stores:
 *  - "files":    the SQLite database image (key "db")
 *  - "receipts": receipt images/PDFs as Blobs, keyed by receipt name
 * IndexedDB lives in the app's private storage on Android/iOS (and the browser profile on the web).
 */
const DB_NAME = "mune-splits";
const VERSION = 1;

export interface StoredReceipt {
  blob: Blob;
  createdAt: number;
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("receipts")) db.createObjectStore("receipts");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function tx<T>(store: "files" | "receipts", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req ? req.result : (undefined as T));
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error("Storage write was aborted (is the device out of space?)"));
      }),
  );
}

export const idb = {
  get: <T>(store: "files" | "receipts", key: string) => tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: "files" | "receipts", key: string, value: unknown) => tx<IDBValidKey>(store, "readwrite", (s) => s.put(value, key)),
  delete: (store: "files" | "receipts", key: string) => tx<undefined>(store, "readwrite", (s) => s.delete(key)),
  keys: (store: "files" | "receipts") => tx<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()),
  clear: (store: "files" | "receipts") => tx<undefined>(store, "readwrite", (s) => s.clear()),
};
