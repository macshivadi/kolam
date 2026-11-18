import { sampleSvgPath } from "./pathGeom";
import type { KolamPattern } from "./generator";

export type FillRegion = {
  d: string;
  fill: string;
  ring: number;
  cx: number;
  cy: number;
  area: number;
};

const SCALE = 28;

function stampDisc(pix: Uint8Array, w: number, h: number, px: number, py: number, r: number): void {
  const x0 = Math.max(0, Math.floor(px - r));
  const x1 = Math.min(w - 1, Math.ceil(px + r));
  const y0 = Math.max(0, Math.floor(py - r));
  const y1 = Math.min(h - 1, Math.ceil(py + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - px;
      const dy = y + 0.5 - py;
      if (dx * dx + dy * dy <= r2) pix[y * w + x] = 1;
    }
  }
}

function rasterizeStrokes(paths: string[], padding: number, W: number, scale: number): {
  pix: Uint8Array;
  w: number;
  h: number;
  scale: number;
  padding: number;
} {
  const w = Math.max(8, Math.ceil((W + padding * 2) * scale));
  const h = w;
  const pix = new Uint8Array(w * h);
  const radius = Math.max(1.6, 0.08 * scale);
  const maxGap = 0.45;

  const toPx = (x: number, y: number): [number, number] => [(x + padding) * scale, (y + padding) * scale];

  for (const d of paths) {
    const pts = sampleSvgPath(d, 20);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = toPx(pts[i - 1].x, pts[i - 1].y);
      const [x1, y1] = toPx(pts[i].x, pts[i].y);
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(dist / maxGap));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        stampDisc(pix, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
      }
    }
  }
  return { pix, w, h, scale, padding };
}

function flood(pix: Uint8Array, w: number, h: number, sx: number, sy: number, id: number): { area: number; sx: number; sy: number; touchesEdge: boolean } {
  const stack = [sy * w + sx];
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  let touchesEdge = false;
  pix[sy * w + sx] = id;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    area += 1;
    sumX += x;
    sumY += y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
    const nbs = [i - 1, i + 1, i - w, i + w];
    for (const n of nbs) {
      if (n < 0 || n >= pix.length) continue;
      if (pix[n] !== 0) continue;
      const nx = n % w;
      const ny = (n / w) | 0;
      // prevent wrap on left/right
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      pix[n] = id;
      stack.push(n);
    }
  }
  return { area, sx: sumX / area, sy: sumY / area, touchesEdge };
}

type RawRegion = { id: number; area: number; cx: number; cy: number };

function extractRegions(
  pix: Uint8Array,
  w: number,
  h: number,
  scale: number,
  padding: number,
): RawRegion[] {
  let nextId = 2;
  const raw: RawRegion[] = [];
  const minArea = Math.max(10, (0.12 * scale) * (0.12 * scale));
  for (let i = 0; i < pix.length; i++) {
    if (pix[i] !== 0) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const info = flood(pix, w, h, x, y, nextId);
    if (!info.touchesEdge && info.area >= minArea) {
      raw.push({
        id: nextId,
        area: info.area / (scale * scale),
        cx: info.sx / scale - padding,
        cy: info.sy / scale - padding,
      });
    }
    nextId += 1;
    if (nextId >= 254) break;
  }
  return raw;
}

/** Moore-neighbor contour in pixel space, then converted to grid units. */
function regionPath(
  pix: Uint8Array,
  w: number,
  h: number,
  id: number,
  scale: number,
  padding: number,
): string | null {
  let start = -1;
  for (let i = 0; i < pix.length; i++) {
    if (pix[i] === id) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const sx = start % w;
  const sy = (start / w) | 0;

  // 8-neighborhood clockwise starting east
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];

  const pts: Array<[number, number]> = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  const startKey = sy * w + sx;
  let guard = 0;
  const max = w * h * 4;

  do {
    pts.push([x, y]);
    // start searching from dir-2 (come from left of current heading)
    let found = -1;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8; // turn left first
      const nx = x + DX[nd];
      const ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (pix[ny * w + nx] === id) {
        found = nd;
        break;
      }
    }
    if (found < 0) break;
    x += DX[found];
    y += DY[found];
    dir = found;
    guard += 1;
  } while ((y * w + x) !== startKey && guard < max);

  if (pts.length < 3) return null;

  // Downsample lightly
  const simp: Array<[number, number]> = [];
  const step = Math.max(1, Math.floor(pts.length / 180));
  for (let i = 0; i < pts.length; i += step) simp.push(pts[i]);
  if (simp.length < 3) return null;

  const toG = (px: number, py: number) => {
    const gx = Math.round((px / scale - padding) * 100) / 100;
    const gy = Math.round((py / scale - padding) * 100) / 100;
    return `${gx} ${gy}`;
  };
  const parts = [`M${toG(simp[0][0], simp[0][1])}`];
  for (let i = 1; i < simp.length; i++) parts.push(`L${toG(simp[i][0], simp[i][1])}`);
  parts.push("Z");
  return parts.join(" ");
}

/**
 * Extract filled faces between the sikku curves and assign rangoli colors
 * by D4-invariant ring (distance from the grid center) so all 8 copies match.
 */
export function colorRegions(pattern: KolamPattern, palette: readonly string[]): FillRegion[] {
  if (pattern.paths.length === 0 || palette.length === 0) return [];
  const padding = 1.15;
  const { pix, w, h, scale } = rasterizeStrokes(pattern.paths, padding, pattern.grid.W, SCALE);
  const raw = extractRegions(pix, w, h, scale, padding);
  if (raw.length === 0) return [];

  const c = pattern.grid.c;
  const rings = [...new Set(raw.map((r) => Math.round(Math.hypot(r.cx - c, r.cy - c) * 2) / 2))].sort(
    (a, b) => a - b,
  );
  const ringIndex = new Map(rings.map((r, i) => [r, i]));

  const out: FillRegion[] = [];
  for (const r of raw) {
    const d = regionPath(pix, w, h, r.id, scale, padding);
    if (!d) continue;
    const ring = Math.round(Math.hypot(r.cx - c, r.cy - c) * 2) / 2;
    const idx = ringIndex.get(ring) ?? 0;
    const areaBucket = r.area > 0.55 ? 1 : 0;
    const fill = palette[(idx * 2 + areaBucket) % palette.length];
    out.push({ d, fill, ring, cx: r.cx, cy: r.cy, area: r.area });
  }
  return out;
}
