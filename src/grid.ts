export type Point = { x: number; y: number };

export type GridKind = "square" | "diamond";

export type GridId = "5x5" | "7x7" | "9x9" | "11x11" | "d5" | "d7" | "d9";

export type GridSpec = {
  id: GridId;
  label: string;
  kind: GridKind;
  /** Side length for square grids (number of dots on a side). */
  n?: number;
  /** Row occupancies for diamond grids, e.g. [1, 3, 5, 3, 1]. */
  rows?: number[];
};

export const GRIDS: Record<GridId, GridSpec> = {
  "5x5": { id: "5x5", label: "5×5", kind: "square", n: 5 },
  "7x7": { id: "7x7", label: "7×7", kind: "square", n: 7 },
  "9x9": { id: "9x9", label: "9×9", kind: "square", n: 9 },
  "11x11": { id: "11x11", label: "11×11", kind: "square", n: 11 },
  d5: { id: "d5", label: "1-3-5-3-1", kind: "diamond", rows: [1, 3, 5, 3, 1] },
  d7: { id: "d7", label: "1-3-5-7-5-3-1", kind: "diamond", rows: [1, 3, 5, 7, 5, 3, 1] },
  d9: { id: "d9", label: "1-3-5-7-9-7-5-3-1", kind: "diamond", rows: [1, 3, 5, 7, 9, 7, 5, 3, 1] },
};

export const GRID_IDS: GridId[] = ["5x5", "7x7", "9x9", "11x11", "d5", "d7", "d9"];

/** Larger grids only, so ~10 years of days cannot exhaust the D4 pattern space. */
export const DAILY_GRID_CYCLE: GridId[] = ["7x7", "9x9", "11x11", "d9"];


export function boundingN(spec: GridSpec): number {
  return spec.kind === "square" ? spec.n! : Math.max(...spec.rows!);
}

export function dotsForGrid(spec: GridSpec): Point[] {
  if (spec.kind === "square") {
    const n = spec.n!;
    const dots: Point[] = [];
    for (let y = 1; y <= n; y++) {
      for (let x = 1; x <= n; x++) dots.push({ x, y });
    }
    return dots;
  }
  const rows = spec.rows!;
  const max = Math.max(...rows);
  const dots: Point[] = [];
  for (let i = 0; i < rows.length; i++) {
    const count = rows[i];
    const y = i + 1;
    const start = 1 + Math.floor((max - count) / 2);
    for (let k = 0; k < count; k++) dots.push({ x: start + k, y });
  }
  return dots;
}

export function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}
