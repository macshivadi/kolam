import { describe, expect, it } from "vitest";
import { GRIDS, GRID_IDS, type GridSpec } from "../grid";
import {
  buildRegion,
  isD4Symmetric,
  listOrbits,
  placeSymmetricMirrors,
} from "../mirrors";
import {
  allCurvesClosed,
  directedStateCount,
  traceLoops,
} from "../tracer";
import { canonicalBits, canonicalHash } from "../canonical";
import { generateKolam } from "../generator";
import {
  rotateEdge90,
  reflectEdgeV,
  getEdge,
  setEdge,
  listInteriorEdges,
  cloneMirrors,
} from "../mirrors";

const SAMPLE_SEEDS = [1, 2, 7, 42, 20261117, 99_999];

function place(spec: GridSpec, seed: number, density = 0.38) {
  return placeSymmetricMirrors(buildRegion(spec), seed, density);
}

describe("mirror-curve tracer", () => {
  it("produces only closed curves whose midpoints partition the grid", () => {
    for (const id of GRID_IDS) {
      const spec = GRIDS[id];
      for (const seed of SAMPLE_SEEDS) {
        const grid = place(spec, seed);
        const traced = traceLoops(grid);
        expect(traced.loops.length).toBeGreaterThan(0);
        expect(allCurvesClosed(traced.loops)).toBe(true);
        let visits = 0;
        for (const loop of traced.loops) {
          expect(loop.mids.length).toBeGreaterThanOrEqual(4);
          expect(loop.vertices.length).toBe(loop.mids.length);
          expect(loop.dirs.length).toBe(loop.mids.length);
          visits += loop.mids.length;
        }
        // Each directed state is used exactly once as either a forward or
        // a reverse traversal of a unique closed curve.
        expect(visits * 2).toBe(directedStateCount(grid));
      }
    }
  });

  it("covers all dots for a generated kolam (single-loop preference)", () => {
    for (const id of ["5x5", "7x7", "d5"] as const) {
      const pattern = generateKolam(GRIDS[id], 20261117, { attempts: 32 });
      expect(pattern.uncovered).toEqual([]);
      expect(pattern.covered.length).toBe(pattern.grid.dots.length);
      expect(pattern.loopCount).toBeGreaterThanOrEqual(1);
      expect(pattern.loopCount).toBeLessThanOrEqual(4);
    }
  });

  it("prefers a single continuous loop when one is available", () => {
    // A handful of seeds on the smaller grids; at least most should be 1 loop.
    let singles = 0;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const pattern = generateKolam(GRIDS["5x5"], 1000 + i, { attempts: 24 });
      expect(pattern.uncovered).toEqual([]);
      if (pattern.loopCount === 1) singles++;
    }
    expect(singles).toBeGreaterThanOrEqual(8);
  });
});

describe("D4 symmetry", () => {
  it("keeps interior mirrors in a single orbit-constant configuration", () => {
    for (const id of GRID_IDS) {
      const grid = place(GRIDS[id], 123456);
      expect(isD4Symmetric(grid)).toBe(true);
      expect(listOrbits(grid).length).toBeGreaterThanOrEqual(6);
    }
  });

  it("normalizes rotations and reflections to the same canonical hash", () => {
    const base = place(GRIDS["7x7"], 777);
    const original = canonicalHash(base);
    const bits = canonicalBits(base);

    // Rotate all interior mirrors 90° and reflect; hash must match.
    const rotated = cloneMirrors(base);
    const reflected = cloneMirrors(base);
    const edges = listInteriorEdges(base);
    // Clear interior then paint the transformed values
    for (const e of edges) {
      setEdge(rotated, e, false);
      setEdge(reflected, e, false);
    }
    for (const e of edges) {
      const val = getEdge(base, e);
      setEdge(rotated, rotateEdge90(e, base.c), val);
      setEdge(reflected, reflectEdgeV(e, base.c), val);
    }
    expect(isD4Symmetric(rotated)).toBe(true);
    expect(isD4Symmetric(reflected)).toBe(true);
    expect(canonicalHash(rotated)).toBe(original);
    expect(canonicalHash(reflected)).toBe(original);
    expect(canonicalBits(rotated)).toBe(bits);
    expect(canonicalBits(reflected)).toBe(bits);
  });
});
