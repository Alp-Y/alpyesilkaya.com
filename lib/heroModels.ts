/**
 * HERO MODELS — what the hero viewport can show, and which one is showing.
 * Each model is a scene one of the tools is made for, with one sentence on
 * what the tool does there. Keep the sentences to what the tools really do
 * (see content/tools/*.md).
 */

export type HeroModelId = "road" | "basement" | "progress" | "areas" | "structures" | "claims" | "office";

export type HeroModel = {
  id: HeroModelId;
  /** The platform it belongs to (its `short` name in lib/platforms.ts) */
  platform: string;
  /** Tab it belongs to (a tab can hold more than one scene, e.g. Earthworks: a road and a basement) */
  tab: string;
  /** What the model shows, leading the sentence */
  title: string;
  /** One specific scenario, in one sentence */
  line: string;
  tool: { name: string; href: string };
  /** Where the model is shown from, and turns from (degrees) */
  view: { azimuth: number; elevation: number };
};

export const CUT = "#e2848c";
export const FILL = "#7fd3ae";
export const LINE = "#c9d1da";
export const AREA_COLORS = ["#7aa7e0", "#b59ce6", "#6fc9c9"] as const;
/** CAD Terminal's structure colours (the same as lib/terminal/model.ts) */
export const STRUCTURE_COLORS = { kerb: "#7aa8e6", pipe: "#6fc9c9", manhole: "#9fd07a", light: "#e8dd8a", asphalt: "#b59ce6", demolition: "#ff5a5f" } as const;

export const HERO_MODELS: HeroModel[] = [
  {
    id: "road",
    platform: "Civil 3D",
    tab: "Earthworks",
    title: "Road earthworks.",
    line: "Turn XYZ survey points into cut and fill volumes and an Excel report, in seconds.",
    tool: { name: "Excavation Volume Calculator", href: "/tools/excavation-volume-calculator" },
    // seen from above and to one side, so the survey, the TIN and the volumes read as 3D
    view: { azimuth: -32, elevation: 24 },
  },
  {
    id: "basement",
    platform: "Civil 3D",
    tab: "Earthworks",
    title: "Basement excavation.",
    line: "Measure a basement excavation from the ground survey and the dug surface, with sections to check it.",
    tool: { name: "Excavation Volume Calculator", href: "/tools/excavation-volume-calculator" },
    view: { azimuth: -35, elevation: 28 },
  },
  {
    id: "progress",
    platform: "Civil 3D",
    tab: "Progress",
    title: "Weekly progress.",
    line: "Overlay last week’s and this week’s drawings and get the net quantities for the progress report.",
    tool: { name: "DWG Comparison Tool", href: "/tools/drawing-comparison-tool" },
    view: { azimuth: -30, elevation: 32 },
  },
  {
    id: "areas",
    platform: "Civil 3D",
    tab: "Areas",
    title: "Project areas.",
    line: "Split one asphalt layer and a pipe trench that cross three project areas into a quantity for each area.",
    tool: { name: "Quantity by Area Calculator", href: "/tools/quantity-by-area-calculator" },
    view: { azimuth: -40, elevation: 40 },
  },
  {
    id: "structures",
    platform: "Civil 3D",
    tab: "Structures",
    title: "Drawing structures.",
    line: "Identify lines, dots and TIN surfaces once as kerbs, manholes, asphalt or demolition, and the drawing keeps track of them.",
    tool: { name: "CAD Terminal", href: "/tools/cad-terminal" },
    view: { azimuth: -32, elevation: 36 },
  },
  {
    id: "claims",
    platform: "Desktop App",
    tab: "Claims",
    title: "Claim documents.",
    line: "Move the submission date once and every claim document follows, with unit prices and totals checked against each other.",
    tool: { name: "Claim Management Software", href: "/tools/claim-management-software" },
    view: { azimuth: -38, elevation: 22 },
  },
  {
    id: "office",
    platform: "Desktop App",
    tab: "Office",
    title: "Office week.",
    line: "Turn a message into a task with one owner and a due day, and see it on the calendar next to the notes.",
    tool: { name: "Office Communication Software", href: "/tools/office-communication-software" },
    view: { azimuth: -28, elevation: 34 },
  },
];

// Which model is showing (the scene may load after the visitor has already picked one)
let current: HeroModelId = "road";
export function getHeroModel(): HeroModelId {
  return current;
}
export function setHeroModel(id: HeroModelId) {
  current = id;
  document.dispatchEvent(new CustomEvent("hero:model", { detail: { id } }));
}
/** The tabs, in order, each with its platform and the scenes (indexes into HERO_MODELS) it holds. */
export const HERO_TABS: { name: string; platform: string; models: number[] }[] = HERO_MODELS.reduce<{ name: string; platform: string; models: number[] }[]>((tabs, m, i) => {
  const tab = tabs.find((t) => t.name === m.tab && t.platform === m.platform);
  if (tab) tab.models.push(i);
  else tabs.push({ name: m.tab, platform: m.platform, models: [i] });
  return tabs;
}, []);

export function heroModel(id: HeroModelId): HeroModel {
  return HERO_MODELS.find((m) => m.id === id) ?? HERO_MODELS[0];
}
