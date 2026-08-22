import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import SignOutButton from "@/app/components/SignOutButton"
import CapturaHeaderMenu from "@/app/components/CapturaHeaderMenu"
import GastoImagesViewer from "@/app/components/GastoImagesViewer"
import { formatCurrency } from "@/lib/formatters"

export const dynamic = "force-dynamic"

export default async function CapturistaHistorialPage() {
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

  // Fetch active assigned projects for the capturista (to know which ones they are assigned to)
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
  })

  const validObraIds = memberships.map((m) => m.obraId)

  // Fetch all gastos created by this user in those active obras
  const gastos = await prisma.gasto.findMany({
    where: {
      creadoPorId: user.id,
      deletedAt: null,
      diaObra: {
        obraId: { in: validObraIds },
      },
    },
    include: {
      fotos: true,
      diaObra: {
        include: {
          obra: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Group gastos by Obra
  const gastosByObra = gastos.reduce(
    (acc, gasto) => {
      const obraId = gasto.diaObra.obraId
      if (!acc[obraId]) {
        acc[obraId] = {
          obraNombre: gasto.diaObra.obra.nombre,
          gastos: [],
        }
      }
      acc[obraId].gastos.push(gasto)
      return acc
    },
    {} as Record<string, { obraNombre: string; gastos: typeof gastos }>
  )

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
  const initialTextZoom = fullUser?.textZoom || 0

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link href="/captura" className="shrink-0">
              <Image
                src="/Logo MCA horizontal.svg"
                alt="MCA Corp"
                width={120}
                height={24}
                className="brightness-0 dark:invert"
              />
            </Link>
          </div>

          <CapturaHeaderMenu
            userId={user.id}
            initialTextZoom={initialTextZoom}
          />
        </div>
      </header>

      <main className="w-full flex-1 space-y-8 px-2 py-8 sm:px-4">
        <div>
          <Link
            href="/captura"
            className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Regresar a Captura
          </Link>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Historial de Gastos
          </h1>
          <p className="mt-1 text-muted-foreground">
            Revisa el detalle de los gastos que has capturado por cada obra.
          </p>
        </div>

        {Object.keys(gastosByObra).length === 0 ? (
          <Card className="border-border/50 bg-background/40 p-6">
            <p className="py-8 text-center text-sm text-muted-foreground">
              No has capturado ningún gasto en tus obras activas.
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.values(gastosByObra).map((obraGroup, idx) => (
              <div key={idx} className="space-y-4">
                <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-5 w-5 text-primary"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12.25M3 3v18"
                    />
                  </svg>
                  {obraGroup.obraNombre}
                </h2>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9">
                  {obraGroup.gastos.map((gasto) => (
                    <div
                      key={gasto.id}
                      className="flex w-full flex-col rounded border border-border/50 bg-card p-2 shadow-sm transition-colors hover:border-border"
                    >
                      <div className="flex w-full flex-col gap-0.5">
                        <div className="flex w-full items-start justify-between gap-1">
                          <span
                            className="line-clamp-1 text-[10px] leading-tight font-semibold text-foreground"
                            title={gasto.concepto}
                          >
                            {gasto.concepto}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold text-foreground">
                            {formatCurrency(Number(gasto.total))}
                          </span>
                        </div>

                        <div className="mt-0.5 flex w-full flex-col">
                          <span
                            className="line-clamp-1 text-[9px] leading-tight font-medium text-muted-foreground"
                            title={gasto.proveedor}
                          >
                            {gasto.proveedor}
                          </span>
                          <div className="mt-1 flex w-full items-center justify-between">
                            <span className="text-[8px] leading-tight text-muted-foreground">
                              {gasto.diaObra.fecha.toLocaleDateString("es-MX", {
                                timeZone: "UTC",
                              })}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <GastoImagesViewer fotos={gasto.fotos} />
                              <span className="text-[8px] leading-tight font-bold text-muted-foreground uppercase">
                                {gasto.estado}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
