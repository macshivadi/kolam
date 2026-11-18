import { addDays, clampToPastOrToday, isValidDateString, kolamNumber, localDateString } from "./dateSeed";
import { appRootFromPathname, datePath, datePageUrl, parseDatePath, resolveSiteUrl } from "./paths";
import { GRIDS, GRID_IDS, pulliLabel, type GridId } from "./grid";
import { generateKolam, kolamOfTheDay, type KolamPattern } from "./generator";
import { hashString } from "./prng";
import { kolamSvg, strokeEndTime } from "./render";
import { THEMES, type ThemeId } from "./themes";
import { festivalOn } from "./festivals";
import {
  isStyleId,
  selectPendingGrid,
  selectPendingStyle,
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
import {
  advanceTrace,
  buildSampledPath,
  createTraceState,
  isTraceComplete,
  pointAtLength,
  traceProgress01,
  type SampledPath,
  type TraceState,
} from "./trace";
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
type DrawMode = "view" | "watch" | "trace";

type State = {
  mode: Mode;
  date: string;
  gridId: GridId;
  seed: number;
  themeId: ThemeId;
  themeOverridden: boolean;
  pattern: KolamPattern;
  color: boolean;
  colorOverridden: boolean;
  drawMode: DrawMode;
  watchSpeed: "slow" | "normal";
  /** Style currently drawn on the canvas. */
  styleId: KolamStyleId;
  /** Grid chosen in Create your own; does not redraw until Generate. */
  pendingGridId: GridId;
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
  const theme = THEMES[themeId];
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.style.setProperty("--line", theme.line);
  root.style.setProperty("--dot", theme.dot);
  root.style.setProperty("--ink", theme.ink);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--button-face", theme.buttonFace);
  root.style.setProperty("--button-text", theme.buttonText);
  root.style.setProperty("--mark", theme.mark);
}

function seededColor(state: State): boolean {
  return defaultColorMode(state.mode === "daily" ? Math.max(kolamNumber(state.date), 0) : state.seed);
}

function themeForStyle(style: KolamStyleId): ThemeId {
  if (style === "diwali" || style === "karthigai" || style === "navaratri") return "diwali";
  if (style === "harvest" || style === "onam") return "pongal";
  if (style === "christmas") return "christmas";
  return "classic";
}

function resolvedStyle(style: KolamStyleId, seedOrNumber: number): KolamStyleId {
  if (style !== "auto") return style;
  return defaultColorMode(seedOrNumber) ? "color" : "line";
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
  const theme = THEMES[state.themeId];
  const slow = Boolean(opts.slow);
  const asStatic = Boolean(opts.static);
  stage.innerHTML = kolamSvg(state.pattern, {
    theme,
    slow,
    static: asStatic,
    fills: fillsFor(state),
    style: state.styleId,
  });
  stage.classList.toggle("is-tracing", state.drawMode === "trace");
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
    canvasLabel.hidden = true;
  } else {
    hero.textContent = `Your kolam · ${label}`;
    prev.setAttribute("aria-disabled", "true");
    next.setAttribute("aria-disabled", "true");
    prev.href = "#";
    next.href = "#";
    back.hidden = false;
    canvasLabel.hidden = false;
  }

  const fest = state.mode === "daily" ? festivalOn(state.date) : undefined;
  const chip = $("festival-chip");
  if (fest) {
    chip.hidden = false;
    chip.textContent =
      fest.dayLabel && fest.dayLabel !== fest.name ? `${fest.greeting} · ${fest.dayLabel}` : fest.greeting;
  } else {
    chip.hidden = true;
    chip.textContent = "";
  }

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.grid === state.pendingGridId));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-style]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.style === state.pendingStyleId));
  });
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
    : defaultColorMode(Math.max(kolamNumber(clamped), 0))
      ? "color"
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
  const text = shareText(ctx);
  const title = "கோலம் · Kolam";
  try {
    const svg = $("stage").querySelector("svg");
    const width = svg ? svg.getBoundingClientRect().width : 320;
    const blob = await renderKolamPng(state.pattern, THEMES[state.themeId], width, { fills: fillsFor(state) });
    const name =
      state.mode === "daily"
        ? pngFilename("daily", state.date)
        : pngFilename("generated", `${state.gridId}-${state.seed}`);
    const file = new File([blob], name, { type: "image/png" });
    const payload: ShareData = { title, text, url: ctx.url };
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
let traceState: TraceState | null = null;
let tracing = false;

function stopWatch(): void {
  if (watchRun?.raf) cancelAnimationFrame(watchRun.raf);
  watchRun = null;
}

function perLoopMs(speed: "slow" | "normal"): number {
  return speed === "slow" ? 6500 : 3200;
}

function setPathOffset(path: SVGPathElement, offset: number, drawn: boolean): void {
  path.style.animation = "none";
  path.style.strokeDasharray = drawn ? "none" : "1";
  path.style.strokeDashoffset = drawn ? "0" : String(offset);
  path.classList.toggle("is-drawn", drawn);
}

function ensureFingertip(svg: SVGSVGElement): SVGCircleElement {
  let el = svg.querySelector<SVGCircleElement>(".fingertip");
  if (!el) {
    el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("class", "fingertip");
    el.setAttribute("r", "0.16");
    svg.appendChild(el);
  }
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
  const dur = perLoopMs(state.watchSpeed);
  while (run.loop < run.sampled.length && run.elapsed >= dur) {
    const done = paths[run.loop];
    if (done) setPathOffset(done, 0, true);
    run.elapsed -= dur;
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
  const t = Math.min(1, run.elapsed / dur);
  paths.forEach((p, i) => {
    if (i < run.loop) setPathOffset(p, 0, true);
    else if (i === run.loop) setPathOffset(p, 1 - t, false);
    else setPathOffset(p, 1, false);
  });
  const path = run.sampled[run.loop];
  if (run.fingertip && path) {
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
  const fingertip = ensureFingertip(svg as SVGSVGElement);
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

function showDrawPanel(mode: "watch" | "trace"): void {
  const panel = $("draw-along");
  panel.hidden = false;
  $("watch-tab").setAttribute("aria-pressed", String(mode === "watch"));
  $("trace-tab").setAttribute("aria-pressed", String(mode === "trace"));
  $("watch-controls").hidden = mode !== "watch";
  $("trace-controls").hidden = mode !== "trace";
}

function exitDrawAlong(state: State, opts: { silent?: boolean } = {}): void {
  stopWatch();
  traceState = null;
  tracing = false;
  state.drawMode = "view";
  $("draw-along").hidden = true;
  $("stage").classList.remove("is-tracing", "is-complete");
  if (!opts.silent) renderStage(state, { static: true });
}

function startTrace(state: State): void {
  stopWatch();
  state.drawMode = "trace";
  showDrawPanel("trace");
  renderStage(state, { static: true });
  const svg = $("stage").querySelector("svg");
  if (!svg) return;
  $("stage").classList.add("is-tracing");
  $("stage").classList.remove("is-complete");
  svg.querySelectorAll<SVGPathElement>(".kolam-path").forEach((p) => {
    p.style.animation = "none";
    p.style.strokeDasharray = "1";
    p.style.strokeDashoffset = "1";
    p.style.opacity = "0.28";
    p.classList.remove("is-drawn");
  });
  const fills = svg.querySelector(".kolam-fills");
  if (fills) fills.classList.remove("is-colored");
  // Overlay copies that light up as the user traces.
  const ns = "http://www.w3.org/2000/svg";
  const lines = svg.querySelector(".kolam-lines") ?? svg;
  state.pattern.paths.forEach((d, i) => {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("class", `trace-ink trace-ink-${i}`);
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", THEMES[state.themeId].line);
    p.setAttribute("stroke-width", "0.16");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("pathLength", "1");
    p.style.strokeDasharray = "1";
    p.style.strokeDashoffset = "1";
    lines.appendChild(p);
  });
  const tip = ensureFingertip(svg as SVGSVGElement);
  const first = buildSampledPath(state.pattern.paths[0] ?? "M0 0Z");
  const start = pointAtLength(first, 0);
  tip.setAttribute("cx", String(start.x));
  tip.setAttribute("cy", String(start.y));
  tip.style.display = "";
  traceState = createTraceState(state.pattern.paths);
  $("trace-progress").textContent = "0%";
}

function paintTrace(): void {
  if (!traceState) return;
  const svg = $("stage").querySelector("svg");
  if (!svg) return;
  const inks = svg.querySelectorAll<SVGPathElement>(".trace-ink");
  inks.forEach((p, i) => {
    if (i < traceState!.loopIndex) {
      p.style.strokeDashoffset = "0";
    } else if (i === traceState!.loopIndex) {
      const path = traceState!.paths[i];
      const t = path && path.length ? traceState!.progress / path.length : 0;
      p.style.strokeDashoffset = String(1 - t);
    } else {
      p.style.strokeDashoffset = "1";
    }
  });
  const tip = svg.querySelector<SVGCircleElement>(".fingertip");
  if (tip && !isTraceComplete(traceState) && traceState.paths[traceState.loopIndex]) {
    const path = traceState.paths[traceState.loopIndex];
    const pt = pointAtLength(path, traceState.progress);
    tip.setAttribute("cx", String(pt.x));
    tip.setAttribute("cy", String(pt.y));
    tip.style.display = "";
  }
  const pct = Math.round(traceProgress01(traceState) * 100);
  $("trace-progress").textContent = `${pct}%`;
  if (isTraceComplete(traceState)) {
    $("stage").classList.add("is-complete");
    if (tip) tip.style.display = "none";
    const fills = svg.querySelector(".kolam-fills");
    if (fills && fills.childElementCount > 0) fills.classList.add("is-colored");
    playDrawAlongSound();
  }
}

function pointerToSvg(ev: PointerEvent): { x: number; y: number } | null {
  const svg = $("stage").querySelector("svg");
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function onStagePointerDown(state: State, ev: PointerEvent): void {
  if (state.drawMode !== "trace") return;
  ev.preventDefault();
  tracing = true;
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  const pt = pointerToSvg(ev);
  if (pt && traceState) {
    traceState = advanceTrace(traceState, pt);
    paintTrace();
  }
}

function onStagePointerMove(state: State, ev: PointerEvent): void {
  if (state.drawMode !== "trace" || !tracing || !traceState) return;
  ev.preventDefault();
  const pt = pointerToSvg(ev);
  if (!pt) return;
  traceState = advanceTrace(traceState, pt);
  paintTrace();
}

function onStagePointerUp(): void {
  tracing = false;
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
    showDrawPanel("watch");
    $("speed-slow").setAttribute("aria-pressed", String(state.watchSpeed === "slow"));
    $("speed-normal").setAttribute("aria-pressed", String(state.watchSpeed === "normal"));
    startWatch(state, true);
  });
  $("watch-tab").addEventListener("click", () => {
    state.drawMode = "watch";
    showDrawPanel("watch");
    $("stage").classList.remove("is-tracing");
    startWatch(state, true);
  });
  $("trace-tab").addEventListener("click", () => startTrace(state));
  $("draw-close").addEventListener("click", () => exitDrawAlong(state));
  $("watch-pause").addEventListener("click", () => toggleWatchPause(state));
  $("speed-slow").addEventListener("click", () => {
    state.watchSpeed = "slow";
    $("speed-slow").setAttribute("aria-pressed", "true");
    $("speed-normal").setAttribute("aria-pressed", "false");
    if (state.drawMode === "watch") startWatch(state, true);
  });
  $("speed-normal").addEventListener("click", () => {
    state.watchSpeed = "normal";
    $("speed-slow").setAttribute("aria-pressed", "false");
    $("speed-normal").setAttribute("aria-pressed", "true");
    if (state.drawMode === "watch") startWatch(state, true);
  });
  $("trace-reset").addEventListener("click", () => startTrace(state));

  const stage = $("stage");
  stage.addEventListener("pointerdown", (ev) => onStagePointerDown(state, ev));
  stage.addEventListener("pointermove", (ev) => onStagePointerMove(state, ev));
  stage.addEventListener("pointerup", onStagePointerUp);
  stage.addEventListener("pointercancel", onStagePointerUp);
  stage.addEventListener("click", (ev) => {
    // Canvas taps do nothing except in Trace mode (handled by pointer events).
    if (state.drawMode !== "trace") ev.preventDefault();
  });

  $("generate").addEventListener("click", () => {
    const seed = freshSeed();
    const gridId = state.pendingGridId;
    const styleId = resolvedStyle(state.pendingStyleId, seed);
    const pattern = generateKolam(GRIDS[gridId], seed);
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
    if (state.drawMode === "trace") startTrace(state);
  });
  $("color-on").addEventListener("click", () => {
    state.color = true;
    state.colorOverridden = true;
    writeColorPref(true);
    renderStage(state, { static: state.drawMode !== "view" });
    renderChrome(state);
    if (state.drawMode === "watch") startWatch(state, true);
    if (state.drawMode === "trace") startTrace(state);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-grid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.grid as GridId;
      if (!GRID_IDS.includes(id)) return;
      // Select only — today's kolam and the canvas stay put until Generate.
      Object.assign(state, selectPendingGrid(state, id));
      renderChrome(state);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.style;
      if (!isStyleId(id)) return;
      Object.assign(state, selectPendingStyle(state, id));
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
          pattern: generateKolam(GRIDS[parsed.gridId], parsed.seed),
        }
      : loadDaily(parsed.date);

  const generatedBase = parsed.mode === "generated";
  const initStyle: KolamStyleId = generatedBase
    ? (defaultColorMode(base.seed) ? "color" : "line")
    : (base as { styleId?: KolamStyleId }).styleId ?? "line";
  const state: State = {
    ...base,
    styleId: initStyle,
    pendingGridId: base.gridId,
    pendingStyleId: generatedBase ? "auto" : "auto",
    color: pref ?? styleUsesColor(initStyle, defaultColorMode(base.mode === "daily" ? Math.max(kolamNumber(base.date), 0) : base.seed)),
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
