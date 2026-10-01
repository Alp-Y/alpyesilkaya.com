import type { Metadata } from "next";
import { getTools } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import ToolList from "@/components/ToolList";
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
          <ToolList tools={tools} />
        </div>
      </section>
    </>
  );
}
