"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  setPresupuestoDiario,
  setReposicionDiaria,
  verifyGasto,
  saveAdminNote,
  deleteAdminNote,
  softDeleteExpenseAdmin,
  restoreExpenseAdmin,
  createDiaObraAdmin,
  softDeleteDiaObraAdmin,
  restoreDiaObraAdmin,
  updateGastoIva,
  updateGastoAdmin,
  getUniqueProveedores,
  getUniqueCategorias,
  verifyGastosBatchWithAI,
} from "@/lib/actions/gastos"
import { sileo } from "sileo"
import type { GastoEstado } from "@prisma/client"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { AlertDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import CapturaExpenseForm from "./CapturaExpenseForm"
import { formatCurrency } from "@/lib/formatters"
import PdfPreviewModal from "@/app/components/PdfPreviewModal"
import PhotoPreviewGallery from "@/app/components/PhotoPreviewGallery"
import ReposicionesModal from "@/app/components/ReposicionesModal"
import {
  format,
  addDays,
  startOfWeek,
  subWeeks,
  addWeeks,
  eachDayOfInterval,
} from "date-fns"
import { es } from "date-fns/locale"

interface DayData {
  id: string
  fecha: string
  fechaISO: string
  presupuestoDiario: number
  reposicion: number
  totalGastado: number
  saldoAFavor: number
  gastosCount: number
  proveedoresTotales: Record<string, { total: number; count: number }>
}

interface ProjectDaysTableProps {
  days: DayData[]
  obraId: string
  isReadOnly?: boolean
  basePath?: string
}

export default function ProjectDaysTable({
  days,
  obraId,
  isReadOnly = false,
  basePath = "/admin/obras",
}: ProjectDaysTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [archivedDays, setArchivedDays] = useState<Set<string>>(new Set())

  const reposiciones = days
    .filter((d) => d.reposicion > 0)
    .map((d) => ({ fecha: d.fecha, monto: d.reposicion }))
  const totalReposiciones = reposiciones.reduce(
    (acc, curr) => acc + curr.monto,
    0
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`archivedDays_${obraId}`)
      if (stored) {
        setArchivedDays(new Set(JSON.parse(stored)))
      }
    } catch (e) {
      console.error("Error reading archived days", e)
    }
  }, [obraId])

  // Load unique proveedores and categorias for the edit dropdowns
  useEffect(() => {
    getUniqueProveedores(obraId)
      .then((data) => setEditProveedoresOptions(data))
      .catch(console.error)
    getUniqueCategorias(obraId)
      .then((data) => setEditCategoriasOptions(data))
      .catch(console.error)
  }, [obraId])

  const toggleArchiveDay = (dayId: string) => {
    setArchivedDays((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(dayId)) {
        newSet.delete(dayId)
      } else {
        newSet.add(dayId)
      }
      localStorage.setItem(
        `archivedDays_${obraId}`,
        JSON.stringify(Array.from(newSet))
      )
      return newSet
    })
  }

  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [editingBudgetDay, setEditingBudgetDay] = useState<string | null>(null)
  const [budgetValue, setBudgetValue] = useState("")
  const [editingReposicionDay, setEditingReposicionDay] = useState<
    string | null
  >(null)
  const [reposicionValue, setReposicionValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [isAIVerifying, setIsAIVerifying] = useState(false)

  const handleAIVerify = async () => {
    setIsAIVerifying(true)
    try {
      const res = await verifyGastosBatchWithAI(obraId)
      if (res.success) {
        sileo.success({
          title: "Auditoría IA Completada",
          description: `Revisados: ${res.procesados} | Aprobados: ${res.aprobados} | Rechazados: ${res.rechazados}`,
          duration: 10000,
        })
        if (expandedDay) await handleFetchExpenses(expandedDay)
      }
    } catch (e: any) {
      sileo.error({
        title: "Error de IA",
        description: e.message || "No se pudo completar la verificación automática."
      })
    } finally {
      setIsAIVerifying(false)
    }
  }

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

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const generateWeekDays = () => {
    const d = []
    for (let i = 0; i < 7; i++) {
      d.push(addDays(weekStart, i))
    }
    return d
  }

  // States for expenses details
  const [expenses, setExpenses] = useState<any[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [selectedGastoForModal, setSelectedGastoForModal] = useState<
    any | null
  >(null)

  // States for admin notes
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<Record<string, boolean>>({})
  const [savedNote, setSavedNote] = useState<Record<string, boolean>>({})
  const [updatingIva, setUpdatingIva] = useState<string | null>(null)
  const [animatingExpenseId, setAnimatingExpenseId] = useState<string | null>(
    null
  )
  const [animatingDayId, setAnimatingDayId] = useState<string | null>(null)
  const [deletingNote, setDeletingNote] = useState<{
    [gastoId: string]: boolean
  }>({})
  const [deletingExpense, setDeletingExpense] = useState<{
    [gastoId: string]: boolean
  }>({})
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)

  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  )

  // States for inline editing of a gasto
  const [isEditingGasto, setIsEditingGasto] = useState(false)
  const [editGastoLoading, setEditGastoLoading] = useState(false)
  const [editConcepto, setEditConcepto] = useState("")
  const [editProveedor, setEditProveedor] = useState("")
  const [editCategoria, setEditCategoria] = useState("")
  const [editIsImprevisto, setEditIsImprevisto] = useState(false)
  const [editRestarPresupuesto, setEditRestarPresupuesto] = useState(false)
  const [editPorcentajeIVA, setEditPorcentajeIVA] = useState("16")
  const [editTotal, setEditTotal] = useState("")
  const [editNotaCapturista, setEditNotaCapturista] = useState("")

  // Dropdown states for proveedor in edit mode
  const [editProveedoresOptions, setEditProveedoresOptions] = useState<
    string[]
  >([])
  const [editShowProveedores, setEditShowProveedores] = useState(false)
  const [editIsAddingProveedor, setEditIsAddingProveedor] = useState(false)

  // Dropdown states for categoria in edit mode
  const [editCategoriasOptions, setEditCategoriasOptions] = useState<string[]>(
    []
  )
  const [editShowCategorias, setEditShowCategorias] = useState(false)
  const [editIsAddingCategoria, setEditIsAddingCategoria] = useState(false)

  // States for creating a new day
  const [isAddDayOpen, setIsAddDayOpen] = useState(false)
  const [newDayDate, setNewDayDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [newDayBudget, setNewDayBudget] = useState("")
  const [creatingDay, setCreatingDay] = useState(false)

  const [dayToDelete, setDayToDelete] = useState<string | null>(null)
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")

  // States for creating expense directly
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [selectedExpenseDay, setSelectedExpenseDay] = useState<string>("")

  // Advanced Filter & Sort States
  const [filterDates, setFilterDates] = useState<string[]>([])
  const initialProvider = searchParams.get("proveedor") || ""
  const [filterProvider, setFilterProvider] = useState<string>(initialProvider)
  const [sortBy, setSortBy] = useState<
    "fecha" | "presupuesto" | "gastado" | "saldo"
  >("fecha")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const carouselRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -150, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 150, behavior: "smooth" })
    }
  }

  // Derived dates for the carousel (all days from earliest recorded up to today)
  const allDates = useMemo(() => {
    if (days.length === 0) {
      const today = new Date()
      return eachDayOfInterval({ start: addDays(today, -7), end: today })
    }

    const timeValues = days.map((d) => {
      const [year, month, day] = d.fechaISO.split("-").map(Number)
      return new Date(year, month - 1, day).getTime()
    })

    const minTime = Math.min(...timeValues)
    const maxTime = Math.max(...timeValues)

    const start = new Date(minTime)
    let end = new Date(maxTime)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) {
      end = today
    }

    return eachDayOfInterval({ start, end })
  }, [days])

  const allProviders = useMemo(() => {
    const provs = new Set<string>()
    days.forEach((d) => {
      Object.keys(d.proveedoresTotales).forEach((p) => provs.add(p))
    })
    return Array.from(provs).sort()
  }, [days])

  const handleFetchExpenses = async (diaObraId: string) => {
    setLoadingExpenses(true)
    try {
      const res = await fetch(`/api/gastos?diaObraId=${diaObraId}`)
      if (!res.ok) throw new Error("Error fetching expenses")
      const data = await res.json()
      setExpenses(data)

      // Pre-fill admin notes state
      const notes: { [gastoId: string]: string } = {}
      data.forEach((g: any) => {
        notes[g.id] = g.notaAdmin || ""
      })
      setAdminNotes(notes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingExpenses(false)
    }
  }

  const toggleExpandDay = async (dayId: string) => {
    if (expandedDay === dayId) {
      setExpandedDay(null)
    } else {
      setExpandedDay(dayId)
      await handleFetchExpenses(dayId)
    }
  }

  const handleSaveBudget = async () => {
    if (!editingBudgetDay) return

    const budgetNum = parseFloat(budgetValue.replace(/,/g, ""))
    if (isNaN(budgetNum) || budgetNum < 0) {
      setAlertMsg("Por favor ingrese un presupuesto diario válido.")
      return
    }

    setLoading(true)
    try {
      await setPresupuestoDiario(editingBudgetDay, budgetNum)
      setEditingBudgetDay(null)
      setBudgetValue("")
      router.refresh()
    } catch (err: any) {
      setAlertMsg(err.message || "Error al actualizar presupuesto diario.")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveReposicion = async () => {
    if (!editingReposicionDay) return

    let repNum = 0
    if (reposicionValue.trim() !== "") {
      repNum = parseFloat(reposicionValue.replace(/,/g, ""))
      if (isNaN(repNum) || repNum < 0) {
        setAlertMsg("Por favor ingrese una reposición válida.")
        return
      }
    }

    setLoading(true)
    try {
      await setReposicionDiaria(editingReposicionDay, repNum)
      setEditingReposicionDay(null)
      setReposicionValue("")
      router.refresh()
    } catch (err: any) {
      setAlertMsg(err.message || "Error al actualizar reposición.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDayDate || !newDayBudget) {
      setAlertMsg("Por favor completa todos los campos.")
      return
    }

    const budgetNum = parseFloat(newDayBudget.replace(/,/g, ""))
    if (isNaN(budgetNum) || budgetNum < 0) {
      setAlertMsg("Por favor ingrese un presupuesto diario válido.")
      return
    }

    setCreatingDay(true)
    try {
      const res = await createDiaObraAdmin(obraId, {
        fecha: newDayDate,
        presupuestoDiario: budgetNum,
      })

      if (res?.error) {
        setAlertMsg(res.error)
        return
      }

      setIsAddDayOpen(false)
      setNewDayDate("")
      setNewDayBudget("")
      sileo.success({ title: "Éxito", description: "Día creado exitosamente." })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al crear el día.",
      })
      setAlertMsg(err.message || "Error al crear el día.")
    } finally {
      setCreatingDay(false)
    }
  }

  const handleDeleteDay = async (diaObraId: string) => {
    setDeletingDayId(diaObraId)
    setAnimatingDayId(diaObraId)
    if (expandedDay === diaObraId) setExpandedDay(null)
    setDayToDelete(null)

    await new Promise((resolve) => setTimeout(resolve, 600))

    try {
      await softDeleteDiaObraAdmin(diaObraId)
      sileo.success({
        title: "Éxito",
        description: "Día eliminado.",
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
              setAnimatingDayId(null)
              await restoreDiaObraAdmin(diaObraId)
              sileo.success({
                title: "Restaurado",
                description: "El día ha sido restaurado.",
                position: "top-center",
              })
              router.refresh()
            } catch (err) {
              sileo.error({
                title: "Error",
                description: "No se pudo restaurar el día.",
                position: "top-center",
              })
            }
          },
        },
      })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al eliminar el día.",
      })
      setAlertMsg(err.message || "Error al eliminar el día.")
      setAnimatingDayId(null)
    } finally {
      setDeletingDayId(null)
    }
  }

  const handleVerifyStatus = async (gastoId: string, status: GastoEstado) => {
    try {
      await verifyGasto(gastoId, { estado: status })
      if (expandedDay) {
        await handleFetchExpenses(expandedDay)
      }
      setSelectedGastoForModal(null)
    } catch (err: any) {
      setAlertMsg(err.message || "Error al verificar gasto.")
    }
  }

  const handleUpdateIva = async (gastoId: string, pct: number) => {
    setUpdatingIva(gastoId)
    try {
      await updateGastoIva(gastoId, pct)
      if (expandedDay) {
        await handleFetchExpenses(expandedDay)
      }
    } catch (err: any) {
      setAlertMsg(err.message || "Error al actualizar IVA.")
    } finally {
      setUpdatingIva(null)
    }
  }

  const handleAdminNoteChange = (gastoId: string, value: string) => {
    setAdminNotes((prev) => ({ ...prev, [gastoId]: value }))
    setSavedNote((prev) => ({ ...prev, [gastoId]: false }))
  }

  const handleSaveAdminNote = async (gastoId: string) => {
    setSavingNote((prev) => ({ ...prev, [gastoId]: true }))
    try {
      await saveAdminNote(gastoId, adminNotes[gastoId] || "")
      setSavedNote((prev) => ({ ...prev, [gastoId]: true }))
      // Refresh expenses
      if (expandedDay) await handleFetchExpenses(expandedDay)
    } catch (err: any) {
      setAlertMsg(err.message || "Error al guardar la nota.")
    } finally {
      setSavingNote((prev) => ({ ...prev, [gastoId]: false }))
    }
  }

  const handleDeleteAdminNoteClick = (gastoId: string) => {
    setConfirmDeleteNoteId(gastoId)
  }

  const executeDeleteAdminNote = async () => {
    if (!confirmDeleteNoteId) return
    const gastoId = confirmDeleteNoteId
    setDeletingNote((prev) => ({ ...prev, [gastoId]: true }))
    try {
      await deleteAdminNote(gastoId)
      setAdminNotes((prev) => ({ ...prev, [gastoId]: "" }))
      setSavedNote((prev) => ({ ...prev, [gastoId]: false }))
      if (expandedDay) await handleFetchExpenses(expandedDay)
    } catch (err: any) {
      setAlertMsg(err.message || "Error al eliminar la nota.")
    } finally {
      setDeletingNote((prev) => ({ ...prev, [gastoId]: false }))
      setConfirmDeleteNoteId(null)
    }
  }

  const handleDeleteExpense = async (gastoId: string) => {
    setDeletingExpense((prev) => ({ ...prev, [gastoId]: true }))
    setAnimatingExpenseId(gastoId)

    await new Promise((resolve) => setTimeout(resolve, 600))

    try {
      await softDeleteExpenseAdmin(gastoId)
      if (expandedDay) await handleFetchExpenses(expandedDay)
      // Update the global metrics on the page without reloading the entire window
      sileo.success({
        title: "Éxito",
        description: "Gasto eliminado.",
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
              setAnimatingExpenseId(null)
              await restoreExpenseAdmin(gastoId)
              sileo.success({
                title: "Restaurado",
                description: "El gasto ha sido restaurado.",
                position: "top-center",
              })
              if (expandedDay) await handleFetchExpenses(expandedDay)
              router.refresh()
            } catch (err) {
              sileo.error({
                title: "Error",
                description: "No se pudo restaurar el gasto.",
                position: "top-center",
              })
            }
          },
        },
      })
      router.refresh()
    } catch (err: any) {
      sileo.error({
        title: "Error",
        description: err.message || "Error al eliminar el gasto.",
      })
      setAlertMsg(err.message || "Error al eliminar el gasto.")
      setAnimatingExpenseId(null)
    } finally {
      setDeletingExpense((prev) => ({ ...prev, [gastoId]: false }))
    }
  }

  const handleNoteKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    gastoId: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSaveAdminNote(gastoId)
    }
  }

  const filteredDays = days.filter(
    (d) =>
      (filterDates.length === 0 || filterDates.includes(d.fechaISO)) &&
      (!filterProvider ||
        filterProvider.trim() === "" ||
        d.proveedoresTotales[filterProvider] !== undefined)
  )

  const sortedDays = [...filteredDays].sort((a, b) => {
    let comparison = 0
    if (sortBy === "fecha") {
      comparison = a.fechaISO.localeCompare(b.fechaISO)
    } else if (sortBy === "presupuesto") {
      comparison = a.presupuestoDiario - b.presupuestoDiario
    } else if (sortBy === "gastado") {
      comparison = a.totalGastado - b.totalGastado
    } else if (sortBy === "saldo") {
      comparison = a.saldoAFavor - b.saldoAFavor
    }
    return sortOrder === "asc" ? comparison : -comparison
  })

  const sortedRecentDays = sortedDays.filter((d) => !archivedDays.has(d.id))
  const sortedOlderDays = sortedDays.filter((d) => archivedDays.has(d.id))

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          Días de Trabajo y Gastos
        </h2>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <Button
              variant="outline"
              className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              disabled={isAIVerifying}
              onClick={handleAIVerify}
            >
              {isAIVerifying ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Analizando...
                </span>
              ) : (
                <>
                  <span className="text-lg">✨</span>
                  <span>Asistente IA</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant={
              filterDates.length > 0 || sortBy !== "fecha"
                ? "default"
                : "secondary"
            }
            className="gap-2"
            onClick={() => setIsFilterOpen(true)}
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
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
            Filtros / Orden
            {(filterDates.length > 0 ||
              sortBy !== "fecha" ||
              filterProvider) && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-foreground">
                {filterDates.length +
                  (sortBy !== "fecha" ? 1 : 0) +
                  (filterProvider ? 1 : 0)}
              </span>
            )}
          </Button>

          <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DialogContent
              showCloseButton={false}
              className="overflow-hidden border-border/50 bg-card/95 p-0 backdrop-blur-xl sm:max-w-[360px]"
            >
              <div className="relative flex items-center justify-center px-5 pt-5 pb-0">
                <DialogTitle className="text-center text-base font-bold">
                  Filtros y Ordenamiento
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Selecciona fechas y cambia el orden en que se muestran los
                  días.
                </DialogDescription>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="sr-only">Cerrar</span>
                </button>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 pt-2">
                {/* Fechas Carousel */}
                <div className="space-y-2">
                  <h3 className="flex items-center justify-between text-sm font-semibold text-foreground">
                    Filtrar por Fechas
                    <span className="text-xs font-normal text-muted-foreground">
                      {filterDates.length} seleccionadas
                    </span>
                  </h3>
                  <div className="group relative">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        scrollLeft()
                      }}
                      className="absolute top-1/2 left-0 z-10 -ml-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-muted"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 19.5L8.25 12l7.5-7.5"
                        />
                      </svg>
                    </button>

                    <div
                      ref={carouselRef}
                      className="scrollbar-hide flex w-full snap-x gap-2 overflow-x-auto scroll-smooth px-1 pb-2"
                    >
                      {allDates.map((dateObj) => {
                        const dateISO = format(dateObj, "yyyy-MM-dd")
                        const isSelected = filterDates.includes(dateISO)
                        const hasData = days.some((d) => d.fechaISO === dateISO)

                        return (
                          <button
                            key={dateISO}
                            onClick={() => {
                              setFilterDates((prev) =>
                                prev.includes(dateISO)
                                  ? prev.filter((f) => f !== dateISO)
                                  : [...prev, dateISO]
                              )
                            }}
                            className={`flex min-w-[52px] flex-shrink-0 snap-center flex-col items-center justify-center rounded-md border p-1.5 transition-all duration-200 ${isSelected ? "scale-105 border-primary bg-primary shadow-md shadow-primary/20" : hasData ? "border-border/60 bg-background hover:border-border hover:bg-muted/50" : "border-dashed border-border/40 bg-muted/20 opacity-60 hover:bg-muted/50 hover:opacity-100"}`}
                          >
                            <span
                              className={`mb-0.5 text-[9px] font-semibold tracking-wider uppercase ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                            >
                              {format(dateObj, "MMM", { locale: es })}
                            </span>
                            <span
                              className={`text-xl leading-none font-bold ${isSelected ? "text-primary-foreground" : "text-foreground/90"}`}
                            >
                              {format(dateObj, "dd")}
                            </span>
                            <span
                              className={`mt-0.5 text-[8px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground/50"}`}
                            >
                              {format(dateObj, "yyyy")}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        scrollRight()
                      }}
                      className="absolute top-1/2 right-0 z-10 -mr-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-muted"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filtrar por Proveedor
                    </h3>
                    <Select
                      value={filterProvider || "Todos"}
                      onValueChange={(val) =>
                        setFilterProvider(val === "Todos" ? "" : val || "")
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todos">Todos</SelectItem>
                        {allProviders.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Rango Rápido
                    </h3>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 px-1 text-xs"
                        onClick={() => {
                          const dates = Array.from({ length: 7 }, (_, i) => {
                            const d = new Date()
                            d.setDate(d.getDate() - i)
                            return format(d, "yyyy-MM-dd")
                          })
                          setFilterDates(dates)
                        }}
                      >
                        1 Sem
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 px-1 text-xs"
                        onClick={() => {
                          const dates = Array.from({ length: 30 }, (_, i) => {
                            const d = new Date()
                            d.setDate(d.getDate() - i)
                            return format(d, "yyyy-MM-dd")
                          })
                          setFilterDates(dates)
                        }}
                      >
                        1 Mes
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Ordenamiento */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Ordenar Por
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "fecha", label: "Fecha" },
                      { id: "presupuesto", label: "Ppto. Diario" },
                      { id: "gastado", label: "Total Gastado" },
                      { id: "saldo", label: "Saldo Restante" },
                    ].map((opt) => {
                      const isSelected = sortBy === opt.id
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSortBy(opt.id as any)}
                          className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${isSelected ? "border-primary bg-primary/5 text-primary" : "border-border/50 bg-background text-foreground/80 hover:bg-muted/50"}`}
                        >
                          <div
                            className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-primary" : "border-muted-foreground/30"}`}
                          >
                            {isSelected && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Dirección
                  </h3>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSortOrder("desc")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${sortOrder === "desc" ? "border-primary bg-primary/5 text-primary" : "border-border/50 bg-background text-foreground/80 hover:bg-muted/50"}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"
                        />
                      </svg>
                      Mayor a Menor
                    </button>
                    <button
                      onClick={() => setSortOrder("asc")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${sortOrder === "asc" ? "border-primary bg-primary/5 text-primary" : "border-border/50 bg-background text-foreground/80 hover:bg-muted/50"}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25"
                        />
                      </svg>
                      Menor a Mayor
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex w-full gap-3 p-4">
                <Button
                  onClick={() => {
                    setFilterDates([])
                    setFilterProvider("")
                    setSortBy("fecha")
                    setSortOrder("desc")
                    router.replace(pathname)
                  }}
                  variant="secondary"
                  size="sm"
                  className="h-8 flex-1 rounded-lg text-xs font-semibold"
                >
                  Limpiar Filtros
                </Button>
                <Button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    if (filterProvider && filterProvider.trim() !== "") {
                      params.set("proveedor", filterProvider)
                    } else {
                      params.delete("proveedor")
                    }
                    router.replace(`${pathname}?${params.toString()}`)
                    setIsFilterOpen(false)
                  }}
                  size="sm"
                  className="h-8 flex-1 rounded-lg text-xs font-semibold"
                >
                  Aceptar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {!isReadOnly && (
            <>
              <ReposicionesModal
                reposiciones={reposiciones}
                total={totalReposiciones}
              />
              <Button onClick={() => setIsAddExpenseOpen(true)}>
                Agregar Gasto
              </Button>
              <Button onClick={() => setIsAddDayOpen(true)}>Agregar Día</Button>
            </>
          )}
        </div>
      </div>

      {days.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No se han registrado días de trabajo para esta obra.
        </p>
      ) : sortedDays.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No hay registros para la fecha seleccionada.
        </p>
      ) : (
        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="mb-4 h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="recent"
              className="rounded-none border-b-2 border-transparent px-4 py-2 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Días Activos ({sortedRecentDays.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none border-b-2 border-transparent px-4 py-2 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Días Verificados ({sortedOlderDays.length})
            </TabsTrigger>
          </TabsList>

          {[
            { value: "recent", list: sortedRecentDays },
            { value: "history", list: sortedOlderDays },
          ].map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="mt-0 space-y-3"
            >
              {tab.list.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 bg-card/20 py-4 text-center text-sm text-muted-foreground">
                  No hay registros para mostrar en esta pestaña.
                </p>
              ) : (
                tab.list.map((day) => {
                  const isExpanded = expandedDay === day.id
                  const isEditingBudget = editingBudgetDay === day.id

                  const displayTotalGastado =
                    filterProvider && filterProvider.trim() !== ""
                      ? day.proveedoresTotales[filterProvider]?.total || 0
                      : day.totalGastado

                  const displayCount =
                    filterProvider && filterProvider.trim() !== ""
                      ? day.proveedoresTotales[filterProvider]?.count || 0
                      : day.gastosCount

                  const displaySaldo =
                    filterProvider && filterProvider.trim() !== ""
                      ? day.presupuestoDiario +
                        day.reposicion -
                        displayTotalGastado
                      : day.saldoAFavor

                  return (
                    <div
                      key={day.id}
                      className={`overflow-hidden rounded-lg bg-background/60 transition-all ${animatingDayId === day.id ? "animate-fade-out-blur pointer-events-none" : ""}`}
                    >
                      {/* Day Row Header */}
                      <div
                        className="flex cursor-pointer flex-col items-start justify-between gap-4 bg-card/10 p-4 transition-colors hover:bg-card/30 sm:flex-row sm:items-center"
                        onClick={() => toggleExpandDay(day.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-base font-bold text-foreground/90 capitalize">
                              {day.fecha}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {displayCount} gastos registrados
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 text-sm sm:mt-0">
                          {/* Budget Section */}
                          <div className="z-10 min-w-[160px]">
                            <span className="block text-xs text-muted-foreground">
                              Ppto. Diario
                            </span>
                            {isEditingBudget ? (
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="relative">
                                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                    $
                                  </span>
                                  <Input
                                    type="text"
                                    value={budgetValue}
                                    onChange={(e) =>
                                      setBudgetValue(
                                        formatCurrencyInput(e.target.value)
                                      )
                                    }
                                    className="h-8 w-24 pl-6 text-xs sm:w-28"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveBudget()}
                                  disabled={loading}
                                  className="h-8 px-3 text-xs whitespace-nowrap"
                                >
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setEditingBudgetDay(null)}
                                  className="h-8 px-3 text-xs whitespace-nowrap"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  $
                                  {day.presupuestoDiario.toLocaleString(
                                    "es-MX",
                                    { minimumFractionDigits: 2 }
                                  )}{" "}
                                  mxn
                                </span>
                                {!isReadOnly && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingBudgetDay(day.id)
                                      setBudgetValue(
                                        day.presupuestoDiario.toString()
                                      )
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Editar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reposiciones Section */}
                          <div className="z-10 min-w-[160px]">
                            <span className="block text-xs text-muted-foreground">
                              Reposiciones
                            </span>
                            {editingReposicionDay === day.id ? (
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="relative">
                                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                    $
                                  </span>
                                  <Input
                                    type="text"
                                    value={reposicionValue}
                                    onChange={(e) =>
                                      setReposicionValue(
                                        formatCurrencyInput(e.target.value)
                                      )
                                    }
                                    className="h-8 w-24 pl-6 text-xs sm:w-28"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveReposicion()}
                                  disabled={loading}
                                  className="h-8 px-3 text-xs whitespace-nowrap"
                                >
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setEditingReposicionDay(null)}
                                  className="h-8 px-3 text-xs whitespace-nowrap"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  $
                                  {(day.reposicion || 0).toLocaleString(
                                    "es-MX",
                                    { minimumFractionDigits: 2 }
                                  )}{" "}
                                  mxn
                                </span>
                                {!isReadOnly && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingReposicionDay(day.id)
                                      setReposicionValue(
                                        day.reposicion > 0
                                          ? day.reposicion.toString()
                                          : ""
                                      )
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Editar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Total Spent */}
                          <div className="w-[120px]">
                            <span className="block text-xs text-muted-foreground">
                              Total Gastado
                            </span>
                            <span className="mt-1 block font-semibold text-foreground/80">
                              {formatCurrency(displayTotalGastado)}
                            </span>
                          </div>

                          {/* Balance */}
                          <div className="w-[120px]">
                            <span className="block text-xs text-muted-foreground">
                              Saldo
                            </span>
                            <span className="mt-1 block font-bold text-foreground/80">
                              {formatCurrency(displaySaldo)}
                            </span>
                          </div>

                          {/* Export to PDF and Excel */}
                          <div className="flex items-center gap-2 pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPreviewUrl(
                                  `/api/reportes/dia?diaObraId=${day.id}&format=pdf${filterProvider && filterProvider.trim() !== "" ? `&proveedor=${encodeURIComponent(filterProvider)}` : ""}`
                                )
                                setPreviewTitle(`Reporte Diario - ${day.fecha}`)
                              }}
                              className={buttonVariants({
                                variant: "secondary",
                                size: "sm",
                                className:
                                  "h-8 cursor-pointer gap-1.5 text-foreground/80 hover:bg-foreground/5",
                              })}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="h-3.5 w-3.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                />
                              </svg>
                              PDF
                            </button>
                            <a
                              href={`/api/reportes/dia?diaObraId=${day.id}&format=excel${filterProvider && filterProvider.trim() !== "" ? `&proveedor=${encodeURIComponent(filterProvider)}` : ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={buttonVariants({
                                variant: "secondary",
                                size: "sm",
                                className: "h-8 gap-1.5",
                              })}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="h-3.5 w-3.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                                />
                              </svg>
                              Excel
                            </a>
                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleArchiveDay(day.id)
                                  }}
                                  className={
                                    archivedDays.has(day.id)
                                      ? "ml-1 flex items-center justify-center rounded border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-muted"
                                      : "ml-1 flex items-center justify-center rounded border border-transparent p-1.5 text-green-500 transition-colors hover:border-green-500/20 hover:bg-green-500/10"
                                  }
                                  title={
                                    archivedDays.has(day.id)
                                      ? "Mover a Días Activos"
                                      : "Mover a Verificados"
                                  }
                                >
                                  {archivedDays.has(day.id) ? (
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
                                        d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={2}
                                      stroke="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4.5 12.75l6 6 9-13.5"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDayToDelete(day.id)
                                  }}
                                  disabled={deletingDayId === day.id}
                                  className="ml-2 flex items-center justify-center rounded border border-transparent p-1.5 text-destructive transition-colors hover:border-destructive/20 hover:bg-destructive/10 disabled:opacity-50"
                                  title="Eliminar Día"
                                >
                                  {deletingDayId === day.id ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-r-transparent"></span>
                                  ) : (
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
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Day Expenses Detail Section */}
                      {isExpanded && (
                        <div className="space-y-4 border-t border-border/50 bg-background/20 p-4">
                          {loadingExpenses ? (
                            <p className="animate-pulse py-2 text-center text-xs text-muted-foreground">
                              Cargando detalles de gastos...
                            </p>
                          ) : expenses.length === 0 ? (
                            <p className="py-2 text-center text-xs text-muted-foreground">
                              No hay gastos detallados en este día.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                          />
                                        </svg>
                                        Concepto
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 6h.008v.008H6V6Z"
                                          />
                                        </svg>
                                        Categoría
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615 3.001 3.001 0 0 0 3.75.615 3.001 3.001 0 0 0 3.75-.615 3.001 3.001 0 0 0 3.75.615m-15 0H1.5m18 0h1.5M16.241 4.89 12.396.318a1.24 1.24 0 0 0-1.8 0L6.64 4.89a1.24 1.24 0 0 0 1.8 1.8h7.99a1.24 1.24 0 0 0 0-1.8Z"
                                          />
                                        </svg>
                                        Proveedor
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                          />
                                        </svg>
                                        Subtotal
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 14.25l6-6m-5.5.5h.01m5 5h.01M19.5 12c0 4.142-3.358 7.5-7.5 7.5S4.5 16.142 4.5 12 7.858 4.5 12 4.5s7.5 3.358 7.5 7.5Z"
                                          />
                                        </svg>
                                        IVA %
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                          />
                                        </svg>
                                        IVA $
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-5.625 3h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 19.5 3H4.5a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 4.5 19.5Z"
                                          />
                                        </svg>
                                        Total
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.746 3.746 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
                                          />
                                        </svg>
                                        Estado
                                      </span>
                                    </TableHead>
                                    <TableHead>
                                      <span className="flex items-center gap-1">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="h-3 w-3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                                          />
                                        </svg>
                                        Creado por
                                      </span>
                                    </TableHead>
                                    <TableHead className="w-[88px] text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {expenses
                                    .filter(
                                      (gasto: any) =>
                                        !filterProvider ||
                                        filterProvider.trim() === "" ||
                                        gasto.proveedor === filterProvider
                                    )
                                    .map((gasto: any) => (
                                      <TableRow
                                        key={gasto.id}
                                        onClick={() =>
                                          setSelectedGastoForModal(gasto)
                                        }
                                        className={`cursor-pointer transition-colors ${animatingExpenseId === gasto.id ? "animate-fade-out-blur pointer-events-none" : ""} ${gasto.isImprevisto ? "bg-rose-500/10 hover:bg-rose-500/20" : "hover:bg-muted/50"}`}
                                      >
                                        <TableCell className="font-semibold text-foreground">
                                          {gasto.concepto}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex flex-col items-start gap-1.5">
                                            {gasto.categoria ? (
                                              <span className="text-xs text-muted-foreground">
                                                {gasto.categoria}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-muted-foreground/50 italic">
                                                -
                                              </span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-foreground/80">
                                          {gasto.proveedor}
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrency(
                                            Number(gasto.subtotal)
                                          )}
                                        </TableCell>
                                        <TableCell
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {!isReadOnly ? (
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <button
                                                  disabled={
                                                    updatingIva === gasto.id
                                                  }
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                  className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-muted-foreground transition-colors hover:bg-muted"
                                                >
                                                  {updatingIva === gasto.id
                                                    ? "..."
                                                    : `${gasto.porcentajeIVA}%`}
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth={2}
                                                    stroke="currentColor"
                                                    className="h-3 w-3"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                                    />
                                                  </svg>
                                                </button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent
                                                align="start"
                                                className="w-20 min-w-0 rounded-xl"
                                              >
                                                {[0, 8, 16].map((pct) => (
                                                  <DropdownMenuItem
                                                    key={pct}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleUpdateIva(
                                                        gasto.id,
                                                        pct
                                                      )
                                                    }}
                                                    className={`cursor-pointer justify-center rounded-md ${gasto.porcentajeIVA === pct ? "bg-muted/50 font-bold" : ""}`}
                                                  >
                                                    {pct}%
                                                  </DropdownMenuItem>
                                                ))}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          ) : (
                                            <span className="font-semibold text-muted-foreground">
                                              {gasto.porcentajeIVA}%
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrency(Number(gasto.iva))}
                                        </TableCell>
                                        <TableCell className="font-bold">
                                          {formatCurrency(Number(gasto.total))}
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-xs font-medium text-muted-foreground">
                                            {gasto.estado}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span>
                                              {gasto.creadoPor?.name ||
                                                "Desconocido"}
                                            </span>
                                            {(gasto.creadoPor?.role?.name ===
                                              "ADMIN" ||
                                              gasto.creadoPor?.role?.name ===
                                                "SUPER_ADMIN") && (
                                              <span
                                                className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-400"
                                                title="Gasto de administrador — no afecta al presupuesto del día"
                                              >
                                                ADMIN
                                              </span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex min-h-[32px] items-center justify-end gap-1">
                                            {!isReadOnly && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedGastoForModal(
                                                      gasto
                                                    )
                                                    setEditConcepto(
                                                      gasto.concepto
                                                    )
                                                    setEditProveedor(
                                                      gasto.proveedor
                                                    )
                                                    setEditCategoria(
                                                      gasto.categoria || ""
                                                    )
                                                    setEditIsImprevisto(
                                                      gasto.isImprevisto
                                                    )
                                                    setEditRestarPresupuesto(
                                                      !gasto.noAfectaPresupuesto
                                                    )
                                                    setEditPorcentajeIVA(
                                                      String(
                                                        gasto.porcentajeIVA ??
                                                          16
                                                      )
                                                    )
                                                    setEditTotal(
                                                      formatCurrencyInput(
                                                        String(gasto.total)
                                                      )
                                                    )
                                                    setEditNotaCapturista(
                                                      gasto.notaCapturista || ""
                                                    )
                                                    setIsEditingGasto(true)
                                                  }}
                                                  className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                                  title="Editar gasto"
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
                                                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                                    />
                                                  </svg>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpenseToDelete(gasto.id)
                                                  }}
                                                  disabled={
                                                    deletingExpense[gasto.id]
                                                  }
                                                  title="Eliminar Gasto Completo"
                                                  className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                >
                                                  {deletingExpense[gasto.id] ? (
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-r-transparent"></span>
                                                  ) : (
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
                                                  )}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>

                              {/* Selected Expense Detail Modal */}
                              <Dialog
                                open={!!selectedGastoForModal}
                                onOpenChange={(open) => {
                                  if (!open) {
                                    setSelectedGastoForModal(null)
                                    setIsEditingGasto(false)
                                  }
                                }}
                              >
                                <DialogContent
                                  showCloseButton={false}
                                  className="gap-0 overflow-hidden bg-background p-0 sm:max-w-xl"
                                >
                                  {selectedGastoForModal && (
                                    <div className="flex max-h-[85vh] flex-col">
                                      {/* Header */}
                                      <div className="border-b border-border bg-card p-5">
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="min-w-0">
                                            <DialogTitle className="mb-0.5 truncate text-lg text-foreground">
                                              {isEditingGasto
                                                ? "Editar Gasto"
                                                : selectedGastoForModal.concepto}
                                            </DialogTitle>
                                            {!isEditingGasto && (
                                              <p className="truncate text-sm text-muted-foreground">
                                                {
                                                  selectedGastoForModal.proveedor
                                                }
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex shrink-0 items-center gap-4">
                                            <span className="text-lg font-bold text-foreground">
                                              {formatCurrency(
                                                Number(
                                                  selectedGastoForModal.total
                                                )
                                              )}
                                            </span>
                                            <DialogClose className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
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
                                                  d="M6 18 18 6M6 6l12 12"
                                                />
                                              </svg>
                                            </DialogClose>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex-1 overflow-y-auto">
                                        {isEditingGasto ? (
                                          /* ── EDIT MODE ── */
                                          <form
                                            onSubmit={async (e) => {
                                              e.preventDefault()
                                              if (
                                                !editConcepto.trim() ||
                                                !editProveedor.trim()
                                              ) {
                                                setAlertMsg(
                                                  "Concepto y Proveedor son obligatorios."
                                                )
                                                return
                                              }
                                              setEditGastoLoading(true)
                                              try {
                                                await updateGastoAdmin(
                                                  selectedGastoForModal.id,
                                                  {
                                                    concepto:
                                                      editConcepto.trim(),
                                                    proveedor:
                                                      editProveedor.trim(),
                                                    categoria:
                                                      editCategoria.trim() ||
                                                      undefined,
                                                    isImprevisto:
                                                      editIsImprevisto,
                                                    restarPresupuesto:
                                                      editRestarPresupuesto,
                                                    porcentajeIVA:
                                                      parseInt(
                                                        editPorcentajeIVA
                                                      ),
                                                    total:
                                                      parseFloat(
                                                        editTotal.replace(
                                                          /,/g,
                                                          ""
                                                        )
                                                      ) || 0,
                                                    notaCapturista:
                                                      editNotaCapturista,
                                                  }
                                                )
                                                // Update local modal data so it reflects changes immediately
                                                setSelectedGastoForModal(
                                                  (prev: any) =>
                                                    prev
                                                      ? {
                                                          ...prev,
                                                          concepto:
                                                            editConcepto.trim(),
                                                          proveedor:
                                                            editProveedor.trim(),
                                                          categoria:
                                                            editCategoria.trim() ||
                                                            null,
                                                          isImprevisto:
                                                            editIsImprevisto,
                                                          noAfectaPresupuesto:
                                                            !editRestarPresupuesto,
                                                          porcentajeIVA:
                                                            parseInt(
                                                              editPorcentajeIVA
                                                            ),
                                                          total:
                                                            parseFloat(
                                                              editTotal.replace(
                                                                /,/g,
                                                                ""
                                                              )
                                                            ) || 0,
                                                          notaCapturista:
                                                            editNotaCapturista,
                                                        }
                                                      : null
                                                )
                                                setSelectedGastoForModal(null)
                                                setIsEditingGasto(false)
                                                if (expandedDay)
                                                  await handleFetchExpenses(
                                                    expandedDay
                                                  )
                                                sileo.success({
                                                  title: "Éxito",
                                                  description:
                                                    "Cambios guardados.",
                                                })
                                                router.refresh()
                                              } catch (err: any) {
                                                sileo.error({
                                                  title: "Error",
                                                  description:
                                                    err.message ||
                                                    "Error al guardar cambios.",
                                                })
                                                setAlertMsg(
                                                  err.message ||
                                                    "Error al guardar cambios."
                                                )
                                              } finally {
                                                setEditGastoLoading(false)
                                              }
                                            }}
                                            className="space-y-4 p-5"
                                          >
                                            {/* Concepto & Total Row */}
                                            <div className="flex gap-4">
                                              <div className="flex-1 space-y-1.5">
                                                <Label className="text-xs text-foreground/80">
                                                  Concepto
                                                </Label>
                                                <Input
                                                  value={editConcepto}
                                                  onChange={(e) =>
                                                    setEditConcepto(
                                                      e.target.value
                                                    )
                                                  }
                                                  className="h-9 border-border bg-card text-sm"
                                                  required
                                                  autoFocus
                                                />
                                              </div>

                                              <div className="w-[140px] shrink-0 space-y-1.5">
                                                <Label className="text-xs text-foreground/80">
                                                  Importe Total
                                                </Label>
                                                <div className="relative">
                                                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                                                    $
                                                  </span>
                                                  <Input
                                                    value={editTotal}
                                                    onChange={(e) =>
                                                      setEditTotal(
                                                        formatCurrencyInput(
                                                          e.target.value
                                                        )
                                                      )
                                                    }
                                                    className="h-9 border-border bg-card pl-7 text-sm font-medium"
                                                    required
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {/* Proveedor */}
                                            <div className="relative space-y-1.5">
                                              <Label className="text-xs text-foreground/80">
                                                Proveedor
                                              </Label>
                                              {!editIsAddingProveedor ? (
                                                <div className="relative">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEditShowProveedores(
                                                        !editShowProveedores
                                                      )
                                                    }
                                                    onBlur={() =>
                                                      setTimeout(
                                                        () =>
                                                          setEditShowProveedores(
                                                            false
                                                          ),
                                                        200
                                                      )
                                                    }
                                                    className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none"
                                                  >
                                                    <span
                                                      className={
                                                        editProveedor
                                                          ? "truncate text-foreground"
                                                          : "truncate text-muted-foreground"
                                                      }
                                                    >
                                                      {editProveedor ||
                                                        "Selecciona un proveedor..."}
                                                    </span>
                                                    <svg
                                                      className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                                                      />
                                                    </svg>
                                                  </button>
                                                  {editShowProveedores && (
                                                    <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                                                      <button
                                                        type="button"
                                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
                                                        onClick={() => {
                                                          setEditIsAddingProveedor(
                                                            true
                                                          )
                                                          setEditProveedor("")
                                                          setEditShowProveedores(
                                                            false
                                                          )
                                                        }}
                                                      >
                                                        <svg
                                                          xmlns="http://www.w3.org/2000/svg"
                                                          fill="none"
                                                          viewBox="0 0 24 24"
                                                          strokeWidth={2.5}
                                                          stroke="currentColor"
                                                          className="h-4 w-4"
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M12 4.5v15m7.5-7.5h-15"
                                                          />
                                                        </svg>
                                                        Agregar proveedor nuevo
                                                      </button>
                                                      {editProveedoresOptions.length >
                                                        0 && (
                                                        <div className="my-1 h-px bg-border" />
                                                      )}
                                                      {editProveedoresOptions.map(
                                                        (p, i) => (
                                                          <button
                                                            key={`eprov-${i}`}
                                                            type="button"
                                                            className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                                                            onClick={() => {
                                                              setEditProveedor(
                                                                p
                                                              )
                                                              setEditShowProveedores(
                                                                false
                                                              )
                                                            }}
                                                          >
                                                            {p}
                                                          </button>
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex gap-2">
                                                  <Input
                                                    type="text"
                                                    placeholder="Nombre del proveedor... (Presiona Enter)"
                                                    value={editProveedor}
                                                    onChange={(e) =>
                                                      setEditProveedor(
                                                        e.target.value
                                                      )
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        e.preventDefault()
                                                        if (
                                                          editProveedor.trim()
                                                        ) {
                                                          if (
                                                            !editProveedoresOptions.includes(
                                                              editProveedor.trim()
                                                            )
                                                          ) {
                                                            setEditProveedoresOptions(
                                                              (prev) => [
                                                                ...prev,
                                                                editProveedor.trim(),
                                                              ]
                                                            )
                                                          }
                                                          setEditIsAddingProveedor(
                                                            false
                                                          )
                                                        }
                                                      }
                                                    }}
                                                    className="h-9 flex-1 border-border bg-card text-sm text-foreground"
                                                    required
                                                    autoFocus
                                                  />
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                      if (
                                                        editProveedor.trim()
                                                      ) {
                                                        if (
                                                          !editProveedoresOptions.includes(
                                                            editProveedor.trim()
                                                          )
                                                        ) {
                                                          setEditProveedoresOptions(
                                                            (prev) => [
                                                              ...prev,
                                                              editProveedor.trim(),
                                                            ]
                                                          )
                                                        }
                                                        setEditIsAddingProveedor(
                                                          false
                                                        )
                                                      }
                                                    }}
                                                    className="h-9 w-9 shrink-0 border-border p-0 hover:bg-card hover:text-emerald-400"
                                                    title="Aceptar"
                                                  >
                                                    <svg
                                                      className="h-4 w-4"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2.5}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.5 12.75l6 6 9-13.5"
                                                      />
                                                    </svg>
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                      setEditIsAddingProveedor(
                                                        false
                                                      )
                                                      setEditProveedor("")
                                                    }}
                                                    className="h-9 w-9 shrink-0 border-border p-0 hover:bg-card hover:text-rose-400"
                                                    title="Cancelar"
                                                  >
                                                    <svg
                                                      className="h-4 w-4"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M6 18L18 6M6 6l12 12"
                                                      />
                                                    </svg>
                                                  </Button>
                                                </div>
                                              )}
                                            </div>

                                            {/* Categoría */}
                                            <div className="relative space-y-1.5">
                                              <Label className="text-xs text-foreground/80">
                                                Categoría{" "}
                                                <span className="text-muted-foreground/60">
                                                  (opcional)
                                                </span>
                                              </Label>
                                              {!editIsAddingCategoria ? (
                                                <div className="relative">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEditShowCategorias(
                                                        !editShowCategorias
                                                      )
                                                    }
                                                    onBlur={() =>
                                                      setTimeout(
                                                        () =>
                                                          setEditShowCategorias(
                                                            false
                                                          ),
                                                        200
                                                      )
                                                    }
                                                    className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none"
                                                  >
                                                    <span
                                                      className={
                                                        editCategoria
                                                          ? "truncate text-foreground"
                                                          : "truncate text-muted-foreground"
                                                      }
                                                    >
                                                      {editCategoria ||
                                                        "Selecciona..."}
                                                    </span>
                                                    <svg
                                                      className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                                                      />
                                                    </svg>
                                                  </button>
                                                  {editShowCategorias && (
                                                    <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                                                      <button
                                                        type="button"
                                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
                                                        onClick={() => {
                                                          setEditIsAddingCategoria(
                                                            true
                                                          )
                                                          setEditCategoria("")
                                                          setEditShowCategorias(
                                                            false
                                                          )
                                                        }}
                                                      >
                                                        <svg
                                                          xmlns="http://www.w3.org/2000/svg"
                                                          fill="none"
                                                          viewBox="0 0 24 24"
                                                          strokeWidth={2.5}
                                                          stroke="currentColor"
                                                          className="h-4 w-4"
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M12 4.5v15m7.5-7.5h-15"
                                                          />
                                                        </svg>
                                                        Nueva categoría
                                                      </button>
                                                      {editCategoriasOptions.length >
                                                        0 && (
                                                        <div className="my-1 h-px bg-border" />
                                                      )}
                                                      {editCategoriasOptions.map(
                                                        (c, i) => (
                                                          <button
                                                            key={`ecat-${i}`}
                                                            type="button"
                                                            className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                                                            onClick={() => {
                                                              setEditCategoria(
                                                                c
                                                              )
                                                              setEditShowCategorias(
                                                                false
                                                              )
                                                            }}
                                                          >
                                                            {c}
                                                          </button>
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex gap-2">
                                                  <Input
                                                    type="text"
                                                    placeholder="Nueva categoría..."
                                                    value={editCategoria}
                                                    onChange={(e) =>
                                                      setEditCategoria(
                                                        e.target.value
                                                      )
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        e.preventDefault()
                                                        if (
                                                          editCategoria.trim()
                                                        ) {
                                                          if (
                                                            !editCategoriasOptions.includes(
                                                              editCategoria.trim()
                                                            )
                                                          ) {
                                                            setEditCategoriasOptions(
                                                              (prev) => [
                                                                ...prev,
                                                                editCategoria.trim(),
                                                              ]
                                                            )
                                                          }
                                                          setEditIsAddingCategoria(
                                                            false
                                                          )
                                                        }
                                                      }
                                                    }}
                                                    className="h-9 flex-1 border-border bg-card text-sm text-foreground"
                                                    autoFocus
                                                  />
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                      if (
                                                        editCategoria.trim()
                                                      ) {
                                                        if (
                                                          !editCategoriasOptions.includes(
                                                            editCategoria.trim()
                                                          )
                                                        ) {
                                                          setEditCategoriasOptions(
                                                            (prev) => [
                                                              ...prev,
                                                              editCategoria.trim(),
                                                            ]
                                                          )
                                                        }
                                                        setEditIsAddingCategoria(
                                                          false
                                                        )
                                                      }
                                                    }}
                                                    className="h-9 w-9 shrink-0 border-border p-0 hover:bg-card hover:text-emerald-400"
                                                    title="Aceptar"
                                                  >
                                                    <svg
                                                      className="h-4 w-4"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2.5}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.5 12.75l6 6 9-13.5"
                                                      />
                                                    </svg>
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                      setEditIsAddingCategoria(
                                                        false
                                                      )
                                                      setEditCategoria("")
                                                    }}
                                                    className="h-9 w-9 shrink-0 border-border p-0 hover:bg-card hover:text-rose-400"
                                                    title="Cancelar"
                                                  >
                                                    <svg
                                                      className="h-4 w-4"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      fill="none"
                                                      viewBox="0 0 24 24"
                                                      strokeWidth={2}
                                                      stroke="currentColor"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M6 18L18 6M6 6l12 12"
                                                      />
                                                    </svg>
                                                  </Button>
                                                </div>
                                              )}
                                            </div>

                                            {/* IVA + Imprevisto + Presupuesto */}
                                            <div className="grid grid-cols-[1.8fr_1fr_1.2fr] gap-4">
                                              <div className="space-y-1.5">
                                                <Label className="text-xs text-foreground/80">
                                                  Tasa de IVA
                                                </Label>
                                                <div className="flex h-9 items-center rounded-md border border-border bg-card px-1">
                                                  {["0", "8", "16"].map(
                                                    (pct) => (
                                                      <label
                                                        key={pct}
                                                        className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs text-foreground/80 transition-colors hover:bg-muted/50"
                                                      >
                                                        <input
                                                          type="radio"
                                                          name="editPorcentajeIVA"
                                                          value={pct}
                                                          checked={
                                                            editPorcentajeIVA ===
                                                            pct
                                                          }
                                                          onChange={(e) =>
                                                            setEditPorcentajeIVA(
                                                              e.target.value
                                                            )
                                                          }
                                                          className="accent-primary"
                                                        />
                                                        {pct}%
                                                      </label>
                                                    )
                                                  )}
                                                </div>
                                              </div>

                                              <div className="space-y-1.5">
                                                <Label className="text-xs text-foreground/80">
                                                  ¿Fue Imprevisto?
                                                </Label>
                                                <div className="flex h-9 items-center rounded-md border border-border bg-card px-3">
                                                  <label className="group flex w-full cursor-pointer items-center gap-2">
                                                    <div className="relative flex items-center">
                                                      <input
                                                        type="checkbox"
                                                        checked={
                                                          editIsImprevisto
                                                        }
                                                        onChange={(e) =>
                                                          setEditIsImprevisto(
                                                            e.target.checked
                                                          )
                                                        }
                                                        className="peer sr-only"
                                                      />
                                                      <div className="peer h-5 w-9 rounded-full bg-muted shadow-inner peer-checked:bg-rose-500 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                                    </div>
                                                    <span
                                                      className={`text-sm select-none ${editIsImprevisto ? "font-medium text-rose-400" : "text-muted-foreground"}`}
                                                    >
                                                      {editIsImprevisto
                                                        ? "Sí"
                                                        : "No"}
                                                    </span>
                                                  </label>
                                                </div>
                                              </div>

                                              <div className="flex flex-col justify-end space-y-1.5">
                                                <Label className="mb-1 text-xs text-foreground/80">
                                                  Restar del presupuesto
                                                </Label>
                                                <div className="flex h-9 items-center rounded-md border border-border bg-card px-3">
                                                  <label className="group flex w-full cursor-pointer items-center gap-2">
                                                    <div className="relative flex items-center">
                                                      <input
                                                        type="checkbox"
                                                        checked={
                                                          editRestarPresupuesto
                                                        }
                                                        onChange={(e) =>
                                                          setEditRestarPresupuesto(
                                                            e.target.checked
                                                          )
                                                        }
                                                        className="peer sr-only"
                                                      />
                                                      <div className="peer h-5 w-9 rounded-full bg-muted shadow-inner peer-checked:bg-emerald-500 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                                    </div>
                                                    <span
                                                      className={`text-sm select-none ${editRestarPresupuesto ? "font-medium text-emerald-500" : "text-muted-foreground transition-colors group-hover:text-foreground/80"}`}
                                                    >
                                                      {editRestarPresupuesto
                                                        ? "Sí"
                                                        : "No"}
                                                    </span>
                                                  </label>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Nota Capturista */}
                                            <div className="space-y-1.5">
                                              <Label className="text-xs text-foreground/80">
                                                Nota del Capturista
                                              </Label>
                                              <textarea
                                                rows={3}
                                                value={editNotaCapturista}
                                                onChange={(e) =>
                                                  setEditNotaCapturista(
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Nota aclaratoria..."
                                                className="w-full resize-none rounded border border-border bg-card p-2 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50"
                                              />
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-3 pt-1">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                  setIsEditingGasto(false)
                                                  setSelectedGastoForModal(null)
                                                }}
                                                className="flex-1"
                                                disabled={editGastoLoading}
                                              >
                                                Cancelar
                                              </Button>
                                              <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={editGastoLoading}
                                              >
                                                {editGastoLoading
                                                  ? "Guardando..."
                                                  : "Guardar Cambios"}
                                              </Button>
                                            </div>
                                          </form>
                                        ) : (
                                          /* ── VIEW MODE ── */
                                          <div className="space-y-5 p-5">
                                            {/* Notes Section */}
                                            <div className="space-y-4">
                                              <div className="rounded-xl border border-border/50 bg-muted/40 p-3.5">
                                                <span className="mb-1 block text-sm font-semibold text-muted-foreground">
                                                  Nota Capturista:
                                                </span>
                                                <span className="text-sm text-foreground">
                                                  {selectedGastoForModal.notaCapturista || (
                                                    <em className="text-muted-foreground/60">
                                                      Ninguna
                                                    </em>
                                                  )}
                                                </span>
                                              </div>

                                              {/* Admin Note */}
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-sm font-semibold text-muted-foreground">
                                                    Nota Administrador:
                                                  </span>
                                                  {(adminNotes[
                                                    selectedGastoForModal.id
                                                  ] ||
                                                    selectedGastoForModal.notaAdmin) && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() =>
                                                        handleDeleteAdminNoteClick(
                                                          selectedGastoForModal.id
                                                        )
                                                      }
                                                      disabled={
                                                        deletingNote[
                                                          selectedGastoForModal
                                                            .id
                                                        ]
                                                      }
                                                      className="h-8 px-3 text-xs text-destructive transition-colors hover:bg-destructive/10"
                                                    >
                                                      {deletingNote[
                                                        selectedGastoForModal.id
                                                      ]
                                                        ? "Eliminando..."
                                                        : "Eliminar nota"}
                                                    </Button>
                                                  )}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                  <textarea
                                                    id={`admin-note-${selectedGastoForModal.id}`}
                                                    rows={3}
                                                    value={
                                                      adminNotes[
                                                        selectedGastoForModal.id
                                                      ] || ""
                                                    }
                                                    onChange={(e) =>
                                                      handleAdminNoteChange(
                                                        selectedGastoForModal.id,
                                                        e.target.value
                                                      )
                                                    }
                                                    onKeyDown={(e) =>
                                                      handleNoteKeyDown(
                                                        e,
                                                        selectedGastoForModal.id
                                                      )
                                                    }
                                                    placeholder="Escribe una nota interna para el administrador... (Enter para guardar)"
                                                    className="w-full resize-none rounded-xl border border-transparent bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/30"
                                                  />
                                                  <div className="flex justify-end">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      onClick={() =>
                                                        handleSaveAdminNote(
                                                          selectedGastoForModal.id
                                                        )
                                                      }
                                                      disabled={
                                                        savingNote[
                                                          selectedGastoForModal
                                                            .id
                                                        ]
                                                      }
                                                      className="px-6 shadow-sm"
                                                    >
                                                      {savingNote[
                                                        selectedGastoForModal.id
                                                      ]
                                                        ? "Guardando..."
                                                        : savedNote[
                                                              selectedGastoForModal
                                                                .id
                                                            ]
                                                          ? "✓ Guardado"
                                                          : "Guardar Nota"}
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Photos Section */}
                                            {selectedGastoForModal.fotos &&
                                              selectedGastoForModal.fotos
                                                .length > 0 && (
                                                <div className="border-t border-border pt-2">
                                                  <PhotoPreviewGallery
                                                    photos={selectedGastoForModal.fotos.map(
                                                      (f: any) => ({
                                                        type: "uploaded" as const,
                                                        id: f.id,
                                                        url: f.url,
                                                      })
                                                    )}
                                                    label="Comprobantes Adjuntos"
                                                  />
                                                </div>
                                              )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Footer — only in view mode */}
                                      {!isEditingGasto && (
                                        <div className="flex items-center justify-end gap-3 border-t border-border bg-card/50 p-4">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleVerifyStatus(
                                                selectedGastoForModal.id,
                                                "RECHAZADO"
                                              )
                                            }
                                            className="border-destructive/20 font-semibold text-destructive hover:bg-destructive/10"
                                          >
                                            Rechazar Gasto
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              handleVerifyStatus(
                                                selectedGastoForModal.id,
                                                "VERIFICADO"
                                              )
                                            }
                                            className="bg-primary font-semibold text-primary-foreground"
                                          >
                                            Aprobar Gasto
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Add Day Modal */}
      <Dialog open={isAddDayOpen} onOpenChange={setIsAddDayOpen}>
        <DialogContent
          title="Agregar Nuevo Día"
          showCloseButton={true}
          className="sm:max-w-[500px]"
          rightAction={
            <Button
              type="submit"
              form="create-day-form"
              disabled={creatingDay}
              size="sm"
            >
              {creatingDay ? "Guardando..." : "Crear Día"}
            </Button>
          }
        >
          <form
            id="create-day-form"
            onSubmit={handleCreateDay}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <div className="mb-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </Button>
                <span className="text-sm font-semibold text-muted-foreground capitalize">
                  {format(weekStart, "MMMM yyyy", { locale: es })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </Button>
              </div>
              <div className="flex items-center justify-between gap-1">
                {generateWeekDays().map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const isSelected = newDayDate === dateStr
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setNewDayDate(dateStr)}
                      className={`flex flex-1 flex-col items-center rounded-xl p-2 transition-all ${isSelected ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                    >
                      <span className="text-[10px] font-bold uppercase">
                        {format(day, "EE", { locale: es })}
                      </span>
                      <span className="mt-0.5 text-sm font-black">
                        {format(day, "d")}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="presupuesto">Presupuesto Asignado</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="presupuesto"
                  type="text"
                  required
                  placeholder="0.00"
                  value={newDayBudget}
                  onChange={(e) =>
                    setNewDayBudget(formatCurrencyInput(e.target.value))
                  }
                  className="pl-7"
                />
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Modal */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent
          title="Agregar Gasto"
          className="sm:max-w-[500px]"
          rightAction={
            <Button type="submit" form="captura-expense-form" size="sm">
              Registrar
            </Button>
          }
        >
          <div className="pb-2">
            <div className="pt-2">
              <div className="space-y-2">
                <Label className="text-xs text-foreground/80">
                  Día de trabajo
                </Label>
                <Select
                  value={selectedExpenseDay}
                  onValueChange={(val) => setSelectedExpenseDay(val || "")}
                >
                  <SelectTrigger className="w-full rounded-md border-border bg-card text-foreground">
                    <SelectValue placeholder="Seleccionar un día..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border bg-popover text-popover-foreground">
                    {days.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No hay días registrados
                      </SelectItem>
                    ) : (
                      days.map((d) => (
                        <SelectItem key={d.id} value={d.fechaISO}>
                          {d.fecha}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedExpenseDay && (
                <div className="mt-4">
                  <CapturaExpenseForm
                    obraId={obraId}
                    selectedFecha={selectedExpenseDay}
                    isModal={true}
                    isAdmin={true}
                    onSuccess={() => {
                      setIsAddExpenseOpen(false)
                      setSelectedExpenseDay("")
                      router.refresh()
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Day Confirmation Modal */}
      <Dialog
        open={!!dayToDelete}
        onOpenChange={(open) => !open && setDayToDelete(null)}
      >
        <DialogContent
          title={
            <span className="text-lg leading-tight text-destructive">
              ¿Mover este día de trabajo a la papelera?
            </span>
          }
          showCloseButton={false}
          className="gap-3 p-6 sm:max-w-md"
        >
          <DialogDescription className="mt-1 text-center">
            El día y <strong>todos los gastos asociados</strong> serán movidos a
            la papelera. Podrás restaurarlos más tarde.
          </DialogDescription>
          <DialogFooter className="mt-2 flex w-full flex-row gap-3 sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => setDayToDelete(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!!deletingDayId}
              onClick={() => {
                if (dayToDelete) {
                  handleDeleteDay(dayToDelete)
                }
              }}
            >
              Mover a Papelera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal (Gasto) */}
      <Dialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
      >
        <DialogContent
          title={
            <span className="text-lg leading-tight">
              ¿Mover este gasto a la papelera?
            </span>
          }
          showCloseButton={false}
          className="gap-3 p-6 sm:max-w-md"
        >
          <DialogDescription className="mt-1 text-center">
            El gasto será movido a la papelera. Podrás restaurarlo más tarde si
            es necesario.
          </DialogDescription>
          <DialogFooter className="mt-2 flex w-full flex-row gap-3 sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => setExpenseToDelete(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (expenseToDelete) {
                  handleDeleteExpense(expenseToDelete)
                  setExpenseToDelete(null)
                }
              }}
            >
              Mover a Papelera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!alertMsg}
        onOpenChange={() => setAlertMsg(null)}
        title="Aviso"
        description={alertMsg || ""}
      />
      <ConfirmDialog
        open={!!confirmDeleteNoteId}
        onOpenChange={(open) => !open && setConfirmDeleteNoteId(null)}
        title="Confirmar Eliminación"
        description="¿Eliminar la nota de administrador?"
        onConfirm={executeDeleteAdminNote}
      />
      <PdfPreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        url={previewUrl}
        title={previewTitle}
      />
    </div>
  )
}
