import { kolamSvg } from "./render";
import type { KolamPattern } from "./generator";
import type { Theme } from "./themes";
import type { FillRegion } from "./regions";

/**
 * Render the kolam SVG onto a canvas at 2× the displayed size
 * (with a minimum so a phone still downloads a crisp image).
 */
export async function renderKolamPng(
  pattern: KolamPattern,
  theme: Theme,
  displayedWidth: number,
  opts: { fills?: FillRegion[] } = {},
): Promise<Blob> {
  const svg = kolamSvg(pattern, { theme, static: true, fills: opts.fills });
  const size = Math.max(1024, Math.round(Math.max(displayedWidth, 320) * 2));
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = theme.floor;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const png = await canvasToBlob(canvas);
    if (!png) throw new Error("Could not encode PNG");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterize the kolam"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function pngFilename(kind: "daily" | "generated", dateOrGrid: string): string {
  return kind === "daily" ? `kolam-${dateOrGrid}.png` : `kolam-${dateOrGrid}.png`;
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give Safari a moment to begin the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
