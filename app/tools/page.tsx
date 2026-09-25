import type { Metadata } from "next";
import { getTools } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import ToolFeature from "@/components/ToolFeature";
import styles from "../inner.module.css";

export const metadata: Metadata = {
  title: "Tools",
  alternates: { canonical: "/tools" },
  description: "Engineering tools that automate everyday engineering workflows, each with a live demonstration.",
};

export default function ToolsPage() {
  const tools = getTools();
  return (
    <>
      <PageHeader
        layer="02-TOOLS"
        crumbs={[{ label: "Tools" }]}
        title={["Tools I’ve built."]}
        intro="Each one automates a specific engineering workflow."
      />
      <section className={styles.section}>
        <div className="container">
          <div style={{ display: "grid" }}>
            {tools.map((tool, i) => (
              <ToolFeature key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
