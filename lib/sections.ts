import { getCaseStudies } from "@/lib/content";

/**
 * SECTION NUMBERS — the homepage sections in order, numbered like drawing
 * sheets. Case Studies only takes a number (and a place in the menu) once
 * there is a real case study; until then the ones after it close up, so the
 * numbers always run 01, 02, 03… Runs at build time.
 */
export type SectionId = "approach" | "tools" | "case-studies" | "about" | "contact";

const ORDER: SectionId[] = ["approach", "tools", "case-studies", "about", "contact"];

export function hasCaseStudies() {
  return getCaseStudies().some((c) => !c.placeholder);
}

/** "01", "02"… per section; null for Case Studies while it is only "coming soon". */
export function sectionNumbers(): Record<SectionId, string | null> & { total: string } {
  const cases = hasCaseStudies();
  let n = 0;
  const out = {} as Record<SectionId, string | null>;
  for (const id of ORDER) out[id] = id === "case-studies" && !cases ? null : String(++n).padStart(2, "0");
  return { ...out, total: String(n).padStart(2, "0") };
}
