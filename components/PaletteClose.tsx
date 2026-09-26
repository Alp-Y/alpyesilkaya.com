"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PropertiesPalette.module.css";

/**
 * The palette's × : folds the palette down to its title bar, like closing a
 * palette in CAD, and turns into + to open it again.
 */
export default function PaletteClose({ title }: { title: string }) {
  const [closed, setClosed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const palette = ref.current?.closest<HTMLElement>("[data-palette]");
    if (palette) palette.dataset.closed = String(closed);
  }, [closed]);

  return (
    <button
      ref={ref}
      type="button"
      className={styles.close}
      onClick={() => setClosed((c) => !c)}
      aria-expanded={!closed}
      aria-label={closed ? `Open ${title}` : `Close ${title}`}
      data-hud={`PALETTE|${closed ? "OPEN" : "CLOSE"}`}
    >
      <span aria-hidden="true">{closed ? "+" : "×"}</span>
    </button>
  );
}
