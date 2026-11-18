import { sampleSvgPath, type Pt } from "./pathGeom";

/** Forgiving hit radius, in grid units (dot spacing is 1). */
export const TRACE_TOLERANCE = 0.35;

export type SampledPath = {
  pts: Pt[];
  cum: number[];
  length: number;
};

export function buildSampledPath(d: string, stepsPerCmd = 16): SampledPath {
  const pts = sampleSvgPath(d, stepsPerCmd);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, length: cum[cum.length - 1] ?? 0 };
}

function clamp(s: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, s));
}

/** Point at arc length `s` along a sampled path. */
export function pointAtLength(path: SampledPath, s: number): Pt {
  if (path.pts.length === 0) return { x: 0, y: 0 };
  const t = clamp(s, 0, path.length);
  if (t <= 0) return path.pts[0];
  if (t >= path.length) return path.pts[path.pts.length - 1];
  let lo = 0;
  let hi = path.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = path.pts[i - 1];
  const b = path.pts[i];
  const seg = path.cum[i] - path.cum[i - 1] || 1;
  const u = (t - path.cum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function closestOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, dist: Math.hypot(p.x - point.x, p.y - point.y) };
}

export type ClosestHit = { s: number; distance: number; point: Pt };

export function closestOnPath(path: SampledPath, p: Pt): ClosestHit {
  let best: ClosestHit = { s: 0, distance: Infinity, point: path.pts[0] ?? { x: 0, y: 0 } };
  for (let i = 1; i < path.pts.length; i++) {
    const hit = closestOnSegment(p, path.pts[i - 1], path.pts[i]);
    if (hit.dist < best.distance) {
      const seg = path.cum[i] - path.cum[i - 1];
      best = { s: path.cum[i - 1] + hit.t * seg, distance: hit.dist, point: hit.point };
    }
  }
  return best;
}

export type TraceState = {
  paths: SampledPath[];
  loopIndex: number;
  /** Arc length reached along the current loop. */
  progress: number;
  completedLoops: number;
};

export function createTraceState(pathData: string[]): TraceState {
  return {
    paths: pathData.map((d) => buildSampledPath(d)),
    loopIndex: 0,
    progress: 0,
    completedLoops: 0,
  };
}

export function totalTraceLength(state: TraceState): number {
  return state.paths.reduce((n, p) => n + p.length, 0);
}

export function tracedLength(state: TraceState): number {
  let n = 0;
  for (let i = 0; i < state.loopIndex && i < state.paths.length; i++) n += state.paths[i].length;
  if (state.loopIndex < state.paths.length) n += state.progress;
  return n;
}

export function traceProgress01(state: TraceState): number {
  const total = totalTraceLength(state);
  if (total <= 0) return 1;
  return tracedLength(state) / total;
}

export function isTraceComplete(state: TraceState): boolean {
  return state.loopIndex >= state.paths.length;
}

/**
 * Advance tracing if the pointer is within `tolerance` of the path and not
 * jumping too far ahead of the current head.
 */
export function advanceTrace(
  state: TraceState,
  pointer: Pt,
  tolerance = TRACE_TOLERANCE,
  maxLookAhead = 1.25,
): TraceState {
  if (isTraceComplete(state)) return state;
  const path = state.paths[state.loopIndex];
  if (!path || path.length === 0) {
    return { ...state, loopIndex: state.loopIndex + 1, progress: 0, completedLoops: state.completedLoops + 1 };
  }
  const hit = closestOnPath(path, pointer);
  if (hit.distance > tolerance) return state;
  let s = hit.s;
  // Closed paths share a start/end point; once we're past halfway,
  // a hit near s=0 is the finish, not a rewind.
  if (state.progress > path.length * 0.6 && s < 0.4) s = path.length;
  if (s < state.progress - 0.25) return state;
  if (s > state.progress + maxLookAhead) return state;
  let progress = Math.max(state.progress, s);
  let loopIndex = state.loopIndex;
  let completedLoops = state.completedLoops;
  const closeEnough = Math.min(0.12, Math.max(0.05, path.length * 0.02));
  if (progress >= path.length - closeEnough) {
    loopIndex += 1;
    progress = 0;
    completedLoops += 1;
  }
  return { ...state, progress, loopIndex, completedLoops };
}
