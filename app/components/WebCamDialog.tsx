"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export function WebCamDialog({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError(
        "El navegador no puede acceder a la cámara. Asegúrate de usar https:// o localhost."
      )
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          advanced: [{ focusMode: "continuous" } as any],
        },
        audio: false,
      })
      .catch(() =>
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
          audio: false,
        })
      )
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {})
            if (!cancelled) setReady(true)
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setCamError(
            "Permiso de cámara denegado. Haz clic en el ícono 🔒 en la barra de dirección → Permitir cámara → recarga."
          )
        } else if (err.name === "NotFoundError") {
          setCamError("No se encontró ninguna cámara conectada a este equipo.")
        } else {
          setCamError(err.message || "Error al acceder a la cámara.")
        }
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !ready) return
    canvas.width = video.videoWidth || 4096
    canvas.height = video.videoHeight || 2160
    const ctx = canvas.getContext("2d")
    ctx?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95)
    setCaptured(dataUrl)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [ready])

  const handleRetake = useCallback(() => {
    setCaptured(null)
    setReady(false)
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          advanced: [{ focusMode: "continuous" } as any],
        },
        audio: false,
      })
      .catch(() =>
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
          audio: false,
        })
      )
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {})
            setReady(true)
          }
        }
      })
      .catch((err) => setCamError(err.message || "Error al reactivar cámara."))
  }, [])

  const handleUse = useCallback(() => {
    if (!captured || !canvasRef.current) return
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `foto_${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        onCapture(file)
        onClose()
      },
      "image/jpeg",
      0.95
    )
  }, [captured, onCapture, onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 sm:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-background sm:mx-4 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl">
        {/* Header */}
        <div className="z-10 flex shrink-0 items-center justify-between border-b border-border bg-background px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <span className="text-sm font-semibold text-foreground/90">
              {captured ? "Vista previa" : "Cámara en vivo"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground/90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-black">
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-12 w-12 text-rose-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <p className="text-sm leading-relaxed text-rose-400">
                {camError}
              </p>
            </div>
          ) : captured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={captured}
              alt="Foto capturada"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer */}
        <div className="z-10 flex shrink-0 gap-3 border-t border-border bg-background p-4 pb-8 sm:pb-4">
          {captured ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="h-11 flex-1 rounded-full border border-border text-sm text-foreground/80 transition-colors hover:bg-card"
              >
                Volver a tomar
              </button>
              <button
                type="button"
                onClick={handleUse}
                className="h-11 flex-1 rounded-full bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                ✓ Usar esta foto
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-full border border-border text-sm text-muted-foreground transition-colors hover:bg-card"
              >
                Cancelar
              </button>
              {!camError && (
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!ready}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-background transition-colors hover:bg-card disabled:opacity-40"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-background">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-background" />
                  </span>
                  Capturar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
