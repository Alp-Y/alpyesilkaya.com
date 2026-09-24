import Link from "next/link";
import styles from "./PageHeader.module.css";

/** Opening block for inner pages (/tools, /case-studies, /about, …). */
export default function PageHeader({
  layer,
  crumbs,
  title,
  intro,
  compact = false,
  aside,
  children,
}: {
  /** Shown in the status bar, e.g. "02-TOOLS". */
  layer: string;
  crumbs: { label: string; href?: string }[];
  title: string[];
  intro?: string;
  /** A short header: the page content starts right below the title. */
  compact?: boolean;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={`${styles.header} ${compact ? styles.compact : ""}`} data-page-layer={layer}>
      <div className="container">
        <nav className={styles.crumbs} aria-label="Breadcrumb" data-reveal="rise">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.label}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.grid}>
          <div>
            {children}
            <h1 className={styles.title} data-reveal="lines" style={{ "--delay": "60ms" } as React.CSSProperties}>
              {title.map((line, i) => (
                <span key={line} className="line" style={{ "--l": i } as React.CSSProperties}>
                  <span>{line}</span>
                </span>
              ))}
            </h1>
            {intro && (
              <p className={styles.intro} data-reveal="rise" style={{ "--delay": "220ms" } as React.CSSProperties}>
                {intro}
              </p>
            )}
          </div>
          {aside && (
            <div className={styles.aside} data-reveal="rise" style={{ "--delay": "300ms" } as React.CSSProperties}>
              {aside}
            </div>
          )}
        </div>
      </div>
      <span className={styles.baseRule} data-reveal="draw" aria-hidden="true" />
    </header>
  );
}
