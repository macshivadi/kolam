import { addDays, kolamNumber } from "../dateSeed";
import type { KolamPattern } from "../generator";
import {
  DATE_PAGE_ASSET_PREFIX,
  datePageUrl,
  datePath,
  ogImageUrl,
  pageDescription,
  pageTitle,
  relativeBetweenDates,
  shortDateLabel,
  normalizeSiteUrl,
} from "../paths";
import { kolamSvg, ogShareSvg } from "../render";
import { THEMES } from "../themes";
import { pulliLabel } from "../grid";
import { festivalOn } from "../festivals";

export type AssetRefs = {
  css?: string;
  js?: string;
  /** Prefix from this page to the site root, e.g. ../../../ */
  prefix: string;
};

export type DayPageInput = {
  date: string;
  pattern: KolamPattern;
  siteUrl: string;
  assets: AssetRefs;
  /** Inclusive window, used to hide next/prev when out of range. */
  minDate?: string;
  maxDate?: string;
};

export type DayPage = {
  date: string;
  path: string;
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  html: string;
  jsonLd: Record<string, unknown>;
  ogSvg: string;
};

export function buildJsonLd(opts: {
  date: string;
  siteUrl: string;
  title: string;
  description: string;
  number?: number;
}): Record<string, unknown> {
  const canonical = datePageUrl(opts.siteUrl, opts.date);
  const image = ogImageUrl(opts.siteUrl, opts.date);
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: opts.title,
    url: canonical,
    dateCreated: opts.date,
    description: opts.description,
    inLanguage: "en",
    ...(opts.number !== undefined && opts.number >= 1 ? { position: opts.number } : {}),
    image: {
      "@type": "ImageObject",
      url: image,
      encodingFormat: "image/svg+xml",
      width: 1200,
      height: 630,
    },
  };
}

