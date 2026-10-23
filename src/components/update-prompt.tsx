"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Download, ExternalLink, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { AppUpdater, SHOW_UPDATE, findUpdate, snooze, updateChannel } from "@/lib/client/updater";
import { APP_VERSION, RELEASES_PAGE, notesToLines, type ReleaseInfo } from "@/lib/updates";

type Step =
  | { kind: "offer" }
  | { kind: "permission" }
  | { kind: "downloading"; pct: number | null }
  | { kind: "installing" }
  | { kind: "error"; message: string };

/**
 * Tells the user a new version is out and, on Android, installs it: downloads the APK inside the app
 * and opens Android's installer, which asks the user to confirm. Windows gets a link to the download.
 */
export function UpdatePrompt() {
  const { info } = useApp();
  const channel = updateChannel(info.platform);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [step, setStep] = useState<Step>({ kind: "offer" });
  const waitingForPermission = useRef(false);

  // Check shortly after start-up (throttled to every 6 hours), and when Settings asks.
  useEffect(() => {
    if (channel === "none") return;
    const t = setTimeout(() => findUpdate().then((r) => r && (setStep({ kind: "offer" }), setRelease(r))).catch(() => {}), 3000);
    const show = (e: Event) => {
      setStep({ kind: "offer" });
      setRelease((e as CustomEvent<ReleaseInfo>).detail);
    };
    window.addEventListener(SHOW_UPDATE, show);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SHOW_UPDATE, show);
    };
  }, [channel]);

  const download = useCallback(async (r: ReleaseInfo) => {
    if (!r.apkUrl) return setStep({ kind: "error", message: "This release has no Android download yet. Try again in a few minutes." });
    setStep({ kind: "downloading", pct: null });
    const sub = await AppUpdater.addListener("progress", ({ loaded, total }) => {
      setStep({ kind: "downloading", pct: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null });
    });
    try {
      await AppUpdater.downloadAndInstall({ url: r.apkUrl });
      setStep({ kind: "installing" });
    } catch (err) {
      const message = (err as Error)?.message ?? "";
      if (message.includes("INSTALL_NOT_ALLOWED")) setStep({ kind: "permission" });
      else setStep({ kind: "error", message: message || "The download didn't finish. Check your connection and try again." });
    } finally {
      void sub.remove();
    }
  }, []);

  const start = useCallback(async () => {
    if (!release) return;
    const { allowed } = await AppUpdater.canInstall();
    if (!allowed) return setStep({ kind: "permission" });
    void download(release);
  }, [release, download]);

  // Back from Android's "Install unknown apps" screen: carry on if the switch is now on.
  useEffect(() => {
    if (channel !== "android") return;
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      const handle = App.addListener("resume", async () => {
        if (!waitingForPermission.current || !release) return;
        waitingForPermission.current = false;
        const { allowed } = await AppUpdater.canInstall();
        if (allowed) void download(release);
      });
      remove = () => void handle.then((h) => h.remove());
    });
    return () => remove?.();
  }, [channel, release, download]);

  if (!release) return null;
  const close = () => {
    if (step.kind === "offer") snooze(release.version);
    setRelease(null);
  };
  const busy = step.kind === "downloading";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
            <Sparkles className="size-6" />
          </span>
          <DialogTitle className="text-lg font-semibold">Update available</DialogTitle>
          <DialogDescription>
            MUNE Splits <span className="font-medium text-foreground">{release.version}</span> is out. You have {APP_VERSION}.
          </DialogDescription>
        </DialogHeader>

        {step.kind === "offer" && (
          <>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              {notesToLines(release.notes).map((l, i) => (
                <p key={i} className={l.startsWith("-") ? "pl-1" : "font-medium text-foreground"}>
                  {l}
                </p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Your events and settings are kept.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="h-11 rounded-xl" onClick={close}>
                Later
              </Button>
              {channel === "android" ? (
                <Button className="h-11 rounded-xl px-5" onClick={start}>
                  <Download /> Update now
                </Button>
              ) : (
                <Button className="h-11 rounded-xl px-5" onClick={() => (window.open(RELEASES_PAGE, "_blank"), setRelease(null))}>
                  <ExternalLink /> Get the update
                </Button>
              )}
            </div>
          </>
        )}

        {step.kind === "permission" && (
          <>
            <div className="flex gap-3 rounded-xl border border-border bg-background/40 p-4 text-sm">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
              <p className="text-muted-foreground">
                Android needs your OK once before MUNE Splits can install its own updates. On the next screen, turn on{" "}
                <span className="font-medium text-foreground">Allow from this source</span>, then come back.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="h-11 rounded-xl" onClick={close}>
                Not now
              </Button>
              <Button
                className="h-11 rounded-xl px-5"
                onClick={() => {
                  waitingForPermission.current = true;
                  void AppUpdater.openInstallSettings();
                }}
              >
                Open settings
              </Button>
            </div>
          </>
        )}

        {step.kind === "downloading" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-brand" /> Downloading…
              </span>
              <span className="money text-muted-foreground">{step.pct === null ? "" : `${step.pct}%`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={step.pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${step.pct ?? 8}%` }} />
            </div>
          </div>
        )}

        {step.kind === "installing" && (
          <>
            <p className="text-sm text-muted-foreground">
              Android will ask you to confirm. Tap <span className="font-medium text-foreground">Update</span> (or{" "}
              <span className="font-medium text-foreground">Install</span>), then open MUNE Splits again.
            </p>
            <Button className="h-11 rounded-xl" onClick={() => setRelease(null)}>
              OK
            </Button>
          </>
        )}

        {step.kind === "error" && (
          <>
            <p className="flex gap-2 text-sm text-owe">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {step.message}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="h-11 rounded-xl" onClick={() => window.open(RELEASES_PAGE, "_blank")}>
                Download page
              </Button>
              <Button className="h-11 rounded-xl px-5" onClick={start}>
                Try again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
