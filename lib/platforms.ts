/**
 * PLATFORMS — what the tools are built for, in the order they are listed.
 * Platforms with tools on the site are `ready`; the others are shown as coming
 * soon (hero and Tools section). When one is ready, set `ready: true` and give
 * its tools `platform:` (its `short` name) in content/tools/*.md.
 */
export const PLATFORMS: { name: string; short: string; ready: boolean }[] = [
  { name: "Civil 3D Tools", short: "Civil 3D", ready: true },
  { name: "Desktop App", short: "Desktop App", ready: true },
  { name: "AutoCAD Tools", short: "AutoCAD", ready: false },
  { name: "Revit Tools", short: "Revit", ready: false },
];

/** A short name made safe for an id ("Desktop App" → "desktop-app"). */
export const platformSlug = (short: string) => short.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
