import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import SignOutButton from "@/app/components/SignOutButton"
import CapturaExpenseForm from "@/app/components/CapturaExpenseForm"
import DayExpensesSummary from "@/app/components/DayExpensesSummary"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import CapturaMobileView from "@/app/components/CapturaMobileView"

import CapturaHeaderMenu from "@/app/components/CapturaHeaderMenu"

export const dynamic = "force-dynamic"

interface CapturaFormPageProps {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ fecha?: string }>
}

export default async function CapturaFormPage({
  params,
  searchParams,
}: CapturaFormPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { obraId } = await params
  const resolvedSearchParams = await searchParams
  const dateStr = resolvedSearchParams?.fecha

  const membership = await prisma.obraUser.findFirst({
    where: {
      obraId,
      userId: session.user.id,
      rol: "CAPTURISTA",
    },
    include: { obra: true },
  })

  const user = session.user as any
  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  const initialTextZoom = fullUser?.textZoom || 0

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
  if (!membership && !isAdmin) {
    redirect("/403")
  }

  const obra =
    membership?.obra ||
    (await prisma.obra.findFirst({ where: { id: obraId, deletedAt: null } }))
  if (!obra) {
    notFound()
  }

  // Find or create the DiaObra for the requested date (or today)
  let targetDate = new Date()
  if (dateStr) {
    targetDate = new Date(dateStr + "T12:00:00.000Z") // middle of day to avoid timezone shifts
  } else {
    // No date provided, we could redirect to /captura/[obraId] or just default to today
    // Let's redirect back to jornadas list
    redirect(`/captura/${obraId}`)
  }

  // Check if day exists
  const targetDateStart = new Date(targetDate)
  targetDateStart.setUTCHours(0, 0, 0, 0)
  const targetDateEnd = new Date(targetDate)
  targetDateEnd.setUTCHours(23, 59, 59, 999)

  let dia = await prisma.diaObra.findFirst({
    where: {
      obraId,
      fecha: {
        gte: targetDateStart,
        lte: targetDateEnd,
      },
      deletedAt: null,
    },
    include: {
      gastos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          fotos: true,
        },
      },
    },
  })

  // If day doesn't exist, create it
  if (!dia) {
    dia = await prisma.diaObra.create({
      data: {
        obraId,
        fecha: targetDateStart,
        presupuestoDiario: "0",
      },
      include: { gastos: { include: { fotos: true } } },
    })
  }

  const gastos = dia.gastos || []
  const presupuestoDiario = dia ? Number(dia.presupuestoDiario) : 0.0

  // Calculate totals
  let totalGastado = 0
  gastos.forEach((g) => {
    totalGastado += Number(g.total)
  })
  const saldoAFavor = presupuestoDiario - totalGastado

  return (
    <>
      {/* VISTA DE ESCRITORIO */}
      <div className="hidden min-h-screen flex-col bg-background font-sans text-foreground lg:flex">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
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
              userId={session.user.id}
              initialTextZoom={initialTextZoom}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
          <div>
            <Link
              href={`/captura/${obra.id}`}
              className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-white"
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
              Regresar a la Obra
            </Link>
            <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              {obra.nombre}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Ingresa los gastos para el día de trabajo seleccionado.
            </p>
          </div>

          {/* Date Details Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Fecha de captura actual
              </span>
              <p className="font-bold text-foreground">
                {targetDate.toLocaleDateString("es-MX", {
                  timeZone: "UTC",
                  dateStyle: "long",
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <CapturaExpenseForm
                obraId={obra.id}
                selectedFecha={targetDate.toISOString().split("T")[0]}
                isAdmin={isAdmin}
              />
            </div>

            <div className="lg:col-span-3">
              <DayExpensesSummary
                gastos={gastos.map((g) => ({
                  id: g.id,
                  concepto: g.concepto,
                  proveedor: g.proveedor,
                  subtotal: Number(g.subtotal),
                  porcentajeIVA: Number(g.porcentajeIVA),
                  iva: Number(g.iva),
                  total: Number(g.total),
                  estado: g.estado,
                  notaCapturista: g.notaCapturista || "",
                  fotos: g.fotos.map((f) => f.url),
                }))}
                presupuestoDiario={presupuestoDiario}
                totalGastado={totalGastado}
                saldoAFavor={saldoAFavor}
              />
            </div>
          </div>
        </main>
      </div>

      {/* VISTA MÓVIL */}
      <div className="block lg:hidden">
        <CapturaMobileView
          obraId={obra.id}
          obraNombre={obra.nombre}
          selectedFecha={targetDate.toISOString().split("T")[0]}
          userName={session.user.name || "Capturista"}
          userId={session.user.id}
          isAdmin={isAdmin}
          initialTextZoom={initialTextZoom}
          gastos={gastos.map((g) => ({
            id: g.id,
            concepto: g.concepto,
            proveedor: g.proveedor,
            subtotal: Number(g.subtotal),
            porcentajeIVA: Number(g.porcentajeIVA),
            iva: Number(g.iva),
            total: Number(g.total),
            estado: g.estado,
            notaCapturista: g.notaCapturista || "",
            fotos: g.fotos.map((f) => f.url),
          }))}
          presupuestoDiario={presupuestoDiario}
          totalGastado={totalGastado}
          saldoAFavor={saldoAFavor}
        />
      </div>
    </>
  )
}
