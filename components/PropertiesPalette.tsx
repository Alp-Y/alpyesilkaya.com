import styles from "./PropertiesPalette.module.css";

/**
 * A key/value list styled like the CAD "Properties" palette.
 * `rows` are strings written as "Label | Value" (see /content/about.md).
 * A row written as "[Group name]" starts a new foldable group, like the
 * General / Geometry groups in a CAD palette. Rows before the first
 * group go under "General". Empty groups are not shown.
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
  const groups: { name: string; rows: { label: string; value: string }[] }[] = [{ name: "General", rows: [] }];
  for (const raw of rows) {
    const row = String(raw).trim();
    const heading = row.match(/^\[(.+)\]$/);
    if (heading) {
      groups.push({ name: heading[1].trim(), rows: [] });
      continue;
    }
    const [label, ...value] = row.split("|");
    groups[groups.length - 1].rows.push({ label: label.trim(), value: value.join("|").trim() });
  }

  return (
    <div className={styles.palette} data-reveal="rise">
      <div className={styles.head}>
        <span className="mono">{title}</span>
        <span className={styles.close} aria-hidden="true">
          ×
        </span>
      </div>
      {selection && <div className={styles.selection}>{selection}</div>}
      {groups
        .filter((g) => g.rows.length)
        .map((g) => (
          <details key={g.name} className={styles.section} open>
            <summary className={styles.group}>
              <span className={styles.caret} aria-hidden="true">
                ▾
              </span>{" "}
              {g.name}
            </summary>
            <dl className={styles.rows}>
              {g.rows.map((row, i) => (
                <div key={`${row.label}-${i}`} className={styles.row}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
    </div>
  );
}
