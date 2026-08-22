"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { updateProveedor, deleteProveedor } from "@/lib/actions/proveedores"
import { sileo } from "sileo"
import { useRouter } from "next/navigation"

export default function ProveedorActions({
  id,
  nombre,
  rfc,
}: {
  id: string
  nombre: string
  rfc: string | null
}) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editNombre, setEditNombre] = useState(nombre)
  const [editRfc, setEditRfc] = useState(rfc || "")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editNombre.trim()) {
      sileo.error({ title: "El nombre es requerido" })
      return
    }
    setLoading(true)
    try {
      await updateProveedor(id, { nombre: editNombre, rfc: editRfc })
      sileo.success({ title: "Proveedor actualizado" })
      setIsEditOpen(false)
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al actualizar" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteProveedor(id)
      sileo.success({ title: "Proveedor eliminado" })
      setIsDeleteOpen(false)
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al eliminar" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditOpen(true)}
        >
          <span className="sr-only">Editar</span>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive/80"
          onClick={() => setIsDeleteOpen(true)}
        >
          <span className="sr-only">Eliminar</span>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent
          title="Editar Proveedor"
          className="w-fit border-border bg-card"
          rightAction={
            <Button
              type="submit"
              form={`edit-prov-${id}`}
              disabled={loading}
              size="sm"
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          }
        >
          <form
            id={`edit-prov-${id}`}
            onSubmit={handleEditSubmit}
            className="mt-2 min-w-[280px] space-y-4 sm:min-w-[350px]"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Nombre
              </label>
              <input
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full rounded-md border border-transparent bg-muted px-3 py-2 text-sm text-foreground transition-colors outline-none focus:border-primary"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                RFC
              </label>
              <input
                type="text"
                value={editRfc}
                onChange={(e) => setEditRfc(e.target.value)}
                className="w-full rounded-md border border-transparent bg-muted px-3 py-2 text-sm text-foreground uppercase transition-colors outline-none focus:border-primary"
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          title={<span className="text-destructive">Eliminar Proveedor</span>}
          className="w-fit border-border bg-card"
        >
          <div className="mt-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar este proveedor? Esta acción
              no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
