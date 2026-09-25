import { site } from "@/site.config";
import CommandLine from "./CommandLine";
import DimensionChain from "./DimensionChain";
import UcsIcon from "./UcsIcon";
import ViewportToolbar from "./ViewportToolbar";
import InteractiveViewCube from "./viewcube/InteractiveViewCube";
import EarthworksModel from "./earthworks/EarthworksModel";
import styles from "./Hero.module.css";

/**
 * HERO — model space.
 * A CAD space (`data-cad-space`): the site-wide CAD cursor and HUD work
 * here, drawing coordinates are measured from the UCS icon (bottom-left).
 * The viewport toolbar, the ViewCube and the command line all drive the
 * same workspace state; the earthworks model follows it.
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
          Sheet 01 / 05 <span className={styles.hudSep}>·</span> Rev {site.revision.code}
        </span>
      </div>

      <div className={`container ${styles.content}`} data-hero-exit>
        <h1 id="hero-title" className={styles.title} data-reveal="lines" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <span className="line">
            <span>{first}</span>
          </span>
          <span className="line" style={{ "--l": 1 } as React.CSSProperties}>
            <span>{rest.join(" ")}</span>
          </span>
        </h1>

        <DimensionChain labels={site.process} delay={550} className={styles.chain} />

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
              Send me a brief <span className="arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* Earthworks model — follows the ViewCube and the display mode */}
      <div className={styles.modelWrap} data-hero-exit data-reveal="rise" style={{ "--delay": "650ms" } as React.CSSProperties}>
        <EarthworksModel className={styles.model} />
      </div>

      {/* UCS icon (the origin of the hero's drawing coordinates) + command line */}
      <div className={`container ${styles.base}`} data-hero-exit>
        {/* Scale bar: bottom-right corner of the sheet, measured from the model (EarthworksModel sets it) */}
        <div className={styles.scaleBar} data-scale-bar data-overlay aria-hidden="true">
          <span className={styles.sbBar}>
            <i />
            <i />
          </span>
          <span className={styles.sbLabels}>
            <b>0</b>
            <b data-sb-mid>10</b>
            <b data-sb-end>20 m</b>
          </span>
        </div>

        {/* Builds itself with the rest of the interface: origin, then the X, Y, Z axes */}
        <div className={styles.ucsWrap} data-overlay data-reveal="ucs" style={{ "--delay": "950ms" } as React.CSSProperties}>
          <UcsIcon className={styles.ucs} />
          <span className={styles.origin} data-cad-origin aria-hidden="true" />
        </div>
        <div className={styles.cmdWrap} data-reveal="rise" style={{ "--delay": "1150ms" } as React.CSSProperties}>
          <CommandLine />
        </div>
      </div>
    </section>
  );
}
