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
  process: ["Civil Engineering", "Design", "Automation", "PMP®"],

  /** One-sentence positioning statement shown in the hero. */
  statement: "I’m a civil engineer building engineering software tools.",

  /** Used for search engines and link previews. */
  description:
    "Civil engineer and PMP building engineering software tools for Civil 3D and the desktop: quantities, survey data, CAD drawings and claim documents.",

  email: "alpyesilkaya.dev@gmail.com",
  location: "Riyadh, KSA",

  links: {
    github: "https://github.com/Alp-Y",
    linkedin: "https://www.linkedin.com/in/alpyesilkaya/",
  },

  /** The portrait in the homepage About section (in /public/images/). */
  portrait: {
    // (the at-work photo is still in /public/images/about-at-work.jpg if you want it back)
    src: "/images/about-seaside.jpg",
    alt: "Alp Yesilkaya sitting on a stone wall above the sea, between two bicycles, with a small island behind",
    caption: "Fig. 01 / Out of office",
    // a landscape frame in the photo's own shape, so nothing is cropped: the island stays in
    aspect: "4 / 3",
    width: 1760,
    height: 1320,
    isPlaceholder: false,
  },

  /** Revision shown in the footer title block. Bump it when you publish changes. */
  revision: { code: "A", date: "2026-09" },
} as const;

/**
 * Main navigation. `href` values starting with "/#" scroll to a homepage section.
 * The numbers shown beside them come from lib/sections.ts, so they always match
 * the "02 / Tools" labels on the page and run in order. Case Studies only
 * appears once there is a real (non-placeholder) case study, so the menu never
 * sends a visitor to an empty "coming soon".
 */
export const nav = [
  { label: "How I work", href: "/#approach", section: "approach" },
  { label: "Tools", href: "/#tools", section: "tools" },
  { label: "Case Studies", href: "/#case-studies", section: "case-studies" },
  { label: "About", href: "/#about", section: "about" },
  { label: "Contact", href: "/#contact", section: "contact" },
] as const;
