/**
 * After `vite build`, write crawlable daily pages, OG images, sitemap, and robots.
 * SITE_URL (or VITE_SITE_URL) sets the canonical origin; default is the GitHub Pages URL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_DATE, localDateString } from "../src/dateSeed.ts";
import {
  kolamForDate,
  kolamOfTheDay,
  patternFromDailyRecord,
  prerenderWindow,
  resolveDailyRecord,
  resolveDailySeries,
} from "../src/generator.ts";
import { DATE_PAGE_ASSET_PREFIX, DEFAULT_SITE_URL, datePath, normalizeSiteUrl } from "../src/paths.ts";
import { buildDayPage, buildRobots, buildSitemap } from "../src/prerender/html.ts";
import { THEMES } from "../src/themes.ts";
import { kolamSvg } from "../src/render.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL);

function assetRefs(indexHtml: string): { css?: string; js?: string; prefix: string } {
  const css = indexHtml.match(/href="(\.\/)?(assets\/[^"]+\.css)"/)?.[2];
  const js = indexHtml.match(/src="(\.\/)?(assets\/[^"]+\.js)"/)?.[2];
  return { css, js, prefix: DATE_PAGE_ASSET_PREFIX };
}

function patchHomepage(indexHtml: string, today: string, start: string, end: string): string {
  const pattern = kolamOfTheDay(today);
  const svg = kolamSvg(pattern, { theme: THEMES.classic, static: true });
  const todayHref = datePath(today);
  const canonical = `${siteUrl}/`;
  let html = indexHtml;
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}"/>`,
  );
  html = html.replace(/content="https:\/\/macshivadi\.github\.io\/kolam\/og-image\.png"/g, `content="${siteUrl}/og-image.png"`);
  html = html.replace(/content="https:\/\/macshivadi\.github\.io\/kolam\/"/g, `content="${canonical}"`);
  html = html.replace(
    /<div id="stage"[^>]*>\s*<\/div>/,
    `<div id="stage" class="stage" role="img" aria-label="Today's kolam">\n        ${svg}\n      </div>`,
  );
  const heroRe = /(<p id="hero-line"[^>]*>)([^<]*)(<\/p>)/;
  if (heroRe.test(html)) {
    const [y, mo, d] = today.split("-").map(Number);
    const pretty = new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    html = html.replace(heroRe, `$1${pretty}$3`);
  }
  void todayHref;
  if (!html.includes("application/ld+json")) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Kolam",
      url: canonical,
      alternateName: "கோலம்",
    };
    html = html.replace(
      "</head>",
      `  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  </head>`,
    );
  }
  void start;
  void end;
  return html;
}

function main(): void {
  const today = process.env.KOLAM_TODAY || localDateString();
  const { start, end, dates } = prerenderWindow(today);
  const indexPath = resolve(dist, "index.html");
  const indexHtml = readFileSync(indexPath, "utf8");
  const assets = assetRefs(indexHtml);

  // Build post-launch records once so we don't walk the uniqueness series per day.
  const launchDays = dates.filter((d) => d >= LAUNCH_DATE);
  const lastLaunch = launchDays[launchDays.length - 1] ?? LAUNCH_DATE;
  const series = resolveDailySeries(lastLaunch);
  const byDate = new Map(series.map((r) => [r.date, r]));

  const preDays = dates.filter((d) => d < LAUNCH_DATE);
  if (preDays.length) {
    const prior = new Set<string>();
    let rec = resolveDailyRecord(preDays[0], prior, LAUNCH_DATE);
    prior.add(rec.canonicalHash);
    byDate.set(preDays[0], rec);
    for (let i = 1; i < preDays.length; i++) {
      rec = resolveDailyRecord(preDays[i], prior, LAUNCH_DATE, rec);
      prior.add(rec.canonicalHash);
      byDate.set(preDays[i], rec);
    }
  }

  for (const date of dates) {
    const rec = byDate.get(date);
    const pattern = rec ? patternFromDailyRecord(rec) : kolamForDate(date);
    const page = buildDayPage({
      date,
      pattern,
      siteUrl,
      assets,
      minDate: start,
      maxDate: end,
    });
    const dir = resolve(dist, datePath(date));
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "index.html"), page.html);
    writeFileSync(resolve(dir, "og.svg"), page.ogSvg);
  }

  writeFileSync(indexPath, patchHomepage(indexHtml, today, start, end));
  writeFileSync(resolve(dist, "sitemap.xml"), buildSitemap(siteUrl, dates));
  writeFileSync(resolve(dist, "robots.txt"), buildRobots(siteUrl));
  console.log(`Prerendered ${dates.length} day pages (${start} … ${end}) for ${siteUrl}`);
}

main();
