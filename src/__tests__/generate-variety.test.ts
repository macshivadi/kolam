import { describe, expect, it } from "vitest";
import { GRIDS, GRID_IDS } from "../grid";
import { generateKolam } from "../generator";
import { buildRegion, getEdge, listInteriorEdges } from "../mirrors";

function isAllOff(pattern: ReturnType<typeof generateKolam>): boolean {
  for (const e of listInteriorEdges(pattern.grid)) {
    if (getEdge(pattern.grid, e) !== false) return false;
  }
  return listInteriorEdges(buildRegion(pattern.spec)).length > 0;
}

describe("Generate variety", () => {
  it("20 consecutive seeds give ≥15 distinct hashes on every grid, never all-off", () => {
    for (const id of GRID_IDS) {
      const hashes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const p = generateKolam(GRIDS[id], 1000 + i);
        hashes.add(p.canonicalHash);
        expect(isAllOff(p)).toBe(false);
        expect(p.uncovered).toEqual([]);
        expect(p.paths.length).toBeGreaterThan(0);
      }
      expect(hashes.size, `${id} distinct`).toBeGreaterThanOrEqual(15);
    }
  });
});
