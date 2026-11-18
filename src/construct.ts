import { mulberry32 } from "./prng";
import { type GridSpec } from "./grid";
import {
  buildRegion,
  cloneMirrors,
  listOrbits,
  getEdge,
  setEdge,
  type EdgeRef,
  type MirrorGrid,
} from "./mirrors";
import { traceLoops, type Mid } from "./tracer";

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

function applyOrbit(grid: MirrorGrid, orbit: EdgeRef[], value: boolean): void {
  for (const e of orbit) setEdge(grid, e, value);
}

function toggleOrbit(grid: MirrorGrid, orbit: EdgeRef[]): MirrorGrid {
  const next = cloneMirrors(grid);
  for (const e of orbit) setEdge(next, e, !getEdge(grid, e));
  return next;
}

export type OrbitKind = "center" | "corner" | "edge" | "interior";

/** Classify a D4 orbit by where its midpoints sit relative to the grid center. */
export function classifyOrbit(grid: MirrorGrid, orbit: EdgeRef[]): OrbitKind {
  const c = grid.c;
  let rSum = 0;
  let diag = 0;
  for (const e of orbit) {
    const m = edgeMid(e);
    const dx = m.x - c;
    const dy = m.y - c;
    rSum += Math.hypot(dx, dy);
    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8) diag += 1;
  }
  const rNorm = rSum / orbit.length / (c + 0.01);
  if (rNorm < 0.24) return "center";
  if (rNorm > 0.74 && diag >= orbit.length / 2) return "corner";
  if (rNorm > 0.62) return "edge";
  return "interior";
}

function tinyLoopCount(lengths: number[]): number {
  return lengths.filter((n) => n <= 8).length;
}

/**
 * Lower is better. A single loop is ideal; a small extra center circle is
 * almost as good. Uncovered pulli are heavily penalized.
 *
 * On even-width square regions (our 5×5 / 7×7 / 9×9 / 11×11), a strict D4
 * configuration cannot reach one loop — the empty interior already has
 * n+1 loops — so "few, symmetric" is the realistic target.
 */
export function symmetryScore(grid: MirrorGrid): {
  score: number;
  loops: number;
  uncovered: number;
} {
  const traced = traceLoops(grid);
  const loops = traced.loops.length;
  const uncovered = traced.uncovered.length;
  if (uncovered > 0) {
    return { score: 10_000 + uncovered * 200 + loops, loops, uncovered };
  }
  const tiny = tinyLoopCount(traced.loops.map((l) => l.mids.length));
  let score: number;
  if (loops <= 1) score = 0;
  else if (loops === 2 && tiny === 1) score = 1;
  else if (loops <= 4) score = 4 * (loops - 1);
  else score = 8 * (loops - 1);
  return { score, loops, uncovered };
}

/**
 * Toggle whole D4 orbits only. Tight budget so a 10-year uniqueness walk stays fast.
 */
export function polishD4(grid: MirrorGrid, seed: number, maxTries = 8): MirrorGrid {
  let current = grid;
  let best = symmetryScore(current);
  if (best.score <= 4) return current;

  const orbits = shuffle(listOrbits(current), seed >>> 0);
  let tries = 0;
  let improved = true;
  while (improved && tries < maxTries && best.score > 4) {
    improved = false;
    for (const orbit of orbits) {
      if (tries >= maxTries) break;
      const next = toggleOrbit(current, orbit);
      const s = symmetryScore(next);
      tries += 1;
      if (s.score < best.score) {
        current = next;
        best = s;
        improved = true;
        if (s.score <= 4) return current;
        break;
      }
    }
  }
  return current;
}

/**
 * Place a sparse, D4-symmetric set of interior mirrors: mostly open crossings
 * in the interior, petals and horns on the frame, sometimes a small circle
 * around the center pulli. Every change is a whole orbit, so the drawn
 * kolam stays 4-fold symmetric (including diamonds).
 */
export function constructSymmetricKolam(spec: GridSpec, seed: number): MirrorGrid {
  const grid = cloneMirrors(buildRegion(spec));
  const orbits = listOrbits(grid);
  const rng = mulberry32(seed >>> 0);
  const wantCenter = rng() < 0.34;

  for (const orbit of orbits) {
    const kind = classifyOrbit(grid, orbit);
    let p: number;
    if (kind === "center") p = wantCenter ? 0.92 : 0.06;
    else if (kind === "corner") p = 0.48;
    else if (kind === "edge") p = 0.4;
    else p = 0.1;
    applyOrbit(grid, orbit, rng() < p);
  }

  return polishD4(grid, seed);
}

/** @deprecated D4-safe alias of polishD4. */
export function spliceToSingleLoop(grid: MirrorGrid, seed: number): MirrorGrid {
  return polishD4(grid, seed);
}

/** @deprecated D4-safe alias of polishD4. */
export function polishToSingleLoop(grid: MirrorGrid, seed: number): MirrorGrid {
  return polishD4(grid, seed);
}
