import { mulberry32 } from "./prng";
import { type GridSpec } from "./grid";
import {
  buildRegion,
  cloneMirrors,
  listInteriorEdges,
  listOrbits,
  getEdge,
  setEdge,
  type EdgeRef,
  type MirrorGrid,
} from "./mirrors";
import { portId, traceLoops, type Mid } from "./tracer";

class UnionFind {
  private parent: number[];
  private rank: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }
  find(a: number): number {
    while (this.parent[a] !== a) {
      this.parent[a] = this.parent[this.parent[a]];
      a = this.parent[a];
    }
    return a;
  }
  union(a: number, b: number): boolean {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return false;
    if (this.rank[a] < this.rank[b]) {
      const t = a;
      a = b;
      b = t;
    }
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a] += 1;
    return true;
  }
}

function edgeMid(e: EdgeRef): Mid {
  if (e.kind === "h") return { x: e.x + 0.5, y: e.y };
  return { x: e.x, y: e.y + 0.5 };
}

/** In-region squares on either side of an interior edge. */
export function squaresOfEdge(grid: MirrorGrid, e: EdgeRef): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (e.kind === "h") {
    if (e.y < grid.W && grid.inSquare[e.x][e.y]) out.push([e.x, e.y]);
    if (e.y > 0 && grid.inSquare[e.x][e.y - 1]) out.push([e.x, e.y - 1]);
  } else {
    if (e.x < grid.W && grid.inSquare[e.x][e.y]) out.push([e.x, e.y]);
    if (e.x > 0 && grid.inSquare[e.x - 1][e.y]) out.push([e.x - 1, e.y]);
  }
  return out;
}

function squareIndex(sx: number, sy: number, W: number): number {
  return sy * W + sx;
}

function allInteriorOn(base: MirrorGrid): MirrorGrid {
  const grid = cloneMirrors(base);
  for (const e of listInteriorEdges(grid)) setEdge(grid, e, true);
  return grid;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed >>> 0);
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * A D4-symmetric opening of interior mirrors, grown like a symmetric
 * spanning forest on the dual of the unit squares. Because orbit sizes
 * are even, this typically bottoms out at 2 (sometimes 4) loops; a
 * single extra opening then splices them into one continuous line.
 */
export function constructSymmetricKolam(spec: GridSpec, seed: number): MirrorGrid {
  const base = buildRegion(spec);
  const grid = allInteriorOn(base);
  const orbits = listOrbits(grid);
  const uf = new UnionFind(grid.W * grid.W);
  const order = shuffle(orbits, seed);

  for (const orbit of order) {
    let merges = false;
    for (const e of orbit) {
      const sq = squaresOfEdge(grid, e);
      if (sq.length < 2) continue;
      const a = squareIndex(sq[0][0], sq[0][1], grid.W);
      const b = squareIndex(sq[1][0], sq[1][1], grid.W);
      if (uf.find(a) !== uf.find(b)) {
        merges = true;
        break;
      }
    }
    if (!merges) continue;
    for (const e of orbit) {
      setEdge(grid, e, false);
      const sq = squaresOfEdge(grid, e);
      if (sq.length === 2) {
        uf.union(
          squareIndex(sq[0][0], sq[0][1], grid.W),
          squareIndex(sq[1][0], sq[1][1], grid.W),
        );
      }
    }
  }

  return polishToSingleLoop(spliceToSingleLoop(grid, seed), seed);
}

/**
 * Open one interior mirror at a time where the two sides belong to
 * different loops, until a single loop remains (or no such splice exists).
 * The first splice is enough on most D4 constructions; a few more may
 * be used. Picks the splice deterministically from `seed`.
 */
export function spliceToSingleLoop(grid: MirrorGrid, seed: number): MirrorGrid {
  let current = grid;
  for (let step = 0; step < 32; step++) {
    const traced = traceLoops(current);
    if (traced.loops.length <= 1 && traced.uncovered.length === 0) return current;
    const loopOfPort = new Map<number, number>();
    for (const [li, loop] of traced.loops.entries()) {
      for (let i = 0; i < loop.mids.length; i++) {
        const [dx, dy] = loop.dirs[i];
        loopOfPort.set(portId(current, loop.mids[i], dx, dy), li);
      }
    }

    const candidates: EdgeRef[] = [];
    for (const e of listInteriorEdges(current)) {
      if (!edgeIsMirror(current, e)) continue;
      const ports = portsOfMirroredEdge(current, e);
      if (ports.length < 2) continue;
      const la = loopOfPort.get(ports[0]);
      const lb = loopOfPort.get(ports[1]);
      if (la === undefined || lb === undefined) continue;
      if (la !== lb) candidates.push(e);
    }
    if (candidates.length === 0) return current;

    // Deterministic pick: sort by position, then choose by seed+step.
    candidates.sort((a, b) =>
      a.kind !== b.kind
        ? a.kind < b.kind
          ? -1
          : 1
        : a.y !== b.y
          ? a.y - b.y
          : a.x - b.x,
    );
    const rng = mulberry32((seed >>> 0) ^ Math.imul(step + 1, 0x9e3779b9));
    const pick = candidates[Math.floor(rng() * candidates.length)];
    const next = cloneMirrors(current);
    setEdge(next, pick, false);
    current = next;
  }
  return current;
}

/**
 * If opening walls is not enough, toggling (often closing) a remaining
 * edge can splice the last two loops into one. Bounded and deterministic.
 */
export function polishToSingleLoop(grid: MirrorGrid, seed: number): MirrorGrid {
  let current = grid;
  let loops = traceLoops(current).loops.length;
  if (loops <= 1) return current;

  const order = shuffle(listInteriorEdges(current), (seed >>> 0) ^ 0x51ed);

  for (let step = 0; step < 16 && loops > 1; step++) {
    let improved = false;
    for (const e of order) {
      const next = cloneMirrors(current);
      setEdge(next, e, !getEdge(current, e));
      const t = traceLoops(next);
      if (t.uncovered.length === 0 && t.loops.length < loops) {
        current = next;
        loops = t.loops.length;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  return current;
}

function edgeIsMirror(grid: MirrorGrid, e: EdgeRef): boolean {
  return e.kind === "h" ? grid.h[e.x][e.y] : grid.v[e.x][e.y];
}

function portsOfMirroredEdge(grid: MirrorGrid, e: EdgeRef): number[] {
  const m = edgeMid(e);
  if (e.kind === "v") {
    return [portId(grid, m, 1, 1), portId(grid, m, -1, 1)];
  }
  return [portId(grid, m, 1, 1), portId(grid, m, 1, -1)];
}
