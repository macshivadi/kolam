import { sampleSvgPath } from "./pathGeom";
import { d4Point } from "./canonical";
import type { KolamPattern } from "./generator";
import { dotSpacing } from "./grid";

export type FillRegion = {
  d: string;
  fill: string;
  ring: number;
  cx: number;
  cy: number;
  area: number;
};

/** Must stay in step with the outline width in render.ts. */
export const FILL_STROKE = 0.2;
const SCALE = 40;

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

function rasterizeStrokes(paths: string[], padding: number, W: number, scale: number, strokeWidth = FILL_STROKE): {
  pix: Uint8Array;
  w: number;
  h: number;
  scale: number;
  padding: number;
} {
  const w = Math.max(8, Math.ceil((W + padding * 2) * scale));
  const h = w;
  const pix = new Uint8Array(w * h);
  // Slightly thicker than half the outline so fills sit inside the stroke.
  const radius = Math.max(1.4, (strokeWidth / 2 + 0.012) * scale);
  const maxGap = 0.4;

  const toPx = (x: number, y: number): [number, number] => [(x + padding) * scale, (y + padding) * scale];

  for (const d of paths) {
    const pts = sampleSvgPath(d, 24);
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

function flood(
  pix: Uint8Array,
  labels: Uint32Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
  id: number,
): { area: number; sx: number; sy: number; touchesEdge: boolean } {
  const stack = [sy * w + sx];
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  let touchesEdge = false;
  labels[sy * w + sx] = id;
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
      if (pix[n] !== 0 || labels[n] !== 0) continue;
      const nx = n % w;
      const ny = (n / w) | 0;
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      labels[n] = id;
      stack.push(n);
    }
  }
  return { area, sx: sumX / area, sy: sumY / area, touchesEdge };
}

type RawRegion = { id: number; area: number; cx: number; cy: number };

function extractRegions(
  pix: Uint8Array,
  labels: Uint32Array,
  w: number,
  h: number,
  scale: number,
  padding: number,
): RawRegion[] {
  let nextId = 1;
  const raw: RawRegion[] = [];
  const minArea = Math.max(8, 0.1 * scale * 0.1 * scale);
  for (let i = 0; i < pix.length; i++) {
    if (pix[i] !== 0 || labels[i] !== 0) continue;
    const x = i % w;
    const y = (i / w) | 0;
    nextId += 1;
    const info = flood(pix, labels, w, h, x, y, nextId);
    if (!info.touchesEdge && info.area >= minArea) {
      raw.push({
        id: nextId,
        area: info.area / (scale * scale),
        cx: info.sx / scale - padding,
        cy: info.sy / scale - padding,
      });
    }
  }
  return raw;
}

function chaikin(pts: Array<[number, number]>, rounds = 2): Array<[number, number]> {
  let cur = pts;
  for (let r = 0; r < rounds; r++) {
    const next: Array<[number, number]> = [];
    const n = cur.length;
    if (n < 4) return cur;
    for (let i = 0; i < n; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % n];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    cur = next;
  }
  return cur;
}

/** Moore-neighbor contour, lightly smoothed, in grid units. */
function regionPath(
  labels: Uint32Array,
  w: number,
  h: number,
  id: number,
  scale: number,
  padding: number,
  cx: number,
  cy: number,
): string | null {
  let start = -1;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === id) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const sx = start % w;
  const sy = (start / w) | 0;

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
    let found = -1;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = x + DX[nd];
      const ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (labels[ny * w + nx] === id) {
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

  const step = Math.max(1, Math.floor(pts.length / 360));
  const simp: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += step) simp.push(pts[i]);
  if (simp.length >= 3 && (simp[0][0] !== simp[simp.length - 1][0] || simp[0][1] !== simp[simp.length - 1][1])) {
    simp.push(simp[0]);
  }
  const smooth = chaikin(simp, 2);

  const inset = 0.012 * scale;
  const insetPts = smooth.map(([px, py]) => {
    const gx = px / scale - padding;
    const gy = py / scale - padding;
    const dx = cx - gx;
    const dy = cy - gy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return [gx, gy] as [number, number];
    const m = Math.min(inset / scale, len * 0.15);
    return [gx + (dx / len) * m, gy + (dy / len) * m] as [number, number];
  });

  const f = (n: number) => (Math.round(n * 100) / 100).toString();
  const parts = [`M${f(insetPts[0][0])} ${f(insetPts[0][1])}`];
  for (let i = 1; i < insetPts.length; i++) parts.push(`L${f(insetPts[i][0])} ${f(insetPts[i][1])}`);
  parts.push("Z");
  return parts.join(" ");
}

