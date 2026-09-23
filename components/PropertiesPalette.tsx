import styles from "./PropertiesPalette.module.css";

/**
 * A key/value list styled like the CAD "Properties" palette.
 * `rows` are strings written as "Label | Value" (see /content/about.md).
 */
export default function PropertiesPalette({
  rows,
  title = "Properties",
  selection,
}: {
  rows: string[];
  title?: string;
  selection?: string;
}) {
  const parsed = rows.map((row) => {
    const [label, ...value] = row.split("|");
    return { label: label.trim(), value: value.join("|").trim() };
  });

  return (
    <div className={styles.palette} data-reveal="rise">
      <div className={styles.head}>
        <span className="mono">{title}</span>
        <span className={styles.close} aria-hidden="true">
          ×
        </span>
      </div>
      {selection && <div className={styles.selection}>{selection}</div>}
      <div className={styles.group}>
        <span aria-hidden="true">▾</span> General
      </div>
      <dl className={styles.rows}>
        {parsed.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
