"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-8 w-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>

      <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
        Acceso Denegado
      </h1>

      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        No tienes los permisos necesarios para acceder a esta sección o página
        del sistema.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button asChild variant="outline">
          <Link href="/">Ir al Inicio</Link>
        </Button>
        <Button
          variant="destructive"
          className="h-12 w-full gap-2 px-6 sm:w-auto"
          onClick={async () => {
            await signOut({ callbackUrl: "/login" })
          }}
        >
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
