import { hashString } from "./prng";

/** First published day of this app, in local calendar dates. */
export const LAUNCH_DATE = "2026-11-17";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a Date as a local YYYY-MM-DD string. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True if s is a real Gregorian calendar date in YYYY-MM-DD form. */
export function isValidDateString(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Inclusive whole-day difference a - b for two YYYY-MM-DD calendar dates. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  return Math.round(ms / 86_400_000);
}

/** Add (possibly negative) days to a YYYY-MM-DD calendar date. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return localDateString(dt);
}

/**
 * Kolam number #N since launch (launch day is #1).
 * Dates before launch return a number less than 1.
 */
export function kolamNumber(dateStr: string, launch: string = LAUNCH_DATE): number {
  return daysBetween(dateStr, launch) + 1;
}

/** Deterministic unsigned seed for the Kolam of a given local date. */
export function seedFromDate(dateStr: string): number {
  return hashString(`kolam:${dateStr}`);
}

/** Clamp a requested date to today or earlier. Invalid dates fall back to today. */
export function clampToPastOrToday(dateStr: string, today: string = localDateString()): string {
  if (!isValidDateString(dateStr)) return today;
  return daysBetween(dateStr, today) > 0 ? today : dateStr;
}
