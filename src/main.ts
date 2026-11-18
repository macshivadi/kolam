import { addDays, clampToPastOrToday, isValidDateString, kolamNumber, localDateString } from "./dateSeed";
import { appRootFromPathname, datePath, datePageUrl, parseDatePath, resolveSiteUrl } from "./paths";
import { GRID_IDS, pulliLabel, specFor, isCustomGridId, validateCustomGrid, parseCustomGridId, type GridId } from "./grid";
import { generateKolam, kolamOfTheDay, type KolamPattern } from "./generator";
import { hashString } from "./prng";
import { kolamSvg, strokeEndTime, strokeWidthFor } from "./render";
import { THEMES, type ThemeId } from "./themes";
import { festivalOn, festivalChipText } from "./festivals";
import {
  selectPendingGrid,
  styleFestivalId,
  styleForFestival,
  styleUsesColor,
  type KolamStyleId,
} from "./styles";
import { downloadBlob, pngFilename, renderKolamPng } from "./exportPng";
import { applyAmbience, currentAmbience, lampVisible } from "./ambience";
import { playDrawAlongSound, setSoundEnabled, soundEnabled } from "./sound";
import { defaultColorMode, rangoliPalette } from "./palettes";
import { colorRegions, type FillRegion } from "./regions";
import { buildSampledPath, pointAtLength, type SampledPath } from "./trace";
import { pathDurationMs, type WatchSpeed } from "./drawSpeed";
import "./style.css";
import {
  KOLAM_WHATSAPP_URL,
  facebookShareUrl,
  nativeShareData,
  type ShareContext,
  whatsappShareUrl,
  xShareUrl,
} from "./share";

type Mode = "daily" | "generated";
type DrawMode = "view" | "watch";

type State = {
  mode: Mode;
  date: string;
  gridId: string;
  seed: number;
  themeId: ThemeId;
  themeOverridden: boolean;
  pattern: KolamPattern;
  color: boolean;
  colorOverridden: boolean;
  drawMode: DrawMode;
  watchSpeed: WatchSpeed;
  /** Style currently drawn on the canvas. */
  styleId: KolamStyleId;
  /** Grid chosen in Create your own; does not redraw until Generate. */
  pendingGridId: string;
  /** Style chosen in Create your own; does not redraw until Generate. */
  pendingStyleId: KolamStyleId;
};

const today = () => localDateString();
let genNonce = 0;
const fillCache = new WeakMap<KolamPattern, Map<string, FillRegion[]>>();

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

function parseUrl(): { mode: Mode; date: string; gridId: string; seed: number } {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");
  const gridParam = params.get("grid");
  const seedParam = params.get("seed");
  const now = today();
  if (seedParam && gridParam && specFor(gridParam)) {
    const seed = Number(seedParam);
    if (Number.isFinite(seed)) {
      return { mode: "generated", date: now, gridId: gridParam, seed: seed >>> 0 };
    }
  }
  const pathDate = parseDatePath(window.location.pathname);
  if (pathDate) {
    return { mode: "daily", date: clampToPastOrToday(pathDate, now), gridId: "7x7", seed: 0 };
  }
  const date = dateParam && isValidDateString(dateParam) ? clampToPastOrToday(dateParam, now) : now;
  return { mode: "daily", date, gridId: "7x7", seed: 0 };
}

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
  const ambience = new URLSearchParams(window.location.search).get("ambience");
  const extra = ambience ? `ambience=${encodeURIComponent(ambience)}` : "";
  let next =
    state.mode === "daily"
      ? `${root}${datePath(state.date)}`
      : `${root}?grid=${state.gridId}&seed=${state.seed}`;
  if (extra) next += (next.includes("?") ? "&" : "?") + extra;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) history.replaceState(null, "", next);
}

function shareContext(state: State): ShareContext {
  return state.mode === "daily"
    ? { kind: "daily", url: shareUrl(state), number: kolamNumber(state.date), date: state.date }
    : { kind: "generated", url: shareUrl(state) };
}

function formatHeroLine(dateStr: string, num: number, label: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const pretty = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const n = num >= 1 ? ` · #${num}` : "";
  return `${pretty}${n} · ${label}`;
}

