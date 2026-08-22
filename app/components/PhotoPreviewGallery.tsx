"use client"

import { useState, useCallback } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface UploadedPhoto {
  type: "uploaded"
  id?: string
  url: string
  previewUrl?: string // Cloudinary transformed URL para miniatura
  publicId?: string
}

export interface UploadingPhoto {
  type: "uploading"
  id: string // ID temporal
  file?: File // Opcional, solo si se quiere mantener referencia
}

export type GalleryPhoto = UploadedPhoto | UploadingPhoto

interface PhotoPreviewGalleryProps {
  photos: GalleryPhoto[]
  /** Mostrar botón para quitar foto (solo en modo capturista con fotos locales) */
  onRemove?: (index: number) => void
  /** Etiqueta del encabezado */
  label?: string
}

export default function PhotoPreviewGallery({
  photos,
  onRemove,
  label,
}: PhotoPreviewGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1)
  // objectURLs creados para el lightbox (tamaño completo). Se revocan al cerrar.
  const [lbObjectUrls, setLbObjectUrls] = useState<string[]>([])
  const [lbSlides, setLbSlides] = useState<{ src: string }[]>([])

  if (photos.length === 0) return null

  const getThumb = (photo: GalleryPhoto): string | null => {
    if (photo.type === "uploaded") return photo.previewUrl || photo.url
    return null // Si está subiendo, no hay thumb
  }

  // Al abrir el lightbox: generar slides con la imagen a tamaño completo.
  // Para fotos subidas: usa la URL de Cloudinary directamente.
  // Para fotos locales: crea un objectURL del File original (no la miniatura).
  const openLightbox = useCallback(
    (index: number) => {
      const urls: string[] = []
      const slides = photos.map((photo) => {
        if (photo.type === "uploaded") {
          return { src: photo.url }
        }
        // Si está en uploading, no se debería poder abrir el lightbox, pero por si acaso:
        return { src: "" }
      })
      setLbSlides(slides.filter((s) => s.src !== ""))
      setLbObjectUrls(urls)
      setLightboxIndex(index)
    },
    [photos]
  )

  // Al cerrar: revocar todos los objectURLs para liberar memoria
  const closeLightbox = useCallback(() => {
    lbObjectUrls.forEach((url) => URL.revokeObjectURL(url))
    setLbObjectUrls([])
    setLbSlides([])
    setLightboxIndex(-1)
  }, [lbObjectUrls])

  return (
    <>
      {/* Label */}
      {label && (
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          {label}{" "}
          <span className="font-normal text-muted-foreground/60">
            ({photos.length})
          </span>
        </p>
      )}

      {/* Grid de miniaturas */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => {
          const thumb = getThumb(photo)
          return (
            <div
              key={i}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/50 active:scale-95"
              onClick={() => openLightbox(i)}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={`Foto #${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                /* Placeholder mientras carga la miniatura */
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/30 p-2">
                  <div className="mb-1 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="w-full truncate px-1 text-center text-[9px] font-medium text-muted-foreground">
                    Subiendo...
                  </span>
                </div>
              )}

              <div
                className={`absolute inset-0 bg-black/0 transition-colors ${photo.type === "uploaded" ? "group-hover:bg-black/20" : ""}`}
              />

              {/* Ícono ampliar */}
              {photo.type === "uploaded" && (
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth={2.5}
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                </div>
              )}

              {/* Botón quitar */}
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(i)
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-rose-500 p-1 text-white shadow-lg transition-transform hover:bg-rose-600 active:scale-90"
                  title="Quitar imagen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="h-3 w-3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}

              {/* Número */}
              <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 text-[9px] leading-4 font-bold text-white">
                {i + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* yet-another-react-lightbox — usa slides con URLs a tamaño completo */}
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={closeLightbox}
        slides={lbSlides}
        carousel={{ finite: lbSlides.length <= 1 }}
        styles={{
          container: { backgroundColor: "rgba(0,0,0,0.95)" },
        }}
      />
    </>
  )
}
