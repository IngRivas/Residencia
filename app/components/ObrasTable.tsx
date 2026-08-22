"use client"

import { useState, useEffect } from "react"
import type { ObraEstado } from "@prisma/client"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Briefcase, DollarSign, TrendingDown, Wallet, Calendar } from "lucide-react"
import SortableTableHead from "@/app/components/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { softDeleteObra, restoreObra } from "@/lib/actions/obras"
import { formatCurrency } from "@/lib/formatters"
import { sileo } from "sileo"

export interface ObraRow {
  id: string
  nombre: string
  budget: number
  spent: number
  balance: number
  estado: ObraEstado
  dateValue: string
}

interface ObrasTableProps {
  obras: ObraRow[]
  type: "active" | "archived"
  search?: string
  isReadOnly?: boolean
  basePath?: string
}

import PdfPreviewModal from "@/app/components/PdfPreviewModal"

export default function ObrasTable({
  obras,
  type,
  search,
  isReadOnly = false,
  basePath = "/admin/obras",
}: ObrasTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isArchived = type === "archived"
  
  const currentSortBy = searchParams.get("sortBy")
  const currentSortOrder = searchParams.get("sortOrder")

  const [obraToDelete, setObraToDelete] = useState<{
    id: string
    nombre: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!obraToDelete) return
    setIsDeleting(true)
    const idToDelete = obraToDelete.id
    setAnimatingId(idToDelete)
    setObraToDelete(null)

    await new Promise((resolve) => setTimeout(resolve, 600))

    try {
      await softDeleteObra(idToDelete)
      sileo.success({
        title: "Éxito",
        description: "Obra movida a la papelera.",
        duration: 8000,
        position: "top-center",
        styles: {
          title: "text-center",
          description: "text-center text-muted-foreground mt-1",
          button: "w-fit px-6 mx-auto mt-3",
        },
        button: {
          title: "Deshacer",
          onClick: async () => {
            try {
              setAnimatingId(null)
              await restoreObra(idToDelete)
              sileo.success({
                title: "Restaurada",
                description: "La obra ha sido restaurada.",
                position: "top-center",
              })
              router.refresh()
            } catch (err) {
              sileo.error({
                title: "Error",
                description: "No se pudo restaurar la obra.",
                position: "top-center",
              })
            }
          },
        },
      })
    } catch (err: any) {
      console.error(err)
      setAnimatingId(null)
      sileo.error({
        title: "Error",
        description: err.message || "Error al eliminar.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const zoomClass = ""

  return (
    <div className="space-y-4">
      <div
        id="obras-table-only-zoom"
        className={`w-full transition-all ${zoomClass}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="nombre" label="Obra" icon={<Briefcase className="h-4 w-4" />} />
              <SortableTableHead column="presupuesto" label="Presupuesto" icon={<DollarSign className="h-4 w-4" />} />
              <SortableTableHead column="gastado" label="Total Gastado" icon={<TrendingDown className="h-4 w-4" />} />
              <SortableTableHead column="saldo" label="Saldo Restante" icon={<Wallet className="h-4 w-4" />} />
              {isArchived && <TableHead>Estado</TableHead>}
              <SortableTableHead column="fecha" label={isArchived ? "Fecha de Cierre" : "Inicio"} icon={<Calendar className="h-4 w-4" />} />
              <TableHead className="w-[140px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="p-8 text-center text-muted-foreground"
                >
                  {isArchived
                    ? "No se encontraron obras archivadas."
                    : "No hay obras activas en este momento."}
                </TableCell>
              </TableRow>
            ) : (
              obras.map((obra, index) => (
                <TableRow
                  key={obra.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${animatingId === obra.id ? "animate-fade-out-blur pointer-events-none" : ""}`}
                  onClick={() => router.push(`${basePath}/${obra.id}`)}
                >
                  <TableCell className="font-semibold text-foreground/90">
                    {obra.nombre}
                  </TableCell>
                  <TableCell>{formatCurrency(obra.budget)}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(obra.spent)}
                  </TableCell>
                  <TableCell className="font-bold text-foreground/80">
                    {formatCurrency(obra.balance)}
                  </TableCell>
                  {isArchived && (
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {obra.estado === "CERRADA" ? "ARCHIVADA" : obra.estado}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {obra.dateValue}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex min-h-[32px] justify-end gap-2">
                      {isArchived ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewUrl(
                                `/api/reportes/cierre?obraId=${obra.id}&format=pdf`
                              )
                              setPreviewTitle(
                                `Reporte de Obra - ${obra.nombre}`
                              )
                            }}
                            className={buttonVariants({
                              variant: "secondary",
                              size: "sm",
                              className:
                                "h-8 cursor-pointer text-foreground/80",
                            })}
                          >
                            PDF
                          </button>
                          <a
                            href={`/api/reportes/cierre?obraId=${obra.id}&format=excel`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={buttonVariants({
                              size: "sm",
                              className: "h-8",
                            })}
                          >
                            Excel
                          </a>
                        </>
                      ) : (
                        !isReadOnly && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setObraToDelete({
                                  id: obra.id,
                                  nombre: obra.nombre,
                                })
                              }}
                              title="Mover Obra a Papelera"
                              className="ml-2 flex items-center justify-center rounded border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                />
                              </svg>
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PdfPreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        url={previewUrl}
        title={previewTitle}
      />

      <Dialog
        open={!!obraToDelete}
        onOpenChange={(open) => !open && setObraToDelete(null)}
      >
        <DialogContent
          title={
            <span className="text-lg leading-tight text-destructive">
              ¿Mover esta obra a la papelera?
            </span>
          }
          showCloseButton={false}
          className="gap-4 p-6 sm:max-w-md"
        >
          <DialogDescription className="text-center">
            La obra <strong>{obraToDelete?.nombre}</strong>, todos sus días y
            gastos asociados serán movidos a la papelera. Podrás restaurarlos
            más tarde.
          </DialogDescription>
          <DialogFooter className="mt-2 flex w-full flex-row gap-3 sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => setObraToDelete(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Moviendo..." : "Mover a Papelera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
