import { hashString } from "./prng";
import { type GridId } from "./grid";
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
export function canonicalHash(grid: MirrorGrid, gridId: GridId = grid.spec.id): string {
  const bits = canonicalBits(grid);
  return `${gridId}:${hashString(bits).toString(16).padStart(8, "0")}`;
}
