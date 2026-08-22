"use client"

import React, { useState, useMemo, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, ColumnDef } from "@/app/components/DataTable"
import { useSearchParams } from "next/navigation"
import { Search, Plus, CalendarIcon, MoreVertical, LayoutGrid, List, FileText, ChevronDown, Check, Building, Layers, CircleDollarSign, Percent, Wallet, MessageSquare, Trash2, ArchiveRestore, User, Settings2, Filter, Loader2, LayoutPanelTop } from "lucide-react"
import { ComboboxInput } from "@/components/ui/combobox-input"
import { ObraSummaryCard } from "@/components/ui/obra-summary-card"
import { formatCurrency } from "@/lib/formatters"
import { sileo } from "sileo"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { createContratistaGastoFromModule, deleteContratistaGastoFromModule } from "@/lib/actions/contratistas-module"
import { saveContratistaCards } from "@/lib/actions/contratistas-cards"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CardsCrudDialog } from "./CardsCrudDialog"
import { EditContratistaDialog } from "./EditContratistaDialog"

export interface ContratistaGastoItem {
  id: string
  fecha: string
  fechaStr: string
  fechaFormatted?: string
  year: number
  obraNombre: string
  periodo: string | null
  trabajoRealizado: string | null
  notas: string | null
  contratista: string
  total: number
  creadoPorId: string
  creadoPorNombre: string
  createdAt: any
  updatedAt: any
  isDeleted: boolean
}

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

interface ContratistasSpreadsheetClientProps {
  initialGastos: ContratistaGastoItem[]
  obras: ObraOption[]
  availableYears: number[]
  initialCards?: any[]
  contratistaGastos?: { obraNombre: string; total: number; trabajoRealizado: string | null; notas: string | null }[]
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

export default function ContratistasSpreadsheetClient({
  initialGastos,
  obras,
  availableYears,
  initialCards = [],
  contratistaGastos = [],
}: ContratistasSpreadsheetClientProps) {
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedObra, setSelectedObra] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  
  // Normalize initial cards (backwards compatibility for old string[] saves)
  const normalizedCards = useMemo<CardConfig[]>(() => {
    return initialCards.map(c => {
      if (typeof c === "string") {
        return { id: c, type: "normal", obraId: c, isEnabled: true }
      }
      return c as CardConfig
    })
  }, [initialCards])

  const [cards, setCards] = useState<CardConfig[]>(normalizedCards)
  const [isCardsDialogOpen, setIsCardsDialogOpen] = useState(false)

  // Sort states from URL
  const searchParams = useSearchParams()
  const sortField = (searchParams.get("sortBy") as keyof ContratistaGastoItem) || "fecha"
  const sortDirection = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"