function q(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Canonical D4 orbit key for a point (lexicographically smallest image). */
export function orbitKey(x: number, y: number, c: number): string {
  const keys: string[] = [];
  for (let t = 0; t < 8; t++) {
    const [px, py] = d4Point(x, y, t, c);
    keys.push(`${q(px)},${q(py)}`);
  }
  keys.sort();
  return keys[0];
}

function mapPath(d: string, t: number, c: number): string {
  const re = /([MLCZ])([^MLCZ]*)/gi;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    if (cmd === "Z") {
      out += "Z";
      continue;
    }
    const nums = m[2]
      .trim()
      .split(/[ ,]+/)
      .filter((s) => s.length)
      .map(Number);
    const mapped: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const [x, y] = d4Point(nums[i], nums[i + 1], t, c);
      mapped.push(String(Math.round(x * 100) / 100), String(Math.round(y * 100) / 100));
    }
    out += cmd + mapped.join(" ");
  }
  return out;
}

function ringOf(x: number, y: number, c: number): number {
  return Math.round(Math.hypot(x - c, y - c) * 2) / 2;
}

/**
 * Extract filled faces between the sikku curves and assign rangoli colors
 * by D4 orbit so every rotate/reflect of a cell shares one color. Paths are
 * taken from one representative and copied around the orbit so the fills
 * stay registered under the outline.
 */
export function colorRegions(pattern: KolamPattern, palette: readonly string[]): FillRegion[] {
  if (pattern.paths.length === 0 || palette.length === 0) return [];
  const sp = dotSpacing(pattern.spec);
  const padding = 1.15 * sp;
  const strokeW = 0.2 * sp;
  const { pix, w, h, scale } = rasterizeStrokes(pattern.paths, padding, pattern.grid.W, SCALE, strokeW);
  const labels = new Uint32Array(pix.length);
  const raw = extractRegions(pix, labels, w, h, scale, padding);
  if (raw.length === 0) return [];

  const c = pattern.grid.c;
  type Member = RawRegion & { d: string };
  const groups = new Map<string, Member[]>();
  for (const r of raw) {
    const d = regionPath(labels, w, h, r.id, scale, padding, r.cx, r.cy);
    if (!d) continue;
    const key = orbitKey(r.cx, r.cy, c);
    const arr = groups.get(key) ?? [];
    arr.push({ ...r, d });
    groups.set(key, arr);
  }

  const orbits = [...groups.entries()].map(([key, members]) => {
    members.sort((a, b) => a.area - b.area || a.cx - b.cx);
    const mid = members[Math.floor(members.length / 2)];
    const [kx, ky] = key.split(",").map(Number);
    const ringVal = Number.isFinite(kx) ? ringOf(kx, ky, c) : ringOf(mid.cx, mid.cy, c);
    return { key, members, mid, ring: ringVal };
  });
  orbits.sort((a, b) => a.ring - b.ring || a.key.localeCompare(b.key));

  const rings = [...new Set(orbits.map((o) => o.ring))].sort((a, b) => a - b);
  const maxRing = rings.length ? rings[rings.length - 1] : 0;
  const minRing = rings.length ? rings[0] : 0;
  const areas = orbits.map((o) => o.mid.area).sort((a, b) => a - b);
  const medianArea = areas.length ? areas[Math.floor(areas.length / 2)] : 0;

  type Kind = "center" | "petal" | "accent" | "skip";
  function classify(orbit: (typeof orbits)[number]): Kind {
    const small = orbit.mid.area <= medianArea * 0.95;
    const verySmall = orbit.mid.area <= medianArea * 0.55;
    const isCenter = orbit.ring <= minRing + Math.max(0.75, maxRing * 0.16);
    const isOuter = orbit.ring >= maxRing * 0.62;
    const midBand = orbit.ring > minRing + 0.5 && orbit.ring < maxRing * 0.48;
    if (isCenter && !isOuter) return "center";
    if (isOuter && (small || verySmall)) return "petal";
    if (midBand && verySmall) return "accent";
    return "skip";
  }

  const colorFor: Record<Exclude<Kind, "skip">, string> = {
    center: palette[0] ?? "#c0392b",
    petal: palette[1] ?? palette[0] ?? "#e1b12c",
    accent: palette[2] ?? palette[0] ?? "#2d6a4f",
  };

  const out: FillRegion[] = [];
  const seen = new Set<string>();
  for (const orbit of orbits) {
    const kind = classify(orbit);
    if (kind === "skip") continue;
    const fill = colorFor[kind];
    const src = orbit.mid;
    for (let t = 0; t < 8; t++) {
      const [cx, cy] = d4Point(src.cx, src.cy, t, c);
      const k = orbitKey(cx, cy, c);
      if (k !== orbit.key) continue;
      const cell = `${q(cx)},${q(cy)}`;
      if (seen.has(cell)) continue;
      seen.add(cell);
      const d = t === 0 ? src.d : mapPath(src.d, t, c);
      out.push({ d, fill, ring: orbit.ring, cx, cy, area: src.area });
    }
  }
  return out;
}
