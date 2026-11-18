import { KOLAM_WHATSAPP_URL } from "./contact";

export type ShareKind = "daily" | "generated";

export type ShareContext = {
  kind: ShareKind;
  url: string;
  /** Kolam number, used only for daily invites. */
  number?: number;
  date?: string;
};

/** Invite body with the page URL inlined — for channels that have no separate url field (WhatsApp text). */
export function shareText(ctx: ShareContext): string {
  const body = shareTextShort(ctx).trim();
  const sep = /[!?.,:]$/.test(body) ? " " : ": ";
  return `${body}${sep}${ctx.url}`;
}

/**
 * Invite body without a URL. Use this whenever the channel has its own url
 * field (navigator.share, X) so the link is not sent twice.
 */
export function shareTextShort(ctx: ShareContext): string {
  if (ctx.kind === "daily") {
    const n = ctx.number ?? 1;
    return `Hey! Come draw today's kolam with me 🌸 Kolam #${n} — practice it and share yours`;
  }
  return `I made this kolam — come practice and draw with me!`;
}

/** Fields for navigator.share: url is passed separately, never also in text. */
export function nativeShareData(ctx: ShareContext, title = "கோலம் · Kolam"): { title: string; text: string; url: string } {
  return { title, text: shareTextShort(ctx), url: ctx.url };
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
