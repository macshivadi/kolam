/** SVG path helpers: closed-ness and rendered-point D4 symmetry. */

export type Pt = { x: number; y: number };

function nums(s: string): number[] {
  return s
    .trim()
    .split(/[ ,]+/)
    .filter((t) => t.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** True when the path has a Z close and the last drawn point meets the start. */
export function svgPathIsClosed(d: string, tol = 1e-6): boolean {
  const t = d.trim();
  if (!t) return false;
  if (!/[Zz]\s*$/.test(t)) return false;
  const m = t.match(/^M(-?[\d.]+)[ ,](-?[\d.]+)/);
  if (!m) return false;
  const start = { x: +m[1], y: +m[2] };
  let x = start.x;
  let y = start.y;
  const re = /([LCZlcZ])([^LCZlcZ]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(t))) {
    const cmd = match[1].toUpperCase();
    const a = nums(match[2]);
    if (cmd === "L" && a.length >= 2) {
      x = a[0];
      y = a[1];
    } else if (cmd === "C" && a.length >= 6) {
      x = a[4];
      y = a[5];
    }
  }
  return Math.hypot(x - start.x, y - start.y) <= tol;
}

function cubic(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  t: number,
): Pt {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

/** Dense sample of points along an SVG path made of M/L/C/Z. */
export function sampleSvgPath(d: string, stepsPerCmd = 10): Pt[] {
  const pts: Pt[] = [];
  const m = d.trim().match(/^M(-?[\d.]+)[ ,](-?[\d.]+)/);
  if (!m) return pts;
  let cx = +m[1];
  let cy = +m[2];
  pts.push({ x: cx, y: cy });
  const re = /([LCZlcZ])([^LCZlcZ]*)/g;
  let match: RegExpExecArray | null;
  const start = { x: +m[1], y: +m[2] };
  while ((match = re.exec(d))) {
    const cmd = match[1].toUpperCase();
    const a = nums(match[2]);
    if (cmd === "Z") {
      pts.push({ x: start.x, y: start.y });
      cx = start.x;
      cy = start.y;
      continue;
    }
    if (cmd === "L" && a.length >= 2) {
      const x = a[0];
      const y = a[1];
      for (let i = 1; i <= stepsPerCmd; i++) {
        const t = i / stepsPerCmd;
        pts.push({ x: cx + (x - cx) * t, y: cy + (y - cy) * t });
      }
      cx = x;
      cy = y;
    } else if (cmd === "C" && a.length >= 6) {
      const p0 = { x: cx, y: cy };
      const p1 = { x: a[0], y: a[1] };
      const p2 = { x: a[2], y: a[3] };
      const p3 = { x: a[4], y: a[5] };
      for (let i = 1; i <= stepsPerCmd; i++) pts.push(cubic(p0, p1, p2, p3, i / stepsPerCmd));
      cx = p3.x;
      cy = p3.y;
    }
  }
  return pts;
}

/** 8 D4 images of a point around center `c` (y-down, 90° clockwise + reflection). */
export function d4Images(x: number, y: number, c: number): Pt[] {
  const dx = x - c;
  const dy = y - c;
  const rots: Pt[] = [
    { x: c + dx, y: c + dy },
    { x: c - dy, y: c + dx },
    { x: c - dx, y: c - dy },
    { x: c + dy, y: c - dx },
  ];
  const out: Pt[] = [];
  for (const p of rots) {
    out.push(p);
    out.push({ x: 2 * c - p.x, y: p.y });
  }
  return out;
}

function nearestDist(pts: Pt[], x: number, y: number): number {
  let best = Infinity;
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * True when the drawn path-point set is unchanged (within `tol`) under all
 * 8 D4 transforms around the grid center.
 */
export function renderedPathsAreD4(paths: string[], c: number, tol = 0.08): boolean {
  const pts: Pt[] = [];
  for (const d of paths) pts.push(...sampleSvgPath(d, 12));
  if (pts.length === 0) return false;
  const step = Math.max(1, Math.floor(pts.length / 500));
  for (let i = 0; i < pts.length; i += step) {
    const p = pts[i];
    for (const q of d4Images(p.x, p.y, c)) {
      if (nearestDist(pts, q.x, q.y) > tol) return false;
    }
  }
  return true;
}

export function allSvgPathsClosed(paths: string[]): boolean {
  return paths.length > 0 && paths.every((d) => svgPathIsClosed(d));
}
