import Link from "next/link";
import type { Tool } from "@/lib/content";
import { pad } from "@/lib/content";
import SqeGlyph from "./sqe/SqeGlyph";
import SpatialQuantityEngine from "./sqe/SpatialQuantityEngine";
import styles from "./ToolFeature.module.css";

const WORKFLOW = [
  "CAD geometry",
  "Project boundaries",
  "Sub-areas",
  "Metadata",
  "Work geometry",
  "Spatial intersection",
  "Quantity",
  "Area-specific report",
];

/**
 * A flagship tool: heading + mark (one interactive object), the concept,
 * its workflow, and — optionally — the live demonstration.
 */
export default function ToolFeature({ tool, index, withDemo = false }: { tool: Tool; index: number; withDemo?: boolean }) {
  return (
    <article className={styles.feature}>
      <div className={styles.head}>
        <Link href={`/tools/${tool.slug}`} className={styles.heading} data-play data-observe>
          {tool.demo === "sqe" && <SqeGlyph className={styles.glyph} />}
          <span className={styles.headingText}>
            <span className="mono">
              <span className="accent">T-{pad(index + 1)}</span> / Flagship tool
            </span>
            <span className={styles.title}>{tool.title}</span>
          </span>
        </Link>
        <div className={styles.copy} data-reveal="rise">
          <p className={styles.lead} data-cursor="text">
            {tool.summary}
          </p>
          {tool.demo === "sqe" && (
            <ol className={styles.workflow} aria-label="Workflow">
              {WORKFLOW.map((step, i) => (
                <li key={step}>
                  <span className="num">{pad(i + 1)}</span> {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {withDemo && tool.demo === "sqe" && (
        <div className={styles.demo} data-reveal="rise">
          <SpatialQuantityEngine />
        </div>
      )}

      <div className={styles.more}>
        <Link href={`/tools/${tool.slug}`} className="link-line">
          About the {tool.title} <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
