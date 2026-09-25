import { site } from "@/site.config";
import styles from "./ContactSection.module.css";

/**
 * Contact: one large line and the email address.
 * Desktop: clicking the email copies it. Phones: tapping opens the mail app,
 * and a small Copy button sits next to it.
 */
export default function ContactSection() {
  return (
    <section className={styles.section} id="contact" data-section="contact" data-layer="05-CONTACT" aria-labelledby="contact-title">
      <div className="container">
        <div className={styles.annotation}>
          <span className="mono" data-reveal="rise">
            <span className="accent">05</span> / Contact
          </span>
          <span className={styles.rule} data-reveal="draw" />
        </div>

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
    </section>
  );
}
