"use client";

import type { EventAction, NewEvent } from "../event-actions";
import type { AppSettings, EventDetail } from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function send<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => json<T>(r));
}

export const patchEvent = (id: string, action: EventAction) => send<EventDetail>(`/api/events/${id}`, action, "PATCH");
export const createEventRequest = (data: NewEvent) => send<EventDetail>("/api/events", data);
export const deleteEventRequest = (id: string) => send<void>(`/api/events/${id}`, undefined, "DELETE");
export const patchSettings = (data: Partial<AppSettings>) => send<AppSettings>("/api/settings", data, "PATCH");
export const loadDemo = () => send<{ id: string }>("/api/demo");

export async function uploadReceipt(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/receipts", { method: "POST", body: form });
  return (await json<{ name: string }>(res)).name;
}

/** Starts a browser download of a URL (same-origin endpoints that send Content-Disposition). */
export function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
