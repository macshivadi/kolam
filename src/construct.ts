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

export function orbitRadiusNorm(grid: MirrorGrid, orbit: EdgeRef[]): number {
  const c = grid.c;
  let rSum = 0;
  for (const e of orbit) {
    const m = edgeMid(e);
    rSum += Math.hypot(m.x - c, m.y - c);
  }
  return rSum / orbit.length / (c + 0.01);
}

/** Classify a D4 orbit by where its midpoints sit relative to the grid center. */
export function classifyOrbit(grid: MirrorGrid, orbit: EdgeRef[]): OrbitKind {
  const c = grid.c;
  let diag = 0;
  for (const e of orbit) {
    const m = edgeMid(e);
    const dx = m.x - c;
    const dy = m.y - c;
    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8) diag += 1;
  }
  const rNorm = orbitRadiusNorm(grid, orbit);
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
 * Repair uncovered pulli by toggling whole D4 orbits. Does not minimize
 * loop count — that collapsed many seeds onto the same all-off lattice.
 */
export function polishD4(grid: MirrorGrid, seed: number, maxTries = 8): MirrorGrid {
  let current = grid;
  let best = symmetryScore(current);
  if (best.uncovered === 0) return current;

  const orbits = shuffle(listOrbits(current), seed >>> 0);
  let tries = 0;
  let improved = true;
  while (improved && tries < maxTries && best.uncovered > 0) {
    improved = false;
    for (const orbit of orbits) {
      if (tries >= maxTries) break;
      const next = toggleOrbit(current, orbit);
      const s = symmetryScore(next);
      tries += 1;
      if (s.uncovered < best.uncovered) {
        current = next;
        best = s;
        improved = true;
        if (s.uncovered === 0) return current;
        break;
      }
    }
  }
  return current;
}

/** Unique nonzero n-bit pattern for a seed (consecutive seeds differ). */
export function bitsFromSeed(seed: number, n: number): boolean[] {
  const bits = new Array<boolean>(n).fill(false);
  if (n <= 0) return bits;
  if (n <= 30) {
    const mod = (1 << n) - 1;
    let v = ((seed >>> 0) % mod) + 1;
    for (let i = 0; i < n; i++) bits[i] = ((v >>> i) & 1) === 1;
    return bits;
  }
  const head = bitsFromSeed(seed, 30);
  for (let i = 0; i < 30; i++) bits[i] = head[i];
  const tail = bitsFromSeed(Math.imul(seed, 0x9e3779b9) ^ 0x85ebca6b, n - 30);
  for (let i = 0; i < n - 30; i++) bits[30 + i] = tail[i];
  if (!bits.some(Boolean)) bits[0] = true;
  return bits;
}

/**
 * Place a curated, D4-symmetric set of interior mirrors. A pretty default
 * (border petals, optional center, open interior crossings) is XOR-ed with
 * a unique bit mask from the seed, so each Generate tap and each day is a
 * different valid closed kolam — never the empty all-off lattice.
 */
export function constructSymmetricKolam(spec: GridSpec, seed: number): MirrorGrid {
  const grid = cloneMirrors(buildRegion(spec));
  const orbits = listOrbits(grid);
  const tagged = orbits.map((orbit) => ({
    orbit,
    kind: classifyOrbit(grid, orbit),
  }));

  for (const t of tagged) applyOrbit(grid, t.orbit, false);

  const bits = bitsFromSeed(seed >>> 0, tagged.length);
  for (let i = 0; i < tagged.length; i++) {
    const pretty = tagged[i].kind !== "interior";
    applyOrbit(grid, tagged[i].orbit, pretty !== bits[i]);
  }

  let anyOn = false;
  for (const t of tagged) {
    if (getEdge(grid, t.orbit[0])) {
      anyOn = true;
      break;
    }
  }
  if (!anyOn && tagged.length > 0) {
    applyOrbit(grid, tagged[(seed >>> 0) % tagged.length].orbit, true);
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
