/**
 * WORKSPACE ACTIONS — the only way to change workspace state.
 * ------------------------------------------------------------------
 * The viewport toolbar, the ViewCube, the command line, the project tree
 * and the quantity report all call these same functions, so behaviour is
 * never duplicated.
 */

import { getState, setState, type Activity, type DisplayMode, type Orientation } from "./store";
import { launchConfetti } from "../confetti";

/* ---------------- viewport ---------------- */

export const ORIENTATIONS: { id: Exclude<Orientation, "free">; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "front", label: "Front" },
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
  { id: "back", label: "Back" },
  { id: "iso", label: "ISO" },
];

export const DISPLAY_MODES: { id: DisplayMode; label: string }[] = [
  { id: "wireframe", label: "2D Wireframe" },
  { id: "shaded", label: "Shaded" },
  { id: "analysis", label: "Analysis" },
];

export function orientationLabel(o: Orientation): string {
  return o === "free" ? "Free" : ORIENTATIONS.find((x) => x.id === o)?.label ?? o;
}

export function displayModeLabel(m: DisplayMode): string {
  return DISPLAY_MODES.find((x) => x.id === m)?.label ?? m;
}

/** Ask for a named view. The ViewCube animates there and confirms it. */
export function setOrientation(orientation: Exclude<Orientation, "free">) {
  setState((s) => ({
    ...s,
    viewport: { ...s.viewport, orientation, request: s.viewport.request + 1 },
  }));
}

/**
 * Reported by the ViewCube. `interaction` tells us whether the view is
 * resting (then `preset` is exact) or still moving.
 */
export function reportView(view: {
  preset: Exclude<Orientation, "free"> | null;
  azimuth: number;
  elevation: number;
  interaction: "drag" | "transition" | "inertia" | "spin" | "rest";
}) {
  setState((s) => {
    let orientation = s.viewport.orientation;
    if (view.interaction === "drag" || view.interaction === "spin") orientation = "free";
    else if (view.interaction === "rest") orientation = view.preset ?? "free";
    const activity: Activity =
      view.interaction === "rest" || view.interaction === "spin" ? (s.viewport.displayMode === "analysis" ? "analysis" : "idle") : "interaction";
    const vp = s.viewport;
    const angles = view.interaction === "rest" ? { azimuth: view.azimuth, elevation: view.elevation } : {};
    if (orientation === vp.orientation && activity === s.activity && view.interaction !== "rest") return s;
    return { ...s, activity, viewport: { ...vp, orientation, ...angles } };
  });
}

export function setDisplayMode(displayMode: DisplayMode) {
  setState((s) =>
    s.viewport.displayMode === displayMode
      ? s
      : { ...s, activity: displayMode === "analysis" ? "analysis" : "idle", viewport: { ...s.viewport, displayMode } },
  );
}

export function setOverlays(visible: boolean) {
  setState((s) =>
    s.viewport.overlaysVisible === visible ? s : { ...s, viewport: { ...s.viewport, overlaysVisible: visible } },
  );
}

export function toggleOverlays() {
  setOverlays(!getState().viewport.overlaysVisible);
}

/** ViewCube Home: ISO view at default zoom (display mode and annotations untouched). */
export function homeView() {
  setState((s) => ({
    ...s,
    viewport: {
      ...s.viewport,
      orientation: "iso",
      request: s.viewport.request + 1,
      resetRequest: s.viewport.resetRequest + 1,
    },
  }));
}

/** HOME command: ISO view, default zoom, wireframe, annotations on. */
export function resetViewport() {
  setState((s) => ({
    ...s,
    viewport: {
      ...s.viewport,
      orientation: "iso",
      displayMode: "wireframe",
      overlaysVisible: true,
      request: s.viewport.request + 1,
      resetRequest: s.viewport.resetRequest + 1,
    },
  }));
}

/* ---------------- selection ---------------- */

export function selectEntity(id: string | null) {
  setState((s) => (s.selection === id ? s : { ...s, selection: id }));
}

export function hoverEntity(id: string | null) {
  setState((s) => (s.hover === id ? s : { ...s, hover: id }));
}

/* ---------------- navigation ---------------- */

export type Destination = "top" | "approach" | "tools" | "demo" | "excavation" | "case-studies" | "about" | "contact";

const TARGETS: Record<Destination, string> = {
  top: "main",
  approach: "approach",
  tools: "tools",
  demo: "sqe-demo",
  excavation: "exv-demo",
  "case-studies": "case-studies",
  about: "about",
  contact: "contact",
};

let navTimer = 0;
let routerPush: ((href: string) => void) | null = null;

/** SiteEffects registers the Next.js router so navigation stays client-side. */
export function registerNavigator(push: (href: string) => void) {
  routerPush = push;
}

