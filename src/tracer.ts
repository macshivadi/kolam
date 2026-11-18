import { pointKey, type Point } from "./grid";
import { type MirrorGrid } from "./mirrors";

/** A midpoint of a unit-square edge, in grid units (halves). */
export type Mid = { x: number; y: number };

export type Loop = {
  /** Midpoints in order; the first point is not repeated at the end. */
  mids: Mid[];
  /** Leave direction (dx, dy) = ±1 at each midpoint. */
  dirs: Array<[number, number]>;
  /** Grid vertices this loop arcs around (including non-dot frame vertices). */
  vertices: Point[];
};

export type TraceResult = {
  loops: Loop[];
  /** Dots that at least one loop actually arcs around. */
  covered: Point[];
  uncovered: Point[];
};

const EPS = 1e-9;

export function isInt(n: number): boolean {
  return Math.abs(n - Math.round(n)) < EPS;
}

/** Integer key for a midpoint: (2x, 2y) packed. */
export function midId(m: Mid): number {
  return (Math.round(m.x * 2) << 8) | (Math.round(m.y * 2) & 0xff);
}

export function midKey(m: Mid): string {
  return `${Math.round(m.x * 2) / 2},${Math.round(m.y * 2) / 2}`;
}

export function isVerticalMid(m: Mid): boolean {
  return isInt(m.x) && !isInt(m.y);
}

export function hasMirrorAt(grid: MirrorGrid, m: Mid): boolean {
  if (isVerticalMid(m)) {
    const x = Math.round(m.x);
    const y = Math.floor(m.y + EPS);
    if (x < 0 || y < 0 || x > grid.W || y >= grid.W) return true;
    const col = grid.v[x];
    return !col || col[y] !== false; // missing slots are walls
  }
  const y = Math.round(m.y);
  const x = Math.floor(m.x + EPS);
  if (x < 0 || y < 0 || x >= grid.W || y > grid.W) return true;
  const col = grid.h[x];
  return !col || col[y] !== false;
}

/** The vertex a quarter-circle from m1 to m2 wraps around. */
export function arcVertex(m1: Mid, m2: Mid): Point {
  return {
    x: isInt(m1.x) ? Math.round(m1.x) : Math.round(m2.x),
    y: isInt(m1.y) ? Math.round(m1.y) : Math.round(m2.y),
  };
}

function squareExists(grid: MirrorGrid, sx: number, sy: number): boolean {
  return sx >= 0 && sy >= 0 && sx < grid.W && sy < grid.W && grid.inSquare[sx][sy];
}

/**
 * Whether traveling from midpoint m with direction (dx, dy) = ±1
 * enters an in-region square.
 */
export function directionEntersSquare(
  grid: MirrorGrid,
  m: Mid,
  dx: number,
  dy: number,
): boolean {
  if (isVerticalMid(m)) {
    const x = Math.round(m.x);
    const y0 = Math.floor(m.y + EPS);
    const sx = dx > 0 ? x : x - 1;
    return squareExists(grid, sx, y0);
  }
  const y = Math.round(m.y);
  const x0 = Math.floor(m.x + EPS);
  const sy = dy > 0 ? y : y - 1;
  return squareExists(grid, x0, sy);
}

export function stepMid(m: Mid, dx: number, dy: number): Mid {
  return { x: m.x + 0.5 * dx, y: m.y + 0.5 * dy };
}

/** One billiard step: leave m with (dx,dy), arrive at next mid with possibly reflected dir. */
export function nextState(
  grid: MirrorGrid,
  m: Mid,
  dx: number,
  dy: number,
): { m: Mid; dx: number; dy: number } {
  const m2 = stepMid(m, dx, dy);
  let ndx = dx;
  let ndy = dy;
  if (hasMirrorAt(grid, m2)) {
    if (isVerticalMid(m2)) ndx = -dx;
    else ndy = -dy;
  }
  return { m: m2, dx: ndx, dy: ndy };
}

export function listMidpoints(grid: MirrorGrid): Mid[] {
  const mids: Mid[] = [];
  for (let y = 0; y <= grid.W; y++) {
    for (let x = 0; x < grid.W; x++) {
      const below = y < grid.W && grid.inSquare[x][y];
      const above = y > 0 && grid.inSquare[x][y - 1];
      if (below || above) mids.push({ x: x + 0.5, y });
    }
  }
  for (let y = 0; y < grid.W; y++) {
    for (let x = 0; x <= grid.W; x++) {
      const right = x < grid.W && grid.inSquare[x][y];
      const left = x > 0 && grid.inSquare[x - 1][y];
      if (right || left) mids.push({ x, y: y + 0.5 });
    }
  }
  return mids;
}

const DIRS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * A mid without a mirror is one port (the crossing). A mid with a mirror
 * has a port for each side; the side is the sign of the component pointing
 * into the square we are leaving toward.
 */
export function portId(grid: MirrorGrid, m: Mid, dx: number, dy: number): number {
  const id = midId(m) << 2;
  if (!hasMirrorAt(grid, m)) return id;
  const side = isVerticalMid(m) ? (dx > 0 ? 1 : 2) : dy > 0 ? 1 : 2;
  return id | side;
}

export function dirIndex(dx: number, dy: number): number {
  return (dx > 0 ? 0 : 2) | (dy > 0 ? 0 : 1);
}

/** Directed leave-state at a midpoint: mid × 4 possible 45° directions. */
export function stateId(m: Mid, dx: number, dy: number): number {
  return (midId(m) << 3) | dirIndex(dx, dy);
}

/**
 * Trace every closed mirror curve on the grid.
 * Ports (midpoint sides) are partitioned into cycles.
 */
