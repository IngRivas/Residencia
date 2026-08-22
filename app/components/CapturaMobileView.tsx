"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  addGasto,
  getUniqueProveedores,
  quickAddProveedor,
} from "@/lib/actions/gastos"
import { updateUserTextZoom } from "@/lib/actions/users"
import { format } from "date-fns"
import type { GastoEstado } from "@prisma/client"
import { sileo } from "sileo"
import PhotoPreviewGallery, {
  GalleryPhoto,
  UploadedPhoto,
} from "@/app/components/PhotoPreviewGallery"
import { WebCamDialog } from "@/app/components/WebCamDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface GastoInput {
  id: string
  concepto: string
  proveedor: string
  subtotal: number
  porcentajeIVA: number
  iva: number
  total: number
  estado: GastoEstado
  notaCapturista?: string
  fotos: string[]
}

interface CapturaMobileViewProps {
  obraId: string
  obraNombre: string
  selectedFecha: string
  userName: string
  userId: string
  initialTextZoom: number
  gastos: GastoInput[]
  presupuestoDiario: number
  totalGastado: number
  saldoAFavor: number
  isAdmin?: boolean
}

type ExpandedField =
  | "concepto"
  | "proveedor"
  | "importe"
  | "nota"
  | "fotos"
  | null

export default function CapturaMobileView({
  obraId,
  obraNombre,
  selectedFecha,
  userName,
  userId,
  initialTextZoom,
  gastos,
  presupuestoDiario,
  totalGastado: initialTotalGastado,
  saldoAFavor: initialSaldoAFavor,
  isAdmin = false,
}: CapturaMobileViewProps) {
  const router = useRouter()
  const [year, month, day] = selectedFecha.split("-")
  const formattedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("es-MX", { dateStyle: "long" })

  // Form states
  const [concepto, setConcepto] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [importeTotal, setImporteTotal] = useState("") // raw numeric string for calcs
  const [importeDisplay, setImporteDisplay] = useState("") // formatted display with commas
  const [notaCapturista, setNotaCapturista] = useState("")
  const [restarPresupuesto, setRestarPresupuesto] = useState(false)
  // Cada entrada usa el estado de GalleryPhoto
  const [fileEntries, setFileEntries] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [proveedoresOptions, setProveedoresOptions] = useState<string[]>([])
  const [showProveedores, setShowProveedores] = useState(false)
  const [showCam, setShowCam] = useState(false)

  // In-place expansion state
  const [expandedField, setExpandedField] = useState<ExpandedField>(null)

  // Live calculation states
  const [textSize, setTextSize] = useState(initialTextZoom || 0)

  // textSize scale: -1 = small, 0 = default, 1 = large, 2 = xlarge
  // Uses CSS `zoom` because Tailwind uses rem units — font-size on parent has no effect on rem-based children
  const ZOOM_SCALE: Record<number, number> = {
    [-1]: 1.0,
    [0]: 1.1,
    [1]: 1.2,
    [2]: 1.3,
  }

  const handleZoomIn = () => {
    const next = Math.min(textSize + 1, 2)
    if (next !== textSize) {
      setTextSize(next)
      updateUserTextZoom(userId, next).catch(console.error)
    }
  }

  const handleZoomOut = () => {
    const next = Math.max(textSize - 1, -1)
    if (next !== textSize) {
      setTextSize(next)
      updateUserTextZoom(userId, next).catch(console.error)
    }
  }

  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Recover form state from localStorage on mount (survives OS camera app tab suspension)
  useEffect(() => {
    const saved = localStorage.getItem(`captura_form_${obraId}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.concepto) setConcepto(data.concepto)
        if (data.proveedor) setProveedor(data.proveedor)
        if (data.importeTotal) setImporteTotal(data.importeTotal)
        if (data.importeDisplay) setImporteDisplay(data.importeDisplay)
        if (data.notaCapturista) setNotaCapturista(data.notaCapturista)
        // Recover uploaded photos
        if (data.uploadedFotos && Array.isArray(data.uploadedFotos)) {
          setFileEntries(data.uploadedFotos)
        }
      } catch (e) {}
    }
  }, [obraId])

  // Save form state to localStorage
  useEffect(() => {
    // Only save fully uploaded photos (serializable)
    const uploadedFotos = fileEntries.filter((e) => e.type === "uploaded")
    localStorage.setItem(
      `captura_form_${obraId}`,
      JSON.stringify({
        concepto,
        proveedor,
        importeTotal,
        importeDisplay,
        notaCapturista,
        uploadedFotos,
      })
    )
  }, [
    concepto,
    proveedor,
    importeTotal,
    importeDisplay,
    notaCapturista,
    fileEntries,
    obraId,
  ])

  // Wait for React to apply formatting if needed
  useEffect(() => {
    // Keep it minimal since calculations were removed
  }, [importeTotal])

  useEffect(() => {
    getUniqueProveedores(obraId)
      .then(setProveedoresOptions)
      .catch(console.error)
  }, [obraId])

  const uploadPhoto = async (originalFile: File) => {
    const tempId = Math.random().toString(36).substring(7)

    // 1. Mostrar estado de subiendo (Spinner, 0 RAM)
    setFileEntries((prev) => [...prev, { type: "uploading", id: tempId }])

    try {
      const formData = new FormData()
      formData.append("file", originalFile)
      formData.append("upload_preset", "control_gastos_unsigned")
      formData.append("folder", "control-gastos")

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfdrnpbez/image/upload",
        {
          method: "POST",
          body: formData,
        }
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error?.message || "Error al subir foto")

      const secureUrl = data.secure_url
      const publicId = data.public_id
      // Transformación ultra-ligera para la miniatura
      const previewUrl = secureUrl.replace("/upload/", "/upload/w_300,c_scale/")

      // 2. Actualizar estado con la URL de la nube
      setFileEntries((prev) =>
        prev.map((entry) =>
          entry.type === "uploading" && entry.id === tempId
            ? { type: "uploaded", url: secureUrl, publicId, previewUrl }
            : entry
        )
      )
    } catch (err) {
      console.error("Error subiendo imagen:", err)
      // Quitar la foto fallida del estado
      setFileEntries((prev) =>
        prev.filter(
          (entry) => !(entry.type === "uploading" && entry.id === tempId)
        )
      )
      sileo.error({ title: "Error al subir la imagen: " + originalFile.name })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const newFiles = Array.from(e.target.files)
    e.target.value = ""
    // No bloqueamos con await, subida paralela real
    newFiles.forEach((file) => uploadPhoto(file))
  }

  const handleImporteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip the "$ " prefix and any non-numeric chars except dot
    const raw = e.target.value.replace(/^\$\s*/, "").replace(/[^0-9.]/g, "")
    // Avoid multiple dots
    const parts = raw.split(".")
    const cleaned =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw
    setImporteTotal(cleaned)
    // Format integer part with commas
    const [intPart, decPart] = cleaned.split(".")
    const formatted = intPart
      ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
        (decPart !== undefined ? "." + decPart : "")
      : ""
    setImporteDisplay(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!concepto.trim() || !proveedor.trim() || !importeTotal.trim()) {
      sileo.error({
        title: "No se registró gasto",
        description:
          "Por favor completa los campos obligatorios: Concepto, Proveedor e Importe.",
      })
      return
    }
    setLoading(true)

    const uploadingCount = fileEntries.filter(
      (e) => e.type === "uploading"
    ).length
    if (uploadingCount > 0) {
      sileo.warning({
        title: `Espera un momento, aún se están subiendo ${uploadingCount} foto(s)...`,
      })
      setLoading(false)
      return
    }

    const total = parseFloat(importeTotal)
    if (isNaN(total) || total <= 0) {
      sileo.error({
        title: "No se registró gasto",
        description: "Por favor ingrese un importe válido.",
      })
      setLoading(false)
      return
    }

    try {
      const uploadedFotos = fileEntries
        .filter((e): e is UploadedPhoto => e.type === "uploaded")
        .map((e) => ({ url: e.url, publicId: e.publicId || "" }))

      await addGasto(obraId, {
        fecha: selectedFecha,
        concepto,
        proveedor,
        restarPresupuesto,
        importeTotal: total,
        porcentajeIVA: 0,
        notaCapturista,
        fotos: uploadedFotos,
      })

      // Reset
      setConcepto("")
      setProveedor("")
      setImporteTotal("")
      setImporteDisplay("")
      setNotaCapturista("")
      setRestarPresupuesto(false)
      setFileEntries([])
      setExpandedField(null)
      localStorage.removeItem(`captura_form_${obraId}`)
      sileo.success({
        title: "¡Gasto registrado con éxito!",
        duration: 3000,
      })
      router.refresh()
      setTimeout(() => setSuccess(false), 2500)
    } catch (err: any) {
      sileo.error({
        title: "No se registró gasto",
        description: err.message || "Error al registrar gasto.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showCam && (
        <WebCamDialog
          onCapture={uploadPhoto}
          onClose={() => setShowCam(false)}
        />
      )}
      <div className="flex min-h-screen flex-col bg-background pb-12 font-sans text-foreground">
        {/* Sleek Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background px-6">
          <div className="flex shrink-0 items-center">
            <Link
              href="/captura"
              className="cursor-pointer transition-opacity hover:opacity-80"
            >
              <Image
                src="/Logo MCA horizontal.svg"
                alt="MCA Corp"
                width={100}
                height={20}
                priority
                className="h-auto w-auto brightness-0 invert"
              />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
              <button
                onClick={handleZoomOut}
                disabled={textSize <= -1}
                title="Disminuir Letra"
                className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 12h-15"
                  />
                </svg>
              </button>
              <div className="h-5 w-px bg-muted" />
              <button
                onClick={handleZoomIn}
                disabled={textSize >= 2}
                title="Aumentar Letra"
                className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="-mr-2 p-2 text-foreground/80 transition-colors hover:text-white"
                  aria-label="Menú de opciones"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-7 w-7"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-xl border-border bg-card text-foreground/90"
              >
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer rounded-t-xl py-2.5 focus:bg-muted focus:text-white"
                >
                  <Link href="/captura/historial" className="w-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="mr-2 h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    Historial de Gastos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut({ callbackUrl: "/login" })
                  }}
                  className="mt-1 cursor-pointer rounded-b-xl border-t border-border/50 py-2.5 text-rose-400 focus:bg-muted focus:text-rose-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="mr-2 h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                    />
                  </svg>
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Container — zoom scales rem-based Tailwind classes, font-size does NOT */}
        <main
          style={{ zoom: ZOOM_SCALE[textSize] ?? 1 }}
          className="mx-auto w-full max-w-md flex-1 space-y-6 px-6 py-8 transition-all duration-300"
        >
          {/* Title */}
          <div className="mb-6 space-y-1">
            <Link
              href={`/captura/${obraId}`}
              className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-white"
            >
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
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Regresar a la Obra
            </Link>
            <h1 className="text-3xl leading-tight font-light text-foreground">
              Hola, ingresa la nueva captura de{" "}
              <span className="font-regular text-white">{obraNombre}</span>
            </h1>
          </div>

          {/* Wizard Form - Inline Expanding inputs */}
          <div className="space-y-2">
            {/* Concepto Section */}
            <div className="transition-all duration-300">
              {expandedField === "concepto" ? (
                <div className="w-full animate-in space-y-2 rounded-3xl bg-card p-4 duration-200 zoom-in-95 fade-in">
                  <div className="px-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground normal-case">
                      Concepto
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej. Compra de varilla 1/2"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    className="w-full rounded-full bg-muted px-5 py-3 text-sm text-foreground placeholder-slate-600 outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedField(null)}
                    className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedField("concepto")}
                    className="h-12 w-fit shrink-0 rounded-full bg-card px-6 text-sm font-bold text-foreground/90 shadow-md transition-all hover:bg-card"
                  >
                    Concepto
                  </button>
                  {concepto && (
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {concepto}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Proveedor Section */}
            <div className="transition-all duration-300">
              {expandedField === "proveedor" ? (
                <div className="w-full animate-in space-y-2 rounded-3xl bg-card p-4 duration-200 zoom-in-95 fade-in">
                  <div className="px-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground normal-case">
                      Proveedor
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        type="text"
                        placeholder="Buscar o agregar proveedor..."
                        value={proveedor}
                        onChange={(e) => {
                          setProveedor(e.target.value)
                          setShowProveedores(true)
                        }}
                        onFocus={() => setShowProveedores(true)}
                        onBlur={() =>
                          setTimeout(() => setShowProveedores(false), 200)
                        }
                        className="h-12 w-full rounded-full bg-muted px-5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                        autoFocus
                      />
                      {showProveedores && (
                        <div className="mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-sm">
                          {proveedoresOptions
                            .filter((p) =>
                              p.toLowerCase().includes(proveedor.toLowerCase())
                            )
                            .map((p, i) => (
                              <button
                                key={`prov-${i}`}
                                type="button"
                                className="w-full truncate rounded-lg px-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                  setProveedor(p)
                                  setShowProveedores(false)
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          {proveedoresOptions.filter((p) =>
                            p.toLowerCase().includes(proveedor.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2.5 text-center text-sm text-muted-foreground">
                              Pulsa 'Agregar' para añadir nuevo
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          proveedor.trim() &&
                          !proveedoresOptions.includes(proveedor.trim())
                        ) {
                          const newProv = proveedor.trim()
                          setProveedoresOptions((prev) => [...prev, newProv])
                          try {
                            await quickAddProveedor(newProv)
                          } catch (e) {
                            console.error("Error saving provider to DB:", e)
                          }
                        }
                        setExpandedField(null)
                      }}
                      className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-full bg-muted font-bold text-foreground transition-all hover:bg-muted/80 active:scale-[0.98]"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedField(null)}
                      className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedField("proveedor")}
                    className="h-12 w-fit shrink-0 rounded-full bg-card px-6 text-sm font-bold text-foreground/90 shadow-md transition-all hover:bg-card"
                  >
                    Proveedor
                  </button>
                  {proveedor && (
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {proveedor}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Importe Section */}
            <div className="transition-all duration-300">
              {expandedField === "importe" ? (
                <div className="w-full animate-in space-y-3 rounded-3xl bg-card p-4 duration-200 zoom-in-95 fade-in">
                  <div className="px-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground normal-case">
                      Importe Total Bruto
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="$ 0.00"
                    value={importeDisplay ? `$ ${importeDisplay}` : ""}
                    onChange={handleImporteChange}
                    className="w-full rounded-full bg-muted px-5 py-3 font-sans text-sm text-foreground placeholder-slate-600 outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedField(null)}
                    className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedField("importe")}
                    className="h-12 w-fit shrink-0 rounded-full bg-card px-6 text-sm font-bold text-foreground/90 shadow-md transition-all hover:bg-card"
                  >
                    Importe Total Bruto
                  </button>
                  {importeDisplay && (
                    <span className="truncate text-sm font-bold text-emerald-500">
                      ${importeDisplay}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Nota Section */}
            <div className="transition-all duration-300">
              {expandedField === "nota" ? (
                <div className="w-full animate-in space-y-2 rounded-3xl bg-card p-4 duration-200 zoom-in-95 fade-in">
                  <div className="px-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground normal-case">
                      Nota del Capturista
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Escribe alguna nota aclaratoria..."
                    value={notaCapturista}
                    onChange={(e) => setNotaCapturista(e.target.value)}
                    className="w-full rounded-full bg-muted px-5 py-3 text-sm text-foreground placeholder-slate-600 outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedField(null)}
                    className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedField("nota")}
                    className="h-12 w-fit shrink-0 rounded-full bg-card px-6 text-sm font-bold text-foreground/90 shadow-md transition-all hover:bg-card"
                  >
                    Nota
                  </button>
                  {notaCapturista && (
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {notaCapturista}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Admin Restar Presupuesto */}
            {isAdmin && (
              <div className="transition-all duration-300">
                <div className="flex w-full items-center justify-between space-y-2 rounded-3xl bg-card p-4">
                  <div className="px-2">
                    <span className="text-sm font-bold tracking-wider text-foreground normal-case">
                      Restar del presupuesto
                    </span>
                  </div>
                  <label className="relative mr-2 flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={restarPresupuesto}
                      onChange={(e) => setRestarPresupuesto(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-muted shadow-inner peer-checked:bg-emerald-500 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>
            )}

            {/* Fotos Section */}
            <div className="transition-all duration-300">
              {expandedField === "fotos" ? (
                <div className="w-full animate-in space-y-3 rounded-3xl bg-card p-4 duration-200 zoom-in-95 fade-in">
                  <div className="px-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground normal-case">
                      Comprobantes
                    </span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCam(true)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-muted py-2.5 text-xs font-semibold text-foreground/80 hover:bg-muted"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4 text-foreground/70"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                        />
                      </svg>
                      Cámara
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-muted py-2.5 text-xs font-semibold text-foreground/80 hover:bg-muted">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4 text-foreground/70"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V9.75m0 0 3 3m-3-3-3 3"
                        />
                      </svg>
                      Galería
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {fileEntries.length > 0 && (
                    <p className="mt-1 text-center text-[11px] font-semibold text-primary">
                      ✓ {fileEntries.length} foto
                      {fileEntries.length !== 1 ? "s" : ""} agregada
                      {fileEntries.length !== 1 ? "s" : ""}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedField(null)}
                    className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedField("fotos")}
                    className="flex h-12 w-fit shrink-0 items-center justify-center rounded-full bg-card px-6 text-sm font-bold text-foreground/90 shadow-md transition-all hover:bg-card"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4 text-foreground/70"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                        />
                      </svg>
                      Tomar Foto
                    </span>
                  </button>
                  {fileEntries.length > 0 && (
                    <span className="truncate text-sm font-bold text-primary">
                      {fileEntries.length} adjuntas
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold tracking-wide text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Registrando...
              </span>
            ) : success ? (
              <span className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                ¡Gasto Registrado!
              </span>
            ) : (
              <>
                Registrar Gasto
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                  />
                </svg>
              </>
            )}
          </button>

          {/* Live Preview Card */}
          <div className="relative mt-6 overflow-hidden rounded-3xl bg-card p-5 shadow-lg shadow-slate-950/20">
            {/* Subtle glow effect */}
            <div className="pointer-events-none absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl" />

            <div className="relative mb-4 flex items-center justify-between border-b border-border/50 pb-4">
              <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
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
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                Resumen del Gasto
              </span>
            </div>

            <div className="relative space-y-3">
              {/* Info Concepto/Proveedor */}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm">
                <span className="text-muted-foreground">Fecha</span>
                <span className="text-right font-medium text-foreground/90">
                  {formattedDate}
                </span>

                <span className="text-muted-foreground">Concepto</span>
                <span className="max-w-[150px] truncate text-right font-medium text-foreground/90">
                  {concepto || "—"}
                </span>

                <span className="text-muted-foreground">Proveedor</span>
                <span className="max-w-[150px] truncate text-right font-medium text-foreground/90">
                  {proveedor || "—"}
                </span>
              </div>

              {/* Info Financiera Removida Temporalmente (Se hará por Admin) */}

              {/* Caja Destacada para el Total */}
              <div className="flex items-center justify-between border-t border-border/40 pt-4">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Total a Registrar
                </span>
                <span className="text-right text-xl font-black text-foreground">
                  $
                  {(parseFloat(importeTotal) || 0).toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="ml-0.5 text-xs font-bold text-muted-foreground">
                    mxn
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Preview de fotos adjuntas — debajo del resumen */}
          {fileEntries.length > 0 && (
            <div className="mt-4 rounded-3xl bg-card p-5 shadow-lg shadow-slate-950/20">
              <PhotoPreviewGallery
                photos={fileEntries}
                onRemove={(i) =>
                  setFileEntries((prev) => {
                    const newEntries = [...prev]
                    newEntries.splice(i, 1)
                    return newEntries
                  })
                }
                label="Fotos adjuntas"
              />
            </div>
          )}
        </main>
      </div>
    </>
  )
}
