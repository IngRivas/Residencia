import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import CapturaHeaderMenu from "@/app/components/CapturaHeaderMenu"

export const dynamic = "force-dynamic"

export default async function CapturaDashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user as any
  if (
    user.role !== "CAPTURISTA" &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    redirect("/403")
  }

  // Fetch assigned active projects
  const memberships = await prisma.obraUser.findMany({
    where: {
      userId: user.id,
      rol: "CAPTURISTA",
      obra: {
        estado: "ACTIVA",
      },
    },
    include: {
      obra: true,
    },
    orderBy: {
      obra: {
        nombre: "asc",
      },
    },
  })

  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  const initialTextZoom = fullUser?.textZoom || 0

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Image
              src="/Logo MCA horizontal.svg"
              alt="MCA Corp"
              width={120}
              height={24}
              className="brightness-0 dark:invert"
            />
          </div>

          <CapturaHeaderMenu
            userId={session.user.id}
            initialTextZoom={initialTextZoom}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        <div className="space-y-4">
          <div>
            <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Mis Obras Asignadas
            </h1>
            <p className="mt-1 text-muted-foreground">
              Selecciona una obra para registrar los gastos del día.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {memberships.length === 0 ? (
              <Card className="border-border bg-card p-8 text-center sm:col-span-2">
                <p className="mb-4 text-muted-foreground">
                  No tienes obras activas asignadas en este momento.
                </p>
                <p className="text-xs text-muted-foreground">
                  Por favor contacta a un administrador para que te asigne a un
                  proyecto.
                </p>
              </Card>
            ) : (
              memberships.map(({ obra }) => {
                return (
                  <Link
                    href={`/captura/${obra.id}`}
                    key={obra.id}
                    className="group block"
                  >
                    <Card className="relative flex h-36 flex-col justify-end overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-[inset_0_0_50px_rgba(255,255,255,0.2)] transition-all duration-300">
                      <div className="absolute bottom-6 left-6 pr-12">
                        <h2 className="text-2xl leading-none font-extrabold tracking-tight text-foreground transition-colors sm:text-3xl">
                          {obra.nombre}
                        </h2>
                      </div>
                      <div className="absolute top-6 right-6 transform text-muted-foreground opacity-50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                          />
                        </svg>
                      </div>
                    </Card>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
