"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  open = false,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "destructive",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={<span className="text-lg leading-tight">{title}</span>}
        showCloseButton={false}
        nested
        className="gap-3 p-6 sm:max-w-md"
      >
        <DialogDescription className="mt-1 text-center whitespace-pre-wrap">
          {description}
        </DialogDescription>
        <DialogFooter className="mt-2 flex w-full flex-row gap-3 sm:gap-3">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            className="flex-1"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AlertDialog({
  open = false,
  onOpenChange,
  title,
  description,
  confirmText = "Entendido",
}: Omit<ConfirmDialogProps, "onConfirm" | "cancelText" | "variant">) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={<span className="text-lg leading-tight">{title}</span>}
        showCloseButton={false}
        nested
        className="gap-3 p-6 sm:max-w-md"
      >
        <DialogDescription className="mt-1 text-center whitespace-pre-wrap">
          {description}
        </DialogDescription>
        <DialogFooter className="mt-2 flex w-full flex-row">
          <Button
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
