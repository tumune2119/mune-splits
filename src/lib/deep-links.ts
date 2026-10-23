/**
 * Invite links (https://tumune2119.github.io/mune-splits/join?e=…) open in the Android app when it's
 * installed. Pure helpers here; the app side is in app-shell.tsx, the website side in JoinScreen.
 */
import { SHARE_BASE_URL } from "./shared/config";

export const ANDROID_PACKAGE = "io.github.tumune2119.munesplits";

/** An invite link opened in the app → the in-app route to show, or null if it isn't one of ours. */
export function inAppRoute(link: string): string | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(link);
    base = new URL(SHARE_BASE_URL);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== base.host) return null;
  const path = url.pathname.replace(/\/$/, "");
  if (path !== `${base.pathname.replace(/\/$/, "")}/join`) return null;
  const e = url.searchParams.get("e");
  return e ? `/join?e=${encodeURIComponent(e)}` : null;
}

/**
 * Chrome on Android: opens the app if it's installed; if not, carries on to `fallback` (the website).
 * https://developer.chrome.com/docs/android/intents
 */
export function androidIntent(link: string, fallback: string): string {
  const url = new URL(link);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
