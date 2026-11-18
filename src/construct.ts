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

export type RecipeId =
  | "cross-knot"
  | "center-chain"
  | "rosette"
  | "frame-petals"
  | "lotus"
  | "star-diag"
  | "nested"
  | "sparse-knots"
  | "outer-ring"
  | "diamond-petals"
  | "teardrop-edge"
  | "heart-petals"
  | "petal-crown"
  | "cardinal-lotus"
  | "quad-windows"
  | "star-knots"
  | "deepam";

export const RECIPE_IDS: RecipeId[] = [
  "cross-knot",
  "center-chain",
  "rosette",
  "frame-petals",
  "lotus",
  "star-diag",
  "nested",
  "sparse-knots",
  "outer-ring",
  "diamond-petals",
];

export type RecipeOpts = {
  /** Which interior radius band (0 = innermost) a ring recipe emphasizes. */
  band?: number;
  /** Leave the outer frame as crossings (open) instead of the recipe default. */
  openFrame?: boolean;
};

export type TaggedOrbit = {
  orbit: EdgeRef[];
  kind: OrbitKind;
  r: number;
  axis: boolean;
  diag: boolean;
};

export function tagOrbit(grid: MirrorGrid, orbit: EdgeRef[]): TaggedOrbit {
  const kind = classifyOrbit(grid, orbit);
  const r = orbitRadiusNorm(grid, orbit);
  const c = grid.c;
  let axisN = 0;
  let diagN = 0;
  for (const e of orbit) {
    const m = edgeMid(e);
    const dx = Math.abs(m.x - c);
    const dy = Math.abs(m.y - c);
    if (dx < 0.6 || dy < 0.6) axisN += 1;
    if (Math.abs(dx - dy) < 0.8) diagN += 1;
  }
  return {
    orbit,
    kind,
    r,
    axis: axisN >= orbit.length / 2,
    diag: diagN >= orbit.length / 2,
  };
}

function bandKeys(tagged: TaggedOrbit[], kind: OrbitKind): number[] {
  const keys = new Set<number>();
  for (const t of tagged) {
    if (t.kind === kind) keys.add(Math.round(t.r * 8));
  }
  return [...keys].sort((a, b) => a - b);
}

/**
 * Build a traditional D4 sikku skeleton: plus/cross with center circles and
 * corner teardrops, axis teardrop chains, rosette rings, frame petals, or
 * a lotus of inner rings. Variation happens later, on decorative interiors.
 */
