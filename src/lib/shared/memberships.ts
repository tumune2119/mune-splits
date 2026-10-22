"use client";

/**
 * Which shared events this device has joined, and which person it is in each. Kept in this device's
 * storage: there are no accounts, so "who am I" is remembered per device.
 */
export interface Membership {
  sid: string;
  /** Person id in that event, or null until they pick who they are. */
  me: string | null;
  name: string;
  joinedAt: number;
}

const KEY = "mune-splits-shared-events";
const CHANGED = "mune:memberships-changed";

export function listMemberships(): Membership[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((m) => m && typeof m.sid === "string") : [];
  } catch {
    return [];
  }
}

function save(list: Membership[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

export const getMembership = (sid: string) => listMemberships().find((m) => m.sid === sid) ?? null;

export function upsertMembership(m: Omit<Membership, "joinedAt"> & { joinedAt?: number }) {
  const list = listMemberships().filter((x) => x.sid !== m.sid);
  save([{ joinedAt: Date.now(), ...getMembership(m.sid), ...m } as Membership, ...list]);
}

export function removeMembership(sid: string) {
  save(listMemberships().filter((m) => m.sid !== sid));
}

export function onMembershipsChanged(fn: () => void) {
  window.addEventListener(CHANGED, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(CHANGED, fn);
    window.removeEventListener("storage", fn);
  };
}
