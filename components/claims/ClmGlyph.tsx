import styles from "./ClmGlyph.module.css";

/**
 * The claim tool's mark: three documents in three formats, fanned out; one
 * shared value threads through all of them (green) and one figure that does
 * not agree is flagged (red). The heading plays it once on view and on hover.
 */
export default function ClmGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g className={styles.c}>
        <rect x="21" y="6" width="20" height="26" />
      </g>
      <g className={styles.b}>
        <rect x="14" y="11" width="20" height="26" />
      </g>
      <g className={styles.a}>
        <rect x="7" y="16" width="20" height="26" />
        <path className={styles.text} d="M11 22H20M11 34H23M11 38H19" />
      </g>
      {/* the shared value, the same in every document */}
      <path className={styles.thread} d="M3 28H45" pathLength={1} />
      {/* the figure that does not agree */}
      <path className={styles.flag} d="M37 19V13H43L41.5 15L43 17H37" />
    </svg>
  );
}