export function traceLoops(grid: MirrorGrid): TraceResult {
  const used = new Set<number>();
  const loops: Loop[] = [];

  for (const start of listMidpoints(grid)) {
    for (const [dx0, dy0] of DIRS) {
      if (!directionEntersSquare(grid, start, dx0, dy0)) continue;
      const startState = stateId(start, dx0, dy0);
      if (used.has(startState)) continue;

      const mids: Mid[] = [];
      const dirs: Array<[number, number]> = [];
      const vertices: Point[] = [];
      let m = start;
      let dx = dx0;
      let dy = dy0;
      const guard = grid.W * grid.W * 16 + 8;
      let steps = 0;
      do {
        used.add(stateId(m, dx, dy));
        mids.push(m);
        dirs.push([dx, dy]);
        const nxt = nextState(grid, m, dx, dy);
        vertices.push(arcVertex(m, nxt.m));
        m = nxt.m;
        dx = nxt.dx;
        dy = nxt.dy;
        steps++;
        if (steps > guard) {
          throw new Error("Mirror-curve tracer failed to close a loop");
        }
      } while (stateId(m, dx, dy) !== startState);

      // The opposite orientation is the same curve; don't emit it twice.
      const n = mids.length;
      for (let i = 0; i < n; i++) {
        const prev = dirs[(i + n - 1) % n];
        used.add(stateId(mids[i], -prev[0], -prev[1]));
      }

      loops.push({ mids, dirs, vertices });
    }
  }

  const coveredKeys = new Set<string>();
  const dotSet = new Set(grid.dots.map((d) => pointKey(d.x, d.y)));
  const covered: Point[] = [];
  for (const loop of loops) {
    for (const v of loop.vertices) {
      const k = pointKey(v.x, v.y);
      if (dotSet.has(k) && !coveredKeys.has(k)) {
        coveredKeys.add(k);
        covered.push(v);
      }
    }
  }
  const uncovered = grid.dots.filter((d) => !coveredKeys.has(pointKey(d.x, d.y)));
  return { loops, covered, uncovered };
}

export function allCurvesClosed(loops: Loop[]): boolean {
  return loops.every((loop) => loop.mids.length >= 4);
}

/** Number of valid directed leave-states (mid × entering 45° direction). */
export function directedStateCount(grid: MirrorGrid): number {
  let n = 0;
  for (const m of listMidpoints(grid)) {
    for (const [dx, dy] of DIRS) {
      if (directionEntersSquare(grid, m, dx, dy)) n++;
    }
  }
  return n;
}

/** Distinct bounce/crossing ports (a mirrored mid has one port per side). */
export function portCount(grid: MirrorGrid): number {
  const ports = new Set<number>();
  for (const m of listMidpoints(grid)) {
    for (const [dx, dy] of DIRS) {
      if (directionEntersSquare(grid, m, dx, dy)) ports.add(portId(grid, m, dx, dy));
    }
  }
  return ports.size;
}

/**
 * Center of the unit square that has midpoints `a` and `b` on adjacent sides.
 * Used to round a mirror bounce inside the square (not around a pulli).
 */
export function squareCenterOf(a: Mid, b: Mid): Point {
  if (isVerticalMid(a) && !isVerticalMid(b)) {
    return {
      x: a.x + 0.5 * Math.sign(b.x - a.x),
      y: b.y + 0.5 * Math.sign(a.y - b.y),
    };
  }
  if (!isVerticalMid(a) && isVerticalMid(b)) {
    return {
      x: b.x + 0.5 * Math.sign(a.x - b.x),
      y: a.y + 0.5 * Math.sign(b.y - a.y),
    };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** True when the leave direction changes at mid `i` (a mirror bounce). */
export function turnsAt(loop: Loop, i: number): boolean {
  const n = loop.dirs.length;
  if (n === 0) return false;
  const prev = loop.dirs[(i + n - 1) % n];
  const cur = loop.dirs[i];
  return prev[0] !== cur[0] || prev[1] !== cur[1];
}

/**
 * SVG path in grid units, in the traditional sikku style:
 * straight 45° strokes through crossings (between pulli) and a quarter-circle
 * inside the unit square at a mirror bounce (lobes, petals, horns).
 * Drawing every step as a quarter-circle around a vertex was wrong: it filled
 * a circle around every dot regardless of the mirrors, so every pattern looked
 * the same.
 */
export function loopToPath(loop: Loop): string {
  const mids = loop.mids;
  const n = mids.length;
  if (n === 0) return "";
  const parts = [`M${fmt(mids[0].x)} ${fmt(mids[0].y)}`];
  for (let i = 0; i < n; i++) {
    const a = mids[i];
    const b = mids[(i + 1) % n];
    // Direction changes at b when that midpoint has a mirror.
    const arrivedDx = loop.dirs[i][0];
    const arrivedDy = loop.dirs[i][1];
    const leave = loop.dirs[(i + 1) % n];
    const bounced = leave[0] !== arrivedDx || leave[1] !== arrivedDy;
    if (bounced) {
      const c = squareCenterOf(a, b);
      const sweep = sweepFlag(a, b, c);
      parts.push(`A0.5 0.5 0 0 ${sweep} ${fmt(b.x)} ${fmt(b.y)}`);
    } else {
      parts.push(`L${fmt(b.x)} ${fmt(b.y)}`);
    }
  }
  parts.push("Z");
  return parts.join(" ");
}

function fmt(n: number): string {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * SVG arc sweep (1 = clockwise in the y-down SVG coordinate system).
 * The cross product in y-down coords is positive for clockwise.
 */
export function sweepFlag(a: Mid, b: Mid, v: Point): 0 | 1 {
  const ax = a.x - v.x;
  const ay = a.y - v.y;
  const bx = b.x - v.x;
  const by = b.y - v.y;
  const cross = ax * by - ay * bx;
  return cross > 0 ? 1 : 0;
}
