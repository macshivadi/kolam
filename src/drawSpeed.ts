export type WatchSpeed = "slow" | "normal" | "fast";

/** Normal Draw-along pen speed, in grid units per second. */
export const NORMAL_UNITS_PER_SEC = 10;

/** Slow is 0.4× Normal; Fast is 2× Normal. */
export function unitsPerSec(speed: WatchSpeed): number {
  if (speed === "slow") return NORMAL_UNITS_PER_SEC * 0.4;
  if (speed === "fast") return NORMAL_UNITS_PER_SEC * 2;
  return NORMAL_UNITS_PER_SEC;
}

/** Time to draw a path of the given length at a constant pen speed. */
export function pathDurationMs(length: number, speed: WatchSpeed): number {
  const units = Math.max(0, length);
  const ms = (units / unitsPerSec(speed)) * 1000;
  return Math.max(80, ms);
}

export function totalDurationMs(lengths: readonly number[], speed: WatchSpeed): number {
  return lengths.reduce((sum, len) => sum + pathDurationMs(len, speed), 0);
}
