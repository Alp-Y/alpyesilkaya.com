/**
 * PLATFORMS — what the tools are built for. Only Civil 3D has tools on the
 * site so far; the others are shown as coming soon (hero and Tools section).
 * When one is ready, set `ready: true` and give its tools `platform:` in
 * content/tools/*.md.
 */
export const PLATFORMS: { name: string; short: string; ready: boolean }[] = [
  { name: "Civil 3D Tools", short: "Civil 3D", ready: true },
  { name: "AutoCAD Tools", short: "AutoCAD", ready: false },
  { name: "Revit Tools", short: "Revit", ready: false },
  { name: "Desktop App", short: "Desktop App", ready: false },
];
