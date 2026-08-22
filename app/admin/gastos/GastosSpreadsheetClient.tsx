"use client"

import React, { useState, useMemo, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, ColumnDef } from "@/app/components/DataTable"
import { useSearchParams, useRouter } from "next/navigation"
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
  DropdownMenuSeparator,
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
import { createGastoFromModule, deleteGastoFromModule } from "@/lib/actions/gastos-module"
import { saveCardsObras } from "@/lib/actions/cards-module"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CardsCrudDialog } from "./CardsCrudDialog"
import { EditGastoDialog } from "./EditGastoDialog"
import { SlidingTabs } from "@/components/ui/sliding-tabs"

export interface GastoItem {
  id: string
  fecha: string
  fechaFormatted: string
  year: number
  month: number
  obraId: string
  obraNombre: string
  proveedor: string
  concepto: string
  categoria: string | null
  subtotal: number
  porcentajeIVA: number
  iva: number
  total: number
  subtotal8?: number
  subtotal16?: number
  subtotal0?: number
  iva8?: number
  iva16?: number
  ieps?: number
  descuento?: number
  ivaRetenido?: number
  isrRetenido?: number
  notaCapturista: string | null
  creadoPorNombre: string
  estado: string
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

interface GastosSpreadsheetClientProps {
  initialGastos: GastoItem[]
  obras: ObraOption[]
  availableYears: number[]
  initialCards?: any[]
  contratistaGastos?: { obraNombre: string; total: number; trabajoRealizado: string | null }[]
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

export default function GastosSpreadsheetClient({
  initialGastos,
  obras,
  availableYears,
  initialCards = [],
  contratistaGastos = [],
}: GastosSpreadsheetClientProps) {
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedObras, setSelectedObras] = useState<string[]>([])
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const sortField = (searchParams.get("sortBy") as keyof GastoItem) || "fecha"
  const sortDirection = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"

