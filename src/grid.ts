export type Point = { x: number; y: number };

export type GridKind = "square" | "diamond";

export type GridId =
  | "5x5"
  | "7x7"
  | "9x9"
  | "11x11"
  | "d5"
  | "d7"
  | "d9"
  | "d95"
  | "d158"
  | "d232"
  | "d2442"
  | "d23432"
  | "d34543";

export type GridSpec = {
  id: GridId;
  label: string;
  kind: GridKind;
  /** Side length for square grids (number of dots on a side). */
  n?: number;
  /** Row occupancies for diamond / interlaced grids, e.g. [1, 3, 5, 3, 1]. */
  rows?: number[];
};

export const GRIDS: Record<GridId, GridSpec> = {
  "5x5": { id: "5x5", label: "5×5 pulli", kind: "square", n: 5 },
  "7x7": { id: "7x7", label: "7×7 pulli", kind: "square", n: 7 },
  "9x9": { id: "9x9", label: "9×9 pulli", kind: "square", n: 9 },
  "11x11": { id: "11x11", label: "11×11 pulli", kind: "square", n: 11 },
  d5: { id: "d5", label: "5-1 pulli", kind: "diamond", rows: [1, 3, 5, 3, 1] },
  d7: { id: "d7", label: "7-1 pulli", kind: "diamond", rows: [1, 3, 5, 7, 5, 3, 1] },
  d9: { id: "d9", label: "9-1 pulli", kind: "diamond", rows: [1, 3, 5, 7, 9, 7, 5, 3, 1] },
  d95: { id: "d95", label: "9-5 pulli", kind: "diamond", rows: [5, 7, 9, 7, 5] },
  d158: {
    id: "d158",
    label: "15-8 pulli",
    kind: "diamond",
    rows: [8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9, 8],
  },
  d232: { id: "d232", label: "2-3-2 pulli", kind: "diamond", rows: [2, 3, 2] },
  d2442: { id: "d2442", label: "2-4-4-2 pulli", kind: "diamond", rows: [2, 4, 4, 2] },
  d23432: { id: "d23432", label: "2-3-4-3-2 pulli", kind: "diamond", rows: [2, 3, 4, 3, 2] },
  d34543: { id: "d34543", label: "3-4-5-4-3 pulli", kind: "diamond", rows: [3, 4, 5, 4, 3] },
};

export const GRID_IDS: GridId[] = [
  "5x5",
  "7x7",
  "9x9",
  "11x11",
  "d5",
  "d7",
  "d9",
  "d95",
  "d158",
  "d232",
  "d2442",
  "d23432",
  "d34543",
];

/**
 * Daily kolams favor small/medium interlaced diamonds. A 9×9 square
 * appears only rarely (once per cycle). 11×11 is left to Create.
 */
export const DAILY_GRID_CYCLE: GridId[] = [
  "d5",
  "d23432",
  "d34543",
  "d7",
  "d9",
  "d2442",
  "d158",
  "9x9",
];

/** Bounding vertex count (highest integer coordinate) for the region box. */
export function interlaceBox(rows: number[]): number {
  const max = Math.max(...rows);
  const xSpan = 1 + (max - 1) * 2;
  const ySpan = 1 + (rows.length - 1) * 2;
  return Math.max(xSpan, ySpan);
}

/** Offset-row packing for small/medium diamonds; large 15-8 stays compact. */
export function isInterlaced(spec: GridSpec): boolean {
  if (spec.kind !== "diamond" || !spec.rows) return false;
  const max = Math.max(...spec.rows);
  return max <= 9 && spec.rows.length <= 9;
}

export function boundingN(spec: GridSpec): number {
  if (spec.kind === "square") return spec.n!;
  return isInterlaced(spec) ? interlaceBox(spec.rows!) : Math.max(...spec.rows!);
}

/** Distance between neighboring pulli. Interlaced diamonds sit on a step-2 lattice. */
export function dotSpacing(spec: GridSpec): number {
  return isInterlaced(spec) ? 2 : 1;
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
  if (!isInterlaced(spec)) {
    const y0 = 1 + Math.floor((max - rows.length) / 2);
    const dots: Point[] = [];
    for (let i = 0; i < rows.length; i++) {
      const count = rows[i];
      const y = y0 + i;
      const start = 1 + Math.floor((max - count) / 2);
      for (let k = 0; k < count; k++) dots.push({ x: start + k, y });
    }
    return dots;
  }
  const box = interlaceBox(rows);
  const xSpan = 1 + (max - 1) * 2;
  const ySpan = 1 + (rows.length - 1) * 2;
  const xShift = Math.floor((box - xSpan) / 2);
  const yShift = Math.floor((box - ySpan) / 2);
  const dots: Point[] = [];
  for (let i = 0; i < rows.length; i++) {
    const count = rows[i];
    const y = 1 + yShift + i * 2;
    const rowSpan = (count - 1) * 2;
    const start = 1 + xShift + (xSpan - 1 - rowSpan) / 2;
    for (let k = 0; k < count; k++) dots.push({ x: start + k * 2, y });
  }
  return dots;
}

export function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Traditional Tamil pulli-count name, e.g. "9×9 pulli" or "2-3-4-3-2 pulli". */
export function pulliLabel(spec: GridSpec): string {
  if (spec.kind === "square") return `${spec.n}×${spec.n} pulli`;
  if (spec.id === "d232") return "2-3-2 pulli";
  if (spec.id === "d2442") return "2-4-4-2 pulli";
  if (spec.id === "d23432") return "2-3-4-3-2 pulli";
  if (spec.id === "d34543") return "3-4-5-4-3 pulli";
  const rows = spec.rows!;
  const max = Math.max(...rows);
  const min = Math.min(...rows);
  return `${max}-${min} pulli`;
}
