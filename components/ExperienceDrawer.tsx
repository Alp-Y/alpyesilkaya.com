"use client";

import { useId, useState } from "react";
import styles from "./PropertiesPalette.module.css";

export type ExperienceItem = {
  company: string;
  role: string;
  location: string;
  years: string;
  summary: string;
};

/**
 * The "Experience" group of the Properties palette.
 * Folded by default; the control at the bottom of the palette grows the
 * window downward to reveal it (CSS grid rows 0fr → 1fr, so the palette
 * physically expands rather than swapping content).
 */
export default function ExperienceDrawer({ items }: { items: ExperienceItem[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <div id={id} className={styles.drawer} data-open={open} inert={!open}>
        <div className={styles.drawerInner}>
          <div className={`${styles.group} ${styles.groupStatic}`}>
            <span className={styles.caret} aria-hidden="true">
              ▾
            </span>{" "}
            Experience <span className={styles.count}>{items.length}</span>
          </div>
          <ol className={styles.entries}>
            {items.map((item, i) => (
              <li
                key={`${item.company}-${i}`}
                className={styles.entry}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className={styles.entryHead}>
                  <span className={styles.company}>{item.company}</span>
                  {item.years && <span className={styles.years}>{item.years}</span>}
                </div>
                <div className={styles.role}>
                  {item.role}
                  {item.location && <span className={styles.location}> · {item.location}</span>}
                </div>
                {item.summary && <p className={styles.summary}>{item.summary}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? "Collapse experience" : "Expand experience"}</span>
        <span className={styles.toggleArrow} aria-hidden="true">
          ↓
        </span>
      </button>
    </>
  );
}
