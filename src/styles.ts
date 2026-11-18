import type { FestivalId } from "./festivals";
import type { GridId } from "./grid";

/** Drawing styles the visitor can preview in Create your own. */
export type KolamStyleId =
  | "auto"
  | "line"
  | "color"
  | "diwali"
  | "harvest"
  | "christmas"
  | "onam"
  | "navaratri"
  | "karthigai";

export const STYLE_IDS: KolamStyleId[] = [
  "auto",
  "line",
  "color",
  "diwali",
  "harvest",
  "christmas",
  "onam",
  "navaratri",
  "karthigai",
];

export const STYLE_LABELS: Record<KolamStyleId, string> = {
  auto: "Auto",
  line: "Line",
  color: "Color",
  diwali: "Diwali",
  harvest: "Pongal · Sankranti",
  christmas: "Christmas",
  onam: "Onam",
  navaratri: "Navaratri",
  karthigai: "Karthigai",
};

export function isStyleId(v: string | undefined): v is KolamStyleId {
  return !!v && (STYLE_IDS as string[]).includes(v);
}

export function styleForFestival(id: FestivalId): KolamStyleId | "line" {
  if (id === "diwali") return "diwali";
  if (id === "karthigai") return "karthigai";
  if (id === "harvest") return "harvest";
  if (id === "christmas") return "christmas";
  if (id === "onam") return "onam";
  if (id === "navaratri") return "navaratri";
  return "line";
}

export function styleUsesColor(style: KolamStyleId, autoColor: boolean): boolean {
  if (style === "line") return false;
  if (style === "auto") return autoColor;
  if (style === "color") return true;
  return true; // festival styles always include rangoli fills
}

export function styleFestivalId(style: KolamStyleId): FestivalId | undefined {
  if (style === "diwali") return "diwali";
  if (style === "karthigai") return "karthigai";
  if (style === "harvest") return "harvest";
  if (style === "christmas") return "christmas";
  if (style === "onam") return "onam";
  if (style === "navaratri") return "navaratri";
  return undefined;
}

/** Chip taps only update the pending selection — they must not redraw. */
export function selectPendingGrid<T extends { pendingGridId: GridId }>(state: T, gridId: GridId): T {
  return { ...state, pendingGridId: gridId };
}

export function selectPendingStyle<T extends { pendingStyleId: KolamStyleId }>(
  state: T,
  styleId: KolamStyleId,
): T {
  return { ...state, pendingStyleId: styleId };
}
