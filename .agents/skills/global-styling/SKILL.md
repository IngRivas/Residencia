---
name: global-styling
description: Guidelines for global styling, specifically strict rules against using borders.
---

# Global Styling Rules

When building or modifying UI components in this project, you must strictly follow these aesthetic and structural guidelines:

## 1. Zero Borders Rule
You are strictly forbidden from using explicit borders (`border`, `ring`, `outline`) to separate elements or define boundaries unless absolutely necessary for accessibility (like focus states).

### Do NOT use:
- `border`, `border-t`, `border-border`, etc.
- `ring-1`, `ring-foreground/5`, etc.
- `divide-y`, `divide-border`, etc.

### DO use:
Rely exclusively on these techniques to create visual hierarchy and separation:
- **Background Contrasts**: Use subtle differences in background colors (e.g., `bg-card`, `bg-muted`, `bg-background`).
- **Opacities**: Differentiate text or elements using `/50`, `/80`, `/90` opacities.
- **Shadows**: Use drop shadows (`shadow-sm`, `shadow-md`) to elevate elements.
- **Spacing**: Use adequate padding and margins to create breathing room between distinct sections.

## 2. General Theme
The application leans heavily into a clean, modern, dark-mode aesthetic. Prioritize glassmorphism (where applicable, though modals no longer use blur per user request), rounded corners (`rounded-full` for icons, `rounded-3xl` for modals), and vibrant contrast for primary actions.
