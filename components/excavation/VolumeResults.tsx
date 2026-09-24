"use client";

import { useEffect, useRef, useState } from "react";
import type { EngineResult } from "@/lib/excavation/engine";
import { num, quantity } from "@/lib/format";
import { reducedMotion } from "@/lib/workspace/pointer";
import styles from "./excavation.module.css";

/**
 * 03 — CALCULATE. Excavation volume first, a few supporting values after.
 * The volume counts up to the calculated value when it changes.
 */
export default function VolumeResults({ result, calculating }: { result: EngineResult | null; calculating: boolean }) {
  const c = result?.comparison;
  const shown = useCountUp(c?.cut ?? 0);

  return (
    <div className={styles.results} aria-busy={calculating}>
      <p className={styles.volume} aria-live="polite">
        <span className="num">{c ? num(shown) : "—"}</span> <em>m³</em>
      </p>
      <p className={styles.volumeLabel}>Excavation volume</p>

      <dl className={styles.kpis}>
        <div>
          <dt>Area in cut</dt>
          <dd className="num">{c ? quantity(c.cutArea, "m²") : "—"}</dd>
        </div>
        <div>
          <dt>Average depth</dt>
          <dd className="num">{c ? quantity(c.averageDepth, "m") : "—"}</dd>
        </div>
        <div>
          <dt>Maximum depth</dt>
          <dd className="num">{c ? quantity(c.maxDepth, "m") : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (reducedMotion() || start === target) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setValue(start + (target - start) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}