  // Visible columns state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "fecha",
    "obraNombre",
    "proveedor",
    "notas",
    "unidad",
    "concepto",
    "subtotal",
    "subtotal8",
    "subtotal16",
    "subtotal0",
    "iva",
    "iva8",
    "iva16",
    "ieps",
    "descuento",
    "ivaRetenido",
    "isrRetenido",
    "total"
  ])

  // Form states
  const [isPending, startTransition] = useTransition()
  const [obraId, setObraId] = useState<string>("")
  const [customObras, setCustomObras] = useState<string[]>([])
  
  // Extract unique proveedores from initialGastos
  const uniqueProveedores = useMemo(() => {
    const provs = initialGastos.map(g => g.proveedor).filter(Boolean)
    return Array.from(new Set(provs)).sort((a, b) => a.localeCompare(b))
  }, [initialGastos])

  // Delete state
  const [gastoToEdit, setGastoToEdit] = useState<GastoItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Card Disable State
  const [cardToDisable, setCardToDisable] = useState<{ id: string, nombre: string, type: "normal" | "custom" } | null>(null)
  const [isCardDisableDialogOpen, setIsCardDisableDialogOpen] = useState(false)

  const [fechaStr, setFechaStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [concepto, setConcepto] = useState<string>("")
  const [proveedor, setProveedor] = useState<string>("")
  const [categoria, setCategoria] = useState<string>("")
  const [subtotal, setSubtotal] = useState<string>("")
  const [porcentajeIVA, setPorcentajeIVA] = useState<number>(0)
  const [ieps, setIeps] = useState<string>("")
  const [descuento, setDescuento] = useState<string>("")
  const [ivaRetenido, setIvaRetenido] = useState<string>("")
  const [isrRetenido, setIsrRetenido] = useState<string>("")
  const [notaCapturista, setNotaCapturista] = useState<string>("")

  const handleDelete = async () => {
    if (!gastoToEdit) return
    startTransition(async () => {
      const res = await deleteGastoFromModule(gastoToEdit.id)
      if (res.success) {
        sileo.success({ title: "Gasto eliminado exitosamente" })
      } else {
        sileo.error({ title: res.error || "Error al eliminar gasto" })
      }
      setIsDeleteDialogOpen(false)
    })
  }

  const parseCurrency = (val: string) => parseFloat(val.replace(/,/g, "")) || 0
  const subNum = parseCurrency(subtotal)

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
    if (!concepto.trim()) {
      sileo.error({ title: "Ingresa el concepto del gasto" })
      return
    }
    if (subNum <= 0) {
      sileo.error({ title: "El subtotal debe ser mayor a 0" })
      return
    }

    startTransition(async () => {
      const res = await createGastoFromModule({
        obraId,
        fechaStr,
        concepto,
        proveedor: proveedor || "N/A",
        categoria,
        subtotal: subNum,
        porcentajeIVA,
        ieps: parseCurrency(ieps) || undefined,
        descuento: parseCurrency(descuento) || undefined,
        ivaRetenido: parseCurrency(ivaRetenido) || undefined,
        isrRetenido: parseCurrency(isrRetenido) || undefined,
        notaCapturista,
      })

      if (res.success) {
        sileo.success({ title: "Gasto registrado exitosamente" })
        setConcepto("")
        setProveedor("")
        setCategoria("")
        setSubtotal("")
        setPorcentajeIVA(0)
        setIeps("")
        setDescuento("")
        setIvaRetenido("")
        setIsrRetenido("")
        setNotaCapturista("")
      } else {
        sileo.error({ title: res.error || "Error al registrar gasto" })
      }
    })
  }

  // Filtered expenses
  const filteredGastos = useMemo(() => {
    return initialGastos.filter((g) => {
      if (selectedYear !== "all" && g.year !== parseInt(selectedYear, 10)) return false
      if (selectedMonth !== "all" && g.month !== parseInt(selectedMonth, 10)) return false
      if (selectedObras.length > 0 && !selectedObras.includes(g.obraId)) return false
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchConcepto = g.concepto.toLowerCase().includes(query)
        const matchProveedor = (g.proveedor || "").toLowerCase().includes(query)
        const matchObra = g.obraNombre.toLowerCase().includes(query)
        const matchNota = (g.notaCapturista || "").toLowerCase().includes(query)
        const matchCategoria = (g.categoria || "").toLowerCase().includes(query)
        if (!matchConcepto && !matchProveedor && !matchObra && !matchNota && !matchCategoria) {
          return false
        }
      }
      return true
    })
  }, [initialGastos, selectedYear, selectedMonth, selectedObras, searchTerm])

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

  const uniqueObras = useMemo(() => {
    const map = new Map<string, ObraOption>()
    for (const o of obras) {
      const key = o.nombre.trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, o)
      }
    }
    return Array.from(map.values())
  }, [obras])

  // Calculate historical totals for all NORMAL obras to pass to modal
  const allObrasCardsData = useMemo(() => {
    return uniqueObras
      .filter(obra => !cards.some(c => c.id === obra.id && (c as any).type === "deleted_normal"))
      .map(obra => {
        let totalBruto = initialGastos
          .filter(g => g.obraId === obra.id || g.obraNombre.toLowerCase() === obra.nombre.toLowerCase())
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
        const matchesObra = card.obraId === "TODAS LAS OBRAS" || g.obraId === card.obraId || g.obraNombre.toLowerCase() === card.obraId.toLowerCase()
        if (!matchesObra) return false
        
        // Smart filtering: check keyword, check dates.
        let matchKeyword = true
        let matchDates = true

        if (card.keyword) {
          matchKeyword = g.notaCapturista ? g.notaCapturista.toLowerCase().includes(card.keyword.toLowerCase()) : false
        }
        if (card.fechaInicio || card.fechaFin) {
          const afterStart = card.fechaInicio ? g.fecha >= card.fechaInicio : true
          const beforeEnd = card.fechaFin ? g.fecha <= card.fechaFin : true
          matchDates = afterStart && beforeEnd
        }

        // If neither keyword nor dates are defined, no filters
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
          matchKeyword = cg.trabajoRealizado ? cg.trabajoRealizado.toLowerCase().includes(card.keyword.toLowerCase()) : false
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
    return [...normals, ...customs].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [allObrasCardsData, customCardsData, cards])

  const columns: ColumnDef<GastoItem>[] = useMemo(() => [
    {
      id: "fecha",
      sortKey: "fecha",
      label: "Fecha",
      render: (row) => (
        <td key="fecha" className="w-[5%] px-2 py-3 text-sm text-foreground truncate" title={row.fechaFormatted}>
          {row.fechaFormatted}
        </td>
      ),
    },
    {
      id: "obraNombre",
      sortKey: "obraNombre",
      label: "Obra",
      render: (row) => (
        <td key="obraNombre" className="w-[6%] px-2 py-3 font-medium text-sm text-foreground truncate" title={row.obraNombre}>
          {row.obraNombre}
        </td>
      ),
    },
    {
      id: "proveedor",
      sortKey: "proveedor",
      label: "Proveedor",
      render: (row) => (
        <td key="proveedor" className="w-[10%] px-2 py-3 text-sm text-foreground truncate" title={row.proveedor || ""}>
          {row.proveedor || "-"}
        </td>
      ),
    },
    {
      id: "notas",
      label: "Notas",
      render: (row) => (
        <td key="notas" className="w-[7%] px-2 py-3 text-sm text-muted-foreground truncate" title={row.notaCapturista || ""}>
          {row.notaCapturista || "-"}
        </td>
      ),
    },
    {
      id: "unidad",
      label: "Unidad",
      render: (row) => (
        <td key="unidad" className="w-[3%] px-2 py-3 text-sm text-muted-foreground truncate" title={row.categoria || ""}>
          {row.categoria || "-"}
        </td>
      ),
    },

    {
      id: "concepto",
      sortKey: "concepto",
      label: "Concepto",
      render: (row) => (
        <td
          key="concepto"
          className="w-[12%] px-2 py-3 text-sm text-foreground truncate cursor-pointer hover:bg-muted transition-colors rounded-md"
          title={row.concepto}
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(row.concepto)
            sileo.success({ title: "Concepto copiado" })
          }}
        >
          {row.concepto}
        </td>
      ),
    },
    {
      id: "subtotal",
      sortKey: "subtotal",
      label: "Subtotal",
      rightAligned: true,
      render: (row) => (
        <td key="subtotal" className="w-[6%] px-2 py-3 text-right text-sm text-foreground truncate">
          {formatCurrency(row.subtotal)}
        </td>
      ),
    },
    {
      id: "subtotal8",
      label: "Sub. 8%",
      rightAligned: true,
      render: (row) => (
        <td key="subtotal8" className="w-[5%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.subtotal8 ? formatCurrency(row.subtotal8) : "-"}
        </td>
      ),
    },
    {
      id: "subtotal16",
      label: "Sub. 16%",
      rightAligned: true,
      render: (row) => (
        <td key="subtotal16" className="w-[5%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.subtotal16 ? formatCurrency(row.subtotal16) : "-"}
        </td>
      ),
    },
    {
      id: "subtotal0",
      label: "Sub. 0%",
      rightAligned: true,
      render: (row) => (
        <td key="subtotal0" className="w-[5%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.subtotal0 ? formatCurrency(row.subtotal0) : "-"}
        </td>
      ),
    },
    {
      id: "iva",
      label: "IVA %",
      rightAligned: true,
      render: (row) => (
        <td key="iva" className="w-[3%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.porcentajeIVA}%
        </td>
      ),
    },
    {
      id: "iva8",
      label: "IVA 8%",
      rightAligned: true,
      render: (row) => (
        <td key="iva8" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.iva8 ? formatCurrency(row.iva8) : "-"}
        </td>
      ),
    },
    {
      id: "iva16",
      label: "IVA 16%",
      rightAligned: true,
      render: (row) => (
        <td key="iva16" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.iva16 ? formatCurrency(row.iva16) : "-"}
        </td>
      ),
    },
    {
      id: "ieps",
      label: "IEPS",
      rightAligned: true,
      render: (row) => (
        <td key="ieps" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.ieps ? formatCurrency(row.ieps) : "-"}
        </td>
      ),
    },
    {
      id: "descuento",
      label: "Descto.",
      rightAligned: true,
      render: (row) => (
        <td key="descuento" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.descuento ? formatCurrency(row.descuento) : "-"}
        </td>
      ),
    },
    {
      id: "ivaRetenido",
      label: "IVA Ret.",
      rightAligned: true,
      render: (row) => (
        <td key="ivaRetenido" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.ivaRetenido ? formatCurrency(row.ivaRetenido) : "-"}
        </td>
      ),
    },
    {
      id: "isrRetenido",
      label: "ISR Ret.",
      rightAligned: true,
      render: (row) => (
        <td key="isrRetenido" className="w-[4%] px-2 py-3 text-right text-sm text-muted-foreground truncate">
          {row.isrRetenido ? formatCurrency(row.isrRetenido) : "-"}
        </td>
      ),
    },
    {
      id: "total",
      sortKey: "total",
      label: "Total",
      rightAligned: true,
      render: (row) => (
        <td key="total" className="w-[8%] px-2 py-3 text-right text-sm font-bold text-foreground truncate">
          {formatCurrency(row.total)}
        </td>
      ),
    },
    {
      id: "capturista",
      label: "Capturista",
      render: (row) => (
        <td key="capturista" className="w-[6%] px-2 py-3 text-[10px] text-muted-foreground truncate" title={row.creadoPorNombre}>
          <span className="text-[10px] font-medium text-foreground/80">
            {row.creadoPorNombre}
          </span>
        </td>
      ),
    }
  ], []);

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header Row */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            MCA OUTLAY
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/contratistas">
            <Button variant="secondary" className="rounded-xl px-6 shadow-sm border border-border/50 bg-muted/30">
              Contratistas
            </Button>
          </a>
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
                    <label className="text-xs font-medium text-muted-foreground">Obras</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between rounded-xl bg-muted text-xs border-none h-9 px-3 font-normal hover:bg-muted">
                          <span className="truncate">
                            {selectedObras.length === 0
                              ? "Todas las Obras"
                              : selectedObras.length === 1
                                ? (obras.find(o => o.id === selectedObras[0])?.nombre || selectedObras[0])
                                : `${selectedObras.length} obras seleccionadas`}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-72 rounded-xl border-border/50 bg-card shadow-2xl p-1 max-h-64 overflow-y-auto" align="start">
                        <DropdownMenuCheckboxItem
                          className="rounded-lg focus:bg-muted py-2 text-xs cursor-pointer font-semibold"
                          checked={selectedObras.length === 0}
                          onCheckedChange={() => setSelectedObras([])}
                        >
                          Todas las Obras
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator className="my-1" />
                        {obras.map((o) => (
                          <DropdownMenuCheckboxItem
                            key={o.id}
                            className="rounded-lg focus:bg-muted py-2 text-xs cursor-pointer"
                            checked={selectedObras.includes(o.id)}
                            onCheckedChange={(checked) => {
                              setSelectedObras(prev =>
                                checked
                                  ? [...prev, o.id]
                                  : prev.filter(id => id !== o.id)
                              )
                            }}
                          >
                            {o.nombre}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  if (c.id === "fecha") rowData[c.id] = g.fechaFormatted
                  else if (c.id === "obraNombre") rowData[c.id] = g.obraNombre
                  else if (c.id === "proveedor") rowData[c.id] = g.proveedor
                  else if (c.id === "notas") rowData[c.id] = g.notaCapturista
                  else if (c.id === "unidad") rowData[c.id] = g.categoria
                  else if (c.id === "concepto") rowData[c.id] = g.concepto
                  else if (c.id === "subtotal") rowData[c.id] = g.subtotal
                  else if (c.id === "subtotal8") rowData[c.id] = g.subtotal8
                  else if (c.id === "subtotal16") rowData[c.id] = g.subtotal16
                  else if (c.id === "subtotal0") rowData[c.id] = g.subtotal0
                  else if (c.id === "iva") rowData[c.id] = g.porcentajeIVA
                  else if (c.id === "iva8") rowData[c.id] = g.iva8
                  else if (c.id === "iva16") rowData[c.id] = g.iva16
                  else if (c.id === "ieps") rowData[c.id] = g.ieps
                  else if (c.id === "descuento") rowData[c.id] = g.descuento
                  else if (c.id === "ivaRetenido") rowData[c.id] = g.ivaRetenido
                  else if (c.id === "isrRetenido") rowData[c.id] = g.isrRetenido
                  else if (c.id === "total") rowData[c.id] = g.total
                  else if (c.id === "capturista") rowData[c.id] = g.creadoPorNombre
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
        <form id="registro-gasto-form" onSubmit={handleSubmit} autoComplete="off" className="flex flex-wrap gap-4 items-end">
          
          {/* Obra */}
          <ComboboxInput
            label="Obra"
            value={obraId}
            onChange={setObraId}
            options={[...obras.map(o => o.nombre), ...customObras]}
            className="flex-[1_1_200px]"
            required
          />

          {/* Fecha */}
          <div className="space-y-1.5 flex flex-col w-[260px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-2xl border-none bg-muted/60 px-3 py-2 text-sm text-foreground hover:bg-muted focus:ring-1 focus:ring-ring h-[36px]",
                    !fechaStr && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {fechaStr ? format(new Date(fechaStr + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Selecciona fecha</span>}
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

          {/* Notas */}
          <div className="space-y-1.5 flex-[2_2_300px]">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Notas</Label>
            <Input
              type="text"
              placeholder="Observaciones..."
              value={notaCapturista}
              onChange={(e) => setNotaCapturista(e.target.value)}
              className="rounded-2xl bg-muted/60 text-sm h-[36px] border-none w-full"
            />
          </div>

          {/* Subtotal */}
          <div className="space-y-1.5 w-[140px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Subtotal ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="0.00"
                value={subtotal}
                onChange={(e) => setSubtotal(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-sm font-medium h-[36px] border-none w-full pl-6"
                required
              />
            </div>
          </div>

          {/* Tasa IVA */}
          <div className="space-y-1.5 w-[160px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Tasa IVA</Label>
            <div className="flex rounded-2xl bg-muted/60 p-1 h-[36px]">
              <SlidingTabs 
                tabs={["0%", "8%", "16%"]}
                activeTab={porcentajeIVA === 0 ? 0 : porcentajeIVA === 8 ? 1 : 2}
                onChange={(idx) => {
                  if (idx === 0) setPorcentajeIVA(0)
                  if (idx === 1) setPorcentajeIVA(8)
                  if (idx === 2) setPorcentajeIVA(16)
                }}
              />
            </div>
          </div>

          {/* IEPS */}
          <div className="space-y-1.5 w-[120px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">IEPS ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="0.00"
                value={ieps}
                onChange={(e) => setIeps(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-sm font-medium h-[36px] border-none w-full pl-6"
              />
            </div>
          </div>

          {/* Descto */}
          <div className="space-y-1.5 w-[120px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Descto ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="0.00"
                value={descuento}
                onChange={(e) => setDescuento(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-sm font-medium h-[36px] border-none w-full pl-6"
              />
            </div>
          </div>

          {/* Retención */}
          <div className="space-y-1.5 w-[120px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Retención ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="IVA"
                title="IVA Retenido"
                value={ivaRetenido}
                onChange={(e) => setIvaRetenido(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-sm font-medium h-[36px] border-none w-full pl-6"
              />
            </div>
          </div>

          {/* ISR Ret. */}
          <div className="space-y-1.5 w-[120px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">ISR Ret. ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="ISR"
                value={isrRetenido}
                onChange={(e) => setIsrRetenido(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-sm font-medium h-[36px] border-none w-full pl-6"
              />
            </div>
          </div>

          {/* Unidad (Categoria) */}
          <div className="space-y-1.5 w-[120px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Unidad</Label>
            <Input
              type="text"
              placeholder="Pza, Kg..."
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-2xl bg-muted/60 text-sm h-[36px] border-none w-full"
            />
          </div>

          {/* Proveedor */}
          <ComboboxInput
            label="Proveedor"
            value={proveedor}
            onChange={setProveedor}
            options={uniqueProveedores}
            placeholder="Home Depot, Cemex..."
            className="flex-[1_1_200px]"
            autoComplete="off"
          />

          {/* Concepto */}
          <div className="space-y-1.5 flex-[1_1_250px]">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Concepto</Label>
            <Input
              type="text"
              placeholder="Gasolina, Varilla..."
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="rounded-2xl bg-muted/60 text-sm h-[36px] border-none w-full"
              required
            />
          </div>

          <Button
            type="submit"
            form="registro-gasto-form"
            disabled={isPending}
            size="icon"
            className="h-[36px] w-[36px] rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
            title="Agregar Gasto"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>

      <EditGastoDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        gasto={gastoToEdit}
        obras={uniqueObras}
        uniqueProveedores={uniqueProveedores}
        activeCards={cards}
        onSuccess={() => {
          setGastoToEdit(null)
          setIsEditDialogOpen(false)
          router.refresh()
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
            const res = await saveCardsObras(updated)
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
        tableLayout="fixed"
        onRowClick={(row) => {
          setGastoToEdit(row)
          setIsEditDialogOpen(true)
        }}
      />

      <CardsCrudDialog
        open={isCardsDialogOpen}
        onOpenChange={setIsCardsDialogOpen}
        obras={uniqueObras}
        allCardsData={[...allObrasCardsData, ...customCardsData]}
        activeCards={cards}
        onCardsChange={setCards}
      />
    </div>
  )
}
