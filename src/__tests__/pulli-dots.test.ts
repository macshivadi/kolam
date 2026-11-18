import { describe, expect, it } from "vitest";
import { kolamOfTheDay } from "../generator";
import { LAUNCH_DATE } from "../dateSeed";
import { kolamSvg, PULLI_FILL, pulliRadiusFor, strokeWidthFor } from "../render";
import { THEMES } from "../themes";
import { GRIDS } from "../grid";
import { generateKolam } from "../generator";

function render(themeId: keyof typeof THEMES, extra: { style?: "color" | "line" } = {}): string {
  const pattern = kolamOfTheDay(LAUNCH_DATE);
  return kolamSvg(pattern, { theme: THEMES[themeId], static: true, style: extra.style });
}

describe("pulli dots", () => {
  it("are plain white filled circles with no gold rings in every theme", () => {
    for (const id of ["classic", "pongal", "diwali", "christmas"] as const) {
      const svg = render(id);
      expect(svg, id).not.toMatch(/kolam-dot-ring/);
      expect(svg, id).not.toMatch(/#e8c547/);
      const all = [...svg.matchAll(/<circle[^>]*fill="([^"]+)"/g)].map((m) => m[1]);
      expect(all.length, id).toBeGreaterThan(0);
      expect(all.every((f) => f.toLowerCase() === "#ffffff" || f === PULLI_FILL), id).toBe(true);
      expect(svg, id).not.toMatch(/<circle[^>]*fill="#e1b12c"/i);
      expect(svg, id).not.toMatch(/<circle[^>]*fill="#ffd978"/i);
      expect(svg, id).not.toMatch(/<circle[^>]*fill="#d4a017"/i);
    }
  });

  it("keeps a clear gap between each pulli and the stroke on small and large grids", () => {
    for (const spec of [GRIDS.d5, GRIDS.d7, GRIDS["5x5"], GRIDS["7x7"], GRIDS.d158]) {
      const stroke = strokeWidthFor(spec);
      const r = pulliRadiusFor(spec);
      const hole = 0.5 * (stroke / 0.09) - 0.5 * stroke; // 0.5 * spacing - half stroke
      const gap = hole - r;
      expect(r, spec.id).toBeGreaterThan(0);
      expect(gap, spec.id).toBeGreaterThanOrEqual(stroke);
      const pattern = generateKolam(spec, 11);
      const svg = kolamSvg(pattern, { theme: THEMES.classic, static: true });
      expect(svg).toMatch(`fill="${PULLI_FILL}"`);
      expect(svg).not.toContain("kolam-dot-ring");
    }
  });
});
