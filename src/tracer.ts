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

      loops.push(startLoopAtBottom({ mids, dirs, vertices }));
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


/** Rotate a loop so tracing/animation begins at the bottom-most mid. */
export function startLoopAtBottom(loop: Loop): Loop {
  const n = loop.mids.length;
  if (n === 0) return loop;
  let best = 0;
  for (let i = 1; i < n; i++) {
    const a = loop.mids[i];
    const b = loop.mids[best];
    if (a.y > b.y + 1e-9 || (Math.abs(a.y - b.y) < 1e-9 && a.x < b.x)) best = i;
  }
  if (best === 0) return loop;
  return {
    mids: loop.mids.slice(best).concat(loop.mids.slice(0, best)),
    dirs: loop.dirs.slice(best).concat(loop.dirs.slice(0, best)),
    vertices: loop.vertices.slice(best).concat(loop.vertices.slice(0, best)),
  };
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

/** Isolated teardrop / petal: a short bounce-to-bounce hop in one square. */
export function isTightPetal(loop: Loop, i: number): boolean {
  const n = loop.mids.length;
  if (n === 0) return false;
  const a = loop.mids[i];
  const b = loop.mids[(i + 1) % n];
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  return turnsAt(loop, i) && turnsAt(loop, (i + 1) % n) && dist < 1.05;
}

/**
 * SVG path in grid units, in the traditional sikku style:
 * straight 45° strokes through crossings (merged into one line when
 * several unit cells run together) and a cubic inside the unit square at
 * a mirror bounce (lobes, petals, horns). Handle lengths grow for shallow
 * turns so consecutive segments read as one long hand-drawn sweep, while
 * isolated teardrops stay tight. Commands stay per-local-geometry so the
 * rendered path is D4-symmetric regardless of where the loop is started.
 */
export function loopToPath(loop: Loop): string {
  const mids = loop.mids;
  const n = mids.length;
  if (n === 0) return "";
  const parts = [`M${fmt(mids[0].x)} ${fmt(mids[0].y)}`];
  let i = 0;
  while (i < n) {
    const bouncedA = turnsAt(loop, i);
    const bouncedB = turnsAt(loop, (i + 1) % n);
    if (!bouncedA && !bouncedB) {
      let j = i + 1;
      while (j < n && !turnsAt(loop, j) && !turnsAt(loop, (j + 1) % n)) j += 1;
      const b = mids[j % n];
      parts.push(`L${fmt(b.x)} ${fmt(b.y)}`);
      i = j;
      continue;
    }
    const a = mids[i];
    const b = mids[(i + 1) % n];
    const tA = pathTangent(loop, i);
    const tB = pathTangent(loop, (i + 1) % n);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const dot = tA[0] * tB[0] + tA[1] * tB[1];
    let alphaScale: number;
    if (isTightPetal(loop, i)) alphaScale = 0.42;
    else if (bouncedA && bouncedB) alphaScale = 0.42;
    else if (dot > 0.65) alphaScale = 0.5;
    else if (dot > 0.2) alphaScale = 0.44;
    else alphaScale = 0.36;
    const alpha = dist * alphaScale;
    const c1x = a.x + tA[0] * alpha;
    const c1y = a.y + tA[1] * alpha;
    const c2x = b.x - tB[0] * alpha;
    const c2y = b.y - tB[1] * alpha;
    parts.push(
      `C${fmt2(c1x)} ${fmt2(c1y)} ${fmt2(c2x)} ${fmt2(c2y)} ${fmt(b.x)} ${fmt(b.y)}`,
    );
    i += 1;
  }
  parts.push("Z");
  return parts.join(" ");
}

/** Unit tangent of the path at mid i (leave direction, or bounce bisector). */
export function pathTangent(loop: Loop, i: number): [number, number] {
  const n = loop.dirs.length;
  const leave = loop.dirs[i];
  const prev = loop.dirs[(i + n - 1) % n];
  if (prev[0] === leave[0] && prev[1] === leave[1]) {
    const len = Math.hypot(leave[0], leave[1]) || 1;
    return [leave[0] / len, leave[1] / len];
  }
  const bx = prev[0] + leave[0];
  const by = prev[1] + leave[1];
  const len = Math.hypot(bx, by) || 1;
  return [bx / len, by / len];
}

function fmt2(n: number): string {
  return String(Math.round(n * 100) / 100);
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
