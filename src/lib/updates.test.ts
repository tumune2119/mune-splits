import { describe, expect, it } from "vitest";
import { isNewer, notesToLines, parseRelease } from "./updates";

describe("update checks", () => {
  it("compares versions numerically, not as text", () => {
    expect(isNewer("0.4.1", "0.4.0")).toBe(true);
    expect(isNewer("v0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
    expect(isNewer("0.4.0", "0.4.0")).toBe(false);
    expect(isNewer("0.3.9", "0.4.0")).toBe(false);
    expect(isNewer("0.5", "0.4.9")).toBe(true);
    expect(isNewer("0.5.0-beta.1", "0.5.0")).toBe(false);
  });

  it("finds the Android and Windows downloads in a release", () => {
    const r = parseRelease({
      tag_name: "v0.5.0",
      name: "MUNE Splits 0.5.0",
      body: "**New:** things",
      html_url: "https://github.com/tumune2119/mune-splits/releases/tag/v0.5.0",
      published_at: "2026-10-24T00:00:00Z",
      assets: [
        { name: "MUNE-Splits-0.5.0-windows-x64.zip", browser_download_url: "https://github.com/tumune2119/mune-splits/releases/download/v0.5.0/MUNE-Splits-0.5.0-windows-x64.zip" },
        { name: "MUNE-Splits-0.5.0-android.apk", browser_download_url: "https://github.com/tumune2119/mune-splits/releases/download/v0.5.0/MUNE-Splits-0.5.0-android.apk" },
      ],
    })!;
    expect(r.version).toBe("0.5.0");
    expect(r.apkUrl).toMatch(/-android\.apk$/);
    expect(r.windowsUrl).toMatch(/-windows-x64\.zip$/);
  });

  it("ignores drafts and pre-releases", () => {
    expect(parseRelease({ tag_name: "v9.0.0", html_url: "", published_at: "", prerelease: true })).toBeNull();
    expect(parseRelease({ tag_name: "v9.0.0", html_url: "", published_at: "", draft: true })).toBeNull();
  });

  it("turns release notes into plain lines", () => {
    expect(notesToLines("### What's new\n\n- **Bigger** buttons\n- See [the README](https://x)\n")).toEqual([
      "What's new",
      "- Bigger buttons",
      "- See the README",
    ]);
  });
});
