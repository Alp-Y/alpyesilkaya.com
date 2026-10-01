import type { Metadata } from "next";
import { site } from "@/site.config";

/**
 * SEO — how every page appears outside the site: the browser tab, Google's
 * result and the preview card when a link is shared (LinkedIn, WhatsApp,
 * Slack…). One place, so every page gets all three right.
 *
 *   Tab / Google title   "<Page> · Alp Yesilkaya"   (the page name first, so a
 *                         narrow tab still says which page it is)
 *   Home title           "Alp Yesilkaya · Civil Engineer"
 */
export const SEP = " · ";
export const HOME_TITLE = `${site.name}${SEP}${site.role}`;

const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: `${site.name}${SEP}${site.role}` };

/** Metadata for an inner page: its own title, description and canonical address, carried into the share card. */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = path.endsWith("/") ? path : `${path}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      locale: "en_GB",
      title: `${title}${SEP}${site.name}`,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: `${title}${SEP}${site.name}`, description, images: [OG_IMAGE.url] },
  };
}

/** The root defaults: the home page's title and card, and the "<Page> · Alp Yesilkaya" pattern for the rest. */
export const rootMeta: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: HOME_TITLE, template: `%s${SEP}${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    locale: "en_GB",
    title: HOME_TITLE,
    description: site.description,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: site.description, images: [OG_IMAGE.url] },
  formatDetection: { telephone: false, email: false, address: false },
};

/**
 * Structured data (JSON-LD) for Google: the site's name (shown above the
 * result instead of the bare domain) and who it belongs to, linked to the
 * same person on LinkedIn and GitHub.
 */
export function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: `${site.url}/`,
        name: site.name,
        alternateName: site.domain,
        inLanguage: "en",
        publisher: { "@id": `${site.url}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${site.url}/#person`,
        name: site.name,
        url: `${site.url}/`,
        jobTitle: site.role,
        description: site.description,
        image: `${site.url}${site.portrait.src}`,
        sameAs: [site.links.linkedin, site.links.github],
        knowsAbout: ["Civil engineering", "Construction project management", "Civil 3D", "AutoCAD", "Engineering automation"],
      },
    ],
  };
}
