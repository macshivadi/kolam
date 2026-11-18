import { GRIDS, type GridId } from "./grid";
import { applyRecipe, polishD4, type RecipeId, type RecipeOpts } from "./construct";
import type { FestivalId } from "./festivals";
import type { MirrorGrid } from "./mirrors";

export type CuratedPattern = {
  id: string;
  name: string;
  gridId: GridId;
  recipe: RecipeId;
  opts?: RecipeOpts;
  /** Festival days prefer these classics (a pattern may serve more than one). */
  festival?: FestivalId | FestivalId[];
};

function entry(
  id: string,
  name: string,
  gridId: GridId,
  recipe: RecipeId,
  festival?: FestivalId | FestivalId[],
  opts?: RecipeOpts,
): CuratedPattern {
  return { id, name, gridId, recipe, opts, festival };
}

/**
 * Hand-authored traditional sikku skeletons: plus/cross knots, teardrop
 * chains, rosette rings, frame petals, and lotus forms on classic pulli
 * grids. Recreated as clean D4 mirror configurations — not traced from
 * photographs.
 */
export const CURATED_PATTERNS: CuratedPattern[] = [
  // 5×5 square
  entry("5x5-cross-knot", "Five-pulli cross knot", "5x5", "cross-knot"),
  entry("5x5-center-chain", "Five-pulli axis chain", "5x5", "center-chain"),
  entry("5x5-frame-petals", "Five-pulli frame petals", "5x5", "frame-petals"),
  entry("5x5-lotus", "Five-pulli lotus", "5x5", "lotus", "navaratri"),
  entry("5x5-sparse-knots", "Five-pulli corner knots", "5x5", "sparse-knots"),

  // 7×7 square
  entry("7x7-cross-knot", "Seven-pulli cross knot", "7x7", "cross-knot"),
  entry("7x7-center-chain", "Seven-pulli axis chain", "7x7", "center-chain"),
  entry("7x7-rosette", "Seven-pulli rosette", "7x7", "rosette", ["diwali", "karthigai"]),
  entry("7x7-frame-petals", "Seven-pulli frame petals", "7x7", "frame-petals", "harvest"),
  entry("7x7-lotus", "Seven-pulli lotus", "7x7", "lotus", "navaratri"),
  entry("7x7-star-diag", "Seven-pulli star", "7x7", "star-diag", ["christmas", "newyear"]),
  entry("7x7-outer-ring", "Seven-pulli outer ring", "7x7", "outer-ring"),
  entry("7x7-sparse-knots", "Seven-pulli corner knots", "7x7", "sparse-knots"),

  // 9×9 square
  entry("9x9-cross-knot", "Nine-pulli cross knot", "9x9", "cross-knot"),
  entry("9x9-center-chain", "Nine-pulli axis chain", "9x9", "center-chain"),
  entry("9x9-rosette", "Nine-pulli rosette", "9x9", "rosette", ["diwali", "karthigai"]),
  entry("9x9-lotus", "Nine-pulli lotus", "9x9", "lotus", "navaratri"),
  entry("9x9-star-diag", "Nine-pulli star", "9x9", "star-diag", ["christmas", "newyear"]),
  entry("9x9-nested", "Nine-pulli nested rings", "9x9", "nested", "onam"),
  entry("9x9-frame-petals", "Nine-pulli frame petals", "9x9", "frame-petals", "harvest"),
  entry("9x9-outer-ring", "Nine-pulli outer ring", "9x9", "outer-ring"),
  entry("9x9-diamond-petals", "Nine-pulli diamond petals", "9x9", "diamond-petals"),

  // 11×11 square
  entry("11x11-cross-knot", "Eleven-pulli cross knot", "11x11", "cross-knot"),
  entry("11x11-center-chain", "Eleven-pulli axis chain", "11x11", "center-chain"),
  entry("11x11-rosette", "Eleven-pulli rosette", "11x11", "rosette", ["diwali", "karthigai"], { band: 1 }),
  entry("11x11-nested", "Eleven-pulli nested rings", "11x11", "nested", "onam"),
  entry("11x11-star-diag", "Eleven-pulli star", "11x11", "star-diag", ["christmas", "newyear"]),
  entry("11x11-lotus", "Eleven-pulli lotus", "11x11", "lotus", "navaratri"),
  entry("11x11-outer-ring", "Eleven-pulli outer ring", "11x11", "outer-ring"),

  // 5-1 diamond
  entry("d5-cross-knot", "5-1 cross knot", "d5", "cross-knot"),
  entry("d5-frame-petals", "5-1 frame petals", "d5", "frame-petals", "harvest"),
  entry("d5-lotus", "5-1 lotus", "d5", "lotus"),
  entry("d5-star-diag", "5-1 star", "d5", "star-diag"),

  // 7-1 diamond
  entry("d7-cross-knot", "7-1 cross knot", "d7", "cross-knot"),
  entry("d7-center-chain", "7-1 axis chain", "d7", "center-chain"),
  entry("d7-rosette", "7-1 rosette", "d7", "rosette", "diwali"),
  entry("d7-frame-petals", "7-1 frame petals", "d7", "frame-petals", "harvest"),
  entry("d7-lotus", "7-1 lotus", "d7", "lotus", "navaratri"),

  // 9-1 diamond
  entry("d9-cross-knot", "9-1 cross knot", "d9", "cross-knot", "harvest"),
  entry("d9-center-chain", "9-1 axis chain", "d9", "center-chain"),
  entry("d9-rosette", "9-1 rosette", "d9", "rosette", ["diwali", "karthigai"]),
  entry("d9-nested", "9-1 nested rings", "d9", "nested", "onam"),
  entry("d9-star-diag", "9-1 star", "d9", "star-diag", ["christmas", "newyear"]),
  entry("d9-lotus", "9-1 lotus", "d9", "lotus", "navaratri"),

  // 9-5 diamond
  entry("d95-cross-knot", "9-5 cross knot", "d95", "cross-knot"),
  entry("d95-rosette", "9-5 rosette", "d95", "rosette", "diwali"),
  entry("d95-frame-petals", "9-5 frame petals", "d95", "frame-petals", "harvest"),
  entry("d95-lotus", "9-5 lotus", "d95", "lotus", "navaratri"),

  // 15-8 diamond
  entry("d158-cross-knot", "15-8 cross knot", "d158", "cross-knot"),
  entry("d158-rosette", "15-8 rosette", "d158", "rosette", ["diwali", "karthigai"], { band: 1 }),
  entry("d158-center-chain", "15-8 axis chain", "d158", "center-chain"),
  entry("d158-lotus", "15-8 lotus", "d158", "lotus", "navaratri"),

  // Small interlaced diamonds used for daily classics
  entry("d232-cross-knot", "2-3-2 cross knot", "d232", "cross-knot"),
  entry("d232-frame-petals", "2-3-2 frame petals", "d232", "frame-petals", "harvest"),
  entry("d232-sparse-knots", "2-3-2 corner knots", "d232", "sparse-knots"),

  entry("d2442-cross-knot", "2-4-4-2 cross knot", "d2442", "cross-knot"),
  entry("d2442-center-chain", "2-4-4-2 axis chain", "d2442", "center-chain"),
  entry("d2442-frame-petals", "2-4-4-2 frame petals", "d2442", "frame-petals", "harvest"),
  entry("d2442-star-diag", "2-4-4-2 star", "d2442", "star-diag", ["christmas", "newyear"]),

  entry("d23432-cross-knot", "2-3-4-3-2 cross knot", "d23432", "cross-knot"),
  entry("d23432-center-chain", "2-3-4-3-2 axis chain", "d23432", "center-chain"),
  entry("d23432-rosette", "2-3-4-3-2 rosette", "d23432", "rosette", ["diwali", "karthigai"]),
  entry("d23432-lotus", "2-3-4-3-2 lotus", "d23432", "lotus"),
  entry("d23432-frame-petals", "2-3-4-3-2 frame petals", "d23432", "frame-petals", "harvest"),

  entry("d34543-cross-knot", "3-4-5-4-3 cross knot", "d34543", "cross-knot"),
  entry("d34543-center-chain", "3-4-5-4-3 axis chain", "d34543", "center-chain"),
  entry("d34543-rosette", "3-4-5-4-3 rosette", "d34543", "rosette", ["diwali", "karthigai"]),
  entry("d34543-lotus", "3-4-5-4-3 lotus", "d34543", "lotus", "navaratri"),
  entry("d34543-sparse-knots", "3-4-5-4-3 corner knots", "d34543", "sparse-knots"),
  entry("d34543-star-diag", "3-4-5-4-3 star", "d34543", "star-diag", ["christmas", "newyear"]),
];

