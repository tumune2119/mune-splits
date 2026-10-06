"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CalendarRange, Moon, Settings, Sun, Users } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/logo";
import { Kbd } from "@/components/kbd";
import { useApp } from "@/components/app-provider";
import { QuitButton, StoppedScreen, useAppPresence } from "@/components/app-lifetime";
import { cn } from "@/lib/utils";

/** Fired by the global "N" shortcut; the current page decides what "new" means. */
export const NEW_EVENT = "mune:new";

export function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog]") !== null;
}

const NAV = [
  { href: "/", label: "Events", icon: CalendarRange, match: (p: string) => p === "/" || p.startsWith("/events") },
  { href: "/people", label: "People", icon: Users, match: (p: string) => p.startsWith("/people") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function AppShell({ launched, children }: { launched: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const { stopped, setStopped } = useAppPresence(launched);
  const { theme, toggleTheme } = useApp();

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

  // Register the service worker so the app is installable as a PWA.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-dvh">
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

      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-sidebar-border bg-sidebar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium", active ? "text-brand" : "text-muted-foreground")}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      {stopped && <StoppedScreen />}
    </div>
  );
}
