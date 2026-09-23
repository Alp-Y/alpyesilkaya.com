import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCaseStudies, getCaseStudy, pad } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import Viewport from "@/components/Viewport";
import { ArticleBody, NextItem } from "@/components/ArticleBody";
import styles from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

/** Build one page per Markdown file in /content/case-studies at build time. */
export function generateStaticParams() {
  return getCaseStudies().map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return {
    title: study.title,
    description: study.summary,
    alternates: { canonical: `/case-studies/${slug}` },
    // Placeholder pages are not indexed until they hold a real case study
    ...(study.placeholder ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const cases = getCaseStudies();
  const index = cases.findIndex((c) => c.slug === slug);
  const study = cases[index];
  if (!study) notFound();
  const next = cases[(index + 1) % cases.length];

  const facts = [
    { label: "Discipline", value: study.discipline },
    { label: "Year", value: study.year },
    { label: "Role", value: study.role },
    { label: "Tools", value: study.tools.join(" · ") },
  ].filter((f) => f.value);

  return (
    <>
      <PageHeader
        layer={`CS-${pad(index + 1)}`}
        crumbs={[{ label: "Case Studies", href: "/case-studies" }, { label: pad(index + 1) }]}
        title={[study.title]}
        intro={study.summary}
      >
        <div className={styles.kicker} data-reveal="rise">
          <span className="mono">
            <span className="accent">CS-{pad(index + 1)}</span> / {study.discipline}
          </span>
          {study.placeholder && <span className="placeholder-tag">Placeholder content</span>}
        </div>
      </PageHeader>

      <div className={styles.hero}>
        <div className="container">
          <dl className={styles.facts} data-reveal="rise">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="mono">{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>

          {study.results.length > 0 && (
            <ul className={styles.results} data-stagger>
              {study.results.map((r) => (
                <li key={r.label} className={styles.result} data-reveal="rise">
                  <span className={styles.resultValue}>{r.value}</span>
                  <span className={styles.resultLabel}>{r.label}</span>
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: "clamp(56px, 8vw, 104px)" }} data-reveal="rise">
            <Viewport
              src={study.image}
              alt={study.imageAlt}
              label={`CS-${pad(index + 1)}`}
              view="Plan"
              mode="Shaded"
              priority
              sizes="(min-width: 1400px) 1360px, 100vw"
            />
          </div>
        </div>
      </div>

      <ArticleBody html={study.html} headings={study.headings} />

      {next && next.slug !== study.slug && (
        <NextItem label="Next case study" title={next.title} href={`/case-studies/${next.slug}`} />
      )}
    </>
  );
}
