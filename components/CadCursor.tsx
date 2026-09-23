import styles from "./CadCursor.module.css";

/**
 * Markup for the single CAD cursor + context HUD (see lib/workspace/cadCursor.ts).
 * Rendered once in the layout; the behaviour is attached on the client.
 */
export default function CadCursor() {
  return (
    <div className={styles.root} data-cad-cursor data-mode="hidden" aria-hidden="true">
      <div className={styles.frame} data-cc-frame>
        <span className={styles.h} data-cc-h />
        <span className={styles.v} data-cc-v />
      </div>
      <span className={styles.marker} data-cc-marker>
        <span className={styles.box} />
        <span className={`${styles.corner} ${styles.tl}`} />
        <span className={`${styles.corner} ${styles.tr}`} />
        <span className={`${styles.corner} ${styles.bl}`} />
        <span className={`${styles.corner} ${styles.br}`} />
      </span>
      <div className={styles.hud} data-hud data-visible="false">
        <div className={styles.inner} data-hud-inner />
      </div>
    </div>
  );
}
