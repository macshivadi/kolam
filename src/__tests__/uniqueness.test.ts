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
  it("cycles through larger grids only (7×7, 9×9, 11×11, diamond-9)", () => {
    expect(DAILY_GRID_CYCLE).toEqual(["7x7", "9x9", "11x11", "d9"]);
    expect(dailyGridId(LAUNCH_DATE)).toBe("7x7");
    expect(dailyGridId(addDays(LAUNCH_DATE, 1))).toBe("9x9");
    expect(dailyGridId(addDays(LAUNCH_DATE, 2))).toBe("11x11");
    expect(dailyGridId(addDays(LAUNCH_DATE, 3))).toBe("d9");
    expect(dailyGridId(addDays(LAUNCH_DATE, 4))).toBe("7x7");
  });

  it("has ample D4-orbit pattern space on every daily grid", () => {
    for (const id of DAILY_GRID_CYCLE) {
      const orbits = listOrbits(buildRegion(GRIDS[id])).length;
      // 2^orbits is the configuration count; need comfortably more than 10 years.
      expect(orbits).toBeGreaterThanOrEqual(12);
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