export function buildDayPage(input: DayPageInput): DayPage {
  const { date, pattern, minDate, maxDate } = input;
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const festival = festivalOn(date);
  const title = pageTitle(date, festival?.name);
  const number = kolamNumber(date);
  const description = pageDescription(date, number, festival);
  const canonical = datePageUrl(siteUrl, date);
  const ogImage = ogImageUrl(siteUrl, date);
  const theme = THEMES[festival?.theme ?? "classic"];
  const svg = kolamSvg(pattern, { theme, static: true });
  const ogSvg = ogShareSvg(pattern, theme, `கோலம் · ${shortDateLabel(date)}`);
  const jsonLd = buildJsonLd({ date, siteUrl, title, description, number });
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const showPrev = !minDate || prev >= minDate;
  const showNext = !maxDate || next <= maxDate;
  const prefix = input.assets.prefix || DATE_PAGE_ASSET_PREFIX;
  const cssHref = input.assets.css ? `${prefix}${input.assets.css.replace(/^\.\//, "")}` : "";
  const jsSrc = input.assets.js ? `${prefix}${input.assets.js.replace(/^\.\//, "")}` : "";

  const prevLink = showPrev
    ? `<a class="day-nav-link" rel="prev" href="${relativeBetweenDates(date, prev)}">← ${shortDateLabel(prev)}</a>`
    : `<span class="day-nav-link is-disabled">←</span>`;
  const nextLink = showNext
    ? `<a class="day-nav-link" rel="next" href="${relativeBetweenDates(date, next)}">${shortDateLabel(next)} →</a>`
    : `<span class="day-nav-link is-disabled">→</span>`;
  const homeHref = prefix || "./";
  const numHtml = number >= 1 ? ` <span class="kolam-num">#${number}</span>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <link rel="canonical" href="${escapeHtml(canonical)}"/>
  <meta name="theme-color" content="${theme.floor}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="Kolam"/>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(description)}"/>
  <meta property="og:url" content="${escapeHtml(canonical)}"/>
  <meta property="og:image" content="${escapeHtml(ogImage)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(title)}"/>
  <meta name="twitter:description" content="${escapeHtml(description)}"/>
  <meta name="twitter:image" content="${escapeHtml(ogImage)}"/>
  <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="${prefix}favicon-32.png" type="image/png" sizes="32x32"/>
  <link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png"/>
  ${cssHref ? `<link rel="stylesheet" href="${cssHref}"/>` : ""}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <a class="skip" href="#stage">Skip to kolam</a>
  <div class="page">
    <header class="site-header">
      <a class="brand" href="${homeHref}">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 1440 1440" role="img" aria-hidden="true">
            <path fill="currentColor" d="M720 515 L925 720 L720 925 L515 720 Z"/>
            <path fill="currentColor" d="M1015 720 L1175.5325 602.8663 A145 145 0 1 1 1175.5325 837.1337 Z"/>
            <path fill="currentColor" d="M720 1015 L837.1337 1175.5325 A145 145 0 1 1 602.8663 1175.5325 Z"/>
            <path fill="currentColor" d="M425 720 L264.4675 837.1337 A145 145 0 1 1 264.4675 602.8663 Z"/>
            <path fill="currentColor" d="M720 425 L602.8663 264.4675 A145 145 0 1 1 837.1337 264.4675 Z"/>
          </svg>
        </span>
        <span class="brand-text"><span lang="ta">கோலம்</span> · Kolam</span>
      </a>
      <p class="tagline">A new sikku kolam every day. Save it, print it, draw it.</p>
    </header>

    <article class="day-article">
      <p class="eyebrow" id="eyebrow">Kolam of the Day</p>
      <h1>${escapeHtml(festival ? `${festival.name} Kolam for ${shortDateLabel(date)}` : `Kolam for ${shortDateLabel(date)}`)}</h1>
      ${festival ? `<p id="festival-banner" class="festival-banner">${escapeHtml(festival.greeting)}${festival.dayLabel && festival.dayLabel !== festival.name ? ` · ${escapeHtml(festival.dayLabel)}` : ""}</p>` : `<p id="festival-banner" class="festival-banner" hidden></p>`}
      <p class="day-meta">${escapeHtml(pulliLabel(pattern.spec))}${numHtml}</p>
      <nav class="day-links" aria-label="Other days">
        ${prevLink}
        <a class="day-nav-link" href="${homeHref}">Home</a>
        ${nextLink}
      </nav>
    </article>

    <section class="daily-bar" aria-live="polite">
      <div class="date-nav">
        <button type="button" id="prev-day" class="icon-btn" aria-label="Previous day">←</button>
        <div class="date-block">
          <p id="date-label" class="date-label">${escapeHtml(shortDateLabel(date))}</p>
          <p id="kolam-num" class="kolam-num">${number >= 1 ? `#${number}` : ""}</p>
            <p id="pulli-label" class="pulli-label">${escapeHtml(pulliLabel(pattern.spec))}</p>
        </div>
        <button type="button" id="next-day" class="icon-btn" aria-label="Next day">→</button>
      </div>
      <a id="permalink" class="permalink" href="">Permanent page</a>
      <button type="button" id="back-today" class="text-btn" hidden>Today's kolam</button>
    </section>

    <div id="stage" class="stage" role="img" aria-label="${escapeHtml(title)}">
      ${svg}
    </div>

    <div class="controls no-print">
      <button type="button" id="replay" class="btn">Replay</button>
      <fieldset class="chip-row">
        <legend>Grid</legend>
        <button type="button" class="chip" data-grid="5x5">5×5</button>
        <button type="button" class="chip" data-grid="7x7">7×7</button>
        <button type="button" class="chip" data-grid="9x9">9×9</button>
        <button type="button" class="chip" data-grid="11x11">11×11</button>
        <button type="button" class="chip" data-grid="d5">5-1</button>
        <button type="button" class="chip" data-grid="d7">7-1</button>
        <button type="button" class="chip" data-grid="d9">9-1</button>
        <button type="button" class="chip" data-grid="d95">9-5</button>
      </fieldset>
      <button type="button" id="generate" class="btn btn-primary">Generate</button>
      <fieldset class="chip-row">
        <legend>Theme</legend>
        <button type="button" class="chip" data-theme="classic">Classic</button>
        <button type="button" class="chip" data-theme="pongal">Pongal · Sankranti</button>
        <button type="button" class="chip" data-theme="diwali">Diwali</button>
        <button type="button" class="chip" data-theme="christmas">Christmas</button>
      </fieldset>
      <div class="actions">
        <button type="button" id="save-png" class="btn">Save PNG</button>
        <button type="button" id="print" class="btn">Print</button>
        <button type="button" id="share" class="btn btn-primary">Share</button>
      </div>
      <div class="share-row" aria-label="Share">
        <a id="share-wa" class="share-link" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a id="share-fb" class="share-link" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a id="share-x" class="share-link" target="_blank" rel="noopener noreferrer">X</a>
        <button type="button" id="copy-link" class="share-link as-button">Copy invite</button>
      </div>
    </div>

    <footer class="site-footer no-print">
      <a id="wa-contact" class="wa-link" href="https://wa.me/message/XKYNNMUO6ITZB1?src=qr" target="_blank" rel="noopener noreferrer">
        Chat with Kolam on WhatsApp
      </a>
    </footer>
  </div>
  <div id="toast" class="toast no-print" role="status"></div>
  ${jsSrc ? `<script type="module" crossorigin src="${jsSrc}"></script>` : ""}
</body>
</html>
`;

  return {
    date,
    path: datePath(date),
    title,
    description,
    canonical,
    ogImage,
    html,
    jsonLd,
    ogSvg,
  };
}

export function buildSitemap(siteUrl: string, dates: string[]): string {
  const origin = normalizeSiteUrl(siteUrl);
  const urls = [
    sitemapEntry(`${origin}/`, undefined, "daily"),
    ...dates.map((d) => sitemapEntry(datePageUrl(origin, d), d, "weekly")),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

function sitemapEntry(loc: string, lastmod?: string, changefreq = "weekly"): string {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${loc}</loc>${lm}\n    <changefreq>${changefreq}</changefreq>\n  </url>`;
}

export function buildRobots(siteUrl: string): string {
  const origin = normalizeSiteUrl(siteUrl);
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
