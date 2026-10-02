import styles from "./OfcGlyph.module.css";

/**
 * The office tool's mark: a message in front of a calendar. The message
 * becomes a task (the green tick) on one of the calendar's days.
 * The heading plays it once on view and on hover.
 */
export default function OfcGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g className={styles.cal}>
        <rect x="17" y="8" width="26" height="25" />
        <path d="M17 15H43M24 5V11M36 5V11" />
        <path className={styles.days} d="M22 20H25M22 27H25M35 27H38" />
      </g>
      <g className={styles.msg}>
        <path className={styles.bubble} d="M5 23H25V37H13L8 42V37H5Z" />
        <path className={styles.text} d="M9 28H21M9 32H17" />
      </g>
      {/* the task, on its due day */}
      <path className={styles.tick} d="M30 21L33 24L39 18" pathLength={1} />
    </svg>
  );
}
