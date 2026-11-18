import type { ThemeId } from "./themes";
import type { FestivalId } from "./festivals";

/** Restrained 2–3 powder colors. Unused faces stay stone. */
export const RANGOLI_CLASSIC = [
  "#c0392b", // vermilion / kumkum
  "#e1b12c", // turmeric
  "#2d6a4f", // leaf green
] as const;

export const RANGOLI_DIWALI = ["#8b0000", "#d4a017", "#c0392b"];
export const RANGOLI_PONGAL = ["#1e5631", "#e1b12c", "#c0392b"];
export const RANGOLI_CHRISTMAS = ["#9b1b30", "#1e5631", "#d4a017"];
export const RANGOLI_ONAM = ["#e67e22", "#e1b12c", "#c0392b"];
export const RANGOLI_NAVARATRI = ["#c2185b", "#d4a017", "#7b1113"];

export function rangoliPalette(themeId: ThemeId, festivalId?: FestivalId): readonly string[] {
  if (festivalId === "onam") return RANGOLI_ONAM;
  if (festivalId === "harvest" || themeId === "pongal") return RANGOLI_PONGAL;
  if (festivalId === "diwali" || festivalId === "karthigai" || themeId === "diwali") return RANGOLI_DIWALI;
  if (festivalId === "navaratri") return RANGOLI_NAVARATRI;
  if (festivalId === "christmas" || themeId === "christmas") return RANGOLI_CHRISTMAS;
  return RANGOLI_CLASSIC;
}

/**
 * Default White / Color mode: white on stone, like a doorstep kolam.
 * Color is reserved for festival days and the menu opt-in.
 */
export function defaultColorMode(_seedOrNumber: number, isFestival = false): boolean {
  return isFestival;
}
