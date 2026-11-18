import { describe, expect, it } from "vitest";
import {
  TRACE_TOLERANCE,
  advanceTrace,
  buildSampledPath,
  closestOnPath,
  createTraceState,
  isTraceComplete,
  pointAtLength,
  traceProgress01,
} from "../trace";

describe("Draw along trace logic", () => {
  const square = "M0 0 L2 0 L2 2 L0 2 Z";

  it("parameterizes a closed path and finds the closest point", () => {
    const path = buildSampledPath(square, 8);
    expect(path.length).toBeCloseTo(8, 5);
    const start = pointAtLength(path, 0);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeCloseTo(0, 5);
    const mid = pointAtLength(path, 1);
    expect(mid.x).toBeCloseTo(1, 5);
    expect(mid.y).toBeCloseTo(0, 5);
    const hit = closestOnPath(path, { x: 1, y: 0.2 });
    expect(hit.distance).toBeLessThan(0.21);
    expect(hit.s).toBeCloseTo(1, 1);
  });

  it("advances only within tolerance and not far ahead of the head", () => {
    let s = createTraceState([square]);
    const start = advanceTrace(s, { x: 0, y: 0 });
    expect(start.progress).toBeCloseTo(0, 5);
    const along = advanceTrace(start, { x: 0.4, y: 0 });
    expect(along.progress).toBeGreaterThan(0.3);
    const ignored = advanceTrace(along, { x: 0.4, y: 2 }); // off the path
    expect(ignored.progress).toBe(along.progress);
    const skipped = advanceTrace(along, { x: 2, y: 2 }); // too far ahead
    expect(skipped.progress).toBe(along.progress);
    expect(TRACE_TOLERANCE).toBe(0.35);
  });

  it("reaches 100% when the pointer follows the path", () => {
    let s = createTraceState([square]);
    const path = s.paths[0];
    for (let t = 0; t <= path.length + 0.2; t += 0.2) {
      const p = pointAtLength(path, Math.min(t, path.length));
      s = advanceTrace(s, p);
    }
    expect(isTraceComplete(s)).toBe(true);
    expect(traceProgress01(s)).toBe(1);
  });
});
