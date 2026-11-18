import { describe, expect, it } from "vitest";
import { GRIDS } from "../grid";
import { generateKolam } from "../generator";
import { buildSampledPath } from "../trace";
import { pathDurationMs, totalDurationMs, unitsPerSec } from "../drawSpeed";

function lengthsOf(gridId: "5x5" | "d158", seed: number): number[] {
  const pattern = generateKolam(GRIDS[gridId], seed);
  return pattern.paths.map((d) => buildSampledPath(d).length);
}

describe("Draw-along pen speed", () => {
  it("keeps Slow, Normal, and Fast in a 0.4 / 1 / 2 ratio", () => {
    expect(unitsPerSec("slow") / unitsPerSec("normal")).toBeCloseTo(0.4, 8);
    expect(unitsPerSec("fast") / unitsPerSec("normal")).toBeCloseTo(2, 8);
  });

  it("scales duration with path length, distinctly on small and 15-8 grids", () => {
    for (const id of ["5x5", "d158"] as const) {
      const lengths = lengthsOf(id, 17);
      expect(lengths.some((n) => n > 1)).toBe(true);
      const slow = totalDurationMs(lengths, "slow");
      const normal = totalDurationMs(lengths, "normal");
      const fast = totalDurationMs(lengths, "fast");
      expect(slow / normal, id).toBeCloseTo(2.5, 1);
      expect(fast / normal, id).toBeCloseTo(0.5, 1);
      expect(slow, `${id} slow vs normal`).toBeGreaterThan(normal * 2);
      expect(fast, `${id} fast vs normal`).toBeLessThan(normal * 0.6);
    }
    const small = totalDurationMs(lengthsOf("5x5", 17), "normal");
    const large = totalDurationMs(lengthsOf("d158", 17), "normal");
    expect(large).toBeGreaterThan(small * 1.5);
    // A 15-8 at Slow is clearly longer than Normal (not a shared cap).
    const largeSlow = totalDurationMs(lengthsOf("d158", 17), "slow");
    const largeNormal = totalDurationMs(lengthsOf("d158", 17), "normal");
    expect(largeSlow - largeNormal).toBeGreaterThan(2000);
    // Per-path duration is proportional to length.
    expect(pathDurationMs(100, "normal") / pathDurationMs(50, "normal")).toBeCloseTo(2, 5);
  });
});
