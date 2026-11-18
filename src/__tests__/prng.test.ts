import { describe, expect, it } from "vitest";
import { hashString, mulberry32, randInt } from "../prng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("diverges for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("hashString", () => {
  it("is stable and unsigned", () => {
    expect(hashString("kolam:2026-11-17")).toBe(hashString("kolam:2026-11-17"));
    expect(hashString("kolam:2026-11-17")).toBeGreaterThanOrEqual(0);
    expect(hashString("kolam:2026-11-17")).toBeLessThanOrEqual(0xffffffff);
  });

  it("changes when the input changes", () => {
    expect(hashString("kolam:2026-11-17")).not.toBe(hashString("kolam:2026-11-18"));
  });
});

describe("randInt", () => {
  it("stays inclusive of the bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const n = randInt(rng, 2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});
