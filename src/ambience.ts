/** Time-of-day ambience for the floor and sky. Visitor-local clock. */

export type AmbienceId = "dawn" | "day" | "dusk" | "night";

const IDS: AmbienceId[] = ["dawn", "day", "dusk", "night"];

export function ambienceFromHour(hour: number): AmbienceId {
  if (hour >= 4 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export function parseAmbienceParam(search: string): AmbienceId | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("ambience");
  if (raw && (IDS as string[]).includes(raw)) return raw as AmbienceId;
  return null;
}

export function currentAmbience(now: Date = new Date(), search?: string): AmbienceId {
  const fromQuery = parseAmbienceParam(search ?? (typeof window === "undefined" ? "" : window.location.search));
  if (fromQuery) return fromQuery;
  return ambienceFromHour(now.getHours());
}

export function applyAmbience(id: AmbienceId, root: HTMLElement = document.documentElement): void {
  root.dataset.ambience = id;
}

export function lampVisible(id: AmbienceId): boolean {
  return id === "dusk" || id === "night";
}
