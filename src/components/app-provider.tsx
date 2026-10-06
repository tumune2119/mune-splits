"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { patchSettings } from "@/lib/client/api";
import type { AppSettings } from "@/lib/types";

interface AppContextValue {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  /** Formats minor units in the given currency with the user's locale. */
  fmt: (minor: number, currency: string, opts?: Parameters<typeof formatMoney>[3]) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ initial, children }: { initial: AppSettings; children: React.ReactNode }) {
  const [settings, setSettingsState] = useState(initial);

  const applyTheme = (theme: "dark" | "light") => {
    const el = document.documentElement;
    el.classList.remove("dark", "light");
    el.classList.add(theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0e0e10" : "#f7f5f3");
  };

  const setSettings = useCallback((s: AppSettings) => {
    setSettingsState(s);
    applyTheme(s.theme);
  }, []);

  const toggleTheme = useCallback(() => {
    const theme = settings.theme === "dark" ? "light" : "dark";
    setSettings({ ...settings, theme });
    patchSettings({ theme }).catch(() => {});
  }, [settings, setSettings]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      setSettings,
      theme: settings.theme,
      toggleTheme,
      fmt: (minor, currency, opts) => formatMoney(minor, currency, settings.locale, opts),
    }),
    [settings, setSettings, toggleTheme],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
