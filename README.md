# alpyesilkaya.com

This is my personal website and portfolio. It's built with **Next.js** (App Router) and plain CSS, and uses no animation library.

## Run it locally

```bash
npm install      # first time only
npm run dev      # then open http://localhost:3000
```

`npm run build` builds the production version. Run it before you publish to catch errors.

## Where things live

```
site.config.ts            ← your name, email, links, location, portrait. START HERE.
content/
  tools/*.md              ← one file per tool  → /tools/<file-name>
  case-studies/*.md       ← one file per case study → /case-studies/<file-name>
  about.md                ← About text and the "Properties" list
public/
  images/                 ← screenshots, portrait, case-study images
  demo/example-project.dxf← the downloadable example drawing for the SQE demo
  og.png                  ← link-preview image (1200×630) for LinkedIn, Slack, etc.
app/
  globals.css             ← design tokens (colours, spacing, motion timing) + shared styles
  page.tsx                ← the homepage, section by section
  sitemap.ts, robots.ts   ← /sitemap.xml and /robots.txt, generated automatically
  tools/, case-studies/, about/   ← the other pages
components/               ← each piece of the UI + its own .module.css
  viewcube/               ← the interactive 3D ViewCube (Three.js)
  earthworks/             ← the hero's cut / fill model (Three.js, follows the ViewCube)
  excavation/             ← Excavation Volume Engine demo: input, 3D surfaces (Three.js),
                            results, section profile, report preview + Excel export
  previews/               ← the homepage tool previews: looping visuals that link to each tool page
  film/                   ← the tools film at the top of section 02 (canvas, no library):
                            ToolsFilm.tsx (lazy loading, chapters, CTA) · chapters.ts (running order + text)
                            player.ts (clock, resize, quality) · draw.ts (drawing kit) · plan.ts (the project plan)
                            scenesPlan / scenesSurface / scenesWork.ts (the eight scenes)
  sqe/                    ← the Quantity by Area Calculator demo (UI)
lib/
  content.ts              ← reads the Markdown files
  effects.ts              ← page behaviour: reveals, header, command line…
  format.ts               ← ONE place for number formatting (2 decimals, units)
  workspace/              ← the shared "CAD workspace": view state, actions,
                            pointer, CAD cursor + HUD, commands
  sqe/                    ← the Quantity by Area Calculator: geometry, DXF reader,
                            work types, quantity engine, example site (site.json)
  earthworks/model.ts     ← the cut / fill maths (grid method)
  film/                   ← the film's example project (project.ts: alignment, areas A01–A06,
                            work geometry, drainage, progress) and basin survey (terrain.ts)
  excavation/             ← the Excavation Volume Engine (no UI code):
                            xyz.ts (read + check XYZ files) · samples.ts (synthetic datasets)
                            tin.ts (Delaunay TIN) · volume.ts (surface comparison, sections)
                            engine.ts (runs it all) · reportModel.ts / report.ts (Excel report)
  xlsx/                   ← a small .xlsx writer (sheets, styles, formulas, charts), no dependency
scripts/sqe-site.py       ← regenerates the SQE example site + its aerial image (optional)
```

## Everyday tasks

**Add a tool**
1. Copy `content/tools/quantity-by-area-calculator.md` and rename it, e.g. `my-tool.md`. The file name becomes the page address: `/tools/my-tool`.
2. Edit the text between the `---` lines (title, summary, platform…) and write the page body in Markdown underneath. Remove the `demo: sqe` line — that switches on the live SQE demo.
3. Optional: put a screenshot in `public/images/` (1600×1000 or larger, 16:10) and set `image: /images/my-tool.png`.
4. Fields you leave empty (status, version, download, docs) are simply not shown.

The homepage, `/tools`, the tool's own page and the sitemap all update automatically. `order:` controls the sequence.

**Add a case study:** same steps, in `content/case-studies/`. Keep the structure Problem → Constraints → Approach → Solution → Result → Lessons. Pages marked `placeholder: true` are hidden from search engines and the sitemap — delete that line once the case study is real.

**Offer a download:** create a release on GitHub, upload the installer to it, and paste its link into `download:` in the tool's file. The Download button appears only when this is set.

**Change the work types in the SQE demo:** `lib/sqe/workTypes.ts` (names, units, colours, representative depths).

**Change your photo:** put `portrait.jpg` (about 1200×1500) in `public/images/`, then update `portrait` in `site.config.ts`.

**Change the accent colour:** edit `--accent` in `app/globals.css`. If you change your name or tagline, also regenerate `public/og.png`.

**Files starting with `_`** (e.g. `_draft.md`) are ignored. Use this for drafts.

