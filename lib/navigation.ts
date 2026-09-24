import { nav } from "@/site.config";
import { getCaseStudies } from "@/lib/content";

/**
 * The navigation as it should be shown right now: Case Studies is left out
 * while every case study is still a placeholder. Runs at build time.
 */
export function visibleNav() {
  const hasCases = getCaseStudies().some((c) => !c.placeholder);
  return nav.filter((item) => item.section !== "case-studies" || hasCases);
}
