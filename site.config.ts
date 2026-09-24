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
  location: "Riyadh, KSA",

  links: {
    github: "https://github.com/Alp-Y",
    linkedin: "https://www.linkedin.com/in/alpyesilkaya/",
  },

  /**
   * Photos (in /public/images/). `focus` keeps that part of the photo in
   * the frame when it is cropped (CSS object-position).
   *   portrait   the homepage About section
   *   atWork     the full About page ("More about me")
   */
  portrait: {
    src: "/images/portrait.jpg",
    alt: "Portrait of Alp Yesilkaya",
    caption: "Fig. 01 / The engineer",
    focus: "50% 30%",
    width: 684,
    height: 1087,
    isPlaceholder: false,
  },
  atWork: {
    src: "/images/about-at-work.jpg",
    alt: "Alp Yesilkaya explaining a project on a laptop to a visitor",
    caption: "Fig. 02 / At work",
    focus: "88% 40%",
    width: 1280,
    height: 1010,
    isPlaceholder: false,
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
