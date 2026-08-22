"use client"

import { useState, useEffect, useTransition } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, X, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { editContratistaGastoFromModule, deleteContratistaGastoFromModule } from "@/lib/actions/contratistas-module"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { sileo } from "sileo"
import type { ContratistaGastoItem, ObraOption } from "./ContratistasSpreadsheetClient"

interface EditContratistaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gasto: ContratistaGastoItem | null
  obras: ObraOption[]
  onSuccess: () => void
}

export function EditContratistaDialog({ open, onOpenChange, gasto, obras, onSuccess }: EditContratistaDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const [obraId, setObraId] = useState("")
  const [customObraId, setCustomObraId] = useState("")
  const [fechaStr, setFechaStr] = useState<string>("")
  const [periodo, setPeriodo] = useState("")
  const [trabajoRealizado, setTrabajoRealizado] = useState("")
  const [notas, setNotas] = useState("")
  const [contratista, setContratista] = useState("")
  const [total, setTotal] = useState("")

  useEffect(() => {
    if (gasto && open) {
      const obra = obras.find(o => o.nombre.toLowerCase() === gasto.obraNombre.toLowerCase())
      setObraId(obra ? obra.id : "otro")
      setCustomObraId(obra ? "" : gasto.obraNombre)
      
      setFechaStr(gasto.fechaStr)
      setPeriodo(gasto.periodo || "")
      setTrabajoRealizado(gasto.trabajoRealizado || "")
      setNotas(gasto.notas || "")
      setContratista(gasto.contratista)
      setTotal(gasto.total.toString())
    }
  }, [gasto, open, obras])

  const formatCurrencyInput = (value: string) => {
    let val = value.replace(/[^0-9.]/g, "")
    const parts = val.split(".")
    if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("")
    if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return parts.join(".")
  }

  const parseCurrency = (val: string) => parseFloat(val.replace(/,/g, "")) || 0

  const handleSave = () => {
    if (!gasto) return
    const finalObraId = obraId === "otro" ? customObraId : obraId
    if (!finalObraId) {
      sileo.error({ title: "Selecciona una obra" })
      return
    }
    if (!fechaStr) {
      sileo.error({ title: "Selecciona la fecha" })
      return
    }
    if (!contratista.trim()) {
      sileo.error({ title: "Ingresa el contratista" })
      return
    }
    const subNum = parseCurrency(total)
    if (subNum <= 0) {
      sileo.error({ title: "El total debe ser mayor a 0" })
      return
    }

    startTransition(async () => {
      // Find final Obra Nombre
      let finalObraNombre = finalObraId
      if (obraId !== "otro") {
        const found = obras.find(o => o.id === obraId)
        if (found) finalObraNombre = found.nombre
      }

      const res = await editContratistaGastoFromModule(gasto.id, {
        obraNombre: finalObraNombre,
        fechaStr,
        periodo,
        trabajoRealizado,
        notas,
        contratista,
        total: subNum,
      })

      if (res.success) {
        sileo.success({ title: "Registro actualizado exitosamente" })
        onSuccess()
        onOpenChange(false)
      } else {
        sileo.error({ title: res.error || "Error al actualizar" })
      }
    })
  }

  const handleDelete = () => {
    if (!gasto) return
    setIsDeleting(true)
    startTransition(async () => {
      const res = await deleteContratistaGastoFromModule(gasto.id)
      setIsDeleting(false)
      if (res.success) {
        sileo.success({ title: "Registro eliminado exitosamente" })
        onSuccess()
        onOpenChange(false)
      } else {
        sileo.error({ title: res.error || "Error al eliminar" })
      }
    })
  }

  if (!gasto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
        {/* Header with X on left, Save on right */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-muted/50">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">Editar Registro (Contratista)</h2>
          <Button onClick={handleSave} disabled={isPending || isDeleting} className="bg-primary text-primary-foreground rounded-xl shadow-md h-9 px-4">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Obra</Label>
              <Select value={obraId} onValueChange={(val) => val && setObraId(val)}>
                <SelectTrigger className="w-full rounded-xl bg-muted/60 text-xs border-none h-10 uppercase">
                  <SelectValue placeholder="Selecciona una obra" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 bg-card shadow-2xl">
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id} className="text-xs uppercase">{o.nombre}</SelectItem>
                  ))}
                  <SelectItem value="otro" className="text-xs font-semibold text-primary">Otra obra (Nueva)...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {obraId === "otro" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Nombre de Obra</Label>
                <Input
                  value={customObraId}
                  onChange={(e) => setCustomObraId(e.target.value.toUpperCase())}
                  placeholder="Escribe el nombre..."
                  className="rounded-xl bg-muted/60 text-xs h-10 border-none uppercase"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl border-none bg-muted/60 px-3 py-2 text-xs text-foreground hover:bg-muted h-10",
                      !fechaStr && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaStr ? format(new Date(fechaStr + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Selecciona fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/50 bg-card shadow-2xl backdrop-blur-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaStr ? new Date(fechaStr + "T12:00:00") : undefined}
                    onSelect={(date) => date && setFechaStr(date.toISOString().split("T")[0])}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Trabajo Realizado</Label>
            <Input
              value={trabajoRealizado}
              onChange={(e) => setTrabajoRealizado(e.target.value)}
              placeholder="Descripción del trabajo..."
              className="rounded-xl bg-muted/60 text-sm h-11 border-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Contratista</Label>
              <Input
                value={contratista}
                onChange={(e) => setContratista(e.target.value)}
                placeholder="Nombre contratista..."
                className="rounded-xl bg-muted/60 text-xs h-[38px] border-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Periodo</Label>
              <Input
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Ej. Semana 1..."
                className="rounded-xl bg-muted/60 text-xs h-[38px] border-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Notas</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas u observaciones..."
                className="rounded-xl bg-muted/60 text-xs h-[38px] border-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Total ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={total}
                  onChange={(e) => setTotal(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-muted/60 text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Delete button */}
        <div className="p-4 border-t border-border/50 bg-muted/10">
          <Button 
            variant="destructive" 
            className="w-full rounded-xl h-11 text-sm font-semibold shadow-sm hover:bg-destructive/90"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isPending || isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Eliminar Registro
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="¿Eliminar registro?"
        description="Esta acción mandará este registro a la papelera. Podrás recuperarlo después si lo necesitas."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </Dialog>
  )
}
