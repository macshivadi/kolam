import { describe, expect, it } from "vitest";
import {
  LAUNCH_DATE,
  addDays,
  clampToPastOrToday,
  daysBetween,
  isValidDateString,
  kolamNumber,
  localDateString,
  seedFromDate,
} from "../dateSeed";

describe("local dates", () => {
  it("formats a local YYYY-MM-DD string", () => {
    expect(localDateString(new Date(2026, 10, 17))).toBe("2026-11-17");
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("validates calendar dates", () => {
    expect(isValidDateString("2026-11-17")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("17-11-2026")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-11-17", 1)).toBe("2026-11-18");
    expect(addDays("2026-11-17", -1)).toBe("2026-11-16");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts whole calendar days independently of DST", () => {
    expect(daysBetween("2026-11-18", "2026-11-17")).toBe(1);
    expect(daysBetween("2026-11-17", "2026-11-17")).toBe(0);
  });
});

describe("seedFromDate and kolam number", () => {
  it("is deterministic for a given date string", () => {
    expect(seedFromDate("2026-11-17")).toBe(seedFromDate("2026-11-17"));
    expect(seedFromDate("2026-11-17")).not.toBe(seedFromDate("2026-11-18"));
  });

  it("numbers launch day as #1", () => {
    expect(LAUNCH_DATE).toBe("2026-11-17");
    expect(kolamNumber(LAUNCH_DATE)).toBe(1);
    expect(kolamNumber(addDays(LAUNCH_DATE, 1))).toBe(2);
    expect(kolamNumber(addDays(LAUNCH_DATE, 3649))).toBe(3650);
  });

  it("clamps future and invalid dates to today", () => {
    expect(clampToPastOrToday("2099-01-01", "2026-11-17")).toBe("2026-11-17");
    expect(clampToPastOrToday("2026-11-10", "2026-11-17")).toBe("2026-11-10");
    expect(clampToPastOrToday("nope", "2026-11-17")).toBe("2026-11-17");
  });
});
