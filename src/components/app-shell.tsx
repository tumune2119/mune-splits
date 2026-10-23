"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CalendarRange, Moon, Settings, Sun, Users } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/logo";
import { UpdatePrompt } from "@/components/update-prompt";
import { Kbd } from "@/components/kbd";
import { useApp } from "@/components/app-provider";
import { QuitButton, StoppedScreen, useAppPresence } from "@/components/app-lifetime";
import { asset, TARGET } from "@/lib/client/backend";
import { inAppRoute } from "@/lib/deep-links";
import { cn } from "@/lib/utils";

/** Fired by the global "N" shortcut; the current page decides what "new" means. */
export const NEW_EVENT = "mune:new";

export function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog]") !== null;
}

const NAV = [
  { href: "/", label: "Events", icon: CalendarRange, match: (p: string) => p === "/" || p.startsWith("/event") },
  { href: "/people", label: "People", icon: Users, match: (p: string) => p.startsWith("/people") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, info } = useApp();
  const launched = info.launched;
  const { stopped, setStopped } = useAppPresence(launched);
  useNativeShell(info.native, theme);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(NEW_EVENT));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Service worker: makes the app installable, and on the web build also keeps it working offline.
  // Not used inside the Android/iOS app, which already ships every file.
  useEffect(() => {
    if (info.native || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register(asset(TARGET === "local" ? "/sw-offline.js" : "/sw.js")).catch(() => {});
  }, [info.native]);

  return (
    <div className="flex min-h-dvh pt-[env(safe-area-inset-top)]">
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 pt-6 pb-7" aria-label="MUNE Splits home">
          <LogoMark className="size-8 drop-shadow-[0_0_12px_rgb(255_148_85/0.35)]" />
          <Wordmark className="text-[0.92rem]" />
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {active && <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-brand" />}
                <Icon className={cn("size-[18px]", active && "text-brand")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          {launched && <QuitButton onQuit={() => setStopped(true)} />}
          <p className="px-2.5 pt-2 text-[0.7rem] text-muted-foreground/80">
            <Kbd>N</Kbd> add expense / new event
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-28 md:pb-0">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-sidebar-border bg-sidebar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}
            >
              {/* Material 3 navigation bar: a pill behind the active icon. */}
              <span className={cn("grid h-8 w-16 place-items-center rounded-full transition-colors", active && "bg-brand/18 text-brand")}>
                <Icon className="size-[22px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
      <UpdatePrompt />
      {stopped && <StoppedScreen />}
    </div>
  );
}

/**
 * Android/iOS app only: dark/light status bar to match the theme, and the Android back button
 * closes dialogs first, then goes back, then leaves the app from the home screen. Invite links that
 * Android hands to the app (see AndroidManifest.xml) open the join screen.
 */
function useNativeShell(native: boolean, theme: "dark" | "light") {
  const router = useRouter();

  useEffect(() => {
    if (!native) return;
    const open = (url: string | undefined) => {
      const route = url ? inAppRoute(url) : null;
      if (route) router.push(route);
    };
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(async ({ App }) => {
      const handle = App.addListener("appUrlOpen", ({ url }) => open(url));
      remove = () => void handle.then((h) => h.remove());
      // Started by tapping a link: handle it once (not again if the page reloads).
      const launch = (await App.getLaunchUrl())?.url;
      if (launch && sessionStorage.getItem("mune-launch-url") !== launch) {
        sessionStorage.setItem("mune-launch-url", launch);
        open(launch);
      }
    });
    return () => remove?.();
  }, [native, router]);

  useEffect(() => {
    if (!native) return;
    import("@capacitor/status-bar")
      .then(async ({ StatusBar, Style }) => {
        await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#0e0e10" : "#f7f5f3" }).catch(() => {});
      })
      .catch(() => {});
  }, [native, theme]);

  useEffect(() => {
    if (!native) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      const handle = App.addListener("backButton", ({ canGoBack }) => {
        const dialog = document.querySelector("[role=dialog], [role=alertdialog]");
        if (dialog) {
          // Bubbles up to the document, where Radix listens for Escape to close the top layer.
          dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        } else if (canGoBack && window.location.pathname.replace(/\/$/, "") !== (process.env.NEXT_PUBLIC_BASE_PATH ?? "")) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
      remove = () => void handle.then((h) => h.remove());
    });
    return () => remove?.();
  }, [native]);
}
