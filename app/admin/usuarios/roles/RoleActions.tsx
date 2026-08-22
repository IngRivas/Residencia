"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { deleteRole } from "@/lib/actions/roles"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

export default function RoleActions({
  id,
  roleName,
}: {
  id: string
  roleName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState("")

  const executeDelete = async () => {
    if (confirmText !== roleName) {
      sileo.error({
        title: "Error",
        description: "El nombre del rol no coincide.",
      })
      setAlertMsg("El nombre del rol no coincide.")
      return
    }

    setLoading(true)
    try {
      await deleteRole(id)
      setOpen(false)
      sileo.success({ title: "Éxito", description: "Rol eliminado." })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Ocurrió un error al eliminar.",
      })
      setAlertMsg(err.message || "Ocurrió un error al eliminar.")
      setOpen(false)
    } finally {
      setLoading(false)
      setConfirmText("")
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-rose-400 hover:bg-rose-950/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) setConfirmText("")
        }}
      >
        <DialogContent
          title={<span className="text-destructive">Eliminar Rol</span>}
          showCloseButton={false}
          className="gap-4 px-6 pt-6 pb-0 sm:max-w-md"
        >
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el rol{" "}
            <strong>{roleName}</strong>? Esta acción no se puede deshacer y
            fallará si existen usuarios asignados a este rol.
            <br />
            <br />
            Por favor, escribe <strong>{roleName}</strong> para confirmar.
          </DialogDescription>
          <div className="space-y-4 pt-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={roleName}
              className="border-border bg-card"
            />
            <div className="mt-2 flex w-full gap-3 border-t border-border pt-4 sm:gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={executeDelete}
                disabled={loading || confirmText !== roleName}
                className="flex-1"
              >
                {loading ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!alertMsg}
        onOpenChange={(isOpen) => {
          if (!isOpen) setAlertMsg(null)
        }}
        title="Atención"
        description={alertMsg || ""}
      />
    </>
  )
}
