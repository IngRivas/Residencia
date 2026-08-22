"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  updateUserRole,
  deleteUser,
  changeUserPassword,
} from "@/lib/actions/users"
import { AlertDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Eye, EyeOff } from "lucide-react"

interface UserActionsProps {
  id: string
  email: string
  roleId: string
  roleName: string
  currentUserId?: string
  currentUserRole?: string
  availableRoles: { id: string; name: string; isSystem: boolean }[]
}

export default function UserActions({
  id,
  email,
  roleId: initialRoleId,
  roleName,
  currentUserId,
  currentUserRole,
  availableRoles,
}: UserActionsProps) {
  const [role, setRole] = useState<string>(initialRoleId)
  const [loading, setLoading] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const isLocked = currentUserRole === "ADMIN" && roleName === "SUPER_ADMIN"

  const handleRoleChange = async (newRoleId: string) => {
    setLoading(true)
    try {
      await updateUserRole(id, newRoleId)
      setRole(newRoleId)
    } catch (err: any) {
      setAlertMsg(err.message || "Ocurrió un error.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = () => {
    setConfirmDeleteOpen(true)
  }

  const executeDelete = async () => {
    setLoading(true)
    try {
      await deleteUser(id)
      setConfirmDeleteOpen(false)
    } catch (err: any) {
      setAlertMsg(err.message || "Ocurrió un error al eliminar.")
      setConfirmDeleteOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setAlertMsg("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    setLoading(true)
    try {
      await changeUserPassword(id, newPassword)
      setPasswordOpen(false)
      setNewPassword("")
      setAlertMsg("Contraseña actualizada con éxito.")
    } catch (err: any) {
      setAlertMsg(err.message || "Ocurrió un error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPasswordOpen(true)}
          disabled={isLocked}
          className="h-8 border-border text-xs text-foreground hover:bg-accent disabled:opacity-50"
        >
          Contraseña
        </Button>
        <Select
          value={role}
          onValueChange={(val) => handleRoleChange(val as string)}
          disabled={loading || id === currentUserId || isLocked}
        >
          <SelectTrigger className="h-8 w-[170px] border-border bg-card text-xs text-foreground capitalize disabled:opacity-50">
            <SelectValue>
              {availableRoles
                .find((r) => r.id === role)
                ?.name.replace(/_/g, " ")
                .toLowerCase() || "Seleccionar..."}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            side="bottom"
            align="end"
            className="min-w-[170px] border-border bg-background text-foreground"
          >
            {availableRoles.map((r) => (
              <SelectItem key={r.id} value={r.id} className="capitalize">
                {r.name.replace(/_/g, " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDeleteClick}
          disabled={loading || id === currentUserId || isLocked}
          className="h-8 border-border text-rose-400 hover:bg-rose-950/20 disabled:opacity-50"
        >
          Eliminar
        </Button>
      </div>

      <AlertDialog
        open={!!alertMsg}
        onOpenChange={() => setAlertMsg(null)}
        title="Aviso"
        description={alertMsg || ""}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Confirmar Eliminación"
        description={`¿Está seguro que desea eliminar al usuario ${email}?`}
        onConfirm={executeDelete}
      />

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent
          title="Cambiar Contraseña"
          showCloseButton={true}
          className="w-fit gap-4 px-6 pt-6 pb-0"
          rightAction={
            <Button
              type="submit"
              form={`password-form-${id}`}
              disabled={loading}
              size="sm"
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          }
        >
          <form
            id={`password-form-${id}`}
            onSubmit={handlePasswordChange}
            className="min-w-[280px] space-y-4 pt-2 pb-6 sm:min-w-[350px]"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="border-border bg-card pr-10"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowPassword((prev) => !prev)
                  }}
                  className="absolute top-1/2 right-1 z-10 -translate-y-1/2 cursor-pointer p-2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="pointer-events-none h-4 w-4" />
                  ) : (
                    <Eye className="pointer-events-none h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
