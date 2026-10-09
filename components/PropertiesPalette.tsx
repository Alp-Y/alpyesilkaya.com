import ExperienceDrawer, { type ExperienceItem } from "./ExperienceDrawer";
import PaletteClose from "./PaletteClose";
import styles from "./PropertiesPalette.module.css";

/**
 * Turns "Company | Role | Location | Years | One-line summary" rows
 * (an optional `experience` list in /content/about.md) into experience items.
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

/** How a group is drawn. See the notes at the top of /content/about.md. */
type GroupStyle = "rows" | "tags" | "cards" | "timeline";
type Row = { label: string; value: string; parts: string[] };
type Group = { name: string; style: GroupStyle; rows: Row[] };

const STYLES: readonly GroupStyle[] = ["rows", "tags", "cards", "timeline"];

/**
 * The CAD "Properties" palette.
 * `rows` are strings written as "Label | Value" (see /content/about.md).
 * A row written as "[Group name]" starts a new foldable group; rows before
 * the first one go under "General". Empty groups are not shown.
 *
 * A group can say how it is drawn, "[Group name | style]", so each kind of
 * information gets the shape that reads fastest:
 *   rows      a plain label / value table (the default)
 *   tags      the value's "a · b · c" parts as small tags
 *   cards     one card per row, side by side: label large, then the parts
 *   timeline  one entry per row down a line: label = years, parts = who · what · where
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
  const groups: Group[] = [{ name: "General", style: "rows", rows: [] }];
  for (const raw of rows) {
    const row = String(raw).trim();
    const heading = row.match(/^\[(.+)\]$/);
    if (heading) {
      const [name, style = ""] = heading[1].split("|").map((part) => part.trim());
      const known = STYLES.find((s) => s === style.toLowerCase());
      groups.push({ name, style: known ?? "rows", rows: [] });
      continue;
    }
    const [label, ...rest] = row.split("|");
    const value = rest.join("|").trim();
    groups[groups.length - 1].rows.push({
      label: label.trim(),
      value,
      parts: value.split("·").map((part) => part.trim()).filter(Boolean),
    });
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
            {g.style === "tags" && <TagRows rows={g.rows} />}
            {g.style === "cards" && <Cards rows={g.rows} />}
            {g.style === "timeline" && <Timeline rows={g.rows} />}
            {g.style === "rows" && (
              <dl className={styles.rows}>
                {g.rows.map((row, i) => (
                  <div key={`${row.label}-${i}`} className={styles.row}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        ))}
      {experience.length > 0 && <ExperienceDrawer items={experience} />}
    </div>
  );
}

/** A small label, then the value's parts as tags: read at a glance, like layer names. */
function TagRows({ rows }: { rows: Row[] }) {
  return (
    <dl className={styles.tagRows}>
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className={styles.tagRow}>
          <dt>{row.label}</dt>
          <dd>
            {row.parts.map((part) => (
              <span key={part} className={styles.tag}>
                {part}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One card per row, side by side: the label large, the first part under it, the rest as a small note. */
function Cards({ rows }: { rows: Row[] }) {
  return (
    <ul className={styles.cards}>
      {rows.map((row, i) => {
        const [what, ...note] = row.parts;
        return (
          <li key={`${row.label}-${i}`} className={styles.card}>
            <span className={styles.cardKey}>{withMarks(row.label)}</span>
            {what && <span className={styles.cardWhat}>{what}</span>}
            {note.length > 0 && <span className={styles.cardNote}>{note.join(" · ")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One entry per row down a line, newest first. Each has a square grip on the
 * line (like a selected object's grips in CAD); the first one is lit, as the
 * current role. Label = years, parts = who · what · where.
 */
function Timeline({ rows }: { rows: Row[] }) {
  return (
    <ol className={styles.timeline}>
      {rows.map((row, i) => {
        const [who, ...rest] = row.parts;
        return (
          <li key={`${row.label}-${i}`} className={styles.stop} data-current={i === 0}>
            <i className={styles.grip} aria-hidden="true" />
            <span className={styles.stopMain}>
              <span className={styles.who}>{who}</span>
              {rest.length > 0 && <span className={styles.what}>{rest.join(" · ")}</span>}
            </span>
            <span className={styles.when}>{row.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Sets a registered mark (®) small and raised after the word before it. */
function withMarks(text: string) {
  const [word, ...rest] = text.split("®");
  if (!rest.length) return text;
  return (
    <>
      {word}
      <sup className={styles.reg}>®</sup>
      {rest.join("")}
    </>
  );
}
