"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  asChild,
  children,
  ...props
}: DialogPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={children}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props}>
      {children}
    </DialogPrimitive.Trigger>
  )
}

function DialogPortal({ children, ...props }: DialogPrimitive.Portal.Props) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Usamos createPortal explícitamente al body para asegurar que el DOM
  // del segundo modal quede fuera de la jerarquía del primero.
  return createPortal(
    <DialogPrimitive.Portal data-slot="dialog-portal" {...props}>
      {children}
    </DialogPrimitive.Portal>,
    document.body
  )
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  nested,
  ...props
}: DialogPrimitive.Backdrop.Props & { nested?: boolean }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate bg-black/90 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        nested ? "z-[60]" : "z-50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  overlayClassName,
  children,
  showCloseButton = true,
  nested,
  rightAction,
  title,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "title"> & {
  showCloseButton?: boolean
  overlayClassName?: string
  nested?: boolean
  rightAction?: React.ReactNode
  title?: React.ReactNode
}) {
  return (
    <DialogPortal>
      {nested && (
        <div className="fixed inset-0 z-[60] animate-in bg-black/90 duration-200 fade-in-0" />
      )}
      <DialogOverlay className={overlayClassName} nested={nested} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 grid w-fit max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-3xl border-none bg-zinc-900 p-6 text-sm text-foreground shadow-none duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          nested ? "z-[70]" : "z-50",
          className
        )}
        {...props}
      >
        {title ? (
          <div className="flex min-h-[2.5rem] w-full items-center justify-between gap-4 pb-2">
            <div className="flex flex-none shrink-0 justify-start">
              {showCloseButton && (
                <DialogPrimitive.Close
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label="Close"
                >
                  <XIcon className="h-4 w-4" />
                </DialogPrimitive.Close>
              )}
            </div>

            <div className="flex min-w-0 flex-none shrink justify-center">
              {typeof title === "string" ? (
                <DialogTitle className="truncate text-center text-lg font-semibold text-foreground">
                  {title}
                </DialogTitle>
              ) : (
                <div className="flex w-full justify-center truncate">
                  {title}
                </div>
              )}
            </div>

            <div className="flex flex-none shrink-0 justify-end">
              {rightAction}
            </div>
          </div>
        ) : (
          <>
            {showCloseButton && (
              <DialogPrimitive.Close
                className="absolute top-6 left-6 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </DialogPrimitive.Close>
            )}
            {rightAction && (
              <div className="absolute top-6 right-6 z-10 flex items-center justify-center">
                {rightAction}
              </div>
            )}
          </>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 px-20 pt-1 pb-2 text-center",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
