import styles from "./CtmGlyph.module.css";

/**
 * CAD Terminal's mark: a plain grey line and a dot get selected, turn into
 * a structure with a tag, and the prompt waits for the next one.
 * The heading plays it once on view and on hover.
 */
export default function CtmGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* the raw line and point, identified */}
      <path className={styles.line} d="M5 26H29" />
      <circle className={styles.dot} cx="36" cy="26" r="2.4" />
      {/* the selection window */}
      <rect className={styles.sel} x="2" y="21" width="40" height="10" />
      {/* the tag on its leader */}
      <path className={styles.leader} d="M17 26L22 14" />
      <rect className={styles.tag} x="22" y="8" width="20" height="8" />
      <path className={styles.tagText} d="M26 12H36" />
      {/* the prompt */}
      <path className={styles.prompt} d="M5 37L9 40L5 43" />
      <path className={styles.caret} d="M12 43H18" />
    </svg>
  );
}
