import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getTools } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import ToolList from "@/components/ToolList";
import styles from "../inner.module.css";

export const metadata: Metadata = pageMeta({
  title: "Tools",
  path: "/tools",
  description: "Engineering software tools for Civil 3D and the desktop, each with a live demonstration you can try in the browser.",
});

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
