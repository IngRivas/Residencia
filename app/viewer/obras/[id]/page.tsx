import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UsersIcon } from "lucide-react"
import ProjectDaysTable from "@/app/components/ProjectDaysTable"
import CloseProjectButton from "@/app/components/CloseProjectButton"
import ObraActions from "@/app/components/ObraActions"
import { formatCurrency } from "@/lib/formatters"
import StatCard from "@/app/components/StatCard"
import PdfPreviewButton from "@/app/components/PdfPreviewButton"
import { AssignMembersModal } from "@/app/components/AssignMembersModal"

export const dynamic = "force-dynamic"

interface ObraDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ObraDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ proveedor?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const proveedorFilter = sp?.proveedor || ""
  const providerQuery = proveedorFilter
    ? `&proveedor=${encodeURIComponent(proveedorFilter)}`
    : ""

  const obra = await prisma.obra.findFirst({
    where: { id, deletedAt: null },
    include: {
      miembros: {
        include: {
          user: true,
        },
      },
      dias: {
        where: { deletedAt: null },
        include: {
          gastos: {
            where: { deletedAt: null },
            include: {
              creadoPor: {
                select: { role: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: {
          fecha: "desc",
        },
      },
    },
  })

  if (!obra) {
    notFound()
  }

  const availableUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
    },
  })

  // Helper: returns true if a gasto was created by an admin (should not count toward budget)
  const isAdminGasto = (gasto: any) => {
    return gasto.noAfectaPresupuesto
  }

  // Calculate cumulative data for charts (must be chronological)
  const chronologicalDias = [...obra.dias].sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime()
  )
  const budgetData: number[] = []
  const spentData: number[] = []
  const balanceData: number[] = []

  let budgetTotal = 0
  let totalSpent = 0

  if (obra.dias.length === 0) {
    budgetTotal = Number(obra.presupuestoTotal)
    budgetData.push(budgetTotal)
    spentData.push(0)
    balanceData.push(budgetTotal)
  } else {
    // Start at zero to show the curve starting from the beginning
    budgetData.push(0)
    spentData.push(0)
    balanceData.push(0)

    chronologicalDias.forEach((dia) => {
      let daySpent = 0
      dia.gastos.forEach((g) => {
        // Skip admin gastos — they don't affect the budget
        if (!isAdminGasto(g)) {
          daySpent += Number(g.total)
        }
      })
      const diaReposicion = Number(dia.reposicion || 0)
      budgetTotal += Number(dia.presupuestoDiario) + diaReposicion
      totalSpent += daySpent

      budgetData.push(budgetTotal)
      spentData.push(totalSpent)
      balanceData.push(budgetTotal - totalSpent)
    })
  }

  const remainingBalance = budgetTotal - totalSpent

  // Format days for the table (keeps original descending order)
  const daysFormatted = obra.dias.map((dia) => {
    let spent = 0
    const proveedoresTotales: Record<string, { total: number; count: number }> =
      {}

    dia.gastos.forEach((gasto) => {
      const gastoTotal = Number(gasto.total)

      // Admin gastos still appear in the list but don't count toward totalGastado
      if (!isAdminGasto(gasto)) {
        spent += gastoTotal
      }

      const prov = gasto.proveedor || "Sin Proveedor"
      if (!proveedoresTotales[prov]) {
        proveedoresTotales[prov] = { total: 0, count: 0 }
      }
      proveedoresTotales[prov].total += gastoTotal
      proveedoresTotales[prov].count += 1
    })
    const dayBudget = Number(dia.presupuestoDiario)
    const dayReposicion = Number(dia.reposicion || 0)
    const balance = dayBudget + dayReposicion - spent

    return {
      id: dia.id,
      fecha: dia.fecha
        .toLocaleDateString("es-MX", { timeZone: "UTC", dateStyle: "full" })
        .replace(",", ""),
      fechaISO: dia.fecha.toISOString().split("T")[0],
      presupuestoDiario: dayBudget,
      reposicion: dayReposicion,
      totalGastado: spent,
      saldoAFavor: balance,
      gastosCount: dia.gastos.length,
      proveedoresTotales,
    }
  })

  return (
    <div className="space-y-8">
      {/* Navigation and Title */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            {obra.nombre}
          </h1>
        </div>
        <div className="flex gap-2">
          <PdfPreviewButton
            url={`/api/reportes/cierre?obraId=${obra.id}&format=pdf${providerQuery}`}
            title={`Reporte de Obra - ${obra.nombre}`}
            className="flex h-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground/90 shadow-sm transition-all hover:bg-muted"
          >
            Reporte de obra (PDF)
          </PdfPreviewButton>
          <a
            href={`/api/reportes/cierre?obraId=${obra.id}&format=excel${providerQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-blue-400 text-foreground/90 shadow-sm transition-all hover:bg-muted"
          >
            Reporte de obra (Excel)
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Presupuesto Asignado"
          value={formatCurrency(budgetTotal)}
          data={budgetData}
        />
        <StatCard
          title="Gasto Total Acumulado"
          value={formatCurrency(totalSpent)}
          data={spentData}
        />
        <StatCard
          title="Saldo Restante de Obra"
          value={formatCurrency(remainingBalance)}
          data={balanceData}
        />
      </div>

      {/* Layout Split: Days List */}
      <div className="grid gap-8">
        <div className="space-y-6">
          <Card className="border-border bg-card p-6">
            <ProjectDaysTable
              days={daysFormatted}
              obraId={obra.id}
              isReadOnly={true}
              basePath="/viewer/obras"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
