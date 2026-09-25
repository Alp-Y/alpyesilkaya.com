import { nav } from "@/site.config";
import { sectionNumbers } from "@/lib/sections";

/**
 * The navigation as it should be shown right now, numbered like the sections
 * on the page: Case Studies is left out while every case study is still a
 * placeholder (and the numbers close up). Runs at build time.
 */
export function visibleNav() {
  const n = sectionNumbers();
  return nav.flatMap((item) => {
    const index = n[item.section];
    return index ? [{ ...item, index }] : [];
  });
}
