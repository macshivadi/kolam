import { KOLAM_WHATSAPP_URL } from "./contact";

export type ShareKind = "daily" | "generated";

export type ShareContext = {
  kind: ShareKind;
  url: string;
  /** Kolam number, used only for daily invites. */
  number?: number;
  date?: string;
};

/** Friendly invite used in the system share sheet and desktop fallbacks. */
export function shareText(ctx: ShareContext): string {
  if (ctx.kind === "daily") {
    const n = ctx.number ?? 1;
    return `Hey! Come draw today's kolam with me 🌸 Kolam #${n} — practice it and share yours: ${ctx.url}`;
  }
  return `I made this kolam — come practice and draw with me! ${ctx.url}`;
}

/** Shorter invite for X, where the URL is passed separately. */
export function shareTextShort(ctx: ShareContext): string {
  if (ctx.kind === "daily") {
    const n = ctx.number ?? 1;
    return `Come draw today's kolam with me 🌸 Kolam #${n}`;
  }
  return `I made this kolam — come practice and draw with me!`;
}

export function whatsappShareUrl(ctx: ShareContext): string {
  return `https://wa.me/?text=${encodeURIComponent(shareText(ctx))}`;
}

export function facebookShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

export function xShareUrl(ctx: ShareContext): string {
  const params = new URLSearchParams({
    text: shareTextShort(ctx),
    url: ctx.url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export { KOLAM_WHATSAPP_URL };
