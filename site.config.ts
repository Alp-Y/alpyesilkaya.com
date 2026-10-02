/**
 * SITE CONFIG
 * ------------------------------------------------------------------
 * Your personal details live here, in one place. Change a value here
 * and it updates everywhere on the site (header, contact, footer…).
 *
 * Anything marked TODO is a placeholder you should replace.
 */

/**
 * The photos in the homepage About section (files in /public/images/), in order.
 * One shows at a time, with "Fig. 01", "Fig. 02"… tabs above the frame to switch.
 * To add one: put the file in /public/images/ and add an entry here.
 *   focus   which part stays in the frame when the photo is cropped (CSS object-position)
 *   aspect  a frame in another shape than the default 4 / 5 (e.g. "4 / 3" for a wide photo)
 */
const aboutPhotos = [
  {
    src: "/images/about-coast.jpg",
    alt: "Alp Yesilkaya sitting on a rock by the sea, with a small island behind",
    caption: "", // the tab above the frame already says which figure it is
    focus: "50% 38%",
    width: 1137,
    height: 1567,
    isPlaceholder: false,
  },
  {
    src: "/images/about-mountain.jpg",
    alt: "Alp Yesilkaya standing on a rock in front of a mountain, under a dark sky",
    caption: "",
    // the frame is a little shorter than the photo: keep the bottom (Alp), trim the sky
    focus: "50% 100%",
    width: 1400,
    height: 2100,
    isPlaceholder: false,
  },
  {
    src: "/images/about-seaside.jpg",
    alt: "Alp Yesilkaya sitting on a stone wall above the sea, between two bicycles, with a small island behind",
    caption: "",
    // a landscape frame in the photo's own shape, so nothing is cropped: the island stays in
    aspect: "4 / 3",
    width: 1760,
    height: 1320,
    isPlaceholder: false,
  },
  {
    src: "/images/about-climb.jpg",
    alt: "Alp Yesilkaya in a climbing harness, looking up, among bare trees",
    caption: "",
    focus: "50% 30%",
    width: 771,
    height: 961,
    isPlaceholder: false,
  },
] as const;

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

  /** The first About photo: also the picture given to search engines. */
  portrait: aboutPhotos[0],
  /** All the About photos, in order (see aboutPhotos at the top of this file). */
  aboutPhotos,

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
