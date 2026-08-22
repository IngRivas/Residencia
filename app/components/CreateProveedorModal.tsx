"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { addProveedor } from "@/lib/actions/proveedores"
import { sileo } from "sileo"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

export default function CreateProveedorModal() {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [rfc, setRfc] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) {
      sileo.error({ title: "El nombre es requerido" })
      return
    }
    setLoading(true)
    try {
      await addProveedor({ nombre, rfc })
      sileo.success({ title: "Proveedor agregado con éxito" })
      setOpen(false)
      setNombre("")
      setRfc("")
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al agregar proveedor" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Agregar Proveedor</Button>
      </DialogTrigger>
      <DialogContent
        title="Nuevo Proveedor"
        className="w-fit"
        rightAction={
          <Button type="submit" form="create-proveedor-form" disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        }
      >
        <form
          id="create-proveedor-form"
          onSubmit={handleSubmit}
          className="mt-2 min-w-[280px] space-y-4 sm:min-w-[350px]"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Materiales de Construcción S.A. de C.V."
              className="w-full rounded-md border-none bg-zinc-800 px-3 py-2 text-sm text-foreground shadow-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              RFC (Opcional)
            </label>
            <input
              type="text"
              value={rfc}
              onChange={(e) => setRfc(e.target.value)}
              placeholder="XXXXXXXXXXXXX"
              className="w-full rounded-md border-none bg-zinc-800 px-3 py-2 text-sm text-foreground uppercase shadow-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
