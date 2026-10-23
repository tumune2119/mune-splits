"use client";

/**
 * Finding and installing updates on each platform:
 *  - Android app: download the APK in the app and hand it to Android's installer (AppUpdaterPlugin)
 *  - Windows / desktop: point to the download page
 *  - iPhone / web app: nothing to do; the service worker picks up each new deploy on its own
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { APP_VERSION, RELEASES_API, isNewer, parseRelease, type ReleaseInfo } from "../updates";

interface AppUpdaterPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(event: "progress", fn: (p: { loaded: number; total: number }) => void): Promise<PluginListenerHandle>;
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export type UpdateChannel = "android" | "desktop" | "none";

export function updateChannel(platform: "desktop" | "local"): UpdateChannel {
  if (Capacitor.getPlatform() === "android") return "android";
  if (platform === "desktop") return "desktop";
  return "none";
}

const LAST_CHECK = "mune-splits-update-checked";
const SNOOZE = "mune-splits-update-snooze";
const CHECK_EVERY_MS = 6 * 3600_000;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

/** The latest release, if it's newer than this app. Throttled unless `force` (Settings → Check now). */
export async function findUpdate(force = false): Promise<ReleaseInfo | null> {
  if (!force) {
    const last = Number(store.get(LAST_CHECK) ?? 0);
    if (Date.now() - last < CHECK_EVERY_MS) return null;
  }
  const res = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 403 ? "GitHub is busy. Try again in a while." : `Couldn't check for updates (${res.status}).`);
  store.set(LAST_CHECK, String(Date.now()));
  const release = parseRelease(await res.json());
  if (!release || !isNewer(release.version, APP_VERSION)) return null;
  if (!force) {
    const [version, until] = (store.get(SNOOZE) ?? "").split("|");
    if (version === release.version && Date.now() < Number(until)) return null;
  }
  return release;
}

/** "Later": don't ask about this version again for a day. */
export function snooze(version: string) {
  store.set(SNOOZE, `${version}|${Date.now() + 24 * 3600_000}`);
}

/** Lets Settings → "Check for updates" open the prompt. */
export const SHOW_UPDATE = "mune:show-update";
