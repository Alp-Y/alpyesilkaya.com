import styles from "./preview.module.css";

/** Zoom in / out / reset for a preview: the touch-friendly way to zoom. */
export default function ViewControls({ onIn, onOut, onReset, label }: { onIn: () => void; onOut: () => void; onReset: () => void; label: string }) {
  return (
    <div className={styles.controls} role="group" aria-label={`${label} view`}>
      <button type="button" onClick={onIn} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button type="button" onClick={onOut} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <button type="button" onClick={onReset} aria-label="Reset view" title="Reset view">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.25M3.5 2.5v2.5H6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