  // Visible columns state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "fecha",
    "obraNombre",
    "notas",
    "periodo",
    "trabajoRealizado",
    "contratista",
    "total"
  ])

  // Form states
  const [isPending, startTransition] = useTransition()
  const [obraId, setObraId] = useState<string>("")
  const [customObras, setCustomObras] = useState<string[]>([])
  
  // Extract unique proveedores from initialGastos
  const uniqueContratistas = useMemo(() => {
    const conts = initialGastos.map(g => g.contratista).filter(Boolean)
    return Array.from(new Set(conts)).sort((a, b) => a.localeCompare(b))
  }, [initialGastos])

  // Delete state
  const [gastoToEdit, setGastoToEdit] = useState<ContratistaGastoItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Card Disable State
  const [cardToDisable, setCardToDisable] = useState<{ id: string, nombre: string, type: "normal" | "custom" } | null>(null)
  const [isCardDisableDialogOpen, setIsCardDisableDialogOpen] = useState(false)

  const [fechaStr, setFechaStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [periodo, setPeriodo] = useState<string>("")
  const [trabajoRealizado, setTrabajoRealizado] = useState<string>("")
  const [notas, setNotas] = useState<string>("")
  const [contratista, setContratista] = useState<string>("")
  const [total, setTotal] = useState<string>("")

  const handleDelete = async () => {
    if (!gastoToEdit) return
    startTransition(async () => {
      const res = await deleteContratistaGastoFromModule(gastoToEdit.id)
      if (res.success) {
        sileo.success({ title: "Gasto eliminado exitosamente" })
      } else {
        sileo.error({ title: res.error || "Error al eliminar gasto" })
      }
      setIsDeleteDialogOpen(false)
    })
  }

  const parseCurrency = (val: string) => parseFloat(val.replace(/,/g, "")) || 0
  const totalNum = parseCurrency(total)

  const formatCurrencyInput = (value: string) => {
    let val = value.replace(/[^0-9.]/g, "")
    const parts = val.split(".")
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("")
    }
    if (parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
    return parts.join(".")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!obraId) {
      sileo.error({ title: "Selecciona una obra" })
      return
    }
    if (!fechaStr) {
      sileo.error({ title: "Selecciona la fecha del gasto" })
      return
    }

    if (!obras.some(o => o.nombre === obraId.trim()) && !customObras.includes(obraId.trim())) {
      setCustomObras(prev => [...prev, obraId.trim()]);
    }
    if (!trabajoRealizado.trim()) {
      sileo.error({ title: "Ingresa el trabajo realizado" })
      return
    }
    if (totalNum <= 0) {
      sileo.error({ title: "El total debe ser mayor a 0" })
      return
    }

    startTransition(async () => {
      const res = await createContratistaGastoFromModule({
        obraNombre: obraId.trim(),
        fechaStr,
        periodo,
        trabajoRealizado,
        notas,
        contratista,
        total: totalNum,
      })

      if (!res.success) {
        sileo.error({ title: "Error", description: res.error })
        return
      }
      
      sileo.success({ title: "Pago a contratista registrado" })
      
      setPeriodo("")
      setTrabajoRealizado("")
      setNotas("")
      setContratista("")
      setTotal("")
    })
  }

  // Filtered expenses
  const filteredGastos = useMemo(() => {
    return initialGastos.filter((g) => {
      if (selectedYear !== "all" && g.year !== parseInt(selectedYear, 10)) return false
      
      const gMonth = parseInt(g.fechaStr.substring(5, 7), 10)
      if (selectedMonth !== "all" && gMonth !== parseInt(selectedMonth, 10)) return false
      
      if (selectedObra !== "all" && g.obraNombre !== selectedObra) return false
      
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchObra = g.obraNombre.toLowerCase().includes(query)
        const matchContratista = g.contratista.toLowerCase().includes(query)
        const matchTrabajo = (g.trabajoRealizado || "").toLowerCase().includes(query)
        const matchNota = (g.notas || "").toLowerCase().includes(query)
        
        if (!matchObra && !matchContratista && !matchTrabajo && !matchNota) {
          return false
        }
      }
      return true
    })
  }, [initialGastos, selectedYear, selectedMonth, selectedObra, searchTerm])

  // Sorted expenses
  const sortedGastos = useMemo(() => {
    return [...filteredGastos].sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      if (typeof valA === "string") {
        valA = valA.toLowerCase()
        valB = (valB || "").toLowerCase()
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1
      if (valA > valB) return sortDirection === "asc" ? 1 : -1
      
      // Secondary sort by fecha if primary fields are equal (or if we are grouping by proveedor)
      if (sortField !== "fecha") {
        if (a.fecha > b.fecha) return -1
        if (a.fecha < b.fecha) return 1
      }
      return 0
    })
  }, [filteredGastos, sortField, sortDirection])

  // Calculate historical totals for all NORMAL obras to pass to modal
  const allObrasCardsData = useMemo(() => {
    return obras
      .filter(obra => !cards.some(c => c.id === obra.id && (c as any).type === "deleted_normal"))
      .map(obra => {
        let totalBruto = initialGastos
          .filter(g => g.obraNombre === obra.id || g.obraNombre.toLowerCase() === obra.nombre.toLowerCase())
          .reduce((sum, g) => sum + (g.total || 0), 0)
        
        // Add contratistaGastos total
        const extra = contratistaGastos
          .filter(cg => cg.obraNombre.toLowerCase() === obra.nombre.toLowerCase() || cg.obraNombre === obra.id)
          .reduce((sum, cg) => sum + (cg.total || 0), 0)
          
        totalBruto += extra;
          
        return { id: obra.id, type: "normal" as const, obraId: obra.id, nombre: obra.nombre, totalBruto }
      })
  }, [initialGastos, obras, cards, contratistaGastos])

  // Calculate totals for Custom Cards currently in state
  const customCardsData = useMemo(() => {
    return cards.filter(c => c.type === "custom").map(card => {
      const match = obras.find(o => o.id === card.obraId)
      const baseNombre = card.obraId === "TODAS LAS OBRAS" ? "TODAS LAS OBRAS" : (match ? match.nombre : card.obraId.toUpperCase())
      const displayName = card.titulo || `${baseNombre} (${card.keyword || "Fechas"})`

      let totalBruto = initialGastos.filter(g => {
        const matchesObra = card.obraId === "TODAS LAS OBRAS" || g.obraNombre === card.obraId || g.obraNombre.toLowerCase() === card.obraId.toLowerCase()
        if (!matchesObra) return false
        
        let matchKeyword = true
        let matchDates = true

        if (card.keyword) {
          matchKeyword = g.notas ? g.notas.toLowerCase().includes(card.keyword.toLowerCase()) : false
        }
        if (card.fechaInicio || card.fechaFin) {
          const afterStart = card.fechaInicio ? g.fecha >= card.fechaInicio : true
          const beforeEnd = card.fechaFin ? g.fecha <= card.fechaFin : true
          matchDates = afterStart && beforeEnd
        }

        if (!card.keyword && !card.fechaInicio && !card.fechaFin) {
          return false
        }

        return matchKeyword && matchDates
      }).reduce((sum, g) => sum + (g.total || 0), 0)

      // Add custom card matches from contratistas
      const extra = contratistaGastos.filter(cg => {
        const matchesObra = card.obraId === "TODAS LAS OBRAS" || cg.obraNombre.toLowerCase() === card.obraId.toLowerCase() || cg.obraNombre === card.obraId
        if (!matchesObra) return false
        
        let matchKeyword = true
        let matchDates = true

        if (card.keyword) {
          matchKeyword = cg.notas ? cg.notas.toLowerCase().includes(card.keyword.toLowerCase()) : false
        }
        if (card.fechaInicio || card.fechaFin) {
          matchDates = false // We cannot filter by date if we don't have it.
        }

        if (!card.keyword && !card.fechaInicio && !card.fechaFin) {
          return false
        }

        return matchKeyword && matchDates
      }).reduce((sum, cg) => sum + (cg.total || 0), 0)
      
      totalBruto += extra;

      return { ...card, nombre: displayName, totalBruto }
    })
  }, [cards, initialGastos, obras, contratistaGastos])

  // All valid cards to display on main dashboard
  const activeCardsData = useMemo(() => {
    const normals = allObrasCardsData.filter(card => {
      const state = cards.find(c => c.type === "normal" && c.id === card.id)
      return state ? state.isEnabled !== false : true
    })
    const customs = customCardsData.filter(c => c.isEnabled !== false)
    return [...normals, ...customs]
  }, [allObrasCardsData, customCardsData, cards])

  const columns: ColumnDef<ContratistaGastoItem>[] = useMemo(() => [
    {
      id: "fecha",
      sortKey: "fecha",
      label: "Fecha",
      width: "1%",
      render: (row) => (
        <td key="fecha" className="w-[1%] px-2 py-3 font-medium text-sm whitespace-nowrap text-muted-foreground">
          {row.fechaFormatted || row.fechaStr}
        </td>
      ),
    },
    {
      id: "obraNombre",
      sortKey: "obraNombre",
      label: "Obra",
      width: "1%",
      render: (row) => (
        <td key="obraNombre" className="w-[1%] px-2 py-3 font-semibold text-sm text-muted-foreground whitespace-nowrap">
          {row.obraNombre}
        </td>
      ),
    },
    {
      id: "notas",
      label: "Notas",
      width: "7%",
      render: (row) => (
        <td key="notas" className="w-[7%] px-2 py-3 text-sm text-muted-foreground truncate" title={row.notas || ""}>
          {row.notas || "-"}
        </td>
      ),
    },
    {
      id: "periodo",
      sortKey: "periodo",
      label: "Periodo",
      width: "1%",
      render: (row) => (
        <td key="periodo" className="w-[1%] px-2 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {row.periodo}
        </td>
      ),
    },
    {
      id: "trabajoRealizado",
      sortKey: "trabajoRealizado",
      label: "Trabajo Realizado",
      width: "auto",
      render: (row) => (
        <td key="trabajoRealizado" className="w-auto px-2 py-3 text-sm text-muted-foreground whitespace-normal break-words leading-tight">
          {row.trabajoRealizado}
        </td>
      ),
    },
    {
      id: "contratista",
      sortKey: "contratista",
      label: "Contratista",
      width: "8%",
      render: (row) => (
        <td key="contratista" className="w-[8%] px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap">
          {row.contratista}
        </td>
      ),
    },
    {
      id: "total",
      sortKey: "total",
      label: "Total",
      width: "8%",
      render: (row) => (
        <td key="total" className="w-[8%] px-3 py-3 text-right font-semibold text-sm text-foreground tabular-nums tracking-tight whitespace-nowrap">
          {formatCurrency(row.total)}
        </td>
      ),
    },
  ], []);

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header Row */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Pagos a Contratistas
          </h1>
        </div>
      </div>

      {/* Cards Section */}
      {activeCardsData.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {activeCardsData.map(card => (
            <div key={card.id} className="w-[240px]">
              <ObraSummaryCard
                nombre={card.nombre}
                totalBruto={card.totalBruto}
                isActive={true}
                onClick={() => {
                  setCardToDisable({ id: card.id, nombre: card.nombre, type: card.type as "normal" | "custom" })
                  setIsCardDisableDialogOpen(true)
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Action Bar (Search, Filtros, Columnas) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar concepto, obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-2xl border-border/40 bg-muted/60 pl-9 text-xs h-10"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-2xl bg-card shadow-lg px-4 border-border/40 text-xs font-semibold">
                Filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 rounded-3xl bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl" align="start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Filtrar Gastos</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Año</label>
                    <Select value={selectedYear} onValueChange={(val) => val && setSelectedYear(val)}>
                      <SelectTrigger className="w-full rounded-xl bg-muted text-xs border-none">
                        <SelectValue placeholder="Seleccionar Año">
                          {selectedYear === "all" ? "Todos" : selectedYear}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 bg-card shadow-2xl">
                        <SelectItem value="all" className="text-xs focus:bg-muted">Todos ({availableYears.join(", ")})</SelectItem>
                        {availableYears.map((yr) => (
                          <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-muted">{yr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Mes</label>
                    <Select value={selectedMonth} onValueChange={(val) => val && setSelectedMonth(val)}>
                      <SelectTrigger className="w-full rounded-xl bg-muted text-xs border-none">
                        <SelectValue placeholder="Seleccionar Mes">
                          {selectedMonth === "all" ? "Todos" : MONTH_NAMES[parseInt(selectedMonth, 10) - 1]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 bg-card shadow-2xl">
                        <SelectItem value="all" className="text-xs focus:bg-muted">Todos</SelectItem>
                        {MONTH_NAMES.map((mName, idx) => (
                          <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs focus:bg-muted">{mName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Obra</label>
                    <Select value={selectedObra} onValueChange={(val) => val && setSelectedObra(val)}>
                      <SelectTrigger className="w-full rounded-xl bg-muted text-xs border-none">
                        <SelectValue placeholder="Seleccionar Obra">
                          {selectedObra === "all" ? "Todas" : obras.find(o => o.id === selectedObra)?.nombre || selectedObra}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 bg-card shadow-2xl">
                        <SelectItem value="all" className="text-xs focus:bg-muted">Todas las Obras</SelectItem>
                        {obras.map((o) => (
                          <SelectItem key={o.id} value={o.id} className="text-xs focus:bg-muted">{o.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-2xl bg-card shadow-lg px-4 border-border/40 text-xs font-semibold">
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 bg-card/95 backdrop-blur-xl overflow-y-auto max-h-96">
              <DropdownMenuGroup>
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="rounded-xl focus:bg-muted py-2 text-xs cursor-pointer"
                    checked={visibleColumns.includes(column.id)}
                    onCheckedChange={(checked) => {
                      setVisibleColumns(
                        checked
                          ? [...visibleColumns, column.id]
                          : visibleColumns.filter((id) => id !== column.id)
                      )
                    }}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            className="h-10 rounded-2xl bg-card shadow-lg px-4 border-border/40 text-xs font-semibold"
            onClick={() => setIsCardsDialogOpen(true)}
          >
            Tarjetas
          </Button>
          
          <Button 
            variant="outline"
            className="h-10 rounded-2xl bg-card shadow-lg px-4 border-border/40 text-xs font-semibold"
            onClick={async () => {
              const ExcelJS = (await import("exceljs")).default
              const workbook = new ExcelJS.Workbook()
              const worksheet = workbook.addWorksheet("Gastos")
              
              worksheet.columns = columns
                .filter(c => visibleColumns.includes(c.id))
                .map(c => ({
                  header: c.label,
                  key: c.id,
                  width: 15
                }))
              
              filteredGastos.forEach(g => {
                const rowData: Record<string, any> = {}
                columns.filter(c => visibleColumns.includes(c.id)).forEach(c => {
                  if (c.id === "fecha") rowData[c.id] = g.fechaFormatted || g.fechaStr
                  else if (c.id === "obraNombre") rowData[c.id] = g.obraNombre
                  else if (c.id === "periodo") rowData[c.id] = g.periodo
                  else if (c.id === "trabajoRealizado") rowData[c.id] = g.trabajoRealizado
                  else if (c.id === "notas") rowData[c.id] = g.notas
                  else if (c.id === "contratista") rowData[c.id] = g.contratista
                  else if (c.id === "total") rowData[c.id] = g.total
                })
                worksheet.addRow(rowData)
              })
              
              const buffer = await workbook.xlsx.writeBuffer()
              const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `Gastos_Export_${new Date().toISOString().split("T")[0]}.xlsx`
              a.click()
              window.URL.revokeObjectURL(url)
              sileo.success({ title: "Exportación completada" })
            }}
          >
            Excel
          </Button>
        </div>
      </div>


      {/* Inline Create Form */}
      <div className="rounded-3xl bg-card/70 p-4 shadow-lg backdrop-blur-xl">
        <form id="registro-gasto-form" onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
          
          {/* Obra */}
          <ComboboxInput
            label="Obra"
            value={obraId}
            onChange={setObraId}
            options={[...obras.map(o => o.nombre), ...customObras]}
            className="flex-[1_1_140px]"
            required
          />

          {/* Notas */}
          <div className="space-y-1.5 flex-[1_1_140px]">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Notas</Label>
            <Input
              type="text"
              placeholder="Notas u obs..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full"
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1.5 flex flex-col w-[160px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-2xl border-none bg-muted/60 px-3 py-2 text-xs text-foreground hover:bg-muted focus:ring-1 focus:ring-ring h-[36px]",
                    !fechaStr && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {fechaStr ? format(new Date(fechaStr + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-border/50 bg-card shadow-2xl backdrop-blur-xl" align="start">
                <Calendar
                  mode="single"
                  selected={fechaStr ? new Date(fechaStr + "T12:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) setFechaStr(date.toISOString().split("T")[0])
                  }}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Periodo */}
          <div className="space-y-1.5 w-[160px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Periodo</Label>
            <Input
              type="text"
              placeholder="01 ENE - 07 ENE"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full"
            />
          </div>

          {/* Contratista */}
          <ComboboxInput
            label="Contratista"
            value={contratista}
            onChange={setContratista}
            options={uniqueContratistas}
            placeholder="Jacobo Callejas..."
            className="flex-[1_1_200px]"
          />

          {/* Trabajo Realizado */}
          <div className="space-y-1.5 flex-[2_2_300px]">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Trabajo Realizado</Label>
            <Input
              type="text"
              placeholder="Descripción del trabajo..."
              value={trabajoRealizado}
              onChange={(e) => setTrabajoRealizado(e.target.value)}
              className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full"
              required
            />
          </div>


          {/* Total */}
          <div className="space-y-1.5 w-[140px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Total ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full pl-6"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            form="registro-gasto-form"
            disabled={isPending}
            size="icon"
            className="h-[36px] w-[36px] rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
            title="Registrar Pago"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>

      <EditContratistaDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        gasto={gastoToEdit}
        obras={obras}
        onSuccess={() => {
          setGastoToEdit(null)
          setIsEditDialogOpen(false)
        }}
      />

      <ConfirmDialog
        open={isCardDisableDialogOpen}
        onOpenChange={setIsCardDisableDialogOpen}
        title="Apagar Tarjeta"
        description={`¿Quieres apagar la tarjeta "${cardToDisable?.nombre}" y ocultarla de la pantalla principal?\n\nPuedes volver a encenderla en cualquier momento desde el menú de Tarjetas.`}
        confirmText="Apagar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (!cardToDisable) return
          startTransition(async () => {
            const exists = cards.find(c => c.id === cardToDisable.id && c.type === cardToDisable.type)
            let updated: any[]
            if (exists) {
              updated = cards.map(c => c === exists ? { ...c, isEnabled: false } : c)
            } else {
              updated = [...cards, { id: cardToDisable.id, type: "normal", obraId: cardToDisable.id, isEnabled: false }]
            }
            
            // Optimistic update
            setCards(updated)
            const res = await saveContratistaCards(updated)
            if (!res.success) {
              sileo.error({ title: "Error al apagar tarjeta" })
              setCards(cards) // Revert
            } else {
              sileo.success({ title: "Tarjeta apagada" })
            }
          })
        }}
      />



      <DataTable
        data={sortedGastos}
        columns={columns}
        visibleColumns={visibleColumns}
        keyExtractor={(row) => row.id}
        maxHeight="calc(100vh - 280px)"
        batchSize={100}
        totalFilteredCount={filteredGastos.length}
        totalCount={initialGastos.length}
        isFiltered={filteredGastos.length !== initialGastos.length}
        emptyMessage="No se encontraron gastos para el periodo u obra seleccionados."
        tableLayout="auto"
        onRowClick={(row) => {
          setGastoToEdit(row)
          setIsEditDialogOpen(true)
        }}
      />

      <CardsCrudDialog
        open={isCardsDialogOpen}
        onOpenChange={setIsCardsDialogOpen}
        obras={obras}
        allCardsData={[...allObrasCardsData, ...customCardsData]}
        activeCards={cards}
        onCardsChange={setCards}
      />
    </div>
  )
}
