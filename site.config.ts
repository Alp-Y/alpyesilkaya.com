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

  /** The photo in the homepage About section (in /public/images/). Also the picture given to search engines. */
  portrait: {
    src: "/images/about-mountain.jpg",
    alt: "Alp Yesilkaya standing on a rock in front of a mountain, under a dark sky",
    caption: "Fig. 01",
    // the cursor builds this photo like a drawing (outlines in components/photoBuild/geometry.ts);
    // remove this line and the photo just appears
    build: "mountain",
    // the frame is a little shorter than the photo: the bottom (Alp, the peak) stays, some sky is trimmed
    focus: "50% 100%",
    width: 1400,
    height: 2100,
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
