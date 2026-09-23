import styles from "./SectionHeader.module.css";

/**
 * Standard section opening:
 *   02 — TOOLS ─────────────────────────────── meta
 *   Big title (each item in `title` is one line)
 *   Optional intro paragraph
 */
export default function SectionHeader({
  index,
  label,
  title,
  intro,
  meta,
  id,
  as: Tag = "h2",
}: {
  index: string;
  label: string;
  title: string[];
  intro?: string;
  meta?: string;
  id?: string;
  as?: "h1" | "h2";
}) {
  return (
    <header className={styles.header}>
      <div className={styles.annotation}>
        <span className="mono" data-reveal="rise">
          <span className="accent">{index}</span> — {label}
        </span>
        <span className={styles.rule} data-reveal="draw" style={{ "--delay": "100ms" } as React.CSSProperties} />
        {meta && (
          <span className="mono" data-reveal="rise" style={{ "--delay": "200ms" } as React.CSSProperties}>
            {meta}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <Tag id={id} className={styles.title} data-reveal="lines" style={{ "--delay": "80ms" } as React.CSSProperties}>
          {title.map((line, i) => (
            <span key={line} className="line" style={{ "--l": i } as React.CSSProperties}>
              <span>{line}</span>
            </span>
          ))}
        </Tag>
        {intro && (
          <p className={styles.intro} data-reveal="rise" style={{ "--delay": "250ms" } as React.CSSProperties}>
            {intro}
          </p>
        )}
      </div>
    </header>
  );
}
