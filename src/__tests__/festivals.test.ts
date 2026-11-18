import { describe, expect, it } from "vitest";
import { defaultThemeForDate, festivalOn, festivalChipText } from "../festivals";
import { kolamOfTheDay } from "../generator";
import { pageDescription, pageTitle } from "../paths";
import { buildDayPage } from "../prerender/html";
import { THEME_IDS } from "../themes";

describe("festival calendar 2025–2030", () => {
  it("shows Happy Deepavali once, without repeating the day name", () => {
    const f = festivalOn("2026-11-08");
    expect(f).toBeTruthy();
    expect(festivalChipText(f!)).toBe("Happy Deepavali");
    expect(festivalChipText(f!)).not.toContain("·");
  });

  it("keeps the coinciding harvest greeting short", () => {
    const f = festivalOn("2026-01-14");
    expect(f).toBeTruthy();
    const chip = festivalChipText(f!);
    expect(chip).toContain("Happy Pongal");
    expect(chip).toContain("Makara Sankranti");
    expect(chip.split("Pongal").length - 1).toBe(1);
    expect(chip.split("Makara Sankranti").length - 1).toBe(1);
  });

  it("uses the Timeanddate India Diwali (Deepavali) dates", () => {
    const dates: Record<string, string> = {
      "2025-10-20": "2025",
      "2026-11-08": "2026",
      "2027-10-29": "2027",
      "2028-10-17": "2028",
      "2029-11-05": "2029",
      "2030-10-26": "2030",
    };
    for (const date of Object.keys(dates)) {
      const f = festivalOn(date);
      expect(f?.id).toBe("diwali");
      expect(f?.theme).toBe("diwali");
      expect(f?.name).toBe("Diwali");
      expect(f?.greeting).toBe("Happy Deepavali");
    }
    expect(festivalOn("2026-11-18")).toBeUndefined();
  });

  it("treats Pongal and Makara Sankranti as one harvest festival with one theme", () => {
    // 2026: official Pongal and Sankranti both fall on Jan 14 (timeanddate.com).
    const thai = festivalOn("2026-01-14");
    expect(thai?.id).toBe("harvest");
    expect(thai?.theme).toBe("pongal");
    expect(thai?.name).toBe("Pongal · Makara Sankranti");
    expect(thai?.dayLabel).toContain("Thai Pongal");
    expect(thai?.dayLabel).toContain("Makara Sankranti");
    expect(thai?.seoTerms).toMatch(/muggulu/);
    expect(thai?.seoTerms).toMatch(/rangoli/);
    expect(thai?.seoTerms).toMatch(/Sankranti/);

    expect(festivalOn("2026-01-13")?.dayLabel).toBe("Bhogi");
    expect(festivalOn("2026-01-15")?.dayLabel).toBe("Mattu Pongal");
    expect(festivalOn("2026-01-16")?.dayLabel).toBe("Kaanum Pongal");
    expect(festivalOn("2026-01-13")?.theme).toBe("pongal");

    // 2027: Sankranti is Jan 14, official Pongal is Jan 15 — still one theme.
    const bhogiSankranti = festivalOn("2027-01-14");
    expect(bhogiSankranti?.id).toBe("harvest");
    expect(bhogiSankranti?.theme).toBe("pongal");
    expect(bhogiSankranti?.name).toBe("Pongal · Makara Sankranti");
    expect(bhogiSankranti?.dayLabel).toContain("Bhogi");
    expect(bhogiSankranti?.dayLabel).toContain("Makara Sankranti");
    expect(festivalOn("2027-01-15")?.dayLabel).toBe("Thai Pongal");
    expect(festivalOn("2027-01-15")?.theme).toBe("pongal");

    // There is no separate Sankranti theme.
    expect(THEME_IDS).toEqual(["classic", "pongal", "diwali", "christmas"]);
    expect(THEME_IDS).not.toContain("sankranti");
  });

  it("keeps Christmas as its own theme on 25 December", () => {
    const f = festivalOn("2026-12-25");
    expect(f?.id).toBe("christmas");
    expect(f?.theme).toBe("christmas");
    expect(f?.name).toBe("Christmas");
    expect(defaultThemeForDate("2026-12-25")).toBe("christmas");
    expect(defaultThemeForDate("2026-12-24")).toBe("classic");
  });

  it("covers optional Onam, Navaratri, Karthigai Deepam, and New Year", () => {
    expect(festivalOn("2026-08-26")?.id).toBe("onam");
    expect(festivalOn("2026-10-11")?.id).toBe("navaratri");
    expect(festivalOn("2026-10-20")?.dayLabel).toBe("Vijayadashami");
    expect(festivalOn("2026-11-24")?.id).toBe("karthigai");
    expect(festivalOn("2026-01-01")?.id).toBe("newyear");
  });
});

describe("festival SEO pages", () => {
  it("titles a Diwali page as 'Diwali Kolam for …'", () => {
    expect(pageTitle("2026-11-08", "Diwali")).toBe("Diwali Kolam for Nov 8, 2026 | Kolam");
    const desc = pageDescription("2026-11-08", 1, {
      name: "Diwali",
      dayLabel: "Deepavali",
      seoTerms: "Diwali, Deepavali, Festival of Lights, kolam",
    });
    expect(desc).toContain("Diwali");
    expect(desc).toContain("Deepavali");
  });

  it("names harvest pages inclusively and mentions muggulu and rangoli", () => {
    const name = "Pongal · Makara Sankranti";
    expect(pageTitle("2026-01-14", name)).toBe(
      "Pongal · Makara Sankranti Kolam for Jan 14, 2026 | Kolam",
    );
    const desc = pageDescription("2026-01-14", 1, {
      name,
      dayLabel: "Thai Pongal · Makara Sankranti",
      seoTerms: "Pongal, Makara Sankranti, Sankranti, muggulu, rangoli, and kolam",
    });
    expect(desc).toContain("Pongal · Makara Sankranti");
    expect(desc).toContain("muggulu");
    expect(desc).toContain("rangoli");
    expect(desc).toContain("Sankranti");
  });

  it("prerenders festival days in the festival theme without changing the pattern", () => {
    const date = "2026-11-08";
    const pattern = kolamOfTheDay(date);
    const page = buildDayPage({
      date,
      pattern,
      siteUrl: "https://kolam.com",
      assets: { prefix: "../../../" },
    });
    expect(page.title).toBe("Diwali Kolam for Nov 8, 2026 | Kolam");
    expect(page.html).toContain("Happy Deepavali");
    expect(page.html).not.toContain("Happy Deepavali · Deepavali");
    expect(page.html).toContain("#0c1026"); // diwali floor
    expect(page.jsonLd.description).toEqual(page.description);
    expect(page.description).toContain("Diwali");

    const ordinary = kolamOfTheDay("2026-11-18");
    expect(pattern.canonicalHash).not.toBe("");
    // Festival styling is independent of the uniqueness series.
    expect(kolamOfTheDay(date).canonicalHash).toBe(pattern.canonicalHash);
    expect(ordinary.canonicalHash).not.toBe(pattern.canonicalHash);
  });
});
