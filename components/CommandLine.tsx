/**
 * CAD COMMAND LINE — bottom of the hero, beside the UCS icon.
 * Behaviour lives in lib/effects.ts (initCommandLine) and calls the same
 * workspace actions as the toolbar and the ViewCube (lib/workspace/actions.ts).
 * Press "/" anywhere to start typing, or click a suggested command.
 * Type a section name (TOOLS, CASES, ABOUT, CONTACT…) to go there; PARTY for confetti.
 */
import styles from "./CommandLine.module.css";

export default function CommandLine({ className = "" }: { className?: string }) {
  return (
    <form className={`${styles.cmd} ${className}`} data-cmd data-cursor="text">
      <div className={styles.history} data-cmd-history aria-live="polite">
        <p data-cmd-line="Command: _OPEN alpyesilkaya.dwg">Command: _OPEN alpyesilkaya.dwg</p>
      </div>
      <label className={styles.prompt}>
        <span className={styles.caret} aria-hidden="true">
          Command:
        </span>
        <span className="sr-only">Command line. Type a command such as TOP, ANALYSIS, TOOLS, DEMO or HELP, then press Enter.</span>
        <span className={styles.idleCaret} aria-hidden="true" />
        <input
          className={styles.input}
          data-cmd-input
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="e.g. TOOLS or HELP"
        />
        <kbd className={styles.key} aria-hidden="true" title="Press / to type">
          /
        </kbd>
      </label>
      {/* Suggested commands — click to run (the same as typing them) */}
      <div className={styles.chips} aria-label="Suggested commands">
        {["TOOLS", "EXCAVATION", "CASES", "ABOUT", "CONTACT", "ISO", "HELP", "PARTY"].map((c) => (
          <button key={c} type="button" data-cmd-run={c} data-hud={`RUN|${c}`}>
            {c}
          </button>
        ))}
      </div>
    </form>
  );
}
