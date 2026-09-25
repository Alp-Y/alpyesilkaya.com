import type { Metadata } from "next";
import { getPage } from "@/lib/content";
import { site } from "@/site.config";
import PageHeader from "@/components/PageHeader";
import Portrait from "@/components/Portrait";
import PropertiesPalette, { parseExperience } from "@/components/PropertiesPalette";
import { NextItem } from "@/components/ArticleBody";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  description: `About ${site.name}: a civil engineer who builds tools for the repetitive parts of engineering work.`,
};

/** Full About page. Edit the text in /content/about.md. */
export default function AboutPage() {
  const { data, html } = getPage("about");
  const intro = String(data.intro ?? "");
  const properties = Array.isArray(data.properties) ? data.properties : [];

  return (
    <>
      <PageHeader layer="04-ABOUT" crumbs={[{ label: "About" }]} title={["About"]} intro={intro} compact />
      <section className={styles.section}>
        <div className={`container ${styles.grid}`}>
          <aside className={styles.side}>
            <Portrait priority photo={site.atWork} />
            <PropertiesPalette
              title="Engineer.properties"
              rows={properties}
              selection="Engineer (1 selected)"
              experience={parseExperience(data.experience)}
            />
          </aside>
          <div className="prose" data-reveal="rise" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>

      {/* where the story goes next, the same way the tool pages end */}
      <NextItem label="Next" title="Send me a brief" href="/#contact" />
    </>
  );
}
