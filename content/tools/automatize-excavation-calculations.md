---
# The second tool. Fields left empty are simply not shown on the site.
title: Automatize Excavation Calculations
order: 2
demo: exv
summary: Survey points become terrain surfaces, and the excavation volume is calculated across the surface itself, with section views to check it.
platform:
stack:
status:
version:
features:
  - Triangulated (TIN) surfaces built from XYZ survey points
  - Existing ground compared with the excavated surface inside a calculation boundary
  - Section views along the alignment, with cut areas
image:
download:
docs:
---

## The idea

Surveyed coordinates in, a volume you can trust out.

The tool turns XYZ survey points into triangulated terrain surfaces, compares the **existing ground** with the **excavated surface** inside a **calculation boundary**, and integrates the difference across every triangle. It also cuts **section views** along the alignment, so the result can be checked the way engineers are used to.

## How the volume is calculated

1. Survey points (easting, northing, elevation)
2. Triangulated surfaces (TIN): existing and excavated
3. A closed calculation boundary
4. Volume = existing ground − excavated surface, integrated over the TIN inside the boundary

It is not area × average depth: each triangle is clipped to the boundary and its depth is integrated exactly.

## About the demonstration

The interactive demo above runs entirely in your browser on a generated example site. The numbers are computed from that site's surfaces, live. Placeholder: replace with a description of your own tool.
