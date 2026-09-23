/**
 * WORKSPACE ACTIONS — the only way to change workspace state.
 * ------------------------------------------------------------------
 * The viewport toolbar, the ViewCube, the command line, the project tree
 * and the quantity report all call these same functions, so behaviour is
 * never duplicated.
 */

import { getState, setState, type Activity, type DisplayMode, type Orientation } from "./store";

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
  interaction: "drag" | "transition" | "inertia" | "rest";
}) {
  setState((s) => {
    let orientation = s.viewport.orientation;
    if (view.interaction === "drag") orientation = "free";
    else if (view.interaction === "rest") orientation = view.preset ?? "free";
    const activity: Activity =
      view.interaction === "rest" ? (s.viewport.displayMode === "analysis" ? "analysis" : "idle") : "interaction";
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

export type Destination = "top" | "tools" | "demo" | "case-studies" | "about" | "contact";

const TARGETS: Record<Destination, string> = {
  top: "main",
  tools: "tools",
  demo: "sqe-demo",
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

export type CommandResult = { lines: string[]; clear?: boolean };

const HELP = "TOP · FRONT · RIGHT · LEFT · ISO · WIREFRAME · SHADED · ANALYSIS · TOOLS · DEMO · ABOUT · CONTACT · HOME · CLEAR";

/** Parse and run one command. Every command maps onto an action above. */
export function runCommand(input: string): CommandResult {
  const cmd = input.trim().toUpperCase().replace(/^_/, "");
  if (!cmd) return { lines: [] };

  const views: Record<string, Exclude<Orientation, "free">> = {
    TOP: "top",
    FRONT: "front",
    RIGHT: "right",
    LEFT: "left",
    BACK: "back",
    BOTTOM: "bottom",
    ISO: "iso",
  };
  if (views[cmd]) {
    setOrientation(views[cmd]);
    return { lines: [`View orientation: ${cmd}`] };
  }

  const modes: Record<string, DisplayMode> = {
    WIREFRAME: "wireframe",
    "2DWIREFRAME": "wireframe",
    SHADED: "shaded",
    ANALYSIS: "analysis",
  };
  if (modes[cmd.replace(/\s+/g, "")]) {
    const mode = modes[cmd.replace(/\s+/g, "")];
    setDisplayMode(mode);
    return { lines: [`Display mode: ${displayModeLabel(mode).toUpperCase()}`] };
  }

  const places: Record<string, Destination> = {
    TOOLS: "tools",
    DEMO: "demo",
    SQE: "demo",
    CASES: "case-studies",
    "CASE STUDIES": "case-studies",
    ABOUT: "about",
    CONTACT: "contact",
    EMAIL: "contact",
  };
  if (places[cmd]) {
    navigateTo(places[cmd]);
    return { lines: [`Navigating to ${cmd === "DEMO" || cmd === "SQE" ? "Spatial Quantity Engine" : cmd.toLowerCase()}`] };
  }

  switch (cmd) {
    case "HELP":
    case "?":
      return { lines: [`Commands: ${HELP}`] };
    case "HOME":
      resetViewport();
      return { lines: ["Viewport reset: ISO · 2D WIREFRAME"] };
    case "CLEAR":
      return { lines: [], clear: true };
    case "OVERLAYS":
    case "CLEAN":
      toggleOverlays();
      return { lines: [`Annotations ${getState().viewport.overlaysVisible ? "on" : "off"}`] };
    default:
      return { lines: [`Unknown command "${cmd}". Type HELP for a list.`] };
  }
}
