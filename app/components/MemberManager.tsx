"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addMiembro, removeMiembro } from "@/lib/actions/obras"
import type { ObraRol } from "@prisma/client"
import { AlertDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"

interface Member {
  id: string
  name: string
  email: string
  rol: ObraRol
}

interface MemberManagerProps {
  obraId: string
  miembros: Member[]
  availableUsers: {
    id: string
    name: string
    email: string
    role?: { name: string }
  }[]
}

export default function MemberManager({
  obraId,
  miembros,
  availableUsers,
}: MemberManagerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string
    name: string
  } | null>(null)

  const [adminId, setAdminId] = useState("")
  const [capturistaId, setCapturistaId] = useState("")

  const assignableUsers = availableUsers.filter(
    (u) => !miembros.some((m) => m.id === u.id)
  )

  const admins = assignableUsers.filter((u) => u.role?.name === "ADMIN")
  const capturistas = assignableUsers.filter(
    (u) => u.role?.name === "CAPTURISTA"
  )

  const handleAdd = async (
    userId: string,
    rolObra: ObraRol,
    clearFn: () => void
  ) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await addMiembro(obraId, userId, rolObra)
      clearFn()
    } catch (err: any) {
      setError(err.message || "Error al añadir miembro.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveClick = (id: string, name: string) => {
    setMemberToRemove({ id, name })
  }

  const executeRemove = async () => {
    if (!memberToRemove) return
    try {
      await removeMiembro(obraId, memberToRemove.id)
    } catch (err: any) {
      setAlertMsg(err.message || "Error al remover miembro.")
    }
  }

  const sortedMiembros = [...miembros].sort((a, b) => {
    if (a.rol === b.rol) return a.name.localeCompare(b.name)
    return a.rol === "ADMIN" ? -1 : 1
  })

  return (
    <div className="space-y-8">
      {/* Role-Specific Assignment Forms */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            Asignar Miembros por Rol
          </h3>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 p-3 text-sm font-medium text-rose-500">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Administradores */}
          <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-4">
            <Label className="text-sm font-medium text-foreground/80">
              Administrador
            </Label>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Select
                  value={adminId}
                  onValueChange={(val) => setAdminId(val || "")}
                  disabled={admins.length === 0}
                >
                  <SelectTrigger className="h-10 w-full truncate rounded-xl border-none bg-background text-sm text-foreground">
                    <SelectValue placeholder="Seleccionar...">
                      {adminId
                        ? admins.find((u) => u.id === adminId)?.name
                        : admins.length === 0
                          ? "Sin administradores"
                          : "Seleccionar..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none bg-popover text-popover-foreground">
                    {admins.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        className="cursor-pointer truncate rounded-lg hover:bg-accent focus:bg-accent"
                      >
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={loading || !adminId}
                onClick={() =>
                  handleAdd(adminId, "ADMIN", () => setAdminId(""))
                }
                className="h-10 rounded-xl px-6 transition-all"
              >
                Asignar
              </Button>
            </div>
          </div>

          {/* Capturistas */}
          <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-4">
            <Label className="text-sm font-medium text-foreground/80">
              Capturista
            </Label>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Select
                  value={capturistaId}
                  onValueChange={(val) => setCapturistaId(val || "")}
                  disabled={capturistas.length === 0}
                >
                  <SelectTrigger className="h-10 w-full truncate rounded-xl border-none bg-background text-sm text-foreground">
                    <SelectValue placeholder="Seleccionar...">
                      {capturistaId
                        ? capturistas.find((u) => u.id === capturistaId)?.name
                        : capturistas.length === 0
                          ? "Sin capturistas"
                          : "Seleccionar..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none bg-popover text-popover-foreground">
                    {capturistas.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        className="cursor-pointer truncate rounded-lg hover:bg-accent focus:bg-accent"
                      >
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={loading || !capturistaId}
                onClick={() =>
                  handleAdd(capturistaId, "CAPTURISTA", () =>
                    setCapturistaId("")
                  )
                }
                className="h-10 rounded-xl px-6 transition-all"
              >
                Asignar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            Miembros Actuales
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
            {miembros.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sortedMiembros.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-muted/40 p-8 text-center text-muted-foreground">
              <p>No hay miembros asignados a esta obra.</p>
            </div>
          ) : (
            sortedMiembros.map((miembro) => (
              <div
                key={miembro.id}
                className="group flex items-center justify-between rounded-2xl bg-muted/30 p-4 transition-all hover:bg-muted/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                    {miembro.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {miembro.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {miembro.email}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex flex-shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      miembro.rol === "ADMIN"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {miembro.rol}
                  </span>
                  <button
                    onClick={() => handleRemoveClick(miembro.id, miembro.name)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-rose-400/10 hover:text-rose-400"
                    title="Remover miembro"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog
        open={!!alertMsg}
        onOpenChange={() => setAlertMsg(null)}
        title="Aviso"
        description={alertMsg || ""}
      />

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remover Miembro"
        description={`¿Está seguro que desea remover a ${memberToRemove?.name} de esta obra?`}
        onConfirm={executeRemove}
      />
    </div>
  )
}
