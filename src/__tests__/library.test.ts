import { describe, expect, it } from "vitest";
import { GRID_IDS } from "../grid";
import { isD4Symmetric, getEdge, listInteriorEdges } from "../mirrors";
import { loopToPath, traceLoops } from "../tracer";
import { canonicalGeometryHash } from "../canonical";
import { svgPathIsClosed, renderedPathsAreD4 } from "../pathGeom";
import {
  CURATED_PATTERNS,
  applyCurated,
  curatedForFestival,
  curatedForGrid,
} from "../library";
import type { FestivalId } from "../festivals";

const FESTIVALS: FestivalId[] = [
  "harvest",
  "diwali",
  "christmas",
  "navaratri",
  "onam",
  "karthigai",
  "newyear",
];

describe("curated traditional library", () => {
  it("ships at least 30 named patterns across classic grids", () => {
    expect(CURATED_PATTERNS.length).toBeGreaterThanOrEqual(30);
    const ids = CURATED_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of GRID_IDS) {
      expect(curatedForGrid(id).length, id).toBeGreaterThanOrEqual(1);
    }
    for (const fest of FESTIVALS) {
      expect(curatedForFestival(fest).length, fest).toBeGreaterThanOrEqual(1);
    }
  });

  it("each pattern is a covered, closed, D4 sikku with a unique geometry", () => {
    const hashes = new Set<string>();
    for (const p of CURATED_PATTERNS) {
      const grid = applyCurated(p);
      expect(grid.spec.id).toBe(p.gridId);
      expect(isD4Symmetric(grid), p.id).toBe(true);
      const traced = traceLoops(grid);
      expect(traced.uncovered, p.id).toEqual([]);
      expect(traced.loops.length, p.id).toBeGreaterThanOrEqual(1);
      const paths = traced.loops.map(loopToPath);
      expect(paths.every((d) => svgPathIsClosed(d)), p.id).toBe(true);
      const rows = p.gridId.startsWith("d") ? grid.spec.rows : undefined;
      const fourFold = !rows || (rows[0] === 1 && rows[rows.length - 1] === 1 && rows.length === Math.max(...rows));
      if (fourFold) expect(renderedPathsAreD4(paths, grid.c), p.id).toBe(true);
      let anyOn = false;
      for (const e of listInteriorEdges(grid)) {
        if (getEdge(grid, e)) {
          anyOn = true;
          break;
        }
      }
      expect(anyOn, p.id).toBe(true);
      const hash = canonicalGeometryHash(grid, traced.loops);
      expect(hashes.has(hash), `duplicate geometry: ${p.id}`).toBe(false);
      hashes.add(hash);
    }
    expect(hashes.size).toBe(CURATED_PATTERNS.length);
  });

  it("applyCurated is deterministic", () => {
    const p = CURATED_PATTERNS[0];
    const a = canonicalGeometryHash(applyCurated(p), traceLoops(applyCurated(p)).loops);
    const b = canonicalGeometryHash(applyCurated(p), traceLoops(applyCurated(p)).loops);
    expect(a).toBe(b);
  });
});
