"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from "@/components/ui/checkbox"
import { createObra } from "@/lib/actions/obras"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

export default function CreateObraModal({
  admins = [],
}: {
  admins?: { id: string; name: string | null; email: string | null }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [adminIds, setAdminIds] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (adminIds.length === 0) {
      sileo.error({
        title: "Error",
        description:
          "Por favor seleccione al menos un administrador para la obra.",
      })
      setError("Por favor seleccione al menos un administrador para la obra.")
      setLoading(false)
      return
    }

    try {
      await createObra({
        nombre,
        adminIds,
      })
      setNombre("")
      setAdminIds([])
      setOpen(false)
      sileo.success({
        title: "Éxito",
        description: "Obra creada exitosamente.",
      })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al crear la obra.",
      })
      setError(err.message || "Error al crear la obra.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nueva Obra</Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="w-fit text-foreground"
        title="Crear Nueva Obra"
        rightAction={
          <Button
            type="submit"
            form="create-obra-form"
            disabled={loading}
            className=""
          >
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        }
      >
        <form
          id="create-obra-form"
          onSubmit={handleSubmit}
          className="min-w-[280px] space-y-4 sm:min-w-[350px]"
        >
          {error && (
            <div className="rounded-lg bg-rose-950/20 p-3 text-sm text-rose-400">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="nombre" className="text-foreground/80">
              Nombre de la Obra
            </Label>
            <Input
              id="nombre"
              type="text"
              placeholder="Ej. Residencia Las Torres"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="border-none bg-zinc-800 text-foreground placeholder-slate-500 shadow-none focus-visible:ring-1 focus-visible:ring-primary"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground/80">
              Administradores a Cargo
            </Label>
            <div className="flex max-h-40 flex-wrap gap-4 overflow-y-auto rounded-xl border-none bg-zinc-800 p-3 shadow-none">
              {admins
                .filter((a) => a.name !== "Edwin Coronel")
                .map((admin) => (
                  <div key={admin.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`admin-${admin.id}`}
                      checked={adminIds.includes(admin.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setAdminIds([...adminIds, admin.id])
                        else
                          setAdminIds(adminIds.filter((id) => id !== admin.id))
                      }}
                    />
                    <Label
                      htmlFor={`admin-${admin.id}`}
                      className="cursor-pointer text-sm font-normal text-foreground"
                    >
                      {admin.name || admin.email}
                    </Label>
                  </div>
                ))}
              {admins.filter((a) => a.name !== "Edwin Coronel").length ===
                0 && (
                <div className="p-1 text-sm text-muted-foreground">
                  No hay administradores disponibles.
                </div>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
