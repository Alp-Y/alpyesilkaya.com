/**
 * SITE CONFIG
 * ------------------------------------------------------------------
 * Your personal details live here, in one place. Change a value here
 * and it updates everywhere on the site (header, contact, footer…).
 *
 * Anything marked TODO is a placeholder you should replace.
 */

export const site = {
  name: "Alp Yesilkaya",
  shortName: "A. Yesilkaya",
  domain: "alpyesilkaya.com",
  url: "https://alpyesilkaya.com",

  role: "Civil Engineer",
  disciplines: ["Civil Engineering", "Software", "Automation"],

  /** One-sentence positioning statement shown in the hero. */
  statement:
    "A civil engineer building the software and automation that make infrastructure design faster, cleaner and more exact.",

  /** Used for search engines and link previews. */
  description:
    "Alp Yesilkaya — civil engineer working at the intersection of engineering, software and automation. Engineering tools, automation and case studies.",

  email: "hello@alpyesilkaya.com", // TODO: your real contact email
  location: "Location TBC", // TODO: e.g. "Istanbul, Türkiye"

  links: {
    github: "https://github.com/", // TODO: your GitHub profile URL
    linkedin: "https://www.linkedin.com/", // TODO: your LinkedIn profile URL
  },

  /**
   * Portrait shown in the About section.
   * Put your photo in /public/images/ (e.g. portrait.jpg, ~1200×1500px)
   * and change this path.
   */
  portrait: {
    src: "/images/placeholders/portrait.svg", // TODO: "/images/portrait.jpg"
    alt: "Portrait of Alp Yesilkaya",
    isPlaceholder: true, // TODO: set to false once you add your photo
  },

  /** Revision shown in the footer title block. Bump it when you publish changes. */
  revision: { code: "A", date: "2026-09" },
} as const;

/** Main navigation. `href` values starting with "/#" scroll to a homepage section. */
export const nav = [
  { label: "Tools", href: "/#tools", section: "tools" },
  { label: "Case Studies", href: "/#case-studies", section: "case-studies" },
  { label: "About", href: "/#about", section: "about" },
  { label: "Contact", href: "/#contact", section: "contact" },
] as const;
