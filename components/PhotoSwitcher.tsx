"use client";

import { useState } from "react";
import Portrait from "./Portrait";
import styles from "./PhotoSwitcher.module.css";

type Photo = NonNullable<Parameters<typeof Portrait>[0]["photo"]>;

/**
 * One photo frame with small tabs above it ("Fig. 01", "Fig. 02"…) to switch
 * between photos. Used in the About section; the photos are set in site.config.ts.
 */
export default function PhotoSwitcher({ photos }: { photos: readonly Photo[] }) {
  const [active, setActive] = useState(0);
  const label = (n: number) => `Fig. ${String(n + 1).padStart(2, "0")}`;
  return (
    <div className={styles.switcher}>
      <div className={styles.tabs} role="tablist" aria-label="Photos">
        {photos.map((p, n) => (
          <button
            key={p.src}
            type="button"
            role="tab"
            id={`photo-tab-${n}`}
            aria-selected={n === active}
            aria-controls={`photo-panel-${n}`}
            className={styles.tab}
            onClick={() => setActive(n)}
          >
            {label(n)}
          </button>
        ))}
      </div>
      {photos.map((p, n) => (
        <div key={p.src} role="tabpanel" id={`photo-panel-${n}`} aria-labelledby={`photo-tab-${n}`} className={styles.panel} hidden={n !== active}>
          <Portrait photo={p} />
        </div>
      ))}
    </div>
  );
}
