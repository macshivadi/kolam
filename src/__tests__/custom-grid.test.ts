import { describe, expect, it } from "vitest";
import {
  diamondRowsForCenter,
  dotsForGrid,
  parseCustomGridId,
  specFor,
  validateCustomGrid,
} from "../grid";
import { generateKolam } from "../generator";
import { svgPathIsClosed } from "../pathGeom";
import { selectPendingGrid } from "../styles";

describe("custom grids", () => {
  it("validates sizes and rejects out-of-range or non-integer input", () => {
    expect(validateCustomGrid({ shape: "square", rows: 7, cols: 9 }).ok).toBe(true);
    expect(validateCustomGrid({ shape: "diamond", center: 6 }).ok).toBe(true);
    expect(validateCustomGrid({ shape: "square", rows: 2, cols: 7 }).ok).toBe(false);
    expect(validateCustomGrid({ shape: "square", rows: 7, cols: 16 }).ok).toBe(false);
    expect(validateCustomGrid({ shape: "diamond", center: 1 }).ok).toBe(false);
    expect(validateCustomGrid({ shape: "diamond", center: 15 }).ok).toBe(true);
    expect(validateCustomGrid({ shape: "square", rows: 3.5, cols: 7 }).ok).toBe(false);
    expect(validateCustomGrid({ shape: "hexagon", rows: 7, cols: 7 }).ok).toBe(false);
  });

  it("builds standard offset-row diamonds and rectangular squares", () => {
    expect(diamondRowsForCenter(5)).toEqual([1, 3, 5, 3, 1]);
    expect(diamondRowsForCenter(6)).toEqual([2, 4, 6, 4, 2]);
    expect(diamondRowsForCenter(8)).toEqual([2, 4, 6, 8, 6, 4, 2]);
    const rect = validateCustomGrid({ shape: "square", rows: 3, cols: 5 });
    expect(rect.ok).toBe(true);
    if (rect.ok) {
      expect(dotsForGrid(rect.spec)).toHaveLength(15);
      expect(rect.spec.id).toBe("custom:square:3x5");
    }
    expect(specFor("custom:diamond:5")?.rows).toEqual([1, 3, 5, 3, 1]);
    expect(parseCustomGridId("custom:square:16x7")).toBeUndefined();
    expect(specFor("7x7")?.id).toBe("7x7");
  });

  it("selecting a custom grid does not generate a pattern by itself", () => {
    const pattern = generateKolam(specFor("5x5")!, 1);
    const state = { pendingGridId: "5x5", pattern };
    const after = selectPendingGrid(state, "custom:square:7x9");
    expect(after.pendingGridId).toBe("custom:square:7x9");
    expect(after.pattern).toBe(pattern);
  });

  it("Generate can draw a covering kolam on custom square and diamond grids", () => {
    const ids = ["custom:square:3x5", "custom:square:6x6", "custom:diamond:5", "custom:diamond:6"];
    for (const id of ids) {
      const spec = specFor(id);
      expect(spec, id).toBeTruthy();
      const pattern = generateKolam(spec!, 21);
      expect(pattern.uncovered, id).toEqual([]);
      expect(pattern.loopCount, id).toBeGreaterThanOrEqual(1);
      expect(pattern.paths.every((d) => svgPathIsClosed(d)), id).toBe(true);
    }
  });
});
