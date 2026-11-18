import type { KolamPattern } from "./generator";
import type { Theme } from "./themes";

export type SvgOptions = {
  theme: Theme;
  /** When true, skip animation attributes (for PNG export and print). */
  static?: boolean;
  padding?: number;
};

function bounds(pattern: KolamPattern, padding: number) {
  const { W } = pattern.grid;
  return {
    minX: -padding,
    minY: -padding,
    width: W + padding * 2,
    height: W + padding * 2,
  };
}

/** Tight viewBox in grid units, with a little margin around the frame. */
export function viewBoxFor(pattern: KolamPattern, padding = 1.15): string {
  const b = bounds(pattern, padding);
  return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
}

export function kolamSvg(pattern: KolamPattern, opts: SvgOptions): string {
  const padding = opts.padding ?? 1.15;
  const theme = opts.theme;
  const vb = viewBoxFor(pattern, padding);
  const animClass = opts.static ? "" : ' class="kolam-path"';
  // Pulli appear first, row by row; the sikku stroke starts after the last row.
  const rowDelay = 0.07;
  const strokeDelay = 0.45 + pattern.grid.max * rowDelay;
  const paths = pattern.paths
    .map((d, i) => {
      const delay = opts.static
        ? ""
        : ` style="animation-delay:${(strokeDelay + i * 0.35).toFixed(2)}s"`;
      return `    <path${animClass} d="${d}" fill="none" stroke="${theme.line}" stroke-width="0.12" stroke-linecap="round" stroke-linejoin="round" pathLength="1"${delay}/>`;
    })
    .join("\n");
  const dots = pattern.grid.dots
    .map((p) => {
      const delay = opts.static
        ? ""
        : ` class="kolam-dot" style="animation-delay:${((p.y - 1) * rowDelay).toFixed(2)}s"`;
      return `    <circle${delay} cx="${p.x}" cy="${p.y}" r="0.085" fill="${theme.dot}"/>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Kolam pattern" class="kolam-svg">
  <rect x="${-padding}" y="${-padding}" width="${pattern.grid.W + padding * 2}" height="${pattern.grid.W + padding * 2}" fill="${theme.floor}"/>
  <g class="kolam-lines">
${paths}
  </g>
  <g class="kolam-dots">
${dots}
  </g>
</svg>`;
}

/** 1200×630 Open Graph image as SVG, with the kolam centered on the floor. */
export function ogShareSvg(pattern: KolamPattern, theme: Theme, caption?: string): string {
  const padding = 1.15;
  const vb = viewBoxFor(pattern, padding);
  const inner = kolamSvg(pattern, { theme, static: true, padding });
  // Extract inner content (no outer svg wrapper) by reusing the same drawing.
  const size = 560;
  const x = (1200 - size) / 2;
  const y = caption ? 36 : (630 - size) / 2;
  const title = caption
    ? `<text x="600" y="612" text-anchor="middle" fill="${theme.ink}" font-family="Georgia, serif" font-size="28">${escapeXml(caption)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Kolam">
  <rect width="1200" height="630" fill="${theme.floor}"/>
  <rect width="1200" height="630" fill="${theme.floorGlow}" opacity="0.35"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${inner}</svg>
  ${title}
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
