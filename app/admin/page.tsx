import { prisma } from "@/lib/db"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ObraEstado } from "@prisma/client"
import CreateObraModal from "@/app/components/CreateObraModal"
import ObrasTable from "@/app/components/ObrasTable"
import ActivityFeed from "@/app/components/ActivityFeed"
import { formatCurrency } from "@/lib/formatters"
import { getRecentActivity } from "@/lib/actions/logs"
import StatCard from "@/app/components/StatCard"
import TableSortDropdown from "@/app/components/TableSortDropdown"
import PdfPreviewButton from "@/app/components/PdfPreviewButton"
import { buttonVariants } from "@/components/ui/button"
import { FileSpreadsheet } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    sortBy?: string
    sortOrder?: string
    search?: string
  }>
}) {
  const params = await searchParams
  const search = params?.search || ""

  const session = await import("@/auth").then((m) => m.auth())
  const user = session?.user as any
  const fullUser = await prisma.user.findUnique({ where: { id: user?.id } })
  const initialTextZoom = fullUser?.textZoom || 0

  // Fetch active projects
  const activeObras = await prisma.obra.findMany({
    where: {
      estado: {
        in: [ObraEstado.ACTIVA, ObraEstado.PAUSADA],
      },
      deletedAt: null,
      ...(search
        ? {
            AND: search
              .trim()
              .split(/\s+/)
              .map((word) => ({
                nombre: { contains: word, mode: "insensitive" },
              })),
          }
        : {}),
    },
    include: {
      dias: {
        where: { deletedAt: null },
        include: {
          gastos: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
  })

  const recentLogs = await getRecentActivity(50)

  // Fetch available admins
  const admins = await prisma.user.findMany({
    where: {
      role: {
        name: "ADMIN",
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })

  // Calculate global KPIs and generate history arrays for graphs
  let totalActiveObras = activeObras.length
  let globalBudget = 0
  let globalSpent = 0

  const activeObrasSorted = [...activeObras].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  const activeObrasData: number[] = [0]
  const budgetData: number[] = [0]
  const spentData: number[] = [0]
  const balanceData: number[] = [0]

  let cumActive = 0
  let cumBudget = 0
  let cumSpent = 0

  activeObrasSorted.forEach((obra) => {
    cumActive++
    let b = 0
    let s = 0
    obra.dias.forEach((dia) => {
      b += Number(dia.presupuestoDiario) + Number((dia as any).reposicion || 0)
      dia.gastos.forEach((g) => {
        if (!(g as any).noAfectaPresupuesto) {
          s += Number(g.total)
        }
      })
    })
    if (obra.dias.length === 0) {
      b = Number(obra.presupuestoTotal)
    }
    cumBudget += b
    cumSpent += s

    activeObrasData.push(cumActive)
    budgetData.push(cumBudget)
    spentData.push(cumSpent)
    balanceData.push(cumBudget - cumSpent)
  })

  const obrasFormatted = activeObras.map((obra) => {
    let budget = 0
    let spent = 0
    obra.dias.forEach((dia) => {
      budget +=
        Number(dia.presupuestoDiario) + Number((dia as any).reposicion || 0)
      dia.gastos.forEach((gasto) => {
        if (!(gasto as any).noAfectaPresupuesto) {
          spent += Number(gasto.total)
        }
      })
    })

    if (obra.dias.length === 0) {
      budget = Number(obra.presupuestoTotal)
    }

    globalBudget += budget
    globalSpent += spent
    const balance = budget - spent

    return {
      id: obra.id,
      nombre: obra.nombre,
      budget,
      spent,
      balance,
      estado: obra.estado,
      dateValue: obra.createdAt.toLocaleDateString(),
      rawDate: obra.createdAt.getTime(),
    }
  })

  const sortBy = params.sortBy
  const sortOrder = params.sortOrder || "desc"

  if (sortBy) {
    obrasFormatted.sort((a, b) => {
      let valA: any = a.nombre
      let valB: any = b.nombre

      if (sortBy === "presupuesto") {
        valA = a.budget
        valB = b.budget
      } else if (sortBy === "gastado") {
        valA = a.spent
        valB = b.spent
      } else if (sortBy === "saldo") {
        valA = a.balance
        valB = b.balance
      } else if (sortBy === "fecha") {
        valA = a.rawDate
        valB = b.rawDate
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }

  const globalBalance = globalBudget - globalSpent

  return (
    <div className="space-y-6">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
            Obras Activas
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfPreviewButton
            url={`/api/reportes/global?format=pdf`}
            title="Reporte Global de Obras"
            className="flex h-9 cursor-pointer items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (PDF)
          </PdfPreviewButton>
          <a
            href={`/api/reportes/global?format=excel`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-blue-400 text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (Excel)
          </a>
          <TableSortDropdown />
          <CreateObraModal admins={admins} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Proyectos Activos"
          value={totalActiveObras}
          data={activeObrasData}
        />
        <StatCard
          title="Presupuesto Global"
          value={formatCurrency(globalBudget)}
          data={budgetData}
        />
        <StatCard
          title="Gasto Acumulado"
          value={formatCurrency(globalSpent)}
          data={spentData}
        />
        <StatCard
          title="Saldo Remanente"
          value={formatCurrency(globalBalance)}
          data={balanceData}
        />
      </div>

      {/* Projects List and Activity Feed Split */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-2 lg:col-span-3">
          <div id="admin-content-zoom">
            <ObrasTable obras={obrasFormatted} type="active" />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed logs={recentLogs} />
        </div>
      </div>
    </div>
  )
}
