import { hashString } from "./prng";
import { type Loop, type Mid } from "./tracer";
import {
  type EdgeRef,
  type MirrorGrid,
  getEdge,
  listInteriorEdges,
  reflectEdgeV,
  rotateEdge90,
} from "./mirrors";

/**
 * Serialize interior mirrors in a stable (x, y, kind) order.
 * Boundary mirrors are implied by the region and omitted.
 */
export function serializeMirrors(grid: MirrorGrid): string {
  const edges = listInteriorEdges(grid);
  edges.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  let bits = "";
  for (const e of edges) bits += getEdge(grid, e) ? "1" : "0";
  return bits;
}

const TRANSFORMS: Array<(e: EdgeRef, c: number) => EdgeRef> = [
  (e) => e,
  (e, c) => rotateEdge90(e, c),
  (e, c) => rotateEdge90(rotateEdge90(e, c), c),
  (e, c) => rotateEdge90(rotateEdge90(rotateEdge90(e, c), c), c),
  (e, c) => reflectEdgeV(e, c),
  (e, c) => rotateEdge90(reflectEdgeV(e, c), c),
  (e, c) => rotateEdge90(rotateEdge90(reflectEdgeV(e, c), c), c),
  (e, c) => rotateEdge90(rotateEdge90(rotateEdge90(reflectEdgeV(e, c), c), c), c),
];

/**
 * Apply a D4 transform to every interior edge and return the bit-string
 * of the transformed configuration, in the same canonical edge order.
 */
export function serializeTransformed(
  grid: MirrorGrid,
  transform: (e: EdgeRef, c: number) => EdgeRef,
): string {
  const edges = listInteriorEdges(grid);
  edges.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  // For each edge slot in canonical order, look up the preimage...
  // Easier: build a map from transformed edge -> value of original.
  const valueByKey = new Map<string, boolean>();
  const all = listInteriorEdges(grid);
  for (const e of all) {
    const t = transform(e, grid.c);
    valueByKey.set(`${t.kind}:${t.x},${t.y}`, getEdge(grid, e));
  }
  let bits = "";
  for (const slot of edges) {
    const v = valueByKey.get(`${slot.kind}:${slot.x},${slot.y}`);
    bits += v ? "1" : "0";
  }
  return bits;
}

/**
 * Lexicographically least serialization of the interior mirrors
 * under the dihedral group D4 (rotations and reflections).
 */
export function canonicalBits(grid: MirrorGrid): string {
  let best: string | null = null;
  for (const t of TRANSFORMS) {
    const s = serializeTransformed(grid, t);
    if (best === null || s < best) best = s;
  }
  return best!;
}

/**
 * Identity of a kolam pattern: grid id + D4-normalized hash of its mirrors.
 * Two patterns that are rotations or reflections of each other share this key.
 */
export function canonicalHash(grid: MirrorGrid, gridId: string = grid.spec.id): string {
  const bits = canonicalBits(grid);
  return `${gridId}:${hashString(bits).toString(16).padStart(8, "0")}`;
}


/** 8 D4 images of a point around center `c` (y-down, 90° clockwise). */
export function d4Point(x: number, y: number, t: number, c: number): [number, number] {
  const dx = x - c;
  const dy = y - c;
  switch (t) {
    case 0:
      return [c + dx, c + dy];
    case 1:
      return [c - dy, c + dx];
    case 2:
      return [c - dx, c - dy];
    case 3:
      return [c + dy, c - dx];
    case 4:
      return [c - dx, c + dy];
    case 5:
      return [c - dy, c - dx];
    case 6:
      return [c + dx, c - dy];
    case 7:
      return [c + dy, c + dx];
    default:
      return [x, y];
  }
}

/** Packed midpoint (2x, 2y) for a cheap lex comparison. */
function packMid(m: Mid): number {
  return ((Math.round(m.x * 2) + 64) << 8) | (Math.round(m.y * 2) + 64);
}

/**
 * Lexicographically smallest rotation of a cyclic sequence.
 * O(n) comparisons of the first differing entry, O(n) worst-case overall
 * when there are few ties (typical for kolam mid-cycles).
 */
function smallestRotation(seq: number[]): number[] {
  const n = seq.length;
  let best = 0;
  for (let i = 1; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const a = seq[(best + k) % n];
      const b = seq[(i + k) % n];
      if (b < a) {
        best = i;
        break;
      }
      if (b > a) break;
    }
  }
  const out = new Array<number>(n);
  for (let k = 0; k < n; k++) out[k] = seq[(best + k) % n];
  return out;
}

function packKey(seq: number[]): string {
  return seq.join(",");
}

/** Rotation- and reversal-invariant serialization of one closed mid-cycle. */
export function serializeLoopMids(mids: Mid[]): string {
  const n = mids.length;
  if (n === 0) return "";
  const tokens = mids.map(packMid);
  const fwd = packKey(smallestRotation(tokens));
  const rev = packKey(smallestRotation(tokens.slice().reverse()));
  return fwd < rev ? fwd : rev;
}

/** Human-readable mid cycle, used in tests. */
export function serializeLoopMidsReadable(mids: Mid[]): string {
  return serializeLoopMids(mids);
}

/**
 * D4-normalized hash of the *drawn* loops (midpoint cycles), not just the
 * raw mirror bits. Two patterns that look the same under rotation or
 * reflection share this key.
 */
export function canonicalGeometryHash(
  grid: { spec: { id: string }; c: number },
  loops: Loop[],
): string {
  let best: string | null = null;
  for (let t = 0; t < 8; t++) {
    const keys = loops.map((loop) => {
      const mids = loop.mids.map((m) => {
        const [x, y] = d4Point(m.x, m.y, t, grid.c);
        return { x, y };
      });
      return serializeLoopMids(mids);
    });
    keys.sort();
    const s = keys.join("|");
    if (best === null || s < best) best = s;
  }
  return `${grid.spec.id}:${hashString(best!).toString(16).padStart(8, "0")}`;
}
