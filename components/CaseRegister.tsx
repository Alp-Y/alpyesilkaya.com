import Link from "next/link";
import Image from "next/image";
import type { CaseStudy } from "@/lib/content";
import { pad } from "@/lib/content";
import styles from "./CaseRegister.module.css";

/**
 * Case studies as a drawing register: an editorial, numbered index.
 * Deliberately different from the Tools showcase.
 * Desktop: hovering a row dims the others and reveals a preview image
 * that trails the cursor. Phones: each row shows a small thumbnail.
 * Entries marked `placeholder: true` show as an unlinked "Coming soon."
 */
export default function CaseRegister({ cases }: { cases: CaseStudy[] }) {
  // Column headings only make sense once there are real entries to read across
  const hasReal = cases.some((c) => !c.placeholder);
  return (
    <div className={styles.register} data-case-register>
      <div className={styles.head} aria-hidden="true" hidden={!hasReal}>
        <span className="mono">No.</span>
        <span className="mono">Title</span>
        <span className="mono">Discipline</span>
        <span className="mono">Year</span>
        <span />
      </div>
      <span className={styles.headRule} data-reveal="draw" aria-hidden="true" />

      <ol className={styles.list}>
        {cases.map((c, i) => (
          <li key={c.slug} className={styles.item} style={{ "--i": i } as React.CSSProperties}>
            {c.placeholder ? (
              /* Not written yet: an intentional "Coming soon." entry — no link, no fake details */
              <div className={`${styles.row} ${styles.soon}`}>
                <span className={styles.number} data-reveal="rise" style={{ "--i": i } as React.CSSProperties}>
                  {pad(i + 1)}
                </span>
                <span className={styles.main} data-reveal="rise" style={{ "--i": i, "--delay": "60ms" } as React.CSSProperties}>
                  <span className={styles.title}>{c.title}</span>
                  <span className={styles.summary}>{c.summary}</span>
                </span>
              </div>
            ) : (
              <Link href={`/case-studies/${c.slug}`} className={styles.row} data-case-row data-preview={c.image}>
                <span className={styles.number} data-case-number data-reveal="rise" style={{ "--i": i } as React.CSSProperties}>
                  {pad(i + 1)}
                </span>

                <span className={styles.main} data-reveal="rise" style={{ "--i": i, "--delay": "60ms" } as React.CSSProperties}>
                  <span className={styles.title}>{c.title}</span>
                  <span className={styles.summary}>{c.summary}</span>
                </span>

                <span className={`mono ${styles.discipline}`} data-reveal="rise" style={{ "--i": i, "--delay": "120ms" } as React.CSSProperties}>
                  {c.discipline}
                </span>
                <span className={`mono ${styles.year}`} data-reveal="rise" style={{ "--i": i, "--delay": "160ms" } as React.CSSProperties}>
                  {c.year}
                </span>

                <span className={styles.go} aria-hidden="true">
                  <span className={styles.goLabel}>View case study</span>
                  <span className="arrow">→</span>
                </span>

                <span className={styles.thumb} aria-hidden="true">
                  <Image src={c.image} alt="" width={320} height={200} unoptimized={c.image.endsWith(".svg")} />
                </span>
              </Link>
            )}
            <span className={styles.rule} data-reveal="draw" style={{ "--i": i } as React.CSSProperties} aria-hidden="true" />
          </li>
        ))}
      </ol>

      {/* Floating preview (desktop). Its image is swapped by lib/effects.ts. */}
      <div className={styles.preview} data-case-preview aria-hidden="true">
        <div className={styles.previewInner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-case-preview-img src={cases[0]?.image} alt="" />
          <span className={styles.previewLabel} data-case-preview-label>
            PREVIEW
          </span>
        </div>
      </div>
    </div>
  );
}
