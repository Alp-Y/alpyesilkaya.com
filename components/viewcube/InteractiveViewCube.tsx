"use client";

import { useEffect, useId, useRef, useState } from "react";
import ViewCube from "../ViewCube";
import { getState, watch } from "@/lib/workspace/store";
import { homeView, registerOrbit, reportView } from "@/lib/workspace/actions";
import { setHud } from "@/lib/workspace/cadCursor";
import { angle } from "@/lib/format";
import type { OrientationChange, PresetName } from "./orientation";
import type { ViewCubeController } from "./controller";
import styles from "./InteractiveViewCube.module.css";

export type { OrientationChange, PresetName };

/**
 * InteractiveViewCube
 * ------------------------------------------------------------------
 * A CAD-style navigation cube you can actually use:
 *  - drag to orbit, scroll (after clicking it) or pinch to zoom
 *  - click a face, edge or corner to animate to that view
 *  - Home button, keyboard control, compass that follows the heading
 *
 * The static drawing (components/ViewCube.tsx) is rendered first and stays
 * as the fallback. Three.js is loaded afterwards, only in the browser, and
 * the live cube fades in on top. If WebGL isn't available, nothing breaks:
 * the drawing simply stays.
 *
 * Other code can follow the orientation in two ways:
 *   <InteractiveViewCube onOrientationChange={(o) => …} />   (client components)
 *   document.addEventListener("viewcube:orientation", (e) => e.detail)   (anywhere)
 */
