import { addDays } from "./dateSeed";
import type { ThemeId } from "./themes";

/**
 * Festival dates for 2025–2030. Lunar and regional dates were taken from
 * these sources (retrieved 17 Nov 2026) and are not guessed:
 *
 * - Diwali / Deepavali (India gazetted holiday):
 *   https://www.timeanddate.com/holidays/india/diwali
 *   2025-10-20, 2026-11-08, 2027-10-29, 2028-10-17, 2029-11-05, 2030-10-26
 *
 * - Thai Pongal (India restricted holiday):
 *   https://www.timeanddate.com/holidays/india/pongal
 *   2025-01-14, 2026-01-14, 2027-01-15, 2028-01-15, 2029-01-14, 2030-01-14
 *
 * - Makara Sankranti (India restricted holiday; the same harvest festival
 *   under a regional name used in Andhra Pradesh / Telangana):
 *   https://www.timeanddate.com/holidays/india/makar-sankranti
 *   2025-01-14, 2026-01-14, 2027-01-14, 2028-01-15, 2029-01-14, 2030-01-14
 *   Bhogi, Mattu Pongal and Kaanum Pongal are the day before, the day after,
 *   and two days after the official Pongal holiday.
 *
 * - Christmas (civil calendar, India gazetted holiday): 25 December
 *   https://www.timeanddate.com/holidays/india/christmas-day
 *
 * - New Year's Day (civil calendar): 1 January
 *   https://www.timeanddate.com/holidays/india/new-year-day
 *
 * - Sharad Navaratri start (Ghatasthapana):
 *   https://www.timeanddate.com/holidays/india/navratri
 *   Drik Panchang agrees on the start days.
 *   2025-09-22, 2026-10-11, 2027-09-30, 2028-09-19, 2029-10-08, 2030-09-28
 * - Dussehra / Vijayadashami (end of the Navaratri window):
 *   https://www.timeanddate.com/holidays/india/dussehra
 *   2025-10-02, 2026-10-20, 2027-10-09, 2028-09-27, 2029-10-16, 2030-10-06
 *
 * - Thiruvonam (main Onam day):
 *   https://www.timeanddate.com/holidays/india/onam
 *   2025-09-05, 2026-08-26, 2027-09-12, 2028-09-01, 2029-08-22, 2030-09-09
 *
 * - Karthigai Deepam (Chennai / India):
 *   https://www.drikpanchang.com/festivals/karthigai-deepam/karthigai-deepam-date-time.html
 *   (2025–2028 also listed for Chennai on https://panjangam.com/festivals/karthigai-deepam/)
 *   2025-12-03, 2026-11-24, 2027-12-11, 2028-12-01, 2029-11-20, 2030-12-08
 */

export type FestivalId =
  | "harvest"
  | "diwali"
  | "christmas"
  | "navaratri"
  | "onam"
  | "karthigai"
  | "newyear";

export type Festival = {
  id: FestivalId;
  /** Inclusive name used in titles, e.g. "Pongal · Makara Sankranti" or "Diwali". */
  name: string;
  /** Short greeting shown on the page, e.g. "Happy Deepavali". */
  greeting: string;
  /** Specific day label when the festival spans several named days. */
  dayLabel: string;
  theme: ThemeId;
  /** Extra search terms folded into the meta description. */
  seoTerms?: string;
};

const THAI_PONGAL: Record<number, string> = {
  2025: "2025-01-14",
  2026: "2026-01-14",
  2027: "2027-01-15",
  2028: "2028-01-15",
  2029: "2029-01-14",
  2030: "2030-01-14",
};

const MAKARA_SANKRANTI: Record<number, string> = {
  2025: "2025-01-14",
  2026: "2026-01-14",
  2027: "2027-01-14",
  2028: "2028-01-15",
  2029: "2029-01-14",
  2030: "2030-01-14",
};

const DIWALI: Record<number, string> = {
  2025: "2025-10-20",
  2026: "2026-11-08",
  2027: "2027-10-29",
  2028: "2028-10-17",
  2029: "2029-11-05",
  2030: "2030-10-26",
};

const NAVARATRI: Record<number, { start: string; end: string }> = {
  2025: { start: "2025-09-22", end: "2025-10-02" },
  2026: { start: "2026-10-11", end: "2026-10-20" },
  2027: { start: "2027-09-30", end: "2027-10-09" },
  2028: { start: "2028-09-19", end: "2028-09-27" },
  2029: { start: "2029-10-08", end: "2029-10-16" },
  2030: { start: "2030-09-28", end: "2030-10-06" },
};

const ONAM: Record<number, string> = {
  2025: "2025-09-05",
  2026: "2026-08-26",
  2027: "2027-09-12",
  2028: "2028-09-01",
  2029: "2029-08-22",
  2030: "2030-09-09",
};

const KARTHIGAI: Record<number, string> = {
  2025: "2025-12-03",
  2026: "2026-11-24",
  2027: "2027-12-11",
  2028: "2028-12-01",
  2029: "2029-11-20",
  2030: "2030-12-08",
};

