import { hashString } from "./prng";
import {
  LAUNCH_DATE,
  addDays,
  daysBetween,
  seedFromDate,
} from "./dateSeed";
import {
  DAILY_GRID_CYCLE,
  GRIDS,
  type GridId,
  type GridSpec,
  type Point,
} from "./grid";
import { type MirrorGrid } from "./mirrors";
import { loopToPath, traceLoops, type Loop } from "./tracer";
import { canonicalGeometryHash } from "./canonical";
import { constructSymmetricKolam } from "./construct";
import { applyCurated, curatedForFestival, curatedForGrid } from "./library";
import { festivalOn } from "./festivals";

export type KolamPattern = {
  spec: GridSpec;
  grid: MirrorGrid;
  loops: Loop[];
  paths: string[];
  covered: Point[];
  uncovered: Point[];
  /** Number of closed curves. 1 is a single-loop sikku kolam. */
  loopCount: number;
  canonicalHash: string;
  seed: number;
  /** Sub-seed used to break daily collisions; 0 when the first attempt is unique. */
  subSeed: number;
};

export function attemptSeed(base: number, sub: number): number {
  return hashString(`kolam-attempt:${base >>> 0}:${sub}`) >>> 0;
}

function fromGrid(grid: MirrorGrid, seed: number, subSeed: number): KolamPattern {
  const traced = traceLoops(grid);
  return {
    spec: grid.spec,
    grid,
    loops: traced.loops,
    paths: traced.loops.map(loopToPath),
    covered: traced.covered,
    uncovered: traced.uncovered,
    loopCount: traced.loops.length,
    canonicalHash: canonicalGeometryHash(grid, traced.loops),
    seed,
    subSeed,
  };
}

export type GenerateOptions = {
  /** How many constructions to try if the first is not a single covering loop. */
  attempts?: number;
};

/**
 * Build a valid sikku kolam for a grid and seed. The seed determines the
 * pattern (so Generate taps stay distinct). Retries only run if a pulli
 * would be left uncovered — we do not pick the fewest-loop candidate,
 * which collapsed many seeds to the same all-off lattice.
 */
export function generateKolam(
  spec: GridSpec,
  seed: number,
  opts: GenerateOptions = {},
): KolamPattern {
  const attempts = opts.attempts ?? 8;
  let best: KolamPattern | null = null;
  const cap = (spec.n ? spec.n + 1 : Math.max(...(spec.rows ?? [1])) + 1) * 4;
  for (let sub = 0; sub < attempts; sub++) {
    const s = attemptSeed(seed, sub);
    // Same traditional recipes as the curated library, with seed-unique
    // decorative variation so consecutive Generate taps stay distinct.
    const pattern = fromGrid(constructSymmetricKolam(spec, s), seed, sub);
    const better =
      !best ||
      pattern.uncovered.length < best.uncovered.length ||
      (pattern.uncovered.length === best.uncovered.length && pattern.loopCount < best.loopCount);
    if (better) best = pattern;
    if (pattern.uncovered.length === 0 && pattern.loopCount <= cap) return pattern;
  }
  return best!;
}

export function dailyGridId(dateStr: string, launch: string = LAUNCH_DATE): GridId {
  const i = daysBetween(dateStr, launch);
  const len = DAILY_GRID_CYCLE.length;
  const idx = ((i % len) + len) % len;
  return DAILY_GRID_CYCLE[idx];
}

export function dailyGridSpec(dateStr: string, launch: string = LAUNCH_DATE): GridSpec {
  return GRIDS[dailyGridId(dateStr, launch)];
}

/**
 * Daily uniqueness search cap. Collisions are rare with 7×7 / 9×9 / diamond-7
 * and D4-normalized hashes, so this almost always returns on sub-seed 0.
 */
export const DAILY_ATTEMPTS = 64;

export type DailyRecord = {
  date: string;
  gridId: GridId;
  subSeed: number;
  canonicalHash: string;
};

/** Place the mirrors for a date and sub-seed (no tracing). Deterministic. */
export function placeDailyMirrors(
  dateStr: string,
  subSeed: number,
  launch: string = LAUNCH_DATE,
): MirrorGrid {
  const spec = dailyGridSpec(dateStr, launch);
  const s = attemptSeed(seedFromDate(dateStr), subSeed);
  const fest = festivalOn(dateStr);
  // Festival days open with curated classics (may use a fitting traditional grid).
  if (fest && subSeed < 8) {
    const list = curatedForFestival(fest.id);
    if (list.length) return applyCurated(list[(s + subSeed) % list.length]);
  }
  // Even sub-seeds frequently use a classic on the day's usual grid.
  if (subSeed % 2 === 0) {
    const list = curatedForGrid(spec.id);
    if (list.length) return applyCurated(list[(s >>> 0) % list.length]);
  }
  return constructSymmetricKolam(spec, s);
}

