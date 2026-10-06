/** Date and text helpers shared by server and client. */

const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

export function formatDate(d: string, locale = "en-IN", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  try {
    return parse(d).toLocaleDateString(locale, opts);
  } catch {
    return d;
  }
}

export function formatDateLong(d: string, locale = "en-IN") {
  return formatDate(d, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** "12–16 Sep 2026", "28 Sep – 2 Oct 2026", or a single date. */
export function formatRange(start: string | null, end: string | null, locale = "en-IN"): string {
  if (!start && !end) return "";
  if (!start || !end || start === end) return formatDate((start ?? end)!, locale, { day: "numeric", month: "short", year: "numeric" });
  const a = parse(start);
  const b = parse(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${a.getDate()}–${b.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  const left = a.toLocaleDateString(locale, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${b.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function formatTimestamp(ms: number, locale = "en-IN") {
  return new Date(ms).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Safe for file names: "Goa Trip!" → "Goa-Trip". */
export function fileSafe(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "event"
  );
}
