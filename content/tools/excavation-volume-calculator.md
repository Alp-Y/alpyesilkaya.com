---
# The second tool. Fields left empty are simply not shown on the site.
title: Excavation Volume Calculator
order: 2
demo: exv
summary: From coordinate and elevation data to presentation-ready reports in seconds.
platform:
stack:
status:
version:
features:
  - Triangulated (TIN) surfaces built from XYZ survey points
  - Existing ground compared with the excavated surface, cut and fill integrated per triangle
  - Section views with cut areas, and a quantity report in Excel
image:
download:
docs:
---

## The idea

Surveyed coordinates in, a volume you can trust out.

The tool turns XYZ survey points into triangulated terrain surfaces, compares the **existing ground** with the **excavated surface**, and integrates the difference across every triangle. It also cuts **section views** along the excavation, so the result can be checked the way engineers are used to, and writes the quantities to an **Excel report**.

## How the volume is calculated

1. Survey points (easting, northing, elevation)
2. Triangulated surfaces (TIN): existing ground and excavated surface
3. One composite TIN carrying both levels at every vertex
4. Volume = existing ground − excavated surface, integrated over every triangle

It is not area × average depth: where the two surfaces cross, a triangle is clipped at that line, and the depth is integrated exactly over each part.

## About the demonstration

The Excavation Volume Engine above runs entirely in your browser. The three samples are generated example sites (synthetic data); you can also upload your own X,Y,Z points, which never leave your device. The numbers, sections and the Excel report are computed from the surfaces, live.
