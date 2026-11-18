import type { KolamStyleId } from "./styles";

/** Tiny recognizable festival symbols, drawn in grid units around a W×W kolam. */

function g(inner: string, x: number, y: number, s: number, rot = 0): string {
  const r = rot ? ` rotate(${rot})` : "";
  return `<g transform="translate(${x} ${y})${r} scale(${s})">${inner}</g>`;
}

const LAMP = `<g class="motif-lamp">
  <ellipse class="lamp-glow" cx="0" cy="-0.55" rx="0.55" ry="0.7" fill="#ffd278" opacity="0.28"/>
  <ellipse cx="0" cy="-0.55" rx="0.16" ry="0.3" fill="#ffe9a0"/>
  <ellipse cx="0" cy="-0.62" rx="0.07" ry="0.14" fill="#fff6d2"/>
  <path d="M-0.38 0.02 C-0.38 -0.28 0.38 -0.28 0.38 0.02 L0.26 0.42 C0.16 0.68 -0.16 0.68 -0.26 0.42 Z" fill="#c4a060"/>
  <path d="M-0.28 0.02 C-0.2 -0.14 0.2 -0.14 0.28 0.02" fill="none" stroke="#e8c547" stroke-width="0.05"/>
  <rect x="-0.16" y="0.64" width="0.32" height="0.1" rx="0.04" fill="#a9843a"/>
</g>`;

/** Corner horn / suli, drawn in grid units, pointing outward from a corner. */
const HORN = `<g class="motif-horn" fill="none" stroke="#f3e6c0" stroke-width="0.08" stroke-linecap="round" stroke-linejoin="round">
  <path d="M0 0 C0.15 -0.35 0.55 -0.55 0.85 -0.35 C1.05 -0.2 0.95 0.1 0.7 0.12 C0.5 0.14 0.42 -0.05 0.55 -0.12"/>
</g>`;

const STAR = `<path class="motif-star" fill="#f4d03f" d="M0,-0.55 L0.14,-0.14 L0.55,-0.1 L0.22,0.16 L0.34,0.55 L0,0.32 L-0.34,0.55 L-0.22,0.16 L-0.55,-0.1 L-0.14,-0.14 Z"/>`;

const SUN = `<g class="motif-sun">
  <circle cx="0" cy="0" r="0.22" fill="#f4d03f"/>
  <g fill="#e1b12c">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="-0.04" y="-0.5" width="0.08" height="0.16" rx="0.03" transform="rotate(${a})"/>`).join("")}</g>
</g>`;

const CANE = `<g class="motif-cane">
  <rect x="-0.07" y="-0.7" width="0.14" height="1.4" rx="0.07" fill="#7d9a3a"/>
  <rect x="-0.07" y="-0.35" width="0.14" height="0.06" fill="#c9e07b"/>
  <rect x="-0.07" y="0.05" width="0.14" height="0.06" fill="#c9e07b"/>
  <rect x="-0.07" y="0.4" width="0.14" height="0.06" fill="#c9e07b"/>
  <path d="M0 -0.7 C0.25 -1.05 0.45 -0.85 0.2 -0.55" fill="none" stroke="#3d6b2a" stroke-width="0.07" stroke-linecap="round"/>
</g>`;

const POT = `<g class="motif-pot">
  <ellipse cx="0" cy="-0.22" rx="0.22" ry="0.08" fill="#f4e3a1"/>
  <path d="M-0.28 -0.18 C-0.32 0.05 -0.22 0.42 0 0.5 C0.22 0.42 0.32 0.05 0.28 -0.18 Z" fill="#c0392b"/>
  <ellipse cx="0" cy="-0.2" rx="0.3" ry="0.08" fill="none" stroke="#e1b12c" stroke-width="0.05"/>
  <circle cx="0" cy="0.12" r="0.07" fill="#e1b12c"/>
</g>`;

const FLOWER = `<g class="motif-flower">
  <circle cx="0" cy="-0.22" r="0.16" fill="#e67e22"/>
  <circle cx="0.2" cy="0.1" r="0.16" fill="#f4a261"/>
  <circle cx="-0.2" cy="0.1" r="0.16" fill="#f7dc6f"/>
  <circle cx="0" cy="0" r="0.09" fill="#c0392b"/>
</g>`;

const LOTUS = `<g class="motif-lotus">
  ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="0" cy="-0.28" rx="0.12" ry="0.28" fill="#c2185b" transform="rotate(${a})" opacity="0.9"/>`).join("")}
  <circle cx="0" cy="0" r="0.12" fill="#f4d03f"/>
</g>`;

