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
  excavation/             ← Automatize Excavation Calculations demo (Three.js + section views)
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
  excavation/             ← survey points → TIN (Delaunay) → volume + sections
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
- **Automatize Excavation Calculations demo:** survey points are triangulated into a TIN; the volume between existing ground and the excavated surface is integrated triangle by triangle inside the boundary (not area × average depth), and sections are cut along the road with an end-area check. Drag to orbit, right-drag to pan, click then scroll to zoom, double-click to reset.
- **Quantity by Area Calculator demo:** tells its story once when it scrolls into view — site → survey → areas → quantities — then you explore. It runs entirely in the browser; imported DXF files are never uploaded. Excavation volumes are demonstration values (area × a representative depth), and the page says so.
- **The SQE aerial image is an original render**, generated from the same geometry as the CAD overlay (`scripts/sqe-site.py`), so it lines up exactly and needs no licence. To use a real aerial photo instead you would also need to redraw the areas to match it.
- **Fonts:** Geist and Geist Mono (open licence) are self-hosted from `app/fonts/`.

## Deploy

The site is hosted on **GitHub Pages** and publishes itself:

1. Commit your changes and run `git push` (branch `main`).
2. GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci` and `npm run build`, then publishes the `/out` folder. It takes about a minute. Progress and any errors are on the repository's **Actions** tab.
3. The domain `alpyesilkaya.com` (registered at Namecheap) points to GitHub Pages. It is set under the repository's *Settings → Pages → Custom domain*.

Run `npm run build` locally before pushing. If it fails on your Mac, it will fail on GitHub too, and the live site simply stays on the previous version.
