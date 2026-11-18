import { mulberry32 } from "./prng";
import {
  type GridSpec,
  type Point,
  boundingN,
  dotsForGrid,
  pointKey,
} from "./grid";

/** Axis-aligned unit-square grid with optional mirrors on each edge. */
export type MirrorGrid = {
  spec: GridSpec;
  /** Bounding number of dots (e.g. 7 for 7×7 or 1-3-5-7-5-3-1). */
  max: number;
  /** Number of unit squares on a side: max + 1. */
  W: number;
  /** Center of the vertex grid, (max + 1) / 2. Integer for odd max. */
  c: number;
  dots: Point[];
  inSquare: boolean[][];
  /** Horizontal edges: h[x][y] is the edge (x,y)–(x+1,y). */
  h: boolean[][];
  /** Vertical edges: v[x][y] is the edge (x,y)–(x,y+1). */
  v: boolean[][];
  interiorH: boolean[][];
  interiorV: boolean[][];
};

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function emptyBool(xw: number, yw: number, fill = false): boolean[][] {
  const a: boolean[][] = new Array(xw);
  for (let x = 0; x < xw; x++) a[x] = new Array(yw).fill(fill);
  return a;
}

export function cloneBool(src: boolean[][]): boolean[][] {
  return src.map((col) => col.slice());
}

/** Build the region, with mirrors on every boundary edge and none interior. */
export function buildRegion(spec: GridSpec): MirrorGrid {
  const max = boundingN(spec);
  const W = max + 1;
  const c = W / 2;
  const dots = dotsForGrid(spec);

  const inVertex: boolean[][] = emptyBool(W + 1, W + 1, false);
  for (let y = 0; y <= W; y++) {
    for (let x = 0; x <= W; x++) {
      let ok = false;
      for (const d of dots) {
        if (chebyshev(x, y, d.x, d.y) <= 1) {
          ok = true;
          break;
        }
      }
      inVertex[x][y] = ok;
    }
  }

  const inSquare = emptyBool(W, W, false);
  for (let sy = 0; sy < W; sy++) {
    for (let sx = 0; sx < W; sx++) {
      inSquare[sx][sy] =
        inVertex[sx][sy] &&
        inVertex[sx + 1][sy] &&
        inVertex[sx][sy + 1] &&
        inVertex[sx + 1][sy + 1];
    }
  }

  const h = emptyBool(W, W + 1, false);
  const v = emptyBool(W + 1, W, false);
  const interiorH = emptyBool(W, W + 1, false);
  const interiorV = emptyBool(W + 1, W, false);

  for (let y = 0; y <= W; y++) {
    for (let x = 0; x < W; x++) {
      const below = y < W && inSquare[x][y];
      const above = y > 0 && inSquare[x][y - 1];
      if (below || above) {
        const interior = below && above;
        interiorH[x][y] = interior;
        h[x][y] = !interior; // boundary always mirrored
      }
    }
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x <= W; x++) {
      const right = x < W && inSquare[x][y];
      const left = x > 0 && inSquare[x - 1][y];
      if (right || left) {
        const interior = right && left;
        interiorV[x][y] = interior;
        v[x][y] = !interior;
      }
    }
  }

  return { spec, max, W, c, dots, inSquare, h, v, interiorH, interiorV };
}

export type EdgeRef = { kind: "h" | "v"; x: number; y: number };

/** 90° clockwise in screen coordinates (y down) around the grid center. */
export function rotateEdge90(e: EdgeRef, c: number): EdgeRef {
  if (e.kind === "h") {
    return { kind: "v", x: 2 * c - e.y, y: e.x };
  }
  return { kind: "h", x: 2 * c - e.y - 1, y: e.x };
}

/** Reflection across the vertical line x = c. */
export function reflectEdgeV(e: EdgeRef, c: number): EdgeRef {
  if (e.kind === "h") {
    return { kind: "h", x: 2 * c - e.x - 1, y: e.y };
  }
  return { kind: "v", x: 2 * c - e.x, y: e.y };
}

export function edgeKey(e: EdgeRef): string {
  return `${e.kind}:${e.x},${e.y}`;
}

