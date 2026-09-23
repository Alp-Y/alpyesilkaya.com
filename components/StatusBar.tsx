import styles from "./StatusBar.module.css";

/**
 * Fixed status bar (desktop only), modelled on a CAD application's.
 * - X, Y: the same drawing coordinates as the HUD (metres), "—" outside drawing space.
 * - GRID toggles the workspace grid (a real, keyboard-accessible control).
 * - The layer shows which section of the page you are in.
 * Only real information here — no decorative toggles.
 */
export default function StatusBar() {
  return (
    <div className={styles.bar} data-status-bar style={{ viewTransitionName: "status-bar" }}>
      <span className={styles.model} aria-hidden="true">
        MODEL
      </span>

      <span className={`${styles.coords} num`} aria-hidden="true">
        <span className={styles.coordLabel}>X, Y</span>
        <span data-coords>—</span>
      </span>

      <button
        type="button"
        className={styles.toggle}
        data-grid-toggle
        aria-pressed="true"
        aria-label="Engineering grid"
      >
        GRID
      </button>

      <div className={styles.right} aria-hidden="true">
        <span className={styles.layer}>
          <span className={styles.swatch} />
          <span data-layer-name>0-INTRO</span>
        </span>
        <span className={styles.meta}>M</span>
      </div>
    </div>
  );
}
