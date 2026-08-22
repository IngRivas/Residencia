"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateObra } from "@/lib/actions/obras"
import type { ObraEstado } from "@prisma/client"

import { AlertDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"

interface CloseProjectButtonProps {
  id: string
  nombre: string
  presupuesto: number
  estado: ObraEstado
}

export default function CloseProjectButton({
  id,
  nombre,
  presupuesto,
  estado,
}: CloseProjectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const handleCloseClick = () => {
    if (estado === "ARCHIVADA") return
    setConfirmCloseOpen(true)
  }

  const executeClose = async () => {
    setLoading(true)
    try {
      await updateObra(id, {
        nombre,
        presupuestoTotal: presupuesto,
        estado: "ARCHIVADA",
      })
    } catch (err: any) {
      setAlertMsg(err.message || "Error al archivar la obra.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCloseClick}
        disabled={estado === "ARCHIVADA" || loading}
        className={`flex h-10 items-center justify-center rounded-full bg-card px-5 text-sm font-semibold whitespace-nowrap text-foreground/90 shadow-md transition-all hover:bg-muted ${
          estado === "ARCHIVADA" || loading
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        }`}
      >
        {loading
          ? "Archivando..."
          : estado === "ARCHIVADA"
            ? "Obra Archivada"
            : "Archivar Obra"}
      </button>

      <AlertDialog
        open={!!alertMsg}
        onOpenChange={() => setAlertMsg(null)}
        title="Aviso"
        description={alertMsg || ""}
      />

      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Archivar Obra"
        description={`¿Está seguro de archivar la obra "${nombre}"?\nSe generará el reporte final y el estado cambiará a ARCHIVADA.`}
        onConfirm={executeClose}
      />
    </>
  )
}
