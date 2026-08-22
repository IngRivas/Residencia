"use client"

import { useState, useEffect, useTransition, useMemo } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ComboboxInput } from "@/components/ui/combobox-input"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { editGastoFromModule, deleteGastoFromModule } from "@/lib/actions/gastos-module"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SlidingTabs } from "@/components/ui/sliding-tabs"
import { sileo } from "sileo"
import type { GastoItem, ObraOption, CardConfig } from "./GastosSpreadsheetClient"

interface EditGastoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gasto: GastoItem | null
  obras: ObraOption[]
  uniqueProveedores: string[]
  activeCards?: CardConfig[]
  onSuccess: () => void
}

export function EditGastoDialog({ open, onOpenChange, gasto, obras, uniqueProveedores, activeCards = [], onSuccess }: EditGastoDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const [obraId, setObraId] = useState("")
  const [customObraId, setCustomObraId] = useState("")
  const [fechaStr, setFechaStr] = useState<string>("")
  const [concepto, setConcepto] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [categoria, setCategoria] = useState("")
  const [subtotal, setSubtotal] = useState("")
  const [porcentajeIVA, setPorcentajeIVA] = useState("16")
  const [ieps, setIeps] = useState("")
  const [descuento, setDescuento] = useState("")
  const [ivaRetenido, setIvaRetenido] = useState("")
  const [isrRetenido, setIsrRetenido] = useState("")
  const [notaCapturista, setNotaCapturista] = useState("")

  const isProtected = useMemo(() => {
    if (!notaCapturista) return false;
    const lowerNota = notaCapturista.toLowerCase();
    return activeCards.some(c => c.type === "custom" && c.keyword && lowerNota.includes(c.keyword.toLowerCase()))
  }, [notaCapturista, activeCards])

  useEffect(() => {
    if (gasto && open) {
      // Find obra by id or name
      const obra = obras.find(o => o.id === gasto.obraId || o.nombre.toLowerCase() === gasto.obraNombre.toLowerCase())
      setObraId(obra ? obra.id : "otro")
      setCustomObraId(obra ? "" : gasto.obraNombre)
      
      setFechaStr(gasto.fecha)
      setConcepto(gasto.concepto)
      setProveedor(gasto.proveedor || "")
      setCategoria(gasto.categoria || "")
      setSubtotal(gasto.subtotal.toString())
      setPorcentajeIVA(gasto.porcentajeIVA.toString())
      setIeps(gasto.ieps?.toString() || "")
      setDescuento(gasto.descuento?.toString() || "")
      setIvaRetenido(gasto.ivaRetenido?.toString() || "")
      setIsrRetenido(gasto.isrRetenido?.toString() || "")
      setNotaCapturista(gasto.notaCapturista || "")
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
    if (!concepto.trim()) {
      sileo.error({ title: "Ingresa el concepto" })
      return
    }
    const subNum = parseCurrency(subtotal)
    if (subNum <= 0) {
      sileo.error({ title: "El subtotal debe ser mayor a 0" })
      return
    }

    startTransition(async () => {
      const res = await editGastoFromModule(gasto.id, {
        obraId: finalObraId,
        fechaStr,
        concepto,
        proveedor: proveedor || "N/A",
        categoria,
        subtotal: subNum,
        porcentajeIVA: parseInt(porcentajeIVA, 10),
        ieps: parseCurrency(ieps) || undefined,
        descuento: parseCurrency(descuento) || undefined,
        ivaRetenido: parseCurrency(ivaRetenido) || undefined,
        isrRetenido: parseCurrency(isrRetenido) || undefined,
        notaCapturista
      })

      if (res.success) {
        sileo.success({ title: "Gasto actualizado exitosamente" })
        onSuccess()
        onOpenChange(false)
      } else {
        sileo.error({ title: res.error || "Error al actualizar" })
      }
    })
  }

  const handleDelete = () => {
    if (!gasto) return
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto?")) return
    
    setIsDeleting(true)
    startTransition(async () => {
      const res = await deleteGastoFromModule(gasto.id)
      setIsDeleting(false)
      if (res.success) {
        sileo.success({ title: "Gasto eliminado exitosamente" })
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
          <h2 className="text-lg font-semibold tracking-tight">Editar Gasto</h2>
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
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Descripción del gasto..."
              className="rounded-xl bg-muted/60 text-sm h-11 border-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ComboboxInput
              label="Proveedor"
              value={proveedor}
              onChange={setProveedor}
              options={uniqueProveedores}
              placeholder="Escribe o selecciona..."
              autoComplete="off"
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Unidad / Categoría</Label>
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Pza, Kg, Lts..."
                className="rounded-xl bg-muted/60 text-xs h-[38px] border-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Notas</Label>
            <Input
              value={notaCapturista}
              onChange={(e) => setNotaCapturista(e.target.value)}
              placeholder="Observaciones..."
              className="rounded-xl bg-muted/60 text-xs h-[38px] border-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Subtotal</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={subtotal}
                  onChange={(e) => setSubtotal(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-background text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">% IVA</Label>
              <div className="flex rounded-xl bg-background p-1 h-[38px] w-full">
                <SlidingTabs
                  tabs={["0%", "8%", "16%"]}
                  activeTab={porcentajeIVA === "0" ? 0 : porcentajeIVA === "8" ? 1 : 2}
                  onChange={(idx) => {
                    if (idx === 0) setPorcentajeIVA("0")
                    if (idx === 1) setPorcentajeIVA("8")
                    if (idx === 2) setPorcentajeIVA("16")
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Descuento</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={descuento}
                  onChange={(e) => setDescuento(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-background text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">IEPS</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={ieps}
                  onChange={(e) => setIeps(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-background text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">IVA Ret</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={ivaRetenido}
                  onChange={(e) => setIvaRetenido(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-background text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">ISR Ret</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
                <Input
                  value={isrRetenido}
                  onChange={(e) => setIsrRetenido(formatCurrencyInput(e.target.value))}
                  placeholder="0.00"
                  className="rounded-xl bg-background text-xs h-[38px] border-none pl-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Delete button */}
        {!isProtected && (
          <div className="p-4 border-t border-border/50 bg-muted/10">
            <Button 
              variant="destructive" 
              className="w-full rounded-xl h-11 text-sm font-semibold shadow-sm hover:bg-destructive/90"
              onClick={() => setIsConfirmOpen(true)}
              disabled={isPending || isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar Gasto
            </Button>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="¿Eliminar gasto?"
        description="Esta acción mandará este gasto a la papelera. Podrás recuperarlo después si lo necesitas."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </Dialog>
  )
}
