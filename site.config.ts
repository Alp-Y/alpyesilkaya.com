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
  /** The line under the name in the hero, read left to right. */
  process: ["Civil Engineering", "BIM", "Software Automation"],

  /** One-sentence positioning statement shown in the hero. */
  statement: "I’m a civil engineer building engineering tools that automate everyday workflows.",

  /** Used for search engines and link previews. */
  description:
    "Civil engineer building engineering tools that automate everyday workflows: CAD geometry, survey data and quantities.",

  email: "alpyesilkaya.dev@gmail.com",
  location: "", // TODO: e.g. "Istanbul, Türkiye" — hidden while empty

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
