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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createUser } from "@/lib/actions/users"
import { Eye, EyeOff } from "lucide-react"
import { sileo } from "sileo"

interface CreateUserModalProps {
  roles: { id: string; name: string; isSystem: boolean }[]
}

export default function CreateUserModal({ roles }: CreateUserModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const defaultRole =
    roles.find((r) => r.name === "CAPTURISTA")?.id || roles[0]?.id || ""
  const [roleId, setRoleId] = useState<string>(defaultRole)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !roleId) {
      sileo.error({
        title: "Error",
        description: "Todos los campos son obligatorios.",
      })
      setErrorMsg("Todos los campos son obligatorios.")
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      await createUser({ name, email, password, roleId })
      setOpen(false)
      setName("")
      setEmail("")
      setPassword("")
      setRoleId(defaultRole)
      sileo.success({
        title: "Éxito",
        description: "Usuario creado exitosamente.",
      })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Ocurrió un error al crear el usuario.",
      })
      setErrorMsg(err.message || "Ocurrió un error al crear el usuario.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo Usuario</Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="w-fit text-foreground"
        title="Crear Nuevo Usuario"
        rightAction={
          <Button
            type="submit"
            form="create-user-form"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? "Creando..." : "Crear"}
          </Button>
        }
      >
        <form
          id="create-user-form"
          onSubmit={handleSubmit}
          className="min-w-[280px] space-y-4 pb-0 sm:min-w-[350px]"
        >
          {errorMsg && (
            <div className="rounded-md bg-rose-500/10 p-3 text-sm text-rose-500">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input
              id="name"
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-none bg-zinc-800 text-foreground shadow-none"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@mcacorporation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-none bg-zinc-800 text-foreground shadow-none"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Escribe la contraseña..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-none bg-zinc-800 pr-10 text-foreground shadow-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rol del Usuario</Label>
            <Select
              value={roleId}
              onValueChange={(val) => setRoleId(val as string)}
            >
              <SelectTrigger className="w-full border-none bg-zinc-800 text-foreground capitalize shadow-none">
                <SelectValue placeholder="Selecciona un rol">
                  {roles
                    .find((r) => r.id === roleId)
                    ?.name.replace(/_/g, " ")
                    .toLowerCase() || "Selecciona un rol"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-none bg-zinc-900 text-foreground shadow-none">
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="capitalize">
                    {r.name.replace(/_/g, " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
