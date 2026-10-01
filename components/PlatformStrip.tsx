import { PLATFORMS, platformSlug } from "@/lib/platforms";
import styles from "./PlatformStrip.module.css";

/**
 * Under the Tools heading: the platforms with tools (each a link down to its
 * group, with how many tools it has) and the platforms still to come
 * (lib/platforms.ts).
 */
export default function PlatformStrip({ counts }: { counts: Record<string, number> }) {
  const ready = PLATFORMS.filter((p) => p.ready && counts[p.short]);
  const later = PLATFORMS.filter((p) => !p.ready);
  return (
    <div className={styles.strip} data-reveal="rise" style={{ "--delay": "220ms" } as React.CSSProperties}>
      {ready.map((p) => (
        <a key={p.name} href={`#tools-${platformSlug(p.short)}`} className={styles.ready}>
          <i aria-hidden="true" />
          {p.name}
          <b className="num">{counts[p.short]}</b>
        </a>
      ))}
      {later.length > 0 && (
        <span className={styles.later}>
          <em>Coming soon</em>
          {later.map((p) => (
            <span key={p.name}>{p.name}</span>
          ))}
        </span>
      )}
    </div>
  );
}
