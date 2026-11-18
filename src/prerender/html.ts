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
import { festivalOn, festivalChipText } from "../festivals";
import { styleForFestival, styleUsesColor } from "../styles";
import { colorRegions } from "../regions";
import { defaultColorMode, rangoliPalette } from "../palettes";

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

function compactHeroLine(date: string, number: number, pulli: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const pretty = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const n = number >= 1 ? ` · #${number}` : "";
  return `${pretty}${n} · ${pulli}`;
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
  const style = festival ? styleForFestival(festival.id) : "line";
  const theme = THEMES[festival?.theme ?? "classic"];
  const autoColor = defaultColorMode(number, Boolean(festival));
  const fills = styleUsesColor(style, autoColor)
    ? colorRegions(pattern, rangoliPalette(theme.id, festival?.id))
    : undefined;
  const svg = kolamSvg(pattern, { theme, static: true, fills, style });
  const ogSvg = ogShareSvg(pattern, theme, `கோலம் · ${shortDateLabel(date)}`, style, fills);
  const jsonLd = buildJsonLd({ date, siteUrl, title, description, number });
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const showPrev = !minDate || prev >= minDate;
  const showNext = !maxDate || next <= maxDate;
  const prefix = input.assets.prefix || DATE_PAGE_ASSET_PREFIX;
  const cssHref = input.assets.css ? `${prefix}${input.assets.css.replace(/^\.\//, "")}` : "";
  const jsSrc = input.assets.js ? `${prefix}${input.assets.js.replace(/^\.\//, "")}` : "";

  const prevHref = showPrev ? relativeBetweenDates(date, prev) : "";
  const nextHref = showNext ? relativeBetweenDates(date, next) : "";
  const homeHref = prefix || "./";
  const hero = compactHeroLine(date, number, pulliLabel(pattern.spec));
  const festChip = festival
    ? `<p id="festival-chip" class="festival-chip">${escapeHtml(festivalChipText(festival))}</p>`
    : `<p id="festival-chip" class="festival-chip" hidden></p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <link rel="canonical" href="${escapeHtml(canonical)}"/>
  <meta name="theme-color" content="#f5eadc"/>
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
  <div class="sky" aria-hidden="true"></div>
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
        <span class="brand-text"><span lang="ta">கோலம்</span> <span class="dot">·</span> Kolam</span>
      </a>
      <span class="lamp" id="lamp" hidden aria-hidden="true"></span>
      <button type="button" id="menu-btn" class="icon-btn menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="menu-panel">☰</button>
    </header>
    <section class="hero">
      <div class="hero-meta">
        ${showPrev ? `<a id="prev-day" class="icon-btn" rel="prev" href="${prevHref}" aria-label="Previous day">←</a>` : `<a id="prev-day" class="icon-btn" href="#" aria-label="Previous day" aria-disabled="true">←</a>`}
        <h1 id="hero-line" class="hero-line">${escapeHtml(hero)}</h1>
        ${showNext ? `<a id="next-day" class="icon-btn" rel="next" href="${nextHref}" aria-label="Next day">→</a>` : `<a id="next-day" class="icon-btn" href="#" aria-label="Next day" aria-disabled="true">→</a>`}
      </div>
      ${festChip}
      <div class="hero-pills"><button type="button" id="back-today" class="pill" hidden>Today</button></div>
      <p id="canvas-label" class="canvas-label" hidden>Your kolam</p>
      <div id="stage" class="stage" role="img" aria-label="${escapeHtml(title)}">
        ${svg}
      </div>
      <div class="primary-actions no-print">
        <button type="button" id="replay" class="btn">Draw along</button>
        <button type="button" id="save-png" class="btn">Save</button>
        <button type="button" id="share" class="btn btn-primary">Share</button>
      </div>
      <div id="draw-along" class="draw-along no-print" hidden>
        <div id="watch-controls">
          <button type="button" id="watch-pause" class="btn">Pause</button>
          <div class="speed" role="group" aria-label="Speed">
            <button type="button" id="speed-slow" data-speed="slow" aria-pressed="true">Slow</button>
            <button type="button" id="speed-normal" data-speed="normal">Normal</button>
          </div>
          <button type="button" id="draw-close" class="pill">Done</button>
        </div>
      </div>
    </section>
    <details id="create-card" class="create-card no-print">
      <summary>Create your own</summary>
      <p class="create-hint">Pick a grid and tap Generate for a new pattern — today's kolam stays the same for everyone.</p>
      <fieldset class="chip-row">
        <legend>Grid</legend>
        <button type="button" class="chip" data-grid="5x5">5×5</button>
        <button type="button" class="chip" data-grid="7x7">7×7</button>
        <button type="button" class="chip" data-grid="9x9">9×9</button>
        <button type="button" class="chip" data-grid="11x11">11×11</button>
        <button type="button" class="chip" data-grid="d5">5–1</button>
        <button type="button" class="chip" data-grid="d7">7–1</button>
        <button type="button" class="chip" data-grid="d9">9–1</button>
        <button type="button" class="chip" data-grid="d95">9–5</button>
        <button type="button" class="chip" data-grid="d158">15–8</button>
      </fieldset>
      <button type="button" id="generate" class="btn btn-primary">Generate</button>
    </details>
    <footer class="site-footer no-print">
      <a id="wa-contact" class="wa-link" href="https://wa.me/message/XKYNNMUO6ITZB1?src=qr" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
    </footer>
  </div>
  <div id="menu-panel" class="sheet no-print" hidden>
    <div class="sheet-backdrop" data-close="menu"></div>
    <div class="sheet-card" role="dialog" aria-labelledby="menu-title">
      <div class="sheet-head"><h2 id="menu-title">Menu</h2><button type="button" class="icon-btn" data-close="menu" aria-label="Close menu">×</button></div>
      <p class="menu-label">Rice flour or rangoli color</p>
      <div class="color-toggle" role="group" aria-label="Rice flour or rangoli color">
        <button type="button" id="color-white">White</button>
        <button type="button" id="color-on">Color</button>
      </div>
      <label class="toggle"><input type="checkbox" id="sound-toggle"/> <span>Sound on Draw along</span></label>
      <button type="button" id="about-btn" class="btn">About</button>
    </div>
  </div>
  <div id="about-panel" class="sheet no-print" hidden>
    <div class="sheet-backdrop" data-close="about"></div>
    <div class="sheet-card" role="dialog" aria-labelledby="about-title">
      <div class="sheet-head"><h2 id="about-title">About</h2><button type="button" class="icon-btn" data-close="about" aria-label="Close">×</button></div>
      <p>A sikku kolam is a continuous rice-flour line that loops around a grid of dots.</p>
    </div>
  </div>
  <div id="share-sheet" class="sheet no-print" hidden>
    <div class="sheet-backdrop" data-close="share"></div>
    <div class="sheet-card" role="dialog" aria-labelledby="share-title">
      <div class="sheet-head"><h2 id="share-title">Share</h2><button type="button" class="icon-btn" data-close="share" aria-label="Close share">×</button></div>
      <div class="share-row">
        <a id="share-wa" class="share-link" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a id="share-fb" class="share-link" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a id="share-x" class="share-link" target="_blank" rel="noopener noreferrer">X</a>
        <button type="button" id="copy-link" class="share-link as-button">Copy link</button>
        <button type="button" id="print-mono" class="share-link as-button">Print (white on black)</button>
        <button type="button" id="print-color" class="share-link as-button">Print (color)</button>
      </div>
    </div>
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
