---
# The third tool. Fields left empty are simply not shown on the site.
# Placeholder name: replace with the tool's real name when you're ready.
title: Drawing Comparison Tool
order: 3
demo: cmp
summary: Two progress drawings, overlaid. What was taken out and what was added is found and coloured automatically, and the net quantity for the period is calculated.
platform:
stack:
status:
version:
features:
  - The previous and current progress drawings (DWG) overlaid in the same coordinates
  - Objects taken out and objects added identified automatically, in red and green
  - Net quantity per item (added − removed), ready for the progress report
image:
download:
docs:
---

## The idea

Every progress update starts with the same question: **what changed since the last one?**

Done by hand, that means opening two drawings side by side and hunting for the differences: which kerbs are new, which asphalt areas were extended, and whether anything that was reported last time has since been taken out or redrawn. It is slow, and a single missed object makes the progress quantities wrong.

The Drawing Comparison Tool, part of my custom Civil 3D tools, does it the other way round. It lays the **previous** and the **current** progress drawings on top of each other and compares every object. Whatever is only in the previous drawing was **taken out** (red). Whatever is only in the current drawing was **added** (green). Everything else is unchanged. The net quantity for the period follows directly, and goes into the report.

## How it works

1. Previous progress drawing (DWG)
2. Current progress drawing (DWG)
3. Overlay: both drawings in the same coordinates
4. Every object compared: taken out, added or unchanged
5. Net quantity per item = added − removed
6. Progress report

## Why it helps with periodic updates

- **No searching by eye.** The differences are found for you, however large the drawing.
- **Removals count too.** Work that was redrawn, corrected or taken out comes off the quantity instead of hiding in the total.
- **It always adds up.** Previous quantity + net for the period = current quantity, for every item, every update.

## About the demonstration

The demonstration above runs entirely in your browser. It uses four synthetic progress drawings of a simplified road scheme, two weeks apart, including a kerb that was drawn before it was built and a bus bay that replaced a straight kerb. In the demonstration, objects are matched by layer and geometry.
