@AGENTS.md

# Working notes for Claude

**Project:** Alp Yesilkaya's professional site, alpyesilkaya.com. See README.md for the full map of where things live.

## Rules
- This folder (`~/Projects/alpyesilkaya.com`) is the only project. Never create a second project or repository. Never force push.
- Keep the stack: Next.js (App Router, static export to `/out`), React, TypeScript, npm. Styling is plain CSS (`app/globals.css` design tokens + `*.module.css` per component). Tailwind is installed but not used. Three.js is used for the 3D pieces.
- Design language: a dark CAD "drawing sheet" workspace with a green accent (`--accent`). No orange.
- Never invent tool names, capabilities, screenshots, results or case studies. Use obviously marked placeholders instead.
- Positioning: a civil engineer who builds engineering tools. Say "engineering tools", not "software developer".
- The repository is public. Never commit secrets, client drawings or anything confidential.

## Workflow
- Content: `content/tools/*.md`, `content/case-studies/*.md`, `content/about.md`. Personal details: `site.config.ts`.
- Check changes with `npm run dev` (localhost:3000) and `npm run build` on Alp's Mac. The npm registry may be blocked from Claude's environment.
- Deploy: `git push` to `main` runs GitHub Actions, which publishes to GitHub Pages (about 1 minute). Pushing uses the SSH key on Alp's Mac.
- Scratch and backup files go in `_to_delete/`, which is gitignored and never committed.

## Handover after each change
Cover: what changed, files touched, any dependencies, how to run and test it, what was checked, remaining placeholders, git status, and the suggested next step.
