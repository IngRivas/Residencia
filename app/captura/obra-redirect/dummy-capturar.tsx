import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import SignOutButton from "@/app/components/SignOutButton"
import CapturaExpenseForm from "@/app/components/CapturaExpenseForm"
import DayExpensesSummary from "@/app/components/DayExpensesSummary"
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
  const sparams = await searchParams

  // Check project membership for this user
  const membership = await prisma.obraUser.findFirst({
    where: {
      obraId,
      userId: session.user.id,
      rol: "CAPTURISTA",
    },
    include: {
      obra: true,
    },
  })

  const user = session.user as any
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
  if (!membership && !isAdmin) {
    redirect("/403")
  }

  const obra =
    membership?.obra ||
    (await prisma.obra.findUnique({ where: { id: obraId } }))
  if (!obra) {
    notFound()
  }

  // Get date for capture: default to today (local YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0]
  const queryFecha = sparams.fecha || todayStr
  const queryFechaDate = new Date(queryFecha + "T00:00:00")

  // Fetch DiaObra
  const diaObra = await prisma.diaObra.findUnique({
    where: {
      obraId_fecha: {
        obraId,
        fecha: queryFechaDate,
      },
    },
    include: {
      gastos: {
        include: {
          fotos: true,
        },
      },
    },
  })

  const gastos = diaObra?.gastos || []
  const presupuestoDiario = diaObra ? Number(diaObra.presupuestoDiario) : 0.0

  // Calculate totals
  let totalGastado = 0
  gastos.forEach((g) => {
    totalGastado += Number(g.total)
  })
  const saldoAFavor = presupuestoDiario - totalGastado

  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
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
                className="brightness-0 invert"
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
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            {obra.nombre}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Ingresa los gastos para el día de trabajo seleccionado.
          </p>
        </div>

        {/* Date Details Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/30 p-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
              Fecha de captura actual
            </span>
            <p className="font-bold text-foreground/90">
              {queryFechaDate.toLocaleDateString("es-MX", {
                timeZone: "UTC",
                dateStyle: "long",
              })}
            </p>
          </div>
        </div>

        {/* Form and Summary side-by-side */}
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <CapturaExpenseForm obraId={obra.id} selectedFecha={queryFecha} />
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
  )
}
