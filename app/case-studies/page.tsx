import type { Metadata } from "next";
import { getCaseStudies } from "@/lib/content";
import PageHeader from "@/components/PageHeader";
import CaseRegister from "@/components/CaseRegister";
import styles from "../inner.module.css";

export const metadata: Metadata = {
  title: "Case Studies",
  alternates: { canonical: "/case-studies" },
  description: "Engineering and automation case studies: the problem, the approach, and the result.",
};

export default function CaseStudiesPage() {
  const cases = getCaseStudies();
  return (
    <>
      <PageHeader
        layer="03-CASE-STUDIES"
        crumbs={[{ label: "Case Studies" }]}
        title={["How I solved it."]}
        intro="Engineering problems from real projects: what was going wrong, what I built or changed, and what it achieved."
      />
      <section className={styles.section}>
        <div className="container">
          <CaseRegister cases={cases} />
        </div>
      </section>
    </>
  );
}