export default function InteractiveViewCube({
  className = "",
  onOrientationChange,
}: {
  className?: string;
  onOrientationChange?: (o: OrientationChange) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const compassRefs = useRef<Partial<Record<"N" | "E" | "S" | "W", HTMLSpanElement | null>>>({});
  const controllerRef = useRef<ViewCubeController | null>(null);
  const callbackRef = useRef(onOrientationChange);
  const [ready, setReady] = useState(false);
  // Pulses softly until the visitor first uses it (drag, click, keys — or a view change from elsewhere)
  const [touched, setTouched] = useState(false);
  const hintId = useId();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || touched) return;
    const done = () => setTouched(true);
    root.addEventListener("pointerdown", done, { once: true });
    root.addEventListener("keydown", done, { once: true });
    const unwatch = watch((s) => s.viewport.request + s.viewport.resetRequest, done);
    return () => {
      root.removeEventListener("pointerdown", done);
      root.removeEventListener("keydown", done);
      unwatch();
    };
  }, [touched]);

  // Keep the latest callback without re-creating the 3D scene
  useEffect(() => {
    callbackRef.current = onOrientationChange;
  }, [onOrientationChange]);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage || !supportsWebGL()) return;

    let cancelled = false;
    let controller: ViewCubeController | null = null;
    const unwatch: (() => void)[] = [];

    const start = async () => {
      try {
        const [{ ViewCubeController }, palette] = await Promise.all([import("./controller"), readPalette()]);
        if (cancelled) return;
        controller = new ViewCubeController(
          {
            root,
            stage,
            compass: compassRefs.current as Record<"N" | "E" | "S" | "W", HTMLElement>,
            live: liveRef.current,
          },
          palette,
          {
            onOrientationChange: (o) => {
              callbackRef.current?.(o);
              // Shared workspace state: only meaningful changes (drag start, rest) are stored
              reportView({
                preset: o.interaction === "rest" && o.preset ? (o.preset === "home" ? "iso" : o.preset) : null,
                azimuth: o.azimuth,
                elevation: o.elevation,
                interaction: o.interaction,
              });
              // HUD: while orbiting, show the live angles
              setHud(
                "drag",
                o.interaction === "drag" ? { title: "ORBIT", rows: [["AZ", angle(o.azimuth)], ["EL", angle(o.elevation)]] } : null,
              );
            },
            onHover: (name) => setHud("hover", name ? { title: "VIEW", lines: [name] } : null, "hero"),
            initialView: initialPreset(),
            // The page opens on a slow turn — it stops the moment the visitor takes over
            autoSpin: true,
          },
        );
        controllerRef.current = controller;
        const ctl = controller;
        // Others (the earthworks model) can orbit the same view by dragging
        registerOrbit({
          spin: (on) => ctl.setSpin(on),
          spinning: () => ctl.isSpinning(),
          showcase: (v) => ctl.showcase({ azimuth: (v.azimuth * Math.PI) / 180, elevation: (v.elevation * Math.PI) / 180 }),
          start: (x, y, t) => {
            setTouched(true);
            ctl.externalDragStart(x, y, t);
          },
          move: (x, y, t) => ctl.externalDragMove(x, y, t),
          end: (t) => ctl.externalDragEnd(t),
        });
        unwatch.push(() => registerOrbit(null));

        // Follow the workspace: toolbar / command line ask for views, display modes, resets
        ctl.setDisplayMode(getState().viewport.displayMode);
        unwatch.push(
          watch(
            (s) => s.viewport.request,
            () => {
              const o = getState().viewport.orientation;
              if (o !== "free") ctl.goToPreset(o === "iso" ? "home" : o);
            },
          ),
          watch((s) => s.viewport.resetRequest, () => ctl.goHome()),
          watch((s) => s.viewport.displayMode, (m) => ctl.setDisplayMode(m)),
        );
        // Development only: expose the controller for debugging in the browser console
        if (process.env.NODE_ENV !== "production") Object.assign(root, { __viewcube: controller });
        setReady(true);
      } catch (error) {
        // WebGL failed to start — keep the static drawing.
        controller?.dispose();
        controller = null;
        if (process.env.NODE_ENV !== "production") console.warn("[InteractiveViewCube] falling back to static drawing:", error);
      }
    };

    // Load after the page has settled, so Three.js never competes with the first paint.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), 300);

    return () => {
      cancelled = true;
      unwatch.forEach((u) => u());
      setHud("drag", null);
      setHud("hover", null, "hero");
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
      controller?.dispose();
      controllerRef.current = null;
      setReady(false);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${styles.widget} ${className}`}
      data-viewcube
      data-cursor="grab"
      data-ready={ready}
      data-invite={ready && !touched}
      tabIndex={ready ? 0 : -1}
      role="group"
      aria-roledescription="3D orientation control"
      aria-label="Interactive 3D orientation control"
      aria-describedby={hintId}
    >
      <div ref={stageRef} className={styles.stage}>
        {/* Static drawing: shown before Three.js loads, and if WebGL is unavailable */}
        <ViewCube className={styles.fallback} />
      </div>

      {(["N", "E", "S", "W"] as const).map((d) => (
        <span
          key={d}
          ref={(node) => {
            compassRefs.current[d] = node;
          }}
          className={`${styles.compass} ${d === "N" ? styles.north : ""}`}
          aria-hidden="true"
        >
          {d}
        </span>
      ))}

      <button
        type="button"
        className={styles.home}
        onClick={homeView}
        data-hud="VIEW|HOME · ISO"
        aria-label="Reset to home view (isometric)"
        title="Home view"
        tabIndex={ready ? 0 : -1}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 7.2 8 2.6l5.5 4.6v6.2h-11z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <path d="M6.5 13.4V9.8h3v3.6" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>


      <span id={hintId} className="sr-only">
        Drag to orbit, or use the arrow keys. Press 1 for front, 2 right, 3 back, 4 left, 5 top, 6 bottom, 0 for the home
        view. Plus and minus zoom.
      </span>
      <span ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

/** Start where the shared workspace is (TOP on first load); anything unnamed starts at home. */
function initialPreset(): PresetName {
  const o = getState().viewport.orientation;
  return o === "free" ? "home" : o === "iso" ? "home" : o;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Colours and font from the site's CSS design tokens, so the cube always matches. */
async function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const font = token("--font-mono", "ui-monospace, monospace");
  try {
    // Make sure the mono face is loaded before it is drawn onto the face labels
    await Promise.race([document.fonts.load(`500 40px ${font}`), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fall back to whatever font is available */
  }
  return {
    face: "#0e1318",
    faceShaded: "#1a222c",
    faceHover: "#243242",
    faceActive: "#1c4a36",
    edge: token("--text-2", "#97a1ad"),
    hidden: token("--text-3", "#5d6773"),
    ring: "#a0b9d7",
    label: token("--text-1", "#e8ecf0"),
    accent: token("--accent", "#3ee08f"),
    font,
  };
}
