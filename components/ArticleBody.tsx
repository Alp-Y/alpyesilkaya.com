import Link from "next/link";
import type { Heading } from "@/lib/markdown";
import styles from "./ArticleBody.module.css";

/** Long-form content with a sticky "On this page" index on desktop. */
export function ArticleBody({ html, headings }: { html: string; headings: Heading[] }) {
  const toc = headings.filter((h) => h.level === 2);
  return (
    <div className={`container ${styles.body}`}>
      {toc.length > 1 && (
        <nav className={styles.toc} aria-label="On this page">
          <p className="mono">On this page</p>
          <ol>
            {toc.map((h, i) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className={`prose ${styles.prose}`} data-reveal="rise" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Large "next item" link at the bottom of a detail page. */
export function NextItem({ label, title, href }: { label: string; title: string; href: string }) {
  return (
    <div className={`container ${styles.nextWrap}`}>
      <Link href={href} className={styles.next}>
        <span className="mono">{label}</span>
        <span className={styles.nextTitle}>
          {title} <span className="arrow" aria-hidden="true">→</span>
        </span>
      </Link>
    </div>
  );
}
