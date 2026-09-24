import SectionHeader from "./SectionHeader";
import styles from "./Disciplines.module.css";

/** How I work, in three steps: the problem, the approach, the result. */
const items = [
  {
    index: "01",
    title: "Problem",
    text: "Drawings, quantities, survey files and CAD geometry live in different places, and engineers move, check and re-measure that data by hand, again and again.",
    // scattered sheets that don't connect
    icon: (
      <>
        <rect x="4" y="8" width="15" height="19" rx="1" pathLength={1} data-part="open" />
        <rect x="29" y="5" width="15" height="12" rx="1" pathLength={1} data-part="close" />
        <rect x="22" y="27" width="18" height="15" rx="1" pathLength={1} />
        <path d="M19 14l10-4" strokeDasharray="2 3" data-part="datum" />
        <path d="M13 27l9 7" strokeDasharray="2 3" data-part="datum" />
      </>
    ),
  },
  {
    index: "02",
    title: "Approach",
    text: "Start from the engineering workflow, then build the tool around its real geometry, metadata and project structure.",
    // separate inputs, joined into one process
    icon: (
      <>
        <rect x="4" y="10" width="8" height="8" pathLength={1} />
        <rect x="4" y="30" width="8" height="8" pathLength={1} />
        <rect x="36" y="20" width="8" height="8" pathLength={1} />
        <path d="M12 14c12 0 12 10 24 10" pathLength={1} />
        <path d="M12 34c12 0 12-10 24-10" pathLength={1} />
        {/* flow pulses — only visible while hovered */}
        <path d="M12 14c12 0 12 10 24 10" pathLength={1} data-part="flow" />
        <path d="M12 34c12 0 12-10 24-10" pathLength={1} data-part="flow" />
      </>
    ),
  },
  {
    index: "03",
    title: "Result",
    text: "Repeatable, traceable workflows with fewer manual steps. The engineering decisions stay with the engineer.",
    // a checked sheet
    icon: (
      <>
        <rect x="9" y="5" width="30" height="38" rx="1.5" pathLength={1} />
        <path d="M9 13h30" pathLength={1} />
        <path d="M17 28l5 5 10-11" pathLength={1} data-part="tick" />
      </>
    ),
  },
];

export default function Disciplines() {
  return (
    <section className={styles.section} id="approach" data-section="approach" data-layer="01-APPROACH">
      <div className="container">
        <SectionHeader
          index="01"
          label="How I work"
          title={["Engineering,", "written in code."]}
        />

        <ol className={styles.grid} data-stagger>
          {items.map((item) => (
            <li key={item.index} className={styles.item} data-reveal="rise" data-proximity="140">
              <span className={styles.rule} data-reveal="draw" aria-hidden="true" />
              <div className={styles.top}>
                <span className="mono">{item.index}</span>
                <svg className={styles.icon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  {item.icon}
                </svg>
              </div>
              <h3 className={styles.title}>{item.title}</h3>
              <p className={styles.text}>{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
