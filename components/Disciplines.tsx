import SectionHeader from "./SectionHeader";
import styles from "./Disciplines.module.css";

/** "What I do": the three disciplines in plain language. */
const items = [
  {
    index: "01",
    title: "Civil Engineering",
    text: "Infrastructure design and construction delivery: alignments, corridors, grading, and the drawings that carry them to site.",
    icon: (
      <>
        <path d="M2 32h10l6-8h12l6 8h10" pathLength={1} />
        <path d="M18 24l6-1.2 6 1.2" pathLength={1} />
        <path d="M24 16v5" pathLength={1} data-part="cl" />
        <path d="M2 40h44" strokeDasharray="2 3" data-part="datum" />
      </>
    ),
  },
  {
    index: "02",
    title: "Software",
    text: "Tools for the platforms engineers actually use — AutoCAD, Civil 3D and Revit — designed like real products, not scripts.",
    icon: (
      <>
        <rect x="5" y="9" width="38" height="30" rx="1.5" pathLength={1} />
        <path d="M5 16h38" pathLength={1} />
        <path d="M19 23l-5 4.5 5 4.5" pathLength={1} data-part="open" />
        <path d="M29 23l5 4.5-5 4.5" pathLength={1} data-part="close" />
      </>
    ),
  },
  {
    index: "03",
    title: "Automation",
    text: "Repetitive production work turned into checked, repeatable workflows, increasingly with AI-assisted steps where they genuinely help.",
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
];

export default function Disciplines() {
  return (
    <section className={styles.section} id="disciplines" data-section="disciplines" data-layer="01-DISCIPLINES">
      <div className="container">
        <SectionHeader
          index="01"
          label="Disciplines"
          title={["Engineering,", "written in code."]}
          intro="I work where infrastructure meets software: I understand the engineering, and I build the tools that make it faster and more exact."
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