function applyTheme(themeId: ThemeId): void {
  const root = document.documentElement;
  root.dataset.theme = themeId;
  // Page ink / accent stay on the light paper palette. The kolam tile
  // reads THEMES[themeId] directly when the SVG is drawn.
  const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", paper || "#f5eadc");
}

function seededColor(state: State): boolean {
  const fest = state.mode === "daily" && Boolean(festivalOn(state.date));
  return defaultColorMode(0, fest);
}

function themeForStyle(style: KolamStyleId): ThemeId {
  if (style === "diwali" || style === "karthigai" || style === "navaratri") return "diwali";
  if (style === "harvest" || style === "onam") return "pongal";
  if (style === "christmas") return "christmas";
  return "classic";
}

function readColorPref(): boolean | null {
  try {
    const v = sessionStorage.getItem("kolam-color");
    if (v === "color") return true;
    if (v === "white") return false;
  } catch { /* ignore */ }
  return null;
}

function writeColorPref(on: boolean): void {
  try { sessionStorage.setItem("kolam-color", on ? "color" : "white"); } catch { /* ignore */ }
}

function fillsFor(state: State): FillRegion[] | undefined {
  if (!state.color) return undefined;
  const pal = rangoliPalette(state.themeId, styleFestivalId(state.styleId) ?? festivalOn(state.date)?.id);
  const key = pal.join(",");
  let map = fillCache.get(state.pattern);
  if (!map) {
    map = new Map();
    fillCache.set(state.pattern, map);
  }
  let fills = map.get(key);
  if (!fills) {
    fills = colorRegions(state.pattern, pal);
    map.set(key, fills);
  }
  return fills;
}

let revealTimer = 0;

function markDrawn(svg: Element): void {
  svg.querySelectorAll(".kolam-path").forEach((p) => p.classList.add("is-drawn"));
  const fills = svg.querySelector(".kolam-fills");
  if (fills && fills.childElementCount > 0) fills.classList.add("is-colored");
}

function renderStage(state: State, opts: { slow?: boolean; static?: boolean } = {}): void {
  stopWatch();
  const stage = $("stage");
  const theme = { ...THEMES[state.themeId] };
  const amb = currentAmbience();
  if ((amb === "dusk" || amb === "night") && state.themeId === "classic") {
    theme.floor = amb === "dusk" ? "#12100e" : "#0e0c0b";
  }
  const slow = Boolean(opts.slow);
  const asStatic = Boolean(opts.static);
  stage.innerHTML = kolamSvg(state.pattern, {
    theme,
    slow,
    static: asStatic,
    fills: fillsFor(state),
    style: state.styleId,
  });
  stage.classList.remove("is-tracing");
  stage.classList.remove("is-complete");
  const svg = stage.querySelector("svg");
  if (!svg) return;
  if (asStatic) {
    markDrawn(svg);
    return;
  }
  if (revealTimer) window.clearTimeout(revealTimer);
  const waitMs = Math.ceil(strokeEndTime(state.pattern, { theme, slow }) * 1000) + 200;
  const onEnd = () => markDrawn(svg);
  svg.querySelectorAll(".kolam-path").forEach((p) => {
    p.addEventListener("animationend", onEnd, { once: true });
  });
  revealTimer = window.setTimeout(onEnd, waitMs);
}


