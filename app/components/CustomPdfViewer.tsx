"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface CustomPdfViewerProps {
  url: string
}

export default function CustomPdfViewer({ url }: CustomPdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2) // Default scale
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 })

  const baseRenderScale = 1.5

  useEffect(() => {
    const loadPdfJs = async () => {
      if (!(window as any).pdfjsLib) {
        const script = document.createElement("script")
        script.src =
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"
        script.async = true
        document.body.appendChild(script)

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
        })
      }

      const pdfjsLib = (window as any).pdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"

      try {
        const loadingTask = pdfjsLib.getDocument({ url: url })
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setPageNum(1)
        setLoading(false)
      } catch (error) {
        console.error("Error loading PDF", error)
        setPdfDoc(null)
        setLoading(false)
      }
    }

    loadPdfJs()
  }, [url])

  const renderTaskRef = useRef<any>(null)

  const renderPage = async (num: number) => {
    if (!pdfDoc || !canvasRef.current) return

    try {
      const page = await pdfDoc.getPage(num)
      const viewport = page.getViewport({ scale: baseRenderScale })

      const canvas = canvasRef.current
      const context = canvas.getContext("2d")
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      // Ensure canvas CSS width matches physical to keep scale mapping 1:1 before transforms
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      setPdfSize({ width: viewport.width, height: viewport.height })

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      renderTaskRef.current = page.render(renderContext)
      await renderTaskRef.current.promise
      renderTaskRef.current = null
    } catch (err: any) {
      if (err.name === "RenderingCancelledException") {
        // Ignored
      } else {
        console.error("Error rendering page", err)
      }
    }
  }

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum)
    }
  }, [pdfDoc, pageNum])

  const clampOffset = (x: number, y: number, s: number) => {
    if (!containerRef.current || !canvasRef.current) return { x, y }

    const containerW = containerRef.current.clientWidth
    const containerH = containerRef.current.clientHeight
    const canvasW = canvasRef.current.width
    const canvasH = canvasRef.current.height

    const scaledW = canvasW * s
    const scaledH = canvasH * s

    let newX = x
    let newY = y

    if (scaledW <= containerW) {
      newX = (containerW - scaledW) / 2
    } else {
      newX = Math.min(0, Math.max(containerW - scaledW, x))
    }

    if (scaledH <= containerH) {
      newY = (containerH - scaledH) / 2
    } else {
      newY = Math.min(0, Math.max(containerH - scaledH, y))
    }

    return { x: newX, y: newY }
  }

  const handleZoom = (newScale: number, cursorX?: number, cursorY?: number) => {
    if (!containerRef.current) return

    const s = Math.min(4.0, Math.max(0.5, newScale))

    let cX = cursorX
    let cY = cursorY

    if (cX === undefined || cY === undefined) {
      cX = containerRef.current.clientWidth / 2
      cY = containerRef.current.clientHeight / 2
    }

    const unscaledX = (cX - offset.x) / scale
    const unscaledY = (cY - offset.y) / scale

    const newX = cX - unscaledX * s
    const newY = cY - unscaledY * s

    setScale(s)
    setOffset(clampOffset(newX, newY, s))
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    const zoomDirection = e.deltaY > 0 ? -1 : 1
    const zoomAmount = 0.1 * zoomDirection

    handleZoom(scale + zoomAmount, cursorX, cursorY)
  }

  const handlePrevPage = () => {
    if (pageNum <= 1) return
    setPageNum((prev) => prev - 1)
  }

  const handleNextPage = () => {
    if (pageNum >= numPages) return
    setPageNum((prev) => prev + 1)
  }

  const handleZoomIn = () => handleZoom(scale + 0.2)
  const handleZoomOut = () => handleZoom(scale - 0.2)

  const handleDownload = () => {
    const downloadUrl = url.includes("?")
      ? `${url}&download=true`
      : `${url}?download=true`
    window.open(downloadUrl, "_blank")
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setScrollStart({ left: offset.x, top: offset.y })
  }

  useEffect(() => {
    if (!containerRef.current || pdfSize.width === 0 || pdfSize.height === 0)
      return

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          const fitScale =
            Math.min(width / pdfSize.width, height / pdfSize.height) * 0.95
          setScale(fitScale)

          const newX = (width - pdfSize.width * fitScale) / 2
          const newY = (height - pdfSize.height * fitScale) / 2
          setOffset({ x: newX, y: newY })
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [pdfSize.width, pdfSize.height])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      setOffset(clampOffset(scrollStart.left + dx, scrollStart.top + dy, scale))
    }

    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragStart, scrollStart, scale])

  return (
    <div className="flex h-full w-full flex-col bg-muted/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />
      {/* Toolbar */}
      <div className="z-10 flex min-h-12 w-full shrink-0 flex-wrap items-center gap-2 overflow-x-auto border-b bg-background/50 p-2">
        <div className="flex min-w-0 shrink-0 items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted disabled:opacity-50"
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
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <span className="min-w-[3rem] shrink-0 px-2 text-center text-sm font-medium whitespace-nowrap">
            {pageNum} / {numPages || 1}
          </span>
          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted disabled:opacity-50"
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
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
          <button
            onClick={handleZoomOut}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded font-bold transition-colors hover:bg-muted"
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
                d="M19.5 12h-15"
              />
            </svg>
          </button>
          <span className="min-w-[3rem] shrink-0 px-2 text-center text-sm font-medium whitespace-nowrap">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded font-bold transition-colors hover:bg-muted"
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </button>
        </div>

        <div className="ml-auto min-w-0 shrink-0">
          <Button
            size="sm"
            onClick={handleDownload}
            className="h-10 shrink-0 gap-2 rounded-md"
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
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <span className="hidden sm:inline">Descargar</span>
          </Button>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div
        className={`relative flex-1 overflow-hidden bg-black/5 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="font-medium text-muted-foreground">
              Cargando documento...
            </span>
          </div>
        ) : !pdfDoc ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <span className="font-medium text-destructive">
              Error al cargar el documento PDF.
            </span>
            <span className="text-sm text-muted-foreground">
              Verifica la consola para más detalles.
            </span>
          </div>
        ) : (
          <div
            className="absolute origin-top-left will-change-transform"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          >
            <canvas
              ref={canvasRef}
              className="h-auto max-w-none bg-white object-contain shadow-xl"
            />
          </div>
        )}
      </div>
    </div>
  )
}
