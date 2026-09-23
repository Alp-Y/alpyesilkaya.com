export const dynamic = "force-static";

import type { MetadataRoute } from "next";
import { getCaseStudies, getTools } from "@/lib/content";
import { site } from "@/site.config";

/**
 * /sitemap.xml — generated at build time. New tools and case studies in
 * /content are added automatically; nothing to maintain by hand.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({ url: `${site.url}${path}`, priority });
  return [
    page("", 1),
    page("/tools", 0.8),
    page("/case-studies", 0.8),
    page("/about", 0.6),
    ...getTools().map((t) => page(`/tools/${t.slug}`, 0.7)),
    // Placeholder case studies stay out of search results until they are real
    ...getCaseStudies()
      .filter((c) => !c.placeholder)
      .map((c) => page(`/case-studies/${c.slug}`, 0.7)),
  ];
}