function setCustomError(message: string | null): void {
  const el = document.getElementById("custom-error");
  if (!el) return;
  if (message) {
    el.hidden = false;
    el.textContent = message;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

function readCustomDraft(): ReturnType<typeof validateCustomGrid> {
  const shape = (document.querySelector('input[name="custom-shape"]:checked') as HTMLInputElement | null)?.value ?? "square";
  const rows = Number((document.getElementById("custom-rows") as HTMLInputElement | null)?.value);
  const cols = Number((document.getElementById("custom-cols") as HTMLInputElement | null)?.value);
  const center = Number((document.getElementById("custom-center") as HTMLInputElement | null)?.value);
  return validateCustomGrid({ shape, rows, cols, center });
}

function showCustomFields(shape: string): void {
  const sq = document.getElementById("custom-square-fields");
  const dia = document.getElementById("custom-diamond-fields");
  if (sq) sq.hidden = shape !== "square";
  if (dia) dia.hidden = shape !== "diamond";
}

function syncCustomPanel(state: State): void {
  const panel = document.getElementById("custom-grid");
  const customBtn = document.getElementById("grid-custom");
  const usingCustom = isCustomGridId(state.pendingGridId) || state.pendingGridId === "custom";
  if (panel) panel.hidden = !usingCustom;
  customBtn?.setAttribute("aria-pressed", String(usingCustom));
  const parsed = parseCustomGridId(state.pendingGridId);
  if (!parsed || !usingCustom) return;
  if (parsed.kind === "square") {
    const shape = document.querySelector('input[name="custom-shape"][value="square"]') as HTMLInputElement | null;
    if (shape) shape.checked = true;
    showCustomFields("square");
    const rows = document.getElementById("custom-rows") as HTMLInputElement | null;
    const cols = document.getElementById("custom-cols") as HTMLInputElement | null;
    if (rows) rows.value = String(parsed.nr ?? parsed.n);
    if (cols) cols.value = String(parsed.nc ?? parsed.n);
  } else {
    const shape = document.querySelector('input[name="custom-shape"][value="diamond"]') as HTMLInputElement | null;
    if (shape) shape.checked = true;
    showCustomFields("diamond");
    const center = document.getElementById("custom-center") as HTMLInputElement | null;
    const mid = parsed.rows ? Math.max(...parsed.rows) : 5;
    if (center) center.value = String(mid);
  }
}

function renderChrome(state: State): void {
  const now = today();
  const isToday = state.date === now;
  const num = kolamNumber(state.date);
  const label = pulliLabel(state.pattern.spec);
  const hero = $("hero-line");
  const prev = $("prev-day") as HTMLAnchorElement;
  const next = $("next-day") as HTMLAnchorElement;
  const back = $("back-today");
  const canvasLabel = $("canvas-label");
  const root = appRootFromPathname(window.location.pathname);

  if (state.mode === "daily") {
    hero.textContent = formatHeroLine(state.date, num, label);
    prev.setAttribute("aria-disabled", "false");
    next.setAttribute("aria-disabled", isToday ? "true" : "false");
    prev.href = `${root}${datePath(addDays(state.date, -1))}`;
    next.href = isToday ? "#" : `${root}${datePath(addDays(state.date, 1))}`;
    back.hidden = isToday;
    back.textContent = "Back to today";
    canvasLabel.hidden = true;
  } else {
    hero.textContent = `Your kolam · ${label}`;
    prev.setAttribute("aria-disabled", "true");
    next.setAttribute("aria-disabled", "true");
    prev.href = "#";
    next.href = "#";
    back.hidden = false;
    back.textContent = "Back to today";
    canvasLabel.hidden = false;
  }

  const fest = state.mode === "daily" ? festivalOn(state.date) : undefined;
  const chip = $("festival-chip");
  if (fest) {
    chip.hidden = false;
    chip.textContent = festivalChipText(fest);
  } else {
    chip.hidden = true;
    chip.textContent = "";
  }

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    const id = btn.dataset.grid ?? "";
    const pressed = id === "custom" ? isCustomGridId(state.pendingGridId) || state.pendingGridId === "custom" : id === state.pendingGridId;
    btn.setAttribute("aria-pressed", String(pressed));
  });
  syncCustomPanel(state);
  $("color-white").setAttribute("aria-pressed", String(!state.color));
  $("color-on").setAttribute("aria-pressed", String(state.color));

  const ctx = shareContext(state);
  ($("share-wa") as HTMLAnchorElement).href = whatsappShareUrl(ctx);
  ($("share-fb") as HTMLAnchorElement).href = facebookShareUrl(ctx.url);
  ($("share-x") as HTMLAnchorElement).href = xShareUrl(ctx);

  const lamp = $("lamp");
  lamp.hidden = !lampVisible(currentAmbience());

  $("stage").setAttribute("aria-label", state.mode === "generated" ? "Your kolam" : "Today's kolam");
}

