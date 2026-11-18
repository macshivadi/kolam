import { addDays, clampToPastOrToday, isValidDateString, kolamNumber, localDateString } from "./dateSeed";
import { appRootFromPathname, datePath, datePageUrl, parseDatePath, resolveSiteUrl } from "./paths";
import { GRIDS, GRID_IDS, pulliLabel, type GridId } from "./grid";
import { generateKolam, kolamOfTheDay, type KolamPattern } from "./generator";
import { hashString } from "./prng";
import { kolamSvg } from "./render";
import { THEMES, THEME_IDS, type ThemeId } from "./themes";
import { defaultThemeForDate, festivalOn } from "./festivals";
import { downloadBlob, pngFilename, renderKolamPng } from "./exportPng";
import "./style.css";
import {
  KOLAM_WHATSAPP_URL,
  facebookShareUrl,
  shareText,
  type ShareContext,
  whatsappShareUrl,
  xShareUrl,
} from "./share";

type Mode = "daily" | "generated";

type State = {
  mode: Mode;
  date: string;
  gridId: GridId;
  seed: number;
  themeId: ThemeId;
  /** True after the visitor picks a theme; cleared when the date changes. */
  themeOverridden: boolean;
  pattern: KolamPattern;
};

const today = () => localDateString();

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function siteBase(): string {
  const root = appRootFromPathname(window.location.pathname).replace(/\/$/, "");
  const local = `${window.location.origin}${root}`;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return local;
  return resolveSiteUrl() || local;
}

function parseUrl(): { mode: Mode; date: string; gridId: GridId; seed: number } {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");
  const gridParam = params.get("grid");
  const seedParam = params.get("seed");
  const now = today();

  if (seedParam && gridParam && GRID_IDS.includes(gridParam as GridId)) {
    const seed = Number(seedParam);
    if (Number.isFinite(seed)) {
      return { mode: "generated", date: now, gridId: gridParam as GridId, seed: seed >>> 0 };
    }
  }

  const pathDate = parseDatePath(window.location.pathname);
  if (pathDate) {
    return { mode: "daily", date: clampToPastOrToday(pathDate, now), gridId: "7x7", seed: 0 };
  }

  const date = dateParam && isValidDateString(dateParam) ? clampToPastOrToday(dateParam, now) : now;
  return { mode: "daily", date, gridId: "7x7", seed: 0 };
}

/** Send leftover ?date=YYYY-MM-DD links to the crawlable path URL. */
function redirectDateQuery(): boolean {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");
  if (!dateParam || !isValidDateString(dateParam) || params.get("seed")) return false;
  const date = clampToPastOrToday(dateParam, today());
  const current = parseDatePath(window.location.pathname);
  const root = appRootFromPathname(window.location.pathname);
  const target = `${root}${datePath(date)}`;
  if (current === date) {
    history.replaceState(null, "", target);
    return false;
  }
  window.location.replace(target);
  return true;
}

function shareUrl(state: State): string {
  if (state.mode === "daily") return datePageUrl(siteBase(), state.date);
  const url = new URL(siteBase() + "/");
  url.searchParams.set("grid", state.gridId);
  url.searchParams.set("seed", String(state.seed));
  return url.toString();
}

