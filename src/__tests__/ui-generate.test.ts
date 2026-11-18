import { describe, expect, it } from "vitest";
import { GRIDS, GRID_IDS, type GridId } from "../grid";
import { generateKolam, kolamOfTheDay, type KolamPattern } from "../generator";
import { LAUNCH_DATE } from "../dateSeed";
import { selectPendingGrid, selectPendingStyle, type KolamStyleId } from "../styles";

type UiState = {
  mode: "daily" | "generated";
  pattern: KolamPattern;
  pendingGridId: GridId;
  pendingStyleId: KolamStyleId;
  styleId: KolamStyleId;
  gridId: GridId;
};

describe("Create your own chips", () => {
  it("grid chips and style picker only select — they do not redraw today's kolam", () => {
    const daily = kolamOfTheDay(LAUNCH_DATE);
    const state: UiState = {
      mode: "daily",
      pattern: daily,
      gridId: daily.spec.id,
      pendingGridId: daily.spec.id,
      styleId: "line",
      pendingStyleId: "auto",
    };
    const afterGrid = selectPendingGrid(state, "11x11");
    expect(afterGrid.pattern).toBe(daily);
    expect(afterGrid.pattern.canonicalHash).toBe(daily.canonicalHash);
    expect(afterGrid.mode).toBe("daily");
    expect(afterGrid.gridId).toBe(daily.spec.id);
    expect(afterGrid.pendingGridId).toBe("11x11");

    const afterStyle = selectPendingStyle(afterGrid, "diwali");
    expect(afterStyle.pattern).toBe(daily);
    expect(afterStyle.styleId).toBe("line");
    expect(afterStyle.pendingStyleId).toBe("diwali");
    expect(afterStyle.mode).toBe("daily");
  });

  it("Generate is what actually draws a new kolam for the pending grid", () => {
    const daily = kolamOfTheDay(LAUNCH_DATE);
    let state: UiState = {
      mode: "daily",
      pattern: daily,
      gridId: daily.spec.id,
      pendingGridId: daily.spec.id,
      styleId: "line",
      pendingStyleId: "auto",
    };
    state = selectPendingGrid(state, "5x5");
    expect(state.pattern.spec.id).not.toBe("5x5");
    const generated = generateKolam(GRIDS[state.pendingGridId], 4242);
    const after: UiState = {
      ...state,
      mode: "generated",
      pattern: generated,
      gridId: state.pendingGridId,
      styleId: "color",
    };
    expect(after.mode).toBe("generated");
    expect(after.pattern).not.toBe(daily);
    expect(after.pattern.spec.id).toBe("5x5");
    expect(after.pattern.canonicalHash).not.toBe(daily.canonicalHash);
  });

  it("every grid id is a valid pending selection", () => {
    const daily = kolamOfTheDay(LAUNCH_DATE);
    let state: UiState = {
      mode: "daily",
      pattern: daily,
      gridId: daily.spec.id,
      pendingGridId: daily.spec.id,
      styleId: "line",
      pendingStyleId: "auto",
    };
    for (const id of GRID_IDS) {
      state = selectPendingGrid(state, id);
      expect(state.pattern).toBe(daily);
      expect(state.pendingGridId).toBe(id);
    }
  });
});
