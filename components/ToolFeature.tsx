import Link from "next/link";
import type { Tool } from "@/lib/content";
import { pad } from "@/lib/content";
import SqeGlyph from "./sqe/SqeGlyph";
import ExvGlyph from "./excavation/ExvGlyph";
import CmpGlyph from "./compare/CmpGlyph";
import CtmGlyph from "./terminal/CtmGlyph";
import ClmGlyph from "./claims/ClmGlyph";
import OfcGlyph from "./office/OfcGlyph";
import SqePreview from "./previews/SqePreview";
import ExvPreview from "./previews/ExvPreview";
import CmpPreview from "./previews/CmpPreview";
import CtmPreview from "./previews/CtmPreview";
import ClmPreview from "./previews/ClmPreview";
import OfcPreview from "./previews/OfcPreview";
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
    <article className={styles.item} data-play data-reveal="rise" aria-labelledby={`tool-${tool.slug}`}>
      <div className={styles.heading}>
        {tool.demo === "sqe" && <SqeGlyph className={styles.glyph} />}
        {tool.demo === "exv" && <ExvGlyph className={styles.glyph} />}
        {tool.demo === "cmp" && <CmpGlyph className={styles.glyph} />}
        {tool.demo === "ctm" && <CtmGlyph className={styles.glyph} />}
        {tool.demo === "clm" && <ClmGlyph className={styles.glyph} />}
        {tool.demo === "ofc" && <OfcGlyph className={styles.glyph} />}
        <span className={styles.headingText}>
          <span className="mono">
            <span className="accent">T-{pad(index + 1)}</span>
            {tool.platform && <span className={styles.platform}> / {tool.platform}</span>}
          </span>
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
          {tool.demo === "ctm" && <CtmPreview title={tool.title} />}
          {tool.demo === "clm" && <ClmPreview title={tool.title} />}
          {tool.demo === "ofc" && <OfcPreview title={tool.title} />}
        </div>
      )}
    </article>
  );
}
