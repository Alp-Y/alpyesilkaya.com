import Link from "next/link";
import type { Tool } from "@/lib/content";
import { pad } from "@/lib/content";
import SqeGlyph from "./sqe/SqeGlyph";
import ExvGlyph from "./excavation/ExvGlyph";
import CmpGlyph from "./compare/CmpGlyph";
import SqePreview from "./previews/SqePreview";
import ExvPreview from "./previews/ExvPreview";
import CmpPreview from "./previews/CmpPreview";
import styles from "./ToolFeature.module.css";

/**
 * One tool in the tools list (homepage and /tools): the name, the idea in a
 * line, and a small live version of its demonstration beside it.
 * The small version is there to be handled (drag to spin, zoom); the one
 * thing that navigates is the "Open the interactive tool" button, where the
 * full tool lives.
 */
export default function ToolFeature({ tool, index }: { tool: Tool; index: number }) {
  const href = `/tools/${tool.slug}`;
  return (
    <article className={styles.item} data-play data-observe aria-labelledby={`tool-${tool.slug}`}>
      <div className={styles.heading}>
        {tool.demo === "sqe" && <SqeGlyph className={styles.glyph} />}
        {tool.demo === "exv" && <ExvGlyph className={styles.glyph} />}
        {tool.demo === "cmp" && <CmpGlyph className={styles.glyph} />}
        <span className={styles.headingText}>
          <span className="mono accent">T-{pad(index + 1)}</span>
          <h3 className={styles.title} id={`tool-${tool.slug}`}>
            {tool.title}
          </h3>
        </span>
      </div>

      <p className={styles.lead} data-cursor="text">
        {tool.summary}
      </p>

      <div className={styles.open}>
        <Link href={href} className={styles.openButton}>
          Open the interactive tool <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>

      {tool.demo && (
        <div className={styles.demo}>
          {tool.demo === "sqe" && <SqePreview title={tool.title} />}
          {tool.demo === "exv" && <ExvPreview title={tool.title} />}
          {tool.demo === "cmp" && <CmpPreview title={tool.title} />}
        </div>
      )}
    </article>
  );
}
