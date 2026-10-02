import styles from "./Drafter.module.css";

/**
 * Markup for the drafter: the second, green CAD cursor that draws the page
 * into place as it scrolls into view (see lib/workspace/drafter.ts).
 * Rendered once in the layout; the behaviour is attached on the client.
 */
export default function Drafter() {
  return (
    <>
      <div className={styles.root} data-drafter data-on="false" data-tool="cross" aria-hidden="true">
        {/* sketch geometry drawn by a component's own script (the hero model) */}
        <svg className={styles.sketch} data-dr-sketch />
        <div className={styles.band} data-dr-band data-on="false" />
        <div className={styles.cursor} data-dr-cursor>
          <span className={styles.plus} />
          <span className={styles.box} />
          <span className={styles.caret} />
          <span className={styles.tag}>
            <b data-dr-cmd />
            <span data-dr-val />
          </span>
        </div>
      </div>
      {/* grips and pick points left on the sheet for a moment (page coordinates) */}
      <div className={styles.marks} data-dr-marks aria-hidden="true" />
    </>
  );
}
