"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { sileo } from "sileo"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)


    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === "OUT_OF_HOURS") {
          sileo.info({
            title: "Recuerda",
            description: "Estás intentando entrar fuera de horario laboral.",
          })
        } else if (result.error === "Configuration") {
          sileo.error({
            title: "Error de Servidor",
            description: "No se pudo conectar a la base de datos o hay un error de configuración.",
          })
        } else {
          sileo.error({
            title: "Error",
            description: "Credenciales incorrectas o usuario no encontrado.",
          })
        }
      } else {
        // Redirigir según el rol o dejar que la página de redirección post-login haga el trabajo
        router.refresh()
        router.push("/")
      }
    } catch (err) {
      sileo.error({
        title: "Error",
        description: "Ocurrió un error inesperado. Inténtelo de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>

      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/80 via-background/40 to-background/90"></div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-black text-primary-foreground shadow-lg shadow-primary/20">
            S
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              SPEND
            </h1>
            <h2 className="text-sm font-medium text-muted-foreground">
              Control de gastos
            </h2>
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl bg-card p-7 shadow-xl"
        >


          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold tracking-wide text-muted-foreground"
            >
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              placeholder="jdeharo@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full bg-muted px-5 py-3 text-sm text-foreground placeholder-slate-600 outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold tracking-wide text-muted-foreground"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full bg-muted py-3 pr-12 pl-5 text-sm text-foreground placeholder-slate-600 outline-none"
                required
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setShowPassword((prev) => !prev)
                }}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 cursor-pointer p-2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? (
                  <EyeOff className="pointer-events-none h-5 w-5" />
                ) : (
                  <Eye className="pointer-events-none h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {loading ? "Iniciando Sesión..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SPEND. Todos los derechos
          reservados.
        </div>
      </div>
    </div>
  )
}