function setPattern(state: State, next: Partial<State> & { pattern?: KolamPattern }): void {
  Object.assign(state, next);
  if (state.mode === "daily") state.gridId = state.pattern.spec.id;
  state.themeId = themeForStyle(state.styleId);
  if (!state.colorOverridden) {
    state.color = styleUsesColor(state.styleId, seededColor(state));
  }
  applyTheme(state.themeId);
  exitDrawAlong(state, { silent: true });
  renderStage(state);
  renderChrome(state);
  updateAddressBar(state);
}

function loadDaily(date: string): Pick<
  State,
  "mode" | "date" | "gridId" | "seed" | "themeId" | "themeOverridden" | "pattern" | "styleId" | "pendingGridId" | "pendingStyleId" | "colorOverridden"
> {
  const clamped = clampToPastOrToday(date, today());
  const pattern = kolamOfTheDay(clamped);
  const fest = festivalOn(clamped);
  const styleId: KolamStyleId = fest
    ? styleForFestival(fest.id)
    : "line";
  return {
    mode: "daily",
    date: clamped,
    gridId: pattern.spec.id,
    seed: pattern.seed,
    themeId: themeForStyle(styleId),
    themeOverridden: false,
    pattern,
    styleId,
    pendingGridId: pattern.spec.id,
    pendingStyleId: "auto",
    colorOverridden: false,
  };
}

async function savePng(state: State): Promise<void> {
  const svg = $("stage").querySelector("svg");
  const width = svg ? svg.getBoundingClientRect().width : 320;
  const blob = await renderKolamPng(state.pattern, THEMES[state.themeId], width, { fills: fillsFor(state) });
  const name =
    state.mode === "daily"
      ? pngFilename("daily", state.date)
      : pngFilename("generated", `${state.gridId}-${state.seed}`);
  await downloadBlob(blob, name);
}

async function shareKolam(state: State): Promise<void> {
  const ctx = shareContext(state);
  const payload: ShareData = nativeShareData(ctx);
  try {
    const svg = $("stage").querySelector("svg");
    const width = svg ? svg.getBoundingClientRect().width : 320;
    const blob = await renderKolamPng(state.pattern, THEMES[state.themeId], width, { fills: fillsFor(state) });
    const name =
      state.mode === "daily"
        ? pngFilename("daily", state.date)
        : pngFilename("generated", `${state.gridId}-${state.seed}`);
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ ...payload, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
  }
  openSheet("share-sheet");
}

async function copyLink(state: State): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl(state));
    flash("Copied");
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

function openSheet(id: "menu-panel" | "about-panel" | "share-sheet"): void {
  $("menu-panel").hidden = id !== "menu-panel";
  $("about-panel").hidden = id !== "about-panel";
  $("share-sheet").hidden = id !== "share-sheet";
  $("menu-btn").setAttribute("aria-expanded", String(id === "menu-panel"));
}

function closeSheets(): void {
  $("menu-panel").hidden = true;
  $("about-panel").hidden = true;
  $("share-sheet").hidden = true;
  $("menu-btn").setAttribute("aria-expanded", "false");
}

function printKolam(mode: "color" | "mono"): void {
  document.documentElement.dataset.print = mode;
  closeSheets();
  window.print();
}

/* —— Draw along (Watch / Trace). Canvas clicks never start a replay. —— */

type WatchRun = {
  raf: number;
  playing: boolean;
  loop: number;
  elapsed: number;
  lastTs: number;
  sampled: SampledPath[];
  fingertip: SVGCircleElement | null;
};
let watchRun: WatchRun | null = null;

function stopWatch(): void {
  if (watchRun?.raf) cancelAnimationFrame(watchRun.raf);
  watchRun = null;
}

function loopDurationMs(run: WatchRun, speed: WatchSpeed): number {
  const path = run.sampled[run.loop];
  return pathDurationMs(path?.length ?? 1, speed);
}

