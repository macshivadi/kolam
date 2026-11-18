import type { KolamPattern } from "./generator";
import { dotSpacing } from "./grid";
import type { Theme } from "./themes";
import type { FillRegion } from "./regions";
import type { KolamStyleId } from "./styles";
import { motifSvg } from "./motifs";

/** Fallback used by tests; prefer strokeWidthFor(spec). */
export const STROKE_RATIO = 0.09;
export const STROKE_WIDTH = 0.09;

export function strokeWidthFor(spec: Parameters<typeof dotSpacing>[0]): number {
  return STROKE_RATIO * dotSpacing(spec);
}

export function defaultPaddingFor(pattern: KolamPattern, hasMotifs: boolean): number {
  const sp = dotSpacing(pattern.spec);
  return hasMotifs ? sp * 1.7 + 1.2 : sp * 1.15;
}


export type SvgOptions = {
  theme: Theme;
  /** When true, skip animation attributes (for PNG export and print). */
  static?: boolean;
  padding?: number;
  /** Longer flour-from-the-fingers stroke, used by Draw along. */
  slow?: boolean;
  /** Rangoli face fills, drawn under the white outline. */
  fills?: FillRegion[];
  /** Festival / decorative motifs drawn with the kolam. */
  style?: KolamStyleId;
  /** Gold ring around each pulli — dusk / night stone-floor look. */
  goldRings?: boolean;
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

export function strokeEndTime(pattern: KolamPattern, opts: SvgOptions): number {
  if (opts.static) return 0;
  const rowDelay = opts.slow ? 0.11 : 0.07;
  return 0.45 + pattern.grid.max * rowDelay + drawDuration(opts);
}

export function drawDuration(opts: SvgOptions): number {
  if (opts.static) return 0;
  return opts.slow ? 9.5 : 5.6;
}

function filterDefs(id: string): string {
  // Floor grain only. Stroke flour displacement was removed — it clumped
  // the line into blobs at turns and crossings.
  return `  <defs>
    <filter id="floor-${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.06  0 0 0 0.16 0" result="grain"/>
      <feBlend in="SourceGraphic" in2="grain" mode="overlay"/>
    </filter>
  </defs>`;
}


function fillGroup(fills: FillRegion[] | undefined): string {
  if (!fills || fills.length === 0) return "";
  return fills
    .map(
      (f) =>
        `    <path class="rangoli-fill" d="${f.d}" fill="${f.fill}" fill-rule="evenodd" stroke="none"/>`,
    )
    .join("\n");
}

export function kolamSvg(pattern: KolamPattern, opts: SvgOptions): string {
  const motifs = opts.style ? motifSvg(opts.style, pattern.grid.W, pattern.paths, opts.padding ?? defaultPaddingFor(pattern, true)) : "";
  const padding = opts.padding ?? defaultPaddingFor(pattern, Boolean(motifs));
  const theme = opts.theme;
  const vb = viewBoxFor(pattern, padding);
  const fid = opts.static ? "s" : opts.slow ? "q" : "k";
  const animClass = opts.static ? ' class="kolam-path is-static"' : ' class="kolam-path"';
  const rowDelay = opts.slow ? 0.11 : 0.07;
  const drawSecs = drawDuration(opts);
  const strokeDelay = 0.45 + pattern.grid.max * rowDelay;
  const paths = pattern.paths
    .map((d) => {
      const delay = opts.static
        ? ""
        : ` style="animation-delay:${strokeDelay.toFixed(2)}s;animation-duration:${drawSecs.toFixed(2)}s"`;
      return `    <path${animClass} d="${d}" fill="none" stroke="${theme.line}" stroke-width="${strokeWidthFor(pattern.spec)}" stroke-linecap="butt" stroke-linejoin="round" pathLength="1"${delay}/>`;
    })
    .join("\n");
  const dots = pattern.grid.dots
    .map((p) => {
      const delay = opts.static
        ? opts.goldRings
          ? ` class="kolam-dot"`
          : ""
        : ` class="kolam-dot" style="animation-delay:${((p.y - 1) * rowDelay).toFixed(2)}s"`;
      const sp = dotSpacing(pattern.spec);
      const dotR = 0.06 * sp;
      if (opts.goldRings) {
        return `    <g${delay}><circle class="kolam-dot-ring" cx="${p.x}" cy="${p.y}" r="${(0.09 * sp).toFixed(3)}" fill="none" stroke="#e8c547" stroke-width="${(0.025 * sp).toFixed(3)}"/><circle cx="${p.x}" cy="${p.y}" r="${dotR.toFixed(3)}" fill="${theme.dot}"/></g>`;
      }
      return `    <circle${delay} cx="${p.x}" cy="${p.y}" r="${dotR.toFixed(3)}" fill="${theme.dot}"/>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Kolam pattern" class="kolam-svg">
${filterDefs(fid)}
  <rect x="${-padding}" y="${-padding}" width="${pattern.grid.W + padding * 2}" height="${pattern.grid.W + padding * 2}" fill="${theme.floor}" filter="url(#floor-${fid})"/>
  <g class="kolam-fills${opts.fills?.length && !opts.static ? "" : opts.fills?.length ? " is-colored" : ""}">
${fillGroup(opts.fills)}
  </g>
  <g class="kolam-motifs" aria-hidden="true">${motifs}</g>
  <g class="kolam-lines">
${paths}
  </g>
  <g class="kolam-dots">
${dots}
  </g>
</svg>`;
}

/** 1200×630 Open Graph image as SVG, with the kolam centered on the floor. */
export function ogShareSvg(
  pattern: KolamPattern,
  theme: Theme,
  caption?: string,
  style?: KolamStyleId,
  fills?: FillRegion[],
): string {
  const padding = defaultPaddingFor(pattern, Boolean(style));
  const vb = viewBoxFor(pattern, padding);
  const inner = kolamSvg(pattern, { theme, static: true, padding, style, fills });
  const size = 560;
  const x = (1200 - size) / 2;
  const y = caption ? 36 : (630 - size) / 2;
  const title = caption
    ? `<text x="600" y="612" text-anchor="middle" fill="${theme.ink}" font-family="Georgia, 'Noto Serif', serif" font-size="28">${escapeXml(caption)}</text>`
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
