import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import CreateProveedorModal from "@/app/components/CreateProveedorModal"
import ProveedorActions from "@/app/components/ProveedorActions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Building, FileText, Calendar } from "lucide-react"
import CopyableText from "@/app/components/CopyableText"
import PdfPreviewButton from "@/app/components/PdfPreviewButton"
import SortableTableHead from "@/app/components/SortableTableHead"

export const dynamic = "force-dynamic"

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string, sortBy?: string, sortOrder?: string }>
}) {
  const params = await searchParams
  const search = params?.search || ""
  const sortBy = params?.sortBy || "nombre"
  const sortOrder = params?.sortOrder === "desc" ? "desc" : "asc"

  const session = await auth()
  const user = session?.user as any

  if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
    redirect("/403")
  }

  let orderBy: any = {}
  if (sortBy === "nombre") {
    orderBy = { nombre: sortOrder }
  } else if (sortBy === "rfc") {
    orderBy = { rfc: sortOrder }
  } else if (sortBy === "createdAt") {
    orderBy = { createdAt: sortOrder }
  } else {
    orderBy = { nombre: sortOrder }
  }

  const proveedores = await prisma.proveedor.findMany({
    where: search
      ? {
          OR: [
            {
              AND: search
                .trim()
                .split(/\s+/)
                .map((word) => ({
                  nombre: { contains: word, mode: "insensitive" },
                })),
            },
            {
              AND: search
                .trim()
                .split(/\s+/)
                .map((word) => ({
                  rfc: { contains: word, mode: "insensitive" },
                })),
            },
          ],
        }
      : undefined,
    orderBy,
  })

  return (
    <div className="space-y-6">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            Catálogo de Proveedores
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfPreviewButton
            url={`/api/reportes/proveedores?format=pdf${search ? `&search=${search}` : ""}`}
            title="Reporte de Proveedores"
            className="flex h-9 cursor-pointer items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (PDF)
          </PdfPreviewButton>
          <a
            href={`/api/reportes/proveedores?format=excel${search ? `&search=${search}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-blue-400 text-foreground/90 transition-all hover:bg-muted"
          >
            Reporte (Excel)
          </a>
          <CreateProveedorModal />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="nombre" label="Nombre del Proveedor" icon={<Building className="h-4 w-4" />} />
            <SortableTableHead column="rfc" label="RFC" icon={<FileText className="h-4 w-4" />} />
            <SortableTableHead column="createdAt" label="Fecha de Registro" icon={<Calendar className="h-4 w-4" />} />
            <TableHead className="w-[120px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedores.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-semibold text-white">
                {p.nombre}
              </TableCell>
              <TableCell className="font-mono text-white uppercase">
                {p.rfc ? (
                  <CopyableText text={p.rfc} label="RFC" />
                ) : (
                  <span className="text-muted-foreground/50 italic">
                    Sin RFC
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <ProveedorActions id={p.id} nombre={p.nombre} rfc={p.rfc} />
              </TableCell>
            </TableRow>
          ))}
          {proveedores.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No hay proveedores registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
