import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import SignOutButton from "@/app/components/SignOutButton"
import CapturaHeaderMenu from "@/app/components/CapturaHeaderMenu"
import { formatCurrency } from "@/lib/formatters"

export const dynamic = "force-dynamic"

interface CapturaDetailPageProps {
  params: Promise<{ obraId: string }>
}

export default async function CapturaDetailPage({
  params,
}: CapturaDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { obraId } = await params

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
    (await prisma.obra.findFirst({ where: { id: obraId, deletedAt: null } }))
  if (!obra) {
    notFound()
  }

  // Fetch all days of this project ordered by date ascending
  const dias = await prisma.diaObra.findMany({
    where: { obraId, deletedAt: null },
    include: { gastos: { where: { deletedAt: null } } },
    orderBy: { fecha: "asc" },
  })

  // Calculate project budgets and spent totals dynamically
  const daysFormatted = dias.map((dia, index) => {
    let spent = 0
    dia.gastos.forEach((gasto) => {
      if (!(gasto as any).noAfectaPresupuesto) {
        spent += Number(gasto.total)
      }
    })
    const dayBudget = Number(dia.presupuestoDiario)

    return {
      id: dia.id,
      numeroDia: index + 1,
      fecha: dia.fecha
        .toLocaleDateString("es-MX", { timeZone: "UTC", dateStyle: "full" })
        .replace(",", ""),
      fechaISO: dia.fecha.toISOString().split("T")[0],
      presupuestoDiario: dayBudget,
      totalGastado: spent,
      saldo: dayBudget - spent,
      gastosCount: dia.gastos.length,
    }
  })

  // Calculate today's date in Mexico time to find today's budget
  const mxDateStr = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  })
  const todayDate = new Date(mxDateStr)
  todayDate.setHours(0, 0, 0, 0)

  const todayYear = todayDate.getFullYear()
  const todayMonth = String(todayDate.getMonth() + 1).padStart(2, "0")
  const todayDay = String(todayDate.getDate()).padStart(2, "0")
  const isoToday = `${todayYear}-${todayMonth}-${todayDay}`

  let budgetTotal = 0
  let totalSpent = 0

  // Use today's budget and spent for the KPI cards
  const todayData = daysFormatted.find((d) => d.fechaISO === isoToday)
  if (todayData) {
    budgetTotal = todayData.presupuestoDiario
    totalSpent = todayData.totalGastado
  } else {
    // Fallback if today's day has not been created yet
    budgetTotal = 0
  }

  const remainingBalance = budgetTotal - totalSpent

  const availableDays = [-1, 0, 1, 2].map((offset) => {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - offset)
    const isToday = offset === 0
    const isTomorrow = offset === -1

    // Create a strict ISO string YYYY-MM-DD for the value
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const iso = `${year}-${month}-${day}`

    // Format DD/MM/YYYY for display
    const formatted = `${day}/${month}/${year}`

    // Day name
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    let dayName = dayNames[d.getDay()]
    if (isToday) dayName = "Hoy"
    if (isTomorrow) dayName = "Mañ"

    return { iso, formatted, dayName, isToday }
  })

  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  const initialTextZoom = fullUser?.textZoom || 0

  // ISOs the capturista is allowed to add/edit gastos in (within the 2-day window)
  const availableISOs = availableDays.map((d) => d.iso)

  // For capturistas: only show dates that admin has already created AND are within the window
  const adminCreatedISOs = new Set(daysFormatted.map((d) => d.fechaISO))
  const capturableAdminDays = isAdmin
    ? availableDays // admins see all 4 calendar days (including tomorrow)
    : availableDays.filter(
        (d) => adminCreatedISOs.has(d.iso) && d.iso <= isoToday
      ) // capturistas only see admin-created days that are not in the future

  // Filter and reverse the days for the bottom grid
  let displayDays = daysFormatted
  if (!isAdmin) {
    displayDays = daysFormatted.filter((day) =>
      availableISOs.includes(day.fechaISO)
    )
  }
  displayDays = [...displayDays].reverse()

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link href="/captura" className="flex shrink-0 items-center gap-2">
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
        {/* Navigation and Title */}
        <div>
          <Link
            href="/captura"
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
            Regresar a Obras
          </Link>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            {obra.nombre}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Revisa el avance de los presupuestos y las jornadas de trabajo.
          </p>
        </div>

        {/* Start New Work Day - only show if there are capturable days */}
        {capturableAdminDays.length > 0 ? (
          <div className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <div className="relative z-10 flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-black tracking-tight text-foreground">
                  Capturar Gastos
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona la fecha de trabajo a reportar
                </p>
              </div>

              <div className="hide-scrollbar -mx-5 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
                {capturableAdminDays.map((day) => (
                  <Link
                    key={day.iso}
                    href={`/captura/${obra.id}/capturar?fecha=${day.iso}`}
                    className="shrink-0 snap-center focus:outline-none"
                  >
                    <div className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-all hover:bg-muted active:scale-95">
                      <span className="text-[10px] font-bold tracking-widest uppercase opacity-60">
                        {day.dayName}
                      </span>
                      <span className="mt-1 text-xl font-black tracking-tighter">
                        {day.formatted.substring(0, 5)}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium opacity-50">
                        {day.formatted.substring(6)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          !isAdmin && (
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-5 text-sm text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5 shrink-0 text-muted-foreground/60"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              <span>
                No hay jornadas activas disponibles para capturar en los últimos
                días. El administrador debe agregar un día de trabajo para
                habilitar la captura.
              </span>
            </div>
          )
        )}

        {/* KPI Cards */}
        <div className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <Card className="flex min-w-[85vw] shrink-0 snap-center flex-col justify-center gap-2 border-border bg-card p-5 sm:min-w-0">
            <span className="text-sm text-muted-foreground">
              Presupuesto de Jornada Asignado
            </span>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(budgetTotal)}
            </div>
          </Card>
          <Card className="flex min-w-[85vw] shrink-0 snap-center flex-col justify-center gap-2 border-border bg-card p-5 sm:min-w-0">
            <span className="text-sm text-muted-foreground">
              Gasto de la Jornada
            </span>
            <div className="text-2xl font-bold text-foreground/80">
              {formatCurrency(totalSpent)}
            </div>
          </Card>
          <Card className="flex min-w-[85vw] shrink-0 snap-center flex-col justify-center gap-2 border-border bg-card p-5 sm:min-w-0">
            <span className="text-sm text-muted-foreground">
              Saldo Restante
            </span>
            <div className="text-2xl font-bold text-foreground/80">
              {formatCurrency(remainingBalance)}
            </div>
          </Card>
        </div>

        {/* Days List */}
        <div className="border-transparent bg-transparent p-0 sm:rounded-xl sm:border-border sm:bg-card sm:p-6 sm:shadow-sm">
          <h2 className="mb-1 px-1 text-xl font-bold text-foreground sm:px-0">
            Jornadas y Días de Trabajo
          </h2>
          <div>
            {displayDays.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/20 py-8 text-center text-sm text-muted-foreground">
                No hay jornadas de trabajo recientes disponibles para mostrar.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {displayDays.map((day) => {
                  const isFuture = day.fechaISO > isoToday
                  const canCapture =
                    isAdmin ||
                    (availableISOs.includes(day.fechaISO) && !isFuture)
                  return (
                    <div
                      key={day.id}
                      className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-5 shadow-sm"
                    >
                      {/* Header: Dia y Fecha */}
                      <div className="mt-1 flex items-center justify-between border-b border-border/40 pb-3">
                        <span className="text-base font-extrabold tracking-tight text-foreground capitalize">
                          {day.fecha}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          Día {day.numeroDia}
                        </span>
                      </div>

                      {/* Contenido Financiero */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-muted-foreground">
                            Presupuesto
                          </span>
                          <span className="font-semibold text-foreground/90">
                            {formatCurrency(day.presupuestoDiario)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-muted-foreground">
                            Gastado
                          </span>
                          <span className="font-semibold text-foreground/90">
                            {formatCurrency(day.totalGastado)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-sm">
                          <span className="font-bold text-muted-foreground">
                            Saldo Final
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            {formatCurrency(day.saldo)}
                          </span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="mt-auto pt-2">
                        {canCapture ? (
                          <Button
                            asChild
                            size="sm"
                            className="group/btn relative h-10 w-full overflow-hidden rounded-xl"
                          >
                            <Link
                              href={`/captura/${obra.id}/capturar?fecha=${day.fechaISO}`}
                            >
                              <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                                Continuar Captura
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2.5}
                                  stroke="currentColor"
                                  className="h-4 w-4 transition-transform group-hover/btn:translate-x-1"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                                  />
                                </svg>
                              </span>
                            </Link>
                          </Button>
                        ) : (
                          <div className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/40 text-xs text-muted-foreground">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                              />
                            </svg>
                            Fuera de plazo
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
