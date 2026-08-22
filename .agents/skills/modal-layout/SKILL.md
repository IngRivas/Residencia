---
name: modal-layout
description: Strict guidelines for creating or modifying modals and dialogs in the application.
---

# Modal & Dialog Layout Guidelines

This project uses a unified and clean structure for Modals and Dialogs, leveraging a "Smart Grid Header" built into `DialogContent`. You must follow these structural guidelines for any existing or new Modals:

## The "Smart Grid Header" Rule
- **NEVER** use `<DialogHeader>` or `<DialogTitle>` inside the children of a Modal if the modal has action buttons at the top right.
- **INSTEAD**, use the built-in `title` and `rightAction` props of `<DialogContent>`.
- The `<DialogContent>` component internally renders a CSS Grid (`grid-cols-[1fr_auto_1fr]`) that mathematically centers the title while preventing the close button and the action button from overlapping the text, no matter how long the title is.

### Correct Usage Example:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>...</DialogTrigger>
  <DialogContent
    title="Nuevo Proveedor"
    showCloseButton={true}
    rightAction={<Button type="submit" form="my-form">Guardar</Button>}
  >
    <form id="my-form">
      {/* Form content goes here without any DialogHeader */}
    </form>
  </DialogContent>
</Dialog>
```

### Incorrect Usage:
```tsx
<DialogContent rightAction={<Button>Guardar</Button>}>
  <DialogHeader> <!-- BAD: DO NOT USE IF THERE'S A RIGHT ACTION -->
    <DialogTitle>Nuevo Proveedor</DialogTitle>
  </DialogHeader>
</DialogContent>
```

## Description Rule
- Modals should be direct and concise. **DO NOT** use `<DialogDescription>` unless absolutely necessary for complex disclaimers. 

## Footer Rule
- **No Footers Allowed** for primary Modals (creation/editing forms). All primary actions (like "Guardar" or "Crear") must be placed in the `rightAction` prop of the `DialogContent`.
- **Exception**: Destructive modals (like delete confirmations or system warnings) that use `<AlertDialog>` or `<ConfirmDialog>` may continue to use standard footers.
