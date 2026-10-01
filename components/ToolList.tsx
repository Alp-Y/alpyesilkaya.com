import type { Tool } from "@/lib/content";
import { PLATFORMS, platformSlug } from "@/lib/platforms";
import PlatformStrip from "./PlatformStrip";
import ToolFeature from "./ToolFeature";
import styles from "./ToolList.module.css";

/**
 * The tools, grouped by the platform they are built for (Civil 3D tools,
 * then the desktop app…), in the order of lib/platforms.ts. The tool numbers
 * (T-01, T-02…) run on across the groups. Used on the homepage and /tools.
 */
export default function ToolList({ tools }: { tools: Tool[] }) {
  const groups = PLATFORMS.map((p) => ({ p, tools: tools.filter((t) => t.platform === p.short) })).filter((g) => g.tools.length > 0);
  // tools with a platform that is not in the list still show, at the end
  const known = new Set(groups.flatMap((g) => g.tools));
  const other = tools.filter((t) => !known.has(t));
  const counts = Object.fromEntries(groups.map((g) => [g.p.short, g.tools.length]));
  let n = 0;

  return (
    <>
      <PlatformStrip counts={counts} />
      {groups.map(({ p, tools: list }) => (
        <section key={p.name} className={styles.group} id={`tools-${platformSlug(p.short)}`} aria-label={p.name}>
          <h3 className={`mono ${styles.head}`} data-reveal="rise">
            <i aria-hidden="true" />
            {p.name}
            <span className={styles.rule} aria-hidden="true" />
            <span className={`num ${styles.count}`}>{String(list.length).padStart(2, "0")}</span>
          </h3>
          <div className={styles.list}>
            {list.map((tool) => (
              <ToolFeature key={tool.slug} tool={tool} index={n++} />
            ))}
          </div>
        </section>
      ))}
      {other.length > 0 && (
        <div className={styles.list}>
          {other.map((tool) => (
            <ToolFeature key={tool.slug} tool={tool} index={n++} />
          ))}
        </div>
      )}
    </>
  );
}
