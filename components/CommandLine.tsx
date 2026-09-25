/**
 * CAD COMMAND LINE — bottom of the hero's text column, folded away by default.
 * Closed, it is one quiet line ("▮ COMMAND LINE  /"); click it or press "/"
 * anywhere and the console unfolds beneath it, the text above easing up to make room.
 * Escape or a click elsewhere folds it again.
 * Behaviour lives in lib/effects.ts (initCommandLine) and calls the same
 * workspace actions as the toolbar and the ViewCube (lib/workspace/actions.ts).
 * Type a section name (TOOLS, CASES, ABOUT, CONTACT…) to go there; PARTY for confetti.
 */
import styles from "./CommandLine.module.css";

export default function CommandLine({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.dock} ${className}`} data-cmd-dock data-open="false">
      <button type="button" className={styles.toggle} data-cmd-toggle aria-expanded="false" aria-controls="cmd-panel" data-hud="OPEN|COMMAND LINE">
        <span className={styles.toggleCaret} aria-hidden="true" />
        <span>Command line</span>
        <kbd className={styles.toggleKey} aria-hidden="true">
          /
        </kbd>
        <svg className={styles.chevron} viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={styles.panel} id="cmd-panel">
        <div className={styles.panelInner}>
          <form className={styles.cmd} data-cmd data-cursor="text">
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
              <kbd className={styles.key} aria-hidden="true" title="Esc to close">
                esc
              </kbd>
            </label>
            {/* Suggested commands — click to run (the same as typing them) */}
            <div className={styles.chips} aria-label="Suggested commands">
              {["TOOLS", "EXCAVATION", "ABOUT", "CONTACT", "ISO", "HELP", "PARTY"].map((c) => (
                <button key={c} type="button" data-cmd-run={c} data-hud={`RUN|${c}`}>
                  {c}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
