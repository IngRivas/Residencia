"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateObra, deleteObra } from "@/lib/actions/obras"
import type { ObraEstado } from "@prisma/client"
import { sileo } from "sileo"

import { AlertDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"

interface ObraActionsProps {
  id: string
  nombre: string
  presupuesto: number
  estado: ObraEstado
}

export default function ObraActions({
  id,
  nombre: initialNombre,
  presupuesto: initialPresupuesto,
  estado: initialEstado,
}: ObraActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [nombre, setNombre] = useState(initialNombre)
  const [estado, setEstado] = useState<ObraEstado>(initialEstado)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await updateObra(id, {
        nombre,
        presupuestoTotal: initialPresupuesto,
        estado,
      })
      setEditOpen(false)
      sileo.success({ title: "Éxito", description: "Obra actualizada." })
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al actualizar la obra.",
      })
      setError(err.message || "Error al actualizar la obra.")
    } finally {
      setLoading(false)
    }
  }

  const executeArchive = async () => {
    try {
      await deleteObra(id)
      sileo.success({ title: "Éxito", description: "Obra archivada." })
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al archivar la obra.",
      })
      setAlertMsg(err.message || "Error al archivar la obra.")
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="flex h-10 items-center justify-center rounded-full bg-card px-5 text-sm font-semibold whitespace-nowrap text-foreground/90 shadow-md transition-all hover:bg-muted"
        >
          Editar Obra
        </button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          title="Editar Obra"
          showCloseButton={true}
          className="w-fit border-border bg-background text-foreground"
          rightAction={
            <Button
              type="submit"
              form={`edit-obra-form-${id}`}
              disabled={loading}
              size="sm"
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          }
        >
          <form
            id={`edit-obra-form-${id}`}
            onSubmit={handleUpdate}
            className="min-w-[280px] space-y-4 pt-2 pb-6 sm:min-w-[350px]"
          >
            {error && (
              <div className="rounded-lg border border-rose-950/50 bg-rose-950/20 p-3 text-sm text-rose-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-nombre" className="text-foreground/80">
                Nombre de la Obra
              </Label>
              <Input
                id="edit-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="border-border bg-card text-foreground focus:border-blue-500/50 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-estado" className="text-foreground/80">
                Estado
              </Label>
              <Select
                value={estado}
                onValueChange={(val) => setEstado(val as ObraEstado)}
              >
                <SelectTrigger className="border-border bg-card text-foreground">
                  <SelectValue placeholder="Seleccione un estado" />
                </SelectTrigger>
                <SelectContent className="border-border bg-background text-foreground">
                  <SelectItem value={"ACTIVA"}>ACTIVA</SelectItem>
                  <SelectItem value={"PAUSADA"}>PAUSADA</SelectItem>
                  <SelectItem value={"ARCHIVADA"}>ARCHIVADA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!alertMsg}
        onOpenChange={() => setAlertMsg(null)}
        title="Aviso"
        description={alertMsg || ""}
      />

      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title="Confirmar Archivo"
        description={`¿Está seguro que desea archivar la obra "${initialNombre}"?`}
        onConfirm={executeArchive}
      />
    </>
  )
}