function updateAddressBar(state: State): void {
  const root = appRootFromPathname(window.location.pathname);
  const next =
    state.mode === "daily"
      ? `${root}${datePath(state.date)}`
      : `${root}?grid=${state.gridId}&seed=${state.seed}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) history.replaceState(null, "", next);
}

function shareContext(state: State): ShareContext {
  return state.mode === "daily"
    ? { kind: "daily", url: shareUrl(state), number: kolamNumber(state.date), date: state.date }
    : { kind: "generated", url: shareUrl(state) };
}

function formatPrettyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function applyTheme(themeId: ThemeId): void {
  const theme = THEMES[themeId];
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.style.setProperty("--floor", theme.floor);
  root.style.setProperty("--floor-glow", theme.floorGlow);
  root.style.setProperty("--line", theme.line);
  root.style.setProperty("--dot", theme.dot);
  root.style.setProperty("--ink", theme.ink);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--button-face", theme.buttonFace);
  root.style.setProperty("--button-text", theme.buttonText);
  root.style.setProperty("--mark", theme.mark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.floor);
}

function renderStage(state: State): void {
  const stage = $("stage");
  const theme = THEMES[state.themeId];
  stage.innerHTML = kolamSvg(state.pattern, { theme });
  const svg = stage.querySelector("svg");
  if (svg) restartAnimation(svg);
}

function restartAnimation(svg: Element): void {
  const paths = svg.querySelectorAll<SVGPathElement>(".kolam-path");
  paths.forEach((p) => {
    p.classList.remove("kolam-path");
    // Force a reflow so the animation restarts on iOS Safari.
    void p.getTotalLength();
    p.classList.add("kolam-path");
  });
}

function renderChrome(state: State): void {
  const now = today();
  const isToday = state.date === now;
  const num = kolamNumber(state.date);
  const eyebrow = $("eyebrow");
  const dateLabel = $("date-label");
  const kolamNum = $("kolam-num");
  const prev = $("prev-day") as HTMLButtonElement;
  const next = $("next-day") as HTMLButtonElement;
  const back = $("back-today");

  if (state.mode === "daily") {
    eyebrow.textContent = isToday ? "Kolam of the Day" : "A previous kolam";
    dateLabel.textContent = formatPrettyDate(state.date);
    if (num >= 1) {
      kolamNum.textContent = `#${num}`;
      kolamNum.hidden = false;
    } else {
      kolamNum.hidden = true;
    }
    prev.disabled = false;
    next.disabled = isToday;
    back.hidden = isToday;
  } else {
    eyebrow.textContent = "A new kolam";
    dateLabel.textContent = state.pattern.spec.label;
    kolamNum.hidden = true;
    prev.disabled = true;
    next.disabled = true;
    back.hidden = false;
  }

  const pulli = document.getElementById("pulli-label");
  if (pulli) pulli.textContent = pulliLabel(state.pattern.spec);

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.grid === state.gridId));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === state.themeId));
  });

  const banner = document.getElementById("festival-banner");
  const fest = state.mode === "daily" ? festivalOn(state.date) : undefined;
  if (banner) {
    if (fest) {
      banner.hidden = false;
      banner.textContent = fest.dayLabel && fest.dayLabel !== fest.name
        ? `${fest.greeting} · ${fest.dayLabel}`
        : fest.greeting;
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  const ctx = shareContext(state);

  ($("share-wa") as HTMLAnchorElement).href = whatsappShareUrl(ctx);
  ($("share-fb") as HTMLAnchorElement).href = facebookShareUrl(ctx.url);
  ($("share-x") as HTMLAnchorElement).href = xShareUrl(ctx);

  const permalink = document.getElementById("permalink") as HTMLAnchorElement | null;
  if (permalink) {
    if (state.mode === "daily") {
      permalink.href = `${appRootFromPathname(window.location.pathname)}${datePath(state.date)}`;
      permalink.hidden = false;
    } else {
      permalink.hidden = true;
    }
  }
}

function setPattern(state: State, next: Partial<State> & { pattern: KolamPattern }): void {
  Object.assign(state, next);
  if (state.mode === "daily") {
    // Keep the picker in sync with the day's grid so Generate starts from it.
    // The daily grid is already baked into the pattern.
    state.gridId = state.pattern.spec.id;
  }
  applyTheme(state.themeId);
  renderStage(state);
  renderChrome(state);
  updateAddressBar(state);
}

function loadDaily(date: string): State {
  const clamped = clampToPastOrToday(date, today());
  const pattern = kolamOfTheDay(clamped);
  return {
    mode: "daily",
    date: clamped,
    gridId: pattern.spec.id,
    seed: pattern.seed,
    themeId: defaultThemeForDate(clamped),
    themeOverridden: false,
    pattern,
  };
}

async function savePng(state: State): Promise<void> {
  const svg = $("stage").querySelector("svg");
  const width = svg ? svg.getBoundingClientRect().width : 320;
  const blob = await renderKolamPng(state.pattern, THEMES[state.themeId], width);
  const name =
    state.mode === "daily"
      ? pngFilename("daily", state.date)
      : pngFilename("generated", `${state.gridId}-${state.seed}`);
  await downloadBlob(blob, name);
}

async function shareKolam(state: State): Promise<void> {
  const ctx = shareContext(state);
  const text = shareText(ctx);
  const title = "கோலம் · Kolam";
  try {
    const svg = $("stage").querySelector("svg");
    const width = svg ? svg.getBoundingClientRect().width : 320;
    const blob = await renderKolamPng(state.pattern, THEMES[state.themeId], width);
    const name =
      state.mode === "daily"
        ? pngFilename("daily", state.date)
        : pngFilename("generated", `${state.gridId}-${state.seed}`);
    const file = new File([blob], name, { type: "image/png" });
    const payload: ShareData = { title, text, url: ctx.url };
    const withFile = { ...payload, files: [file] };
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share(withFile);
      return;
    }
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    // Fall through to copying the invite.
  }
  try {
    await navigator.clipboard.writeText(text);
    flash("Invite copied");
  } catch {
    flash("Copy the link from the address bar to share");
  }
}

