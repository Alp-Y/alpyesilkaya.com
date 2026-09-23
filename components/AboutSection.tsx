import Link from "next/link";
import { getPage } from "@/lib/content";
import { site } from "@/site.config";
import Portrait from "./Portrait";
import PropertiesPalette from "./PropertiesPalette";
import styles from "./AboutSection.module.css";

/** About (homepage version). Text comes from /content/about.md. */
export default function AboutSection() {
  const { data } = getPage("about");
  const intro = String(data.intro ?? "");
  const short = String(data.short ?? "");
  const properties = Array.isArray(data.properties) ? data.properties : [];

  return (
    <section className={styles.section} id="about" data-section="about" data-layer="04-ABOUT" aria-labelledby="about-title">
      <div className="container">
        <div className={styles.annotation}>
          <span className="mono" data-reveal="rise">
            <span className="accent">04</span> — About
          </span>
          <span className={styles.rule} data-reveal="draw" />
        </div>

        <div className={styles.grid}>
          <div className={styles.media}>
            <Portrait />
          </div>

          <div className={styles.text}>
            <h2 id="about-title" className={styles.intro} data-reveal="lines">
              {splitIntro(intro).map((line, i) => (
                <span key={line} className="line" style={{ "--l": i } as React.CSSProperties}>
                  <span>{line}</span>
                </span>
              ))}
            </h2>
            {short && (
              <p className={styles.short} data-reveal="rise" style={{ "--delay": "200ms" } as React.CSSProperties}>
                {short}
              </p>
            )}

            <PropertiesPalette rows={properties} selection={`${site.name.toUpperCase().replace(" ", "_")} (Engineer)`} />

            <div data-reveal="rise" className={styles.more}>
              <Link href="/about" className="link-line">
                More about me <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Split the intro into lines at sentence ends, for the line reveal. */
function splitIntro(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean);
  return parts && parts.length ? parts : [text];
}