/**
 * Pick the first sub-seed whose D4-normalized hash is not in `priorHashes`.
 * Does not trace — cheap enough to walk thousands of days on the client.
 */
export function resolveDailyRecord(
  dateStr: string,
  priorHashes: Set<string>,
  launch: string = LAUNCH_DATE,
): DailyRecord {
  for (let sub = 0; sub < DAILY_ATTEMPTS; sub++) {
    const grid = placeDailyMirrors(dateStr, sub, launch);
    const key = canonicalGeometryHash(grid, traceLoops(grid).loops);
    if (priorHashes.has(key)) continue;
    return { date: dateStr, gridId: grid.spec.id, subSeed: sub, canonicalHash: key };
  }
  // Extremely unlikely; still return a tagged last-attempt pattern.
  const grid = placeDailyMirrors(dateStr, DAILY_ATTEMPTS, launch);
  return {
    date: dateStr,
    gridId: grid.spec.id,
    subSeed: DAILY_ATTEMPTS,
    canonicalHash: canonicalGeometryHash(grid, traceLoops(grid).loops),
  };
}

/**
 * Walk every day from launch through `endDate` (inclusive), resolving
 * uniqueness in chronological order. O(days) and deterministic. No tracing.
 */
export function resolveDailySeries(
  endDate: string,
  launch: string = LAUNCH_DATE,
): DailyRecord[] {
  const out: DailyRecord[] = [];
  const prior = new Set<string>();
  const n = daysBetween(endDate, launch);
  if (n < 0) return out;
  for (let i = 0; i <= n; i++) {
    const date = addDays(launch, i);
    const rec = resolveDailyRecord(date, prior, launch);
    prior.add(rec.canonicalHash);
    out.push(rec);
  }
  return out;
}

/** Build the drawable kolam for an already-resolved daily record. */
export function patternFromDailyRecord(
  rec: DailyRecord,
  launch: string = LAUNCH_DATE,
): KolamPattern {
  const grid = placeDailyMirrors(rec.date, rec.subSeed, launch);
  return fromGrid(grid, seedFromDate(rec.date), rec.subSeed);
}

/** Kolam of the day for a local YYYY-MM-DD date. */
export function kolamOfTheDay(
  dateStr: string,
  launch: string = LAUNCH_DATE,
): KolamPattern {
  const series = resolveDailySeries(dateStr, launch);
  if (series.length === 0) {
    const rec = resolveDailyRecord(dateStr, new Set(), launch);
    return patternFromDailyRecord(rec, launch);
  }
  return patternFromDailyRecord(series[series.length - 1], launch);
}

/** Hashes of the first `dayCount` days from launch, in order. */
export function collectDailyHashes(
  dayCount: number,
  launch: string = LAUNCH_DATE,
): string[] {
  return resolveDailySeries(addDays(launch, dayCount - 1), launch).map(
    (d) => d.canonicalHash,
  );
}

const PRELAUNCH_DAYS = 365;

/**
 * Drawable kolam for any calendar date. Days on or after launch use the
 * published uniqueness series (unchanged). Pre-launch dates walk a
 * separate series starting a year before launch so they do not alter
 * post-launch hashes.
 */
export function kolamForDate(dateStr: string, launch: string = LAUNCH_DATE): KolamPattern {
  if (daysBetween(dateStr, launch) >= 0) return kolamOfTheDay(dateStr, launch);
  const start = addDays(launch, -PRELAUNCH_DAYS);
  const begin = daysBetween(dateStr, start) < 0 ? dateStr : start;
  const prior = new Set<string>();
  const n = daysBetween(dateStr, begin);
  let rec = resolveDailyRecord(begin, prior, launch);
  for (let i = 0; i <= n; i++) {
    const date = addDays(begin, i);
    rec = resolveDailyRecord(date, prior, launch);
    prior.add(rec.canonicalHash);
  }
  return patternFromDailyRecord(rec, launch);
}

/** Inclusive prerender window: a year before launch through `today` + 1 day. */
export function prerenderWindow(
  today: string,
  launch: string = LAUNCH_DATE,
  backDays = PRELAUNCH_DAYS,
  forwardDays = 1,
): { start: string; end: string; dates: string[] } {
  const start = addDays(launch, -backDays);
  const end = addDays(today, forwardDays);
  const dates: string[] = [];
  const n = daysBetween(end, start);
  for (let i = 0; i <= n; i++) dates.push(addDays(start, i));
  return { start, end, dates };
}
