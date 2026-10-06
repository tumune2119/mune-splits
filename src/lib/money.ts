/** Currency helpers. Amounts are integer minor units; these convert to and from what people type and see. */

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "ZAR", name: "South African Rand" },
];

export const LOCALES: { code: string; label: string }[] = [
  { code: "en-IN", label: "English (India) · 1,00,000.00" },
  { code: "en-US", label: "English (US) · 100,000.00" },
  { code: "en-GB", label: "English (UK) · 100,000.00" },
  { code: "de-DE", label: "Deutsch · 100.000,00" },
  { code: "fr-FR", label: "Français · 100 000,00" },
];

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (INR 2, JPY 0, …). */
export function minorDigits(currency: string): number {
  let d = digitsCache.get(currency);
  if (d === undefined) {
    try {
      d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      d = 2;
    }
    digitsCache.set(currency, d);
  }
  return d;
}

/** "1,234.5" → 123450 (for INR). Accepts commas/spaces; returns null if it isn't a number. */
export function parseAmount(input: string, currency: string): number | null {
  const cleaned = input.replace(/[\s,_']/g, "").replace(/[^\d.\-]/g, "");
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "-") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return toMinor(value, currency);
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

/** Plain number for an input box: 150050 → "1500.5". */
export function minorToInput(minor: number, currency: string): string {
  if (!minor) return "";
  const d = minorDigits(currency);
  return toMajor(minor, currency).toFixed(d).replace(/\.?0+$/, "");
}

/**
 * ₹1,500 / ₹1,500.50. Whole amounts drop the decimals so summaries read cleanly; anything with a
 * fractional part shows all minor digits.
 */
export function formatMoney(
  minor: number,
  currency: string,
  locale = "en-IN",
  opts: { sign?: boolean; alwaysDecimals?: boolean; compact?: boolean } = {},
): string {
  const d = minorDigits(currency);
  const major = toMajor(minor, currency);
  const whole = minor % 10 ** d === 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: opts.compact ? 0 : whole && !opts.alwaysDecimals ? 0 : d,
      maximumFractionDigits: opts.compact ? 1 : d,
      notation: opts.compact ? "compact" : "standard",
      signDisplay: opts.sign ? "exceptZero" : "auto",
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(d)}`;
  }
}

/** The currency's symbol on its own (₹, $, €). */
export function currencySymbol(currency: string, locale = "en-IN"): string {
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}