function isInteriorEdge(grid: MirrorGrid, e: EdgeRef): boolean {
  if (e.kind === "h") {
    if (e.x < 0 || e.y < 0 || e.x >= grid.W || e.y > grid.W) return false;
    return grid.interiorH[e.x][e.y];
  }
  if (e.x < 0 || e.y < 0 || e.x > grid.W || e.y >= grid.W) return false;
  return grid.interiorV[e.x][e.y];
}

/** All D4 (rotation + reflection) copies of an interior edge. */
export function d4Orbit(grid: MirrorGrid, start: EdgeRef): EdgeRef[] {
  const seen = new Set<string>();
  const out: EdgeRef[] = [];
  const add = (e: EdgeRef) => {
    if (!isInteriorEdge(grid, e)) return;
    const k = edgeKey(e);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  let e = start;
  for (let r = 0; r < 4; r++) {
    add(e);
    add(reflectEdgeV(e, grid.c));
    e = rotateEdge90(e, grid.c);
  }
  return out;
}

export function listInteriorEdges(grid: MirrorGrid): EdgeRef[] {
  const edges: EdgeRef[] = [];
  for (let y = 0; y <= grid.W; y++) {
    for (let x = 0; x < grid.W; x++) {
      if (grid.interiorH[x][y]) edges.push({ kind: "h", x, y });
    }
  }
  for (let y = 0; y < grid.W; y++) {
    for (let x = 0; x <= grid.W; x++) {
      if (grid.interiorV[x][y]) edges.push({ kind: "v", x, y });
    }
  }
  return edges;
}

export function listOrbits(grid: MirrorGrid): EdgeRef[][] {
  const seen = new Set<string>();
  const orbits: EdgeRef[][] = [];
  for (const e of listInteriorEdges(grid)) {
    const k = edgeKey(e);
    if (seen.has(k)) continue;
    const orbit = d4Orbit(grid, e);
    for (const o of orbit) seen.add(edgeKey(o));
    if (orbit.length > 0) orbits.push(orbit);
  }
  return orbits;
}

function applyOrbit(grid: MirrorGrid, orbit: EdgeRef[], value: boolean): void {
  for (const e of orbit) {
    if (e.kind === "h") grid.h[e.x][e.y] = value;
    else grid.v[e.x][e.y] = value;
  }
}

/**
 * Place a D4-symmetric random set of interior mirrors.
 * `density` is the probability each orbit is "on".
 */
export function placeSymmetricMirrors(
  base: MirrorGrid,
  seed: number,
  density = 0.38,
  orbits?: EdgeRef[][],
): MirrorGrid {
  const grid: MirrorGrid = {
    ...base,
    h: cloneBool(base.h),
    v: cloneBool(base.v),
    // region masks are immutable and shared
  };
  const rng = mulberry32(seed >>> 0);
  const used = orbits ?? listOrbits(grid);
  for (const orbit of used) {
    applyOrbit(grid, orbit, rng() < density);
  }
  return grid;
}

/** Copy a grid's mirrors into a fresh object (region masks shared). */
export function cloneMirrors(grid: MirrorGrid): MirrorGrid {
  return { ...grid, h: cloneBool(grid.h), v: cloneBool(grid.v) };
}

/** Number of interior orbits (degrees of freedom under D4). */
export function orbitCount(spec: GridSpec): number {
  return listOrbits(buildRegion(spec)).length;
}

export function setEdge(grid: MirrorGrid, e: EdgeRef, value: boolean): void {
  if (e.kind === "h") grid.h[e.x][e.y] = value;
  else grid.v[e.x][e.y] = value;
}

export function getEdge(grid: MirrorGrid, e: EdgeRef): boolean {
  return e.kind === "h" ? grid.h[e.x][e.y] : grid.v[e.x][e.y];
}

/** Debug / tests: whether the placed interior mirrors are D4-symmetric. */
export function isD4Symmetric(grid: MirrorGrid): boolean {
  for (const orbit of listOrbits(grid)) {
    const val = getEdge(grid, orbit[0]);
    for (const e of orbit) {
      if (getEdge(grid, e) !== val) return false;
    }
  }
  return true;
}

export function dotKeySet(dots: Point[]): Set<string> {
  return new Set(dots.map((d) => pointKey(d.x, d.y)));
}
