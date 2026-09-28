import { PLATFORMS } from "@/lib/platforms";
import styles from "./PlatformStrip.module.css";

/**
 * Under the Tools heading: which platform the tools below are for, and
 * which platforms are still to come (lib/platforms.ts).
 */
export default function PlatformStrip({ count }: { count: number }) {
  const ready = PLATFORMS.filter((p) => p.ready);
  const later = PLATFORMS.filter((p) => !p.ready);
  return (
    <div className={styles.strip} data-reveal="rise" style={{ "--delay": "220ms" } as React.CSSProperties}>
      {ready.map((p) => (
        <span key={p.name} className={styles.ready}>
          <i aria-hidden="true" />
          {p.name}
          <b className="num">{count}</b>
        </span>
      ))}
      <span className={styles.later}>
        <em>Coming soon</em>
        {later.map((p) => (
          <span key={p.name}>{p.name}</span>
        ))}
      </span>
    </div>
  );
}
