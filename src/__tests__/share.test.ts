import { describe, expect, it } from "vitest";
import { shareText, shareTextShort, whatsappShareUrl, xShareUrl } from "../share";

const daily = {
  kind: "daily" as const,
  url: "https://macshivadi.github.io/kolam/?date=2026-11-17",
  number: 1,
  date: "2026-11-17",
};

const generated = {
  kind: "generated" as const,
  url: "https://macshivadi.github.io/kolam/?grid=7x7&seed=42",
};

describe("share invites", () => {
  it("invites a friend to today's kolam with the number and date link", () => {
    const text = shareText(daily);
    expect(text).toContain("Hey! Come draw today's kolam with me");
    expect(text).toContain("🌸");
    expect(text).toContain("Kolam #1");
    expect(text).toContain("practice it and share yours:");
    expect(text).toContain("?date=2026-11-17");
  });

  it("uses a made-this-kolam invite for generated patterns", () => {
    const text = shareText(generated);
    expect(text).toBe(
      "I made this kolam — come practice and draw with me! https://macshivadi.github.io/kolam/?grid=7x7&seed=42",
    );
  });

  it("keeps the X text short and puts the URL in the url param", () => {
    const dailyShort = shareTextShort(daily);
    expect(dailyShort.length).toBeLessThan(120);
    expect(dailyShort).not.toContain("http");
    const x = xShareUrl(daily);
    expect(x).toContain("twitter.com/intent/tweet");
    expect(decodeURIComponent(x)).toContain("?date=2026-11-17");
    expect(decodeURIComponent(xShareUrl(generated).replace(/\+/g, " "))).toContain(shareTextShort(generated));
  });

  it("packs the full daily invite into the WhatsApp fallback", () => {
    const wa = whatsappShareUrl(daily);
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa)).toContain("Kolam #1");
    expect(decodeURIComponent(wa)).toContain("?date=2026-11-17");
  });
});
