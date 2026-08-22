"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createRole, updateRole } from "@/lib/actions/roles"
import { sileo } from "sileo"

interface RoleModalProps {
  role?: { id: string; name: string; permissions: string[]; isSystem: boolean }
}

const AVAILABLE_PERMISSIONS = [
  { id: "manage_roles", label: "Gestión de Roles" },
  { id: "manage_users", label: "Gestión de Usuarios" },
  { id: "manage_obras", label: "Gestión de Obras" },
  { id: "manage_expenses", label: "Gestión de Gastos" },
  { id: "view_reports", label: "Ver Reportes" },
]

export default function RoleModal({ role }: RoleModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(role?.name || "")
  const [permissions, setPermissions] = useState<string[]>(
    role?.permissions || []
  )
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isEditing = !!role
  const isSystem = role?.isSystem

  const handleTogglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name && !isEditing) {
      sileo.error({ title: "Error", description: "El nombre es obligatorio." })
      setErrorMsg("El nombre es obligatorio.")
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      if (isEditing) {
        await updateRole(role.id, { permissions })
      } else {
        await createRole({ name, permissions })
        setName("")
        setPermissions([])
      }
      setOpen(false)
      sileo.success({
        title: "Éxito",
        description: isEditing ? "Rol actualizado" : "Rol creado",
      })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Ocurrió un error.",
      })
      setErrorMsg(err.message || "Ocurrió un error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
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
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
              />
            </svg>
          </Button>
        ) : (
          <Button className="flex items-center gap-2" variant="default">
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Nuevo Rol
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={isEditing ? "Editar Permisos del Rol" : "Crear Nuevo Rol"}
        showCloseButton={true}
        className="w-fit border-border bg-background text-foreground"
        rightAction={
          <Button type="submit" form="role-form" disabled={loading} size="sm">
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        }
      >
        <form
          id="role-form"
          onSubmit={handleSubmit}
          className="min-w-[300px] space-y-4 pt-4 pb-6 sm:min-w-[380px]"
        >
          {errorMsg && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-500">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nombre del Rol</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditing}
              className="border-border bg-card text-foreground disabled:opacity-50"
              placeholder="Ej. GERENTE_VENTAS"
              required={!isEditing}
            />
            {isSystem && (
              <p className="mt-1 text-xs text-muted-foreground">
                Este rol es del sistema y su nombre no puede ser modificado.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <Label>Permisos Asignados</Label>
            <div className="space-y-3 rounded-md border border-border bg-card p-4">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <div key={perm.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perm-${perm.id}`}
                    checked={permissions.includes(perm.id)}
                    onCheckedChange={() => handleTogglePermission(perm.id)}
                  />
                  <label
                    htmlFor={`perm-${perm.id}`}
                    className="cursor-pointer text-sm leading-none font-medium text-foreground/90 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {perm.label}
                    <span className="ml-2 block text-xs font-normal text-muted-foreground md:inline">
                      ({perm.id})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
