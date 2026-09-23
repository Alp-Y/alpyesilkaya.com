import type { Metadata } from "next";
import { getTools } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import ToolFeature from "@/components/ToolFeature";
import styles from "../inner.module.css";

export const metadata: Metadata = {
  title: "Tools",
  alternates: { canonical: "/tools" },
  description: "Engineering software and automation tools by Alp Yesilkaya.",
};

export default function ToolsPage() {
  const tools = getTools();
  return (
    <>
      <PageHeader
        layer="02-TOOLS"
        crumbs={[{ label: "Tools" }]}
        title={["Tools I’ve built."]}
        intro="Software for real engineering workflows. Each tool started as a real problem on a real project."
      />
      <section className={styles.section}>
        <div className="container">
          <div style={{ display: "grid", gap: "clamp(96px, 12vw, 160px)" }}>
            {tools.map((tool, i) => (
              <ToolFeature key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
