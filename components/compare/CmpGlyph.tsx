import styles from "./CmpGlyph.module.css";

/**
 * The comparison tool's mark: two drawings slide onto each other; what was
 * taken out turns red, what was added turns green, and a net (Δ) remains.
 * The heading plays it once on view and on hover.
 */
export default function CmpGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* previous sheet */}
      <g className={styles.a}>
        <rect x="5" y="9" width="30" height="22" />
      </g>
      {/* current sheet */}
      <g className={styles.b}>
        <rect x="13" y="17" width="30" height="22" />
      </g>
      {/* taken out / added */}
      <path className={styles.rem} d="M17 26H27" pathLength={1} />
      <path className={styles.add} d="M17 31H38" pathLength={1} />
      {/* net */}
      <path className={styles.delta} d="M34 44L38 37L42 44Z" />
    </svg>
  );
}
