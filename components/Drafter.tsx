import styles from "./Drafter.module.css";

/**
 * Markup for the drafter: two CAD cursors (green and teal) that draw the page
 * into place side by side as it scrolls into view (see lib/workspace/drafter.ts).
 * Rendered once in the layout; the behaviour is attached on the client.
 */
export default function Drafter() {
  return (
    <>
      <div className={styles.root} data-drafter aria-hidden="true">
        {/* fast scrolling: the scan line of a regeneration */}
        <div className={styles.regen} data-dr-regen>
          <span>REGEN</span>
        </div>
        {/* sketch geometry drawn by a component's own script (the hero model) */}
        <svg className={styles.sketch} data-dr-sketch />
        {/* two cursors, each with its own rubber band: they draw side by side */}
        {[0, 1].map((n) => (
          <div key={`band-${n}`} className={styles.band} data-dr-band data-n={n} data-on="false" />
        ))}
        {[0, 1].map((n) => (
          <div key={`cursor-${n}`} className={styles.cursor} data-dr-cursor data-n={n} data-on="false" data-tool="cross">
            <span className={styles.plus} />
            <span className={styles.box} />
            <span className={styles.caret} />
            <span className={styles.tag}>
              <b data-dr-cmd />
              <span data-dr-val />
            </span>
          </div>
        ))}
      </div>
      {/* pick points, hatches and ticks left on the sheet for a moment (page coordinates) */}
      <div className={styles.marks} data-dr-marks aria-hidden="true" />
    </>
  );
}
