---
name: table-header-icons
description: Guidelines for creating table headers with icons and appropriate styling.
---

# Table Header Guidelines

When creating or modifying tables in this project, you must adhere to the following rules:

1. **Icons in Headers:** Always include an icon in the primary row of the table (the header row `TableHead`) that is congruent with the text of the column.
   - For example, if the column is "Presupuesto", use an icon related to money or budget.
   - Use SVG icons or an icon library available in the project (e.g., `@phosphor-icons/react` or `lucide-react`).
   - Place the icon alongside the text, usually using a `flex items-center gap-1.5` wrapper.
2. **No All-Caps:** Never use all-caps (`uppercase` classes) in the text of the table. Text should be properly capitalized (e.g. Title Case or Sentence case) but not fully uppercase.
3. **Pure White Text:** The text color in the table (both headers and cells) should be pure white (`text-white`). Avoid classes like `text-muted-foreground` or `text-foreground/80` in tables to maintain contrast and match the project name's style.
