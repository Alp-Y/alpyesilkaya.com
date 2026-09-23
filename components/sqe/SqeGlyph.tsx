"use client";

import { useSqe } from "@/lib/sqe/store";
import { useWorkspace } from "@/lib/workspace/store";
import styles from "./SqeGlyph.module.css";

/**
 * The Spatial Quantity Engine's mark — the product concept in one symbol:
 *   boundary → metadata tag → work geometry → intersection → quantity
 *
 * It reflects the demo's real state (status-driven, not decoration):
 *   no drawing      boundary outline only, faint
 *   drawing loaded  boundary solid
 *   areas assigned  metadata tag attached
 *   analysis mode   work geometry + highlighted intersection + quantity
 * Hovering the heading it belongs to plays the whole sequence once.
 */
export default function SqeGlyph({ className = "" }: { className?: string }) {
  const loaded = useSqe((s) => !!s.project);
  const assigned = useSqe((s) => !!s.project && s.project.boundaries.every((b) => b.meta));
  const analysis = useWorkspace((s) => s.viewport.displayMode === "analysis");
  const stage = !loaded ? 0 : analysis ? 3 : assigned ? 2 : 1;

  return (
    <svg className={`${styles.glyph} ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true" data-stage={stage}>
      {/* boundary */}
      <rect className={styles.boundary} x="6" y="12" width="24" height="24" pathLength={1} />
      {/* metadata tag attached to the boundary */}
      <g className={styles.tag}>
        <path d="M30 12h9l3 3-3 3h-9z" />
        <circle cx="33" cy="15" r="0.9" />
      </g>
      {/* work geometry crossing the boundary */}
      <rect className={styles.work} x="18" y="22" width="22" height="16" pathLength={1} />
      {/* the intersection: what gets measured */}
      <rect className={styles.hit} x="18" y="22" width="12" height="14" />
      {/* quantity */}
      <path className={styles.dim} d="M18 42h12M18 40.5v3M30 40.5v3" pathLength={1} />
    </svg>
  );
}
