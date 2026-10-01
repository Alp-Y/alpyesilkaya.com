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
  process: ["Civil Engineering", "Automation", "PMP®"],

  /** One-sentence positioning statement shown in the hero. */
  statement: "I’m a civil engineer building engineering software tools with AI.",

  /** Used for search engines and link previews. */
  description:
    "Civil engineer building engineering tools with AI to automate workflows: CAD geometry, survey data and quantities.",

  email: "alpyesilkaya.dev@gmail.com",
  location: "Riyadh, KSA",

  links: {
    github: "https://github.com/Alp-Y",
    linkedin: "https://www.linkedin.com/in/alpyesilkaya/",
  },

  /** The portrait in the homepage About section (in /public/images/). */
  portrait: {
    // cut out (transparent background), cropped above the open shirt, edges fading into the grid
    src: "/images/alp.png",
    alt: "Portrait of Alp Yesilkaya",
    caption: "alp.png",
    selected: "Engineer · 1 selected",
    // the frame takes the photo's own shape: nothing is cropped
    aspect: "741 / 801",
    width: 741,
    height: 801,
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
