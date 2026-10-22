"use client";

/**
 * Saving and sharing files works differently per platform:
 *  - desktop browser: a normal download
 *  - Android/iOS app: write to the app cache and open the share sheet (save to Files, WhatsApp, …)
 *  - phone browser / home-screen web app: the Web Share sheet when available, else a download
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const touchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const { uri } = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ title: filename, files: [uri], dialogTitle: "Save or send" });
    } catch (err) {
      // Closing the share sheet counts as an error on some devices; that's fine.
      if (!/cancel/i.test(String((err as Error)?.message))) throw err;
    }
    return;
  }
  const file = new File([blob], filename, { type: blob.type });
  if (touchDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
  }
  download(blob, filename);
}

export const saveText = (text: string, filename: string, type: string) => saveFile(new Blob([text], { type }), filename);

/** Shares text via the share sheet on phones; copies it to the clipboard elsewhere. */
export async function shareText(text: string): Promise<"shared" | "copied"> {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ text });
    return "shared";
  }
  if (touchDevice() && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "shared";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
