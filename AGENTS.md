<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:modal-overlay-rules -->
# Modal & Overlay Dismissal Rules

**Rule: Single Dismiss Mechanism**
A modal, sheet, or drawer may have AT MOST ONE way to close it. Choose one based on context:
- **`X` icon in the top right**: Use when the modal has NO bottom action bar.
- **`Cerrar` / `Volver` button in the bottom action bar**: Use when a bottom bar already exists with other actions.
- **NEVER** use both at the same time.

**Rule: Bottom Bar Button Layout**
- **2 Actions**: Both buttons must be `flex: 1`, have the same height, and the same visual weight (e.g. no ghost vs primary asymmetry unless one is explicitly destructive).
- **1 Action**: Must be a full-width button.
- **Never mix**: Do not mix a text-only link (e.g., "Limpiar todo") with a solid button in the same bar. Either both must be buttons, or one is elevated to match the visual weight.

**Rule: Redundancy Check**
Before adding any close/dismiss element, you MUST check if one already exists in the component tree for that overlay. If yes, do not add another.
<!-- END:modal-overlay-rules -->
