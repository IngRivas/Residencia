"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { restoreObra, permanentDeleteObra } from "@/lib/actions/obras"
import {
  restoreDiaObraAdmin,
  permanentDeleteDiaObraAdmin,
  restoreExpenseAdmin,
  permanentDeleteExpenseAdmin,
} from "@/lib/actions/gastos"
import { emptyRecycleBin } from "@/lib/actions/papelera"
import { formatCurrency } from "@/lib/formatters"
import { useRouter, useSearchParams } from "next/navigation"
import { sileo } from "sileo"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export default function PapeleraClient({
  obras,
  dias,
  gastos,
}: {
  obras: any[]
  dias: any[]
  gastos: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams?.get("search")?.toLowerCase() || ""

  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: string
    id: string
  } | null>(null)
  const [emptyConfirm, setEmptyConfirm] = useState(false)
  const [isEmptying, setIsEmptying] = useState(false)

  const filteredGastos = gastos.filter(
    (g) =>
      !search ||
      g.concepto?.toLowerCase().includes(search) ||
      g.proveedor?.toLowerCase().includes(search) ||
      g.diaObra?.obra?.nombre?.toLowerCase().includes(search)
  )

  const filteredDias = dias.filter(
    (d) =>
      !search ||
      d.obra?.nombre?.toLowerCase().includes(search) ||
      new Date(d.fecha)
        .toLocaleDateString("es-MX", { timeZone: "UTC" })
        .includes(search)
  )

  const filteredObras = obras.filter(
    (o) => !search || o.nombre?.toLowerCase().includes(search)
  )

  const handleRestore = async (type: "obra" | "dia" | "gasto", id: string) => {
    setIsProcessing(id)
    try {
      if (type === "obra") await restoreObra(id)
      if (type === "dia") await restoreDiaObraAdmin(id)
      if (type === "gasto") await restoreExpenseAdmin(id)
      sileo.success({ title: "Elemento restaurado con éxito" })
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al restaurar" })
    } finally {
      setIsProcessing(null)
    }
  }

  const handleHardDelete = async () => {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm

    setIsProcessing(id)
    try {
      if (type === "obra") await permanentDeleteObra(id)
      if (type === "dia") await permanentDeleteDiaObraAdmin(id)
      if (type === "gasto") await permanentDeleteExpenseAdmin(id)
      sileo.success({ title: "Elemento eliminado permanentemente" })
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al eliminar" })
    } finally {
      setIsProcessing(null)
      setDeleteConfirm(null)
    }
  }

  const handleEmptyTrash = async () => {
    setIsEmptying(true)
    try {
      await emptyRecycleBin()
      sileo.success({ title: "Papelera vaciada permanentemente" })
      router.refresh()
    } catch (err: any) {
      sileo.error({ title: err.message || "Error al vaciar papelera" })
    } finally {
      setIsEmptying(false)
      setEmptyConfirm(false)
    }
  }

  return (
    <>
      <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
        <Tabs defaultValue="obras" className="w-full">
          <div className="mb-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50">
              <TabsTrigger value="obras" className="text-sm">
                Obras ({filteredObras.length})
              </TabsTrigger>
              <TabsTrigger value="dias" className="text-sm">
                Días ({filteredDias.length})
              </TabsTrigger>
              <TabsTrigger value="gastos" className="text-sm">
                Gastos ({filteredGastos.length})
              </TabsTrigger>
            </TabsList>
            <Button
              variant="destructive"
              className="w-full text-sm sm:w-auto"
              onClick={() => setEmptyConfirm(true)}
              disabled={
                isEmptying ||
                (gastos.length === 0 && dias.length === 0 && obras.length === 0)
              }
            >
              {isEmptying ? "Vaciando..." : "Limpiar papelera"}
            </Button>
          </div>

          {/* Gastos Tab */}
          <TabsContent value="gastos" className="mt-6">
            {filteredGastos.length === 0 ? (
              <p className="rounded-md border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
                No hay gastos{" "}
                {search ? "que coincidan con la búsqueda" : "en la papelera"}.
              </p>
            ) : (
              <div className="w-full overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-normal">
                        Concepto / Obra
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Proveedor
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Fecha del Gasto
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Total
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Eliminado
                      </TableHead>
                      <TableHead className="text-right text-sm font-normal">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGastos.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {gasto.concepto}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {gasto.diaObra?.obra?.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {gasto.proveedor}
                        </TableCell>
                        <TableCell className="text-sm">
                          {gasto.diaObra?.fecha
                            ? new Date(gasto.diaObra.fecha).toLocaleDateString(
                                "es-MX",
                                { timeZone: "UTC" }
                              )
                            : ""}
                        </TableCell>
                        <TableCell className="text-sm font-bold">
                          {formatCurrency(Number(gasto.total))}
                        </TableCell>
                        <TableCell className="text-sm text-red-400">
                          {gasto.deletedAt
                            ? new Date(gasto.deletedAt).toLocaleDateString(
                                "es-MX",
                                { timeZone: "UTC" }
                              )
                            : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing === gasto.id}
                              onClick={() => handleRestore("gasto", gasto.id)}
                            >
                              Restaurar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isProcessing === gasto.id}
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "gasto",
                                  id: gasto.id,
                                })
                              }
                            >
                              Borrar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Días Tab */}
          <TabsContent value="dias" className="mt-6">
            {filteredDias.length === 0 ? (
              <p className="rounded-md border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
                No hay días{" "}
                {search ? "que coincidan con la búsqueda" : "en la papelera"}.
              </p>
            ) : (
              <div className="w-full overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-normal">
                        Obra
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Fecha del Día
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Presupuesto Diario
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Eliminado
                      </TableHead>
                      <TableHead className="text-right text-sm font-normal">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDias.map((dia) => (
                      <TableRow key={dia.id}>
                        <TableCell className="text-sm font-medium">
                          {dia.obra?.nombre}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(dia.fecha).toLocaleDateString("es-MX", {
                            timeZone: "UTC",
                          })}
                        </TableCell>
                        <TableCell className="text-sm font-bold">
                          {formatCurrency(Number(dia.presupuestoDiario))}
                        </TableCell>
                        <TableCell className="text-sm text-red-400">
                          {dia.deletedAt
                            ? new Date(dia.deletedAt).toLocaleDateString(
                                "es-MX",
                                { timeZone: "UTC" }
                              )
                            : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing === dia.id}
                              onClick={() => handleRestore("dia", dia.id)}
                            >
                              Restaurar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isProcessing === dia.id}
                              onClick={() =>
                                setDeleteConfirm({ type: "dia", id: dia.id })
                              }
                            >
                              Borrar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Obras Tab */}
          <TabsContent value="obras" className="mt-6">
            {filteredObras.length === 0 ? (
              <p className="rounded-md border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
                No hay obras{" "}
                {search ? "que coincidan con la búsqueda" : "en la papelera"}.
              </p>
            ) : (
              <div className="w-full overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-normal">
                        Nombre de Obra
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Presupuesto Total
                      </TableHead>
                      <TableHead className="text-sm font-normal">
                        Eliminado
                      </TableHead>
                      <TableHead className="text-right text-sm font-normal">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredObras.map((obra) => (
                      <TableRow key={obra.id}>
                        <TableCell className="text-sm font-medium">
                          {obra.nombre}
                        </TableCell>
                        <TableCell className="text-sm font-bold">
                          {formatCurrency(Number(obra.presupuestoTotal))}
                        </TableCell>
                        <TableCell className="text-sm text-red-400">
                          {obra.deletedAt
                            ? new Date(obra.deletedAt).toLocaleDateString(
                                "es-MX",
                                { timeZone: "UTC" }
                              )
                            : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing === obra.id}
                              onClick={() => handleRestore("obra", obra.id)}
                            >
                              Restaurar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isProcessing === obra.id}
                              onClick={() =>
                                setDeleteConfirm({ type: "obra", id: obra.id })
                              }
                            >
                              Borrar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null ? true : false}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleHardDelete}
        title="Eliminar permanentemente"
        description="Esta acción no se puede deshacer. Los datos serán borrados permanentemente de la base de datos."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />

      <ConfirmDialog
        open={emptyConfirm}
        onOpenChange={setEmptyConfirm}
        onConfirm={handleEmptyTrash}
        title="Limpiar Papelera"
        description="Estás a punto de vaciar toda la papelera. Esta acción NO se puede deshacer y borrará permanentemente todos los gastos, días y obras aquí almacenados. ¿Deseas continuar?"
        confirmText="Sí, vaciar papelera"
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  )
}
