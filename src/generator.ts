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
  boundingN,
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

/**
 * Generated daily kolams must stay open and readable: not a dense net,
 * a distinct center motif, and strokes that reach the edge (petals / frame).
 */
export function isAesthetic(pattern: KolamPattern): boolean {
  if (pattern.uncovered.length > 0 || pattern.loopCount < 1) return false;
  const W = pattern.grid.W;
  const cap = Math.max(6, Math.min(16, Math.floor(W * 2.2)));
  if (pattern.loopCount > cap) return false;
  const c = pattern.grid.c;
  const maxR = W * 0.5;
  let hasCenter = false;
  let hasEdge = false;
  for (const loop of pattern.loops) {
    let minR = Infinity;
    let maxLoopR = 0;
    for (const m of loop.mids) {
      const r = Math.hypot(m.x - c, m.y - c);
      if (r < minR) minR = r;
      if (r > maxLoopR) maxLoopR = r;
    }
    if (minR < maxR * 0.38) hasCenter = true;
    if (maxLoopR > maxR * 0.7) hasEdge = true;
  }
  return hasCenter && hasEdge;
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
  const cap = (boundingN(spec) + 1) * 4;
  for (let sub = 0; sub < attempts; sub++) {
    const s = attemptSeed(seed, sub);
    // Same traditional recipes as the curated library, with seed-unique
    // decorative variation so consecutive Generate taps stay distinct.
    const pattern = fromGrid(constructSymmetricKolam(spec, s), seed, sub);
    const pretty = isAesthetic(pattern);
    const better =
      !best ||
      pattern.uncovered.length < best.uncovered.length ||
      (pattern.uncovered.length === best.uncovered.length && pretty && !isAesthetic(best)) ||
      (pattern.uncovered.length === best.uncovered.length && pretty === isAesthetic(best) && pattern.loopCount < best.loopCount);
    if (better) best = pattern;
    if (pattern.uncovered.length === 0 && pattern.loopCount <= cap && pretty) return pattern;
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
  gridId: string;
  subSeed: number;
  canonicalHash: string;
  /** Curated catalog id, or a generated placement tag. */
  patternId: string;
};

export type DailyPlacement = { grid: MirrorGrid; patternId: string };

function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * Deterministic placement for a date and sub-seed. Curated classics on the
 * day's cycle grid are tried first so adjacent days (different cycle grids)
 * also get different patterns.
 */
export function placeDaily(
  dateStr: string,
  subSeed: number,
  launch: string = LAUNCH_DATE,
): DailyPlacement {
  const spec = dailyGridSpec(dateStr, launch);
  const s = attemptSeed(seedFromDate(dateStr), subSeed);
  const fest = festivalOn(dateStr);
  const dayIndex = daysBetween(dateStr, launch);

  if (fest && subSeed < 8) {
    const list = curatedForFestival(fest.id);
    // Prefer a festival classic whose grid differs from the raw cycle
    // neighbor by rotating through the festival list.
    if (list.length) {
      const p = list[wrapIndex(dayIndex + subSeed, list.length)];
      return { grid: applyCurated(p), patternId: p.id };
    }
  }

  const onGrid = curatedForGrid(spec.id);
  if (onGrid.length && subSeed < onGrid.length) {
    const p = onGrid[wrapIndex(dayIndex + subSeed, onGrid.length)];
    return { grid: applyCurated(p), patternId: p.id };
  }

  const grid = constructSymmetricKolam(spec, s);
  return { grid, patternId: `gen:${spec.id}:${subSeed}` };
}

/** Place the mirrors for a date and sub-seed (no tracing). Deterministic. */
export function placeDailyMirrors(
  dateStr: string,
  subSeed: number,
  launch: string = LAUNCH_DATE,
): MirrorGrid {
  return placeDaily(dateStr, subSeed, launch).grid;
}


/** Memoize drawn-geometry hashes so a 10-year walk traces each unique pattern once. */
const placementHashCache = new Map<string, string>();

function placementCacheKey(placed: DailyPlacement): string {
  // Curated patterns are immutable; generated ones must not share a key,
  // because D4-normalized mirror bits can collide across distinct drawings.
  if (!placed.patternId.startsWith("gen:")) return `curated:${placed.patternId}`;
  return "";
}

function hashPlacement(placed: DailyPlacement): string {
  const ck = placementCacheKey(placed);
  if (ck) {
    const hit = placementHashCache.get(ck);
    if (hit) return hit;
  }
  const key = canonicalGeometryHash(placed.grid, traceLoops(placed.grid).loops);
  if (ck) placementHashCache.set(ck, key);
  return key;
}

/**
 * Pick the first sub-seed whose D4-normalized hash is not in `priorHashes`.
 * Does not trace — cheap enough to walk thousands of days on the client.
 */
export function resolveDailyRecord(
  dateStr: string,
  priorHashes: Set<string>,
  launch: string = LAUNCH_DATE,
  previous?: { gridId: string; patternId: string },
): DailyRecord {
  let fallback: DailyRecord | null = null;
  for (let sub = 0; sub < DAILY_ATTEMPTS; sub++) {
    const placed = placeDaily(dateStr, sub, launch);
    const key = hashPlacement(placed);
    const rec: DailyRecord = {
      date: dateStr,
      gridId: placed.grid.spec.id,
      subSeed: sub,
      canonicalHash: key,
      patternId: placed.patternId,
    };
    if (priorHashes.has(key)) continue;
    const sameAsPrev =
      previous && (rec.gridId === previous.gridId || rec.patternId === previous.patternId);
    if (sameAsPrev) {
      if (!fallback) fallback = rec;
      continue;
    }
    return rec;
  }
  if (fallback) return fallback;
  const placed = placeDaily(dateStr, DAILY_ATTEMPTS, launch);
  return {
    date: dateStr,
    gridId: placed.grid.spec.id,
    subSeed: DAILY_ATTEMPTS,
    canonicalHash: hashPlacement(placed),
    patternId: placed.patternId,
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
    const prev = out.length ? out[out.length - 1] : undefined;
    const rec = resolveDailyRecord(date, prior, launch, prev);
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
  prior.add(rec.canonicalHash);
  for (let i = 1; i <= n; i++) {
    const date = addDays(begin, i);
    rec = resolveDailyRecord(date, prior, launch, rec);
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
