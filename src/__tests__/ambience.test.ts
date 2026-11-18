import { describe, expect, it } from "vitest";
import { ambienceFromHour, parseAmbienceParam } from "../ambience";

describe("time-of-day ambience", () => {
  it("maps local hours to dawn, day, dusk, and night", () => {
    expect(ambienceFromHour(5)).toBe("dawn");
    expect(ambienceFromHour(8)).toBe("dawn");
    expect(ambienceFromHour(10)).toBe("day");
    expect(ambienceFromHour(16)).toBe("day");
    expect(ambienceFromHour(17)).toBe("dusk");
    expect(ambienceFromHour(20)).toBe("dusk");
    expect(ambienceFromHour(22)).toBe("night");
    expect(ambienceFromHour(2)).toBe("night");
  });

  it("reads ?ambience=dawn|dusk for screenshots", () => {
    expect(parseAmbienceParam("?ambience=dawn")).toBe("dawn");
    expect(parseAmbienceParam("ambience=dusk")).toBe("dusk");
    expect(parseAmbienceParam("?ambience=nope")).toBeNull();
  });
});
