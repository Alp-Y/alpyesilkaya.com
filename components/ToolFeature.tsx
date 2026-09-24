import Link from "next/link";
import type { Tool } from "@/lib/content";
import { pad } from "@/lib/content";
import SqeGlyph from "./sqe/SqeGlyph";
import ExvGlyph from "./excavation/ExvGlyph";
import SqePreview from "./previews/SqePreview";
import ExvPreview from "./previews/ExvPreview";
import CmpGlyph from "./compare/CmpGlyph";
import CmpPreview from "./previews/CmpPreview";
import styles from "./ToolFeature.module.css";

/**
 * A tool on the homepage and /tools: heading + mark, the concept in one
 * line, and a looping preview of its demonstration. The preview is a link:
 * the interactive tool lives on the tool's own page.
 */
export default function ToolFeature({ tool, index }: { tool: Tool; index: number }) {
  const href = `/tools/${tool.slug}`;
  return (
    <article className={styles.feature}>
      <div className={styles.head}>
        <Link href={`/tools/${tool.slug}`} className={styles.heading} data-play data-observe>
          {tool.demo === "sqe" && <SqeGlyph className={styles.glyph} />}
          {tool.demo === "exv" && <ExvGlyph className={styles.glyph} />}
          {tool.demo === "cmp" && <CmpGlyph className={styles.glyph} />}
          <span className={styles.headingText}>
            <span className="mono">
              <span className="accent">T-{pad(index + 1)}</span>
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

      {tool.demo === "sqe" && (
        <div className={styles.demo} data-reveal="rise">
          <SqePreview href={href} title={tool.title} />
        </div>
      )}
      {tool.demo === "exv" && (
        <div className={styles.demo} data-reveal="rise">
          <ExvPreview href={href} title={tool.title} />
        </div>
      )}
      {tool.demo === "cmp" && (
        <div className={styles.demo} data-reveal="rise">
          <CmpPreview href={href} title={tool.title} />
        </div>
      )}
      {!tool.demo && (
        <div className={styles.more}>
          <Link href={href} className="link-line">
            More about this tool <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </article>
  );
}
