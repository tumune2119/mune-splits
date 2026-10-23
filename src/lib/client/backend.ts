"use client";

/**
 * Every screen talks to data through this interface. Two implementations:
 *  - desktop: HTTP calls to the local Next.js server (SQLite file on disk)
 *  - local:   the same data layer running in the page on sql.js (Android/iOS app and the web app)
 * The build picks one with NEXT_PUBLIC_MUNE_TARGET.
 */
import type { EventAction, NewEvent } from "../event-actions";
import type { BackupFile } from "../core/store";
import type { AppSettings, EventDetail, EventSummary, Person } from "../types";

export type PersonWithStats = Person & { eventCount: number };

export interface AppInfo {
  platform: "desktop" | "local";
  /** Started by the desktop launcher: the server stops when the last window closes. */
  launched: boolean;
  /** Where data lives, shown in Settings. */
  dataLocation: string;
  /** Running inside the Android/iOS app (Capacitor). */
  native: boolean;
}

export interface Backend {
  info(): Promise<AppInfo>;
  listEvents(): Promise<EventSummary[]>;
  getEvent(id: string): Promise<EventDetail | null>;
  createEvent(data: NewEvent): Promise<EventDetail>;
  patchEvent(id: string, action: EventAction): Promise<EventDetail>;
  deleteEvent(id: string): Promise<void>;
  listPeople(includeHidden?: boolean): Promise<PersonWithStats[]>;
  addPerson(name: string): Promise<Person>;
  updatePerson(id: string, fields: { name?: string; color?: string; hidden?: boolean }): Promise<void>;
  deletePerson(id: string): Promise<"deleted" | "hidden">;
  getSettings(): Promise<AppSettings>;
  patchSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  exportBackup(): Promise<BackupFile>;
  importBackup(data: unknown, mode: "merge" | "replace"): Promise<{ events: number; people: number }>;
  clearAll(): Promise<void>;
  uploadReceipt(file: File): Promise<string>;
  /** A URL the page can show/open for a receipt (null if it's missing). */
  receiptUrl(name: string): Promise<string | null>;
  eventCsv(id: string): Promise<string>;
}

export const TARGET: "desktop" | "local" = process.env.NEXT_PUBLIC_MUNE_TARGET === "local" ? "local" : "desktop";
/** Prefix for files in public/ (the web app is served from a sub-path on GitHub Pages). */
export const asset = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function send<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => json<T>(r));
}

const http: Backend = {
  info: () => fetch("/api/app/info").then((r) => json<AppInfo>(r)),
  listEvents: () => fetch("/api/events").then((r) => json(r)),
  getEvent: async (id) => {
    const r = await fetch(`/api/events/${encodeURIComponent(id)}`);
    return r.status === 404 ? null : json<EventDetail>(r);
  },
  createEvent: (data) => send("/api/events", data),
  patchEvent: (id, action) => send(`/api/events/${encodeURIComponent(id)}`, action, "PATCH"),
  deleteEvent: (id) => send(`/api/events/${encodeURIComponent(id)}`, undefined, "DELETE"),
  listPeople: async (includeHidden = false) => {
    const all = await fetch("/api/people").then((r) => json<PersonWithStats[]>(r));
    return includeHidden ? all : all.filter((p) => !p.hidden);
  },
  addPerson: (name) => send("/api/people", { name }),
  updatePerson: (id, fields) => send(`/api/people/${id}`, fields, "PATCH"),
  deletePerson: (id) => send<{ result: "deleted" | "hidden" }>(`/api/people/${id}`, undefined, "DELETE").then((r) => r.result),
  getSettings: () => fetch("/api/settings").then((r) => json(r)),
  patchSettings: (patch) => send("/api/settings", patch, "PATCH"),
  exportBackup: () => fetch("/api/backup").then((r) => json(r)),
  importBackup: (data, mode) => send(`/api/backup?mode=${mode}`, data),
  clearAll: () => send("/api/reset", { confirm: "DELETE" }),
  uploadReceipt: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return (await json<{ name: string }>(await fetch("/api/receipts", { method: "POST", body: form }))).name;
  },
  receiptUrl: async (name) => `/api/receipts/${name}`,
  eventCsv: (id) =>
    fetch(`/api/events/${encodeURIComponent(id)}/csv`).then(async (r) => {
      if (!r.ok) throw new Error("Couldn't export the CSV.");
      return (await r.text()).replace(/^﻿/, "");
    }),
};

let local: Promise<Backend> | null = null;

/** The backend for this build. The on-device one (sql.js) is only loaded by the local build. */
export function backend(): Promise<Backend> {
  if (TARGET === "desktop") return Promise.resolve(http);
  local ??= import("../local/backend").then((m) => m.createLocalBackend());
  return local;
}

/* ---- refreshing screens after a change ----------------------------------------------------- */

const CHANGED = "mune:data-changed";

/** Tell every mounted screen that data changed (replaces router.refresh()). */
export function invalidate() {
  window.dispatchEvent(new Event(CHANGED));
}

export function onInvalidate(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}