const HARVEST_SEO =
  "Pongal, Makara Sankranti, Sankranti, muggulu, rangoli, and kolam";

const HARVEST_NAME = "Pongal · Makara Sankranti";

function harvestDay(dateStr: string): Festival | undefined {
  const year = Number(dateStr.slice(0, 4));
  const thai = THAI_PONGAL[year];
  const sankranti = MAKARA_SANKRANTI[year];
  if (!thai) return undefined;

  const days: Record<string, { dayLabel: string; greeting: string }> = {
    [addDays(thai, -1)]: { dayLabel: "Bhogi", greeting: "Happy Bhogi" },
    [thai]: { dayLabel: "Thai Pongal", greeting: "Happy Pongal" },
    [addDays(thai, 1)]: { dayLabel: "Mattu Pongal", greeting: "Happy Mattu Pongal" },
    [addDays(thai, 2)]: { dayLabel: "Kaanum Pongal", greeting: "Happy Kaanum Pongal" },
  };

  const hit = days[dateStr];
  const isSankranti = sankranti === dateStr;
  if (!hit && !isSankranti) return undefined;

  const dayLabel = [hit?.dayLabel, isSankranti ? "Makara Sankranti" : undefined]
    .filter(Boolean)
    .join(" · ");

  return {
    id: "harvest",
    name: HARVEST_NAME,
    greeting: isSankranti && hit ? `${hit.greeting} · Happy Makara Sankranti` : isSankranti ? "Happy Makara Sankranti" : hit!.greeting,
    dayLabel: dayLabel || "Makara Sankranti",
    theme: "pongal",
    seoTerms: HARVEST_SEO,
  };
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

/** The festival observed on a local YYYY-MM-DD date, if any. */
export function festivalOn(dateStr: string): Festival | undefined {
  const year = Number(dateStr.slice(0, 4));
  const harvest = harvestDay(dateStr);
  if (harvest) return harvest;

  if (DIWALI[year] === dateStr) {
    return {
      id: "diwali",
      name: "Diwali",
      greeting: "Happy Deepavali",
      dayLabel: "Deepavali",
      theme: "diwali",
      seoTerms: "Diwali, Deepavali, Festival of Lights, kolam",
    };
  }

  if (dateStr === `${year}-12-25`) {
    return {
      id: "christmas",
      name: "Christmas",
      greeting: "Merry Christmas",
      dayLabel: "Christmas",
      theme: "christmas",
    };
  }

  if (dateStr === `${year}-01-01`) {
    return {
      id: "newyear",
      name: "New Year",
      greeting: "Happy New Year",
      dayLabel: "New Year's Day",
      theme: "classic",
    };
  }

  const nav = NAVARATRI[year];
  if (nav && inRange(dateStr, nav.start, nav.end)) {
    return {
      id: "navaratri",
      name: "Navaratri",
      greeting: "Happy Navaratri",
      dayLabel: dateStr === nav.end ? "Vijayadashami" : "Navaratri",
      theme: "diwali",
      seoTerms: "Navaratri, Navratri, Vijayadashami, Dussehra, kolam",
    };
  }

  if (ONAM[year] === dateStr) {
    return {
      id: "onam",
      name: "Onam",
      greeting: "Happy Onam",
      dayLabel: "Thiruvonam",
      theme: "pongal",
      seoTerms: "Onam, Thiruvonam, pookalam, kolam",
    };
  }

  if (KARTHIGAI[year] === dateStr) {
    return {
      id: "karthigai",
      name: "Karthigai Deepam",
      greeting: "Happy Karthigai Deepam",
      dayLabel: "Karthigai Deepam",
      theme: "diwali",
      seoTerms: "Karthigai Deepam, Karthikai Deepam, kolam",
    };
  }

  return undefined;
}

export function defaultThemeForDate(dateStr: string): ThemeId {
  return festivalOn(dateStr)?.theme ?? "classic";
}

/**
 * Greeting shown on the page. Never appends a day label that is already
 * inside the greeting (e.g. "Happy Deepavali" must not become
 * "Happy Deepavali · Deepavali").
 */
export function festivalChipText(fest: Festival): string {
  if (!fest.dayLabel || fest.dayLabel === fest.name) return fest.greeting;
  if (fest.greeting.includes(fest.dayLabel)) return fest.greeting;
  const greetLc = fest.greeting.toLowerCase();
  const unused = fest.dayLabel.split(/\s*·\s*/).filter((part) => {
    const p = part.toLowerCase();
    if (greetLc.includes(p)) return false;
    const tail = p.replace(/^(thai|mattu|kaanum)\s+/, "");
    if (tail !== p && greetLc.includes(tail)) return false;
    return true;
  });
  if (unused.length === 0) return fest.greeting;
  return `${fest.greeting} · ${unused.join(" · ")}`;
}