function syncSpeedButtons(speed: WatchSpeed): void {
  for (const id of ["slow", "normal", "fast"] as const) {
    const el = document.getElementById(`speed-${id}`);
    el?.setAttribute("aria-pressed", String(speed === id));
  }
}

function setPathOffset(path: SVGPathElement, offset: number, drawn: boolean): void {
  path.style.animation = "none";
  path.style.strokeDasharray = drawn ? "none" : "1";
  path.style.strokeDashoffset = drawn ? "0" : String(offset);
  path.classList.toggle("is-drawn", drawn);
}

/** Diameter is 1.35× the thin stroke, so the marker sits on the line. */
function fingertipRadius(state: State): number {
  return strokeWidthFor(state.pattern.spec) * 0.675;
}

function ensureFingertip(svg: SVGSVGElement, radius: number): SVGCircleElement {
  let el = svg.querySelector<SVGCircleElement>(".fingertip");
  if (!el) {
    el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("class", "fingertip");
    svg.appendChild(el);
  }
  el.setAttribute("r", radius.toFixed(4));
  return el;
}

function tickWatch(state: State, ts: number): void {
  const run = watchRun;
  if (!run || !run.playing) return;
  const dt = run.lastTs ? ts - run.lastTs : 0;
  run.lastTs = ts;
  run.elapsed += dt;
  const svg = $("stage").querySelector("svg");
  const paths = svg?.querySelectorAll<SVGPathElement>(".kolam-path") ?? [];
  while (run.loop < run.sampled.length) {
    const loopMs = loopDurationMs(run, state.watchSpeed);
    if (run.elapsed < loopMs) break;
    const done = paths[run.loop];
    if (done) setPathOffset(done, 0, true);
    run.elapsed -= loopMs;
    run.loop += 1;
  }
  if (run.loop >= run.sampled.length) {
    paths.forEach((p) => setPathOffset(p, 0, true));
    if (run.fingertip) run.fingertip.style.display = "none";
    const fills = svg?.querySelector(".kolam-fills");
    if (fills && fills.childElementCount > 0) fills.classList.add("is-colored");
    run.playing = false;
    $("watch-pause").textContent = "Replay";
    return;
  }
  const dur = loopDurationMs(run, state.watchSpeed);
  const t = Math.min(1, run.elapsed / dur);
  paths.forEach((p, i) => {
    if (i < run.loop) setPathOffset(p, 0, true);
    else if (i === run.loop) setPathOffset(p, 1 - t, false);
    else setPathOffset(p, 1, false);
  });
  const el = paths[run.loop];
  if (run.fingertip && el) {
    const len = el.getTotalLength();
    const pt = el.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
    run.fingertip.setAttribute("cx", String(pt.x));
    run.fingertip.setAttribute("cy", String(pt.y));
    run.fingertip.style.display = "";
  } else if (run.fingertip && run.sampled[run.loop]) {
    const path = run.sampled[run.loop];
    const pt = pointAtLength(path, t * path.length);
    run.fingertip.setAttribute("cx", String(pt.x));
    run.fingertip.setAttribute("cy", String(pt.y));
    run.fingertip.style.display = "";
  }
  run.raf = requestAnimationFrame((now) => tickWatch(state, now));
}

function startWatch(state: State, fromTop = true): void {
  stopWatch();
  state.drawMode = "watch";
  renderStage(state, { static: true });
  const svg = $("stage").querySelector("svg");
  if (!svg) return;
  const paths = [...svg.querySelectorAll<SVGPathElement>(".kolam-path")];
  const sampled = state.pattern.paths.map((d) => buildSampledPath(d));
  paths.forEach((p) => setPathOffset(p, fromTop ? 1 : 0, false));
  const fills = svg.querySelector(".kolam-fills");
  if (fills) fills.classList.remove("is-colored");
  const fingertip = ensureFingertip(svg as SVGSVGElement, fingertipRadius(state));
  watchRun = {
    raf: 0,
    playing: true,
    loop: 0,
    elapsed: 0,
    lastTs: 0,
    sampled,
    fingertip,
  };
  $("watch-pause").textContent = "Pause";
  playDrawAlongSound();
  // Dots are already visible in the static render; start the line immediately.
  watchRun.raf = requestAnimationFrame((now) => tickWatch(state, now));
}

