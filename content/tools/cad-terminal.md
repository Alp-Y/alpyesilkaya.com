---
# The fourth tool. Fields left empty are simply not shown on the site.
title: CAD Terminal
order: 4
demo: ctm
summary: Customise design and survey DWG elements according to your needs. Identify a structure once and CAD Terminal remembers it, ready to track, search and export.
platform:
stack:
status:
version:
features:
  - Lines and dots identified as real structures (kerbs, pipes, manholes, lights), each with its own ID
  - TIN surfaces identified as asphalt or demolition surfaces; coordinates and levels as an excavation surface
  - Project information on every structure, a built-in browser to find it, and exports filtered by any of it
  - Design and survey drawings customised to your project, the way you need them
image:
download:
docs:
---

## The idea

A drawing knows a lot about geometry and almost nothing about the project.

To AutoCAD, a kerb is a line on layer 0. A manhole is a dot. The new wearing course and the old pavement that has to be broken out are both just TIN surfaces, and an excavation is a cloud of points with their levels typed next to them as text. Everyone on the project knows what those objects are. The drawing doesn't, so every time you need a quantity, a list or a report, you work it out again by hand.

CAD Terminal fixes that at the source. You pick an object on the drawing and tell it what it is. That line becomes **Kerb K-02**, in Zone B, from chainage 0+180 to 0+400, in progress. The TIN becomes an **asphalt surface** or a **demolition surface**. The survey points and their levels become an **excavation surface**, directly on the drawing.

It works on **design drawings and survey drawings** alike, and you set it up around your project: the structures you track, the information you attach to them, the way you group and export them.

You do it **once**. CAD Terminal keeps it with the drawing, so next week the kerb is still K-02, with everything you told it.

## What you can do with it

1. Pick any drawing element: a line, a dot, a TIN surface, a set of points with levels
2. Identify it as a project structure: kerb, pipe, manhole, street light, asphalt, demolition or excavation surface
3. Assign its project information: zone, chainage, status and anything else the project tracks
4. Find it again with the built-in browser, grouped by type, zone or status
5. Export only what you need, with its project information attached
6. Customise all of it for your own design and survey drawings

## Why it helps

- **Identify once, use it everywhere.** The drawing remembers what each object is, so nobody has to work it out again for the next report.
- **Surfaces that mean something.** A TIN is no longer just a TIN: it is the asphalt you are laying or the pavement you are breaking out, and it is counted that way.
- **Exports that answer the question.** Instead of a list of handles and layers, you get "storm drainage in Zone A that is still in progress", with IDs, chainages and quantities.
- **Your drawings, your way.** Design or survey, every project tracks different things. CAD Terminal is customised around what yours needs, not the other way round.
- **Easy to find your way around.** The browser takes you straight to MH-02 on a large drawing, instead of you hunting for it.

## About the demonstration

The demonstration above runs entirely in your browser, on a synthetic example drawing of a simplified road. Pick a grey object to identify it, change its status or zone in Properties, find structures with the browser or the command line (type HELP), and compare the CAD Terminal export with a plain CAD export of the same drawing. "Reopen drawing" stands in for closing and opening the DWG.
