import { isValidDateString } from "./dateSeed";

/** Default public origin, including the GitHub Pages subpath. No trailing slash. */
export const DEFAULT_SITE_URL = "https://macshivadi.github.io/kolam";

export function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function resolveSiteUrl(explicit?: string): string {
  if (explicit) return normalizeSiteUrl(explicit);
  const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
  const raw = meta?.VITE_SITE_URL || meta?.SITE_URL;
  return normalizeSiteUrl(raw || DEFAULT_SITE_URL);
}

/** URL path of a day's page, always with a trailing slash: 2026/11/18/ */
export function datePath(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}/`;
}

export function datePageUrl(siteUrl: string, dateStr: string): string {
  return `${normalizeSiteUrl(siteUrl)}/${datePath(dateStr)}`;
}

export function ogImageUrl(siteUrl: string, dateStr: string): string {
  return `${datePageUrl(siteUrl, dateStr)}og.svg`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 'Nov 18' — month and day of a YYYY-MM-DD local date. */
export function monthDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

/** 'Nov 18, 2026' — used in <title> and share cards. */
export function shortDateLabel(dateStr: string): string {
  const [y] = dateStr.split("-").map(Number);
  return `${monthDayLabel(dateStr)}, ${y}`;
}

export function pageTitle(dateStr: string, festivalName?: string): string {
  const when = shortDateLabel(dateStr);
  if (festivalName) return `${festivalName} Kolam for ${when} | Kolam`;
  return `Kolam for ${when} | Kolam`;
}

export function pageDescription(
  dateStr: string,
  number?: number,
  festival?: { name: string; dayLabel?: string; seoTerms?: string },
): string {
  const label = shortDateLabel(dateStr);
  const num = number !== undefined && number >= 1 ? ` Kolam #${number}.` : "";
  if (festival) {
    const day = festival.dayLabel && festival.dayLabel !== festival.name ? ` ${festival.dayLabel}.` : "";
    const terms = festival.seoTerms ? ` Includes ${festival.seoTerms}.` : "";
    return `A ${festival.name} sikku kolam for ${label}.${day}${num}${terms} Practice the pattern, save it, or print it to draw at home.`;
  }
  return `A traditional Tamil sikku kolam for ${label}.${num} Practice the pattern, save it, or print it to draw at home.`;
}

/**
 * Relative href from one dated page (/YYYY/MM/DD/) to another,
 * so links work both at /kolam/2026/11/18/ and at https://kolam.com/2026/11/18/.
 */
export function relativeBetweenDates(from: string, to: string): string {
  const [fy, fm] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (fy === ty && fm === tm) return `../${td}/`;
  if (fy === ty) return `../../${tm}/${td}/`;
  return `../../../${ty}/${tm}/${td}/`;
}

/** Asset prefix from a dated page (3 levels deep) back to the site root. */
export const DATE_PAGE_ASSET_PREFIX = "../../../";

export function parseDatePath(pathname: string): string | null {
  const m = pathname.match(/(\d{4})\/(\d{2})\/(\d{2})\/?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidDateString(date) ? date : null;
}

/** Site root path, e.g. "/kolam/" or "/". */
export function appRootFromPathname(pathname: string): string {
  const dated = pathname.match(/^(.*)\/\d{4}\/\d{2}\/\d{2}\/?$/);
  if (dated) {
    const root = dated[1] || "";
    return root.endsWith("/") ? root : `${root}/`;
  }
  let path = pathname;
  if (path.endsWith("/index.html")) path = path.slice(0, -10);
  if (!path.endsWith("/")) path = path.replace(/[^/]*$/, "") || "/";
  return path;
}

export function rebaseRootRelative(html: string, prefix: string): string {
  return html
    .replace(/(src|href)="\.\//g, `$1="${prefix}`)
    .replace(/(src|href)="\//g, `$1="${prefix}`);
}
