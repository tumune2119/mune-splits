"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { backend, type AppInfo } from "@/lib/client/backend";
import { patchSettings } from "@/lib/client/api";
import { LogoMark } from "@/components/logo";
import type { AppSettings } from "@/lib/types";

interface AppContextValue {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  info: AppInfo;
  theme: "dark" | "light";
  toggleTheme: () => void;
  /** Formats minor units in the given currency with the user's locale. */
  fmt: (minor: number, currency: string, opts?: Parameters<typeof formatMoney>[3]) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Remembered so the next start paints in the right theme immediately (see THEME_SCRIPT in layout). */
export const THEME_KEY = "mune-splits-theme";

function applyTheme(theme: "dark" | "light") {
  const el = document.documentElement;
  el.classList.remove("dark", "light");
  el.classList.add(theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0e0e10" : "#f7f5f3");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

/** Loads settings and app info, then renders the app. Shows the logo until the data layer is ready. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ settings: AppSettings; info: AppInfo } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend()
      .then(async (b) => {
        const [settings, info] = await Promise.all([b.getSettings(), b.info()]);
        applyTheme(settings.theme);
        setState({ settings, info });
      })
      .catch((err) => setError((err as Error).message || "Couldn't open your data."));
  }, []);

  const setSettings = useCallback((s: AppSettings) => {
    setState((prev) => (prev ? { ...prev, settings: s } : prev));
    applyTheme(s.theme);
  }, []);

  const value = useMemo<AppContextValue | null>(() => {
    if (!state) return null;
    const { settings, info } = state;
    return {
      settings,
      info,
      setSettings,
      theme: settings.theme,
      toggleTheme: () => {
        const theme = settings.theme === "dark" ? "light" : "dark";
        setSettings({ ...settings, theme });
        patchSettings({ theme }).catch(() => {});
      },
      fmt: (minor, currency, opts) => formatMoney(minor, currency, settings.locale, opts),
    };
  }, [state, setSettings]);

  if (!value) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <div>
          <LogoMark className="mx-auto size-14 animate-pulse drop-shadow-[0_0_18px_rgb(255_148_85/0.45)]" />
          {error && (
            <>
              <p className="mt-5 font-medium">MUNE Splits couldn&apos;t start</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
