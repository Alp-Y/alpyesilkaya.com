import Link from "next/link";
import styles from "./inner.module.css";

export default function NotFound() {
  return (
    <section className={`container ${styles.notFound}`} data-page-layer="404">
      <p className="mono">
        <span className="accent">Error 404</span> — Object not found
      </p>
      <h1>This drawing doesn&rsquo;t exist.</h1>
      <div className={styles.console} aria-hidden="true">
        <p>Command: _OPEN</p>
        <p>Cannot find the specified drawing file.</p>
        <p>Command: _ZOOM EXTENTS</p>
      </div>
      <p>
        <Link href="/" className="link-line">
          Back to the homepage <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
