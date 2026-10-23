import { describe, expect, it } from "vitest";
import { androidIntent, inAppRoute } from "./deep-links";

const sid = "AbCdEfGhIjKlMnOpQrStUv";
const link = `https://tumune2119.github.io/mune-splits/join?e=${sid}`;

describe("invite links in the app", () => {
  it("turns an invite link into the in-app join route", () => {
    expect(inAppRoute(link)).toBe(`/join?e=${sid}`);
    expect(inAppRoute(`https://tumune2119.github.io/mune-splits/join/?e=${sid}&web=1`)).toBe(`/join?e=${sid}`);
  });

  it("ignores links that aren't invites to this app", () => {
    expect(inAppRoute("https://tumune2119.github.io/mune-splits/join")).toBeNull();
    expect(inAppRoute(`https://tumune2119.github.io/mune-splits/settings?e=${sid}`)).toBeNull();
    expect(inAppRoute(`https://evil.example/mune-splits/join?e=${sid}`)).toBeNull();
    expect(inAppRoute(`http://tumune2119.github.io/mune-splits/join?e=${sid}`)).toBeNull();
    expect(inAppRoute("not a url")).toBeNull();
  });

  it("builds a Chrome intent that falls back to the website", () => {
    const intent = androidIntent(link, `${link}&web=1`);
    expect(intent).toBe(
      `intent://tumune2119.github.io/mune-splits/join?e=${sid}#Intent;scheme=https;package=io.github.tumune2119.munesplits;` +
        `S.browser_fallback_url=${encodeURIComponent(`${link}&web=1`)};end`,
    );
  });
});
