---
name: contrast-system
description: Defines the 3-tier gray contrast system used for separating UI elements without relying on borders or drop shadows.
---

# Contrast System Rules (The "No Shadows / No Borders" Rule)

This project strictly relies on **pure background contrast** to differentiate overlapping UI elements. You are explicitly forbidden from using CSS shadows (`shadow-sm`, `shadow-lg`, `shadow-2xl`, drop-shadow, glow) or CSS borders (`border`, `ring`) to separate components like Modals, Cards, or Inputs.

## 3-Tier Contrast Hierarchy

Always use the following color steps when building overlapping elements in dark mode to ensure they do not blend into each other:

- **Tier 0 (The Backdrop)**
  - Use: Main application background, or Modal Overlay backdrop.
  - Class: `bg-background` (Pure Black `#000000`) or `bg-black/90` (For overlays).

- **Tier 1 (The Container)**
  - Use: Modal Containers (`DialogContent`), Main Cards, Sidebar panels.
  - Class: `bg-zinc-900` (Dark Gray).
  - Rule: This color provides a distinct step up from the black background without needing a shadow.

- **Tier 2 (The Interactive Element)**
  - Use: Form Inputs, Textareas, Select dropdowns, inner content boxes.
  - Class: `bg-zinc-800` (Medium-Dark Gray).
  - Rule: Inputs must visibly pop out from the `bg-zinc-900` container. Never use the same background color for an input as its container.

## Strict Aesthetic Enforcements
- Always apply `border-none shadow-none` to inputs and modals to strip away default shadcn styling.
- Do NOT add `drop-shadow`, `shadow-md`, or glows to elements to make them pop. Rely solely on these 3 tiers of `bg-` colors.
