import { describe, expect, it } from "vitest";
import { addDays, LAUNCH_DATE } from "../dateSeed";
import { GRIDS, pulliLabel } from "../grid";
import {
  buildRegion,
  cloneMirrors,
  isD4Symmetric,
  listInteriorEdges,
  setEdge,
} from "../mirrors";
import {
  generateKolam,
  kolamOfTheDay,
  collectDailyHashes,
} from "../generator";
import { loopToPath, traceLoops } from "../tracer";
import { canonicalGeometryHash, canonicalHash, d4Point } from "../canonical";
import { pointKey } from "../grid";

function allInteriorOn(spec = GRIDS["7x7"]) {
  const grid = cloneMirrors(buildRegion(spec));
  for (const e of listInteriorEdges(grid)) setEdge(grid, e, true);
  return grid;
}

/** A 4-mid loop whose every arc vertex is the same pulli — one circle around that dot. */
function isolatedDotLoopCount(pattern: { loops: { vertices: { x: number; y: number }[] }[]; grid: { dots: { x: number; y: number }[] } }): number {
  const dots = new Set(pattern.grid.dots.map((d) => pointKey(d.x, d.y)));
  let n = 0;
  for (const loop of pattern.loops) {
    if (loop.vertices.length !== 4) continue;
    const first = pointKey(loop.vertices[0].x, loop.vertices[0].y);
    if (dots.has(first) && loop.vertices.every((v) => pointKey(v.x, v.y) === first)) {
      n++;
    }
  }
  return n;
}

describe("sikku path drawing", () => {
  it("draws crossings as straight segments, not a circle around every dot", () => {
    const allOn = traceLoops(allInteriorOn());
    const allOnPath = allOn.loops.map(loopToPath).join(" ");
    expect(allOnPath.includes("L")).toBe(false);
    expect(allOn.loops.length).toBeGreaterThan(8);

    const pattern = generateKolam(GRIDS["7x7"], 99);
    const drawn = pattern.paths.join(" ");
    expect(drawn.includes("L")).toBe(true);
    expect(drawn.includes("C")).toBe(true);
    expect(pattern.loopCount).toBeGreaterThanOrEqual(1);
    expect(isD4Symmetric(pattern.grid)).toBe(true);
    expect(pattern.uncovered).toEqual([]);
    expect(isolatedDotLoopCount(pattern)).toBe(0);
    // Must not collapse to the all-mirrors-on path packing.
    expect(drawn).not.toBe(allOnPath);
  });

  it("gives visually different geometry on different days", () => {
    const a = kolamOfTheDay(LAUNCH_DATE);
    const b = kolamOfTheDay(addDays(LAUNCH_DATE, 1));
    const c = kolamOfTheDay(addDays(LAUNCH_DATE, 2));
    expect(a.paths.join("|")).not.toBe(b.paths.join("|"));
    expect(b.paths.join("|")).not.toBe(c.paths.join("|"));
    expect(a.canonicalHash).not.toBe(b.canonicalHash);
    expect(b.canonicalHash).not.toBe(c.canonicalHash);
  });

  it("covers every pulli with a D4-symmetric weaving for most days", () => {
    const n = 80;
    for (let i = 0; i < n; i++) {
      const pattern = kolamOfTheDay(addDays(LAUNCH_DATE, i));
      expect(isD4Symmetric(pattern.grid)).toBe(true);
      expect(pattern.uncovered).toEqual([]);
      expect(isolatedDotLoopCount(pattern)).toBe(0);
      // Loops are smooth cubics (and occasional mid-edge lines).
      expect(pattern.paths.join(" ")).toMatch(/[CL]/);
      // Strict D4 on even-width squares cannot reach a single loop
      // (the empty interior already has n+1 loops). Keep the count modest.
      expect(pattern.loopCount).toBeGreaterThanOrEqual(1);
      expect(pattern.loopCount).toBeLessThanOrEqual(pattern.grid.W * 8);
    }
  });

  it("hashes uniqueness from the rendered geometry, not unused mirror bits", () => {
    const pattern = kolamOfTheDay(LAUNCH_DATE);
    const fromPaths = canonicalGeometryHash(pattern.grid, pattern.loops);
    expect(pattern.canonicalHash).toBe(fromPaths);
    // Mirror-bit hash may differ; the published key is the geometry one.
    const mirrorKey = canonicalHash(pattern.grid);
    expect(pattern.canonicalHash.startsWith(pattern.spec.id + ":")).toBe(true);
    expect(typeof mirrorKey).toBe("string");

    const hashes = collectDailyHashes(120);
    expect(new Set(hashes).size).toBe(120);
    expect(hashes[0]).toBe(kolamOfTheDay(LAUNCH_DATE).canonicalHash);
  });

  it("keeps mirrors and rendered geometry 4-fold symmetric", () => {
    const dates = [LAUNCH_DATE, "2026-11-16", "2026-11-18", "2026-11-20"];
    for (const date of dates) {
      const pattern = kolamOfTheDay(date);
      expect(isD4Symmetric(pattern.grid)).toBe(true);
      const rotated = pattern.loops.map((loop) => ({
        ...loop,
        mids: loop.mids.map((m) => {
          const [x, y] = d4Point(m.x, m.y, 1, pattern.grid.c);
          return { x, y };
        }),
      }));
      expect(canonicalGeometryHash(pattern.grid, rotated)).toBe(pattern.canonicalHash);
    }
    for (const seed of [1, 7, 42, 99, 20261117]) {
      const pattern = generateKolam(GRIDS["7x7"], seed);
      expect(isD4Symmetric(pattern.grid)).toBe(true);
      expect(pattern.loopCount).toBeLessThanOrEqual(pattern.grid.W * 8);
    }
  });
});

describe("pulli labels", () => {
  it("names square and N-to-1 / N-to-M grids in the traditional way", () => {
    expect(pulliLabel(GRIDS["9x9"])).toBe("9×9 pulli");
    expect(pulliLabel(GRIDS.d9)).toBe("9-1 pulli");
    expect(pulliLabel(GRIDS.d7)).toBe("7-1 pulli");
    expect(pulliLabel(GRIDS.d5)).toBe("5-1 pulli");
    expect(pulliLabel(GRIDS.d95)).toBe("9-5 pulli");
    expect(pulliLabel(GRIDS.d158)).toBe("15-8 pulli");
    expect(pulliLabel(GRIDS.d232)).toBe("2-3-2 pulli");
    expect(pulliLabel(GRIDS.d2442)).toBe("2-4-4-2 pulli");
    expect(pulliLabel(GRIDS.d23432)).toBe("2-3-4-3-2 pulli");
    expect(pulliLabel(GRIDS.d34543)).toBe("3-4-5-4-3 pulli");
  });
});
