import ExperienceDrawer, { type ExperienceItem } from "./ExperienceDrawer";
import PaletteClose from "./PaletteClose";
import styles from "./PropertiesPalette.module.css";

/**
 * Turns "Company | Role | Location | Years | One-line summary" rows
 * (the `experience` list in /content/about.md) into experience items.
 */
export function parseExperience(rows: unknown): ExperienceItem[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((raw) => String(raw).split("|").map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([company, role = "", location = "", years = "", ...summary]) => ({
      company,
      role,
      location,
      years,
      summary: summary.join(" | "),
    }));
}

/**
 * A key/value list styled like the CAD "Properties" palette.
 * `rows` are strings written as "Label | Value" (see /content/about.md).
 * A row written as "[Group name]" starts a new foldable group, like the
 * General / Geometry groups in a CAD palette. Rows before the first
 * group go under "General". Empty groups are not shown.
 * Pass `experience` to add the foldable Experience group and its
 * EXPAND EXPERIENCE control at the bottom of the palette.
 */
export default function PropertiesPalette({
  rows,
  title = "Properties",
  selection,
  experience = [],
}: {
  rows: string[];
  title?: string;
  selection?: string;
  experience?: ExperienceItem[];
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
    <div className={styles.palette} data-palette data-closed="false" data-reveal="rise">
      <div className={styles.head}>
        <span className="mono">{title}</span>
        <PaletteClose title={title} />
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
      {experience.length > 0 && <ExperienceDrawer items={experience} />}
    </div>
  );
}
