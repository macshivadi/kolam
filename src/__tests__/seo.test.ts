import { describe, expect, it } from "vitest";
import { LAUNCH_DATE, addDays, kolamNumber } from "../dateSeed";
import { kolamForDate, kolamOfTheDay, prerenderWindow } from "../generator";
import {
  DATE_PAGE_ASSET_PREFIX,
  DEFAULT_SITE_URL,
  datePageUrl,
  datePath,
  normalizeSiteUrl,
  ogImageUrl,
  pageTitle,
  parseDatePath,
  appRootFromPathname,
  relativeBetweenDates,
  shortDateLabel,
} from "../paths";
import { buildDayPage, buildRobots, buildSitemap, buildJsonLd } from "../prerender/html";

describe("date paths and canonicals", () => {
  it("builds trailing-slash date paths and absolute canonicals", () => {
    expect(datePath("2026-11-18")).toBe("2026/11/18/");
    expect(datePageUrl(DEFAULT_SITE_URL, "2026-11-18")).toBe(
      "https://macshivadi.github.io/kolam/2026/11/18/",
    );
    expect(datePageUrl("https://kolam.com/", "2026-11-18")).toBe(
      "https://kolam.com/2026/11/18/",
    );
    expect(ogImageUrl("https://kolam.com", "2026-11-18")).toBe(
      "https://kolam.com/2026/11/18/og.svg",
    );
    expect(normalizeSiteUrl("https://kolam.com/")).toBe("https://kolam.com");
  });

  it("formats the SEO title as 'Kolam for Mon D, YYYY | Kolam'", () => {
    expect(shortDateLabel("2026-11-18")).toBe("Nov 18, 2026");
    expect(pageTitle("2026-11-18")).toBe("Kolam for Nov 18, 2026 | Kolam");
  });

  it("parses date paths and app roots for both /kolam/ and the apex", () => {
    expect(parseDatePath("/kolam/2026/11/18/")).toBe("2026-11-18");
    expect(parseDatePath("/2026/11/18/")).toBe("2026-11-18");
    expect(parseDatePath("/kolam/")).toBeNull();
    expect(appRootFromPathname("/kolam/2026/11/18/")).toBe("/kolam/");
    expect(appRootFromPathname("/2026/11/18/")).toBe("/");
    expect(appRootFromPathname("/kolam/")).toBe("/kolam/");
    expect(appRootFromPathname("/kolam/index.html")).toBe("/kolam/");
  });

  it("uses relative prev/next links so nested depths work on Pages and at the apex", () => {
    expect(relativeBetweenDates("2026-11-18", "2026-11-17")).toBe("../17/");
    expect(relativeBetweenDates("2026-11-01", "2026-10-31")).toBe("../../10/31/");
    expect(relativeBetweenDates("2026-01-01", "2025-12-31")).toBe("../../../2025/12/31/");
    expect(DATE_PAGE_ASSET_PREFIX).toBe("../../../");
  });
});

describe("prerendered day pages", () => {
  it("emits unique title, canonical, JSON-LD, prev/next, and crawlable SVG", () => {
    const date = "2026-11-18";
    const pattern = kolamOfTheDay(date);
    const page = buildDayPage({
      date,
      pattern,
      siteUrl: DEFAULT_SITE_URL,
      assets: { css: "assets/index.css", js: "assets/index.js", prefix: "../../../" },
      minDate: "2025-11-17",
      maxDate: "2026-11-19",
    });

    expect(page.title).toBe("Kolam for Nov 18, 2026 | Kolam");
    expect(page.canonical).toBe("https://macshivadi.github.io/kolam/2026/11/18/");
    expect(page.path).toBe("2026/11/18/");
    expect(page.html).toContain(`<title>${page.title}</title>`);
    expect(page.html).toContain(`<link rel="canonical" href="${page.canonical}"/>`);
    expect(page.html).toContain(`<meta property="og:url" content="${page.canonical}"/>`);
    expect(page.html).toContain(`<meta property="og:image" content="${page.ogImage}"/>`);
    expect(page.html).toContain('href="../../../assets/index.css"');
    expect(page.html).toContain('src="../../../assets/index.js"');
    expect(page.html).toContain("<svg");
    expect(page.html).toContain('class="kolam-svg"');
    expect(page.html).toContain('rel="prev"');
    expect(page.html).toContain("../17/");
    expect(page.html).toContain('rel="next"');
    expect(page.html).toContain("../19/");
    expect(page.html).toContain("application/ld+json");

    expect(page.jsonLd["@type"]).toBe("CreativeWork");
    expect(page.jsonLd.url).toBe(page.canonical);
    expect(page.jsonLd.dateCreated).toBe(date);
    const image = page.jsonLd.image as { "@type": string; url: string };
    expect(image["@type"]).toBe("ImageObject");
    expect(image.url).toBe(page.ogImage);
    expect(page.ogSvg).toContain('width="1200"');
    expect(page.ogSvg).toContain("<svg");

    const ld = buildJsonLd({
      date,
      siteUrl: "https://kolam.com",
      title: page.title,
      description: page.description,
      number: kolamNumber(date),
    });
    expect(ld.url).toBe("https://kolam.com/2026/11/18/");
  });

  it("does not change the published uniqueness series for dates after launch", () => {
    const a = kolamOfTheDay(LAUNCH_DATE);
    const b = kolamForDate(LAUNCH_DATE);
    expect(b.canonicalHash).toBe(a.canonicalHash);
    expect(kolamForDate(addDays(LAUNCH_DATE, 10)).canonicalHash).toBe(
      kolamOfTheDay(addDays(LAUNCH_DATE, 10)).canonicalHash,
    );
  });

  it("builds a sitemap and robots.txt against SITE_URL", () => {
    const sitemap = buildSitemap("https://kolam.com/", ["2026-11-17", "2026-11-18"]);
    expect(sitemap).toContain("<loc>https://kolam.com/</loc>");
    expect(sitemap).toContain("<loc>https://kolam.com/2026/11/17/</loc>");
    expect(sitemap).toContain("<loc>https://kolam.com/2026/11/18/</loc>");
    const robots = buildRobots("https://kolam.com/");
    expect(robots).toContain("Sitemap: https://kolam.com/sitemap.xml");
  });

  it("covers a year before launch through today + 1", () => {
    const win = prerenderWindow("2026-11-17");
    expect(win.start).toBe("2025-11-17");
    expect(win.end).toBe("2026-11-18");
    expect(win.dates[0]).toBe("2025-11-17");
    expect(win.dates[win.dates.length - 1]).toBe("2026-11-18");
    expect(win.dates).toContain("2026-11-17");
  });
});
