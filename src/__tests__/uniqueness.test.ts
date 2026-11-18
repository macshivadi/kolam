import { describe, expect, it } from "vitest";
import { LAUNCH_DATE, addDays, kolamNumber } from "../dateSeed";
import { DAILY_GRID_CYCLE, GRIDS } from "../grid";
import { listOrbits, buildRegion } from "../mirrors";
import {
  collectDailyHashes,
  dailyGridId,
  kolamOfTheDay,
  resolveDailySeries,
} from "../generator";

describe("daily grid cycle", () => {
  it("rotates distinct families and never repeats a grid on adjacent cycle days", () => {
    expect(DAILY_GRID_CYCLE.length).toBeGreaterThanOrEqual(6);
    expect(new Set(DAILY_GRID_CYCLE).size).toBe(DAILY_GRID_CYCLE.length);
    for (let i = 0; i < DAILY_GRID_CYCLE.length; i++) {
      expect(DAILY_GRID_CYCLE[i]).not.toBe(DAILY_GRID_CYCLE[(i + 1) % DAILY_GRID_CYCLE.length]);
    }
    expect(DAILY_GRID_CYCLE).toContain("d5");
    expect(DAILY_GRID_CYCLE).toContain("d7");
    expect(DAILY_GRID_CYCLE).toContain("d9");
    expect(DAILY_GRID_CYCLE).toContain("d23432");
    expect(DAILY_GRID_CYCLE).toContain("d34543");
    expect(DAILY_GRID_CYCLE).toContain("5x5");
    expect(DAILY_GRID_CYCLE).toContain("7x7");
    expect(DAILY_GRID_CYCLE).not.toContain("11x11");
    expect(dailyGridId(LAUNCH_DATE)).toBe(DAILY_GRID_CYCLE[0]);
    expect(dailyGridId(addDays(LAUNCH_DATE, DAILY_GRID_CYCLE.length))).toBe(DAILY_GRID_CYCLE[0]);
  });

  it("has ample D4-orbit pattern space on every daily grid", () => {
    for (const id of DAILY_GRID_CYCLE) {
      const orbits = listOrbits(buildRegion(GRIDS[id])).length;
      // 2^orbits is the configuration count; need comfortably more than 10 years.
      expect(orbits).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("daily uniqueness over ~10 years", () => {
  it("gives the first 3650 days distinct D4-normalized hashes, quickly", () => {
    const started = Date.now();
    const hashes = collectDailyHashes(3650);
    const elapsed = Date.now() - started;
    expect(hashes).toHaveLength(3650);
    expect(new Set(hashes).size).toBe(3650);
    // Must stay fast enough for CI and for a client walk of prior days.
    expect(elapsed).toBeLessThan(20_000);
  });

  it("never repeats grid or pattern on adjacent days, and varies grids in each week", () => {
    const series = resolveDailySeries(addDays(LAUNCH_DATE, 3649));
    expect(series).toHaveLength(3650);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].gridId, series[i].date).not.toBe(series[i - 1].gridId);
      expect(series[i].patternId, series[i].date).not.toBe(series[i - 1].patternId);
    }
    for (let i = 0; i + 7 <= series.length; i++) {
      const grids = new Set(series.slice(i, i + 7).map((r) => r.gridId));
      expect(grids.size, series[i].date).toBeGreaterThanOrEqual(5);
    }
  });

  it("is chronological and matches kolamOfTheDay for a sample of days", () => {
    const series = resolveDailySeries(addDays(LAUNCH_DATE, 29));
    expect(series).toHaveLength(30);
    expect(kolamNumber(series[0].date)).toBe(1);
    for (const rec of [series[0], series[1], series[7], series[29]]) {
      const pattern = kolamOfTheDay(rec.date);
      expect(pattern.canonicalHash).toBe(rec.canonicalHash);
      expect(pattern.subSeed).toBe(rec.subSeed);
      expect(pattern.spec.id).toBe(rec.gridId);
      expect(pattern.uncovered).toEqual([]);
      expect(pattern.loops.length).toBeGreaterThanOrEqual(1);
      for (const loop of pattern.loops) {
        expect(loop.mids[0]).toBeTruthy();
        expect(loop.mids.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("keeps the same date's kolam stable across calls", () => {
    const a = kolamOfTheDay(LAUNCH_DATE);
    const b = kolamOfTheDay(LAUNCH_DATE);
    expect(a.canonicalHash).toBe(b.canonicalHash);
    expect(a.paths).toEqual(b.paths);
  });
});
