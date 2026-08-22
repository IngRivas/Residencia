"use client"

import { Card } from "@/components/ui/card"
import type { GastoEstado } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/formatters"
import StatCard from "./StatCard"

interface GastoData {
  id: string
  concepto: string
  proveedor: string
  subtotal: number
  porcentajeIVA: number
  iva: number
  total: number
  categoria?: string
  isImprevisto?: boolean
  estado: GastoEstado
  notaCapturista?: string
  fotos?: string[]
}

interface DayExpensesSummaryProps {
  gastos: GastoData[]
  presupuestoDiario: number
  totalGastado: number
  saldoAFavor: number
}

export default function DayExpensesSummary({
  gastos,
  presupuestoDiario,
  totalGastado,
  saldoAFavor,
}: DayExpensesSummaryProps) {
  return (
    <Card className="space-y-6 border-border/50 bg-background/40 p-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Resumen del Día</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lista de comprobantes y estado de aprobación de gastos.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Concepto</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Subtotal</TableHead>
            <TableHead>IVA %</TableHead>
            <TableHead>IVA $</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="p-8 text-center text-muted-foreground"
              >
                No se han registrado gastos para este día.
              </TableCell>
            </TableRow>
          ) : (
            gastos.map((gasto) => (
              <TableRow key={gasto.id}>
                <TableCell>
                  <div className="font-semibold">{gasto.concepto}</div>
                  {(gasto.categoria || gasto.isImprevisto) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {gasto.categoria && (
                        <span className="text-[10px] text-muted-foreground">
                          {gasto.categoria}
                        </span>
                      )}
                      {gasto.isImprevisto && (
                        <span className="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                          Imprevisto
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-foreground/80">
                  {gasto.proveedor}
                </TableCell>
                <TableCell>{formatCurrency(gasto.subtotal)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {gasto.porcentajeIVA}%
                </TableCell>
                <TableCell>{formatCurrency(gasto.iva)}</TableCell>
                <TableCell className="font-bold">
                  {formatCurrency(gasto.total)}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold ${
                      gasto.estado === "VERIFICADO"
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : gasto.estado === "RECHAZADO"
                          ? "border-destructive/20 bg-destructive/10 text-destructive"
                          : "border-border/40 bg-muted/20 text-muted-foreground"
                    }`}
                  >
                    {gasto.estado}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Summary Footer */}
      <div className="grid grid-cols-1 gap-4 border-t border-border/50 pt-6 sm:grid-cols-3">
        <StatCard
          title="Presupuesto del día"
          value={formatCurrency(presupuestoDiario)}
        />
        <StatCard title="Total Gastado" value={formatCurrency(totalGastado)} />
        <StatCard title="Saldo a Favor" value={formatCurrency(saldoAFavor)} />
      </div>
    </Card>
  )
}