function toggleWatchPause(state: State): void {
  if (!watchRun) {
    startWatch(state, true);
    return;
  }
  if (watchRun.playing) {
    watchRun.playing = false;
    if (watchRun.raf) cancelAnimationFrame(watchRun.raf);
    watchRun.raf = 0;
    $("watch-pause").textContent = "Resume";
    return;
  }
  if (watchRun.loop >= watchRun.sampled.length) {
    startWatch(state, true);
    return;
  }
  watchRun.playing = true;
  watchRun.lastTs = 0;
  $("watch-pause").textContent = "Pause";
  watchRun.raf = requestAnimationFrame((now) => tickWatch(state, now));
}

function showDrawPanel(): void {
  $("draw-along").hidden = false;
}

function exitDrawAlong(state: State, opts: { silent?: boolean } = {}): void {
  stopWatch();
  state.drawMode = "view";
  $("draw-along").hidden = true;
  $("stage").classList.remove("is-complete");
  if (!opts.silent) renderStage(state, { static: true });
}

function freshSeed(): number {
  genNonce += 1;
  return (hashString(`gen:${Date.now()}:${Math.random()}:${genNonce}`) >>> 0) || genNonce;
}

function wire(state: State): void {
  $("prev-day").addEventListener("click", (ev) => {
    ev.preventDefault();
    if (state.mode !== "daily") return;
    state.colorOverridden = false;
    setPattern(state, loadDaily(addDays(state.date, -1)));
  });
  $("next-day").addEventListener("click", (ev) => {
    ev.preventDefault();
    if (state.mode !== "daily" || state.date >= today()) return;
    state.colorOverridden = false;
    setPattern(state, loadDaily(addDays(state.date, 1)));
  });
  $("back-today").addEventListener("click", () => {
    state.colorOverridden = false;
    setPattern(state, loadDaily(today()));
    const card = document.getElementById("create-card") as HTMLDetailsElement | null;
    if (card) card.open = false;
  });

  $("replay").addEventListener("click", () => {
    state.drawMode = "watch";
    showDrawPanel();
    syncSpeedButtons(state.watchSpeed);
    startWatch(state, true);
  });
  $("draw-close").addEventListener("click", () => exitDrawAlong(state));
  $("watch-pause").addEventListener("click", () => toggleWatchPause(state));
  for (const id of ["slow", "normal", "fast"] as const) {
    document.getElementById(`speed-${id}`)?.addEventListener("click", () => {
      state.watchSpeed = id;
      syncSpeedButtons(id);
      if (state.drawMode === "watch") startWatch(state, true);
    });
  }
  $("stage").addEventListener("click", (ev) => ev.preventDefault());

  $("generate").addEventListener("click", () => {
    let gridId = state.pendingGridId;
    if (isCustomGridId(gridId) || gridId === "custom" || !(document.getElementById("custom-grid")?.hidden ?? true)) {
      const draft = readCustomDraft();
      if (!draft.ok) {
        setCustomError(draft.error);
        return;
      }
      setCustomError(null);
      gridId = draft.spec.id;
      state.pendingGridId = gridId;
    }
    const spec = specFor(gridId);
    if (!spec) {
      setCustomError("Choose a valid grid before generating.");
      return;
    }
    const seed = freshSeed();
    const styleId: KolamStyleId = state.color ? "color" : "line";
    const pattern = generateKolam(spec, seed);
    state.colorOverridden = false;
    setPattern(state, {
      mode: "generated",
      seed,
      pattern,
      date: today(),
      gridId,
      styleId,
      pendingGridId: gridId,
      pendingStyleId: state.pendingStyleId,
    });
  });
  $("save-png").addEventListener("click", () => {
    void savePng(state).catch(() => flash("Could not save the image"));
  });
  $("share").addEventListener("click", () => {
    void shareKolam(state);
  });
  $("copy-link").addEventListener("click", () => {
    void copyLink(state);
  });
  $("print-mono").addEventListener("click", () => printKolam("mono"));
  $("print-color").addEventListener("click", () => printKolam("color"));

  $("color-white").addEventListener("click", () => {
    state.color = false;
    state.colorOverridden = true;
    writeColorPref(false);
    renderStage(state, { static: state.drawMode !== "view" });
    renderChrome(state);
    if (state.drawMode === "watch") startWatch(state, true);
  });
  $("color-on").addEventListener("click", () => {
    state.color = true;
    state.colorOverridden = true;
    writeColorPref(true);
    renderStage(state, { static: state.drawMode !== "view" });
    renderChrome(state);
    if (state.drawMode === "watch") startWatch(state, true);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.grid ?? "";
      if (id === "custom") {
        const draft = readCustomDraft();
        const pending = draft.ok ? draft.spec.id : "custom";
        Object.assign(state, selectPendingGrid(state, pending));
        const panel = document.getElementById("custom-grid");
        if (panel) panel.hidden = false;
        showCustomFields((document.querySelector('input[name="custom-shape"]:checked') as HTMLInputElement | null)?.value ?? "square");
        setCustomError(draft.ok ? null : draft.error);
        renderChrome(state);
        return;
      }
      if (!GRID_IDS.includes(id as GridId)) return;
      const panel = document.getElementById("custom-grid");
      if (panel) panel.hidden = true;
      setCustomError(null);
      // Select only — today's kolam and the canvas stay put until Generate.
      Object.assign(state, selectPendingGrid(state, id));
      renderChrome(state);
    });
  });

  $("menu-btn").addEventListener("click", () => {
    const open = $("menu-panel").hidden;
    if (open) openSheet("menu-panel");
    else closeSheets();
  });
  $("about-btn").addEventListener("click", () => openSheet("about-panel"));
  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closeSheets());
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeSheets();
  });

  const sound = $("sound-toggle") as HTMLInputElement;
  sound.checked = soundEnabled();
  sound.addEventListener("change", () => setSoundEnabled(sound.checked));

  ($("wa-contact") as HTMLAnchorElement).href = KOLAM_WHATSAPP_URL;

  const onCustomChange = () => {
    const draft = readCustomDraft();
    showCustomFields((document.querySelector('input[name="custom-shape"]:checked') as HTMLInputElement | null)?.value ?? "square");
    if (draft.ok) {
      setCustomError(null);
      Object.assign(state, selectPendingGrid(state, draft.spec.id));
    } else {
      setCustomError(draft.error);
    }
    renderChrome(state);
  };
  document.querySelectorAll('input[name="custom-shape"]').forEach((el) => {
    el.addEventListener("change", onCustomChange);
  });
  for (const id of ["custom-rows", "custom-cols", "custom-center"]) {
    document.getElementById(id)?.addEventListener("input", onCustomChange);
  }
}

