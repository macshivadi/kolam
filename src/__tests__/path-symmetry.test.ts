import { describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "../dateSeed";
import { GRIDS } from "../grid";
import { generateKolam, kolamOfTheDay } from "../generator";
import { allSvgPathsClosed, renderedPathsAreD4, svgPathIsClosed } from "../pathGeom";
import { colorRegions } from "../regions";
import { RANGOLI_CLASSIC } from "../palettes";
import { motifSvg } from "../motifs";
import { festivalOn } from "../festivals";
import { styleForFestival } from "../styles";

describe("rendered sikku geometry", () => {
  it("closes every path (Z, start meets end) and is D4 as drawn", () => {
    const dates = [LAUNCH_DATE, "2026-11-16", "2026-11-18", "2026-01-14", "2026-11-08"];
    for (const date of dates) {
      const p = kolamOfTheDay(date);
      expect(allSvgPathsClosed(p.paths), date).toBe(true);
      const rows = p.spec.rows;
      const fourFold = !rows || (rows[0] === 1 && rows[rows.length - 1] === 1 && rows.length === Math.max(...rows));
      if (fourFold) expect(renderedPathsAreD4(p.paths, p.grid.c), date).toBe(true);
    }
    for (const seed of [1, 7, 42, 99]) {
      const p = generateKolam(GRIDS["7x7"], seed);
      expect(p.paths.every((d) => svgPathIsClosed(d))).toBe(true);
      expect(renderedPathsAreD4(p.paths, p.grid.c)).toBe(true);
    }
  });

  it("assigns rangoli fill colors by a D4-invariant ring", () => {
    const p = kolamOfTheDay("2026-11-16");
    const fills = colorRegions(p, RANGOLI_CLASSIC);
    expect(fills.length).toBeGreaterThan(0);
    const c = p.grid.c;
    // Same radius (within a bin) → same color.
    const byRing = new Map<number, string>();
    for (const f of fills) {
      const prev = byRing.get(f.ring);
      if (prev) expect(prev).toBe(f.fill);
      else byRing.set(f.ring, f.fill);
    }
    expect(byRing.size).toBeGreaterThan(0);
    expect(c).toBeGreaterThan(0);
  });

  it("draws festival motifs for Diwali, Pongal, Christmas, Onam, Navaratri, Karthigai", () => {
    expect(motifSvg("diwali", 8)).toContain("motif-lamp");
    expect(motifSvg("karthigai", 8)).toContain("motif-lamp");
    expect(motifSvg("harvest", 8)).toContain("motif-pot");
    expect(motifSvg("harvest", 8)).toContain("motif-sun");
    expect(motifSvg("christmas", 8)).toContain("motif-star");
    expect(motifSvg("onam", 8)).toContain("motif-flower");
    expect(motifSvg("navaratri", 8)).toContain("motif-lotus");
    expect(motifSvg("line", 8)).toBe("");
    expect(festivalOn("2026-11-08")?.id).toBe("diwali");
    expect(festivalOn("2026-01-14")?.id).toBe("harvest");
    expect(styleForFestival("diwali")).toBe("diwali");
    expect(styleForFestival("harvest")).toBe("harvest");
  });
});
