import { site } from "@/site.config";
import DimensionChain from "./DimensionChain";
import UcsIcon from "./UcsIcon";
import ViewportToolbar from "./ViewportToolbar";
import InteractiveViewCube from "./viewcube/InteractiveViewCube";
import styles from "./Hero.module.css";

/**
 * HERO — model space.
 * A CAD space (`data-cad-space`): the site-wide CAD cursor and HUD work
 * here, drawing coordinates are measured from the UCS icon (bottom-left).
 * The viewport toolbar, the ViewCube and the command line all drive the
 * same workspace state.
 */
export default function Hero() {
  const [first, ...rest] = site.name.split(" ");

  return (
    <section
      className={styles.hero}
      data-section="intro"
      data-layer="0-INTRO"
      data-cad-space="hero"
      data-hero
      aria-labelledby="hero-title"
    >
      {/* One soft light source; the grid itself is the site-wide workspace grid */}
      <div className={styles.light} aria-hidden="true" />

      {/* Navigation cube — interactive 3D (falls back to the static drawing) */}
      <div className={styles.viewcubeWrap} data-reveal="rise" style={{ "--delay": "900ms" } as React.CSSProperties}>
        <InteractiveViewCube className={styles.viewcube} />
      </div>

      {/* Viewport controls + sheet annotation */}
      <div className={`container ${styles.hud}`} data-hero-exit>
        <div data-reveal="rise" style={{ "--delay": "700ms" } as React.CSSProperties}>
          <ViewportToolbar />
        </div>
        <span className="mono" data-overlay data-reveal="rise" style={{ "--delay": "800ms" } as React.CSSProperties}>
          Sheet 01 / 05 <span className={styles.hudSep}>—</span> Rev {site.revision.code}
        </span>
      </div>

      <div className={`container ${styles.content}`} data-hero-exit>
        <p className={`mono ${styles.eyebrow}`} data-reveal="rise">
          <span className={styles.eyebrowDot} aria-hidden="true" />
          {site.role} — Software &amp; Automation
        </p>

        <h1 id="hero-title" className={styles.title} data-reveal="lines" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <span className="line">
            <span>{first}</span>
          </span>
          <span className="line" style={{ "--l": 1 } as React.CSSProperties}>
            <span>{rest.join(" ")}</span>
          </span>
        </h1>

        <DimensionChain labels={site.disciplines} delay={550} className={styles.chain} />

        <div className={styles.lower}>
          <p
            className={styles.statement}
            data-cursor="text"
            data-reveal="rise"
            style={{ "--delay": "900ms" } as React.CSSProperties}
          >
            {site.statement}
          </p>

          <div className={styles.actions} data-reveal="rise" style={{ "--delay": "1020ms" } as React.CSSProperties}>
            <a href="#tools" className={styles.primary} data-hud="GO TO|02 · TOOLS">
              View my work <span className="arrow arrow-down" aria-hidden="true">↓</span>
            </a>
            <a href="#contact" className="link-line" data-hud="GO TO|05 · CONTACT">
              Get in touch <span className="arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* Command line — the same actions as the toolbar and ViewCube */}
      <div className={`container ${styles.cmdWrap}`} data-hero-exit>
        <div className={styles.ucsWrap} data-overlay>
          <UcsIcon className={styles.ucs} />
          {/* The UCS origin is also the origin of the hero's drawing coordinates */}
          <span className={styles.origin} data-cad-origin aria-hidden="true" />
        </div>
        <form className={styles.cmd} data-cmd data-reveal="rise" style={{ "--delay": "1150ms" } as React.CSSProperties}>
          <div className={styles.cmdHistory} data-cmd-history aria-live="polite">
            <p data-cmd-line="Command: _OPEN alpyesilkaya.dwg">Command: _OPEN alpyesilkaya.dwg</p>
          </div>
          <label className={styles.cmdPrompt}>
            <span className={styles.cmdCaret} aria-hidden="true">
              ›
            </span>
            <span className="sr-only">
              Command line. Type a command such as TOP, ANALYSIS, TOOLS, DEMO or HELP, then press Enter.
            </span>
            <input
              className={styles.cmdInput}
              data-cmd-input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Type a command — try HELP"
            />
          </label>
        </form>
      </div>
    </section>
  );
}