async function copyInvite(state: State): Promise<void> {
  const text = shareText(shareContext(state));
  try {
    await navigator.clipboard.writeText(text);
    flash("Invite copied");
  } catch {
    flash("Could not copy — long-press the link instead");
  }
}

function flash(message: string): void {
  const el = $("toast");
  el.textContent = message;
  el.dataset.show = "1";
  window.setTimeout(() => {
    if (el.textContent === message) delete el.dataset.show;
  }, 2200);
}

function wire(state: State): void {
  $("prev-day").addEventListener("click", () => {
    const date = addDays(state.date, -1);
    setPattern(state, loadDaily(date));
  });
  $("next-day").addEventListener("click", () => {
    if (state.date >= today()) return;
    const date = addDays(state.date, 1);
    setPattern(state, loadDaily(date));
  });
  $("back-today").addEventListener("click", () => {
    setPattern(state, loadDaily(today()));
  });
  $("replay").addEventListener("click", () => renderStage(state));
  $("generate").addEventListener("click", () => {
    const seed = (hashString(`gen:${Date.now()}:${Math.random()}`) >>> 0) || 1;
    const pattern = generateKolam(GRIDS[state.gridId], seed);
    setPattern(state, { mode: "generated", seed, pattern, date: today() });
  });
  $("save-png").addEventListener("click", () => {
    void savePng(state).catch(() => flash("Could not save the image"));
  });
  $("print").addEventListener("click", () => window.print());
  $("share").addEventListener("click", () => {
    void shareKolam(state);
  });
  $("copy-link").addEventListener("click", () => {
    void copyInvite(state);
  });

  const pulli = document.getElementById("pulli-label");
  if (pulli) pulli.textContent = pulliLabel(state.pattern.spec);

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.grid as GridId;
      if (!GRID_IDS.includes(id)) return;
      state.gridId = id;
      renderChrome(state);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.theme as ThemeId;
      if (!THEME_IDS.includes(id)) return;
      state.themeId = id;
      state.themeOverridden = true;
      applyTheme(id);
      renderStage(state);
      renderChrome(state);
    });
  });
}

function init(): void {
  if (redirectDateQuery()) return;
  const parsed = parseUrl();
  const state =
    parsed.mode === "generated"
      ? {
          mode: "generated" as const,
          date: today(),
          gridId: parsed.gridId,
          seed: parsed.seed,
          themeId: "classic" as const,
          themeOverridden: false,
          pattern: generateKolam(GRIDS[parsed.gridId], parsed.seed),
        }
      : loadDaily(parsed.date);

  applyTheme(state.themeId);
  renderStage(state);
  renderChrome(state);
  updateAddressBar(state);
  wire(state);

  ($("wa-contact") as HTMLAnchorElement).href = KOLAM_WHATSAPP_URL;
}

init();