const KALASH = `<g class="motif-kalash">
  <path d="M-0.2 0.15 C-0.22 -0.1 0.22 -0.1 0.2 0.15 L0.14 0.4 C0.08 0.55 -0.08 0.55 -0.14 0.4 Z" fill="#d4a017"/>
  <ellipse cx="0" cy="-0.08" rx="0.22" ry="0.08" fill="#f4d03f"/>
  <rect x="-0.05" y="-0.28" width="0.1" height="0.16" fill="#d4a017"/>
  <circle cx="0" cy="-0.34" r="0.07" fill="#c0392b"/>
  <path d="M0 -0.4 C0.2 -0.7 0.35 -0.5 0.12 -0.3" fill="none" stroke="#2d6a4f" stroke-width="0.05" stroke-linecap="round"/>
</g>`;

function tipPoints(W: number, paths: string[] | undefined, count: 4 | 8): Array<{ x: number; y: number; deg: number }> {
  const c = W / 2;
  const tips: Array<{ x: number; y: number; deg: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count - Math.PI / 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let best = 0;
    let bx = c + (c + 0.15) * ux;
    let by = c + (c + 0.15) * uy;
    if (paths) {
      for (const d of paths) {
        // cheap parse of path numbers as x,y pairs starting after M
        const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
        for (let k = 0; k + 1 < nums.length; k += 2) {
          const x = nums[k];
          const y = nums[k + 1];
          const proj = (x - c) * ux + (y - c) * uy;
          if (proj > best) {
            best = proj;
            bx = x;
            by = y;
          }
        }
      }
    }
    const reach = Math.hypot(bx - c, by - c) || c;
    const x = c + (reach + 0.72) * ux;
    const y = c + (reach + 0.72) * uy;
    tips.push({ x, y, deg: (a * 180) / Math.PI + 90 });
  }
  return tips;
}

function lampsAround(W: number, count: 4 | 8, scale: number, paths?: string[]): string {
  return tipPoints(W, paths, count)
    .map((t) => g(LAMP, t.x, t.y, scale, t.deg))
    .join("");
}

function cornerHorns(W: number): string {
  const inset = -0.15;
  const corners = [
    { x: inset, y: inset, rot: 0 },
    { x: W - inset, y: inset, rot: 90 },
    { x: W - inset, y: W - inset, rot: 180 },
    { x: inset, y: W - inset, rot: 270 },
  ];
  return corners.map((p) => g(HORN, p.x, p.y, 1, p.rot)).join("");
}

function starsAround(W: number): string {
  const c = W / 2;
  const r = c + 0.55;
  const parts = [g(STAR, c, c, 0.7)];
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
    parts.push(g(STAR, c + r * Math.cos(a), c + r * Math.sin(a), 0.38));
  }
  return parts.join("");
}

function flowerRings(W: number): string {
  const c = W / 2;
  const parts: string[] = [];
  const rings = [
    { r: c + 0.35, n: 8, s: 0.28 },
    { r: c + 0.72, n: 12, s: 0.22 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (Math.PI * 2 * i) / ring.n;
      parts.push(g(FLOWER, c + ring.r * Math.cos(a), c + ring.r * Math.sin(a), ring.s));
    }
  }
  return parts.join("");
}

/**
 * Festival motifs placed in the padding around (and sometimes at the center of)
 * the kolam, always in a 4- or 8-fold arrangement.
 */
export function motifSvg(style: KolamStyleId, W: number, paths?: string[]): string {
  const c = W / 2;
  const lampScale = 0.95;
  switch (style) {
    case "diwali":
      return `<g class="motifs motifs-diwali">${lampsAround(W, 8, lampScale, paths)}${cornerHorns(W)}</g>`;
    case "karthigai":
      return `<g class="motifs motifs-karthigai">${lampsAround(W, 8, lampScale, paths)}${g(LAMP, c, c, 0.8)}${cornerHorns(W)}</g>`;
    case "harvest":
      return `<g class="motifs motifs-harvest">${g(SUN, c, c, 0.85)}${g(POT, c, W + 0.55, 0.42)}${g(CANE, -0.15, c, 0.42, -12)}${g(CANE, W + 0.15, c, 0.42, 12)}${g(CANE, c, -0.15, 0.42, 90)}${g(POT, c, -0.55, 0.28)}${g(POT, -0.5, c, 0.28)}${g(POT, W + 0.5, c, 0.28)}</g>`;
    case "christmas":
      return `<g class="motifs motifs-christmas">${starsAround(W)}</g>`;
    case "onam":
      return `<g class="motifs motifs-onam">${flowerRings(W)}</g>`;
    case "navaratri":
      return `<g class="motifs motifs-navaratri">${g(LOTUS, c, c, 0.7)}${g(KALASH, c, -0.45, 0.4)}${g(KALASH, c, W + 0.45, 0.4, 180)}${g(KALASH, -0.45, c, 0.4, -90)}${g(KALASH, W + 0.45, c, 0.4, 90)}</g>`;
    default:
      return "";
  }
}
