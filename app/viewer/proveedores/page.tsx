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

import CopyableText from "@/app/components/CopyableText"
import PdfPreviewButton from "@/app/components/PdfPreviewButton"

export const dynamic = "force-dynamic"

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const params = await searchParams
  const search = params?.search || ""

  const session = await auth()
  const user = session?.user as any

  if (user?.role !== "VIEWER") {
    redirect("/403")
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
    orderBy: { nombre: "asc" },
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
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre del Proveedor</TableHead>
            <TableHead>RFC</TableHead>
            <TableHead>Fecha de Registro</TableHead>
            <TableHead className="w-[120px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedores.map((p) => (
            <TableRow key={p.id} className="h-[65px]">
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
              <TableCell className="w-[120px] text-right"></TableCell>
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
