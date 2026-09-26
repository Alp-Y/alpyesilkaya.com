"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import {
  DISPLAY_MODES,
  ORIENTATIONS,
  displayModeLabel,
  orientationLabel,
  setDisplayMode,
  setOrientation,
  toggleOverlays,
} from "@/lib/workspace/actions";
import styles from "./ViewportToolbar.module.css";

/**
 * The CAD viewport controls:  [−] [Top] [2D Wireframe]
 *
 *   [−]           clean view — hides secondary annotations
 *   [Top]         view orientation (Top, Front, Right, Left, Back, ISO)
 *   [2D Wireframe] display mode (2D Wireframe, Shaded, Analysis)
 *
 * All three read and write the shared workspace state, so the hero
 * toolbar, the Quantity by Area Calculator toolbar, the ViewCube and the
 * command line always agree.
 */
export default function ViewportToolbar({ className = "", dropUp = false }: { className?: string; dropUp?: boolean }) {
  const orientation = useWorkspace((s) => s.viewport.orientation);
  const displayMode = useWorkspace((s) => s.viewport.displayMode);
  const overlays = useWorkspace((s) => s.viewport.overlaysVisible);
  const [open, setOpen] = useState<"view" | "display" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const viewText = orientationLabel(orientation);
  const modeText = displayModeLabel(displayMode);

  return (
    <div ref={rootRef} className={`${styles.toolbar} ${dropUp ? styles.dropUp : ""} ${className}`} role="toolbar" aria-label="Viewport controls">
      <button
        type="button"
        className={styles.control}
        onClick={toggleOverlays}
        aria-pressed={!overlays}
        aria-label={overlays ? "Clean view: hide annotations" : "Show annotations"}
        data-hud={`DISPLAY|${overlays ? "CLEAN VIEW" : "SHOW ANNOTATIONS"}`}
      >
        [{overlays ? "−" : "+"}]
      </button>

      <div className={styles.group}>
        <button
          type="button"
          className={styles.control}
          aria-haspopup="menu"
          aria-expanded={open === "view"}
          aria-controls={`${id}-view`}
          onClick={() => setOpen(open === "view" ? null : "view")}
          data-hud={`VIEW|${viewText.toUpperCase()}`}
        >
          [<span className="num">{viewText}</span>]
        </button>
        {open === "view" && (
          <ul id={`${id}-view`} className={styles.menu} role="menu" aria-label="View orientation">
            {ORIENTATIONS.map((o) => (
              <li key={o.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={orientation === o.id}
                  className={styles.item}
                  data-hud={`VIEW|${o.label.toUpperCase()}`}
                  onClick={() => {
                    setOrientation(o.id);
                    setOpen(null);
                  }}
                >
                  <span className={styles.check} aria-hidden="true" />
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.group}>
        <button
          type="button"
          className={styles.control}
          aria-haspopup="menu"
          aria-expanded={open === "display"}
          aria-controls={`${id}-display`}
          onClick={() => setOpen(open === "display" ? null : "display")}
          data-hud={`DISPLAY|${modeText.toUpperCase()}`}
        >
          [{modeText}]
        </button>
        {open === "display" && (
          <ul id={`${id}-display`} className={styles.menu} role="menu" aria-label="Display mode">
            {DISPLAY_MODES.map((m) => (
              <li key={m.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={displayMode === m.id}
                  className={styles.item}
                  data-hud={`DISPLAY|${m.label.toUpperCase()}`}
                  onClick={() => {
                    setDisplayMode(m.id);
                    setOpen(null);
                  }}
                >
                  <span className={styles.check} aria-hidden="true" />
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
