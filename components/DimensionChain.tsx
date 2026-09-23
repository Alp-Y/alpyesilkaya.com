import styles from "./DimensionChain.module.css";

/**
 * A continuous dimension chain (like DIMCONTINUE in AutoCAD):
 * one line, oblique tick marks, and a label over each segment.
 * Horizontal on desktop, vertical on phones.
 */
export default function DimensionChain({
  labels,
  delay = 0,
  className = "",
}: {
  labels: readonly string[];
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`${styles.chain} ${className}`} style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <div className={styles.baseline} data-reveal="draw" aria-hidden="true" />
      <div className={styles.baselineY} data-reveal="draw" data-axis="y" aria-hidden="true" />
      <ol className={styles.segments}>
        {labels.map((label, i) => (
          <li
            key={label}
            className={styles.segment}
            data-reveal="rise"
            style={{ "--delay": `${delay + 350 + i * 120}ms` } as React.CSSProperties}
          >
            <span className={styles.label}>{label}</span>
            <span className={styles.tick} aria-hidden="true" />
            {i === labels.length - 1 && <span className={`${styles.tick} ${styles.tickEnd}`} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
