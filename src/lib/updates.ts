/**
 * Update checks against the project's GitHub releases. Pure helpers here (unit-tested); the
 * Android download/install bridge and the prompt live in src/lib/client/updater.ts and
 * src/components/update-prompt.tsx.
 */
export const REPO = "tumune2119/mune-splits";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export interface ReleaseInfo {
  version: string;
  name: string;
  notes: string;
  page: string;
  apkUrl: string | null;
  windowsUrl: string | null;
  publishedAt: string;
}

/** "v1.2.3" / "1.2.3" → [1, 2, 3]; anything after a dash (pre-release) is ignored. */
function parts(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
}

/** True when `latest` is a higher version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; browser_download_url: string }[];
}

export function parseRelease(r: GitHubRelease): ReleaseInfo | null {
  if (!r?.tag_name || r.draft || r.prerelease) return null;
  const asset = (re: RegExp) => r.assets?.find((a) => re.test(a.name))?.browser_download_url ?? null;
  return {
    version: r.tag_name.replace(/^v/i, ""),
    name: r.name || r.tag_name,
    notes: r.body ?? "",
    page: r.html_url,
    apkUrl: asset(/-android\.apk$/i),
    windowsUrl: asset(/-windows-x64\.zip$/i),
    publishedAt: r.published_at,
  };
}

/**
 * Release notes are Markdown; the prompt shows them as plain lines: no headings marks, bold, or
 * links syntax, and only the lines that say what changed.
 */
export function notesToLines(md: string, max = 8): string[] {
  return md
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^#+\s*/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
        .replace(/`/g, "")
        .trim(),
    )
    .filter((l) => l.length > 0)
    .slice(0, max);
}