export function navigateTo(destination: Destination) {
  const id = TARGETS[destination];
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el) {
    // Not on the homepage: go there (client-side)
    routerPush?.(`/#${id}`);
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setState((s) => ({ ...s, activity: "navigation" }));
  window.clearTimeout(navTimer);
  navTimer = window.setTimeout(() => setState((s) => (s.activity === "navigation" ? { ...s, activity: "idle" } : s)), 900);
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/* ---------------- command line ---------------- */

/**
 * `lines` are printed to the console. `quiet` commands (PARTY) print nothing:
 * their effect is temporary and must leave no trace in the command line.
 */
export type CommandResult = { lines: string[]; clear?: boolean; quiet?: boolean };

/** Sections you can go to by name (plus a few natural aliases). */
const PLACES: Record<string, { to: Destination; label: string }> = {
  APPROACH: { to: "approach", label: "01 · How I work" },
  "HOW I WORK": { to: "approach", label: "01 · How I work" },
  DISCIPLINES: { to: "approach", label: "01 · How I work" },
  TOOLS: { to: "tools", label: "02 · Tools" },
  WORK: { to: "tools", label: "02 · Tools" },
  DEMO: { to: "demo", label: "Quantity by Area Calculator" },
  QUANTITY: { to: "demo", label: "Quantity by Area Calculator" },
  QUANTITIES: { to: "demo", label: "Quantity by Area Calculator" },
  SQE: { to: "demo", label: "Quantity by Area Calculator" },
  EXCAVATION: { to: "excavation", label: "Automatize Excavation Calculations" },
  VOLUME: { to: "excavation", label: "Automatize Excavation Calculations" },
  CASES: { to: "case-studies", label: "03 · Case studies" },
  "CASE STUDIES": { to: "case-studies", label: "03 · Case studies" },
  "CASE STUDY": { to: "case-studies", label: "03 · Case studies" },
  PROJECTS: { to: "case-studies", label: "03 · Case studies" },
  ABOUT: { to: "about", label: "04 · About" },
  "ABOUT ME": { to: "about", label: "04 · About" },
  CONTACT: { to: "contact", label: "05 · Contact" },
  EMAIL: { to: "contact", label: "05 · Contact" },
  HIRE: { to: "contact", label: "05 · Contact" },
};

const VIEWS: Record<string, Exclude<Orientation, "free">> = {
  TOP: "top",
  FRONT: "front",
  RIGHT: "right",
  LEFT: "left",
  BACK: "back",
  BOTTOM: "bottom",
  ISO: "iso",
};

const MODES: Record<string, DisplayMode> = {
  WIREFRAME: "wireframe",
  "2DWIREFRAME": "wireframe",
  SHADED: "shaded",
  ANALYSIS: "analysis",
};

const OTHER = ["HELP", "HOME", "CLEAR", "PARTY", "GRID"];

/** The shortest useful help: one line that fits the console. */
export const HELP_LINES = ["Try: TOOLS · EXCAVATION · CASES · ABOUT · CONTACT · TOP · ISO · SHADED · PARTY"];

/** Parse and run one command. Every command maps onto an action above. */
export function runCommand(input: string, opts: { origin?: { x: number; y: number } } = {}): CommandResult {
  // Forgiving input: case, spaces, a leading "_" (AutoCAD), "go to …" / "open …", trailing punctuation
  const cmd = input
    .trim()
    .toUpperCase()
    .replace(/^_/, "")
    .replace(/^(GO\s*TO|GOTO|OPEN|SHOW)\s+/, "")
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
  if (!cmd) return { lines: [] };

  if (VIEWS[cmd]) {
    setOrientation(VIEWS[cmd]);
    return { lines: [`View orientation: ${cmd}`] };
  }
  const mode = MODES[cmd.replace(/\s+/g, "")];
  if (mode) {
    setDisplayMode(mode);
    return { lines: [`Display mode: ${displayModeLabel(mode).toUpperCase()}`] };
  }
  const place = PLACES[cmd];
  if (place) {
    navigateTo(place.to);
    return { lines: [`→ ${place.label}`] };
  }

  switch (cmd) {
    case "HELP":
    case "?":
      return { lines: HELP_LINES };
    case "HOME":
      resetViewport();
      return { lines: ["Viewport reset: ISO · 2D WIREFRAME"] };
    case "CLEAR":
      return { lines: [], clear: true };
    case "PARTY":
    case "CONFETTI":
      // A temporary easter egg: the confetti is the only output, nothing is echoed
      launchConfetti(opts.origin);
      return { lines: [], quiet: true };
    case "OVERLAYS":
    case "CLEAN":
      toggleOverlays();
      return { lines: [`Annotations ${getState().viewport.overlaysVisible ? "on" : "off"}`] };
    default: {
      const guess = closest(cmd, [...Object.keys(PLACES), ...Object.keys(VIEWS), ...Object.keys(MODES), ...OTHER]);
      return { lines: [guess ? `Unknown command "${cmd}". Did you mean ${guess}?` : `Unknown command "${cmd}". Type HELP for a list.`] };
    }
  }
}

/** Nearest known command within a small edit distance (typo help). */
function closest(word: string, options: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const o of options) {
    const d = editDistance(word, o);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  // swapped or missing letters count: up to 2 edits for real words, 1 for very short ones
  return bestD <= (word.length <= 3 ? 1 : Math.max(2, Math.floor(word.length / 4))) ? best : null;
}
function editDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/* ---------------- orbit (drag the view from anywhere, e.g. the earthworks model) ---------------- */

export type OrbitApi = {
  /** Slow showcase spin on / off, and whether it is running. */
  spin: (on: boolean) => void;
  spinning: () => boolean;
  start: (x: number, y: number, t: number) => void;
  move: (x: number, y: number, t: number) => void;
  end: (t: number) => void;
};
let orbitApi: OrbitApi | null = null;

/** The ViewCube registers its controller here; anything can then orbit the shared view. */
export function registerOrbit(api: OrbitApi | null) {
  orbitApi = api;
}
export function getOrbit(): OrbitApi | null {
  return orbitApi;
}
