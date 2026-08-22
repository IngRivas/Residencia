"use client"

import React, { useState, useTransition, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { sileo } from "sileo"
import { saveContratistaCards } from "@/lib/actions/contratistas-cards"
import { ObraSummaryCard } from "@/components/ui/obra-summary-card"
import { Trash2, Plus, CalendarIcon, Pencil } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export interface ObraOption {
  id: string
  nombre: string
}

export interface CardConfig {
  id: string
  type: "normal" | "custom"
  obraId: string
  keyword?: string
  titulo?: string
  fechaInicio?: string
  fechaFin?: string
  isEnabled?: boolean
}

export interface ObraCardData {
  id: string
  type?: "normal" | "custom"
  nombre: string
  totalBruto: number
}

interface CardsCrudDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  obras: ObraOption[]
  allCardsData: ObraCardData[]
  activeCards: CardConfig[]
  onCardsChange: (newCards: CardConfig[]) => void
}

export function CardsCrudDialog({ open, onOpenChange, obras, allCardsData, activeCards, onCardsChange }: CardsCrudDialogProps) {
  const [, startTransition] = useTransition()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)

  // New/Edit Custom Card Form State
  const [newTitle, setNewTitle] = useState("")
  const [newObraId, setNewObraId] = useState("")
  const [newKeyword, setNewKeyword] = useState("")
  const [newFechaInicio, setNewFechaInicio] = useState("")
  const [newFechaFin, setNewFechaFin] = useState("")
  const [isInicioOpen, setIsInicioOpen] = useState(false)
  const [isFinOpen, setIsFinOpen] = useState(false)

  const syncToServer = (updated: CardConfig[]) => {
    onCardsChange(updated)
    startTransition(async () => {
      const res = await saveContratistaCards(updated)
      if (!res.success) {
        sileo.error({ title: "Error al guardar preferencias de tarjetas" })
        onCardsChange(activeCards) // Revert
      }
    })
  }

  const toggleNormalCard = (cardId: string) => {
    // If it exists, toggle it
    const exists = activeCards.find(c => c.type === "normal" && c.id === cardId)
    let updated: CardConfig[]

    if (exists) {
      if (exists.isEnabled === false) {
        // Re-enable
        updated = activeCards.map(c => c === exists ? { ...c, isEnabled: true } : c)
      } else {
        // Disable
        updated = activeCards.map(c => c === exists ? { ...c, isEnabled: false } : c)
      }
    } else {
      // Add new as disabled (since it defaults to true)
      updated = [...activeCards, { id: cardId, type: "normal", obraId: cardId, isEnabled: false }]
    }
    syncToServer(updated)
  }

  const toggleCustomCard = (cardId: string) => {
    const updated = activeCards.map(c => {
      if (c.id === cardId) {
        return { ...c, isEnabled: c.isEnabled === false ? true : false }
      }
      return c
    })
    syncToServer(updated)
  }

  const deleteCard = (cardId: string, type: "normal" | "custom", e: React.MouseEvent) => {
    e.stopPropagation() // prevent toggle
    if (type === "custom") {
      const updated = activeCards.filter(c => c.id !== cardId)
      syncToServer(updated)
    } else {
      // For normal cards, we mark them as 'deleted_normal' so they disappear from the modal entirely
      const filtered = activeCards.filter(c => c.id !== cardId)
      const updated = [...filtered, { id: cardId, type: "deleted_normal" as any, obraId: cardId, isEnabled: false }]
      syncToServer(updated)
    }
  }

  const handleSaveCustomCard = () => {
    if (!newTitle.trim()) {
      sileo.error({ title: "El título es requerido." })
      return
    }
    if (!newKeyword.trim() && !newFechaInicio && !newFechaFin) {
      sileo.error({ title: "Debes ingresar una palabra clave, o bien, una fecha." })
      return
    }

    if (editingCardId) {
      const isCustom = editingCardId.startsWith("custom-")
      let exists = false
      
      let updated = activeCards.map(c => {
        if (c.id === editingCardId && (isCustom ? c.type === "custom" : c.type === "normal")) {
          exists = true
          return {
            ...c,
            obraId: newObraId || (isCustom ? "TODAS LAS OBRAS" : c.obraId),
            keyword: newKeyword.trim() || undefined,
            fechaInicio: newFechaInicio || undefined,
            fechaFin: newFechaFin || undefined,
            titulo: newTitle.trim().toUpperCase(),
          }
        }
        return c
      })

      if (!exists && !isCustom) {
        updated.push({
          id: editingCardId,
          type: "normal",
          obraId: newObraId || editingCardId,
          keyword: newKeyword.trim() || undefined,
          fechaInicio: newFechaInicio || undefined,
          fechaFin: newFechaFin || undefined,
          titulo: newTitle.trim().toUpperCase(),
          isEnabled: true
        })
      }

      syncToServer(updated)
      setIsCreateOpen(false)
      sileo.success({ title: "Tarjeta actualizada." })
    } else {
      const newCard: CardConfig = {
        id: `custom-${Date.now()}`,
        type: "custom",
        obraId: newObraId || "TODAS LAS OBRAS",
        keyword: newKeyword.trim() || undefined,
        fechaInicio: newFechaInicio || undefined,
        fechaFin: newFechaFin || undefined,
        titulo: newTitle.trim().toUpperCase(),
        isEnabled: true
      }
      const updated = [...activeCards, newCard]
      syncToServer(updated)
      setIsCreateOpen(false)
      sileo.success({ title: "Tarjeta personalizada agregada." })
    }
  }

  const handleDeleteFromEdit = () => {
    if (editingCardId) {
      const isCustom = editingCardId.startsWith("custom-")
      if (isCustom) {
        const updated = activeCards.filter(c => c.id !== editingCardId)
        syncToServer(updated)
      } else {
        const filtered = activeCards.filter(c => c.id !== editingCardId)
        const updated = [...filtered, { id: editingCardId, type: "deleted_normal" as any, obraId: editingCardId, isEnabled: false }]
        syncToServer(updated)
      }
      setIsCreateOpen(false)
      sileo.success({ title: "Tarjeta eliminada." })
    }
  }

  const openNewCustomCard = () => {
    setEditingCardId(null)
    setNewTitle("")
    setNewObraId("")
    setNewKeyword("")
    setNewFechaInicio("")
    setNewFechaFin("")
    setIsCreateOpen(true)
  }

  const openEditCard = (card: ObraCardData, e: React.MouseEvent) => {
    e.stopPropagation()
    const isCustom = card.type === "custom"
    const stateConfig = activeCards.find(c => (isCustom ? c.id === card.id : (c.type === "normal" && c.id === card.id)))
    
    setEditingCardId(card.id)
    
    const titulo = stateConfig?.titulo || card.nombre
    const obraId = stateConfig?.obraId || (isCustom ? "TODAS LAS OBRAS" : card.id)
    
    setNewTitle(titulo)
    setNewObraId(obraId === "TODAS LAS OBRAS" ? "" : obraId)
    setNewKeyword(stateConfig?.keyword || "")
    setNewFechaInicio(stateConfig?.fechaInicio || "")
    setNewFechaFin(stateConfig?.fechaFin || "")
    setIsCreateOpen(true)
  }

  // Seperate data arrays
  const normalObras = allCardsData.filter(d => d.type === "normal")
  const customCardsData = allCardsData.filter(d => d.type !== "normal")

  const sortedCardsData = useMemo(() => {
    return [...allCardsData].sort((a, b) => {
      const isCustomA = a.type === "custom"
      const stateA = activeCards.find(c => (isCustomA ? c.id === a.id : (c.type === "normal" && c.id === a.id)))
      const isActiveA = stateA ? stateA.isEnabled !== false : (isCustomA ? false : true)

      const isCustomB = b.type === "custom"
      const stateB = activeCards.find(c => (isCustomB ? c.id === b.id : (c.type === "normal" && c.id === b.id)))
      const isActiveB = stateB ? stateB.isEnabled !== false : (isCustomB ? false : true)

      if (isActiveA && !isActiveB) return -1
      if (!isActiveA && isActiveB) return 1
      return a.nombre.localeCompare(b.nombre)
    })
  }, [allCardsData, activeCards])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-full rounded-3xl bg-card border-border/50 shadow-2xl p-8">
          <DialogHeader className="text-center relative">
            <DialogTitle className="text-3xl font-bold tracking-tight text-center">
              Administración de Tarjetas
            </DialogTitle>
            <div className="absolute right-0 top-0">
              <Button 
                onClick={openNewCustomCard} 
                size="icon"
                title="Crear Tarjeta Personalizada"
                className="h-10 w-10 shadow-md rounded-xl"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

        <div className="mt-8 max-h-[70vh] overflow-y-auto pr-2 overflow-x-hidden">
          
          {sortedCardsData.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl bg-muted/20">
              No hay obras ni tarjetas registradas en el sistema.
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 p-2 justify-center">
              {sortedCardsData.map(card => {
                const isCustom = card.type === "custom"
                const stateConfig = activeCards.find(c => (isCustom ? c.id === card.id : (c.type === "normal" && c.id === card.id)))
                const isActive = stateConfig ? stateConfig.isEnabled !== false : (isCustom ? false : true)

                return (
                  <div key={card.id} className="w-[240px] relative group">
                    <ObraSummaryCard
                      nombre={card.nombre}
                      totalBruto={card.totalBruto}
                      isActive={isActive}
                      isInner={true}
                      onClick={() => isCustom ? toggleCustomCard(card.id) : toggleNormalCard(card.id)}
                    />
                    <button
                      className="absolute -top-3 -right-3 text-primary/70 hover:text-primary hover:scale-110 opacity-0 group-hover:opacity-100 transition-all z-50 p-1"
                      onClick={(e) => openEditCard(card, e)}
                      title="Editar tarjeta"
                    >
                      <Pencil className="h-5 w-5 drop-shadow-md" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent 
        className="max-w-md rounded-3xl bg-card border-border/50 shadow-2xl p-6"
        title={editingCardId ? "Editar Tarjeta Avanzada" : "Nueva Tarjeta Avanzada"}
        showCloseButton={true}
        rightAction={
          <Button 
            onClick={handleSaveCustomCard}
            size="icon"
            className="h-8 w-8 rounded-full shadow-lg"
            title="Guardar Tarjeta"
          >
            <Plus className="h-4 w-4" />
          </Button>
        }
      >
        <div className="space-y-4 py-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Nombre de la Tarjeta</Label>
            <Input 
              placeholder="Ej: ABASTOS PILAS" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              className="bg-muted/50 border-border/50 h-10 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Obra Base</Label>
              <Select 
                value={newObraId} 
                onValueChange={(v: string | null) => {
                  const id = v || ""
                  setNewObraId(id)
                  
                  // Only auto-populate if the title is empty or is the default "TODAS LAS OBRAS"
                  // This prevents overwriting a manually typed name.
                  if (!newTitle.trim() || newTitle === "TODAS LAS OBRAS") {
                    if (id && id !== "TODAS LAS OBRAS") {
                      const selectedObra = obras.find(o => o.id === id)
                      if (selectedObra) {
                        setNewTitle(selectedObra.nombre.toUpperCase())
                      }
                    } else {
                      setNewTitle("TODAS LAS OBRAS")
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full bg-muted/50 border-border/50 h-10 rounded-xl uppercase">
                  <SelectValue placeholder="TODAS LAS OBRAS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS LAS OBRAS">TODAS LAS OBRAS</SelectItem>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nombre.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Clave</Label>
              <Input 
                placeholder="Ej: PILAS" 
                value={newKeyword} 
                onChange={e => setNewKeyword(e.target.value)} 
                className="bg-muted/50 border-border/50 h-10 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Fecha Inicio</Label>
              <Popover open={isInicioOpen} onOpenChange={setIsInicioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl border-none bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted h-10",
                      !newFechaInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newFechaInicio ? format(new Date(newFechaInicio + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Desde el origen</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/50 bg-card shadow-2xl backdrop-blur-xl" align="start">
                  <Calendar
                    mode="single"
                    locale={es}
                    selected={newFechaInicio ? new Date(newFechaInicio + "T12:00:00") : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setNewFechaInicio(date.toISOString().split("T")[0])
                        setIsInicioOpen(false)
                      } else {
                        setNewFechaInicio("")
                      }
                    }}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Fecha Fin</Label>
              <Popover open={isFinOpen} onOpenChange={setIsFinOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl border-none bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted h-10",
                      !newFechaFin && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newFechaFin ? format(new Date(newFechaFin + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Hasta la actualidad</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/50 bg-card shadow-2xl backdrop-blur-xl" align="start">
                  <Calendar
                    mode="single"
                    locale={es}
                    selected={newFechaFin ? new Date(newFechaFin + "T12:00:00") : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setNewFechaFin(date.toISOString().split("T")[0])
                        setIsFinOpen(false)
                      } else {
                        setNewFechaFin("")
                      }
                    }}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {editingCardId && (
            <div className="pt-4 border-t border-border/50">
              <Button 
                variant="destructive" 
                className="w-full h-10 rounded-xl font-bold" 
                onClick={handleDeleteFromEdit}
              >
                Eliminar Tarjeta
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
