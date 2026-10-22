/**
 * Firebase project for shared events. These values identify the project; they are not secrets
 * (Firebase web config is public by design). Access to each event is protected by its unguessable
 * share id and the rules in firestore.rules.
 *
 * null = sharing switched off (the app then works exactly as before, on this device only).
 * NEXT_PUBLIC_FIREBASE_CONFIG (JSON) overrides it at build time, e.g. for tests against the emulator.
 */
const PROJECT: Record<string, string> | null = {
  apiKey: "AIzaSyD-VixVL35zxRX-DYDXo46eCJGk4tvO_xE",
  authDomain: "mune-splits-f6629.firebaseapp.com",
  projectId: "mune-splits-f6629",
  storageBucket: "mune-splits-f6629.firebasestorage.app",
  messagingSenderId: "1001061629050",
  appId: "1:1001061629050:web:5ed5ab0134e1cceb594fc3",
};

export const firebaseConfig: Record<string, string> | null = process.env.NEXT_PUBLIC_FIREBASE_CONFIG
  ? JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG)
  : PROJECT;

/** "host:port" of a local Firestore emulator to use instead of the real database (tests only). */
export const firestoreEmulator = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR || null;

/** The web app that share links open (works on any phone or computer). */
export const SHARE_BASE_URL = process.env.NEXT_PUBLIC_SHARE_BASE_URL || "https://tumune2119.github.io/mune-splits";

export const sharingEnabled = () => firebaseConfig !== null;

export const shareLink = (sid: string) => `${SHARE_BASE_URL}/join?e=${encodeURIComponent(sid)}`;

/** Pulls the share id out of a pasted link (or a bare id). */
export function parseShareInput(text: string): string | null {
  const t = text.trim();
  const fromUrl = /[?&]e=([\w-]{20,})/.exec(t)?.[1];
  if (fromUrl) return fromUrl;
  return /^[\w-]{20,}$/.test(t) ? t : null;
}