function init(): void {
  if (redirectDateQuery()) return;
  applyAmbience(currentAmbience());
  const parsed = parseUrl();
  const pref = readColorPref();
  const base =
    parsed.mode === "generated"
      ? {
          mode: "generated" as const,
          date: today(),
          gridId: parsed.gridId,
          seed: parsed.seed,
          themeId: "classic" as const,
          themeOverridden: false,
          pattern: generateKolam(specFor(parsed.gridId)!, parsed.seed),
        }
      : loadDaily(parsed.date);

  const generatedBase = parsed.mode === "generated";
  const initStyle: KolamStyleId = generatedBase
    ? "line"
    : (base as { styleId?: KolamStyleId }).styleId ?? "line";
  const festDefault = !generatedBase && Boolean(festivalOn(base.date));
  const state: State = {
    ...base,
    styleId: initStyle,
    pendingGridId: base.gridId,
    pendingStyleId: generatedBase ? "auto" : "auto",
    color: pref ?? styleUsesColor(initStyle, defaultColorMode(0, festDefault)),
    colorOverridden: pref !== null,
    drawMode: "view",
    watchSpeed: "slow",
  };

  applyTheme(state.themeId);
  renderStage(state);
  renderChrome(state);
  updateAddressBar(state);
  wire(state);
}

init();
