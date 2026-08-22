"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  addGasto,
  getUniqueProveedores,
  getUniqueCategorias,
} from "@/lib/actions/gastos"
import { sileo } from "sileo"
import { WebCamDialog } from "@/app/components/WebCamDialog"
import PhotoPreviewGallery, {
  GalleryPhoto,
  UploadedPhoto,
} from "@/app/components/PhotoPreviewGallery"

interface CapturaExpenseFormProps {
  obraId: string
  selectedFecha: string // YYYY-MM-DD
  onSuccess?: () => void
  isModal?: boolean
  isAdmin?: boolean
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CapturaExpenseForm({
  obraId,
  selectedFecha,
  onSuccess,
  isModal = false,
  isAdmin = false,
}: CapturaExpenseFormProps) {
  const router = useRouter()
  const [concepto, setConcepto] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [categoria, setCategoria] = useState("")
  const [isImprevisto, setIsImprevisto] = useState(false)
  const [restarPresupuesto, setRestarPresupuesto] = useState(false)
  const [importeTotal, setImporteTotal] = useState("")
  const [importeDisplay, setImporteDisplay] = useState("")
  const [porcentajeIVA, setPorcentajeIVA] = useState("16") // Default 16%
  const [notaCapturista, setNotaCapturista] = useState("")
  // Cada entrada usa el estado de GalleryPhoto
  const [fileEntries, setFileEntries] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [staleClient, setStaleClient] = useState(false)
  const [showCam, setShowCam] = useState(false)

  // States for dynamic autocomplete
  const [proveedoresOptions, setProveedoresOptions] = useState<string[]>([])
  const [showProveedores, setShowProveedores] = useState(false)
  const [isAddingProveedor, setIsAddingProveedor] = useState(false)

  const [categoriasOptions, setCategoriasOptions] = useState<string[]>([])
  const [showCategorias, setShowCategorias] = useState(false)
  const [isAddingCategoria, setIsAddingCategoria] = useState(false)

  // Calculated values state
  const [subtotal, setSubtotal] = useState(0)
  const [ivaCalculado, setIvaCalculado] = useState(0)

  const handleImporteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^0-9.]/g, "")

    // Evitar múltiples puntos
    const parts = rawValue.split(".")
    if (parts.length > 2) {
      rawValue = parts[0] + "." + parts.slice(1).join("")
    }

    setImporteTotal(rawValue)

    // Formatear display
    if (!rawValue) {
      setImporteDisplay("")
      return
    }

    if (rawValue.endsWith(".")) {
      setImporteDisplay(
        parseFloat(rawValue.slice(0, -1)).toLocaleString("en-US") + "."
      )
    } else if (rawValue.includes(".")) {
      const [intPart, decPart] = rawValue.split(".")
      setImporteDisplay(
        parseFloat(intPart).toLocaleString("en-US") + "." + decPart.slice(0, 2)
      )
    } else {
      setImporteDisplay(parseFloat(rawValue).toLocaleString("en-US"))
    }
  }

  // Perform real-time IVA calculations when inputs change
  useEffect(() => {
    const total = parseFloat(importeTotal)
    if (!isNaN(total) && total > 0) {
      const ivaRate = parseFloat(porcentajeIVA) / 100
      const sub = total / (1 + ivaRate)
      const calcIva = total - sub
      setSubtotal(sub)
      setIvaCalculado(calcIva)
    } else {
      setSubtotal(0)
      setIvaCalculado(0)
    }
  }, [importeTotal, porcentajeIVA])

  // Recover form state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`captura_form_desktop_${obraId}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.concepto) setConcepto(data.concepto)
        if (data.proveedor) setProveedor(data.proveedor)
        if (data.categoria) setCategoria(data.categoria)
        if (data.importeTotal) setImporteTotal(data.importeTotal)
        if (data.importeDisplay) setImporteDisplay(data.importeDisplay)
        if (data.notaCapturista) setNotaCapturista(data.notaCapturista)
        if (data.uploadedFotos && Array.isArray(data.uploadedFotos)) {
          setFileEntries(data.uploadedFotos)
        }
      } catch (e) {}
    }
  }, [obraId])

  // Save form state to localStorage
  useEffect(() => {
    const uploadedFotos = fileEntries.filter((e) => e.type === "uploaded")
    localStorage.setItem(
      `captura_form_desktop_${obraId}`,
      JSON.stringify({
        concepto,
        proveedor,
        categoria,
        importeTotal,
        importeDisplay,
        notaCapturista,
        uploadedFotos,
      })
    )
  }, [
    concepto,
    proveedor,
    categoria,
    importeTotal,
    importeDisplay,
    notaCapturista,
    fileEntries,
    obraId,
  ])

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
      // You may need to replace toast usage if toast is imported, if not handled.
    }
  }

  // Fetch unique proveedores and categorias on mount
  useEffect(() => {
    getUniqueProveedores(obraId)
      .then((data) => setProveedoresOptions(data))
      .catch(console.error)

    getUniqueCategorias(obraId)
      .then((data) => setCategoriasOptions(data))
      .catch(console.error)
  }, [obraId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const newFiles = Array.from(e.target.files)
    e.target.value = "" // Limpiar inmediatamente (antes del await)
    for (const file of newFiles) {
      uploadPhoto(file)
    }
  }

  const handleCapturedPhoto = useCallback((file: File) => {
    uploadPhoto(file)
  }, [])

  const removeFile = (index: number) => {
    setFileEntries((prev) => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const uploadingCount = fileEntries.filter(
      (e) => e.type === "uploading"
    ).length
    if (uploadingCount > 0) {
      sileo.error({
        title: "No se registró gasto",
        description: `Espera un momento, aún se están subiendo ${uploadingCount} foto(s)...`
      })
      setLoading(false)
      return
    }

    const total = parseFloat(importeTotal)
    if (isNaN(total) || total <= 0) {
      sileo.error({
        title: "No se registró gasto",
        description: "Por favor ingrese un importe válido."
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
        categoria: categoria || undefined,
        isImprevisto,
        restarPresupuesto,
        importeTotal: total,
        porcentajeIVA: parseInt(porcentajeIVA),
        notaCapturista,
        fotos: uploadedFotos,
      })

      // Clear Form
      setConcepto("")
      setProveedor("")
      setCategoria("")
      setIsImprevisto(false)
      setRestarPresupuesto(false)
      setImporteTotal("")
      setImporteDisplay("")
      setNotaCapturista("")
      setFileEntries([])
      localStorage.removeItem(`captura_form_desktop_${obraId}`)
      sileo.success({
        title: "¡Gasto registrado con éxito!",
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (err: any) {
      const msg: string = err?.message || ""
      sileo.error({
        title: "No se registró gasto",
        description: msg || "Error al registrar el gasto.",
      })
      // Detectar versión desactualizada del cliente (Server Action ID no encontrado)
      if (
        msg.includes("not found on the server") ||
        msg.includes("failed-to-find-server-action") ||
        msg.includes("Server Action")
      ) {
        setStaleClient(true)
      } else {
        sileo.error({
          title: "No se registró gasto",
          description: msg || "Error al registrar gasto."
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <form
      id="captura-expense-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {staleClient && (
        <div className="space-y-2 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4 text-sm">
          <p className="font-semibold text-amber-300">
            ⚠️ La aplicación fue actualizada
          </p>
          <p className="text-xs text-amber-200/80">
            Recarga la página para continuar registrando gastos. No se perdió
            ningún dato.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 w-full rounded-md bg-amber-500 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Recargar página ahora
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="concepto" className="text-xs text-foreground/80">
          Concepto
        </Label>
        <Input
          id="concepto"
          type="text"
          placeholder="Ej. Compra de varilla 1/2"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="h-9 border-border bg-card text-sm text-foreground focus:border-primary/50 focus:ring-primary/20"
          required
        />
      </div>

      <div className="relative space-y-1.5">
        <Label htmlFor="proveedor" className="text-xs text-foreground/80">
          Proveedor
        </Label>

        {!isAddingProveedor ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProveedores(!showProveedores)}
              onBlur={() => setTimeout(() => setShowProveedores(false), 200)}
              className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none"
            >
              <span
                className={
                  proveedor
                    ? "truncate text-foreground"
                    : "truncate text-muted-foreground"
                }
              >
                {proveedor || "Selecciona un proveedor..."}
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

            {showProveedores && (
              <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
                  onClick={() => {
                    setIsAddingProveedor(true)
                    setProveedor("")
                    setShowProveedores(false)
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

                {proveedoresOptions.length > 0 && (
                  <div className="my-1 h-px bg-border" />
                )}

                {proveedoresOptions.map((p, i) => (
                  <button
                    key={`prov-${i}`}
                    type="button"
                    className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setProveedor(p)
                      setShowProveedores(false)
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="proveedor"
              type="text"
              placeholder="Nombre del proveedor... (Presiona Enter)"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (proveedor.trim()) {
                    if (!proveedoresOptions.includes(proveedor.trim())) {
                      setProveedoresOptions((prev) => [
                        ...prev,
                        proveedor.trim(),
                      ])
                    }
                    setIsAddingProveedor(false)
                  }
                }
              }}
              className="h-9 flex-1 border-border bg-card text-sm text-foreground focus:border-primary/50 focus:ring-primary/20"
              required
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (proveedor.trim()) {
                  if (!proveedoresOptions.includes(proveedor.trim())) {
                    setProveedoresOptions((prev) => [...prev, proveedor.trim()])
                  }
                  setIsAddingProveedor(false)
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
                setIsAddingProveedor(false)
                setProveedor("")
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

      {/* Categoría Row */}
      <div className="relative space-y-1.5">
        <Label htmlFor="categoria" className="text-xs text-foreground/80">
          Categoría
        </Label>

        {!isAddingCategoria ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCategorias(!showCategorias)}
              onBlur={() => setTimeout(() => setShowCategorias(false), 200)}
              className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none"
            >
              <span
                className={
                  categoria
                    ? "truncate text-foreground"
                    : "truncate text-muted-foreground"
                }
              >
                {categoria || "Selecciona..."}
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

            {showCategorias && (
              <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
                  onClick={() => {
                    setIsAddingCategoria(true)
                    setCategoria("")
                    setShowCategorias(false)
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

                {categoriasOptions.length > 0 && (
                  <div className="my-1 h-px bg-border" />
                )}

                {categoriasOptions.map((c, i) => (
                  <button
                    key={`cat-${i}`}
                    type="button"
                    className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setCategoria(c)
                      setShowCategorias(false)
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="categoria"
              type="text"
              placeholder="Nueva categoría..."
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (categoria.trim()) {
                    if (!categoriasOptions.includes(categoria.trim())) {
                      setCategoriasOptions((prev) => [
                        ...prev,
                        categoria.trim(),
                      ])
                    }
                    setIsAddingCategoria(false)
                  }
                }
              }}
              className="h-9 flex-1 border-border bg-card text-sm text-foreground focus:border-primary/50 focus:ring-primary/20"
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (categoria.trim()) {
                  if (!categoriasOptions.includes(categoria.trim())) {
                    setCategoriasOptions((prev) => [...prev, categoria.trim()])
                  }
                  setIsAddingCategoria(false)
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
                setIsAddingCategoria(false)
                setCategoria("")
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

      {/* Importe Row */}
      <div className={`grid gap-4 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="space-y-1.5">
          <Label htmlFor="importe" className="text-xs text-foreground/80">
            Importe Total
          </Label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="importe"
              type="text"
              placeholder="Ej. 10,000"
              value={importeDisplay}
              onChange={handleImporteChange}
              className="h-9 border-border bg-card pl-7 text-sm text-foreground focus:border-primary/50"
              required
              autoComplete="off"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col justify-end space-y-1.5">
            <Label className="mb-1 text-xs text-foreground/80">
              Restar del presupuesto diario
            </Label>
            <div className="flex h-9 items-center rounded-md border border-border bg-card px-3">
              <label className="group flex w-full cursor-pointer items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={restarPresupuesto}
                    onChange={(e) => setRestarPresupuesto(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-muted shadow-inner peer-checked:bg-emerald-500 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </div>
                <span
                  className={`text-sm select-none ${restarPresupuesto ? "font-medium text-emerald-500" : "text-muted-foreground transition-colors group-hover:text-foreground/80"}`}
                >
                  {restarPresupuesto ? "Sí, restar" : "No restar"}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Imprevisto Col */}
        <div className="flex flex-col justify-end space-y-1.5">
          <Label className="mb-1 text-xs text-foreground/80">
            ¿Fue Imprevisto?
          </Label>
          <div className="flex h-9 items-center rounded-md border border-border bg-card px-3">
            <label className="group flex w-full cursor-pointer items-center gap-2">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isImprevisto}
                  onChange={(e) => setIsImprevisto(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-muted shadow-inner peer-checked:bg-rose-500 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </div>
              <span
                className={`text-sm select-none ${isImprevisto ? "font-medium text-rose-400" : "text-muted-foreground transition-colors group-hover:text-foreground/80"}`}
              >
                Sí, imprevisto
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col justify-end space-y-1.5">
          <Label className="text-xs text-foreground/80">Tasa de IVA</Label>
          <div className="flex h-9 items-center overflow-x-auto rounded-md border border-border bg-card px-1">
            <label className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs text-foreground/80 transition-colors hover:bg-muted/50">
              <input
                type="radio"
                name="porcentajeIVA"
                value="0"
                checked={porcentajeIVA === "0"}
                onChange={(e) => setPorcentajeIVA(e.target.value)}
                className="accent-primary"
              />
              0%
            </label>
            <label className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs text-foreground/80 transition-colors hover:bg-muted/50">
              <input
                type="radio"
                name="porcentajeIVA"
                value="8"
                checked={porcentajeIVA === "8"}
                onChange={(e) => setPorcentajeIVA(e.target.value)}
                className="accent-primary"
              />
              8%
            </label>
            <label className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs text-foreground/80 transition-colors hover:bg-muted/50">
              <input
                type="radio"
                name="porcentajeIVA"
                value="16"
                checked={porcentajeIVA === "16"}
                onChange={(e) => setPorcentajeIVA(e.target.value)}
                className="accent-primary"
              />
              16%
            </label>
          </div>
        </div>
      </div>

      {/* Desglose de IVA y Fecha en tiempo real */}
      <div className="space-y-1.5 rounded-lg border border-border/50 bg-card/40 p-3 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium text-muted-foreground">
            Fecha de registro:
          </span>
          <span className="font-bold text-foreground/80">
            {(() => {
              const [y, m, d] = selectedFecha.split("-")
              return new Date(
                Number(y),
                Number(m) - 1,
                Number(d)
              ).toLocaleDateString("es-MX", { dateStyle: "long" })
            })()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal:</span>
          <span className="font-semibold text-foreground/80">
            $
            {subtotal.toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            mxn
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA ({porcentajeIVA}%):</span>
          <span className="font-semibold text-foreground/80">
            $
            {ivaCalculado.toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            mxn
          </span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-border/50 pt-1.5 font-bold">
          <span className="text-muted-foreground">Importe Total:</span>
          <span className="text-foreground">
            $
            {(subtotal + ivaCalculado).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            mxn
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nota" className="text-xs text-foreground/80">
          Nota del Capturista
        </Label>
        <textarea
          id="nota"
          rows={3}
          value={notaCapturista}
          onChange={(e) => setNotaCapturista(e.target.value)}
          placeholder="Escribe alguna nota aclaratoria sobre el gasto..."
          className="w-full rounded border border-border bg-card p-2 text-sm text-foreground placeholder-slate-600 outline-none focus:border-primary/50"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-foreground/80">
          Fotos de Facturas / Comprobantes
        </Label>

        <div className="flex gap-2">
          {/* Botón Webcam */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCam(true)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 border-border text-xs text-foreground/80 hover:bg-card"
          >
            Tomar Foto
          </Button>

          {/* Subir desde carpeta */}
          <Button
            variant="outline"
            asChild
            className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 border-border text-xs font-normal text-foreground/80 hover:bg-card"
          >
            <label>
              Elegir archivos
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </Button>
        </div>

        {/* Preview de archivos seleccionados */}
        <PhotoPreviewGallery photos={fileEntries} onRemove={removeFile} />
      </div>

      {!isModal && (
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
        >
          {loading ? "Registrando..." : "Registrar Gasto"}
        </Button>
      )}
    </form>
  )

  return (
    <>
      {showCam && (
        <WebCamDialog
          onCapture={handleCapturedPhoto}
          onClose={() => setShowCam(false)}
        />
      )}

      {isModal ? (
        formContent
      ) : (
        <Card className="sticky top-24 border-border/50 bg-background/40">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground">
              Registrar Gasto
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Ingresa los detalles del comprobante para agregarlo a la jornada
              de trabajo.
            </CardDescription>
          </CardHeader>
          <CardContent>{formContent}</CardContent>
        </Card>
      )}
    </>
  )
}
