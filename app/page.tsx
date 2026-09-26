import Link from "next/link";
import { getCaseStudies, getTools } from "@/lib/content";
import Hero from "@/components/Hero";
import Disciplines from "@/components/Disciplines";
import SectionHeader from "@/components/SectionHeader";
import ToolFeature from "@/components/ToolFeature";
import CaseRegister from "@/components/CaseRegister";
import ToolsFilm from "@/components/film/ToolsFilm";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import styles from "./page.module.css";

/**
 * HOMEPAGE
 * Sections, in order: Hero → Disciplines → Tools → Case studies → About → Contact.
 * Tools and case studies come from the Markdown files in /content.
 */
export default function HomePage() {
  const tools = getTools();
  const cases = getCaseStudies();
  const realCases = cases.filter((c) => !c.placeholder);
  const upcoming = cases.find((c) => c.placeholder);

  return (
    <>
      <Hero />
      <Disciplines />

      <section className={styles.tools} id="tools" data-section="tools" data-layer="02-TOOLS">
        <div className="container">
          <SectionHeader
            index="02"
            label="Tools"
            title={["Tools I’ve built."]}
          />
          <ToolsFilm />
          <div className={styles.toolList} id="tools-list">
            {tools.map((tool, i) => (
              <ToolFeature key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        </div>
      </section>

      {realCases.length === 0 ? (
        /* Nothing written yet: a slim note in the page's flow, not a whole section to scroll through */
        /* It takes a section number (and a place in the menu) once there is a real one — lib/sections.ts */
        <section className={`${styles.cases} ${styles.casesSoon}`} id="case-studies" data-section="case-studies" data-layer="CASE-STUDIES" aria-label="Case studies">
          <div className={`container ${styles.soon}`} data-reveal="rise">
            <span className="mono">Case studies</span>
            <p>
              <b>Coming soon.</b> {upcoming?.summary}
            </p>
          </div>
        </section>
      ) : (
      <section className={styles.cases} id="case-studies" data-section="case-studies" data-layer="03-CASE-STUDIES">
        <div className="container">
          <SectionHeader
            index="03"
            label="Case Studies"
            title={["How I solved it."]}
          />
          <CaseRegister cases={cases} />
          {/* The link to the full register appears once there is more than one real case study */}
          {realCases.length > 1 && (
            <div className={styles.more} data-reveal="rise">
              <Link href="/case-studies" className="link-line">
                All case studies <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>
      )}

      <AboutSection />
      <ContactSection />
    </>
  );
}
