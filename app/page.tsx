import Link from "next/link";
import { getCaseStudies, getTools } from "@/lib/content";
import Hero from "@/components/Hero";
import Disciplines from "@/components/Disciplines";
import SectionHeader from "@/components/SectionHeader";
import ToolFeature from "@/components/ToolFeature";
import CaseRegister from "@/components/CaseRegister";
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

  return (
    <>
      <Hero />
      <Disciplines />

      <section className={styles.tools} id="tools" data-section="tools" data-layer="02-TOOLS">
        <div className="container">
          <SectionHeader
            index="02"
            label="Tools"
            meta={`${tools.length} ${tools.length === 1 ? "tool" : "tools"}`}
            title={["Tools I’ve built."]}
            intro="Software for real engineering workflows — built around CAD data, engineering metadata and quantities."
          />
          <div className={styles.toolList}>
            {tools.map((tool, i) => (
              <ToolFeature key={tool.slug} tool={tool} index={i} withDemo={!!tool.demo} />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cases} id="case-studies" data-section="case-studies" data-layer="03-CASE-STUDIES">
        <div className="container">
          <SectionHeader
            index="03"
            label="Case Studies"
            meta="Drawing register"
            title={["How I solved it."]}
            intro="Real engineering problems, the approach I took, and what changed as a result."
          />
          <CaseRegister cases={cases} />
          <div className={styles.more} data-reveal="rise">
            <Link href="/case-studies" className="link-line">
              All case studies <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <AboutSection />
      <ContactSection />
    </>
  );
}
