import type { AppSettings, Category } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { name: "Food", emoji: "🍽️", color: "#FFB38A" },
  { name: "Travel", emoji: "✈️", color: "#8AB4FF" },
  { name: "Stay", emoji: "🏨", color: "#B79CFF" },
  { name: "Activities", emoji: "🏄", color: "#6FE3C1" },
  { name: "Shopping", emoji: "🛍️", color: "#FF8FB1" },
  { name: "Drinks", emoji: "🍹", color: "#FFD86B" },
  { name: "Other", emoji: "📦", color: "#9A9AA3" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCurrency: "INR",
  locale: "en-IN",
  myName: "You",
  theme: "dark",
  categories: DEFAULT_CATEGORIES,
};

/** Avatar colours for people; soft enough to sit on the dark surfaces. */
export const PERSON_COLORS = [
  "#FFB38A",
  "#8AB4FF",
  "#6FE3C1",
  "#B79CFF",
  "#FF8FB1",
  "#FFD86B",
  "#7FD4F5",
  "#C3E88D",
  "#F78C6C",
  "#D7A6FF",
];

/** Event tag colours. */
export const EVENT_COLORS = ["#FFB38A", "#8AB4FF", "#6FE3C1", "#B79CFF", "#FF8FB1", "#FFD86B", "#7FD4F5", "#9A9AA3"];

export const EVENT_EMOJIS = ["🏝️", "🏔️", "✈️", "🎉", "🏠", "🍕", "🚗", "⛺", "🎂", "💼", "🎿", "🌆", "🍻", "🎶", "🛶", "🧳"];

export const SPLIT_MODE_LABELS = {
  equal: "Equal",
  shares: "Shares",
  exact: "Exact",
  percent: "Percent",
} as const;

export const FALLBACK_CATEGORY: Category = { name: "Other", emoji: "📦", color: "#9A9AA3" };

export function findCategory(categories: Category[], name: string): Category {
  return categories.find((c) => c.name === name) ?? { ...FALLBACK_CATEGORY, name };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Local YYYY-MM-DD. */
export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/**
 * Chart series colours, validated for colour-blind separation on each surface (dataviz validator):
 * dark on #1a1a1f, light on #ffffff (light/print also needs visible labels, which every chart has).
 * Categories take the slot of their position in Settings, so a colour follows its category.
 */
export const SERIES = {
  dark: ["#e0702f", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767", "#3987e5"],
  light: ["#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948", "#2a78d6"],
} as const;
/** Anything past the 8th category folds into one grey slot. */
export const SERIES_OVERFLOW = "#8a8a93";

export function categoryColor(categories: Category[], name: string, theme: "dark" | "light"): string {
  const i = categories.findIndex((c) => c.name === name);
  return i >= 0 && i < SERIES[theme].length ? SERIES[theme][i] : SERIES_OVERFLOW;
}
