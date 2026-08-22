"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/formatters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ReposicionRecord {
  fecha: string
  monto: number
}

interface ReposicionesModalProps {
  reposiciones: ReposicionRecord[]
  total: number
}

export default function ReposicionesModal({
  reposiciones,
  total,
}: ReposicionesModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
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
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          Historial de Reposiciones
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Historial de Reposiciones"
        className="max-h-[80vh] max-w-md overflow-y-auto"
      >
        <DialogDescription>
          Dinero reingresado o pagado por adelantado por el capturista.
        </DialogDescription>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/50 p-4">
            <span className="text-sm font-semibold">Total Repuesto</span>
            <span className="text-xl font-bold text-emerald-500">
              {formatCurrency(total)}
            </span>
          </div>

          {reposiciones.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay reposiciones registradas.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reposiciones.map((rep, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium capitalize">
                        {rep.fecha}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-500">
                        {formatCurrency(rep.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
