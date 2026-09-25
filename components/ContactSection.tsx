import { site } from "@/site.config";
import { sectionNumbers } from "@/lib/sections";
import styles from "./ContactSection.module.css";

/**
 * Contact: one large line and the email address, with a brief.txt card beside
 * it that says what to put in the email.
 * Desktop: clicking the email copies it. Phones: tapping opens the mail app,
 * and a small Copy button sits next to it.
 */
export default function ContactSection() {
  const num = sectionNumbers().contact;
  return (
    <section className={styles.section} id="contact" data-section="contact" data-layer={`${num}-CONTACT`} aria-labelledby="contact-title">
      <div className="container">
        <div className={styles.annotation}>
          <span className="mono" data-reveal="rise">
            <span className="accent">{num}</span> / Contact
          </span>
          <span className={styles.rule} data-reveal="draw" />
        </div>

        <div className={styles.layout}>
          <div className={styles.main}>
            <h2 id="contact-title" className={styles.title} data-reveal="lines">
              <span className="line">
                <span>Got a workflow</span>
              </span>
              <span className="line" style={{ "--l": 1 } as React.CSSProperties}>
                <span>worth automating?</span>
              </span>
            </h2>

            <div className={styles.emailRow} data-reveal="rise" style={{ "--delay": "250ms" } as React.CSSProperties}>
              <a href={`mailto:${site.email}`} className={styles.email} data-copy-email={site.email}>
                <span className={styles.emailText} data-copy-label>
                  {site.email}
                </span>
                <span className={styles.copied} data-copy-done aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied to clipboard
                </span>
              </a>
              <button type="button" className={styles.copyButton} data-copy-button={site.email}>
                Copy
              </button>
            </div>

            <p className={`mono ${styles.hint}`} data-reveal="rise" style={{ "--delay": "320ms" } as React.CSSProperties}>
              <span className={styles.hintDesktop}>Click to copy</span>
              <span className={styles.hintTouch}>Tap to open your mail app</span>
              <span className="sr-only" role="status" data-copy-status />
            </p>

            <ul className={styles.links} data-stagger>
              <li data-reveal="rise">
                <a href={site.links.github} className="link-line" target="_blank" rel="noopener noreferrer">
                  GitHub <span className="arrow" aria-hidden="true">↗</span>
                </a>
              </li>
              <li data-reveal="rise">
                <a href={site.links.linkedin} className="link-line" target="_blank" rel="noopener noreferrer">
                  LinkedIn <span className="arrow" aria-hidden="true">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* What a useful brief contains — a note file, like the Properties panel in About */}
          <aside className={styles.brief} aria-labelledby="brief-title" data-reveal="rise" style={{ "--delay": "300ms" } as React.CSSProperties}>
            <div className={styles.briefHead}>
              <span id="brief-title" className="mono">
                brief.txt
              </span>
              <span className={`mono ${styles.briefMeta}`}>3 lines is enough</span>
            </div>
            <ol className={styles.briefList}>
              {[
                ["The task you repeat", "What you do by hand, step by step."],
                ["The files it touches", "DWG, XYZ survey points, Excel sheets…"],
                ["How often it comes round", "Every survey, every week, every progress update."],
              ].map(([title, note], i) => (
                <li key={title}>
                  <span className={`mono ${styles.briefNum}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <b>{title}</b>
                    <span className={styles.briefNote}>{note}</span>
                  </span>
                </li>
              ))}
            </ol>
            <a href={`mailto:${site.email}?subject=${encodeURIComponent("Workflow brief")}`} className={styles.briefSend}>
              Write the brief <span className="arrow" aria-hidden="true">→</span>
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
