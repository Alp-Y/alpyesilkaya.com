import Link from "next/link";
import type { Tool } from "@/lib/content";
import { pad } from "@/lib/content";
import SqeGlyph from "./sqe/SqeGlyph";
import SpatialQuantityEngine from "./sqe/SpatialQuantityEngine";
import ExcavationDemo from "./excavation/ExcavationDemo";
import ExvGlyph from "./excavation/ExvGlyph";
import styles from "./ToolFeature.module.css";

/**
 * A flagship tool: heading + mark (one interactive object), the concept in
 * one line, and — optionally — the live demonstration (which tells its own
 * site → survey → areas → quantities story).
 */
export default function ToolFeature({ tool, index, withDemo = false }: { tool: Tool; index: number; withDemo?: boolean }) {
  return (
    <article className={styles.feature}>
      <div className={styles.head}>
        <Link href={`/tools/${tool.slug}`} className={styles.heading} data-play data-observe>
          {tool.demo === "sqe" && <SqeGlyph className={styles.glyph} />}
          {tool.demo === "exv" && <ExvGlyph className={styles.glyph} />}
          <span className={styles.headingText}>
            <span className="mono">
              <span className="accent">T-{pad(index + 1)}</span> / {index === 0 ? "Flagship tool" : "Tool"}
            </span>
            <span className={styles.title}>{tool.title}</span>
          </span>
        </Link>
        <div className={styles.copy} data-reveal="rise">
          <p className={styles.lead} data-cursor="text">
            {tool.summary}
          </p>
        </div>
      </div>

      {withDemo && tool.demo === "sqe" && (
        <div className={styles.demo} data-reveal="rise">
          <SpatialQuantityEngine />
        </div>
      )}
      {withDemo && tool.demo === "exv" && (
        <div className={styles.demo} data-reveal="rise">
          <ExcavationDemo compact />
        </div>
      )}

      <div className={styles.more}>
        <Link href={`/tools/${tool.slug}`} className="link-line">
          More about this tool <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
