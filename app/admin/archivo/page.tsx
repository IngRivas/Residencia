import { prisma } from "@/lib/db"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ObraEstado } from "@prisma/client"
import Link from "next/link"
import { auth } from "@/auth"
import ObrasTable from "@/app/components/ObrasTable"
import TableSortDropdown from "@/app/components/TableSortDropdown"
import PdfPreviewButton from "@/app/components/PdfPreviewButton"

export const dynamic = "force-dynamic"

interface ArchivoPageProps {
  searchParams: Promise<{
    search?: string
    minBudget?: string
    maxBudget?: string
    sortBy?: string
    sortOrder?: string
  }>
}

export default async function ArchivoPage({ searchParams }: ArchivoPageProps) {
  const session = await auth()
  const user = session?.user as any
  const isSuperAdmin = user?.role === "SUPER_ADMIN"

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
  const initialTextZoom = fullUser?.textZoom || 0

  const params = await searchParams
  const search = params.search || ""
  const minBudget = params.minBudget ? parseFloat(params.minBudget) : undefined
  const maxBudget = params.maxBudget ? parseFloat(params.maxBudget) : undefined

  // Filter in database
  const archivedObras = await prisma.obra.findMany({
    where: {
      estado: {
        in: [ObraEstado.ARCHIVADA, ObraEstado.CERRADA],
      },
      presupuestoTotal: {
        gte: minBudget,
        lte: maxBudget,
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
      updatedAt: "desc",
    },
  })

  const obrasFormatted = archivedObras.map((obra) => {
    let budget = 0
    let spent = 0
    obra.dias.forEach((dia) => {
      budget += Number(dia.presupuestoDiario)
      dia.gastos.forEach((gasto) => {
        spent += Number(gasto.total)
      })
    })
    if (obra.dias.length === 0) {
      budget = Number(obra.presupuestoTotal)
    }
    const balance = budget - spent

    return {
      id: obra.id,
      nombre: obra.nombre,
      budget,
      spent,
      balance,
      estado: obra.estado,
      dateValue: obra.updatedAt.toLocaleDateString(),
      rawDate: obra.updatedAt.getTime(),
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

  return (
    <div className="space-y-8">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
            Archivo de Obras
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfPreviewButton
            url={`/api/reportes/global?format=pdf&status=archived${search ? `&search=${search}` : ""}`}
            title="Reporte de Archivo de Obras"
            className="flex h-9 cursor-pointer items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (PDF)
          </PdfPreviewButton>
          <a
            href={`/api/reportes/global?format=excel&status=archived${search ? `&search=${search}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-blue-400 text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (Excel)
          </a>
          <TableSortDropdown />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div id="admin-content-zoom">
          <ObrasTable obras={obrasFormatted} type="archived" search={search} />
        </div>
      </div>
    </div>
  )
}