export function hasFestival(pattern: CuratedPattern, id: FestivalId): boolean {
  if (!pattern.festival) return false;
  return Array.isArray(pattern.festival) ? pattern.festival.includes(id) : pattern.festival === id;
}

export function curatedForGrid(id: GridId): CuratedPattern[] {
  return CURATED_PATTERNS.filter((p) => p.gridId === id);
}

export function curatedForFestival(id: FestivalId): CuratedPattern[] {
  return CURATED_PATTERNS.filter((p) => hasFestival(p, id));
}

/** Classics in an order that prefers interlaced diamonds for the daily series. */
export function dailyCatalog(): CuratedPattern[] {
  // Daily classics stay on interlaced diamonds, not large square lattices.
  const diamonds = CURATED_PATTERNS.filter((p) => p.gridId.startsWith("d"));
  return diamonds.length ? diamonds : CURATED_PATTERNS.slice();
}

/** Exact traditional configuration, then a coverage-only D4 polish. */
export function applyCurated(pattern: CuratedPattern): MirrorGrid {
  const grid = applyRecipe(GRIDS[pattern.gridId], pattern.recipe, pattern.opts ?? {});
  return polishD4(grid, 1);
}

export function curatedById(id: string): CuratedPattern | undefined {
  return CURATED_PATTERNS.find((p) => p.id === id);
}
