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
 * Folded by default; the control at the bottom grows the palette downward
 * (CSS grid rows 0fr → 1fr). Inside, each role is one compact row in the
 * same two columns as the properties above (years | company, role), and
 * clicking a row opens its one-line summary underneath. One at a time, so
 * the palette never turns into a long wall of text.
 */
export default function ExperienceDrawer({ items }: { items: ExperienceItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
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
            {items.map((item, i) => {
              const isOpen = active === i;
              const panel = `${id}-e${i}`;
              return (
                <li key={`${item.company}-${i}`} className={styles.entry} data-active={isOpen} style={{ "--i": i } as React.CSSProperties}>
                  <button
                    type="button"
                    className={styles.entryRow}
                    aria-expanded={isOpen}
                    aria-controls={item.summary ? panel : undefined}
                    onClick={() => setActive(isOpen ? null : i)}
                  >
                    <span className={styles.years}>{item.years}</span>
                    <span className={styles.entryMain}>
                      <span className={styles.company}>{item.company}</span>
                      <span className={styles.role}>
                        {item.role}
                        {item.location && <span className={styles.location}> · {item.location}</span>}
                      </span>
                    </span>
                    {item.summary && (
                      <span className={styles.entryCaret} aria-hidden="true">
                        +
                      </span>
                    )}
                  </button>
                  {item.summary && (
                    <div id={panel} className={styles.entryMore} data-open={isOpen} inert={!isOpen}>
                      <div>
                        <p className={styles.summary}>{item.summary}</p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((v) => !v);
          setActive(null);
        }}
      >
        <span>{open ? "Collapse experience" : "Expand experience"}</span>
        <span className={styles.toggleArrow} aria-hidden="true">
          ↓
        </span>
      </button>
    </>
  );
}