**Before you commit:** the repository is public. Never add passwords, API keys, client drawings or anything confidential — and only publish screenshots/drawings you're allowed to share.

## Design & motion notes

- **One workspace:** the background grid, the CAD cursor, the HUD next to the pointer, the `[−] [VIEW] [DISPLAY]` controls, the ViewCube and the command line all read and write one shared state (`lib/workspace/store.ts`) through one set of actions (`lib/workspace/actions.ts`). Change the view anywhere and everything else follows.
- **CAD cursor:** only inside CAD spaces (the hero and the SQE drawing), only with a mouse. Everywhere else you get the normal cursor; text fields get the text cursor.
- **Motion system:** timing and easing tokens (`--motion-*`, `--ease-*`) live in `globals.css`. Reveals are set with `data-reveal="rise" | "lines" | "draw"`. Everything respects the system's *Reduce motion* setting.
- **Hero earthworks model:** turn the ViewCube and the model turns with it — TOP reads as a cut/fill plan, FRONT as the long section. Volumes are computed from the model (grid method) and labelled as a demonstration.
- **Command line** (end of section 01): try `HELP`, `TOP`, `FRONT`, `ISO`, `WIREFRAME`, `SHADED`, `ANALYSIS`, `TOOLS`, `DEMO`, `ABOUT`, `CONTACT`, `HOME`, `CLEAR` or `GRID`.
- **Excavation Volume Engine demo** (Excavation Volume Calculator): Input → Surface → Calculate → Inspect → Export. Sample data (three synthetic excavations, each with an existing-ground survey and an as-dug survey) or an uploaded X,Y,Z file; existing ground from the sample survey, a constant level, or a second XYZ file. Both surveys are merged into one composite TIN and cut / fill are integrated exactly per triangle (clipped where the surfaces cross). Area breakdown = equal chainage strips along the excavation's principal axis. Sections (cross / long) are cut from the same TIN and shown in the 3D model. Everything runs in the browser; uploads never leave the device. The full engine is on the tool page; the homepage and /tools show a looping preview (components/previews/) that links there. Drag to orbit, right-drag to pan, click then scroll (or pinch) to zoom, double-click to reset; arrow keys and +/− work when the model has focus.
- **Excel report:** `lib/excavation/report.ts` writes the .xlsx (Summary · Input Points · Volume Results · Area Breakdown · Sections, with formulas and native charts). The page's "Download Example Report / Export Results" button generates it in the browser; `app/downloads/example-excavation-report.xlsx/route.ts` writes the same file at build time. Also at build: `/downloads/xyz-template.csv` and `/downloads/sample-xyz-points.csv`.
- **Quantity by Area Calculator demo:** tells its story once when it scrolls into view — site → survey → areas → quantities — then you explore. It runs entirely in the browser; imported DXF files are never uploaded. Excavation volumes are demonstration values (area × a representative depth), and the page says so.
- **The SQE aerial image is an original render**, generated from the same geometry as the CAD overlay (`scripts/sqe-site.py`), so it lines up exactly and needs no licence. To use a real aerial photo instead you would also need to redraw the areas to match it.
- **Tools film** (top of section 02): a ~74 s demonstration drawn live on a canvas: overview → quantities by area → XYZ to TIN, sections and cut volume → drainage network → weekly comparison → BOQ / WIR / IPC traceability → report → summary. Every number in it is computed from the example geometry at load time (areas clipped per project area, the basin through the real Excavation Volume Engine), nothing is typed in. It loads only when it comes near the screen, plays only while on screen, and never plays by itself with *Reduce motion* (a still of the report is shown; the chapter buttons show stills). Three compositions: 16:9 (≥ 900 px), square (640–899) and 4:5 portrait (phones). Change the running order or a chapter's length in `components/film/chapters.ts`; `<ToolsFilm chapters={["surfaces"]} />` plays one chapter on a loop anywhere. In development, `__at(seconds)` in the browser console holds the film at that time.
- **Fonts:** Geist and Geist Mono (open licence) are self-hosted from `app/fonts/`.

## Deploy

The site is hosted on **GitHub Pages** and publishes itself:

1. Commit your changes and run `git push` (branch `main`).
2. GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci` and `npm run build`, then publishes the `/out` folder. It takes about a minute. Progress and any errors are on the repository's **Actions** tab.
3. The domain `alpyesilkaya.com` (registered at Namecheap) points to GitHub Pages. It is set under the repository's *Settings → Pages → Custom domain*.

Run `npm run build` locally before pushing. If it fails on your Mac, it will fail on GitHub too, and the live site simply stays on the previous version.
