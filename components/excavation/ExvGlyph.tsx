import styles from "./ExvGlyph.module.css";

/**
 * The excavation tool's mark: surveyed points → a TIN → the volume between
 * two surfaces. The heading plays it once on view and on hover.
 */
export default function ExvGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* existing ground (TIN) */}
      <path className={styles.tin} d="M6 20 L16 12 L28 16 L42 10 M6 20 L16 22 L28 16 M16 12 L16 22 M28 16 L30 24 L42 10 M16 22 L30 24" pathLength={1} />
      {/* excavated surface */}
      <path className={styles.ex} d="M10 32 L24 36 L38 30" pathLength={1} />
      {/* the volume between them */}
      <path className={styles.vol} d="M16 22 L30 24 L38 30 L24 36 L10 32 Z" />
      {/* survey points */}
      {[
        [6, 20],
        [16, 12],
        [28, 16],
        [42, 10],
        [16, 22],
        [30, 24],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} className={styles.pt} cx={x} cy={y} r="1.2" />
      ))}
    </svg>
  );
}
