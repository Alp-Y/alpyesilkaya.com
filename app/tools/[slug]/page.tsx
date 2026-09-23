import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTool, getTools, pad } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import Viewport from "@/components/Viewport";
import SharedElement from "@/components/SharedElement";
import PropertiesPalette from "@/components/PropertiesPalette";
import { ArticleBody, NextItem } from "@/components/ArticleBody";
import SpatialQuantityEngine from "@/components/sqe/SpatialQuantityEngine";
import styles from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

/** Build one page per Markdown file in /content/tools at build time. */
export function generateStaticParams() {
  return getTools().map((tool) => ({ slug: tool.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  return tool ? { title: tool.title, description: tool.summary, alternates: { canonical: `/tools/${slug}` } } : {};
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tools = getTools();
  const index = tools.findIndex((t) => t.slug === slug);
  const tool = tools[index];
  if (!tool) notFound();
  const next = tools[(index + 1) % tools.length];

  const external = (url: string) => /^https?:/.test(url);
  // Only real information is shown — empty fields are skipped
  const specs = [
    tool.platform && `Platform | ${tool.platform}`,
    tool.stack.length > 0 && `Stack | ${tool.stack.join(" · ")}`,
    tool.status && `Status | ${tool.status}`,
    tool.version && `Version | ${tool.version}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        layer={`T-${pad(index + 1)}`}
        crumbs={[{ label: "Tools", href: "/tools" }, { label: tool.title }]}
        title={[tool.title]}
        intro={tool.summary}
        aside={
          <>
            {specs.length > 0 && <PropertiesPalette title="Tool properties" rows={specs} />}
            {(tool.download || tool.docs) && (
              <div className={styles.actions}>
                {tool.download && (
                  <a className={styles.button} href={tool.download} {...(external(tool.download) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    Download <span className="arrow" aria-hidden="true">↓</span>
                  </a>
                )}
                {tool.docs && (
                  <a className={styles.button} href={tool.docs}>
                    Documentation <span className="arrow" aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            )}
          </>
        }
      >
        <div className={styles.kicker} data-reveal="rise">
          <span className="mono">
            <span className="accent">T-{pad(index + 1)}</span>
            {tool.platform ? ` / ${tool.platform}` : " / Tool"}
          </span>
          {tool.placeholder && <span className="placeholder-tag">Placeholder content</span>}
        </div>
      </PageHeader>

      {tool.demo === "sqe" ? (
        <div className={styles.hero}>
          <div className="container">
            <SpatialQuantityEngine />
          </div>
        </div>
      ) : (
        tool.image && (
          <div className={styles.hero}>
            <div className="container">
              <SharedElement name={`tool-${tool.slug}`}>
                <Viewport
                  src={tool.image}
                  alt={tool.imageAlt}
                  label={`VP-${pad(index + 1)}`}
                  view={tool.platform || "Top"}
                  priority
                  sizes="(min-width: 1400px) 1360px, 100vw"
                />
              </SharedElement>
            </div>
          </div>
        )
      )}

      <ArticleBody html={tool.html} headings={tool.headings} />

      {next && next.slug !== tool.slug && <NextItem label="Next tool" title={next.title} href={`/tools/${next.slug}`} />}
    </>
  );
}
