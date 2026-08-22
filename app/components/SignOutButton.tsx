"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export default function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="h-10 w-full rounded-full border-none bg-red-500/10 px-4 text-xs font-medium text-red-500 transition-all hover:bg-red-500/20 hover:text-red-600"
      >
        {loading ? (
          <span className="animate-pulse">Saliendo...</span>
        ) : (
          <>
            <span className="hidden sm:inline">Cerrar Sesión</span>
            <span className="sm:hidden">Salir</span>
          </>
        )}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Cerrar Sesión?"
        description="Estás a punto de cerrar tu sesión. Tendrás que volver a ingresar tus credenciales para acceder al sistema."
        confirmText="Sí, cerrar sesión"
        cancelText="Cancelar"
        onConfirm={handleSignOut}
      />
    </>
  )
}
