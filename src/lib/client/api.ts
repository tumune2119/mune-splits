"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { backend, invalidate, onInvalidate, type Backend } from "./backend";
import type { EventAction, NewEvent } from "../event-actions";
import type { AppSettings } from "../types";

/** Shorthands for screens. Writes call invalidate() so other mounted screens reload. */
const changed = async <T>(p: Promise<T>) => {
  const r = await p;
  invalidate();
  return r;
};
export const patchEvent = async (id: string, action: EventAction) => changed((await backend()).patchEvent(id, action));
export const createEventRequest = async (data: NewEvent) => changed((await backend()).createEvent(data));
export const deleteEventRequest = async (id: string) => changed((await backend()).deleteEvent(id));
export const patchSettings = async (data: Partial<AppSettings>) => (await backend()).patchSettings(data);
export const uploadReceipt = async (file: File) => (await backend()).uploadReceipt(file);
export async function mutate<T>(fn: (b: Backend) => Promise<T>): Promise<T> {
  return changed(fn(await backend()));
}

/**
 * Loads data through the backend and reloads it whenever something changes (see invalidate()).
 * `data` is undefined while the first load is in flight.
 */
export function useData<T>(load: (b: Backend) => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  // Always call the latest loader; layout effects run before the load effect below.
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(() => {
    let alive = true;
    backend()
      .then((b) => loadRef.current(b))
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e as Error));
    return () => {
      alive = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reload(), [reload, ...deps]);
  useEffect(() => onInvalidate(() => void reload()), [reload]);

  return { data, error, reload, setData };
}