export function applyRecipe(spec: GridSpec, recipe: RecipeId, opts: RecipeOpts = {}): MirrorGrid {
  const grid = cloneMirrors(buildRegion(spec));
  const tagged = listOrbits(grid).map((orbit) => tagOrbit(grid, orbit));
  const bands = bandKeys(tagged, "interior");
  const edgeBands = bandKeys(tagged, "edge");
  // Default ring recipes to a mid / inner / outer band so they stay distinct.
  const mid = bands.length ? bands[Math.floor(bands.length / 2)] : -1;
  const focus = bands.length ? bands[Math.abs(opts.band ?? Math.floor(bands.length / 2)) % bands.length] : -1;
  const inner = bands.length ? bands[0] : -1;
  const outer = bands.length ? bands[bands.length - 1] : -1;
  const edgeOuter = edgeBands.length ? edgeBands[edgeBands.length - 1] : -1;
  const hasCorners = tagged.some((t) => t.kind === "corner");

  for (const t of tagged) {
    const band = Math.round(t.r * 8);
    const isInner = t.kind === "interior" && band === inner;
    const isOuter = t.kind === "interior" && band === outer;
    const isMid = t.kind === "interior" && band === mid;
    const isFocus = t.kind === "interior" && band === focus;
    const isOutEdge = t.kind === "edge" && band === edgeOuter;
    let on = false;
    switch (recipe) {
      case "cross-knot":
        // Plus/cross: small center circles and corner teardrop knots.
        on = t.kind === "center" || t.kind === "corner";
        break;
      case "center-chain":
        on = t.kind === "center" || t.kind === "corner" || (t.kind === "interior" && t.axis);
        break;
      case "rosette":
        on = t.kind === "center" || t.kind === "corner" || (opts.band !== undefined ? isFocus : isMid);
        break;
      case "frame-petals":
        on = t.kind === "corner" || isOutEdge;
        break;
      case "lotus":
        on = t.kind === "center" || t.kind === "corner" || isInner;
        break;
      case "star-diag":
        on = t.kind === "center" || (t.kind === "interior" && t.diag);
        break;
      case "nested":
        on =
          t.kind === "center" ||
          t.kind === "corner" ||
          (t.kind === "interior" && band % 2 === (opts.band ?? 0) % 2);
        break;
      case "sparse-knots":
        on = hasCorners ? t.kind === "corner" : t.kind === "center";
        break;
      case "outer-ring":
        on = t.kind === "center" || t.kind === "corner" || isOuter;
        break;
      case "diamond-petals":
        on = t.kind === "center" || t.kind === "corner" || isOutEdge;
        break;
      case "teardrop-edge":
        // A teardrop loop around every outer pulli — the classic diamond sikku edge.
        on = t.kind === "center" || t.kind === "corner" || t.kind === "edge";
        break;
      case "heart-petals":
        // Four heart/petal lobes on the cardinals, open toward the rim.
        on = t.kind === "center" || t.kind === "corner" || (t.kind === "interior" && t.axis && (isMid || isOuter));
        break;
      case "petal-crown":
        // Inner lotus with an outer petal ring.
        on = t.kind === "center" || t.kind === "corner" || isInner || isOutEdge;
        break;
      case "cardinal-lotus":
        // Diamond body with lotus/leaf at the four tips.
        on = t.kind === "center" || t.kind === "corner" || (t.kind === "interior" && t.axis) || isOutEdge;
        break;
      case "quad-windows":
        // Four rounded window-panes around a plus.
        on = t.kind === "center" || isMid || isOutEdge;
        break;
      case "star-knots":
        // Diagonal star with corner teardrop knots.
        on = t.kind === "center" || t.kind === "corner" || (t.kind === "interior" && t.diag);
        break;
      case "deepam":
        // Four-lamp Diwali skeleton: central bowl, axis stems, tip flames.
        on = t.kind === "center" || isInner || t.kind === "corner" || (t.kind === "interior" && t.axis && isOuter);
        break;
    }
    if (opts.openFrame && t.kind === "edge") on = false;
    applyOrbit(grid, t.orbit, on);
  }
  return grid;
}

/**
 * Traditional template plus a unique, limited variation on decorative
 * (currently off) interior orbits. Never the empty all-off lattice.
 * Coverage is repaired by polishD4; loop count is not minimized.
 */
export function constructSymmetricKolam(spec: GridSpec, seed: number): MirrorGrid {
  const s = seed >>> 0;
  // Keep the recipe stable across nearby seeds so bit patterns stay unique.
  const recipe = RECIPE_IDS[Math.floor(s / 257) % RECIPE_IDS.length];
  const band = (s >>> 8) % 4;
  const grid = applyRecipe(spec, recipe, { band });
  const tagged = listOrbits(grid).map((orbit) => tagOrbit(grid, orbit));
  const freeInt = tagged.filter((t) => t.kind === "interior" && !getEdge(grid, t.orbit[0]));
  const edges = tagged
    .filter((t) => t.kind === "edge" && !getEdge(grid, t.orbit[0]))
    .sort((a, b) => b.r - a.r);
  const need = 10;
  const extra = freeInt.slice();
  for (const e of edges) {
    if (extra.length >= need) break;
    extra.push(e);
  }
  // Small grids need more unique bits; XOR leftover orbits.
  if (extra.length < 8) {
    for (const t of tagged) {
      if (extra.length >= 8) break;
      if (!extra.includes(t)) extra.push(t);
    }
  }
  if (extra.length > 0) {
    const bits = bitsFromSeed(s, extra.length);
    for (let i = 0; i < extra.length; i++) {
      if (!bits[i]) continue;
      const t = extra[i];
      applyOrbit(grid, t.orbit, !getEdge(grid, t.orbit[0]));
    }
  }

  let anyOn = false;
  for (const t of tagged) {
    if (getEdge(grid, t.orbit[0])) {
      anyOn = true;
      break;
    }
  }
  if (!anyOn && tagged.length > 0) {
    applyOrbit(grid, tagged[s % tagged.length].orbit, true);
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
