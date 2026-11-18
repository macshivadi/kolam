import type { ThemeId } from "./themes";
import type { FestivalId } from "./festivals";

/** Powdered rangoli colors used to fill faces in Color mode. */
export const RANGOLI_CLASSIC = [
  "#c0392b", // vermilion / kumkum red
  "#e1b12c", // turmeric yellow
  "#2d6a4f", // leaf green
  "#1d4e89", // peacock blue
  "#c2185b", // magenta
  "#e67e22", // marigold orange
] as const;

export const RANGOLI_DIWALI = ["#8b0000", "#c0392b", "#d4a017", "#f4d03f", "#7b1113", "#e8c547"];
export const RANGOLI_PONGAL = ["#1e5631", "#2d6a4f", "#e1b12c", "#f4e3a1", "#6b8e23", "#c9a227"];
export const RANGOLI_CHRISTMAS = ["#9b1b30", "#1e5631", "#d4a017", "#c43c3c", "#0f3d2e", "#f3efe6"];
export const RANGOLI_ONAM = ["#e67e22", "#f4a261", "#e1b12c", "#f7dc6f", "#d35400", "#fff3bf"];

export function rangoliPalette(themeId: ThemeId, festivalId?: FestivalId): readonly string[] {
  if (festivalId === "onam") return RANGOLI_ONAM;
  if (festivalId === "harvest" || themeId === "pongal") return RANGOLI_PONGAL;
  if (festivalId === "diwali" || festivalId === "karthigai" || themeId === "diwali") return RANGOLI_DIWALI;
  if (festivalId === "navaratri") return ["#c2185b", "#d4a017", "#7b1113", "#f4d03f", "#1d4e89", "#c0392b"];
  if (festivalId === "christmas" || themeId === "christmas") return RANGOLI_CHRISTMAS;
  return RANGOLI_CLASSIC;
}

/** Seeded default for the White / Color toggle (alternates by even/odd). */
export function defaultColorMode(seedOrNumber: number): boolean {
  return (seedOrNumber >>> 0) % 2 === 0;
}
